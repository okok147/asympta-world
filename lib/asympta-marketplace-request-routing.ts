import type {
  AsymptaCurrentRequest,
  AsymptaCurrentRequestSource,
  AsymptaCurrentRequestStatus,
} from "./asympta-current-request.ts";
import type {
  ContextEnvelope,
  MarketplaceExecution,
  MarketplaceProfileField,
} from "./asympta-marketplace-intent.ts";

export type MarketplaceRequestLocale = "en" | "zh-Hant" | "ja";

export type MarketplaceProfileRequiredDetail = {
  intent: string;
  requestId: string;
  missing: MarketplaceProfileField[];
};

const COPY: Record<MarketplaceRequestLocale, {
  buyFood: string;
  buyClothing: string;
  coordinator: string;
  marketAgents: string;
  financeAgent: string;
  deliveryAgent: string;
  asympta: string;
  simulatedMarket: string;
  userHome: string;
  start: string;
  profile: string;
  failed: string;
  statuses: Record<MarketplaceExecution["status"], string>;
  fields: Record<MarketplaceProfileField, string>;
}> = {
  en: {
    buyFood: "Buy food",
    buyClothing: "Buy clothing",
    coordinator: "Marketplace coordinator",
    marketAgents: "Marketplace agents",
    financeAgent: "Finance agent",
    deliveryAgent: "Delivery agent",
    asympta: "Asympta",
    simulatedMarket: "Simulated marketplace",
    userHome: "User home",
    start: "Applying saved preferences and starting the simulated marketplace workflow.",
    profile: "Choose the missing marketplace preferences to continue.",
    failed: "The simulated marketplace workflow could not start.",
    statuses: {
      routing: "Applying the approved profile to the request.",
      travelling_to_market: "The selected agent is travelling to the simulated marketplace.",
      coordinating: "Marketplace, supplier and business agents are completing the request.",
      awaiting_approval: "The simulated payment is ready for approval.",
      returning_to_user: "The selected carrier is bringing the item back to the user.",
      completed: "The requested item was delivered into simulated user inventory.",
      blocked: "The simulated marketplace workflow was stopped.",
    },
    fields: {
      foodPreference: "food preference",
      fulfilmentMethod: "delivery method",
      paymentMethod: "payment method",
    },
  },
  "zh-Hant": {
    buyFood: "購買食物",
    buyClothing: "購買衣服",
    coordinator: "市場協調代理",
    marketAgents: "市場代理群",
    financeAgent: "付款代理",
    deliveryAgent: "配送代理",
    asympta: "Asympta",
    simulatedMarket: "模擬市場",
    userHome: "使用者所在地",
    start: "正在套用已儲存偏好並啟動模擬市場流程。",
    profile: "選擇尚欠的市場偏好後便會繼續。",
    failed: "未能啟動模擬市場流程。",
    statuses: {
      routing: "正在把已批准偏好套用至請求。",
      travelling_to_market: "指定代理正在前往模擬市場。",
      coordinating: "市場、供應及商戶代理正在完成請求。",
      awaiting_approval: "模擬付款已準備好，等待批准。",
      returning_to_user: "指定配送代理正在把物品帶回使用者。",
      completed: "所需物品已交付至模擬使用者庫存。",
      blocked: "模擬市場流程已停止。",
    },
    fields: {
      foodPreference: "食物偏好",
      fulfilmentMethod: "配送方式",
      paymentMethod: "付款方式",
    },
  },
  ja: {
    buyFood: "食べ物を購入",
    buyClothing: "衣服を購入",
    coordinator: "マーケット調整エージェント",
    marketAgents: "マーケットエージェント",
    financeAgent: "支払いエージェント",
    deliveryAgent: "配送エージェント",
    asympta: "Asympta",
    simulatedMarket: "シミュレーション市場",
    userHome: "ユーザーの場所",
    start: "保存済みの設定を適用して、シミュレーション市場を開始します。",
    profile: "不足しているマーケット設定を選ぶと続行します。",
    failed: "シミュレーション市場を開始できませんでした。",
    statuses: {
      routing: "承認済みプロフィールを依頼へ適用しています。",
      travelling_to_market: "選択されたエージェントがシミュレーション市場へ移動中です。",
      coordinating: "市場・供給・店舗エージェントが依頼を処理しています。",
      awaiting_approval: "シミュレーション支払いの承認待ちです。",
      returning_to_user: "配送担当が商品をユーザーへ運んでいます。",
      completed: "商品をシミュレーション上のユーザー在庫へ届けました。",
      blocked: "シミュレーション市場を停止しました。",
    },
    fields: {
      foodPreference: "食事の好み",
      fulfilmentMethod: "受取方法",
      paymentMethod: "支払い方法",
    },
  },
};

