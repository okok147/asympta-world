export type AtlasLocale = "en" | "zh-Hant" | "ja";

type Localized = { en: string; "zh-Hant": string; ja: string };
type TaskText = { title: Localized; detail: Localized };

const L = (en: string, zh: string, ja: string): Localized => ({ en, "zh-Hant": zh, ja });

export function normalizeAtlasLocale(value?: string | null): AtlasLocale {
  const language = String(value ?? "en").toLowerCase();
  if (language.startsWith("zh")) return "zh-Hant";
  if (language.startsWith("ja")) return "ja";
  return "en";
}

export function currentAtlasLocale(): AtlasLocale {
  if (typeof document === "undefined") return "en";
  return normalizeAtlasLocale(document.documentElement.lang);
}

export const ATLAS_UI = {
  schedule: L("Schedule", "排程", "スケジュール"),
  scheduleQueue: L("Task schedule", "任務排程", "タスク予定"),
  current: L("Current", "目前", "現在"),
  next: L("Next", "下一個", "次"),
  eta: L("ETA", "預計", "予定"),
  exploreMode: L("Explore Mode", "探索模式", "探索モード"),
  on: L("ON", "開啟", "ON"),
  off: L("OFF", "關閉", "OFF"),
  autoExplore: L("Auto-explore", "自動探索", "自動探索"),
  nearbyAmbient: L("nearby agents", "附近角色", "周辺エージェント"),
  visualRefresh: L("60Hz visual", "60Hz 視覺", "60Hz 表示"),
  workflowAgents: L("workflow agents", "工作流角色", "ワークフローエージェント"),
  waitingApproval: L("Waiting for approval", "等候確認", "承認待ち"),
  standingBy: L("Standing by", "待命中", "待機中"),
  explore: L("Explore", "探索", "探索"),
  resume: L("Resume", "返回主線", "主タスクへ復帰"),
  obstacle: L("Obstacle", "障礙", "障害"),
  obstacleCleared: L("Obstacle cleared", "障礙已排除", "障害解消"),
  goingWell: L("Going well", "進度順利", "順調"),
  approval: L("approval", "確認", "承認"),
  simulatedOnly: L("Simulation only — no real order, payment, inventory reservation or shipment is performed.", "僅為模擬——不會真的下單、付款、預留庫存或出貨。", "シミュレーションのみです。実際の注文・支払い・在庫確保・出荷は行いません。"),
  closeAgent: L("Close agent", "關閉角色", "エージェントを閉じる"),
  zoomIn: L("Zoom in", "放大", "拡大"),
  zoomOut: L("Zoom out", "縮小", "縮小"),
  recenter: L("Recenter map", "重新置中地圖", "地図を中央に戻す"),
  coordinationMenu: L("Coordination menu", "協作選單", "協調メニュー"),
  webmcpInspector: L("WebMCP live inspector", "WebMCP 即時檢視", "WebMCP ライブインスペクタ"),
  jsonCall: L("JSON call", "JSON 呼叫", "JSON 呼び出し"),
  liveState: L("Live agent state", "即時角色狀態", "ライブ状態"),
  read: L("READ", "讀取", "読取"),
  write: L("WRITE", "寫入", "書込"),
};

export function uiText(key: keyof typeof ATLAS_UI, locale: AtlasLocale) {
  return ATLAS_UI[key][locale];
}

const WORKFLOWS: Record<string, { name: Localized; summary: Localized; outcome: Localized }> = {
  "custom-order": {
    name: L("Custom Order Network", "客製訂單協作", "カスタム注文連携"),
    summary: L("Customer intent becomes a coordinated quote, supplier reservation, payment, fulfilment and delivery chain.", "把客戶需求協調成報價、供應商產能、付款、履約與配送的一條完整鏈路。", "顧客の要望を、見積・供給能力・支払い・履行・配送まで一つの連携フローにします。"),
    outcome: L("A simulated custom order is negotiated, reserved, authorised, packed, dispatched and handed over with aftercare.", "模擬客製訂單會完成議價、預留、授權、包裝、出貨、交付與售後。", "模擬カスタム注文を交渉・確保・承認・梱包・出荷・引渡し・アフターケアまで進めます。"),
  },
  "dinner-network": {
    name: L("Dinner Coordination", "晚餐協作", "夕食コーディネーション"),
    summary: L("A dinner request coordinates customer preference, restaurant capacity, ingredient supply, payment and courier handoff.", "把晚餐需求協調成偏好、餐廳產能、食材供應、付款與外送交接。", "夕食の依頼を、好み・店舗能力・食材供給・支払い・配達連携まで調整します。"),
    outcome: L("A simulated dinner plan moves from preference matching through kitchen supply and last-mile delivery.", "模擬晚餐計畫會由偏好配對一路進行到廚房供應與最後一哩配送。", "模擬の夕食計画を、好みの照合から厨房供給、ラストマイル配送まで進めます。"),
  },
  "launch-stock": {
    name: L("Launch Stock Orchestration", "上架庫存協作", "在庫ローンチ連携"),
    summary: L("Business, market, supplier, finance, operations, quality and logistics agents coordinate a new stock launch.", "商戶、市場、供應、財務、營運、品質與物流角色共同協調新品庫存上架。", "事業・市場・供給・財務・運用・品質・物流の各エージェントが新規在庫投入を連携します。"),
    outcome: L("A simulated launch inventory plan is demand-tested, financed, reserved, quality-gated and released to distribution.", "模擬上架庫存會經過需求驗證、資金規劃、產能預留、品質閘門與配送釋出。", "模擬の投入在庫計画を、需要検証・資金計画・能力確保・品質ゲート・配送解放まで進めます。"),
  },
  "service-recovery": {
    name: L("Service Recovery Network", "服務復原協作", "サービス復旧連携"),
    summary: L("A service failure triggers parallel customer impact, supplier replacement, finance, quality and logistics recovery.", "服務失敗後，同時啟動客戶影響、供應替換、財務、品質與物流復原。", "サービス障害時に、顧客影響・代替供給・財務・品質・物流の復旧を並行して進めます。"),
    outcome: L("A simulated failure is triaged, replacement capacity is secured, remedies are authorised and the customer is updated.", "模擬故障會完成分流、替換產能、補救授權與客戶更新。", "模擬障害を切り分け、代替能力を確保し、救済策を承認して顧客へ更新します。"),
  },
};

