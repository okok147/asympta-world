"use client";

import { useEffect } from "react";

type Locale = "en" | "zh-Hant" | "ja";
type Task = { id: string; title: string; agentId: string; status: string; progress?: number };
type Agent = { id: string; name: string; side: string; role: string; status: string };
type Snapshot = {
  foreground?: {
    phase?: string;
    tasks?: Task[];
    agents?: Agent[];
    pendingApprovals?: unknown[];
  };
  ambient?: unknown[];
};

type Copy = {
  description: string;
  mapLabel: string;
  webMcpActions: string;
  mapScope: string;
  network: string;
  state: string;
  agents: string;
  approval: string;
  world: string;
  city: string;
  closeAgent: string;
  zoomControls: string;
  zoomIn: string;
  zoomOut: string;
  recenter: string;
  clear: string;
  activeNearby: (active: number, nearby: number) => string;
  approvalsWaiting: (count: number) => string;
  carrying: (cargo: string) => string;
  status: Record<string, string>;
  phase: Record<string, string>;
  resources: Record<string, string>;
  roles: Record<string, string>;
  marketplace: Record<string, string>;
};

const COPY: Record<Locale, Copy> = {
  en: {
    description: "Express an intention. Humans, agents and tools coordinate around it.",
    mapLabel: "Interactive paper map with illustrated stakeholder agents and simulated city activity",
    webMcpActions: "WebMCP request actions", mapScope: "Map scope", network: "Network",
    state: "State", agents: "Agents", approval: "Approval", world: "World", city: "City",
    closeAgent: "Close agent", zoomControls: "Map zoom controls", zoomIn: "Zoom in", zoomOut: "Zoom out", recenter: "Recenter map",
    clear: "Clear", activeNearby: (active, nearby) => `${active} active · ${nearby} nearby`, approvalsWaiting: (count) => `${count} waiting`,
    carrying: (cargo) => `Carrying ${cargo}`,
    status: {
      idle: "Ready", queued: "Queued", moving: "Moving", working: "Working", sharing: "Sharing", waiting: "Waiting",
      returning: "Returning", waiting_approval: "Waiting for approval", blocked: "Blocked", done: "Completed",
      interpreting: "Understanding", discovering: "Discovering", coordinating: "Coordinating", waiting_input: "Waiting for input",
      executing: "Executing", verifying: "Verifying", completed: "Completed", failed: "Failed",
    },
    phase: { idle: "Ready", running: "Coordinating", waiting_approval: "Waiting for approval", completed: "Completed", blocked: "Blocked" },
    resources: { food: "Food", material: "Materials", merchandise: "Merchandise", power: "Power", medicine: "Medicine" },
    roles: {
      user: "Personal intent agent", customer: "Customer advocate", business: "Business coordinator", supplier: "Supplier agent",
      operations: "Operations planner", finance: "Finance controller", logistics: "Logistics dispatcher", support: "Service recovery agent",
      quality: "Quality verifier", market: "Market intelligence agent",
    },
    marketplace: {
      context: "Compile Asympta task intent", travel_personal: "Personal agent travels to the marketplace",
      travel_courier: "Courier agent travels to the marketplace", store: "Marketplace agent accepts typed enquiry",
      stock: "Supplier agent checks and reserves simulated stock", offer: "Store agent returns a bounded offer",
      quality: "Verification agent checks context, profile and stock", payment: "Authorise simulated payment",
      handoff: "Store hands the item to the carrier", return: "Carrier brings the item home",
      deliver: "Transfer the item into user inventory", verify: "Verify delivery and close the goal",
    },
  },
  "zh-Hant": {
    description: "說出一個意圖，讓人、代理與工具共同協調完成。",
    mapLabel: "顯示插畫代理與模擬城市活動的互動紙質地圖",
    webMcpActions: "WebMCP 請求操作", mapScope: "地圖範圍", network: "網絡",
    state: "狀態", agents: "代理", approval: "批准", world: "全球", city: "城市",
    closeAgent: "關閉代理資訊", zoomControls: "地圖縮放控制", zoomIn: "放大地圖", zoomOut: "縮小地圖", recenter: "重新置中地圖",
    clear: "無待處理項目", activeNearby: (active, nearby) => `${active} 個活動代理 · ${nearby} 個附近角色`, approvalsWaiting: (count) => `${count} 個等待批准`,
    carrying: (cargo) => `攜帶中：${cargo}`,
    status: {
      idle: "就緒", queued: "排隊中", moving: "移動中", working: "工作中", sharing: "交接中", waiting: "等待中",
      returning: "返回中", waiting_approval: "等待批准", blocked: "已暫停", done: "已完成",
      interpreting: "理解中", discovering: "尋找中", coordinating: "協調中", waiting_input: "等待補充資料",
      executing: "執行中", verifying: "驗證中", completed: "已完成", failed: "未能完成",
    },
    phase: { idle: "就緒", running: "協調中", waiting_approval: "等待批准", completed: "已完成", blocked: "已暫停" },
    resources: { food: "食品", material: "原材料", merchandise: "商品", power: "電力", medicine: "醫療" },
    roles: {
      user: "個人需求代理", customer: "客戶需求代理", business: "商業協調代理", supplier: "供應代理",
      operations: "營運規劃代理", finance: "財務控制代理", logistics: "物流調度代理", support: "服務復原代理",
      quality: "品質驗證代理", market: "市場情報代理",
    },
    marketplace: {
      context: "編譯 Asympta 任務意圖", travel_personal: "個人代理前往市場", travel_courier: "速遞代理前往市場",
      store: "市場代理接收結構化查詢", stock: "供應代理檢查並預留模擬庫存", offer: "商店代理回傳受約束報價",
      quality: "驗證代理檢查語境、偏好與庫存", payment: "授權模擬付款", handoff: "商店把物品交給運送代理",
      return: "運送代理把物品帶回家", deliver: "把物品轉入使用者庫存", verify: "驗證交付並完成目標",
    },
  },
  ja: {
    description: "意図を伝えると、人・エージェント・ツールが連携して実現します。",
    mapLabel: "イラストのエージェントとシミュレーション都市活動を表示するインタラクティブな紙地図",
    webMcpActions: "WebMCP リクエスト操作", mapScope: "地図範囲", network: "ネットワーク",
    state: "状態", agents: "エージェント", approval: "承認", world: "世界", city: "都市",
    closeAgent: "エージェント情報を閉じる", zoomControls: "地図のズーム操作", zoomIn: "地図を拡大", zoomOut: "地図を縮小", recenter: "地図を中央に戻す",
    clear: "保留なし", activeNearby: (active, nearby) => `活動中 ${active} · 周辺 ${nearby}`, approvalsWaiting: (count) => `承認待ち ${count} 件`,
    carrying: (cargo) => `運搬中：${cargo}`,
    status: {
      idle: "準備完了", queued: "待機列", moving: "移動中", working: "作業中", sharing: "共有中", waiting: "待機中",
      returning: "帰還中", waiting_approval: "承認待ち", blocked: "停止中", done: "完了",
      interpreting: "理解中", discovering: "検索中", coordinating: "連携中", waiting_input: "入力待ち",
      executing: "実行中", verifying: "検証中", completed: "完了", failed: "失敗",
    },
    phase: { idle: "準備完了", running: "連携中", waiting_approval: "承認待ち", completed: "完了", blocked: "停止中" },
    resources: { food: "食品", material: "原材料", merchandise: "商品", power: "電力", medicine: "医療" },
    roles: {
      user: "個人意図エージェント", customer: "顧客担当エージェント", business: "ビジネス調整エージェント", supplier: "サプライヤーエージェント",
      operations: "オペレーション計画エージェント", finance: "財務管理エージェント", logistics: "物流配車エージェント", support: "サービス復旧エージェント",
      quality: "品質検証エージェント", market: "市場情報エージェント",
    },
    marketplace: {
      context: "Asympta タスク意図をコンパイル", travel_personal: "個人エージェントが市場へ移動", travel_courier: "配達エージェントが市場へ移動",
      store: "市場エージェントが構造化照会を受信", stock: "供給エージェントがシミュレーション在庫を確認・予約", offer: "店舗エージェントが制約付き提案を返却",
      quality: "検証エージェントが文脈・設定・在庫を確認", payment: "シミュレーション支払いを承認", handoff: "店舗が商品を運搬エージェントへ引き渡し",
      return: "運搬エージェントが商品を自宅へ配送", deliver: "商品をユーザー在庫へ移管", verify: "配達を検証して目標を完了",
    },
  },
};

