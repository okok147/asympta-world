import {
  assertAsymptaTaskReady,
  buildAsymptaTaskPacket,
  createAsymptaTaskIntent,
  type AsymptaActionPermission,
  type AsymptaJsonValue,
  type AsymptaTaskFact,
  type AsymptaTaskIntent,
  type AsymptaTaskPacket,
  type AsymptaTaskQuestion,
  type AsymptaTaskRequirement,
} from "./asympta-task-protocol.ts";
import type {
  ContextEnvelope,
  ContextFact,
  MarketplaceGoal,
} from "./asympta-context-compiler.ts";
import type { MarketplaceProfileField } from "./asympta-marketplace-profile.ts";
import { marketplaceSelectionRequirement } from "./asympta-marketplace-selection-gate.ts";

export const MARKETPLACE_REQUIREMENT_CONTRACT_VERSION = "asympta.marketplace-requirements.v1" as const;

export type MarketplaceTaskProtocolBundle = {
  schemaVersion: "asympta.task-bundle.v1";
  requestId: string;
  contractVersion: typeof MARKETPLACE_REQUIREMENT_CONTRACT_VERSION;
  tasks: AsymptaTaskIntent[];
  readiness: {
    status: "needs_information" | "ready";
    nextTaskId: string | null;
    nextRequirementId: string | null;
    nextQuestion: AsymptaTaskQuestion | null;
    nextProfileField: MarketplaceProfileField | null;
    missingProfileFields: MarketplaceProfileField[];
  };
};

const FOOD_OPTIONS = [
  ["no_preference", { en: "Anything suitable", "zh-Hant": "合適即可", ja: "おまかせ" }],
  ["local_cantonese", { en: "Cantonese / local", "zh-Hant": "港式／粵菜", ja: "広東／ローカル" }],
  ["japanese", { en: "Japanese", "zh-Hant": "日式", ja: "日本食" }],
  ["western_comfort", { en: "Western comfort", "zh-Hant": "西式家常", ja: "洋食" }],
  ["vegetarian", { en: "Vegetarian", "zh-Hant": "素食", ja: "ベジタリアン" }],
] as const;

const FULFILMENT_OPTIONS = [
  ["personal_agent_pickup", { en: "Personal agent pickup", "zh-Hant": "個人代理自取", ja: "個人エージェント受取" }],
  ["courier_delivery", { en: "Courier delivery", "zh-Hant": "速遞送貨", ja: "配達" }],
] as const;

const PAYMENT_OPTIONS = [
  ["asympta_wallet", { en: "Asympta Wallet", "zh-Hant": "Asympta 錢包", ja: "Asympta Wallet" }],
  ["card_on_file", { en: "Card on file", "zh-Hant": "已登記卡", ja: "登録カード" }],
  ["pay_on_delivery", { en: "Pay on delivery", "zh-Hant": "貨到付款", ja: "代引き" }],
] as const;

function factStatus(fact: ContextFact): AsymptaTaskFact["status"] {
  if (fact.status === "explicit") return "explicit";
  if (fact.status === "profile") return "profile";
  return "defaulted";
}

function factSource(fact: ContextFact): AsymptaTaskFact["source"]["type"] {
  if (fact.source.type === "user_message") return "user_message";
  if (fact.source.type === "approved_user_profile") return "approved_user_profile";
  return "system_default";
}

function taskFact(fact: ContextFact, domain: string, updatedAt: string): AsymptaTaskFact {
  return {
    key: fact.key,
    value: fact.value as AsymptaJsonValue,
    status: factStatus(fact),
    source: {
      type: factSource(fact),
      ref: fact.source.ref,
      ...(fact.source.evidence ? { evidence: fact.source.evidence } : {}),
    },
    confidence: fact.confidence,
    scope: "task",
    domain,
    updatedAt,
  };
}

function option(value: string, label: { en: string; "zh-Hant": string; ja: string }) {
  return { value, label };
}

