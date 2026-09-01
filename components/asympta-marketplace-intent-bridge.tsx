"use client";

import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Code2,
  Package,
  RotateCcw,
  ShieldCheck,
  Store,
  Truck,
  Utensils,
  WalletCards,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import styles from "./asympta-marketplace-intent-bridge.module.css";

import {
  subscribeAsymptaCurrentRequest,
  type AsymptaCurrentRequest,
} from "@/lib/asympta-current-request";
import {
  MARKETPLACE_CONTEXT_EVENT,
  MARKETPLACE_EXECUTION_EVENT,
  MARKETPLACE_PROFILE_PRESETS,
  MARKETPLACE_PROFILE_REQUIRED_EVENT,
  MARKETPLACE_WORKFLOW_ID,
  compactContextEnvelope,
  compileAsymptaContext,
  createMarketplaceExecution,
  isMarketplaceProfileComplete,
  marketplaceProfilePreset,
  patchMarketplaceProfile,
  syncMarketplaceExecution,
  upsertMarketplaceWorkflow,
  type AsymptaMarketplaceProfile,
  type ContextCompilation,
  type MarketplaceExecution,
  type MarketplaceFoodPreference,
  type MarketplaceFulfilmentMethod,
  type MarketplacePaymentMethod,
  type MarketplaceProfileField,
  type MarketplaceProfilePresetId,
  type MarketplaceWorldSnapshot,
} from "@/lib/asympta-marketplace-intent";
import {
  readAsymptaMarketplaceProfile,
  subscribeAsymptaUserPreferences,
  writeAsymptaMarketplaceProfile,
} from "@/lib/asympta-user-preferences";
import type { WorkflowId } from "@/lib/atlas-simulation";

type Locale = "en" | "zh-Hant" | "ja";
type PresetId = Exclude<MarketplaceProfilePresetId, "custom">;

type ActivityDetail = {
  activity?: {
    id?: string;
    intent?: string;
    status?: string;
  };
  event?: {
    status?: string;
  };
};

type DemoBridge = {
  snapshot: () => unknown;
  startWorkflow: (workflowId: WorkflowId) => unknown;
  advance: (milliseconds: number) => unknown;
  approve: (approvalId: string, approved: boolean) => unknown;
};

type MarketplaceBridge = {
  compile: (intent: string) => ContextCompilation;
  runIntent: (intent: string, requestId?: string) => Promise<MarketplaceExecution | null>;
  snapshot: () => MarketplaceExecution | null;
  profile: () => AsymptaMarketplaceProfile | null;
};

type PendingMarketplaceIntent = {
  intent: string;
  requestId: string;
  missing: MarketplaceProfileField[];
};

declare global {
  interface Window {
    __ASYMPTA_DEMO__?: DemoBridge;
    __ASYMPTA_MARKETPLACE__?: MarketplaceBridge;
  }
}

const FOOD_OPTIONS: MarketplaceFoodPreference[] = [
  "no_preference",
  "local_cantonese",
  "japanese",
  "western_comfort",
  "vegetarian",
];
const FULFILMENT_OPTIONS: MarketplaceFulfilmentMethod[] = ["personal_agent_pickup", "courier_delivery"];
const PAYMENT_OPTIONS: MarketplacePaymentMethod[] = ["asympta_wallet", "card_on_file", "pay_on_delivery"];

