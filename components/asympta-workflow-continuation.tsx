"use client";

import { ArrowRight, RotateCcw, ShieldCheck, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import styles from "./asympta-workflow-continuation.module.css";

type Locale = "en" | "zh-Hant" | "ja";

type PendingApproval = {
  id?: string;
  source?: string;
  title?: string;
  detail?: string;
  consequence?: string;
  actionType?: string | null;
  taskId?: string | null;
};

type WorkflowTask = {
  id?: string;
  title?: string;
  status?: string;
};

type WorkflowSnapshot = {
  phase?: string;
  workflowId?: string | null;
  workflow?: string | null;
  tasks?: WorkflowTask[];
  pendingApprovals?: PendingApproval[];
};

type DemoBridge = {
  snapshot: () => unknown;
  startWorkflow: (workflowId: string) => unknown;
  approve: (approvalId: string, approved: boolean) => unknown;
};

type MarketplaceExecutionSnapshot = {
  status?: string;
  envelope?: { rawMessage?: { text?: string } };
};

type MarketplaceBridge = {
  snapshot: () => MarketplaceExecutionSnapshot | null;
  runIntent: (intent: string) => Promise<unknown>;
};

type ContinuationView =
  | { kind: "approval"; approval: Required<Pick<PendingApproval, "id" | "title">> & PendingApproval }
  | { kind: "recovery"; workflowId: string; workflow: string; blockedTask: string; fallbackIntent: string | null };

const COPY: Record<Locale, {
  approvalEyebrow: string;
  approvalFallback: string;
  approvalDetail: string;
  approvalSafety: string;
  continue: string;
  decline: string;
  recoveryEyebrow: string;
  recoveryTitle: string;
  recoveryBody: (task: string) => string;
  recoverySafety: string;
  retry: string;
  newRequest: string;
  error: string;
}> = {
  en: {
    approvalEyebrow: "Next decision",
    approvalFallback: "Confirm the next simulated step",
    approvalDetail: "The workflow is ready and will continue immediately after your choice.",
    approvalSafety: "Simulation only. No real order, charge, reservation or shipment will be created.",
    continue: "Confirm and continue",
    decline: "Decline",
    recoveryEyebrow: "Needs your choice",
    recoveryTitle: "This workflow is paused—not stuck",
    recoveryBody: (task) => `${task} did not continue. Retry the same workflow or start a different request.`,
    recoverySafety: "A declined simulated step creates no real-world side effect.",
    retry: "Retry safely",
    newRequest: "New request",
    error: "The decision could not be applied. Please try again.",
  },
  "zh-Hant": {
    approvalEyebrow: "下一個決定",
    approvalFallback: "確認下一個模擬步驟",
    approvalDetail: "流程已準備好；你作出選擇後便會立即繼續。",
    approvalSafety: "只限模擬；不會建立真實訂單、扣款、預留或出貨。",
    continue: "確認並繼續",
    decline: "拒絕",
    recoveryEyebrow: "等待你的選擇",
    recoveryTitle: "流程只是暫停，並非卡死",
    recoveryBody: (task) => `${task} 未有繼續。你可以安全重試同一流程，或提出另一個請求。`,
    recoverySafety: "拒絕模擬步驟不會產生任何真實世界影響。",
    retry: "安全重試",
    newRequest: "新請求",
    error: "未能套用這個決定，請再試一次。",
  },
  ja: {
    approvalEyebrow: "次の判断",
    approvalFallback: "次のシミュレーション手順を確認",
    approvalDetail: "準備は完了しています。選択するとすぐに続行します。",
    approvalSafety: "シミュレーションのみ。実際の注文・請求・予約・出荷は発生しません。",
    continue: "確認して続行",
    decline: "拒否",
    recoveryEyebrow: "選択が必要です",
    recoveryTitle: "停止ではなく、一時停止中です",
    recoveryBody: (task) => `${task} は続行されませんでした。同じフローを安全に再試行するか、新しい依頼を開始できます。`,
    recoverySafety: "拒否したシミュレーション手順による現実の影響はありません。",
    retry: "安全に再試行",
    newRequest: "新しい依頼",
    error: "判断を反映できませんでした。もう一度お試しください。",
  },
};

function localeFromDocument(): Locale {
  const value = document.documentElement.lang.toLowerCase();
  if (value.startsWith("zh")) return "zh-Hant";
  if (value.startsWith("ja")) return "ja";
  return "en";
}

function demoBridge() {
  return (window as typeof window & { __ASYMPTA_DEMO__?: DemoBridge }).__ASYMPTA_DEMO__;
}

function marketplaceBridge() {
  return (window as typeof window & { __ASYMPTA_MARKETPLACE__?: MarketplaceBridge }).__ASYMPTA_MARKETPLACE__;
}

function normalizeSnapshot(value: unknown): WorkflowSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const root = value as Record<string, unknown>;
  const candidate = root.foreground && typeof root.foreground === "object"
    ? root.foreground as Record<string, unknown>
    : root;
  if (!Array.isArray(candidate.tasks)) return null;
  return candidate as WorkflowSnapshot;
}

function ownsSpecializedMarketplaceCard(approval: PendingApproval) {
  return approval.actionType === "authorize_payment"
    && typeof approval.taskId === "string"
    && approval.taskId.startsWith("mp-")
    && approval.taskId.endsWith("-payment");
}