function requestGoal(envelope: ContextEnvelope, locale: MarketplaceRequestLocale) {
  const copy = COPY[locale];
  const domains = [...new Set(envelope.goals.map((goal) => goal.domain))];
  return domains.map((domain) => domain === "food" ? copy.buyFood : copy.buyClothing).join(" + ");
}

function statusForExecution(status: MarketplaceExecution["status"]): AsymptaCurrentRequestStatus {
  if (status === "awaiting_approval") return "awaiting_confirmation";
  if (status === "returning_to_user") return "returning";
  if (status === "completed") return "completed";
  if (status === "blocked") return "failed";
  return "gathering";
}

function actorForExecution(execution: MarketplaceExecution, locale: MarketplaceRequestLocale) {
  const copy = COPY[locale];
  if (execution.status === "awaiting_approval") return copy.financeAgent;
  if (execution.status === "returning_to_user") return copy.deliveryAgent;
  if (execution.status === "completed" || execution.status === "blocked") return copy.asympta;
  return execution.status === "routing" ? copy.coordinator : copy.marketAgents;
}

function destinationForExecution(execution: MarketplaceExecution, locale: MarketplaceRequestLocale) {
  const copy = COPY[locale];
  return ["returning_to_user", "completed"].includes(execution.status)
    ? copy.userHome
    : copy.simulatedMarket;
}

function packetEvents(execution: MarketplaceExecution, fallback: string) {
  const events = execution.packets.slice(-3).map((packet) => (
    `${packet.from} → ${packet.to} · ${packet.kind.replaceAll("_", " ")}`
  ));
  return events.length ? events : [fallback];
}

export function marketplaceCurrentRequestForStart(
  envelope: ContextEnvelope,
  source: AsymptaCurrentRequestSource,
  locale: MarketplaceRequestLocale,
): AsymptaCurrentRequest {
  const copy = COPY[locale];
  return {
    requestId: envelope.requestId,
    source,
    intent: envelope.rawMessage.text,
    goal: requestGoal(envelope, locale),
    kind: "marketplace",
    permission: "WRITE_REQUEST",
    status: "gathering",
    actor: copy.coordinator,
    step: copy.start,
    destination: copy.simulatedMarket,
    sourceCount: 0,
    verification: null,
    events: [copy.start],
    updatedAt: new Date().toISOString(),
  };
}

export function marketplaceCurrentRequestForProfile(
  detail: MarketplaceProfileRequiredDetail,
  source: AsymptaCurrentRequestSource,
  locale: MarketplaceRequestLocale,
): AsymptaCurrentRequest {
  const copy = COPY[locale];
  const missing = detail.missing.map((field) => copy.fields[field]).join(" · ");
  const step = missing ? `${copy.profile} ${missing}` : copy.profile;
  return {
    requestId: detail.requestId,
    source,
    intent: detail.intent,
    goal: null,
    kind: "marketplace",
    permission: "WRITE_REQUEST",
    status: "waiting_input",
    actor: copy.coordinator,
    step,
    destination: copy.simulatedMarket,
    sourceCount: 0,
    verification: null,
    events: [step],
    updatedAt: new Date().toISOString(),
  };
}

export function marketplaceCurrentRequestFromExecution(
  execution: MarketplaceExecution,
  source: AsymptaCurrentRequestSource,
  locale: MarketplaceRequestLocale,
): AsymptaCurrentRequest {
  const copy = COPY[locale];
  const step = copy.statuses[execution.status];
  return {
    requestId: execution.envelope.requestId,
    source,
    intent: execution.envelope.rawMessage.text,
    goal: requestGoal(execution.envelope, locale),
    kind: "marketplace",
    permission: "WRITE_REQUEST",
    status: statusForExecution(execution.status),
    actor: actorForExecution(execution, locale),
    step,
    destination: destinationForExecution(execution, locale),
    sourceCount: 0,
    verification: execution.status === "completed" ? "verified" : null,
    events: packetEvents(execution, step),
    updatedAt: new Date().toISOString(),
  };
}

export function marketplaceCurrentRequestForFailure(
  envelope: ContextEnvelope,
  source: AsymptaCurrentRequestSource,
  locale: MarketplaceRequestLocale,
  message?: string,
): AsymptaCurrentRequest {
  const copy = COPY[locale];
  const step = message?.trim() || copy.failed;
  return {
    ...marketplaceCurrentRequestForStart(envelope, source, locale),
    status: "failed",
    actor: copy.asympta,
    step,
    verification: "not_verified",
    events: [step],
    updatedAt: new Date().toISOString(),
  };
}
