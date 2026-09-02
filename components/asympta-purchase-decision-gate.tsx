"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import styles from "./asympta-purchase-decision-gate.module.css";

import { publishAsymptaCurrentRequest, type AsymptaCurrentRequestSource } from "@/lib/asympta-current-request";
import {
  applyExactProductSelection,
  exactProductDecisionForIntent,
  type ExactProductCandidate,
  type ExactProductDecision,
} from "@/lib/asympta-product-decision";
import {
  evaluatePurchaseFeasibility,
  userFundsFromWorldSnapshot,
  type PurchaseFeasibility,
} from "@/lib/asympta-purchase-feasibility";

type Locale = "en" | "zh-Hant" | "ja";
type DemoBridge = { snapshot: () => unknown };
type DecisionState =
  | { kind: "product"; intent: string; requestId: string; source: AsymptaCurrentRequestSource; decision: ExactProductDecision }
  | { kind: "feasibility"; intent: string; requestId: string; source: AsymptaCurrentRequestSource; feasibility: PurchaseFeasibility };

declare global {
  interface Window {
    __ASYMPTA_DEMO__?: DemoBridge;
  }
}

const COPY: Record<Locale, {
  productEyebrow: string;
  productTitle: string;
  productNote: string;
  choose: string;
  manufacturer: string;
  feasibilityEyebrow: string;
  feasibilityTitle: string;
  available: string;
  floor: string;
  feasibilityNote: string;
  actorProduct: string;
  actorFeasibility: string;
}> = {
  en: {
    productEyebrow: "Exact product required",
    productTitle: "Choose the real product before the agents continue",
    productNote: "These are verified manufacturer-reference products. Price is a reference only; stock and final quotes are not live until a real seller connector verifies them.",
    choose: "Choose",
    manufacturer: "Manufacturer reference",
    feasibilityEyebrow: "Real-world feasibility preflight",
    feasibilityTitle: "This request should not enter a purchase workflow yet",
    available: "Available simulated funds",
    floor: "Proof-of-funds floor",
    feasibilityNote: "The floor is a conservative preflight threshold, not a market quote. Passing it would only allow the request to continue to exact-product, seller, legal, infrastructure and verified-quote checks.",
    actorProduct: "Product decision agent",
    actorFeasibility: "Feasibility gate",
  },
  "zh-Hant": {
    productEyebrow: "必須確認確實商品",
    productTitle: "先選擇真實存在的產品，代理才會繼續",
    productNote: "以下為已核實的製造商參考產品。價格只作參考；在真實商戶連接器驗證前，不會聲稱即時庫存或最終報價。",
    choose: "選擇",
    manufacturer: "製造商參考",
    feasibilityEyebrow: "真實世界可行性預檢",
    feasibilityTitle: "這個要求目前不應直接進入購買流程",
    available: "可用模擬資金",
    floor: "資金證明門檻",
    feasibilityNote: "此門檻只是保守預檢，不是市場報價。即使通過，也只代表可以繼續查核確實產品、賣家、法律／營運資格、基建及正式報價。",
    actorProduct: "產品決策代理",
    actorFeasibility: "可行性閘門",
  },
  ja: {
    productEyebrow: "正確な製品の確認が必要",
    productTitle: "実在する製品を選んでからエージェントが続行します",
    productNote: "メーカー情報で確認した参照製品です。価格は参照値であり、実在販売者の接続で検証されるまで在庫や最終見積もりを主張しません。",
    choose: "選択",
    manufacturer: "メーカー参照",
    feasibilityEyebrow: "現実世界の実行可能性チェック",
    feasibilityTitle: "この依頼はまだ購入フローへ進めません",
    available: "利用可能なシミュレーション資金",
    floor: "資金証明の下限",
    feasibilityNote: "この下限は保守的な事前審査であり、市場価格ではありません。通過しても、正確な製品、販売者、法的・運用条件、インフラ、正式見積もりの確認が必要です。",
    actorProduct: "製品判断エージェント",
    actorFeasibility: "実行可能性ゲート",
  },
};

function localeFromDocument(): Locale {
  const value = document.documentElement.lang.toLowerCase();
  if (value.startsWith("zh")) return "zh-Hant";
  if (value.startsWith("ja")) return "ja";
  return "en";
}

function requestSource(intent: string): AsymptaCurrentRequestSource {
  const draftIntent = document.querySelector<HTMLElement>(".asympta-webmcp-draft small")?.textContent?.trim();
  return draftIntent === intent ? "webmcp" : "human";
}

function createRequestId() {
  const nonce = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `purchase-decision-${nonce}`;
}

