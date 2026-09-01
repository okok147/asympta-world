"use client";

import { ShieldCheck, WalletCards, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import styles from "./asympta-marketplace-payment-approval.module.css";

import type { MarketplaceExecution } from "@/lib/asympta-marketplace-intent";
import { marketplaceSimulatedQuote } from "@/lib/asympta-marketplace-offer";

type Locale = "en" | "zh-Hant" | "ja";

type PendingApproval = {
  id?: string;
  taskId?: string | null;
  actionType?: string | null;
  title?: string;
};

type WorldSnapshot = {
  pendingApprovals?: PendingApproval[];
};

type DemoBridge = {
  snapshot: () => unknown;
  approve: (approvalId: string, approved: boolean) => unknown;
};

type MarketplaceBridge = {
  snapshot: () => MarketplaceExecution | null;
};

type ApprovalView = {
  id: string;
  title: string;
  ready: boolean;
  itemLabel: string | null;
  quantity: number | null;
  paymentMethod: string | null;
  totalAmount: number | null;
  currency: "JPY" | null;
};

const COPY: Record<Locale, {
  title: string;
  courierReady: string;
  orderReady: string;
  syncing: string;
  payOnDelivery: string;
  confirm: (amount: string) => string;
  decline: string;
  safe: string;
  error: string;
}> = {
  en: {
    title: "Payment confirmation",
    courierReady: "The courier is here with your item. Confirm the simulated payment to complete the handoff.",
    orderReady: "The order is ready for simulated payment authorisation.",
    syncing: "Preparing the verified item and payment details…",
    payOnDelivery: "Pay on delivery",
    confirm: (amount) => `Confirm ${amount}`,
    decline: "Decline",
    safe: "Simulation only · no real charge will be made.",
    error: "The pending payment could not be resolved. Please try again.",
  },
  "zh-Hant": {
    title: "付款確認",
    courierReady: "速遞員已帶着物品到達。確認模擬付款後即可完成交收。",
    orderReady: "訂單已準備好，等待你確認模擬付款。",
    syncing: "正在準備已驗證的物品與付款資料…",
    payOnDelivery: "貨到付款",
    confirm: (amount) => `確認支付 ${amount}`,
    decline: "拒絕",
    safe: "只會更新模擬狀態 · 不會產生真實扣款。",
    error: "未能處理這次付款確認，請再試一次。",
  },
  ja: {
    title: "支払い確認",
    courierReady: "配達員が商品を持って到着しました。シミュレーション支払いを確認すると受け渡しが完了します。",
    orderReady: "注文はシミュレーション支払いの確認待ちです。",
    syncing: "検証済みの商品と支払い情報を準備しています…",
    payOnDelivery: "代引き",
    confirm: (amount) => `${amount} を確認`,
    decline: "拒否",
    safe: "シミュレーションのみ · 実際の請求は発生しません。",
    error: "支払い確認を処理できませんでした。もう一度お試しください。",
  },
};

function localeFromDocument(): Locale {
  const value = document.documentElement.lang.toLowerCase();
  if (value.startsWith("zh")) return "zh-Hant";
  if (value.startsWith("ja")) return "ja";
  return "en";
}

function bridges() {
  return window as typeof window & {
    __ASYMPTA_DEMO__?: DemoBridge;
    __ASYMPTA_MARKETPLACE__?: MarketplaceBridge;
  };
}

function normalizeWorldSnapshot(value: unknown): WorldSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const root = value as Record<string, unknown>;
  const candidate = root.foreground && typeof root.foreground === "object"
    ? root.foreground as Record<string, unknown>
    : root;
  if (!Array.isArray(candidate.pendingApprovals)) return null;
  return candidate as WorldSnapshot;
}

function pendingMarketplacePayment(snapshot: WorldSnapshot | null) {
  return snapshot?.pendingApprovals?.find((approval) => (
    typeof approval.id === "string"
    && approval.actionType === "authorize_payment"
    && typeof approval.taskId === "string"
    && approval.taskId.startsWith("mp-")
    && approval.taskId.endsWith("-payment")
  )) ?? null;
}

function approvalView(approval: PendingApproval | null, execution: MarketplaceExecution | null): ApprovalView | null {
  if (!approval?.id) return null;
  const transaction = execution?.transactions.find((candidate) => candidate.payment === "awaiting_approval");
  const line = transaction
    ? execution?.ledger.find((candidate) => candidate.goalId === transaction.goalId)
    : null;

  // Atlas can expose the pending approval one render tick before the marketplace
  // projection records its `approval_request` packet. Keep the human checkpoint
  // visible, but do not invent an item/amount or enable either decision until the
  // structured execution has observed the same waiting state. This makes the
  // audit packet and the decision one ordered, inspectable process.
  if (!transaction || !line) {
    return {
      id: approval.id,
      title: approval.title ?? "Authorise simulated payment",
      ready: false,
      itemLabel: null,
      quantity: null,
      paymentMethod: null,
      totalAmount: null,
      currency: null,
    };
  }

  const quote = marketplaceSimulatedQuote(line.domain, line.itemLabel, line.quantity);
  return {
    id: approval.id,
    title: approval.title ?? "Authorise simulated payment",
    ready: true,
    itemLabel: line.itemLabel,
    quantity: line.quantity,
    paymentMethod: transaction.paymentMethod,
    totalAmount: quote.totalAmount,
    currency: quote.currency,
  };
}