export function localizeWorkflow(workflowId: string | undefined, locale: AtlasLocale, fallback?: { name?: string; summary?: string; outcome?: string }) {
  const item = workflowId ? WORKFLOWS[workflowId] : undefined;
  return {
    name: item?.name[locale] ?? fallback?.name ?? workflowId ?? "",
    summary: item?.summary[locale] ?? fallback?.summary ?? "",
    outcome: item?.outcome[locale] ?? fallback?.outcome ?? "",
  };
}

const TASKS: Record<string, TaskText> = {
  "co-intent": { title: L("Understand the custom request", "理解客製需求", "カスタム要望を理解"), detail: L("Convert the user's request into a structured requirement package.", "把使用者需求整理成結構化需求包。", "ユーザーの要望を構造化された要件パッケージにします。") },
  "co-customer": { title: L("Validate customer fit", "確認客戶適配", "顧客適合性を確認"), detail: L("Check constraints, timing and acceptance criteria from the customer side.", "從客戶端確認限制、時間與驗收條件。", "顧客側の制約・時期・受入条件を確認します。") },
  "co-business": { title: L("Build commercial offer", "建立商業報價", "商用提案を作成"), detail: L("Create a commercial offer and clarify merchant commitments.", "建立商業方案並釐清商戶承諾。", "商用提案を作成し、事業者のコミットメントを明確にします。") },
  "co-supply": { title: L("Check supplier capacity", "檢查供應商產能", "供給能力を確認"), detail: L("Check material availability, lead time and minimum commitment.", "檢查物料、交期與最低承諾量。", "材料在庫・リードタイム・最低コミット量を確認します。") },
  "co-quality": { title: L("Verify specification", "驗證規格", "仕様を検証"), detail: L("Reconcile customer acceptance criteria with available material and quality constraints.", "把客戶驗收條件與可用物料及品質限制對齊。", "顧客の受入条件を、利用可能な材料と品質制約に整合させます。") },
  "co-finance": { title: L("Model margin and payment", "估算毛利與付款", "利益と支払いをモデル化"), detail: L("Calculate simulated total cost, margin exposure and payment milestones.", "計算模擬總成本、毛利風險與付款里程碑。", "模擬総コスト・利益リスク・支払いマイルストーンを計算します。") },
  "co-negotiate": { title: L("Converge commercial terms", "收斂商業條款", "商条件を収束"), detail: L("Merge quality, customer, supplier and finance constraints into one executable offer.", "把品質、客戶、供應與財務限制合併成可執行方案。", "品質・顧客・供給・財務の制約を一つの実行可能な提案に統合します。") },
  "co-ops": { title: L("Plan production and fulfilment", "規劃生產與履約", "生産と履行を計画"), detail: L("Sequence procurement, preparation, packing and handoff windows.", "安排採購、準備、包裝與交接時段。", "調達・準備・梱包・引渡し時間を順序化します。") },
  "co-reserve": { title: L("Reserve supplier capacity", "預留供應商產能", "供給能力を確保"), detail: L("Hold the simulated supplier capacity needed for the agreed plan.", "為已同意方案預留所需的模擬供應產能。", "合意した計画に必要な模擬供給能力を確保します。") },
  "co-pay": { title: L("Authorise payment milestone", "授權付款里程碑", "支払いマイルストーンを承認"), detail: L("Authorise the simulated payment milestone before fulfilment continues.", "履約繼續前授權模擬付款里程碑。", "履行を続ける前に模擬支払いを承認します。") },
  "co-pack": { title: L("Prepare and quality-check order", "準備並品質檢查訂單", "注文を準備・品質確認"), detail: L("Prepare, pack and verify the order against the accepted specification.", "依已接受規格準備、包裝並驗證訂單。", "承認済み仕様に基づいて注文を準備・梱包・検証します。") },
  "co-dispatch": { title: L("Release shipment", "放行出貨", "出荷を解放"), detail: L("Release the simulated shipment into the delivery network.", "把模擬貨件放行至配送網絡。", "模擬貨物を配送ネットワークへ解放します。") },
  "co-deliver": { title: L("Deliver to customer", "配送給客戶", "顧客へ配送"), detail: L("Move the completed order through the last-mile handoff.", "把完成訂單送至最後一哩交接。", "完成した注文をラストマイル引渡しまで運びます。") },
  "co-aftercare": { title: L("Confirm satisfaction and aftercare", "確認滿意度與售後", "満足度とアフターケアを確認"), detail: L("Confirm handover, capture feedback and open aftercare if needed.", "確認交付、收集回饋，必要時啟動售後。", "引渡しを確認し、フィードバックを収集し、必要ならアフターケアを開始します。") },

  "dn-intent": { title: L("Interpret dinner need", "理解晚餐需求", "夕食ニーズを理解"), detail: L("Resolve cuisine, timing, dietary and budget constraints.", "整理菜系、時間、飲食與預算限制。", "料理・時間・食事制限・予算を整理します。") },
  "dn-customer": { title: L("Confirm customer preferences", "確認客戶偏好", "顧客の好みを確認"), detail: L("Validate preference trade-offs and hard dietary constraints.", "確認偏好取捨與不可違反的飲食限制。", "好みの優先順位と厳格な食事制限を確認します。") },
  "dn-business": { title: L("Check restaurant capacity", "檢查餐廳產能", "店舗能力を確認"), detail: L("Check simulated kitchen capacity, menu availability and preparation window.", "檢查模擬廚房產能、餐單與準備時間。", "模擬厨房能力・メニュー在庫・調理時間を確認します。") },
  "dn-supplier": { title: L("Verify ingredient supply", "確認食材供應", "食材供給を確認"), detail: L("Check ingredient availability and substitutions across the supply side.", "檢查供應端食材可用性與替代方案。", "供給側の食材在庫と代替案を確認します。") },
  "dn-quality": { title: L("Validate substitutions", "驗證替代食材", "代替品を検証"), detail: L("Make sure substitutions preserve dietary and quality requirements.", "確保替代方案仍符合飲食與品質要求。", "代替案が食事・品質要件を満たすことを確認します。") },
  "dn-plan": { title: L("Synchronise kitchen and courier", "同步廚房與外送", "厨房と配達を同期"), detail: L("Align preparation completion with courier pickup capacity.", "把完成準備時間與外送取貨能力對齊。", "調理完了と配達員の集荷能力を合わせます。") },
  "dn-authorize": { title: L("Confirm dinner order", "確認晚餐訂單", "夕食注文を確認"), detail: L("Authorise the simulated order before preparation begins.", "開始準備前授權模擬訂單。", "調理開始前に模擬注文を承認します。") },
  "dn-prepare": { title: L("Prepare dinner", "準備晚餐", "夕食を準備"), detail: L("Simulate kitchen preparation and final quality check.", "模擬廚房準備與最終品質檢查。", "厨房準備と最終品質確認をシミュレーションします。") },
  "dn-dispatch": { title: L("Release courier pickup", "放行外送取貨", "配達集荷を解放"), detail: L("Release the simulated courier once preparation is ready.", "準備完成後放行模擬外送員取貨。", "準備完了後に模擬配達員を集荷へ出します。") },
  "dn-deliver": { title: L("Complete dinner delivery", "完成晚餐配送", "夕食配送を完了"), detail: L("Simulate last-mile movement and customer handoff.", "模擬最後一哩配送與客戶交接。", "ラストマイル配送と顧客引渡しをシミュレーションします。") },
  "dn-feedback": { title: L("Close the service loop", "完成服務閉環", "サービスループを完了"), detail: L("Send a completion update and capture service feedback.", "發送完成更新並收集服務回饋。", "完了通知を送り、サービス評価を収集します。") },

  "ls-brief": { title: L("Frame launch objective", "定義上架目標", "ローンチ目標を定義"), detail: L("Translate the launch ambition into a measurable inventory and service target.", "把上架目標轉成可量度的庫存與服務指標。", "ローンチ目標を測定可能な在庫・サービス目標に変換します。") },
  "ls-market": { title: L("Estimate customer demand", "估算客戶需求", "顧客需要を推定"), detail: L("Estimate launch demand, uncertainty and customer segments.", "估算上架需求、不確定性與客群。", "需要・不確実性・顧客セグメントを推定します。") },
  "ls-customer": { title: L("Stress-test customer value", "壓力測試客戶價值", "顧客価値をストレステスト"), detail: L("Challenge positioning and identify failure points from the customer side.", "從客戶角度挑戰定位並找出失敗點。", "顧客側からポジショニングを検証し、失敗点を特定します。") },
  "ls-supply": { title: L("Map supplier constraints", "整理供應限制", "供給制約を整理"), detail: L("Check simulated capacity, lead time, lot size and alternate supply.", "檢查模擬產能、交期、批量與替代供應。", "模擬能力・リードタイム・ロット・代替供給を確認します。") },
  "ls-finance": { title: L("Model launch exposure", "估算上架風險", "ローンチリスクをモデル化"), detail: L("Model working capital, margin and downside exposure.", "估算營運資金、毛利與下行風險。", "運転資金・利益・下振れリスクをモデル化します。") },
  "ls-quality": { title: L("Define launch quality gate", "定義上架品質閘門", "品質ゲートを定義"), detail: L("Define acceptance thresholds and failure handling before stock is committed.", "在投入庫存前定義驗收門檻與失敗處理。", "在庫投入前に受入基準と失敗時対応を定義します。") },
  "ls-plan": { title: L("Build operating plan", "建立營運計畫", "運用計画を作成"), detail: L("Create launch waves, stock buffers and escalation paths.", "建立上架批次、庫存緩衝與升級路徑。", "投入ウェーブ・在庫バッファ・エスカレーション経路を作ります。") },
  "ls-reserve": { title: L("Reserve launch capacity", "預留上架產能", "ローンチ能力を確保"), detail: L("Reserve simulated supplier capacity for the launch plan.", "為上架計畫預留模擬供應產能。", "ローンチ計画の模擬供給能力を確保します。") },
  "ls-budget": { title: L("Authorise launch budget", "授權上架預算", "ローンチ予算を承認"), detail: L("Authorise the simulated launch budget envelope.", "授權模擬上架預算額度。", "模擬ローンチ予算枠を承認します。") },
  "ls-stage": { title: L("Stage launch inventory", "準備上架庫存", "投入在庫を準備"), detail: L("Simulate production, receiving, inspection and inventory staging.", "模擬生產、收貨、檢驗與庫存準備。", "生産・受入・検査・在庫準備をシミュレーションします。") },
  "ls-release": { title: L("Release launch inventory", "放行上架庫存", "投入在庫を解放"), detail: L("Release simulated inventory to the distribution network.", "把模擬庫存放行到配送網絡。", "模擬在庫を配送ネットワークへ解放します。") },
  "ls-monitor": { title: L("Open launch support loop", "啟動上架支援閉環", "ローンチ支援ループを開始"), detail: L("Notify the support side and start customer feedback monitoring.", "通知支援端並開始監察客戶回饋。", "サポート側へ通知し、顧客フィードバック監視を開始します。") },

  "sr-triage": { title: L("Triage service failure", "分流服務故障", "サービス障害を切り分け"), detail: L("Classify the failure, urgency and immediate customer risk.", "分類故障、緊急程度與即時客戶風險。", "障害・緊急度・直近の顧客リスクを分類します。") },
  "sr-customer": { title: L("Assess customer impact", "評估客戶影響", "顧客影響を評価"), detail: L("Estimate customer impact, commitments and recovery expectations.", "評估客戶影響、承諾與復原期望。", "顧客影響・約束・復旧期待を評価します。") },
  "sr-quality": { title: L("Trace failure cause", "追查故障原因", "障害原因を追跡"), detail: L("Trace the likely quality failure and define containment criteria.", "追查可能的品質故障並定義控制標準。", "品質上の原因を追跡し、封じ込め基準を定義します。") },
  "sr-supplier": { title: L("Find replacement capacity", "尋找替換產能", "代替能力を確保"), detail: L("Check simulated supplier replacement stock and timing.", "檢查模擬供應商替換庫存與時間。", "模擬供給側の代替在庫と時期を確認します。") },
  "sr-finance": { title: L("Model remedy options", "估算補救方案", "救済案をモデル化"), detail: L("Compare replacement, credit and expedited delivery exposure.", "比較替換、退款額度與加急配送風險。", "交換・クレジット・特急配送の影響を比較します。") },
  "sr-plan": { title: L("Build recovery plan", "建立復原計畫", "復旧計画を作成"), detail: L("Coordinate containment, replacement, priority logistics and communication.", "協調控制、替換、優先物流與溝通。", "封じ込め・交換・優先物流・連絡を調整します。") },
  "sr-reserve": { title: L("Reserve recovery stock", "預留復原庫存", "復旧在庫を確保"), detail: L("Reserve simulated replacement capacity for the recovery plan.", "為復原計畫預留模擬替換產能。", "復旧計画の模擬代替能力を確保します。") },
  "sr-credit": { title: L("Authorise customer remedy", "授權客戶補救", "顧客救済を承認"), detail: L("Authorise the simulated remedy or credit envelope.", "授權模擬補救或退款額度。", "模擬の救済策またはクレジット枠を承認します。") },
  "sr-dispatch": { title: L("Dispatch priority replacement", "派送優先替換品", "優先代替品を発送"), detail: L("Release the simulated priority replacement into logistics.", "把模擬優先替換品放行至物流。", "模擬優先代替品を物流へ解放します。") },
  "sr-update": { title: L("Send recovery update", "發送復原更新", "復旧更新を送信"), detail: L("Send the simulated customer recovery update with expected handoff timing.", "向客戶發送含預計交接時間的模擬復原更新。", "予定引渡し時刻を含む模擬復旧更新を顧客へ送ります。") },
};

