import type {
  AgentArt,
  AgentProfile,
  LocalizedText,
  ScenarioDefinition,
  ScenarioId,
  ServiceDefinition,
} from "./types.ts";

const t = (en: string, zh: string): LocalizedText => ({
  en,
  "zh-Hant": zh,
});

function art(
  style: AgentArt["style"],
  primary: string,
  secondary: string,
  ink: string,
  surface: string,
): AgentArt {
  return { style, primary, secondary, ink, surface };
}

function agent(
  id: string,
  name: string,
  species: string,
  role: LocalizedText,
  competence: LocalizedText,
  visual: AgentArt,
): AgentProfile {
  return { id, name, species, role, competence, art: visual };
}

function service(
  id: string,
  name: LocalizedText,
  description: LocalizedText,
  zone: ServiceDefinition["zone"],
  result: LocalizedText,
  latencyMs = 760,
): ServiceDefinition {
  return {
    id,
    name,
    description,
    zone,
    result,
    latencyMs,
    mode: "simulated",
  };
}

const dinner: ScenarioDefinition = {
  id: "dinner",
  category: "food",
  label: t("Dinner", "晚餐"),
  prompt: t("I don't know what to eat tonight.", "我今晚不知道吃甚麼。"),
  shortPrompt: t("Find dinner tonight", "找今晚晚餐"),
  icon: "bowl",
  context: [
    { label: t("Time", "時間"), value: t("Tonight", "今晚") },
    { label: t("Budget", "預算"), value: t("~HK$150", "約 HK$150"), simulated: true },
    { label: t("Preference", "偏好"), value: t("Quiet · casual", "安靜 · 輕鬆"), simulated: true },
    { label: t("Recent", "最近飲食"), value: t("Japanese yesterday", "昨天吃過日式"), simulated: true },
  ],
  agents: [
    agent(
      "dinner-conductor",
      "Pavo",
      "Peacock",
      t("Coordinator", "協調員"),
      t("Turns many signals into one calm choice", "把多項訊號整理成一個清晰選擇"),
      art("mosaic", "#315f62", "#d7a857", "#17383b", "#f1eadb"),
    ),
    agent(
      "dinner-context",
      "Nori",
      "Otter",
      t("Context", "情境員"),
      t("Understands tonight around you", "理解你所在地與今晚情況"),
      art("watercolour", "#9a6548", "#76a9ad", "#403126", "#e7f2ef"),
    ),
    agent(
      "dinner-discovery",
      "Fable",
      "Fox",
      t("Discovery", "探索員"),
      t("Finds relevant nearby options", "尋找相關的附近選擇"),
      art("folded-paper", "#c65f3d", "#f2c267", "#492e2a", "#fff1dc"),
    ),
    agent(
      "dinner-preference",
      "Sora",
      "Owl",
      t("Preference", "偏好員"),
      t("Matches evidence with your taste", "把證據與你的喜好配對"),
      art("nocturne", "#51577d", "#d7b96a", "#262942", "#e8e5f1"),
    ),
    agent(
      "dinner-logistics",
      "Moss",
      "Turtle",
      t("Logistics", "實務員"),
      t("Checks distance, hours and availability", "核實距離、時間與供應"),
      art("botanical", "#55785d", "#a9bc74", "#284633", "#edf1df"),
    ),
  ],
  services: [
    service(
      "local.context",
      t("Local context", "本地情境"),
      t("Groups device location without exposing coordinates", "按裝置位置分區，不顯示座標"),
      "context",
      t("Tonight · nearby · demo budget", "今晚 · 附近 · 示範預算"),
      620,
    ),
    service(
      "restaurant.search",
      t("Place search", "地點搜尋"),
      t("Demo adapter for nearby restaurant discovery", "附近餐廳探索的示範接頭"),
      "market",
      t("5 demo places · 3 relevant", "5 個示範地點 · 3 個相關"),
      920,
    ),
    service(
      "preference.match",
      t("Preference memory", "偏好記憶"),
      t("Uses explicitly labelled demo preferences", "使用清楚標示的示範偏好"),
      "research",
      t("Avoid repeat · quiet preferred", "避免重複 · 偏好安靜"),
      680,
    ),
    service(
      "maps.practicality",
      t("Travel & hours", "路程與營業時間"),
      t("Demo adapter for distance and availability", "距離與供應狀態的示範接頭"),
      "external",
      t("First option full · next is 12 min and open", "首選已滿 · 下一間 12 分鐘且營業中"),
      1_080,
    ),
  ],
  tasks: [
    {
      id: "interpret",
      agentId: "dinner-conductor",
      title: t("Understand the need", "理解需要"),
      thought: t("Understanding tonight", "理解今晚情況"),
      completion: t("Dinner · nearby · ~HK$150", "晚餐 · 附近 · 約 HK$150"),
      zone: "human",
      durationMs: 1_300,
      dependencies: [],
      kind: "interpret",
    },
    {
      id: "context",
      agentId: "dinner-context",
      title: t("Read permitted context", "讀取已允許情境"),
      thought: t("Reading tonight around you", "讀取你附近的今晚情境"),
      completion: t("Tonight · nearby · budget noted", "今晚 · 附近 · 已記下預算"),
      zone: "context",
      durationMs: 2_100,
      dependencies: ["interpret"],
      toolId: "local.context",
      kind: "specialist",
    },
    {
      id: "discover",
      agentId: "dinner-discovery",
      title: t("Find good options", "尋找合適選擇"),
      thought: t("Searching nearby", "搜尋附近"),
      completion: t("3 nearby candidates", "3 個附近候選"),
      zone: "market",
      durationMs: 3_300,
      dependencies: ["context"],
      toolId: "restaurant.search",
      kind: "specialist",
    },
    {
      id: "preference",
      agentId: "dinner-preference",
      title: t("Match your taste", "配對你的喜好"),
      thought: t("Avoiding repeats", "避免重複選擇"),
      completion: t("Thai option fits best", "泰式選擇最合適"),
      zone: "research",
      durationMs: 2_900,
      dependencies: ["context"],
      toolId: "preference.match",
      kind: "specialist",
    },
    {
      id: "logistics",
      agentId: "dinner-logistics",
      title: t("Check practicality", "核實可行性"),
      thought: t("Checking travel and hours", "核實路程與時間"),
      completion: t("12 min · open · option available", "12 分鐘 · 營業中 · 有供應"),
      zone: "external",
      durationMs: 3_600,
      dependencies: ["context"],
      toolId: "maps.practicality",
      kind: "specialist",
    },
    {
      id: "synthesise",
      agentId: "dinner-conductor",
      title: t("Converge the evidence", "匯合證據"),
      thought: t("Turning 3 signals into 1 choice", "把 3 項訊號整理成 1 個選擇"),
      completion: t("Best match ready", "最佳選擇已準備"),
      zone: "convergence",
      durationMs: 2_000,
      dependencies: ["discover", "preference", "logistics"],
      kind: "synthesis",
    },
    {
      id: "report",
      agentId: "dinner-conductor",
      title: t("Return to you", "帶結果回來"),
      thought: t("Bringing back one clear answer", "帶回一個清晰答案"),
      completion: t("Recommendation ready", "建議已準備"),
      zone: "human",
      durationMs: 700,
      dependencies: ["synthesise"],
      kind: "report",
    },
  ],
  result: {
    eyebrow: t("Dinner suggestion", "晚餐建議"),
    title: t("Thai Basil House", "Thai Basil House"),
    subtitle: t("Best demo match near your local world", "你所在世界附近的最佳示範配對"),
    facts: [
      { label: t("Walk", "步行"), value: t("12 min", "12 分鐘") },
      { label: t("Budget", "預算"), value: t("~HK$130", "約 HK$130") },
      { label: t("Hours", "營業"), value: t("Open until 22:30", "營業至 22:30") },
    ],
    reasons: [
      t("Matches the demo budget", "符合示範預算"),
      t("Different from yesterday", "與昨天不同"),
      t("Quiet setting in demo context", "示範情境顯示環境安靜"),
      t("Second option recovered after the first was full", "首選已滿後成功改查第二選擇"),
    ],
    resources: [
      { label: t("Money", "金錢"), value: t("~HK$130", "約 HK$130") },
      { label: t("Travel", "路程"), value: t("12 min", "12 分鐘") },
      { label: t("Attention", "注意力"), value: t("1 choice", "1 個選擇") },
    ],
    primaryAction: {
      id: "choose-dinner",
      label: t("Choose this", "選擇這個"),
      consequential: false,
    },
    secondaryAction: {
      id: "reserve-table",
      label: t("Reserve table", "預訂座位"),
      consequential: true,
    },
    disclosure: t(
      "Simulated restaurant, preference, distance and availability data. No booking has been made.",
      "餐廳、偏好、距離及供應資料均為模擬；尚未進行任何預訂。",
    ),
  },
};