const COPY: Record<Locale, {
  title: string;
  simulated: string;
  context: string;
  latestPacket: string;
  market: string;
  reserved: string;
  carrying: string;
  delivered: string;
  setupRequired: string;
  profileReady: string;
  profileTitle: string;
  profileIntro: string;
  presetTitle: string;
  customTitle: string;
  food: string;
  fulfilment: string;
  payment: string;
  saveContinue: string;
  saveProfile: string;
  editProfile: string;
  safeProfile: string;
  currentProfile: string;
  recoveryTitle: string;
  recoveryDetail: string;
  retryRequest: string;
  changePayment: string;
  route: [string, string, string, string, string];
  status: Record<MarketplaceExecution["status"], string>;
  packet: Record<string, string>;
  presets: Record<PresetId, { name: string; detail: string }>;
  foodOptions: Record<MarketplaceFoodPreference, string>;
  fulfilmentOptions: Record<MarketplaceFulfilmentMethod, string>;
  paymentOptions: Record<MarketplacePaymentMethod, string>;
  error: string;
}> = {
  en: {
    title: "Marketplace context",
    simulated: "Simulated city · engine state",
    context: "Asympta context",
    latestPacket: "Latest structured packet",
    market: "market",
    reserved: "reserved",
    carrying: "carrying",
    delivered: "delivered",
    setupRequired: "Choose your defaults to continue",
    profileReady: "Saved preferences ready",
    profileTitle: "Your marketplace profile",
    profileIntro: "Use one preset, or choose food, fulfilment and payment defaults. Explicit words in a request always override this profile.",
    presetTitle: "Presets",
    customTitle: "Choose individually",
    food: "Food",
    fulfilment: "Fulfilment",
    payment: "Payment",
    saveContinue: "Save and continue",
    saveProfile: "Save profile",
    editProfile: "Edit profile",
    safeProfile: "Only preference aliases are stored. No address or card number is saved, and every simulated payment still requires approval.",
    currentProfile: "Current profile",
    recoveryTitle: "Choose how to continue",
    recoveryDetail: "The simulated payment was declined. Nothing was charged or ordered; retry the same request or select another payment preference.",
    retryRequest: "Retry request",
    changePayment: "Change payment",
    route: ["Intent", "Market", "Store", "Approval", "Home"],
    status: {
      routing: "Compiling a bounded request…",
      travelling_to_market: "The selected agent is going to the marketplace…",
      coordinating: "Marketplace agents are exchanging structured packets…",
      awaiting_approval: "Waiting for simulated payment approval.",
      returning_to_user: "The selected agent is carrying the item home…",
      completed: "Delivered into user inventory.",
      blocked: "Your decision is recorded. Choose how to continue.",
    },
    packet: {
      intent: "Intent",
      context_envelope: "Context envelope",
      enquiry: "Enquiry",
      availability: "Availability",
      offer: "Offer",
      verification: "Verification",
      approval_request: "Approval request",
      payment_authorized: "Payment authorised",
      goods_handoff: "Goods handoff",
      delivery_receipt: "Delivery receipt",
      blocked: "Decision recorded",
    },
    presets: {
      everyday: { name: "Everyday", detail: "Anything suitable · personal agent · Asympta Wallet" },
      local_delivery: { name: "Local delivery", detail: "Cantonese food · courier · card on file" },
      plant_friendly: { name: "Plant-friendly", detail: "Vegetarian · courier · Asympta Wallet" },
    },
    foodOptions: {
      no_preference: "Anything suitable",
      local_cantonese: "Cantonese / local",
      japanese: "Japanese",
      western_comfort: "Western comfort",
      vegetarian: "Vegetarian",
    },
    fulfilmentOptions: {
      personal_agent_pickup: "Personal agent pickup",
      courier_delivery: "Courier delivery",
    },
    paymentOptions: {
      asympta_wallet: "Asympta Wallet",
      card_on_file: "Card on file",
      pay_on_delivery: "Pay on delivery",
    },
    error: "The marketplace engine could not start.",
  },
  "zh-Hant": {
    title: "市場語境",
    simulated: "模擬城市 · 引擎狀態",
    context: "Asympta 語境",
    latestPacket: "最新結構化封包",
    market: "市場",
    reserved: "已預留",
    carrying: "攜帶中",
    delivered: "已交付",
    setupRequired: "選擇預設偏好後繼續",
    profileReady: "已儲存偏好",
    profileTitle: "你的市場偏好",
    profileIntro: "選擇一個預設，或分別設定食物、配送及付款偏好。每次請求中的明確說法永遠優先。",
    presetTitle: "預設組合",
    customTitle: "逐項選擇",
    food: "食物",
    fulfilment: "配送",
    payment: "付款",
    saveContinue: "儲存並繼續",
    saveProfile: "儲存偏好",
    editProfile: "修改偏好",
    safeProfile: "只會儲存偏好代號，不會儲存地址或卡號；每次模擬付款仍須另外批准。",
    currentProfile: "目前偏好",
    recoveryTitle: "選擇下一步",
    recoveryDetail: "模擬付款已被拒絕；沒有扣款或建立訂單。你可以重試同一請求，或選擇另一個付款偏好。",
    retryRequest: "重試請求",
    changePayment: "更改付款方式",
    route: ["意圖", "市場", "商店", "批准", "回家"],
    status: {
      routing: "正在把自然語言編譯成受約束的請求…",
      travelling_to_market: "指定代理正在前往市場…",
      coordinating: "市場代理正在交換結構化封包…",
      awaiting_approval: "等待批准模擬付款。",
      returning_to_user: "指定代理正攜帶物品回家…",
      completed: "物品已轉入使用者庫存。",
      blocked: "已記錄你的決定；請選擇下一步。",
    },
    packet: {
      intent: "意圖",
      context_envelope: "語境封包",
      enquiry: "查詢",
      availability: "庫存回覆",
      offer: "報價",
      verification: "驗證",
      approval_request: "批准請求",
      payment_authorized: "付款已批准",
      goods_handoff: "貨物交接",
      delivery_receipt: "交付收據",
      blocked: "已記錄決定",
    },
    presets: {
      everyday: { name: "日常", detail: "合適即可 · 個人代理自取 · Asympta 錢包" },
      local_delivery: { name: "本地送貨", detail: "港式食物 · 速遞 · 已登記卡" },
      plant_friendly: { name: "素食友善", detail: "素食 · 速遞 · Asympta 錢包" },
    },
    foodOptions: {
      no_preference: "合適即可",
      local_cantonese: "港式／粵菜",
      japanese: "日式",
      western_comfort: "西式家常",
      vegetarian: "素食",
    },
    fulfilmentOptions: {
      personal_agent_pickup: "個人代理自取",
      courier_delivery: "速遞送貨",
    },
    paymentOptions: {
      asympta_wallet: "Asympta 錢包",
      card_on_file: "已登記卡",
      pay_on_delivery: "貨到付款",
    },
    error: "未能啟動市場執行引擎。",
  },
  ja: {
    title: "マーケット文脈",
    simulated: "シミュレーション都市 · エンジン状態",
    context: "Asympta コンテキスト",
    latestPacket: "最新の構造化パケット",
    market: "市場",
    reserved: "予約済み",
    carrying: "運搬中",
    delivered: "配達済み",
    setupRequired: "既定の好みを選んで続行",
    profileReady: "保存済みの好み",
    profileTitle: "マーケットプロフィール",
    profileIntro: "プリセットを選ぶか、食事・受取方法・支払い方法を個別に設定します。依頼内の明示的な指定が常に優先されます。",
    presetTitle: "プリセット",
    customTitle: "個別に選択",
    food: "食事",
    fulfilment: "受取方法",
    payment: "支払い",
    saveContinue: "保存して続行",
    saveProfile: "プロフィールを保存",
    editProfile: "プロフィールを編集",
    safeProfile: "保存するのは好みの識別子だけです。住所やカード番号は保存せず、シミュレーション支払いには毎回承認が必要です。",
    currentProfile: "現在のプロフィール",
    recoveryTitle: "続行方法を選択",
    recoveryDetail: "シミュレーション支払いは拒否されました。請求や注文は発生していません。同じ依頼を再試行するか、別の支払い方法を選べます。",
    retryRequest: "依頼を再試行",
    changePayment: "支払い方法を変更",
    route: ["意図", "市場", "店舗", "承認", "帰宅"],
    status: {
      routing: "自然言語を制約付きリクエストへ変換中…",
      travelling_to_market: "選択されたエージェントが市場へ移動中…",
      coordinating: "市場エージェントが構造化パケットを交換中…",
      awaiting_approval: "シミュレーション支払いの承認待ちです。",
      returning_to_user: "選択されたエージェントが品物を運搬中…",
      completed: "ユーザー在庫へ引き渡しました。",
      blocked: "判断を記録しました。続行方法を選んでください。",
    },
    packet: {
      intent: "意図",
      context_envelope: "コンテキスト封筒",
      enquiry: "問い合わせ",
      availability: "在庫回答",
      offer: "提案",
      verification: "検証",
      approval_request: "承認要求",
      payment_authorized: "支払い承認済み",
      goods_handoff: "商品引き渡し",
      delivery_receipt: "配達受領",
      blocked: "判断を記録",
    },
    presets: {
      everyday: { name: "日常", detail: "おまかせ · 個人エージェント受取 · Asympta Wallet" },
      local_delivery: { name: "ローカル配達", detail: "広東料理 · 配達 · 登録カード" },
      plant_friendly: { name: "植物性", detail: "ベジタリアン · 配達 · Asympta Wallet" },
    },
    foodOptions: {
      no_preference: "おまかせ",
      local_cantonese: "広東／ローカル",
      japanese: "日本食",
      western_comfort: "洋食",
      vegetarian: "ベジタリアン",
    },
    fulfilmentOptions: {
      personal_agent_pickup: "個人エージェント受取",
      courier_delivery: "配達",
    },
    paymentOptions: {
      asympta_wallet: "Asympta Wallet",
      card_on_file: "登録カード",
      pay_on_delivery: "代引き",
    },
    error: "市場実行エンジンを開始できませんでした。",
  },
};