const OPPORTUNITIES: Record<string, Localized> = {
  "Bundle a nearby compatible request": L("Bundle a nearby compatible request", "順手合併附近相容需求", "近くの互換依頼をまとめる"),
  "Resolve an adjacent customer question": L("Resolve an adjacent customer question", "順手解決相關客戶問題", "関連する顧客質問を解決"),
  "Bundle a compatible merchant request": L("Bundle a compatible merchant request", "順手合併相容商戶需求", "互換する事業者依頼をまとめる"),
  "Consolidate a nearby supply request": L("Consolidate a nearby supply request", "整合附近供應需求", "近くの供給依頼を統合"),
  "Merge a compatible handoff": L("Merge a compatible handoff", "合併相容交接", "互換する引渡しを統合"),
  "Reconcile an adjacent exposure": L("Reconcile an adjacent exposure", "順手核對相關風險", "関連するリスクを照合"),
  "Bundle a nearby handoff": L("Bundle a nearby handoff", "順手合併附近交接", "近くの引渡しをまとめる"),
  "Close a related support follow-up": L("Close a related support follow-up", "順手完成相關支援跟進", "関連サポートフォローを完了"),
  "Verify an adjacent specification": L("Verify an adjacent specification", "順手驗證相關規格", "関連仕様を検証"),
  "Refresh a nearby demand signal": L("Refresh a nearby demand signal", "順手更新附近需求訊號", "近くの需要シグナルを更新"),
};

