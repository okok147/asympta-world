import type { AgentArt, AgentProfile, LocalizedText, ScenarioDefinition, ScenarioId, ServiceDefinition, StakeholderSide } from "./types.ts";

const t = (en: string, zh: string): LocalizedText => ({ en, "zh-Hant": zh });
const art = (style: AgentArt["style"], primary: string, secondary: string, ink = "#2f3835", surface = "#f4f1e8"): AgentArt => ({ style, primary, secondary, ink, surface });
function agent(id: string, name: string, species: string, role: LocalizedText, competence: LocalizedText, visual: AgentArt, organisation?: LocalizedText, side?: StakeholderSide): AgentProfile {
  return { id, name, species, role, competence, art: visual, organisation, side };
}
function service(id: string, name: LocalizedText, description: LocalizedText, zone: ServiceDefinition["zone"], result: LocalizedText, latencyMs = 720): ServiceDefinition {
  return { id, name, description, zone, result, latencyMs, mode: "simulated" };
}

const order: ScenarioDefinition = {
  id: "order",
  category: "commerce",
  label: t("Order flow", "訂單流程"),
  prompt: t("Coordinate an order for 12 customised navy notebooks before Friday 17:00.", "協調一張 12 本客製深藍筆記簿、星期五 17:00 前交付的訂單。"),
  shortPrompt: t("Run the complete order", "運行完整訂單"),
  icon: "package",
  context: [
    { label: t("Quantity", "數量"), value: t("12 notebooks", "12 本筆記簿"), simulated: true },
    { label: t("Finish", "表面"), value: t("Matte navy · logo", "啞面深藍 · 標誌"), simulated: true },
    { label: t("Deadline", "期限"), value: t("Friday · 17:00", "星期五 · 17:00"), simulated: true },
    { label: t("Starting stock", "起始庫存"), value: t("8 / 12 covers", "8 / 12 個封面"), simulated: true },
  ],
  agents: [
    agent("order-conductor", "Mori", "Peacock", t("Personal coordinator", "個人協調員"), t("Protects the human intention across every organisation", "跨越所有組織保護人的意圖"), art("mosaic", "#4f7667", "#c6aa74"), t("Your side", "你的這一方"), "personal"),
    agent("order-receiver", "Ari", "Otter", t("Business receiving", "商戶接單"), t("Turns a request into a traceable commercial job", "把需要轉成可追蹤商業工作"), art("watercolour", "#7c9185", "#d5b58d"), t("Mori Paper Co.", "Mori Paper Co."), "business"),
    agent("order-merchandiser", "Fable", "Fox", t("Merchandiser", "跟單員"), t("Clarifies specifications and keeps the customer promise coherent", "釐清規格並保持客戶承諾一致"), art("folded-paper", "#a56f58", "#d9b66f"), t("Mori Paper Co.", "Mori Paper Co."), "business"),
    agent("order-warehouse", "Moss", "Turtle", t("Warehouse", "倉庫"), t("Checks, reserves and receives physical materials", "檢查、預留及接收實體物料"), art("botanical", "#657b68", "#a7b58a"), t("Mori Warehouse", "Mori 倉庫"), "operations"),
    agent("order-procurement", "Sora", "Owl", t("Procurement", "採購"), t("Finds missing material with provenance and timing", "尋找缺少物料並核實來源與時間"), art("nocturne", "#5e6478", "#c0aa72"), t("Mori Paper Co.", "Mori Paper Co."), "business"),
    agent("order-supplier", "North", "Deer", t("Supplier", "供應商"), t("Quotes, reserves, prepares and hands materials over", "報價、預留、準備及交接物料"), art("ink", "#88725f", "#8da080"), t("North Mill", "North Mill"), "supplier"),
    agent("order-workshop", "Rivet", "Beaver", t("Production", "生產"), t("Schedules, makes and reworks the customised batch", "安排、生產及返工客製批次"), art("workshop", "#85634e", "#c89e65"), t("Mori Workshop", "Mori 工場"), "operations"),
    agent("order-quality", "Kumo", "Crane", t("Quality control", "品質檢查"), t("Rejects defects and releases only verified units", "拒絕缺陷，只放行已核實單位"), art("porcelain", "#d7d3c9", "#96756e"), t("Mori QA", "Mori 品質"), "operations"),
    agent("order-fulfilment", "Patch", "Raccoon", t("Fulfilment", "履約"), t("Packs exact quantity and prepares the dispatch record", "按準確數量包裝並準備出貨紀錄"), art("street-map", "#69716d", "#c8a86d"), t("Mori Fulfilment", "Mori 履約"), "operations"),
    agent("order-finance", "Maris", "Orca", t("Finance", "財務"), t("Prepares invoice and stops before consequential settlement", "準備發票並在重要結算前停下"), art("ocean", "#4f6874", "#8eb4b5"), t("Mori Finance", "Mori 財務"), "finance"),
    agent("order-carrier", "Sol", "Red panda", t("Carrier", "承運商"), t("Coordinates pickup, route, tracking and delivery", "協調取件、路線、追蹤及交付"), art("sunrise", "#9e624f", "#d4b372"), t("Harbour Courier", "Harbour Courier"), "logistics"),
    agent("order-support", "Iris", "Hummingbird", t("After-sales", "售後"), t("Closes the loop with support, return and audit continuity", "以支援、退貨及稽核延續完成閉環"), art("glass", "#6c978d", "#c58c93"), t("Mori Care", "Mori 售後"), "support"),
  ],
  services: [
    service("order.receive", t("Order desk", "訂單台"), t("Simulated business receiving system", "模擬商戶接單系統"), "communication", t("Order OW-1208 opened", "訂單 OW-1208 已建立")),
    service("order.clarify", t("Customer thread", "客戶對話"), t("Simulated clarification channel", "模擬釐清對話通道"), "communication", t("Matte navy confirmed", "已確認啞面深藍")),
    service("inventory.read", t("Warehouse stock", "倉庫庫存"), t("Simulated inventory ledger", "模擬庫存帳"), "planning", t("8 matching covers · shortage 4", "8 個匹配封面 · 尚欠 4 個")),
    service("supplier.quote", t("Supplier quote", "供應商報價"), t("Simulated upstream supplier exchange", "模擬上游供應商交換"), "market", t("4 covers available · handoff 14:20", "4 個封面可供應 · 14:20 交接"), 920),
    service("material.receive", t("Material receipt", "物料收貨"), t("Simulated warehouse receipt", "模擬倉庫收貨"), "planning", t("Stock updated 8 → 12", "庫存已由 8 → 12")),
    service("production.run", t("Workshop", "工場"), t("Simulated production schedule", "模擬生產排程"), "planning", t("12 units produced", "已生產 12 件"), 940),
    service("quality.inspect", t("Quality check", "品質檢查"), t("Simulated QA inspection", "模擬品質檢查"), "research", t("11 pass · 1 edge defect", "11 合格 · 1 件邊緣缺陷")),
    service("invoice.prepare", t("Invoice", "發票"), t("Simulated invoice and settlement preparation", "模擬發票及結算準備"), "convergence", t("Invoice prepared · not charged", "發票已準備 · 尚未扣款")),
    service("carrier.track", t("Carrier tracking", "物流追蹤"), t("Simulated carrier route and tracking", "模擬承運路線與追蹤"), "external", t("Pickup 15:10 · ETA 16:35", "15:10 取件 · 預計 16:35"), 1_020),
    service("support.open", t("After-sales", "售後"), t("Simulated support and return route", "模擬支援及退貨路徑"), "context", t("Support path opened", "售後支援路徑已開啟")),
  ],
  tasks: [
    { id: "interpret", stageId: "intent", agentId: "order-conductor", title: t("Form the intention packet", "形成意圖封包"), thought: t("Protecting quantity, finish and deadline", "保護數量、表面及期限"), completion: t("12 · matte navy · Friday 17:00", "12 · 啞面深藍 · 星期五 17:00"), zone: "human", durationMs: 900, dependencies: [], kind: "interpret" },
    { id: "business-receive", stageId: "business", agentId: "order-receiver", title: t("Business receives the order", "商戶收到訂單"), thought: t("Opening a traceable job", "建立可追蹤工作"), completion: t("OW-1208 received", "OW-1208 已接收"), zone: "communication", durationMs: 1_150, dependencies: ["interpret"], toolId: "order.receive", kind: "specialist" },
    { id: "clarify", stageId: "business", agentId: "order-merchandiser", title: t("Clarify the finish", "釐清表面規格"), thought: t("Matte or gloss?", "啞面還是亮面？"), completion: t("Question sent · matte requested", "問題已發出 · 要求啞面"), zone: "communication", durationMs: 1_100, dependencies: ["business-receive"], kind: "specialist" },
    { id: "customer-confirm", stageId: "business", agentId: "order-conductor", title: t("Customer side confirms", "客戶一方確認"), thought: t("Answering without restarting the order", "不重啟訂單直接回答"), completion: t("Matte navy confirmed", "已確認啞面深藍"), zone: "human", durationMs: 850, dependencies: ["clarify"], toolId: "order.clarify", kind: "specialist" },
    { id: "inventory-check", stageId: "materials", agentId: "order-warehouse", title: t("Check available stock", "檢查可用庫存"), thought: t("Counting matching covers", "點算匹配封面"), completion: t("8 available · shortage 4", "有 8 個 · 尚欠 4 個"), zone: "planning", durationMs: 1_300, dependencies: ["customer-confirm"], toolId: "inventory.read", kind: "specialist" },
    { id: "supplier-quote", stageId: "materials", agentId: "order-procurement", title: t("Contact the supplier", "聯絡供應商"), thought: t("Finding four compatible covers", "尋找四個兼容封面"), completion: t("North Mill can supply 4", "North Mill 可供應 4 個"), zone: "market", durationMs: 1_450, dependencies: ["inventory-check"], toolId: "supplier.quote", kind: "specialist" },
    { id: "material-prepare", stageId: "materials", agentId: "order-supplier", title: t("Supplier reserves and prepares", "供應商預留並準備"), thought: t("Preparing four navy covers", "準備四個深藍封面"), completion: t("4 covers prepared", "4 個封面已準備"), zone: "market", durationMs: 1_300, dependencies: ["supplier-quote"], kind: "specialist" },
    { id: "material-handoff", stageId: "materials", agentId: "order-supplier", title: t("Hand material to the warehouse", "把物料交給倉庫"), thought: t("Handoff with quantity evidence", "附數量證據交接"), completion: t("4 covers handed over", "4 個封面已交接"), zone: "external", durationMs: 1_100, dependencies: ["material-prepare"], kind: "specialist" },
    { id: "material-receive", stageId: "materials", agentId: "order-warehouse", title: t("Receive missing material", "接收缺少物料"), thought: t("Reconciling physical stock", "核對實體庫存"), completion: t("Stock 8 → 12", "庫存 8 → 12"), zone: "planning", durationMs: 1_200, dependencies: ["material-handoff"], toolId: "material.receive", kind: "specialist" },
    { id: "production-plan", stageId: "production", agentId: "order-workshop", title: t("Schedule the batch", "安排批次"), thought: t("Protecting Friday 17:00", "守住星期五 17:00"), completion: t("Workshop slot reserved", "工場時段已預留"), zone: "planning", durationMs: 1_050, dependencies: ["material-receive"], kind: "specialist" },
    { id: "production-run", stageId: "production", agentId: "order-workshop", title: t("Make the customised batch", "製作客製批次"), thought: t("Printing and binding 12", "印刷並裝訂 12 本"), completion: t("12 units produced", "已生產 12 件"), zone: "planning", durationMs: 1_800, dependencies: ["production-plan"], toolId: "production.run", kind: "specialist" },
    { id: "quality-check", stageId: "quality", agentId: "order-quality", title: t("Inspect every unit", "檢查每一件"), thought: t("Checking print, edge and count", "檢查印刷、邊緣及數量"), completion: t("11 pass · 1 defect", "11 合格 · 1 件缺陷"), zone: "research", durationMs: 1_350, dependencies: ["production-run"], toolId: "quality.inspect", kind: "specialist" },
    { id: "quality-rework", stageId: "quality", agentId: "order-workshop", title: t("Rework the failed unit", "返工不合格單位"), thought: t("Correcting one edge defect", "修正一件邊緣缺陷"), completion: t("Defect corrected", "缺陷已修正"), zone: "planning", durationMs: 1_050, dependencies: ["quality-check"], kind: "specialist" },
    { id: "quality-release", stageId: "quality", agentId: "order-quality", title: t("Release 12 of 12", "放行 12 / 12"), thought: t("Verifying the corrected unit", "核實已修正單位"), completion: t("12 / 12 released", "12 / 12 已放行"), zone: "research", durationMs: 900, dependencies: ["quality-rework"], kind: "specialist" },
    { id: "pack", stageId: "dispatch", agentId: "order-fulfilment", title: t("Pack and manifest", "包裝並建立清單"), thought: t("Matching quantity to order", "把數量與訂單核對"), completion: t("12 packed · manifest ready", "12 件已包裝 · 清單已準備"), zone: "planning", durationMs: 1_200, dependencies: ["quality-release"], kind: "specialist" },
    { id: "invoice-prepare", stageId: "dispatch", agentId: "order-finance", title: t("Prepare invoice and settlement", "準備發票及結算"), thought: t("Holding before consequential settlement", "在重要結算前停下"), completion: t("Invoice ready · no charge", "發票已準備 · 未扣款"), zone: "convergence", durationMs: 1_100, dependencies: ["pack"], toolId: "invoice.prepare", kind: "specialist" },
    { id: "dispatch-approval", stageId: "dispatch", agentId: "order-finance", title: t("Ask for dispatch approval", "要求出貨批准"), thought: t("Waiting for human judgment", "等待人的判斷"), completion: t("Dispatch approved in demo", "示範出貨已批准"), zone: "human", durationMs: 700, dependencies: ["invoice-prepare"], kind: "specialist", requiresApproval: true, approvalLabel: t("Approve simulated payment + dispatch handoff", "批准模擬付款及出貨交接") },
    { id: "carrier-handoff", stageId: "delivery", agentId: "order-carrier", title: t("Carrier receives the shipment", "承運商收到貨件"), thought: t("Scanning pickup and route", "掃描取件及路線"), completion: t("Pickup 15:10 · tracking active", "15:10 取件 · 追蹤已啟動"), zone: "external", durationMs: 1_250, dependencies: ["dispatch-approval"], toolId: "carrier.track", kind: "specialist" },
    { id: "delivery", stageId: "delivery", agentId: "order-carrier", title: t("Deliver before the deadline", "期限前完成派送"), thought: t("Protecting the final handoff", "守住最後交接"), completion: t("Delivered 16:34", "16:34 已交付"), zone: "external", durationMs: 1_350, dependencies: ["carrier-handoff"], kind: "specialist" },
    { id: "after-sales", stageId: "complete", agentId: "order-support", title: t("Open the support path", "開啟售後支援"), thought: t("Keeping return and support available", "保持退貨與支援可用"), completion: t("Support path ready", "售後支援已準備"), zone: "context", durationMs: 900, dependencies: ["delivery"], toolId: "support.open", kind: "specialist" },
    { id: "report", stageId: "complete", agentId: "order-conductor", title: t("Bring the whole journey home", "把完整流程帶回來"), thought: t("Compressing the audit trail into one result", "把稽核軌跡整理成一個結果"), completion: t("Complete order trace ready", "完整訂單軌跡已準備"), zone: "human", durationMs: 750, dependencies: ["after-sales"], kind: "report" },
  ],
  journey: [
    { id: "intent", label: t("Human intention", "人的意圖"), shortLabel: t("Intent", "意圖"), organisation: t("Your side", "你的這一方"), zone: "human", taskIds: ["interpret"] },
    { id: "business", label: t("Business receive + clarify", "商戶接單與釐清"), shortLabel: t("Business", "商戶"), organisation: t("Mori Paper Co.", "Mori Paper Co."), zone: "communication", taskIds: ["business-receive", "clarify", "customer-confirm"] },
    { id: "materials", label: t("Inventory + supplier", "庫存與供應商"), shortLabel: t("Materials", "物料"), organisation: t("Mori Warehouse · North Mill", "Mori 倉庫 · North Mill"), zone: "market", taskIds: ["inventory-check", "supplier-quote", "material-prepare", "material-handoff", "material-receive"] },
    { id: "production", label: t("Production", "生產"), shortLabel: t("Make", "製作"), organisation: t("Mori Workshop", "Mori 工場"), zone: "planning", taskIds: ["production-plan", "production-run"] },
    { id: "quality", label: t("Quality + rework", "品質與返工"), shortLabel: t("Quality", "品質"), organisation: t("Mori QA", "Mori 品質"), zone: "research", taskIds: ["quality-check", "quality-rework", "quality-release"] },
    { id: "dispatch", label: t("Pack + finance + approval", "包裝、財務與批准"), shortLabel: t("Approve", "批准"), organisation: t("Mori Fulfilment · Finance", "Mori 履約 · 財務"), zone: "convergence", taskIds: ["pack", "invoice-prepare", "dispatch-approval"] },
    { id: "delivery", label: t("Carrier + delivery", "物流與交付"), shortLabel: t("Deliver", "交付"), organisation: t("Harbour Courier", "Harbour Courier"), zone: "external", taskIds: ["carrier-handoff", "delivery"] },
    { id: "complete", label: t("After-sales + audit", "售後與稽核"), shortLabel: t("Complete", "完成"), organisation: t("Mori Care · Your side", "Mori 售後 · 你的這一方"), zone: "human", taskIds: ["after-sales", "report"] },
  ],
  result: {
    eyebrow: t("Complete economic journey", "完整經濟流程"),
    title: t("12 custom notebooks · delivered", "12 本客製筆記簿 · 已交付"),
    subtitle: t("One human intention coordinated customer, merchant, supplier, production, finance, logistics and support.", "一個人的意圖協調了客戶、商戶、供應商、生產、財務、物流與售後。"),
    facts: [
      { label: t("Inventory", "庫存"), value: t("8 → 12", "8 → 12") },
      { label: t("Quality", "品質"), value: t("1 rework · 12 pass", "1 件返工 · 12 合格") },
      { label: t("Delivery", "交付"), value: t("16:34", "16:34") },
    ],
    reasons: [t("Clarification preserved the order instead of restarting it", "釐清規格後訂單直接延續，沒有重啟"), t("A four-unit shortage triggered a visible supplier handoff", "缺少四個單位觸發可見的供應商交接"), t("Quality failure caused real dependency rework before release", "品質失敗在放行前觸發真正依賴返工"), t("Payment and dispatch paused for human judgment", "付款與出貨在人的判斷前停下")],
    resources: [{ label: t("Organisations", "組織"), value: t("7 sides", "7 方") }, { label: t("Tasks", "任務"), value: t("21 states", "21 個狀態") }, { label: t("External actions", "外部行動"), value: t("Simulated only", "只作模擬") }],
    primaryAction: { id: "review-order-trace", label: t("Review trace", "查看軌跡"), consequential: false },
    secondaryAction: { id: "approve-order-handoff", label: t("Approve demo closeout", "批准示範結案"), consequential: true },
    disclosure: t("Merchant, supplier, inventory, payment, production, carrier and tracking data are simulated. No real order, charge, message or shipment occurred.", "商戶、供應商、庫存、付款、生產、承運商及追蹤資料均為模擬；沒有真實訂單、扣款、訊息或貨運發生。"),
  },
};

