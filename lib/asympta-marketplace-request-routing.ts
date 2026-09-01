import type {
  AsymptaCurrentRequest,
  AsymptaCurrentRequestSource,
  AsymptaCurrentRequestStatus,
} from "./asympta-current-request.ts";
import {
  marketplaceCompletionEvidence,
  type ContextEnvelope,
  type MarketplaceExecution,
  type MarketplaceProfileField,
} from "./asympta-marketplace-intent.ts";

export type MarketplaceRequestLocale = "en" | "zh-Hant" | "ja";

export type MarketplaceProfileRequiredDetail = {
  intent: string;
  requestId: string;
  missing: MarketplaceProfileField[];
};

export type MarketplaceProfilePrompt = {
  field: MarketplaceProfileField;
  eyebrow: string;
  question: string;
  hint: string;
};

const PROFILE_FIELD_PRIORITY: MarketplaceProfileField[] = [
  "foodPreference",
  "fulfilmentMethod",
  "paymentMethod",
];

const COPY: Record<MarketplaceRequestLocale, {
  buyFood: string;
  buyClothing: string;
  buyProduct: string;
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
  nextDetail: string;
  questions: Record<MarketplaceProfileField, string>;
  statuses: Record<MarketplaceExecution["status"], string>;
}> = {
  en: {
    buyFood: "Buy food",
    buyClothing: "Buy clothing",
    buyProduct: "Buy a product",
    coordinator: "Marketplace coordinator",
    marketAgents: "Marketplace agents",
    financeAgent: "Finance agent",
    deliveryAgent: "Delivery agent",
    asympta: "Asympta",
    simulatedMarket: "Simulated marketplace",
    userHome: "User home",
    start: "Applying saved preferences and starting the simulated marketplace workflow.",
    profile: "One necessary detail is still missing.",
    failed: "The simulated marketplace workflow could not start.",
    nextDetail: "Choose one option. Asympta will save it, recompile the request and continue automatically.",
    questions: {
      foodPreference: "What kind of food should the agent choose?",
      fulfilmentMethod: "Should your personal agent collect it, or should a courier deliver it?",
      paymentMethod: "Which simulated payment method should this request use?",
    },
    statuses: {
      routing: "Applying the approved profile to the request.",
      travelling_to_market: "The selected agent is travelling to the simulated marketplace.",
      coordinating: "Marketplace, supplier and business agents are completing the request.",
      awaiting_approval: "The simulated payment is ready for approval.",
      returning_to_user: "The selected carrier is bringing the item back to the user.",
      completed: "The requested item was delivered into simulated user inventory.",
      blocked: "The payment decision was recorded. Choose retry or another payment preference.",
    },
  },
  "zh-Hant": {
    buyFood: "購買食物",
    buyClothing: "購買衣服",
    buyProduct: "購買商品",
    coordinator: "市場協調代理",
    marketAgents: "市場代理群",
    financeAgent: "付款代理",
    deliveryAgent: "配送代理",
    asympta: "Asympta",
    simulatedMarket: "模擬市場",
    userHome: "使用者所在地",
    start: "正在套用已儲存偏好並啟動模擬市場流程。",
    profile: "尚欠一項真正需要的資料。",
    failed: "未能啟動模擬市場流程。",
    nextDetail: "只需選擇一項；Asympta 會儲存答案、重新編譯請求，並自動繼續。",
    questions: {
      foodPreference: "今次想讓代理選擇哪一類食物？",
      fulfilmentMethod: "由你的個人代理自取，還是由速遞代理送貨？",
      paymentMethod: "今次模擬交易使用哪一種付款方式？",
    },
    statuses: {
      routing: "正在把已批准偏好套用至請求。",
      travelling_to_market: "指定代理正在前往模擬市場。",
      coordinating: "市場、供應及商戶代理正在完成請求。",
      awaiting_approval: "模擬付款已準備好，等待批准。",
      returning_to_user: "指定配送代理正在把物品帶回使用者。",
      completed: "所需物品已交付至模擬使用者庫存。",
      blocked: "已記錄付款決定；請選擇重試或另一個付款偏好。",
    },
  },
  ja: {
    buyFood: "食べ物を購入",
    buyClothing: "衣服を購入",
    buyProduct: "商品を購入",
    coordinator: "マーケット調整エージェント",
    marketAgents: "マーケットエージェント",
    financeAgent: "支払いエージェント",
    deliveryAgent: "配送エージェント",
    asympta: "Asympta",
    simulatedMarket: "シミュレーション市場",
    userHome: "ユーザーの場所",
    start: "保存済みの設定を適用して、シミュレーション市場を開始します。",
    profile: "実行に必要な情報があと一つあります。",
    failed: "シミュレーション市場を開始できませんでした。",
    nextDetail: "一つ選ぶと、Asympta が保存・再コンパイルして自動的に続行します。",
    questions: {
      foodPreference: "エージェントにどの種類の食事を選ばせますか？",
      fulfilmentMethod: "個人エージェントが受け取りますか、それとも配達しますか？",
      paymentMethod: "今回のシミュレーションで使う支払い方法はどれですか？",
    },
    statuses: {
      routing: "承認済みプロフィールを依頼へ適用しています。",
      travelling_to_market: "選択されたエージェントがシミュレーション市場へ移動中です。",
      coordinating: "市場・供給・店舗エージェントが依頼を処理しています。",
      awaiting_approval: "シミュレーション支払いの承認待ちです。",
      returning_to_user: "配送担当が商品をユーザーへ運んでいます。",
      completed: "商品をシミュレーション上のユーザー在庫へ届けました。",
      blocked: "支払いの判断を記録しました。再試行するか別の支払い方法を選んでください。",
    },
  },
};