const OBSTACLES: Record<string, Localized> = {
  "preference ambiguity": L("preference ambiguity", "偏好不明確", "好みが不明確"),
  "missing confirmation": L("missing confirmation", "缺少確認", "確認不足"),
  "customer reply pending": L("customer reply pending", "等待客戶回覆", "顧客返信待ち"),
  "constraint conflict": L("constraint conflict", "限制互相衝突", "制約の競合"),
  "merchant response pending": L("merchant response pending", "等待商戶回覆", "事業者返信待ち"),
  "quote dependency": L("quote dependency", "報價依賴未完成", "見積依存待ち"),
  "supplier reply pending": L("supplier reply pending", "等待供應商回覆", "供給側返信待ち"),
  "stock variance": L("stock variance", "庫存出現差異", "在庫差異"),
  "handoff window changed": L("handoff window changed", "交接時段改變", "引渡し時間変更"),
  "resource contention": L("resource contention", "資源衝突", "リソース競合"),
  "payment term check": L("payment term check", "付款條款檢查", "支払条件確認"),
  "margin input changed": L("margin input changed", "毛利輸入已改變", "利益入力変更"),
  "route congestion": L("route congestion", "路線擠塞", "経路混雑"),
  "pickup window shifted": L("pickup window shifted", "取貨時段變動", "集荷時間変更"),
  "customer response pending": L("customer response pending", "等待客戶回應", "顧客応答待ち"),
  "case history lookup": L("case history lookup", "正在查詢個案紀錄", "ケース履歴を確認中"),
  "evidence mismatch": L("evidence mismatch", "證據不一致", "証拠不一致"),
  "specification clarification": L("specification clarification", "需要釐清規格", "仕様確認が必要"),
  "signal confidence dropped": L("signal confidence dropped", "訊號可信度下降", "シグナル信頼度低下"),
  "fresh sample pending": L("fresh sample pending", "等待新樣本", "新規サンプル待ち"),
};