function marketplaceRequirements(goal: MarketplaceGoal): AsymptaTaskRequirement[] {
  const prefix = goal.id;
  const requirements: AsymptaTaskRequirement[] = [];
  const selectionRequirement = marketplaceSelectionRequirement(goal);
  if (selectionRequirement) requirements.push(selectionRequirement);

  if (goal.domain === "food") {
    requirements.push({
      id: `${prefix}:food-preference`,
      capability: "food.select",
      field: "food_preference",
      stage: "selection",
      blocking: true,
      priority: 95,
      userEffort: 1,
      description: {
        en: "A broad food request needs one preference before the agent can select a suitable item.",
        "zh-Hant": "模糊的食物請求需要一項偏好，代理才能選擇合適食物。",
        ja: "幅広い食事依頼では、適切な商品を選ぶために好みが一つ必要です。",
      },
      when: [{ field: "requested_item", operator: "status_equals", value: "defaulted" }],
      acceptedValues: FOOD_OPTIONS.map(([value]) => value),
      question: {
        prompt: {
          en: "What kind of food should the agent choose?",
          "zh-Hant": "今次想讓代理選擇哪一類食物？",
          ja: "エージェントにどの種類の食事を選ばせますか？",
        },
        answerType: "single_choice",
        options: FOOD_OPTIONS.map(([value, label]) => option(value, label)),
        remember: "offer",
      },
    });
  }

  requirements.push({
    id: `${prefix}:fulfilment`,
    capability: "marketplace.fulfil",
    field: "fulfilment_mode",
    stage: "commitment",
    blocking: true,
    priority: 90,
    userEffort: 1,
    description: {
      en: "The runtime must know which agent is responsible for collection and delivery.",
      "zh-Hant": "執行前必須知道由哪個代理負責取貨及交付。",
      ja: "受取と配達を担当するエージェントを実行前に決める必要があります。",
    },
    acceptedValues: FULFILMENT_OPTIONS.map(([value]) => value),
    question: {
      prompt: {
        en: "Should your personal agent collect it, or should a courier deliver it?",
        "zh-Hant": "由你的個人代理自取，還是由速遞代理送貨？",
        ja: "個人エージェントが受け取りますか、それとも配達しますか？",
      },
      answerType: "single_choice",
      options: FULFILMENT_OPTIONS.map(([value, label]) => option(value, label)),
      remember: "offer",
    },
  });

  requirements.push({
    id: `${prefix}:payment`,
    capability: "marketplace.pay",
    field: "payment_method",
    stage: "commitment",
    blocking: true,
    priority: 85,
    userEffort: 1,
    description: {
      en: "A payment method alias is required before the finance agent can prepare the simulated commitment.",
      "zh-Hant": "付款代理準備模擬交易前，需要一個付款方式代號。",
      ja: "支払いエージェントがシミュレーション取引を準備する前に支払い方法が必要です。",
    },
    acceptedValues: PAYMENT_OPTIONS.map(([value]) => value),
    question: {
      prompt: {
        en: "Which simulated payment method should this request use?",
        "zh-Hant": "今次模擬交易使用哪一種付款方式？",
        ja: "今回のシミュレーションで使う支払い方法はどれですか？",
      },
      answerType: "single_choice",
      options: PAYMENT_OPTIONS.map(([value, label]) => option(value, label)),
      remember: "offer",
    },
  });

  if (goal.domain === "clothing") {
    requirements.push({
      id: `${prefix}:size-observation`,
      capability: "clothing.select",
      field: "size",
      stage: "selection",
      blocking: false,
      priority: 40,
      userEffort: 2,
      description: {
        en: "A size improves clothing selection, but the current simulated catalogue can use a bounded generic item.",
        "zh-Hant": "尺寸可改善衣服選擇，但目前模擬目錄可使用受限的通用商品。",
        ja: "サイズは選択精度を上げますが、現在のシミュレーションでは汎用品を利用できます。",
      },
    });
  }

  return requirements;
}

function permissions(envelope: ContextEnvelope): AsymptaActionPermission[] {
  return [
    ...envelope.permissions.allowed.map((action) => ({ action, mode: "allowed" as const })),
    ...envelope.permissions.prohibited.map((action) => ({ action, mode: "prohibited" as const })),
    { action: "commit_simulated_purchase", mode: "approval_required" as const, reason: "Consequential simulated state transition." },
  ];
}