const KNOWN_ROWS: Array<[string, string, string]> = [
  ["STATE", "狀態", "状態"], ["AGENTS", "代理", "エージェント"], ["APPROVAL", "批准", "承認"],
  ["WEBMCP · READ", "WEBMCP · 讀取", "WEBMCP · 読み取り"], ["WEBMCP · WRITE REQUEST", "WEBMCP · 寫入請求", "WEBMCP · 書き込み要求"],
  ["READ", "讀取", "読み取り"], ["WRITE · REQUEST", "寫入 · 請求", "書き込み · 要求"], ["SIMULATION", "模擬", "シミュレーション"],
  ["Standing by", "待命中", "待機中"], ["Waiting for approval", "等待批准", "承認待ち"],
  ["Turning the intention into a bounded, validated goal.", "正在把意圖轉換成範圍明確、可驗證的目標。", "意図を範囲の明確な検証可能な目標へ変換しています。"],
  ["Searching current sources and checking the safe next step.", "正在搜尋最新資料並檢查安全的下一步。", "最新情報を検索し、安全な次の手順を確認しています。"],
  ["Preparing the requested action without carrying it out.", "正在準備所需行動，但尚未執行。", "依頼された操作を、実行せずに準備しています。"],
  ["Checking the goal and returned evidence.", "正在核對目標與取得的證據。", "目標と返された根拠を確認しています。"],
  ["The action is ready for review and has not been executed.", "行動已準備好供你審核，尚未執行。", "操作は確認できる状態ですが、まだ実行されていません。"],
  ["An intention is required.", "請先輸入你的意圖。", "意図を入力してください。"],
  ["An intention can contain at most 600 characters.", "意圖最多可包含 600 個字元。", "意図は最大 600 文字です。"],
  ["Browser verification is not ready yet.", "瀏覽器驗證尚未準備好。", "ブラウザー認証の準備がまだできていません。"],
  ["Request was interrupted before completion.", "請求在完成前被中斷。", "リクエストは完了前に中断されました。"],
  ["The map could not be loaded.", "未能載入地圖。", "地図を読み込めませんでした。"],
  ["Asympta world bridge is unavailable.", "Asympta World 連接橋目前不可用。", "Asympta World ブリッジを利用できません。"],
  ["Too many requests. Please try again shortly.", "請求過於頻繁，請稍後再試。", "リクエストが多すぎます。しばらくしてから再試行してください。"],
  ["Today's public usage limit has been reached.", "今日公開使用額度已用完。", "本日の公開利用上限に達しました。"],
  ["Human verification failed. Please refresh and try again.", "真人驗證失敗，請重新整理後再試。", "人間による認証に失敗しました。更新して再試行してください。"],
  ["The agent service is temporarily unavailable.", "代理服務暫時不可用。", "エージェントサービスは一時的に利用できません。"],
  ["The public agent returned an unreadable response.", "公開代理回傳了無法讀取的結果。", "公開エージェントから読み取れない応答が返されました。"],
  ["The public agent could not complete the request.", "公開代理未能完成請求。", "公開エージェントはリクエストを完了できませんでした。"],
  ["Verification timed out. Please try again.", "驗證逾時，請再試一次。", "認証がタイムアウトしました。再試行してください。"],
  ["Verification expired. Please try again.", "驗證已過期，請再試一次。", "認証の有効期限が切れました。再試行してください。"],
  ["Open-Meteo geocoding", "Open-Meteo 地理編碼", "Open-Meteo ジオコーディング"],
  ["Open-Meteo forecast", "Open-Meteo 天氣預報", "Open-Meteo 天気予報"],
  ["Location and live weather fields were verified through the Open-Meteo APIs.", "位置及即時天氣欄位已由 Open-Meteo API 驗證。", "位置と現在の気象データを Open-Meteo API で検証しました。"],
];