export function nextMarketplaceProfileField(missing: readonly MarketplaceProfileField[]) {
  return PROFILE_FIELD_PRIORITY.find((field) => missing.includes(field)) ?? null;
}

export function marketplaceProfilePrompt(
  missing: readonly MarketplaceProfileField[],
  locale: MarketplaceRequestLocale,
): MarketplaceProfilePrompt | null {
  const field = nextMarketplaceProfileField(missing);
  if (!field) return null;
  const copy = COPY[locale];
  return {
    field,
    eyebrow: copy.profile,
    question: copy.questions[field],
    hint: copy.nextDetail,
  };
}

function requestGoal(envelope: ContextEnvelope, locale: MarketplaceRequestLocale) {
  const copy = COPY[locale];
  const domains = [...new Set(envelope.goals.map((goal) => goal.domain))];
  return domains.map((domain) => {
    if (domain === "food") return copy.buyFood;
    if (domain === "clothing") return copy.buyClothing;
    return copy.buyProduct;
  }).join(" + ");
}

function statusForExecution(status: MarketplaceExecution["status"]): AsymptaCurrentRequestStatus {
  if (status === "awaiting_approval") return "awaiting_confirmation";
  if (status === "returning_to_user") return "returning";
  if (status === "completed") return "completed";
  if (status === "blocked") return "waiting_input";
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
  const prompt = marketplaceProfilePrompt(detail.missing, locale);
  const step = prompt?.question ?? copy.profile;
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
    events: prompt ? [prompt.eyebrow, prompt.question] : [copy.profile],
    updatedAt: new Date().toISOString(),
  };
}

export function marketplaceCurrentRequestFromExecution(
  execution: MarketplaceExecution,
  source: AsymptaCurrentRequestSource,
  locale: MarketplaceRequestLocale,
): AsymptaCurrentRequest {
  const copy = COPY[locale];
  const completionVerified = execution.status !== "completed"
    || marketplaceCompletionEvidence(execution).valid;
  const safeExecution = completionVerified
    ? execution
    : { ...execution, status: "coordinating" as const };
  const step = copy.statuses[safeExecution.status];
  return {
    requestId: execution.envelope.requestId,
    source,
    intent: execution.envelope.rawMessage.text,
    goal: requestGoal(execution.envelope, locale),
    kind: "marketplace",
    permission: "WRITE_REQUEST",
    status: statusForExecution(safeExecution.status),
    actor: actorForExecution(safeExecution, locale),
    step,
    destination: destinationForExecution(safeExecution, locale),
    sourceCount: 0,
    verification: safeExecution.status === "completed" ? "verified" : null,
    events: packetEvents(safeExecution, step),
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