const dinner: ScenarioDefinition = {
  id: "dinner", category: "food", label: t("Dinner", "晚餐"), prompt: t("I don't know what to eat tonight.", "我今晚不知道吃甚麼。"), shortPrompt: t("Find dinner tonight", "找今晚晚餐"), icon: "bowl",
  context: [{ label: t("Time", "時間"), value: t("Tonight", "今晚") }, { label: t("Budget", "預算"), value: t("~HK$150", "約 HK$150"), simulated: true }, { label: t("Preference", "偏好"), value: t("Quiet · casual", "安靜 · 輕鬆"), simulated: true }],
  agents: [
    agent("dinner-conductor", "Pavo", "Peacock", t("Coordinator", "協調員"), t("Turns many signals into one calm choice", "把多項訊號整理成一個清晰選擇"), art("mosaic", "#315f62", "#d7a857"), t("Your side", "你的這一方"), "personal"),
    agent("dinner-context", "Nori", "Otter", t("Context", "情境員"), t("Understands tonight around you", "理解你所在地與今晚情況"), art("watercolour", "#9a6548", "#76a9ad")),
    agent("dinner-discovery", "Fable", "Fox", t("Discovery", "探索員"), t("Finds relevant nearby options", "尋找相關的附近選擇"), art("folded-paper", "#c65f3d", "#f2c267")),
    agent("dinner-preference", "Sora", "Owl", t("Preference", "偏好員"), t("Matches evidence with your taste", "把證據與你的喜好配對"), art("nocturne", "#51577d", "#d7b96a")),
    agent("dinner-logistics", "Moss", "Turtle", t("Logistics", "實務員"), t("Checks distance, hours and availability", "核實距離、時間與供應"), art("botanical", "#55785d", "#a9bc74")),
  ],
  services: [service("local.context", t("Local context", "本地情境"), t("Grouped local demo context", "分組本地示範情境"), "context", t("Tonight · nearby", "今晚 · 附近")), service("restaurant.search", t("Place search", "地點搜尋"), t("Simulated restaurant discovery", "模擬餐廳探索"), "market", t("3 relevant options", "3 個相關選擇")), service("preference.match", t("Preference", "偏好"), t("Simulated preference match", "模擬偏好配對"), "research", t("Thai fits best", "泰式最合適")), service("maps.practicality", t("Travel & hours", "路程與時間"), t("Simulated travel check", "模擬路程核實"), "external", t("12 min · open", "12 分鐘 · 營業中"))],
  tasks: [
    { id: "interpret", agentId: "dinner-conductor", title: t("Understand dinner", "理解晚餐需要"), thought: t("Understanding tonight", "理解今晚"), completion: t("Dinner · nearby · calm", "晚餐 · 附近 · 輕鬆"), zone: "human", durationMs: 900, dependencies: [], kind: "interpret" },
    { id: "context", agentId: "dinner-context", title: t("Read context", "讀取情境"), thought: t("Reading tonight", "讀取今晚情況"), completion: t("Context ready", "情境已準備"), zone: "context", durationMs: 1_250, dependencies: ["interpret"], toolId: "local.context", kind: "specialist" },
    { id: "discover", agentId: "dinner-discovery", title: t("Find options", "尋找選擇"), thought: t("Searching nearby", "搜尋附近"), completion: t("3 candidates", "3 個候選"), zone: "market", durationMs: 1_500, dependencies: ["context"], toolId: "restaurant.search", kind: "specialist" },
    { id: "preference", agentId: "dinner-preference", title: t("Match taste", "配對喜好"), thought: t("Avoiding repeats", "避免重複"), completion: t("Thai fits", "泰式合適"), zone: "research", durationMs: 1_350, dependencies: ["context"], toolId: "preference.match", kind: "specialist" },
    { id: "logistics", agentId: "dinner-logistics", title: t("Check practicality", "核實可行性"), thought: t("Checking travel", "核實路程"), completion: t("12 min · open", "12 分鐘 · 營業中"), zone: "external", durationMs: 1_450, dependencies: ["context"], toolId: "maps.practicality", kind: "specialist" },
    { id: "synthesise", agentId: "dinner-conductor", title: t("Converge", "匯合"), thought: t("Combining evidence", "整合證據"), completion: t("Best match ready", "最佳配對已準備"), zone: "convergence", durationMs: 1_000, dependencies: ["discover", "preference", "logistics"], kind: "synthesis" },
    { id: "report", agentId: "dinner-conductor", title: t("Return to you", "帶回結果"), thought: t("Bringing one choice", "帶回一個選擇"), completion: t("Dinner ready", "晚餐建議已準備"), zone: "human", durationMs: 600, dependencies: ["synthesise"], kind: "report" },
  ],
  result: { eyebrow: t("Dinner suggestion", "晚餐建議"), title: t("Thai Basil House", "Thai Basil House"), subtitle: t("A calm demo recommendation", "一個平靜的示範建議"), facts: [{ label: t("Walk", "步行"), value: t("12 min", "12 分鐘") }, { label: t("Budget", "預算"), value: t("~HK$130", "約 HK$130") }], reasons: [t("Fits budget", "符合預算"), t("Different from yesterday", "與昨天不同")], resources: [{ label: t("Attention", "注意力"), value: t("1 choice", "1 個選擇") }], primaryAction: { id: "choose-dinner", label: t("Choose this", "選擇這個"), consequential: false }, secondaryAction: { id: "reserve-table", label: t("Reserve table", "預訂座位"), consequential: true }, disclosure: t("Restaurant, distance and availability are simulated. No booking was made.", "餐廳、距離及供應資料均為模擬；沒有進行預訂。") },
};