const KNOWN = new Map<string, [string, string, string]>();
for (const row of KNOWN_ROWS) for (const value of row) KNOWN.set(value, row);
const SOURCE_BY_NODE = new WeakMap<Text, string>();
const ROOTS = [".atlas-console", ".atlas-agent-card", ".atlas-approval", ".atlas-safe-schedule", ".asympta-marketplace-trace", ".asympta-intent-shell", ".map-status"];

function localeFromDocument(): Locale {
  const value = document.documentElement.lang.toLowerCase();
  if (value.startsWith("zh")) return "zh-Hant";
  if (value.startsWith("ja")) return "ja";
  return "en";
}

function localeIndex(locale: Locale) { return locale === "en" ? 0 : locale === "zh-Hant" ? 1 : 2; }

function snapshot(): Snapshot | null {
  try {
    const demo = (window as Window & { __ASYMPTA_DEMO__?: { snapshot: () => unknown } }).__ASYMPTA_DEMO__;
    const value = demo?.snapshot();
    return value && typeof value === "object" ? value as Snapshot : null;
  } catch { return null; }
}

function setText(node: Element | null, value: string, locale: Locale) {
  if (!(node instanceof HTMLElement)) return;
  if (node.textContent !== value) node.textContent = value;
  if (node.lang !== locale) node.lang = locale;
}