const AMBIENT: Record<string, Localized> = {
  "Comparing dinner options": L("Comparing dinner options", "比較晚餐選項", "夕食候補を比較中"),
  "Finding a repair slot": L("Finding a repair slot", "尋找維修時段", "修理枠を検索中"),
  "Planning a custom order": L("Planning a custom order", "規劃客製訂單", "カスタム注文を計画中"),
  "Checking delivery choices": L("Checking delivery choices", "檢查配送選項", "配送方法を確認中"),
  "Reviewing an offer": L("Reviewing an offer", "檢視方案", "提案を確認中"),
  "Confirming requirements": L("Confirming requirements", "確認需求", "要件を確認中"),
  "Checking replacement timing": L("Checking replacement timing", "確認替換時間", "交換時期を確認中"),
  "Comparing service options": L("Comparing service options", "比較服務方案", "サービス案を比較中"),
  "Preparing a quote": L("Preparing a quote", "準備報價", "見積を準備中"),
  "Responding to an order": L("Responding to an order", "處理訂單", "注文対応中"),
  "Checking merchant capacity": L("Checking merchant capacity", "檢查商戶產能", "事業者能力を確認中"),
  "Coordinating a service request": L("Coordinating a service request", "協調服務需求", "サービス依頼を調整中"),
  "Checking material stock": L("Checking material stock", "檢查物料庫存", "材料在庫を確認中"),
  "Reserving production capacity": L("Reserving production capacity", "預留生產產能", "生産能力を確保中"),
  "Confirming lead time": L("Confirming lead time", "確認交期", "リードタイムを確認中"),
  "Preparing replenishment": L("Preparing replenishment", "準備補貨", "補充を準備中"),
  "Sequencing fulfilment": L("Sequencing fulfilment", "安排履約順序", "履行順序を調整中"),
  "Planning preparation": L("Planning preparation", "規劃準備工作", "準備を計画中"),
  "Rebalancing workload": L("Rebalancing workload", "重新平衡工作量", "作業負荷を再調整中"),
  "Coordinating handoffs": L("Coordinating handoffs", "協調交接", "引渡しを調整中"),
  "Checking payment terms": L("Checking payment terms", "檢查付款條款", "支払条件を確認中"),
  "Reviewing margin exposure": L("Reviewing margin exposure", "檢視毛利風險", "利益リスクを確認中"),
  "Approving a demo budget": L("Approving a demo budget", "審批示範預算", "デモ予算を承認中"),
  "Reconciling an order": L("Reconciling an order", "核對訂單", "注文を照合中"),
  "Routing a courier": L("Routing a courier", "安排外送路線", "配達経路を設定中"),
  "Collecting a parcel": L("Collecting a parcel", "取件中", "荷物を集荷中"),
  "Rebalancing deliveries": L("Rebalancing deliveries", "重新平衡配送", "配送を再調整中"),
  "Preparing a last-mile handoff": L("Preparing a last-mile handoff", "準備最後一哩交接", "ラストマイル引渡しを準備中"),
  "Following up a customer": L("Following up a customer", "跟進客戶", "顧客をフォロー中"),
  "Resolving a service issue": L("Resolving a service issue", "處理服務問題", "サービス問題を解決中"),
  "Sending a recovery update": L("Sending a recovery update", "發送復原更新", "復旧更新を送信中"),
  "Checking aftercare": L("Checking aftercare", "檢查售後", "アフターケアを確認中"),
  "Verifying a specification": L("Verifying a specification", "驗證規格", "仕様を検証中"),
  "Checking a replacement": L("Checking a replacement", "檢查替換品", "代替品を確認中"),
  "Reviewing acceptance criteria": L("Reviewing acceptance criteria", "檢視驗收條件", "受入基準を確認中"),
  "Inspecting a demo order": L("Inspecting a demo order", "檢查示範訂單", "デモ注文を検査中"),
  "Watching demand signals": L("Watching demand signals", "觀察需求訊號", "需要シグナルを監視中"),
  "Comparing local activity": L("Comparing local activity", "比較本地活動", "地域活動を比較中"),
  "Estimating launch demand": L("Estimating launch demand", "估算上架需求", "ローンチ需要を推定中"),
  "Reviewing customer interest": L("Reviewing customer interest", "檢視客戶興趣", "顧客関心を確認中"),
};