function localeFromDocument(): Locale {
  const value = document.documentElement.lang.toLowerCase();
  if (value.startsWith("zh")) return "zh-Hant";
  if (value.startsWith("ja")) return "ja";
  return "en";
}

function cloneExecution(execution: MarketplaceExecution | null) {
  return execution ? JSON.parse(JSON.stringify(execution)) as MarketplaceExecution : null;
}

function normalizeWorldSnapshot(value: unknown): MarketplaceWorldSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const root = value as Record<string, unknown>;
  const candidate = root.foreground && typeof root.foreground === "object"
    ? root.foreground as Record<string, unknown>
    : root;
  if (!Array.isArray(candidate.tasks)) return null;
  return candidate as MarketplaceWorldSnapshot;
}

function waitForDemoBridge(signal: AbortSignal) {
  return new Promise<DemoBridge>((resolve, reject) => {
    let frame = 0;
    const check = () => {
      if (signal.aborted) {
        reject(new DOMException("Aborted", "AbortError"));
        return;
      }
      if (window.__ASYMPTA_DEMO__) {
        resolve(window.__ASYMPTA_DEMO__);
        return;
      }
      frame += 1;
      if (frame > 240) {
        reject(new Error("Asympta world bridge is unavailable."));
        return;
      }
      window.requestAnimationFrame(check);
    };
    check();
  });
}