function setAttr(node: Element | null, name: string, value: string) {
  if (node instanceof HTMLElement && node.getAttribute(name) !== value) node.setAttribute(name, value);
}

function status(locale: Locale, value: string) {
  return COPY[locale].status[value] ?? (locale === "en" ? value.replaceAll("_", " ") : COPY[locale].status.idle);
}

function marketplaceKey(task: Task) {
  if (task.id === "mp-context") return "context";
  if (task.id.endsWith("-travel")) return task.title.startsWith("Courier") ? "travel_courier" : "travel_personal";
  return ["store", "stock", "offer", "quality", "payment", "handoff", "return", "deliver", "verify"].find((key) => task.id.endsWith(`-${key}`)) ?? null;
}

function syncAgents(locale: Locale, value: Snapshot) {
  const agents = value.foreground?.agents ?? [];
  const tasks = value.foreground?.tasks ?? [];
  for (const agent of agents) {
    const task = tasks.find((candidate) => candidate.agentId === agent.id && ["moving", "working", "waiting_approval", "blocked"].includes(candidate.status));
    const marker = document.querySelector<HTMLElement>(`.animal-map-marker--foreground[data-agent-id="${CSS.escape(agent.id)}"]`);
    if (!marker) continue;
    const role = COPY[locale].roles[agent.side] ?? (locale === "en" ? agent.role : COPY[locale].status.idle);
    const state = task?.status === "waiting_approval" ? COPY[locale].status.waiting_approval
      : task && typeof task.progress === "number" && ["moving", "working"].includes(task.status)
        ? `${status(locale, agent.status)} · ${Math.round(task.progress * 100)}%`
        : status(locale, agent.status);
    const statusNode = marker.querySelector(".animal-map-marker__status-text");
    setText(statusNode, state, locale);
    if (statusNode instanceof HTMLElement) statusNode.dataset.asymptaAmbientStatus = state;
    const key = task ? marketplaceKey(task) : null;
    if (key) {
      const dialogue = COPY[locale].marketplace[key];
      const dialogueNode = marker.querySelector(".animal-map-marker__dialogue");
      setText(dialogueNode, dialogue, locale);
      if (dialogueNode instanceof HTMLElement) dialogueNode.dataset.asymptaLocaleText = dialogue;
    }
    const label = `${agent.name} · ${role} · ${state}`;
    marker.title = label;
    marker.setAttribute("aria-label", label);
  }

  const selected = document.querySelector<HTMLElement>(".animal-map-marker--foreground.is-selected")?.dataset.agentId;
  const selectedTask = selected ? tasks.find((task) => task.agentId === selected && ["moving", "working", "waiting_approval", "blocked"].includes(task.status)) : null;
  const selectedKey = selectedTask ? marketplaceKey(selectedTask) : null;
  if (selectedKey) {
    const node = document.querySelector(".atlas-agent-status span:last-child");
    const text = COPY[locale].marketplace[selectedKey];
    setText(node, text, locale);
    if (node instanceof HTMLElement) node.dataset.asymptaLocalized = text;
  }
}