const work: ScenarioDefinition = {
  id: "work", category: "work", label: t("Work", "工作"), prompt: t("Prepare me for tomorrow's meeting.", "幫我準備明天的會議。"), shortPrompt: t("Prepare a meeting", "準備會議"), icon: "brief",
  context: [{ label: t("Meeting", "會議"), value: t("Tomorrow · 10:00", "明天 · 10:00"), simulated: true }, { label: t("Documents", "文件"), value: t("4 demo docs", "4 份示範文件"), simulated: true }],
  agents: [agent("work-coordinator", "Aster", "Elephant", t("Coordinator", "協調員"), t("Keeps the briefing coherent", "保持簡報一致"), art("modernist", "#647b86", "#d1b784")), agent("work-calendar", "Elowen", "Deer", t("Calendar", "日程員"), t("Finds meeting context", "尋找會議情境"), art("ink", "#9a6f52", "#8daa79")), agent("work-research", "Corvus", "Raven", t("Research", "研究員"), t("Finds evidence and gaps", "尋找證據與缺口"), art("charcoal", "#30384d", "#8fa3c2")), agent("work-document", "Rivet", "Beaver", t("Document", "文件員"), t("Builds a concise briefing", "製作精簡簡報"), art("workshop", "#8d5f43", "#d9a45d"))],
  services: [service("calendar.read", t("Calendar", "日曆"), t("Simulated calendar", "模擬日曆"), "planning", t("Project review · 10:00", "專案檢視 · 10:00")), service("web.research", t("Research", "研究"), t("Simulated research", "模擬研究"), "research", t("6 sources · 2 gaps", "6 個來源 · 2 個缺口")), service("document.read", t("Documents", "文件"), t("Simulated document read", "模擬文件讀取"), "external", t("4 documents summarised", "已整理 4 份文件"))],
  tasks: [
    { id: "interpret", agentId: "work-coordinator", title: t("Understand meeting", "理解會議"), thought: t("Understanding tomorrow", "理解明天"), completion: t("Brief needed", "需要簡報"), zone: "human", durationMs: 900, dependencies: [], kind: "interpret" },
    { id: "calendar", agentId: "work-calendar", title: t("Find context", "找出情境"), thought: t("Checking calendar", "檢查日曆"), completion: t("10:00 project review", "10:00 專案檢視"), zone: "planning", durationMs: 1_200, dependencies: ["interpret"], toolId: "calendar.read", kind: "specialist" },
    { id: "research", agentId: "work-research", title: t("Research topic", "研究主題"), thought: t("Checking evidence", "核實證據"), completion: t("2 open questions", "2 個待解問題"), zone: "research", durationMs: 1_450, dependencies: ["calendar"], toolId: "web.research", kind: "specialist" },
    { id: "document", agentId: "work-document", title: t("Prepare brief", "準備簡報"), thought: t("Structuring docs", "整理文件"), completion: t("Draft ready", "草稿已準備"), zone: "external", durationMs: 1_450, dependencies: ["calendar"], toolId: "document.read", kind: "specialist" },
    { id: "synthesise", agentId: "work-coordinator", title: t("Converge", "匯合"), thought: t("Combining evidence", "整合證據"), completion: t("Brief ready", "簡報已準備"), zone: "convergence", durationMs: 950, dependencies: ["research", "document"], kind: "synthesis" },
    { id: "report", agentId: "work-coordinator", title: t("Return brief", "帶回簡報"), thought: t("Bringing it back", "帶回簡報"), completion: t("Ready for review", "可供檢視"), zone: "human", durationMs: 600, dependencies: ["synthesise"], kind: "report" },
  ],
  result: { eyebrow: t("Meeting briefing", "會議簡報"), title: t("Tomorrow · Project review", "明天 · 專案檢視"), subtitle: t("A concise simulated brief", "一份精簡模擬簡報"), facts: [{ label: t("Documents", "文件"), value: t("4", "4") }, { label: t("Questions", "問題"), value: t("2", "2") }], reasons: [t("Gaps surfaced", "已指出缺口"), t("Evidence separated", "證據已分開")], resources: [{ label: t("Attention", "注意力"), value: t("2 questions", "2 個問題") }], primaryAction: { id: "open-brief", label: t("Review brief", "檢視簡報"), consequential: false }, secondaryAction: { id: "share-brief", label: t("Share brief", "分享簡報"), consequential: true }, disclosure: t("Calendar, documents and research are simulated. Nothing was shared.", "日曆、文件及研究均為模擬；沒有分享任何內容。") },
};

