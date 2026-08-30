import type {
  AsymptaActionType,
  AsymptaAgentId,
  AsymptaLocationId,
  IntentTaskSpec,
  PlannerResult,
} from "./types.ts";
import { normalizeUserIntent, validateIntentPlan } from "./validation.ts";

type Locale = "en" | "zh-Hant" | "ja";

function stableHash(input: string) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function inferLocale(intent: string): Locale {
  if (/[\u3040-\u30ff]/u.test(intent)) return "ja";
  if (/[\u3400-\u9fff]/u.test(intent)) return "zh-Hant";
  return "en";
}

type FallbackCopy = {
  title: (intent: string) => string;
  summary: string;
  outcome: string;
  assistant: string;
  criteria: string[];
};

function fallbackCopy(locale: Locale, intent: string): FallbackCopy {
  const excerpt = intent.length > 44 ? `${intent.slice(0, 43)}…` : intent;
  if (locale === "zh-Hant") {
    return {
      title: () => `處理：${excerpt}`,
      summary: "代理會先澄清意圖，再蒐集證據、協調執行、驗證結果，並只在有實際後果的動作前要求人工批准。",
      outcome: "產出一個可檢查、可追蹤，而且不會越過人工權限邊界的模擬結果。",
      assistant: "免費模型暫時未能回應；我已用相同安全規則建立一個針對你要求的本地動態計劃。",
      criteria: ["每個步驟都有明確負責代理與完成條件", "依賴關係按順序完成", "有實際後果的動作必須先獲人工批准"],
    };
  }
  if (locale === "ja") {
    return {
      title: () => `実行：${excerpt}`,
      summary: "エージェントが意図を整理し、証拠を集め、実行を調整し、結果を検証します。影響のある操作は必ず人の承認前で停止します。",
      outcome: "検査可能で追跡でき、人の権限境界を越えないシミュレーション結果を作ります。",
      assistant: "無料モデルが一時的に応答できなかったため、同じ安全規則で要求専用のローカル動的プランを作成しました。",
      criteria: ["各ステップに担当エージェントと完了条件がある", "依存関係の順序が守られる", "影響のある操作は人の承認を必要とする"],
    };
  }
  return {
    title: () => `Handle: ${excerpt}`,
    summary: "Agents will clarify intent, gather evidence, coordinate execution, validate the result, and stop for human approval before any consequential simulated action.",
    outcome: "Produce an inspectable, traceable simulation result without crossing the human authority boundary.",
    assistant: "The free model was temporarily unavailable, so I built a request-specific local plan under the same safety rules.",
    criteria: ["Every step has an accountable agent and validation rule", "Dependencies complete in order", "Consequential actions require human approval"],
  };
}

function classification(intent: string) {
  const lower = intent.toLowerCase();
  const commerce = /(buy|order|purchase|shop|supplier|ship|deliver|dinner|food|買|購買|訂|供應|物流|晚餐|食物|注文|購入|配送)/u.test(lower);
  const communicate = /(email|message|send|publish|contact|reply|電郵|郵件|訊息|聯絡|回覆|メール|連絡|返信)/u.test(lower);
  const schedule = /(schedule|book|appointment|meeting|reserve|安排|預約|會議|日程|予約|打合せ)/u.test(lower);
  const research = /(research|compare|analyse|analyze|investigate|find|study|研究|比較|分析|尋找|調查|調べ|比較|分析)/u.test(lower);
  if (commerce) return "commerce" as const;
  if (communicate) return "communication" as const;
  if (schedule) return "schedule" as const;
  if (research) return "research" as const;
  return "general" as const;
}

function task(
  id: string,
  title: string,
  detail: string,
  agentId: AsymptaAgentId,
  locationId: AsymptaLocationId,
  dependsOn: string[],
  actionType: AsymptaActionType,
  validation: string,
  requiresApproval = false,
  consequence = "No external commitment; simulated world state only.",
  workMs = 2_600,
): IntentTaskSpec {
  return { id, title, detail, agentId, locationId, dependsOn, actionType, validation, requiresApproval, consequence, workMs };
}