const AGENT_ROLE: Record<string, Localized> = {
  "agent-user": L("Personal intent agent", "個人需求代理", "個人意図エージェント"),
  "agent-customer": L("Customer advocate", "客戶代表代理", "顧客擁護エージェント"),
  "agent-business": L("Business coordinator", "商戶協調代理", "事業調整エージェント"),
  "agent-supplier": L("Supplier agent", "供應商代理", "供給エージェント"),
  "agent-operations": L("Operations planner", "營運規劃代理", "運用計画エージェント"),
  "agent-finance": L("Finance controller", "財務控制代理", "財務管理エージェント"),
  "agent-logistics": L("Logistics dispatcher", "物流調度代理", "物流配車エージェント"),
  "agent-support": L("Service recovery agent", "服務復原代理", "サービス復旧エージェント"),
  "agent-quality": L("Quality verifier", "品質驗證代理", "品質検証エージェント"),
  "agent-market": L("Market intelligence agent", "市場情報代理", "市場情報エージェント"),
};

const AGENT_ORG: Record<string, Localized> = {
  "agent-user": L("You", "你", "あなた"),
  "agent-customer": L("Customer side", "客戶端", "顧客側"),
  "agent-business": L("Merchant network", "商戶網絡", "事業者ネットワーク"),
  "agent-supplier": L("Supply network", "供應網絡", "供給ネットワーク"),
  "agent-operations": L("Operations", "營運", "運用"),
  "agent-finance": L("Finance", "財務", "財務"),
  "agent-logistics": L("Delivery network", "配送網絡", "配送ネットワーク"),
  "agent-support": L("Customer support", "客戶支援", "顧客サポート"),
  "agent-quality": L("Quality assurance", "品質保證", "品質保証"),
  "agent-market": L("Market intelligence", "市場情報", "市場情報"),
};

const SIDE: Record<string, Localized> = {
  user: L("User", "使用者", "ユーザー"), customer: L("Customer", "客戶", "顧客"), business: L("Business", "商戶", "事業"), supplier: L("Supplier", "供應商", "供給"), operations: L("Operations", "營運", "運用"), finance: L("Finance", "財務", "財務"), logistics: L("Logistics", "物流", "物流"), support: L("Support", "支援", "サポート"), quality: L("Quality", "品質", "品質"), market: L("Market", "市場", "市場"),
};

const STATUS: Record<string, Localized> = {
  idle: L("idle", "待命", "待機"), moving: L("moving", "移動中", "移動中"), working: L("working", "工作中", "作業中"), sharing: L("sharing", "交接中", "共有中"), waiting: L("waiting", "等候中", "待機中"), returning: L("returning", "返回中", "帰還中"), queued: L("queued", "排隊中", "待機列"), waiting_approval: L("waiting approval", "等候確認", "承認待ち"), done: L("done", "完成", "完了"), blocked: L("blocked", "暫停", "停止"),
};