function sameApproval(left: ApprovalView | null, right: ApprovalView | null) {
  if (left === right) return true;
  if (!left || !right) return false;
  return left.id === right.id
    && left.title === right.title
    && left.ready === right.ready
    && left.itemLabel === right.itemLabel
    && left.quantity === right.quantity
    && left.paymentMethod === right.paymentMethod
    && left.totalAmount === right.totalAmount;
}

function formatAmount(locale: Locale, amount: number | null) {
  if (amount === null) return "—";
  const language = locale === "zh-Hant" ? "zh-HK" : locale;
  return new Intl.NumberFormat(language, {
    style: "currency",
    currency: "JPY",
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function AsymptaMarketplacePaymentApproval() {
  const [locale, setLocale] = useState<Locale>("en");
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [approval, setApproval] = useState<ApprovalView | null>(null);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const syncLocale = () => setLocale(localeFromDocument());
    queueMicrotask(syncLocale);
    const observer = new MutationObserver(syncLocale);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const findHost = () => {
      const requestCard = document.querySelector<HTMLElement>(".atlas-safe-schedule.asympta-request-card");
      setHost((current) => current === (requestCard ?? document.body) ? current : (requestCard ?? document.body));
    };
    findHost();
    const observer = new MutationObserver(findHost);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const sync = () => {
      const app = bridges();
      const snapshot = normalizeWorldSnapshot(app.__ASYMPTA_DEMO__?.snapshot());
      const pending = pendingMarketplacePayment(snapshot);
      const execution = app.__ASYMPTA_MARKETPLACE__?.snapshot() ?? null;
      const next = approvalView(pending, execution);
      setApproval((current) => sameApproval(current, next) ? current : next);
      if (!next) {
        setResolving(false);
        setError(null);
      }
    };
    sync();
    const timer = window.setInterval(sync, 140);
    return () => window.clearInterval(timer);
  }, []);

  const resolve = useCallback((approved: boolean) => {
    if (!approval?.ready || resolving) return;
    const app = bridges();
    const snapshot = normalizeWorldSnapshot(app.__ASYMPTA_DEMO__?.snapshot());
    const pending = pendingMarketplacePayment(snapshot);
    const execution = app.__ASYMPTA_MARKETPLACE__?.snapshot() ?? null;
    const projected = approvalView(pending, execution);
    if (!pending?.id || pending.id !== approval.id || !projected?.ready || !app.__ASYMPTA_DEMO__) {
      setError(COPY[locale].error);
      return;
    }

    setResolving(true);
    setError(null);
    try {
      app.__ASYMPTA_DEMO__.approve(pending.id, approved);
      setApproval(null);
    } catch {
      setResolving(false);
      setError(COPY[locale].error);
    }
  }, [approval, locale, resolving]);

  if (!approval || !host) return null;

  const copy = COPY[locale];
  const amount = formatAmount(locale, approval.totalAmount);
  const isPayOnDelivery = approval.paymentMethod === "pay_on_delivery";
  const standalone = host.tagName === "BODY";
  const decisionsDisabled = resolving || !approval.ready;

  return createPortal(
    <section
      className={`${styles.root} asympta-marketplace-payment-approval`}
      data-host={standalone ? "standalone" : "request-card"}
      data-payment-method={approval.paymentMethod ?? "pending_projection"}
      data-projection-ready={approval.ready ? "true" : "false"}
      role="alert"
      aria-busy={!approval.ready}
      aria-live="polite"
      aria-label={copy.title}
    >
      <header>
        <span className="asympta-marketplace-payment-approval__icon"><WalletCards size={15} aria-hidden="true" /></span>
        <span>
          <small>{isPayOnDelivery ? copy.payOnDelivery : copy.title}</small>
          <strong>{amount}</strong>
        </span>
      </header>

      <p>{!approval.ready ? copy.syncing : isPayOnDelivery ? copy.courierReady : copy.orderReady}</p>
      {approval.ready && approval.itemLabel !== null && approval.quantity !== null ? (
        <div className="asympta-marketplace-payment-approval__item">
          <span>{approval.quantity} × {approval.itemLabel}</span>
          <b>{amount}</b>
        </div>
      ) : null}

      <div className="asympta-marketplace-payment-approval__actions">
        <button type="button" onClick={() => resolve(true)} disabled={decisionsDisabled}>
          <ShieldCheck size={13} aria-hidden="true" />
          {copy.confirm(amount)}
        </button>
        <button type="button" onClick={() => resolve(false)} disabled={decisionsDisabled}>
          <X size={13} aria-hidden="true" />
          {copy.decline}
        </button>
      </div>

      <small className="asympta-marketplace-payment-approval__safety">{copy.safe}</small>
      {error ? <span className="asympta-marketplace-payment-approval__error">{error}</span> : null}
    </section>,
    host,
  );
}