export function buildDeterministicIntentPlan(intentInput: string): PlannerResult {
  const intentValidation = normalizeUserIntent(intentInput);
  const intent = intentValidation.ok ? intentValidation.value : "Complete the user's requested outcome safely.";
  const locale = inferLocale(intent);
  const copy = fallbackCopy(locale, intent);
  const kind = classification(intent);
  const zh = locale === "zh-Hant";
  const ja = locale === "ja";
  const label = (en: string, traditionalChinese: string, japanese: string) => zh ? traditionalChinese : ja ? japanese : en;

  const intake = task(
    "intake",
    label("Structure the intention", "整理使用者意圖", "意図を構造化"),
    intent,
    "agent-user",
    "intent-studio",
    [],
    "reason",
    label("Intent, constraints, and desired outcome are explicit.", "意圖、限制與期望成果已清楚列出。", "意図・制約・望む結果が明示されている。"),
    false,
    "",
    1_700,
  );
  const constraints = task(
    "constraints",
    label("Protect constraints", "確認不可妥協限制", "制約を保護"),
    label("Separate hard constraints from preferences and identify missing facts.", "把硬性限制與偏好分開，並找出缺失資訊。", "必須条件と希望を分け、不足情報を特定する。"),
    "agent-customer",
    "customer-desk",
    ["intake"],
    "reason",
    label("No hard constraint is silently relaxed.", "沒有任何硬性限制被靜默放寬。", "必須条件が暗黙に緩和されていない。"),
    false,
    "",
    1_900,
  );
  const evidence = task(
    "evidence",
    label("Gather relevant evidence", "蒐集相關證據", "関連証拠を集める"),
    label("Collect bounded simulated evidence needed to choose a viable route.", "蒐集選擇可行路徑所需的有限模擬證據。", "実行可能な経路を選ぶための限定的なシミュレーション証拠を集める。"),
    "agent-market",
    "market-library",
    ["intake"],
    "research",
    label("Evidence is separated from assumptions and uncertainty is visible.", "證據、假設與不確定性已分開。", "証拠・仮定・不確実性が区別されている。"),
    false,
    "",
    2_800,
  );
  const coordinate = task(
    "coordinate",
    label("Design the execution route", "設計執行路徑", "実行経路を設計"),
    label("Convert intent, constraints, and evidence into an executable dependency graph.", "把意圖、限制與證據轉換成可執行的依賴圖。", "意図・制約・証拠を実行可能な依存グラフに変換する。"),
    "agent-business",
    "business-hub",
    ["constraints", "evidence"],
    "reason",
    label("The route is feasible, bounded, and names every handoff.", "路徑可行、有界，而且清楚標示每次交接。", "経路が実行可能で限定され、すべての引き継ぎが明示されている。"),
    false,
    "",
    2_600,
  );

  const tasks: IntentTaskSpec[] = [intake, constraints, evidence, coordinate];

  if (kind === "commerce") {
    tasks.push(
      task(
        "supply",
        label("Check simulated availability", "檢查模擬供應情況", "模擬在庫を確認"),
        label("Check availability, lead time, substitutions, and fulfilment constraints without claiming live stock.", "檢查供應、交期、替代方案與履約限制，但不聲稱是即時庫存。", "在庫・納期・代替案・履行制約を確認し、実在庫とは主張しない。"),
        "agent-supplier",
        "supplier-yard",
        ["coordinate"],
        "research",
        label("Availability claims are labelled simulated and internally consistent.", "供應資訊清楚標示為模擬，而且內部一致。", "在庫情報がシミュレーションと明示され、内部整合している。"),
        false,
        "",
        2_700,
      ),
      task(
        "approval",
        label("Request commitment approval", "要求承諾批准", "コミット承認を依頼"),
        label("Present the simulated commitment, cost, and consequence before proceeding.", "在繼續之前顯示模擬承諾、成本與後果。", "続行前にシミュレーション上の約束・費用・影響を提示する。"),
        "agent-finance",
        "finance-gate",
        ["supply"],
        "place_order",
        label("A human explicitly approves before the simulated order is placed.", "模擬下單前已有明確人工批准。", "シミュレーション注文前に人が明示的に承認する。"),
        true,
        label("Allow a simulated order or reservation. No real payment or purchase will occur.", "允許模擬訂單或預留；不會進行真實付款或購買。", "シミュレーション注文または予約を許可する。実際の支払いや購入は行わない。"),
        1_400,
      ),
      task(
        "fulfil",
        label("Execute simulated fulfilment", "執行模擬履約", "模擬履行を実行"),
        label("Coordinate preparation and handoffs in dependency order.", "按依賴順序協調準備與交接。", "依存順に準備と引き継ぎを調整する。"),
        "agent-operations",
        "operations-floor",
        ["approval"],
        "reason",
        label("Every simulated resource handoff is represented in state.", "每次模擬資源交接都有狀態紀錄。", "すべての模擬リソース引き継ぎが状態に記録されている。"),
        false,
        "",
        3_200,
      ),
      task(
        "verify",
        label("Verify the requested outcome", "驗證要求成果", "要求結果を検証"),
        label("Check the result against constraints and acceptance criteria before completion.", "完成前依照限制與驗收條件檢查結果。", "完了前に制約と受入基準に照らして結果を確認する。"),
        "agent-quality",
        "quality-lab",
        ["fulfil"],
        "reason",
        label("All acceptance criteria pass or the task remains blocked.", "所有驗收條件通過，否則工作保持暫停。", "すべての受入基準を満たすまでブロックを維持する。"),
        false,
        "",
        2_200,
      ),
      task(
        "complete",
        label("Close the loop", "完成並交付", "完了して引き渡す"),
        label("Summarise the simulated outcome, evidence, approvals, and unresolved limits.", "總結模擬成果、證據、批准與仍未解決的限制。", "模擬結果・証拠・承認・未解決の制限をまとめる。"),
        "agent-support",
        "support-desk",
        ["verify"],
        "create_artifact",
        label("The user can inspect what completed, why, and what remains simulated.", "使用者可檢查完成了甚麼、原因，以及哪些仍是模擬。", "完了内容・理由・シミュレーション範囲を利用者が確認できる。"),
        false,
        "",
        1_800,
      ),
    );
  } else {
    const commitment = kind === "communication" || kind === "schedule";
    tasks.push(
      task(
        "execute",
        label("Execute the bounded work", "執行有界工作", "限定された作業を実行"),
        label("Produce the requested simulated work product while preserving the validated constraints.", "在保留已驗證限制的情況下產出要求的模擬成果。", "検証済みの制約を守りながら要求されたシミュレーション成果を作る。"),
        "agent-operations",
        "operations-floor",
        ["coordinate"],
        commitment ? (kind === "communication" ? "send_external_message" : "commit_contract") : "create_artifact",
        label("The work product is complete and traceable to the request.", "成果完整，而且可追溯至使用者要求。", "成果物が完成し、要求まで追跡できる。"),
        commitment,
        commitment
          ? label("Allow the simulated external commitment. No real message or booking will be sent.", "允許模擬對外承諾；不會真的發送訊息或建立預約。", "外部コミットのシミュレーションを許可する。実際の送信や予約は行わない。")
          : "",
        3_200,
      ),
      task(
        "verify",
        label("Verify the result", "驗證成果", "結果を検証"),
        label("Check completeness, consistency, and acceptance criteria.", "檢查完整性、一致性與驗收條件。", "完全性・整合性・受入基準を確認する。"),
        "agent-quality",
        "quality-lab",
        ["execute"],
        "reason",
        label("The result passes every acceptance criterion or remains blocked.", "成果通過所有驗收條件，否則保持暫停。", "すべての受入基準を満たすまでブロックを維持する。"),
        false,
        "",
        2_200,
      ),
      task(
        "complete",
        label("Deliver an inspectable result", "交付可檢查成果", "検査可能な結果を渡す"),
        label("Summarise the result, evidence, validation, and limitations.", "總結成果、證據、驗證與限制。", "結果・証拠・検証・制限をまとめる。"),
        "agent-support",
        "support-desk",
        ["verify"],
        "create_artifact",
        label("The user can see what completed and why it is considered valid.", "使用者可看到已完成內容及其有效原因。", "完了内容と妥当と判断した理由を利用者が確認できる。"),
        false,
        "",
        1_800,
      ),
    );
  }

  const planValidation = validateIntentPlan({
    id: stableHash(intent),
    title: copy.title(intent),
    summary: copy.summary,
    outcome: copy.outcome,
    acceptanceCriteria: copy.criteria,
    tasks,
  }, intent);

  if (!planValidation.ok) {
    throw new Error(`Internal fallback plan failed validation: ${planValidation.error}`);
  }

  return {
    ready: true,
    assistantMessage: copy.assistant,
    questions: [],
    plan: planValidation.value,
  };
}