function successCriteria(goal: MarketplaceGoal) {
  return [
    { id: `${goal.id}:stock`, description: "Requested stock is reserved without breaking inventory conservation.", requiredEvidence: ["availability"] },
    { id: `${goal.id}:handoff`, description: "The selected carrier receives the item.", requiredEvidence: ["goods_handoff"] },
    { id: `${goal.id}:delivery`, description: "The item enters user inventory.", requiredEvidence: ["delivery_receipt"] },
  ];
}

function profileFieldForQuestion(question: AsymptaTaskQuestion | null): MarketplaceProfileField | null {
  if (question?.field === "food_preference") return "foodPreference";
  if (question?.field === "fulfilment_mode") return "fulfilmentMethod";
  if (question?.field === "payment_method") return "paymentMethod";
  return null;
}

export function buildMarketplaceTaskIntents(
  envelope: ContextEnvelope,
  targetStage: AsymptaTaskIntent["targetStage"] = "commitment",
) {
  const sharedFacts = envelope.sharedFacts.map((fact) => taskFact(fact, "shared", envelope.createdAt));
  return envelope.goals.map((goal) => createAsymptaTaskIntent({
    taskId: goal.id,
    conversationId: envelope.conversationId,
    goal: {
      action: goal.action,
      domain: goal.domain,
      desiredOutcome: goal.desiredOutcome,
    },
    targetStage,
    factLayers: [
      sharedFacts,
      goal.facts.map((fact) => taskFact(fact, goal.domain, envelope.createdAt)),
    ],
    requirements: marketplaceRequirements(goal),
    permissions: permissions(envelope),
    successCriteria: successCriteria(goal),
    locale: envelope.locale,
    now: envelope.createdAt,
    compiler: "asympta-marketplace-task-protocol/1",
  }));
}

export function buildMarketplaceTaskProtocol(
  envelope: ContextEnvelope,
  targetStage: AsymptaTaskIntent["targetStage"] = "commitment",
): MarketplaceTaskProtocolBundle {
  const tasks = buildMarketplaceTaskIntents(envelope, targetStage);
  const nextTask = tasks.find((task) => task.readiness.status === "needs_information") ?? null;
  const missingProfileFields = tasks
    .flatMap((task) => task.requirements
      .filter((requirement) => task.readiness.missingRequirementIds.includes(requirement.id))
      .map((requirement) => profileFieldForQuestion(task.readiness.nextRequirementId === requirement.id ? task.readiness.nextQuestion : {
        id: requirement.id,
        field: requirement.field,
        prompt: "",
        reason: "",
        answerType: "text" as const,
        options: [],
        allowSkip: false,
        remember: "offer" as const,
        sensitive: false,
      })))
    .filter((field): field is MarketplaceProfileField => Boolean(field));
  const nextQuestion = nextTask?.readiness.nextQuestion ?? null;
  return {
    schemaVersion: "asympta.task-bundle.v1",
    requestId: envelope.requestId,
    contractVersion: MARKETPLACE_REQUIREMENT_CONTRACT_VERSION,
    tasks,
    readiness: {
      status: nextTask ? "needs_information" : "ready",
      nextTaskId: nextTask?.taskId ?? null,
      nextRequirementId: nextTask?.readiness.nextRequirementId ?? null,
      nextQuestion,
      nextProfileField: profileFieldForQuestion(nextQuestion),
      missingProfileFields: [...new Set(missingProfileFields)],
    },
  };
}

export function assertMarketplaceTaskReady(envelope: ContextEnvelope) {
  const protocol = buildMarketplaceTaskProtocol(envelope, "commitment");
  const blocked = protocol.tasks.find((task) => task.readiness.status === "needs_information");
  if (blocked) assertAsymptaTaskReady(blocked);
  return protocol;
}

export function buildMarketplaceAgentTaskPacket(
  envelope: ContextEnvelope,
  input: {
    goalId: string;
    recipient: string;
    capability: string;
    fields: string[];
    includeSensitive?: boolean;
  },
): AsymptaTaskPacket {
  const task = buildMarketplaceTaskIntents(envelope, "commitment")
    .find((candidate) => candidate.taskId === input.goalId);
  if (!task) throw new Error(`Unknown marketplace goal: ${input.goalId}.`);
  return buildAsymptaTaskPacket(task, input);
}