const shopping: ScenarioDefinition = {
  id: "shopping", category: "shopping", label: t("Shopping", "購物"), prompt: t("Find me a good monitor under HK$3,000.", "幫我找一部 HK$3,000 以下的好螢幕。"), shortPrompt: t("Compare a product", "比較產品"), icon: "display",
  context: [{ label: t("Budget", "預算"), value: t("HK$3,000", "HK$3,000") }, { label: t("Priority", "優先"), value: t("Text clarity · USB-C", "文字清晰 · USB-C"), simulated: true }],
  agents: [agent("shop-coordinator", "Kumo", "Crane", t("Comparison", "比較員"), t("Makes trade-offs legible", "讓取捨清晰"), art("porcelain", "#d7d6cf", "#bd5e4c")), agent("shop-requirements", "Pip", "Meerkat", t("Requirements", "需求員"), t("Clarifies what matters", "釐清真正重要條件"), art("desert", "#bb8153", "#e2c07a")), agent("shop-research", "Lyn", "Lynx", t("Research", "研究員"), t("Finds credible candidates", "找出可信候選"), art("editorial", "#a06f55", "#6f8d9a")), agent("shop-price", "Patch", "Raccoon", t("Price", "價格員"), t("Checks seller terms", "核實商戶條款"), art("street-map", "#626b69", "#d2aa64"))],
  services: [service("requirements.parse", t("Requirements", "需求"), t("Simulated requirement parser", "模擬需求分析"), "context", t("27-inch · USB-C", "27 吋 · USB-C")), service("product.search", t("Product search", "產品搜尋"), t("Simulated catalogue", "模擬產品目錄"), "market", t("3 relevant", "3 個相關")), service("price.compare", t("Price check", "價格核實"), t("Simulated seller data", "模擬商戶資料"), "external", t("Best fit HK$2,699", "最佳配對 HK$2,699"))],
  tasks: [
    { id: "interpret", agentId: "shop-coordinator", title: t("Understand purchase", "理解購買"), thought: t("Understanding trade-offs", "理解取捨"), completion: t("Monitor under HK$3,000", "螢幕低於 HK$3,000"), zone: "human", durationMs: 900, dependencies: [], kind: "interpret" },
    { id: "requirements", agentId: "shop-requirements", title: t("Clarify requirements", "釐清需求"), thought: t("Finding non-negotiables", "找出不可妥協條件"), completion: t("USB-C · text clarity", "USB-C · 文字清晰"), zone: "context", durationMs: 1_150, dependencies: ["interpret"], toolId: "requirements.parse", kind: "specialist" },
    { id: "products", agentId: "shop-research", title: t("Research products", "研究產品"), thought: t("Comparing options", "比較選擇"), completion: t("3 strong candidates", "3 個合適候選"), zone: "market", durationMs: 1_400, dependencies: ["requirements"], toolId: "product.search", kind: "specialist" },
    { id: "prices", agentId: "shop-price", title: t("Check price", "核實價格"), thought: t("Checking seller terms", "核實商戶條款"), completion: t("Best value under budget", "最高性價比低於預算"), zone: "external", durationMs: 1_300, dependencies: ["requirements"], toolId: "price.compare", kind: "specialist" },
    { id: "synthesise", agentId: "shop-coordinator", title: t("Converge", "匯合"), thought: t("Making trade-offs legible", "整理取捨"), completion: t("Best fit ready", "最佳配對已準備"), zone: "convergence", durationMs: 950, dependencies: ["products", "prices"], kind: "synthesis" },
    { id: "report", agentId: "shop-coordinator", title: t("Return comparison", "帶回比較"), thought: t("Bringing one shortlist", "帶回一份候選"), completion: t("Comparison ready", "比較已準備"), zone: "human", durationMs: 600, dependencies: ["synthesise"], kind: "report" },
  ],
  result: { eyebrow: t("Monitor shortlist", "螢幕候選"), title: t("27-inch USB-C QHD", "27 吋 USB-C QHD"), subtitle: t("Best simulated fit under budget", "低於預算的最佳模擬配對"), facts: [{ label: t("Price", "價格"), value: t("HK$2,699", "HK$2,699") }, { label: t("Connection", "連接"), value: t("USB-C", "USB-C") }], reasons: [t("Clear text", "文字清晰"), t("Under budget", "低於預算")], resources: [{ label: t("Options", "選擇"), value: t("3 compared", "已比較 3 個") }], primaryAction: { id: "view-comparison", label: t("View comparison", "查看比較"), consequential: false }, secondaryAction: { id: "buy-monitor", label: t("Buy this", "購買這部"), consequential: true }, disclosure: t("Product, price and stock details are simulated. No purchase was made.", "產品、價格及庫存資料均為模擬；沒有進行購買。") },
};