const HEALTH: Record<string, Localized> = {
  queued: L("queued", "排隊中", "待機列"), on_track: L("on track", "正常", "予定通り"), ahead: L("ahead", "提前", "前倒し"), delayed: L("delayed", "延遲", "遅延"), obstacle: L("obstacle", "有障礙", "障害あり"), exploring: L("exploring", "探索中", "探索中"), waiting: L("waiting", "等待中", "待機中"), done: L("done", "完成", "完了"),
};

export function localizeTask(taskId: string | undefined, locale: AtlasLocale, fallbackTitle = "", fallbackDetail = "") {
  const baseId = taskId?.startsWith("explore-") ? undefined : taskId;
  const item = baseId ? TASKS[baseId] : undefined;
  const opportunity = OPPORTUNITIES[fallbackTitle];
  return {
    title: item?.title[locale] ?? opportunity?.[locale] ?? localizeKnownPhrase(fallbackTitle, locale),
    detail: item?.detail[locale] ?? localizeKnownPhrase(fallbackDetail, locale),
  };
}

export function localizeAgent(agentId: string, locale: AtlasLocale, fallbackRole = "", fallbackOrganisation = "") {
  return {
    role: AGENT_ROLE[agentId]?.[locale] ?? localizeKnownPhrase(fallbackRole, locale),
    organisation: AGENT_ORG[agentId]?.[locale] ?? localizeKnownPhrase(fallbackOrganisation, locale),
  };
}

export function localizeSide(side: string, locale: AtlasLocale) {
  return SIDE[side]?.[locale] ?? side;
}

export function localizeStatus(status: string, locale: AtlasLocale) {
  return STATUS[status]?.[locale] ?? status.replaceAll("_", " ");
}

export function localizeHealth(health: string, locale: AtlasLocale) {
  return HEALTH[health]?.[locale] ?? health.replaceAll("_", " ");
}

export function localizeObstacle(value: string | null | undefined, locale: AtlasLocale) {
  if (!value) return value ?? "";
  return OBSTACLES[value]?.[locale] ?? localizeKnownPhrase(value, locale);
}

export function localizeAmbientTask(value: string, locale: AtlasLocale) {
  return AMBIENT[value]?.[locale] ?? localizeKnownPhrase(value, locale);
}

export function localizeKnownPhrase(value: string, locale: AtlasLocale): string {
  if (!value || locale === "en") return value;
  const direct = AMBIENT[value] ?? OPPORTUNITIES[value] ?? OBSTACLES[value];
  if (direct) return direct[locale];
  for (const task of Object.values(TASKS)) {
    if (task.title.en === value) return task.title[locale];
    if (task.detail.en === value) return task.detail[locale];
  }
  for (const workflow of Object.values(WORKFLOWS)) {
    if (workflow.name.en === value) return workflow.name[locale];
    if (workflow.summary.en === value) return workflow.summary[locale];
    if (workflow.outcome.en === value) return workflow.outcome[locale];
  }
  for (const item of Object.values(AGENT_ROLE)) if (item.en === value) return item[locale];
  for (const item of Object.values(AGENT_ORG)) if (item.en === value) return item[locale];
  return value;
}

export function localizeDynamicText(value: string, locale: AtlasLocale): string {
  if (!value || locale === "en") return value;
  const direct = localizeKnownPhrase(value, locale);
  if (direct !== value) return direct;

  const explore = value.match(/^Explore → (.+)$/);
  if (explore) return `${uiText("explore", locale)} → ${localizeKnownPhrase(explore[1], locale)}`;
  const resume = value.match(/^Resume → (.+)$/);
  if (resume) return `${uiText("resume", locale)} → ${localizeKnownPhrase(resume[1], locale)}`;
  const obstacle = value.match(/^Obstacle → (.+?)( \(\+.+\))?$/);
  if (obstacle) return `${uiText("obstacle", locale)} → ${localizeObstacle(obstacle[1], locale)}${obstacle[2] ?? ""}`;
  const cleared = value.match(/^Obstacle cleared → (.+)$/);
  if (cleared) return `${uiText("obstacleCleared", locale)} → ${localizeKnownPhrase(cleared[1], locale)}`;
  const good = value.match(/^Going well · ETA (.+)$/);
  if (good) return `${uiText("goingWell", locale)} · ${uiText("eta", locale)} ${good[1]}`;
  const ready = value.split(" → ready for ");
  if (ready.length === 2) {
    const middle = locale === "zh-Hant" ? " → 已可交接給 " : " → 次へ引渡し可能: ";
    return `${localizeKnownPhrase(ready[0], locale)}${middle}${localizeKnownPhrase(ready[1], locale)}`;
  }
  if (value === "Waiting for approval") return uiText("waitingApproval", locale);
  if (value === "Standing by") return uiText("standingBy", locale);
  return value;
}

export function localizedPermission(mode: string, locale: AtlasLocale) {
  return mode === "WRITE" ? uiText("write", locale) : uiText("read", locale);
}