const work: ScenarioDefinition = {
  id: "work",
  category: "work",
  label: t("Work", "工作"),
  prompt: t("Prepare me for tomorrow's meeting.", "幫我準備明天的會議。"),
  shortPrompt: t("Prepare tomorrow's meeting", "準備明天會議"),
  icon: "brief",
  context: [
    { label: t("Meeting", "會議"), value: t("Tomorrow · 10:00", "明天 · 10:00"), simulated: true },
    { label: t("Materials", "資料"), value: t("4 demo documents", "4 份示範文件"), simulated: true },
    { label: t("Goal", "目標"), value: t("Enter prepared", "做好準備"), simulated: true },
  ],
  agents: [
    agent("work-coordinator", "Aster", "Elephant", t("Coordinator", "協調員"), t("Keeps the briefing coherent", "保持簡報內容一致"), art("modernist", "#647b86", "#d1b784", "#2f454f", "#edf0ed")),
    agent("work-calendar", "Elowen", "Deer", t("Calendar", "日程員"), t("Finds the right meeting context", "找出正確的會議情境"), art("ink", "#9a6f52", "#8daa79", "#382c28", "#f5eee3")),
    agent("work-research", "Corvus", "Raven", t("Research", "研究員"), t("Finds evidence and open questions", "尋找證據與待解問題"), art("charcoal", "#30384d", "#8fa3c2", "#171c2b", "#e4e9f0")),
    agent("work-document", "Rivet", "Beaver", t("Document", "文件員"), t("Builds a concise briefing", "製作精簡會議簡報"), art("workshop", "#8d5f43", "#d9a45d", "#3b2a24", "#f1e6d4")),
  ],
  services: [
    service("calendar.read", t("Calendar", "日曆"), t("Demo calendar adapter", "示範日曆接頭"), "planning", t("Tomorrow · 10:00 · project review", "明天 · 10:00 · 專案檢視")),
    service("web.research", t("Web research", "網頁研究"), t("Demo research adapter", "示範研究接頭"), "research", t("6 sources · 2 open questions", "6 個來源 · 2 個待解問題"), 960),
    service("document.read", t("Documents", "文件"), t("Demo document adapter", "示範文件接頭"), "external", t("4 documents summarised", "已整理 4 份文件"), 840),
  ],
  tasks: [
    { id: "interpret", agentId: "work-coordinator", title: t("Understand the meeting need", "理解會議需要"), thought: t("Understanding tomorrow", "理解明天情況"), completion: t("Meeting brief needed", "需要會議簡報"), zone: "human", durationMs: 1_300, dependencies: [], kind: "interpret" },
    { id: "calendar", agentId: "work-calendar", title: t("Find meeting context", "尋找會議情境"), thought: t("Checking the calendar", "檢查日曆"), completion: t("Project review · 10:00", "專案檢視 · 10:00"), zone: "planning", durationMs: 2_500, dependencies: ["interpret"], toolId: "calendar.read", kind: "specialist" },
    { id: "research", agentId: "work-research", title: t("Research the topic", "研究會議主題"), thought: t("Checking source material", "核實來源資料"), completion: t("2 open questions", "2 個待解問題"), zone: "research", durationMs: 3_400, dependencies: ["calendar"], toolId: "web.research", kind: "specialist" },
    { id: "document", agentId: "work-document", title: t("Prepare the brief", "準備簡報"), thought: t("Structuring 4 documents", "整理 4 份文件"), completion: t("Briefing draft ready", "簡報草稿已準備"), zone: "external", durationMs: 3_100, dependencies: ["calendar"], toolId: "document.read", kind: "specialist" },
    { id: "synthesise", agentId: "work-coordinator", title: t("Converge the briefing", "匯合會議簡報"), thought: t("Combining evidence and questions", "整合證據與問題"), completion: t("Meeting brief ready", "會議簡報已準備"), zone: "convergence", durationMs: 1_900, dependencies: ["research", "document"], kind: "synthesis" },
    { id: "report", agentId: "work-coordinator", title: t("Return the brief", "帶回簡報"), thought: t("Bringing your briefing", "帶回你的簡報"), completion: t("Ready for review", "可供檢視"), zone: "human", durationMs: 700, dependencies: ["synthesise"], kind: "report" },
  ],
  result: {
    eyebrow: t("Meeting briefing", "會議簡報"), title: t("Tomorrow · Project review", "明天 · 專案檢視"), subtitle: t("A concise demo brief with the important gaps surfaced", "精簡示範簡報，已指出重要缺口"),
    facts: [{ label: t("Documents", "文件"), value: t("4", "4") }, { label: t("Sources", "來源"), value: t("6", "6") }, { label: t("Open questions", "待解問題"), value: t("2", "2") }],
    reasons: [t("Decisions and owners are separated", "已分開決定事項與負責人"), t("Conflicting figures are flagged", "已標示互相衝突的數字"), t("Two questions need your judgment", "兩個問題需要你的判斷")],
    resources: [{ label: t("Time saved", "節省時間"), value: t("~25 min", "約 25 分鐘") }, { label: t("Attention", "注意力"), value: t("2 questions", "2 個問題") }],
    primaryAction: { id: "open-brief", label: t("Review brief", "檢視簡報"), consequential: false },
    secondaryAction: { id: "share-brief", label: t("Share brief", "分享簡報"), consequential: true },
    disclosure: t("Calendar, documents and research are simulated. Nothing was shared.", "日曆、文件及研究均為模擬；沒有分享任何內容。"),
  },
};

