"use client";

import { ArrowRight, Check, Code2, Home, Package, ShieldCheck, Store } from "lucide-react";
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
  MARKETPLACE_WORKFLOW_ID,
  compactContextEnvelope,
  compileAsymptaContext,
  createMarketplaceExecution,
  syncMarketplaceExecution,
  upsertMarketplaceWorkflow,
  type ContextCompilation,
  type MarketplaceExecution,
  type MarketplaceWorldSnapshot,
} from "@/lib/asympta-marketplace-intent";
import type { WorkflowId } from "@/lib/atlas-simulation";

type Locale = "en" | "zh-Hant" | "ja";

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
  runIntent: (intent: string) => Promise<MarketplaceExecution | null>;
  snapshot: () => MarketplaceExecution | null;
};

declare global {
  interface Window {
    __ASYMPTA_DEMO__?: DemoBridge;
    __ASYMPTA_MARKETPLACE__?: MarketplaceBridge;
  }
}

const COPY: Record<Locale, {
  title: string;
  simulated: string;
  context: string;
  latestPacket: string;
  market: string;
  reserved: string;
  carrying: string;
  delivered: string;
  route: [string, string, string, string, string];
  status: Record<MarketplaceExecution["status"], string>;
  packet: Record<string, string>;
  error: string;
}> = {
  en: {
    title: "Context → marketplace",
    simulated: "Simulated city · real engine state",
    context: "Asympta context",
    latestPacket: "Latest structured packet",
    market: "market",
    reserved: "reserved",
    carrying: "carrying",
    delivered: "delivered",
    route: ["Intent", "Market", "Store", "Approval", "Home"],
    status: {
      routing: "Compiling a bounded request…",
      travelling_to_market: "Personal agent is going to the marketplace…",
      coordinating: "Marketplace agents are exchanging structured packets…",
      awaiting_approval: "Waiting for simulated payment approval.",
      returning_to_user: "Personal agent is carrying the item home…",
      completed: "Delivered into user inventory.",
      blocked: "The simulated transaction was stopped.",
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
      blocked: "Blocked",
    },
    error: "The marketplace engine could not start.",
  },
  "zh-Hant": {
    title: "語境 → 模擬市場",
    simulated: "模擬城市 · 真實引擎狀態",
    context: "Asympta 語境",
    latestPacket: "最新結構化封包",
    market: "市場",
    reserved: "已預留",
    carrying: "攜帶中",
    delivered: "已交付",
    route: ["意圖", "市場", "商店", "批准", "回家"],
    status: {
      routing: "正在把自然語言編譯成受約束的請求…",
      travelling_to_market: "個人代理正在前往市場…",
      coordinating: "市場代理正在交換結構化封包…",
      awaiting_approval: "等待批准模擬付款。",
      returning_to_user: "個人代理正攜帶物品回家…",
      completed: "物品已轉入使用者庫存。",
      blocked: "模擬交易已停止。",
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
      blocked: "已停止",
    },
    error: "未能啟動市場執行引擎。",
  },
  ja: {
    title: "文脈 → シミュレーション市場",
    simulated: "シミュレーション都市 · 実エンジン状態",
    context: "Asympta コンテキスト",
    latestPacket: "最新の構造化パケット",
    market: "市場",
    reserved: "予約済み",
    carrying: "運搬中",
    delivered: "配達済み",
    route: ["意図", "市場", "店舗", "承認", "帰宅"],
    status: {
      routing: "自然言語を制約付きリクエストへ変換中…",
      travelling_to_market: "パーソナルエージェントが市場へ移動中…",
      coordinating: "市場エージェントが構造化パケットを交換中…",
      awaiting_approval: "シミュレーション支払いの承認待ちです。",
      returning_to_user: "品物を持ってユーザーの元へ戻っています…",
      completed: "ユーザー在庫へ引き渡しました。",
      blocked: "シミュレーション取引を停止しました。",
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
      blocked: "停止",
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

function cargoDescription(execution: MarketplaceExecution) {
  return execution.ledger
    .filter((line) => line.carriedByPersonalAgent > 0)
    .map((line) => `${line.carriedByPersonalAgent} × ${line.itemLabel}`)
    .join(", ");
}

function syncCargoMarker(execution: MarketplaceExecution | null) {
  const marker = document.querySelector<HTMLElement>('.animal-map-marker--foreground[data-agent-id="agent-user"]');
  if (!marker) return;
  const cargo = execution ? cargoDescription(execution) : "";
  let badge = marker.querySelector<HTMLElement>(".asympta-marketplace-cargo");
  if (!cargo) {
    badge?.remove();
    delete marker.dataset.asymptaCargo;
    return;
  }
  if (!badge) {
    badge = document.createElement("span");
    badge.className = "asympta-marketplace-cargo";
    marker.appendChild(badge);
  }
  const total = execution?.ledger.reduce((sum, line) => sum + line.carriedByPersonalAgent, 0) ?? 0;
  badge.textContent = `×${total}`;
  badge.title = cargo;
  badge.setAttribute("aria-label", `Carrying ${cargo}`);
  marker.dataset.asymptaCargo = cargo;
}

function workflowStage(execution: MarketplaceExecution, index: number) {
  const hasContext = execution.packets.some((packet) => packet.kind === "context_envelope");
  const hasStore = execution.transactions.some((transaction) => transaction.status !== "planned");
  const hasApproval = execution.transactions.some((transaction) => ["authorized", "goods_collected", "returning_to_user", "delivered", "completed"].includes(transaction.status));
  const hasCargo = execution.ledger.some((line) => line.carriedByPersonalAgent > 0 || line.userInventory > 0);
  const delivered = execution.transactions.every((transaction) => ["delivered", "completed"].includes(transaction.status));
  const done = [hasContext, hasStore, hasApproval, hasCargo, delivered];

  if (done[index]) return "done";
  const firstUndone = done.findIndex((value) => !value);
  return index === firstUndone ? "active" : "pending";
}

const defaultCompilation = compileAsymptaContext("I want to buy some food", {
  requestId: "marketplace-default",
  conversationId: "marketplace-default",
  locale: "en",
  now: 0,
});
if (defaultCompilation.envelope) upsertMarketplaceWorkflow(defaultCompilation.envelope);

export function AsymptaMarketplaceIntentBridge() {
  const [locale, setLocale] = useState<Locale>("en");
  const [execution, setExecution] = useState<MarketplaceExecution | null>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const executionRef = useRef<MarketplaceExecution | null>(null);
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
    const findHost = () => {
      const next = document.querySelector<HTMLElement>(".asympta-intent-shell");
      if (next) setHost(next);
    };
    findHost();
    const observer = new MutationObserver(findHost);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  const runIntent = useCallback(async (intent: string, requestId?: string) => {
    const clean = intent.replace(/\s+/g, " ").trim();
    const compilation = compileAsymptaContext(clean, {
      requestId,
      conversationId: requestId,
      locale,
      now: Date.now(),
    });
    if (!compilation.supported || !compilation.envelope) return null;

    generationRef.current += 1;
    const generation = generationRef.current;
    runControllerRef.current?.abort();
    const controller = new AbortController();
    runControllerRef.current = controller;
    setRuntimeError(null);

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

  useEffect(() => {
    const maybeRun = (intent: string | undefined, requestId: string | undefined) => {
      const clean = intent?.trim();
      if (!clean) return;
      const key = requestId?.trim() || `intent:${clean.toLocaleLowerCase()}`;
      if (seenRequestsRef.current.has(key)) return;
      const preview = compileAsymptaContext(clean, { requestId: key, locale, now: 0 });
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
      compile: (intent) => compileAsymptaContext(intent, { locale, now: Date.now() }),
      runIntent: (intent) => runIntent(intent),
      snapshot: () => cloneExecution(executionRef.current),
    };
    return () => {
      if (window.__ASYMPTA_MARKETPLACE__?.runIntent) delete window.__ASYMPTA_MARKETPLACE__;
    };
  }, [locale, runIntent]);

  const executionId = execution?.executionId ?? null;

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
    if (!execution && !runtimeError) return null;
    const copy = COPY[locale];
    if (!execution) {
      return (
        <section className={`${styles.trace} asympta-marketplace-trace`} role="alert" data-status="blocked">
          <strong>{copy.title}</strong>
          <p>{runtimeError ?? copy.error}</p>
        </section>
      );
    }

    const latestPacket = execution.packets.at(-1);
    const activeLine = execution.ledger.find((line) => line.goalId === execution.activeGoalId)
      ?? execution.ledger.find((line) => line.userInventory < line.quantity)
      ?? execution.ledger.at(-1);
    const totalMarket = execution.ledger.reduce((sum, line) => sum + line.marketAvailable, 0);
    const totalReserved = execution.ledger.reduce((sum, line) => sum + line.marketReserved, 0);
    const totalCargo = execution.ledger.reduce((sum, line) => sum + line.carriedByPersonalAgent, 0);
    const totalDelivered = execution.ledger.reduce((sum, line) => sum + line.userInventory, 0);
    const context = compactContextEnvelope(execution.envelope);

    return (
      <section
        className={`${styles.trace} asympta-marketplace-trace`}
        data-asympta-marketplace="true"
        data-context-id={execution.envelope.requestId}
        data-execution-id={execution.executionId}
        data-status={execution.status}
        data-provenance="simulated"
        aria-label={copy.title}
        aria-live="polite"
      >
        <header>
          <span><Store size={14} aria-hidden="true" /><strong>{copy.title}</strong></span>
          <small>{copy.simulated}</small>
        </header>

        <div className="asympta-marketplace-trace__status">
          <span>{copy.status[execution.status]}</span>
          <b>{Math.round(execution.progress * 100)}%</b>
        </div>

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

        <span className="asympta-marketplace-trace__home" aria-hidden="true"><Home size={12} /></span>
        {runtimeError ? <p className="asympta-marketplace-trace__error">{runtimeError}</p> : null}
      </section>
    );
  }, [execution, locale, runtimeError]);

  if (!panel || !host) return null;
  return createPortal(panel, host);
}