export function localizeApproval(approval: any, tasks: any[], locale: AtlasLocale) {
  if (!approval) return null;
  const task = tasks.find((item) => item.id === approval.taskId);
  const localizedTask = task ? localizeTask(task.id, locale, task.title ?? "", task.detail ?? "") : null;
  const action = String(approval.actionType ?? "");
  const actionLabel: Record<string, Localized> = {
    reserve_capacity: L("Reserve capacity", "預留產能", "能力を確保"),
    authorize_payment: L("Authorise payment", "授權付款", "支払いを承認"),
    release_shipment: L("Release shipment", "放行出貨", "出荷を解放"),
    send_customer_update: L("Send customer update", "發送客戶更新", "顧客更新を送信"),
  };
  const base = localizedTask?.title || actionLabel[action]?.[locale] || localizeDynamicText(String(approval.title ?? ""), locale);
  const title = approval.source === "webmcp"
    ? (locale === "zh-Hant" ? `允許 WebMCP：${base}` : locale === "ja" ? `WebMCP を許可：${base}` : String(approval.title ?? base))
    : (locale === "zh-Hant" ? `確認：${base}` : locale === "ja" ? `確認：${base}` : String(approval.title ?? base));
  return {
    ...approval,
    title,
    detail: localizedTask?.detail || localizeDynamicText(String(approval.detail ?? ""), locale),
    consequence: uiText("simulatedOnly", locale),
  };
}

export function localizeAtlasSnapshot(snapshot: any, locale: AtlasLocale) {
  if (!snapshot || typeof snapshot !== "object") return snapshot;
  const tasks = Array.isArray(snapshot.tasks) ? snapshot.tasks.map((task: any) => {
    const text = localizeTask(task.id, locale, task.title ?? "", task.detail ?? "");
    return {
      ...task,
      title: text.title,
      detail: text.detail,
      statusLabel: localizeStatus(String(task.status ?? ""), locale),
      scheduleHealthLabel: localizeHealth(String(task.scheduleHealth ?? task.health ?? ""), locale),
      obstacle: task.obstacle ? localizeObstacle(task.obstacle, locale) : task.obstacle,
      opportunityBasis: task.opportunityBasis ? localizeDynamicText(String(task.opportunityBasis), locale) : task.opportunityBasis,
    };
  }) : [];
  const taskById = new Map(tasks.map((task: any) => [task.id, task]));
  const agents = Array.isArray(snapshot.agents) ? snapshot.agents.map((agent: any) => {
    const text = localizeAgent(String(agent.id ?? ""), locale, agent.role ?? "", agent.organisation ?? "");
    return { ...agent, ...text, sideLabel: localizeSide(String(agent.side ?? ""), locale), statusLabel: localizeStatus(String(agent.status ?? ""), locale) };
  }) : snapshot.agents;
  const pendingApprovals = Array.isArray(snapshot.pendingApprovals) ? snapshot.pendingApprovals.map((approval: any) => localizeApproval(approval, tasks, locale)) : snapshot.pendingApprovals;
  const messages = Array.isArray(snapshot.messages) ? snapshot.messages.map((message: any) => ({ ...message, text: localizeDynamicText(String(message.text ?? ""), locale) })) : snapshot.messages;
  const recentEvents = Array.isArray(snapshot.recentEvents) ? snapshot.recentEvents.map((event: any) => ({ ...event, title: localizeDynamicText(String(event.title ?? ""), locale), detail: localizeDynamicText(String(event.detail ?? ""), locale) })) : snapshot.recentEvents;
  const scheduler = snapshot.scheduler ? {
    ...snapshot.scheduler,
    active: Array.isArray(snapshot.scheduler.active) ? snapshot.scheduler.active.map((row: any) => {
      const task = taskById.get(row.id) as any;
      return { ...row, title: task?.title ?? localizeTask(row.id, locale, row.title ?? "").title, statusLabel: localizeStatus(String(row.status ?? ""), locale), healthLabel: localizeHealth(String(row.health ?? ""), locale), obstacle: row.obstacle ? localizeObstacle(row.obstacle, locale) : row.obstacle };
    }) : snapshot.scheduler.active,
  } : snapshot.scheduler;
  return {
    ...snapshot,
    locale,
    phaseLabel: localizeStatus(String(snapshot.phase ?? ""), locale),
    workflow: localizeKnownPhrase(String(snapshot.workflow ?? ""), locale),
    tasks,
    agents,
    pendingApprovals,
    messages,
    recentEvents,
    scheduler,
  };
}

export function localizeDisclosure(locale: AtlasLocale) {
  return locale === "zh-Hant"
    ? "城市移動是代理／API 協作的視覺模擬。背景使用者與商戶均為合成示範角色，不是真實人物或真實公司活動。"
    : locale === "ja"
      ? "都市内の移動はエージェント／API連携の視覚的シミュレーションです。背景のユーザーや事業者は合成デモであり、実在人物や企業活動ではありません。"
      : "City movement is a visual simulation of agent/API coordination. Background users and businesses are synthetic demonstration actors, not live people or real company activity.";
}