function setControlledTextareaValue(textarea: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  if (setter) setter.call(textarea, value);
  else textarea.value = value;
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

function yen(value: number | null) {
  return value == null ? "—" : `¥${Math.round(value).toLocaleString("en-US")}`;
}

export function AsymptaPurchaseDecisionGate() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [locale, setLocale] = useState<Locale>("en");
  const [decision, setDecision] = useState<DecisionState | null>(null);

  useEffect(() => {
    const sync = () => {
      const nextHost = document.querySelector<HTMLElement>(".atlas-safe-schedule.asympta-request-card")
        ?? document.querySelector<HTMLElement>(".atlas-safe-schedule");
      setHost((current) => current === nextHost ? current : nextHost);
      setLocale(localeFromDocument());
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const intercept = (event: Event, textarea: HTMLTextAreaElement) => {
      const intent = textarea.value.replace(/\s+/g, " ").trim();
      if (!intent) return false;
      const source = requestSource(intent);
      const requestId = createRequestId();
      let snapshot: unknown = null;
      try { snapshot = window.__ASYMPTA_DEMO__?.snapshot(); } catch {}
      const feasibility = evaluatePurchaseFeasibility(intent, userFundsFromWorldSnapshot(snapshot));

      if (feasibility && !feasibility.canProceed) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setControlledTextareaValue(textarea, "");
        setDecision({ kind: "feasibility", intent, requestId, source, feasibility });
        publishAsymptaCurrentRequest({
          requestId,
          source,
          intent,
          goal: feasibility.requestedAsset,
          kind: "marketplace",
          permission: "WRITE_REQUEST",
          status: feasibility.status === "needs_funds_evidence" ? "waiting_input" : "failed",
          actor: COPY[localeFromDocument()].actorFeasibility,
          step: feasibility.reason,
          destination: null,
          sourceCount: 0,
          verification: "not_verified",
          events: [feasibility.reason, ...feasibility.nextRequirements.slice(0, 3)],
          updatedAt: new Date().toISOString(),
        });
        return true;
      }

      const productDecision = exactProductDecisionForIntent(intent);
      if (productDecision?.status === "choice_required") {
        event.preventDefault();
        event.stopImmediatePropagation();
        setControlledTextareaValue(textarea, "");
        setDecision({ kind: "product", intent, requestId, source, decision: productDecision });
        const copy = COPY[localeFromDocument()];
        publishAsymptaCurrentRequest({
          requestId,
          source,
          intent,
          goal: productDecision.requestedLabel,
          kind: "marketplace",
          permission: "WRITE_REQUEST",
          status: "waiting_input",
          actor: copy.actorProduct,
          step: copy.productTitle,
          destination: null,
          sourceCount: productDecision.candidates.length,
          verification: "partially_verified",
          events: productDecision.candidates.map((candidate) => `${candidate.exactName} · ${candidate.referencePrice.label}`),
          updatedAt: new Date().toISOString(),
        });
        return true;
      }

      setDecision(null);
      return false;
    };

    const onSubmit = (event: SubmitEvent) => {
      const form = event.target instanceof HTMLFormElement ? event.target : null;
      if (!form?.matches("form.asympta-intent-composer")) return;
      const textarea = form.querySelector<HTMLTextAreaElement>("textarea");
      if (textarea) intercept(event, textarea);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
      const textarea = event.target instanceof HTMLTextAreaElement ? event.target : null;
      if (!textarea?.closest("form.asympta-intent-composer")) return;
      intercept(event, textarea);
    };

    window.addEventListener("submit", onSubmit, true);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("submit", onSubmit, true);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, []);

  const chooseProduct = (candidate: ExactProductCandidate) => {
    if (!decision || decision.kind !== "product") return;
    const nextIntent = applyExactProductSelection(decision.intent, candidate);
    const form = document.querySelector<HTMLFormElement>("form.asympta-intent-composer");
    const textarea = form?.querySelector<HTMLTextAreaElement>("textarea");
    setDecision(null);
    if (!form || !textarea) return;
    setControlledTextareaValue(textarea, nextIntent);
    window.setTimeout(() => form.requestSubmit(), 0);
  };

  if (!decision || !host) return null;
  const copy = COPY[locale];

  const content = decision.kind === "product" ? (
    <section className={styles.gate} data-purchase-decision="exact-product" role="dialog" aria-label={copy.productTitle}>
      <div className={styles.header}>
        <span><small>{copy.productEyebrow}</small><strong>{copy.productTitle}</strong></span>
        <span className={styles.badge}>verified reference</span>
      </div>
      <div className={styles.candidates}>
        {decision.decision.candidates.map((candidate) => (
          <button key={candidate.id} type="button" className={styles.candidate} onClick={() => chooseProduct(candidate)}>
            <span className={styles.candidateTop}><strong>{candidate.exactName}</strong><span className={styles.price}>{candidate.referencePrice.label}</span></span>
            <small>{candidate.summary}</small>
            <span className={styles.specs}>{candidate.keySpecs.slice(0, 4).map((spec) => <span key={spec}>{spec}</span>)}</span>
            <a className={styles.source} href={candidate.manufacturerUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>{copy.manufacturer} · {candidate.verifiedAt}</a>
          </button>
        ))}
      </div>
      <p className={styles.note}>{copy.productNote}</p>
    </section>
  ) : (
    <section className={styles.gate} data-purchase-decision="feasibility" role="alert" aria-live="polite">
      <div className={styles.header}>
        <span><small>{copy.feasibilityEyebrow}</small><strong>{copy.feasibilityTitle}</strong></span>
        <span className={styles.badge}>preflight</span>
      </div>
      <p className={styles.alert}>{decision.feasibility.reason}</p>
      <div className={styles.funds}>
        <div><small>{copy.available}</small><strong>{yen(decision.feasibility.availableFundsJPY)}</strong></div>
        <div><small>{copy.floor}</small><strong>{yen(decision.feasibility.minimumProofOfFundsJPY)}</strong></div>
      </div>
      <p className={styles.note}>{copy.feasibilityNote}</p>
    </section>
  );

  return createPortal(content, host);
}