const email: ScenarioDefinition = {
  id: "email", category: "communication", label: t("Email", "電郵"), prompt: t("There's an important email I need to deal with.", "我有一封重要電郵需要處理。"), shortPrompt: t("Handle an email", "處理電郵"), icon: "mail",
  context: [{ label: t("Inbox", "收件箱"), value: t("Demo message", "示範郵件"), simulated: true }, { label: t("Needed", "需要"), value: t("Decision + reply", "決定 + 回覆"), simulated: true }],
  agents: [agent("mail-coordinator", "Maris", "Orca", t("Coordinator", "協調員"), t("Protects intent and approval", "保障意圖與批准權"), art("ocean", "#263f52", "#8ec4ca")), agent("mail-inbox", "Iris", "Hummingbird", t("Inbox", "收件員"), t("Finds the relevant message", "找出相關郵件"), art("glass", "#3e9b8f", "#d87c8a")), agent("mail-context", "Bramble", "Rabbit", t("Context", "情境員"), t("Connects prior work", "連結之前工作"), art("quilt", "#b58d8f", "#d8c27d")), agent("mail-draft", "Sol", "Red panda", t("Draft", "草擬員"), t("Prepares a careful response", "準備審慎回覆"), art("sunrise", "#b7543f", "#e9b967"))],
  services: [service("mail.read", t("Inbox", "收件箱"), t("Simulated read-only inbox", "模擬唯讀收件箱"), "communication", t("1 relevant message", "1 封相關郵件")), service("context.retrieve", t("Context", "情境"), t("Simulated project context", "模擬專案情境"), "research", t("2 prior decisions", "2 項之前決定")), service("mail.draft", t("Draft", "草擬"), t("Drafts but cannot send", "草擬但不能發送"), "planning", t("Draft ready · not sent", "草稿已準備 · 尚未發送"))],
  tasks: [
    { id: "interpret", agentId: "mail-coordinator", title: t("Understand email", "理解電郵"), thought: t("Understanding what needs action", "理解需要行動"), completion: t("Reply needed", "需要回覆"), zone: "human", durationMs: 900, dependencies: [], kind: "interpret" },
    { id: "inbox", agentId: "mail-inbox", title: t("Find message", "尋找郵件"), thought: t("Reading permitted inbox", "讀取已允許收件箱"), completion: t("Message found", "已找到郵件"), zone: "communication", durationMs: 1_100, dependencies: ["interpret"], toolId: "mail.read", kind: "specialist" },
    { id: "context", agentId: "mail-context", title: t("Recover context", "找回情境"), thought: t("Connecting decisions", "連結之前決定"), completion: t("2 decisions connected", "已連結 2 項決定"), zone: "research", durationMs: 1_250, dependencies: ["inbox"], toolId: "context.retrieve", kind: "specialist" },
    { id: "draft", agentId: "mail-draft", title: t("Prepare reply", "準備回覆"), thought: t("Drafting without sending", "草擬但不發送"), completion: t("Draft ready", "草稿已準備"), zone: "planning", durationMs: 1_350, dependencies: ["inbox"], toolId: "mail.draft", kind: "specialist" },
    { id: "synthesise", agentId: "mail-coordinator", title: t("Converge", "匯合"), thought: t("Checking tone and intent", "檢查語氣與意圖"), completion: t("Reply ready", "回覆已準備"), zone: "convergence", durationMs: 950, dependencies: ["context", "draft"], kind: "synthesis" },
    { id: "report", agentId: "mail-coordinator", title: t("Return draft", "帶回草稿"), thought: t("Bringing draft to you", "把草稿帶給你"), completion: t("Your review is needed", "需要你的檢視"), zone: "human", durationMs: 600, dependencies: ["synthesise"], kind: "report" },
  ],
  result: { eyebrow: t("Reply prepared", "回覆已準備"), title: t("Project timeline confirmation", "專案時間表確認"), subtitle: t("A concise simulated reply held for approval", "精簡模擬回覆，等待批准"), facts: [{ label: t("Status", "狀態"), value: t("Draft only", "僅為草稿") }], reasons: [t("Answers the decision", "回應所要求決定"), t("Keeps one question visible", "保留一項待解問題")], resources: [{ label: t("Attention", "注意力"), value: t("1 approval", "1 次批准") }], primaryAction: { id: "review-draft", label: t("Review draft", "檢視草稿"), consequential: false }, secondaryAction: { id: "send-email", label: t("Send email", "發送電郵"), consequential: true }, disclosure: t("Inbox, context and draft are simulated. The email has not been sent.", "收件箱、情境及草稿均為模擬；電郵尚未發送。") },
};

export const SCENARIOS: Record<ScenarioId, ScenarioDefinition> = { order, dinner, work, shopping, email };
export const SCENARIO_ORDER: ScenarioId[] = ["order", "dinner", "work", "shopping", "email"];
export function scenarioFor(id: ScenarioId) { return SCENARIOS[id]; }
export function classifyScenario(input: string, preferred?: ScenarioId): ScenarioId {
  const value = input.toLowerCase();
  if (/order|supplier|supply|merchant|notebook|procurement|warehouse|shipment|manufactur|customi[sz]e|訂單|供應|商戶|採購|倉庫|物流|客製|生產/.test(value)) return "order";
  if (/email|mail|reply|respond|inbox|電郵|郵件|回覆/.test(value)) return "email";
  if (/monitor|screen|buy|shop|price|compare|product|螢幕|購物|買|價格|比較/.test(value)) return "shopping";
  if (/meeting|brief|document|prepare|tomorrow|會議|文件|準備|明天/.test(value)) return "work";
  if (/dinner|eat|food|restaurant|hungry|晚餐|食|餐廳|肚餓/.test(value)) return "dinner";
  return preferred ?? "work";
}