const shopping: ScenarioDefinition = {
  id: "shopping", category: "shopping", label: t("Shopping", "購物"), prompt: t("Find me a good monitor under HK$3,000.", "幫我找一部 HK$3,000 以下的好螢幕。"), shortPrompt: t("Compare monitors", "比較螢幕"), icon: "display",
  context: [{ label: t("Budget", "預算"), value: t("HK$3,000", "HK$3,000") }, { label: t("Use", "用途"), value: t("Work · USB-C", "工作 · USB-C"), simulated: true }, { label: t("Priority", "優先"), value: t("Text clarity", "文字清晰度"), simulated: true }],
  agents: [
    agent("shop-coordinator", "Kumo", "Crane", t("Comparison", "比較員"), t("Makes trade-offs legible", "讓取捨一目了然"), art("porcelain", "#d7d6cf", "#bd5e4c", "#353a3b", "#f7f4ec")),
    agent("shop-requirements", "Pip", "Meerkat", t("Requirements", "需求員"), t("Clarifies what matters", "釐清真正重要的條件"), art("desert", "#bb8153", "#e2c07a", "#50362a", "#fff0d5")),
    agent("shop-research", "Lyn", "Lynx", t("Product research", "產品研究員"), t("Finds credible candidates", "找出可信候選產品"), art("editorial", "#a06f55", "#6f8d9a", "#342b2a", "#f0e8df")),
    agent("shop-price", "Patch", "Raccoon", t("Price", "價格員"), t("Checks price and seller conditions", "核實價格與商戶條件"), art("street-map", "#626b69", "#d2aa64", "#2c3433", "#e7ece8")),
  ],
  services: [
    service("requirements.parse", t("Requirements", "需求分析"), t("Local demo preference adapter", "本地示範偏好接頭"), "context", t("27-inch · USB-C · text clarity", "27 吋 · USB-C · 文字清晰")),
    service("product.search", t("Product search", "產品搜尋"), t("Simulated product catalogue", "模擬產品目錄"), "market", t("8 candidates · 3 under budget", "8 個候選 · 3 個低於預算"), 1_020),
    service("price.compare", t("Price comparison", "價格比較"), t("Simulated seller and warranty data", "模擬商戶及保養資料"), "external", t("3 prices verified in demo data", "示範資料中已核實 3 個價格"), 960),
  ],
  tasks: [
    { id: "interpret", agentId: "shop-coordinator", title: t("Understand the purchase", "理解購買需要"), thought: t("Understanding your monitor need", "理解你的螢幕需要"), completion: t("Monitor · under HK$3,000", "螢幕 · HK$3,000 以下"), zone: "human", durationMs: 1_300, dependencies: [], kind: "interpret" },
    { id: "requirements", agentId: "shop-requirements", title: t("Clarify requirements", "釐清需求"), thought: t("Finding the non-negotiables", "找出不可妥協條件"), completion: t("USB-C · 27-inch · clear text", "USB-C · 27 吋 · 文字清晰"), zone: "context", durationMs: 2_400, dependencies: ["interpret"], toolId: "requirements.parse", kind: "specialist" },
    { id: "products", agentId: "shop-research", title: t("Research products", "研究產品"), thought: t("Comparing credible options", "比較可信選擇"), completion: t("3 strong candidates", "3 個合適候選"), zone: "market", durationMs: 3_500, dependencies: ["requirements"], toolId: "product.search", kind: "specialist" },
    { id: "prices", agentId: "shop-price", title: t("Check price and terms", "核實價格及條款"), thought: t("Checking sellers and warranty", "核實商戶與保養"), completion: t("Best value stays under budget", "最高性價比低於預算"), zone: "external", durationMs: 3_300, dependencies: ["requirements"], toolId: "price.compare", kind: "specialist" },
    { id: "synthesise", agentId: "shop-coordinator", title: t("Converge trade-offs", "匯合取捨"), thought: t("Turning options into one shortlist", "把選擇整理成一份名單"), completion: t("Best-fit option ready", "最合適選擇已準備"), zone: "convergence", durationMs: 2_000, dependencies: ["products", "prices"], kind: "synthesis" },
    { id: "report", agentId: "shop-coordinator", title: t("Return the comparison", "帶回比較結果"), thought: t("Bringing back the trade-offs", "帶回取捨比較"), completion: t("Comparison ready", "比較已準備"), zone: "human", durationMs: 700, dependencies: ["synthesise"], kind: "report" },
  ],
  result: {
    eyebrow: t("Monitor shortlist", "螢幕候選"), title: t("27-inch USB-C QHD", "27 吋 USB-C QHD"), subtitle: t("Best demo fit for focused work under your budget", "低於預算、最適合專注工作的示範選擇"),
    facts: [{ label: t("Demo price", "示範價格"), value: t("HK$2,699", "HK$2,699") }, { label: t("Size", "尺寸"), value: t("27 inch", "27 吋") }, { label: t("Connection", "連接"), value: t("USB-C 90W", "USB-C 90W") }],
    reasons: [t("Clear text at normal desk distance", "一般桌面距離下文字清晰"), t("Single-cable laptop setup", "一線連接手提電腦"), t("Budget left for a monitor arm", "仍有預算購買螢幕支架")],
    resources: [{ label: t("Money", "金錢"), value: t("HK$2,699", "HK$2,699") }, { label: t("Options", "選擇"), value: t("3 compared", "已比較 3 個") }, { label: t("Attention", "注意力"), value: t("1 trade-off", "1 項取捨") }],
    primaryAction: { id: "view-comparison", label: t("View comparison", "查看比較"), consequential: false },
    secondaryAction: { id: "buy-monitor", label: t("Buy this", "購買這部") , consequential: true },
    disclosure: t("Product, price, stock and warranty details are simulated. No purchase was made.", "產品、價格、庫存及保養資料均為模擬；沒有進行購買。"),
  },
};