function publishExecution(execution: MarketplaceExecution) {
  window.dispatchEvent(new CustomEvent<MarketplaceExecution>(MARKETPLACE_EXECUTION_EVENT, {
    detail: cloneExecution(execution) as MarketplaceExecution,
  }));
}

function cargoDescription(execution: MarketplaceExecution, agentId: string) {
  return execution.ledger
    .filter((line) => line.carrierAgentId === agentId && line.carrierCargo > 0)
    .map((line) => `${line.carrierCargo} × ${line.itemLabel}`)
    .join(", ");
}

function syncCargoMarker(execution: MarketplaceExecution | null) {
  for (const agentId of ["agent-user", "agent-logistics"] as const) {
    const marker = document.querySelector<HTMLElement>(`.animal-map-marker--foreground[data-agent-id="${agentId}"]`);
    if (!marker) continue;
    const cargo = execution ? cargoDescription(execution, agentId) : "";
    let badge = marker.querySelector<HTMLElement>(".asympta-marketplace-cargo");
    if (!cargo) {
      badge?.remove();
      delete marker.dataset.asymptaCargo;
      continue;
    }
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "asympta-marketplace-cargo";
      marker.appendChild(badge);
    }
    const total = execution?.ledger
      .filter((line) => line.carrierAgentId === agentId)
      .reduce((sum, line) => sum + line.carrierCargo, 0) ?? 0;
    badge.textContent = `×${total}`;
    badge.title = cargo;
    badge.setAttribute("aria-label", `Carrying ${cargo}`);
    marker.dataset.asymptaCargo = cargo;
  }
}

function workflowStage(execution: MarketplaceExecution, index: number) {
  const hasContext = execution.packets.some((packet) => packet.kind === "context_envelope");
  const hasMarketArrival = execution.transactions.some((transaction) => transaction.status !== "planned");
  const hasStoreDecision = execution.transactions.some((transaction) => [
    "offer_ready",
    "awaiting_approval",
    "authorized",
    "goods_collected",
    "returning_to_user",
    "delivered",
    "completed",
  ].includes(transaction.status));
  const hasApproval = execution.transactions.some((transaction) => [
    "authorized",
    "goods_collected",
    "returning_to_user",
    "delivered",
    "completed",
  ].includes(transaction.status));
  const delivered = execution.transactions.every((transaction) => ["delivered", "completed"].includes(transaction.status));
  const done = [hasContext, hasMarketArrival, hasStoreDecision, hasApproval, delivered];

  if (done[index]) return "done";
  const firstUndone = done.findIndex((value) => !value);
  return index === firstUndone ? "active" : "pending";
}

function profileSummary(profile: AsymptaMarketplaceProfile, locale: Locale) {
  const copy = COPY[locale];
  if (!profile.foodPreference || !profile.fulfilmentMethod || !profile.paymentMethod) return copy.setupRequired;
  return [
    copy.foodOptions[profile.foodPreference],
    copy.fulfilmentOptions[profile.fulfilmentMethod],
    copy.paymentOptions[profile.paymentMethod],
  ].join(" · ");
}

function presetSelected(profile: AsymptaMarketplaceProfile | null, presetId: PresetId) {
  const preset = MARKETPLACE_PROFILE_PRESETS.find((candidate) => candidate.id === presetId);
  return Boolean(
    profile
    && preset
    && profile.foodPreference === preset.foodPreference
    && profile.fulfilmentMethod === preset.fulfilmentMethod
    && profile.paymentMethod === preset.paymentMethod,
  );
}