function resourceKey(node: HTMLElement | null) {
  if (!node) return null;
  const raw = node.textContent?.trim().toLowerCase() ?? "";
  const found = Object.keys(COPY.en.resources).find((key) => [key, ...Object.values(COPY).map((copy) => copy.resources[key].toLowerCase())].includes(raw));
  const key = found ?? node.dataset.asymptaResourceKey ?? null;
  if (key) node.dataset.asymptaResourceKey = key;
  return key;
}

function syncUi(locale: Locale, value: Snapshot | null) {
  const copy = COPY[locale];
  const meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
  if (meta) meta.content = copy.description;
  setAttr(document.querySelector(".map-canvas"), "aria-label", copy.mapLabel);
  setAttr(document.querySelector(".asympta-access-actions"), "aria-label", copy.webMcpActions);
  setAttr(document.querySelector(".asympta-access-map-controls"), "aria-label", copy.mapScope);
  setAttr(document.querySelector(".atlas-card-close"), "aria-label", copy.closeAgent);
  setAttr(document.querySelector(".map-zoom"), "aria-label", copy.zoomControls);
  setAttr(document.querySelector(".map-zoom button:first-child"), "aria-label", copy.zoomIn);
  setAttr(document.querySelector(".map-zoom button:last-child"), "aria-label", copy.zoomOut);
  setAttr(document.querySelector(".map-control--locate"), "aria-label", copy.recenter);

  const readout = document.querySelector(".asympta-access-readout");
  if (readout) {
    setText(readout.querySelector("span:nth-child(1) small"), copy.state, locale);
    setText(readout.querySelector("span:nth-child(2) small"), copy.agents, locale);
    setText(readout.querySelector("span:nth-child(3) small"), copy.approval, locale);
    const phase = value?.foreground?.phase ?? "idle";
    setText(readout.querySelector("span:nth-child(1) strong"), copy.phase[phase] ?? copy.phase.idle, locale);
    const active = value?.foreground?.agents?.filter((agent) => agent.status !== "idle").length ?? 0;
    setText(readout.querySelector("span:nth-child(2) strong"), copy.activeNearby(active, value?.ambient?.length ?? 0), locale);
    const waiting = value?.foreground?.pendingApprovals?.length ?? 0;
    setText(readout.querySelector("span:nth-child(3) strong"), waiting ? copy.approvalsWaiting(waiting) : copy.clear, locale);
  }

  const scale = document.querySelector<HTMLElement>(".asympta-access-map-controls button:first-child span");
  setText(scale, document.documentElement.dataset.asymptaScale === "city" ? copy.city : copy.world, locale);
  setAttr(scale?.closest("button") ?? null, "aria-label", copy.mapScope);
  const resource = document.querySelector<HTMLElement>(".asympta-access-map-controls button:nth-child(2) span");
  const key = resourceKey(resource);
  if (key) setText(resource, copy.resources[key], locale);
  setAttr(resource?.closest("button") ?? null, "aria-label", copy.network);

  document.querySelectorAll<HTMLElement>(".asympta-marketplace-cargo").forEach((badge) => {
    const cargo = badge.closest<HTMLElement>("[data-asympta-cargo]")?.dataset.asymptaCargo;
    if (cargo) badge.setAttribute("aria-label", copy.carrying(cargo));
  });
}