const email: ScenarioDefinition = {
  id: "email", category: "communication", label: t("Email", "電郵"), prompt: t("There's an important email I need to deal with.", "我有一封重要電郵需要處理。"), shortPrompt: t("Handle an important email", "處理重要電郵"), icon: "mail",
  context: [{ label: t("Inbox", "收件箱"), value: t("Demo message", "示範郵件"), simulated: true }, { label: t("From", "來自"), value: t("Project partner", "專案伙伴"), simulated: true }, { label: t("Needed", "需要"), value: t("Decision + reply", "決定 + 回覆"), simulated: true }],
  agents: [
    agent("mail-coordinator", "Maris", "Orca", t("Coordinator", "協調員"), t("Protects intent and approval", "保障意圖與批准權"), art("ocean", "#263f52", "#8ec4ca", "#172835", "#e7f4f3")),
    agent("mail-inbox", "Iris", "Hummingbird", t("Inbox", "收件員"), t("Finds the relevant message", "找出相關郵件"), art("glass", "#3e9b8f", "#d87c8a", "#1e514e", "#e5f6f3")),
    agent("mail-context", "Bramble", "Rabbit", t("Context", "情境員"), t("Connects the message to prior work", "把郵件連結至之前工作"), art("quilt", "#b58d8f", "#d8c27d", "#4f3b43", "#f5ece8")),
    agent("mail-draft", "Sol", "Red panda", t("Draft", "草擬員"), t("Prepares a careful response", "準備審慎回覆"), art("sunrise", "#b7543f", "#e9b967", "#472e2b", "#fff0dc")),
  ],
  services: [
    service("mail.read", t("Inbox", "收件箱"), t("Simulated read-only inbox adapter", "模擬唯讀收件箱接頭"), "communication", t("1 relevant demo message", "1 封相關示範郵件"), 780),
    service("context.retrieve", t("Context", "情境搜尋"), t("Simulated project context adapter", "模擬專案情境接頭"), "research", t("2 related decisions found", "找到 2 項相關決定"), 700),
    service("mail.draft", t("Draft", "草擬"), t("Creates a draft but cannot send", "建立草稿但不能發送"), "planning", t("Draft prepared · not sent", "草稿已準備 · 尚未發送"), 920),
  ],
  tasks: [
    { id: "interpret", agentId: "mail-coordinator", title: t("Understand the communication need", "理解溝通需要"), thought: t("Understanding what needs action", "理解需要採取的行動"), completion: t("Important email · reply needed", "重要電郵 · 需要回覆"), zone: "human", durationMs: 1_300, dependencies: [], kind: "interpret" },
    { id: "inbox", agentId: "mail-inbox", title: t("Find the message", "尋找郵件"), thought: t("Scanning the permitted inbox", "檢查已允許的收件箱"), completion: t("Relevant message found", "已找到相關郵件"), zone: "communication", durationMs: 2_500, dependencies: ["interpret"], toolId: "mail.read", kind: "specialist" },
    { id: "context", agentId: "mail-context", title: t("Recover context", "找回情境"), thought: t("Connecting prior decisions", "連結之前的決定"), completion: t("2 decisions connected", "已連結 2 項決定"), zone: "research", durationMs: 2_900, dependencies: ["inbox"], toolId: "context.retrieve", kind: "specialist" },
    { id: "draft", agentId: "mail-draft", title: t("Prepare a reply", "準備回覆"), thought: t("Drafting without sending", "草擬但不發送"), completion: t("Reply draft ready", "回覆草稿已準備"), zone: "planning", durationMs: 3_100, dependencies: ["inbox"], toolId: "mail.draft", kind: "specialist" },
    { id: "synthesise", agentId: "mail-coordinator", title: t("Converge context and draft", "匯合情境與草稿"), thought: t("Checking tone and intent", "檢查語氣與意圖"), completion: t("Reply ready for approval", "回覆已準備批准"), zone: "convergence", durationMs: 1_900, dependencies: ["context", "draft"], kind: "synthesis" },
    { id: "report", agentId: "mail-coordinator", title: t("Return the draft", "帶回草稿"), thought: t("Bringing the draft to you", "把草稿帶給你"), completion: t("Your review is needed", "需要你的檢視"), zone: "human", durationMs: 700, dependencies: ["synthesise"], kind: "report" },
  ],
  result: {
    eyebrow: t("Reply prepared", "回覆已準備"), title: t("Project timeline confirmation", "專案時間表確認"), subtitle: t("A concise demo reply, held for your approval", "精簡示範回覆，等待你的批准"),
    facts: [{ label: t("Tone", "語氣"), value: t("Clear · warm", "清晰 · 溫和") }, { label: t("Decisions", "決定"), value: t("2 referenced", "引用 2 項") }, { label: t("Status", "狀態"), value: t("Draft only", "僅為草稿") }],
    reasons: [t("Answers the requested decision", "回應所要求的決定"), t("States the revised date clearly", "清楚說明修訂日期"), t("Keeps one open question visible", "保留一項待解問題")],
    resources: [{ label: t("Time saved", "節省時間"), value: t("~12 min", "約 12 分鐘") }, { label: t("Attention", "注意力"), value: t("1 approval", "1 次批准") }],
    primaryAction: { id: "review-draft", label: t("Review draft", "檢視草稿"), consequential: false },
    secondaryAction: { id: "send-email", label: t("Send email", "發送電郵"), consequential: true },
    disclosure: t("Inbox, context and draft are simulated. The email has not been sent.", "收件箱、情境及草稿均為模擬；電郵尚未發送。"),
  },
};

export const SCENARIOS: Record<ScenarioId, ScenarioDefinition> = {
  dinner,
  work,
  shopping,
  email,
};

export const SCENARIO_ORDER: ScenarioId[] = [
  "dinner",
  "work",
  "shopping",
  "email",
];

export function scenarioFor(id: ScenarioId) {
  return SCENARIOS[id];
}

export function classifyScenario(text: string, preferred?: ScenarioId): ScenarioId {
  const value = text.toLowerCase();
  if (/email|mail|reply|respond|inbox|電郵|郵件|回覆/.test(value)) return "email";
  if (/monitor|screen|buy|shop|price|compare|product|螢幕|屏幕|購物|買|價格|比較/.test(value)) return "shopping";
  if (/meeting|brief|document|prepare|tomorrow|會議|文件|準備|明天/.test(value)) return "work";
  if (/dinner|eat|food|restaurant|hungry|晚餐|食|餐廳|肚餓/.test(value)) return "dinner";
  return preferred ?? "work";
}