export function AsymptaMarketplaceIntentBridge() {
  const [locale, setLocale] = useState<Locale>("en");
  const [execution, setExecution] = useState<MarketplaceExecution | null>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [profile, setProfile] = useState<AsymptaMarketplaceProfile | null>(null);
  const [draftProfile, setDraftProfile] = useState<AsymptaMarketplaceProfile | null>(null);
  const [pendingIntent, setPendingIntent] = useState<PendingMarketplaceIntent | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [panelExpanded, setPanelExpanded] = useState(false);
  const executionRef = useRef<MarketplaceExecution | null>(null);
  const profileRef = useRef<AsymptaMarketplaceProfile | null>(null);
  const seenRequestsRef = useRef(new Set<string>());
  const generationRef = useRef(0);
  const runControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const syncLocale = () => setLocale(localeFromDocument());
    queueMicrotask(syncLocale);
    const observer = new MutationObserver(syncLocale);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const stored = readAsymptaMarketplaceProfile();
    profileRef.current = stored;
    setProfile(stored);
    setDraftProfile(stored);
    return subscribeAsymptaUserPreferences((preferences) => {
      profileRef.current = preferences.marketplaceProfile;
      setProfile(preferences.marketplaceProfile);
      if (!editingProfile) setDraftProfile(preferences.marketplaceProfile);
    });
  }, [editingProfile]);

  useEffect(() => {
    const findHost = () => {
      const requestCard = document.querySelector<HTMLElement>(".atlas-safe-schedule.asympta-request-card");
      const next = requestCard ?? document.body;
      setHost((current) => current === next ? current : next);
    };
    findHost();
    const observer = new MutationObserver(findHost);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!host?.matches(".atlas-safe-schedule.asympta-request-card")) return;
    host.dataset.asymptaMarketplaceHost = "true";
    return () => { delete host.dataset.asymptaMarketplaceHost; };
  }, [host]);

  const executeCompilation = useCallback(async (compilation: ContextCompilation) => {
    if (!compilation.supported || !compilation.envelope) return null;
    generationRef.current += 1;
    const generation = generationRef.current;
    runControllerRef.current?.abort();
    const controller = new AbortController();
    runControllerRef.current = controller;
    setRuntimeError(null);
    setPendingIntent(null);
    setEditingProfile(false);
    // A required choice is a temporary interruption. Once the canonical world
    // actually starts, return visual focus to the agents and map; the trace can
    // still be opened manually for inspection.
    setPanelExpanded(false);

    upsertMarketplaceWorkflow(compilation.envelope);
    let next = createMarketplaceExecution(compilation.envelope);
    executionRef.current = next;
    setExecution(next);
    syncCargoMarker(next);
    window.dispatchEvent(new CustomEvent(MARKETPLACE_CONTEXT_EVENT, {
      detail: compactContextEnvelope(compilation.envelope),
    }));
    publishExecution(next);

    try {
      const demo = await waitForDemoBridge(controller.signal);
      if (generation !== generationRef.current || controller.signal.aborted) return null;
      const started = normalizeWorldSnapshot(demo.startWorkflow(MARKETPLACE_WORKFLOW_ID));
      if (started) next = syncMarketplaceExecution(next, started);
      executionRef.current = next;
      setExecution(next);
      syncCargoMarker(next);
      publishExecution(next);
      return cloneExecution(next);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return null;
      setRuntimeError(error instanceof Error ? error.message : COPY[locale].error);
      return null;
    }
  }, [locale]);

  const runIntent = useCallback(async (intent: string, requestId?: string) => {
    const clean = intent.replace(/\s+/g, " ").trim();
    const currentProfile = readAsymptaMarketplaceProfile();
    profileRef.current = currentProfile;
    setProfile(currentProfile);
    setDraftProfile(currentProfile);
    const compilation = compileAsymptaContext(clean, {
      requestId,
      conversationId: requestId,
      locale,
      now: Date.now(),
      profile: currentProfile,
    });
    if (!compilation.supported || !compilation.envelope) return null;

    if (compilation.profileRequirements.missing.length) {
      generationRef.current += 1;
      runControllerRef.current?.abort();
      runControllerRef.current = null;
      executionRef.current = null;
      setExecution(null);
      syncCargoMarker(null);
      const pending = {
        intent: clean,
        requestId: compilation.envelope.requestId,
        missing: compilation.profileRequirements.missing,
      } satisfies PendingMarketplaceIntent;
      setPendingIntent(pending);
      setEditingProfile(true);
      setPanelExpanded(true);
      setRuntimeError(null);
      window.dispatchEvent(new CustomEvent(MARKETPLACE_PROFILE_REQUIRED_EVENT, {
        detail: pending,
      }));
      return null;
    }

    return executeCompilation(compilation);
  }, [executeCompilation, locale]);

  const retryBlockedRequest = useCallback(() => {
    const current = executionRef.current;
    if (!current || current.status !== "blocked") return;
    void runIntent(current.envelope.rawMessage.text, current.envelope.requestId);
  }, [runIntent]);

  const changeBlockedPayment = useCallback(() => {
    const current = executionRef.current;
    if (!current || current.status !== "blocked") return;
    setDraftProfile(profileRef.current);
    setEditingProfile(true);
    setPanelExpanded(true);
  }, []);

  const resumePendingIntent = useCallback(async (nextProfile: AsymptaMarketplaceProfile) => {
    const pending = pendingIntent;
    if (!pending) return null;
    const compilation = compileAsymptaContext(pending.intent, {
      requestId: pending.requestId,
      conversationId: pending.requestId,
      locale,
      now: Date.now(),
      profile: nextProfile,
    });
    if (compilation.profileRequirements.missing.length) {
      setPendingIntent({ ...pending, missing: compilation.profileRequirements.missing });
      return null;
    }
    return executeCompilation(compilation);
  }, [executeCompilation, locale, pendingIntent]);

  const commitProfile = useCallback(async (nextProfile: AsymptaMarketplaceProfile) => {
    const saved = writeAsymptaMarketplaceProfile(nextProfile) ?? nextProfile;
    profileRef.current = saved;
    setProfile(saved);
    setDraftProfile(saved);
    setEditingProfile(false);
    if (pendingIntent) await resumePendingIntent(saved);
  }, [pendingIntent, resumePendingIntent]);

  const choosePreset = useCallback((presetId: PresetId) => {
    void commitProfile(marketplaceProfilePreset(presetId));
  }, [commitProfile]);

  const chooseFood = (foodPreference: MarketplaceFoodPreference) => {
    setDraftProfile((current) => patchMarketplaceProfile(current, { foodPreference }));
  };

  const chooseFulfilment = (fulfilmentMethod: MarketplaceFulfilmentMethod) => {
    setDraftProfile((current) => patchMarketplaceProfile(current, { fulfilmentMethod }));
  };

  const choosePayment = (paymentMethod: MarketplacePaymentMethod) => {
    setDraftProfile((current) => patchMarketplaceProfile(current, { paymentMethod }));
  };

  useEffect(() => {
    const maybeRun = (intent: string | undefined, requestId: string | undefined) => {
      const clean = intent?.trim();
      if (!clean) return;
      const key = requestId?.trim() || `intent:${clean.toLocaleLowerCase()}`;
      if (seenRequestsRef.current.has(key)) return;
      const preview = compileAsymptaContext(clean, {
        requestId: key,
        locale,
        now: 0,
        profile: readAsymptaMarketplaceProfile(),
      });
      if (!preview.supported) return;
      seenRequestsRef.current.add(key);
      void runIntent(clean, key);
    };

    const unsubscribe = subscribeAsymptaCurrentRequest((request: AsymptaCurrentRequest) => {
      if (request.status === "interpreting") maybeRun(request.intent, request.requestId);
    });
    const onActivity = (event: Event) => {
      const detail = (event as CustomEvent<ActivityDetail>).detail;
      if (detail?.event?.status !== "interpreting" && detail?.activity?.status !== "interpreting") return;
      maybeRun(detail.activity?.intent, detail.activity?.id);
    };
    window.addEventListener("asympta:activity", onActivity);
    return () => {
      unsubscribe();
      window.removeEventListener("asympta:activity", onActivity);
    };
  }, [locale, runIntent]);

  useEffect(() => {
    window.__ASYMPTA_MARKETPLACE__ = {
      compile: (intent) => compileAsymptaContext(intent, {
        locale,
        now: Date.now(),
        profile: readAsymptaMarketplaceProfile(),
      }),
      runIntent: (intent, requestId) => runIntent(intent, requestId),
      snapshot: () => cloneExecution(executionRef.current),
      profile: () => profileRef.current,
    };
    return () => {
      if (window.__ASYMPTA_MARKETPLACE__?.runIntent) delete window.__ASYMPTA_MARKETPLACE__;
    };
  }, [locale, runIntent]);

  const executionId = execution?.executionId ?? null;

  useEffect(() => {
    if (execution?.status === "blocked") setPanelExpanded(true);
  }, [execution?.status]);

  useEffect(() => {
    if (!executionId) return;
    const poll = () => {
      const demo = window.__ASYMPTA_DEMO__;
      if (!demo || executionRef.current?.executionId !== executionId) return;
      const snapshot = normalizeWorldSnapshot(demo.snapshot());
      if (!snapshot || !executionRef.current) return;
      try {
        const next = syncMarketplaceExecution(executionRef.current, snapshot);
        if (next === executionRef.current) {
          syncCargoMarker(next);
          return;
        }
        executionRef.current = next;
        setExecution(next);
        syncCargoMarker(next);
        publishExecution(next);
      } catch (error) {
        setRuntimeError(error instanceof Error ? error.message : COPY[locale].error);
      }
    };
    poll();
    const timer = window.setInterval(poll, 180);
    return () => window.clearInterval(timer);
  }, [executionId, locale]);

  useEffect(() => () => {
    generationRef.current += 1;
    runControllerRef.current?.abort();
    syncCargoMarker(null);
  }, []);

  const panel = useMemo(() => {
    if (!execution && !runtimeError && !pendingIntent && !profile) return null;
    const copy = COPY[locale];
    const hostMode = host?.matches(".atlas-safe-schedule.asympta-request-card") ? "request-card" : "standalone";
    const showProfileEditor = editingProfile || Boolean(pendingIntent);
    const currentSummary = profile ? profileSummary(profile, locale) : copy.setupRequired;
    const panelStatus = pendingIntent
      ? copy.setupRequired
      : execution
        ? copy.status[execution.status]
        : copy.profileReady;

    const profileEditor = showProfileEditor ? (
      <section className="asympta-marketplace-profile" aria-label={copy.profileTitle}>
        <p>{copy.profileIntro}</p>
        <div className="asympta-marketplace-profile__group">
          <strong>{copy.presetTitle}</strong>
          <div className="asympta-marketplace-profile__presets">
            {MARKETPLACE_PROFILE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={presetSelected(draftProfile, preset.id) ? "is-selected" : ""}
                onClick={() => choosePreset(preset.id)}
              >
                <b>{copy.presets[preset.id].name}</b>
                <small>{copy.presets[preset.id].detail}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="asympta-marketplace-profile__group">
          <strong>{copy.customTitle}</strong>
          <fieldset>
            <legend><Utensils size={12} aria-hidden="true" />{copy.food}</legend>
            <div className="asympta-marketplace-profile__options">
              {FOOD_OPTIONS.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={draftProfile?.foodPreference === value ? "is-selected" : ""}
                  onClick={() => chooseFood(value)}
                >{copy.foodOptions[value]}</button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend><Truck size={12} aria-hidden="true" />{copy.fulfilment}</legend>
            <div className="asympta-marketplace-profile__options">
              {FULFILMENT_OPTIONS.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={draftProfile?.fulfilmentMethod === value ? "is-selected" : ""}
                  onClick={() => chooseFulfilment(value)}
                >{copy.fulfilmentOptions[value]}</button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend><WalletCards size={12} aria-hidden="true" />{copy.payment}</legend>
            <div className="asympta-marketplace-profile__options">
              {PAYMENT_OPTIONS.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={draftProfile?.paymentMethod === value ? "is-selected" : ""}
                  onClick={() => choosePayment(value)}
                >{copy.paymentOptions[value]}</button>
              ))}
            </div>
          </fieldset>
        </div>

        <button
          type="button"
          className="asympta-marketplace-profile__save"
          disabled={!isMarketplaceProfileComplete(draftProfile)}
          onClick={() => { if (draftProfile) void commitProfile(draftProfile); }}
        >
          <ShieldCheck size={13} aria-hidden="true" />
          {pendingIntent ? copy.saveContinue : copy.saveProfile}
        </button>
        <small className="asympta-marketplace-profile__safety">{copy.safeProfile}</small>
      </section>
    ) : null;

    let executionDetails = null;
    if (execution) {
      const latestPacket = execution.packets.at(-1);
      const activeLine = execution.ledger.find((line) => line.goalId === execution.activeGoalId)
        ?? execution.ledger.find((line) => line.userInventory < line.quantity)
        ?? execution.ledger.at(-1);
      const totalMarket = execution.ledger.reduce((sum, line) => sum + line.marketAvailable, 0);
      const totalReserved = execution.ledger.reduce((sum, line) => sum + line.marketReserved, 0);
      const totalCargo = execution.ledger.reduce((sum, line) => sum + line.carrierCargo, 0);
      const totalDelivered = execution.ledger.reduce((sum, line) => sum + line.userInventory, 0);
      const context = compactContextEnvelope(execution.envelope);

      executionDetails = (
        <>
          <ol className="asympta-marketplace-trace__route" aria-label={copy.status[execution.status]}>
            {copy.route.map((label, index) => {
              const stage = workflowStage(execution, index);
              return (
                <li key={label} data-stage={stage}>
                  <span>{stage === "done" ? <Check size={10} aria-hidden="true" /> : index + 1}</span>
                  <b>{label}</b>
                  {index < copy.route.length - 1 ? <ArrowRight size={9} aria-hidden="true" /> : null}
                </li>
              );
            })}
          </ol>

          {execution.status === "blocked" ? (
            <section className="asympta-marketplace-recovery" role="status" aria-live="polite">
              <span><RotateCcw size={14} aria-hidden="true" /></span>
              <div>
                <strong>{copy.recoveryTitle}</strong>
                <p>{copy.recoveryDetail}</p>
              </div>
              <div className="asympta-marketplace-recovery__actions">
                <button type="button" onClick={retryBlockedRequest}>
                  <RotateCcw size={12} aria-hidden="true" />{copy.retryRequest}
                </button>
                <button type="button" onClick={changeBlockedPayment}>
                  <WalletCards size={12} aria-hidden="true" />{copy.changePayment}
                </button>
              </div>
            </section>
          ) : null}

          {activeLine ? (
            <div className="asympta-marketplace-trace__item">
              <Package size={14} aria-hidden="true" />
              <strong>{activeLine.quantity} × {activeLine.itemLabel}</strong>
              <span>{copy.market} {totalMarket} · {copy.reserved} {totalReserved} · {copy.carrying} {totalCargo} · {copy.delivered} {totalDelivered}</span>
            </div>
          ) : null}

          {latestPacket ? (
            <div className="asympta-marketplace-trace__packet" data-packet-kind={latestPacket.kind}>
              <span><Code2 size={13} aria-hidden="true" />{copy.latestPacket}</span>
              <strong>{copy.packet[latestPacket.kind] ?? latestPacket.kind}</strong>
              <code>{latestPacket.from} → {latestPacket.to}</code>
            </div>
          ) : null}

          <details className="asympta-marketplace-trace__context">
            <summary><ShieldCheck size={13} aria-hidden="true" />{copy.context}</summary>
            <pre>{JSON.stringify(context, null, 2)}</pre>
          </details>
        </>
      );
    }

    return (
      <section
        className={`${styles.trace} asympta-marketplace-trace`}
        data-asympta-marketplace="true"
        data-host={hostMode}
        data-context-id={execution?.envelope.requestId ?? pendingIntent?.requestId ?? "profile"}
        data-execution-id={execution?.executionId ?? "pending-profile"}
        data-status={pendingIntent ? "profile_required" : execution?.status ?? "profile_ready"}
        data-provenance="simulated"
        aria-label={copy.title}
      >
        <button
          type="button"
          className="asympta-marketplace-trace__toggle"
          aria-expanded={panelExpanded}
          onClick={() => setPanelExpanded((value) => !value)}
        >
          <span className="asympta-marketplace-trace__heading">
            <Store size={14} aria-hidden="true" />
            <span><small>{copy.simulated}</small><strong>{copy.title}</strong></span>
          </span>
          <span className="asympta-marketplace-trace__toggle-status">
            <small>{panelStatus}</small>
            {panelExpanded ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
          </span>
        </button>

        {panelExpanded ? (
          <div className="asympta-marketplace-trace__body">
            {profile && !showProfileEditor ? (
              <div className="asympta-marketplace-profile__summary">
                <span><small>{copy.currentProfile}</small><strong>{currentSummary}</strong></span>
                <button type="button" onClick={() => { setDraftProfile(profile); setEditingProfile(true); }}>{copy.editProfile}</button>
              </div>
            ) : null}
            {profileEditor}
            {!showProfileEditor ? executionDetails : null}
            {runtimeError ? <p className="asympta-marketplace-trace__error">{runtimeError}</p> : null}
          </div>
        ) : null}
      </section>
    );
  }, [
    draftProfile,
    editingProfile,
    execution,
    host,
    locale,
    panelExpanded,
    pendingIntent,
    profile,
    runtimeError,
    retryBlockedRequest,
    changeBlockedPayment,
    choosePreset,
    commitProfile,
  ]);

  if (!panel || !host) return null;
  return createPortal(panel, host);
}