function continuationFromSnapshot(snapshot: WorkflowSnapshot | null): ContinuationView | null {
  if (!snapshot) return null;
  const approval = snapshot.pendingApprovals?.find((candidate) => (
    typeof candidate.id === "string"
    && candidate.source !== "webmcp"
    && !ownsSpecializedMarketplaceCard(candidate)
  ));
  if (approval?.id) {
    return {
      kind: "approval",
      approval: {
        ...approval,
        id: approval.id,
        title: approval.title?.trim() || "Confirm the next simulated step",
      },
    };
  }

  if (snapshot.phase === "blocked" && typeof snapshot.workflowId === "string") {
    const blocked = snapshot.tasks?.find((task) => task.status === "blocked");
    const marketplace = snapshot.workflowId === "marketplace-intent";
    const clothing = marketplace && snapshot.tasks?.some((task) => task.id?.includes("-clothing-"));
    return {
      kind: "recovery",
      workflowId: snapshot.workflowId,
      workflow: snapshot.workflow?.trim() || "Workflow",
      blockedTask: blocked?.title?.trim() || "The last simulated step",
      fallbackIntent: marketplace ? clothing ? "Buy clothing" : "Buy food" : null,
    };
  }
  return null;
}

function sameView(left: ContinuationView | null, right: ContinuationView | null) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function AsymptaWorkflowContinuation() {
  const [locale, setLocale] = useState<Locale>("en");
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [view, setView] = useState<ContinuationView | null>(null);
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
      const next = requestCard ?? document.body;
      setHost((current) => current === next ? current : next);
    };
    findHost();
    const observer = new MutationObserver(findHost);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const sync = () => {
      let next = continuationFromSnapshot(normalizeSnapshot(demoBridge()?.snapshot()));
      if (
        next?.kind === "recovery"
        && next.workflowId === "marketplace-intent"
        && marketplaceBridge()?.snapshot()?.status === "blocked"
      ) next = null;
      setView((current) => sameView(current, next) ? current : next);
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
    if (view?.kind !== "approval" || resolving) return;
    const bridge = demoBridge();
    const current = continuationFromSnapshot(normalizeSnapshot(bridge?.snapshot()));
    if (!bridge || current?.kind !== "approval" || current.approval.id !== view.approval.id) {
      setError(COPY[locale].error);
      return;
    }
    setResolving(true);
    setError(null);
    try {
      bridge.approve(view.approval.id, approved);
      setView(null);
    } catch {
      setResolving(false);
      setError(COPY[locale].error);
    }
  }, [locale, resolving, view]);

  const retry = useCallback(() => {
    if (view?.kind !== "recovery" || resolving) return;
    if (view.workflowId === "marketplace-intent") {
      const marketplace = marketplaceBridge();
      const intent = marketplace?.snapshot()?.envelope?.rawMessage?.text?.trim() || view.fallbackIntent;
      if (!marketplace || !intent) {
        setError(COPY[locale].error);
        return;
      }
      setResolving(true);
      setError(null);
      void marketplace.runIntent(intent).then(() => {
        setView(null);
      }).catch(() => {
        setResolving(false);
        setError(COPY[locale].error);
      });
      return;
    }
    const bridge = demoBridge();
    if (!bridge) {
      setError(COPY[locale].error);
      return;
    }
    setResolving(true);
    setError(null);
    try {
      bridge.startWorkflow(view.workflowId);
      setView(null);
    } catch {
      setResolving(false);
      setError(COPY[locale].error);
    }
  }, [locale, resolving, view]);

  const startNewRequest = useCallback(() => {
    const composer = document.querySelector<HTMLTextAreaElement>(".asympta-intent-composer textarea");
    composer?.focus();
    composer?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, []);

  if (!view || !host) return null;
  const copy = COPY[locale];
  const standalone = host.tagName === "BODY";

  return createPortal(
    <section
      className={`${styles.root} asympta-workflow-continuation`}
      data-host={standalone ? "standalone" : "request-card"}
      data-kind={view.kind}
      role="alert"
      aria-live="polite"
    >
      <header>
        <span className="asympta-workflow-continuation__icon">
          {view.kind === "approval" ? <ShieldCheck size={15} aria-hidden="true" /> : <RotateCcw size={15} aria-hidden="true" />}
        </span>
        <span>
          <small>{view.kind === "approval" ? copy.approvalEyebrow : copy.recoveryEyebrow}</small>
          <strong>{view.kind === "approval" ? view.approval.title || copy.approvalFallback : copy.recoveryTitle}</strong>
        </span>
      </header>

      <p>{view.kind === "approval"
        ? view.approval.detail || copy.approvalDetail
        : copy.recoveryBody(view.blockedTask)}</p>

      <div className="asympta-workflow-continuation__actions">
        {view.kind === "approval" ? (
          <>
            <button type="button" onClick={() => resolve(true)} disabled={resolving}>
              <ShieldCheck size={13} aria-hidden="true" />{copy.continue}
            </button>
            <button type="button" onClick={() => resolve(false)} disabled={resolving}>
              <X size={13} aria-hidden="true" />{copy.decline}
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={retry} disabled={resolving}>
              <RotateCcw size={13} aria-hidden="true" />{copy.retry}
            </button>
            <button type="button" onClick={startNewRequest} disabled={resolving}>
              <ArrowRight size={13} aria-hidden="true" />{copy.newRequest}
            </button>
          </>
        )}
      </div>

      <small className="asympta-workflow-continuation__safety">
        {view.kind === "approval" ? view.approval.consequence || copy.approvalSafety : copy.recoverySafety}
      </small>
      {error ? <span className="asympta-workflow-continuation__error">{error}</span> : null}
    </section>,
    host,
  );
}