function translateKnown(locale: Locale) {
  const index = localeIndex(locale);
  for (const selector of ROOTS) document.querySelectorAll(selector).forEach((root) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let current = walker.nextNode(); current; current = walker.nextNode()) {
      const node = current as Text;
      const raw = node.nodeValue ?? "";
      const trimmed = raw.trim();
      if (!trimmed) continue;
      const row = KNOWN.get(trimmed) ?? (SOURCE_BY_NODE.has(node) ? KNOWN.get(SOURCE_BY_NODE.get(node) as string) : undefined);
      if (!row) continue;
      SOURCE_BY_NODE.set(node, row[0]);
      const next = `${raw.slice(0, raw.indexOf(trimmed))}${row[index]}${raw.slice(raw.indexOf(trimmed) + trimmed.length)}`;
      if (node.nodeValue !== next) node.nodeValue = next;
    }
  });
  document.querySelectorAll<HTMLElement>("[aria-label], [title]").forEach((node) => {
    for (const name of ["aria-label", "title"] as const) {
      const raw = node.getAttribute(name)?.trim();
      const row = raw ? KNOWN.get(raw) : undefined;
      if (row) node.setAttribute(name, row[index]);
    }
  });
}

function translateWeather(locale: Locale) {
  if (locale === "en") return;
  const answer = document.querySelector<HTMLElement>('.asympta-intent-result[data-kind="weather"] .asympta-intent-result__answer');
  if (!answer) return;
  const source = answer.dataset.asymptaEnglishWeather ?? answer.textContent?.trim() ?? "";
  const match = source.match(/^(.+?) is (.+?) today\. It is (-?\d+(?:\.\d+)?)°C and feels like (-?\d+(?:\.\d+)?)°C, with a high of (-?\d+(?:\.\d+)?)°C and low of (-?\d+(?:\.\d+)?)°C\. Peak rain chance is (\d+)%, humidity (\d+)%, and wind (-?\d+(?:\.\d+)?) km\/h\.$/);
  if (!match) return;
  answer.dataset.asymptaEnglishWeather = source;
  const [, place, condition, temperature, apparent, high, low, rain, humidity, wind] = match;
  const weather: Record<string, [string, string]> = {
    clear: ["晴朗", "晴れ"], "partly cloudy": ["局部多雲", "一部曇り"], overcast: ["密雲", "曇り"], fog: ["有霧", "霧"],
    drizzle: ["毛毛雨", "霧雨"], rain: ["有雨", "雨"], snow: ["有雪", "雪"], showers: ["驟雨", "にわか雨"], thunderstorms: ["雷暴", "雷雨"],
  };
  const label = weather[condition.toLowerCase()] ?? [condition, condition];
  const text = locale === "zh-Hant"
    ? `${place} 今日${label[0]}，現時 ${temperature}°C，體感 ${apparent}°C；最高 ${high}°C、最低 ${low}°C。最高降雨機率 ${rain}%，濕度 ${humidity}%，風速 ${wind} km/h。`
    : `${place}は本日${label[1]}。現在 ${temperature}°C、体感 ${apparent}°C、最高 ${high}°C、最低 ${low}°Cです。最大降水確率 ${rain}%、湿度 ${humidity}%、風速 ${wind} km/hです。`;
  setText(answer, text, locale);
}

export function AsymptaCompleteLocale() {
  useEffect(() => {
    let frame = 0;
    const sync = () => {
      frame = 0;
      if (document.hidden) return;
      const locale = localeFromDocument();
      if (document.documentElement.dir !== "ltr") document.documentElement.dir = "ltr";
      if (document.documentElement.dataset.asymptaLocale !== locale) document.documentElement.dataset.asymptaLocale = locale;
      const value = snapshot();
      if (value) syncAgents(locale, value);
      syncUi(locale, value);
      translateKnown(locale);
      translateWeather(locale);
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(sync);
    };
    queueMicrotask(sync);
    const timer = window.setInterval(sync, 240);
    const observer = new MutationObserver(schedule);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang", "data-asympta-scale"] });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    window.addEventListener("asympta:activity", schedule);
    window.addEventListener("asympta:marketplace-execution", schedule);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.clearInterval(timer);
      observer.disconnect();
      window.removeEventListener("asympta:activity", schedule);
      window.removeEventListener("asympta:marketplace-execution", schedule);
    };
  }, []);
  return null;
}
