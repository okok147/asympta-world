"use client";

import { ChevronDown, ChevronUp, CircleCheck, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";

import {
  subscribeAsymptaCurrentRequest,
  type AsymptaCurrentRequest,
  type AsymptaCurrentRequestStatus,
} from "@/lib/asympta-current-request";
import { MARKETPLACE_PROFILE_REQUIRED_EVENT } from "@/lib/asympta-marketplace-intent";

type Locale = "en" | "zh-Hant" | "ja";

const COPY: Record<Locale, {
  title: string;
  waiting: string;
  sourceHuman: string;
  sourceWebMcp: string;
  actor: string;
  destination: string;
  sources: (count: number) => string;
  noLinks: string;
  statuses: Record<AsymptaCurrentRequestStatus, string>;
}> = {
  en: {
    title: "Current request",
    waiting: "A consequential action still needs your approval.",
    sourceHuman: "Public agent",
    sourceWebMcp: "WebMCP request",
    actor: "Agent",
    destination: "Destination",
    sources: (count) => `${count} source link${count === 1 ? "" : "s"}`,
    noLinks: "Cross-checked · source links not verified",
    statuses: {
      interpreting: "Validating goal",
      gathering: "Agents researching",
      returning: "Cross-checking",
      completed: "Result returned",
      waiting_input: "Needs your input",
      awaiting_confirmation: "Awaiting approval",
      failed: "Could not complete",
    },
  },
  "zh-Hant": {
    title: "目前請求",
    waiting: "涉及實際影響的行動仍需要你批准。",
    sourceHuman: "公開代理",
    sourceWebMcp: "WebMCP 請求",
    actor: "代理",
    destination: "目的地",
    sources: (count) => `${count} 個來源連結`,
    noLinks: "已交叉檢查 · 未驗證來源連結",
    statuses: {
      interpreting: "正在確認目標",
      gathering: "多個代理研究中",
      returning: "正在交叉檢查",
      completed: "結果已返回",
      waiting_input: "等待你補充",
      awaiting_confirmation: "等待你批准",
      failed: "未能完成",
    },
  },
  ja: {
    title: "現在のリクエスト",
    waiting: "影響を伴う操作には、引き続きあなたの承認が必要です。",
    sourceHuman: "公開エージェント",
    sourceWebMcp: "WebMCP リクエスト",
    actor: "エージェント",
    destination: "行き先",
    sources: (count) => `${count} 件の情報源リンク`,
    noLinks: "相互確認済み · 情報源リンク未検証",
    statuses: {
      interpreting: "目標を確認中",
      gathering: "複数エージェントが調査中",
      returning: "相互確認中",
      completed: "結果が戻りました",
      waiting_input: "入力待ち",
      awaiting_confirmation: "承認待ち",
      failed: "完了できませんでした",
    },
  },
};

function currentLocale(): Locale {
  const value = String(document.documentElement.lang || "en").toLowerCase();
  if (value.startsWith("zh")) return "zh-Hant";
  if (value.startsWith("ja")) return "ja";
  return "en";
}

export function AsymptaSafeSchedule() {
  const [locale, setLocale] = useState<Locale>("en");
  const [request, setRequest] = useState<AsymptaCurrentRequest | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const syncLocale = () => setLocale(currentLocale());
    const showMarketplaceProfile = () => setExpanded(true);
    queueMicrotask(syncLocale);
    const observer = new MutationObserver(syncLocale);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    const unsubscribe = subscribeAsymptaCurrentRequest((next) => {
      setRequest(next);
      if (["awaiting_confirmation", "waiting_input", "failed"].includes(next.status)) setExpanded(true);
    });
    window.addEventListener(MARKETPLACE_PROFILE_REQUIRED_EVENT, showMarketplaceProfile);
    return () => {
      observer.disconnect();
      unsubscribe();
      window.removeEventListener(MARKETPLACE_PROFILE_REQUIRED_EVENT, showMarketplaceProfile);
    };
  }, []);

  if (!request) return null;

  const copy = COPY[locale];
  const needsDecision = request.status === "awaiting_confirmation";
  const verifiedLinks = request.sourceCount > 0;
  const permission = request.permission === "WRITE_REQUEST" ? "WRITE · REQUEST" : "READ";

  return (
    <aside
      className={`atlas-safe-schedule asympta-request-card${expanded ? " is-expanded" : " is-collapsed"}`}
      aria-label={copy.title}
      data-request-status={request.status}
      data-request-source={request.source}
    >
      <button
        type="button"
        className="atlas-safe-schedule__header asympta-request-card__header"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        <span className="asympta-request-card__heading">
          <small>{copy.title}</small>
          <strong>{request.goal ?? request.intent}</strong>
        </span>
        <span className={`asympta-request-card__permission is-${request.permission.toLowerCase()}`}>{permission}</span>
        {expanded ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
      </button>

      <div className="atlas-safe-schedule__summary asympta-request-card__summary" aria-live="polite">
        <span className={`asympta-request-card__status is-${request.status}`}>
          {request.status === "completed" ? <CircleCheck size={12} aria-hidden="true" /> : needsDecision ? <ShieldAlert size={12} aria-hidden="true" /> : <i />}
          <strong>{copy.statuses[request.status]}</strong>
        </span>
        <span className="asympta-request-card__source">
          {request.source === "webmcp" ? copy.sourceWebMcp : copy.sourceHuman}
        </span>
      </div>

      {expanded ? (
        <div className="asympta-request-card__details">
          <dl>
            <div><dt>{copy.actor}</dt><dd>{request.actor}</dd></div>
            {request.destination ? <div><dt>{copy.destination}</dt><dd>{request.destination}</dd></div> : null}
          </dl>
          <p className="asympta-request-card__step">{request.step}</p>
          {request.kind === "research" ? (
            <p className={`asympta-request-card__evidence${verifiedLinks ? " has-links" : ""}`}>
              {verifiedLinks ? copy.sources(request.sourceCount) : copy.noLinks}
            </p>
          ) : null}
          {needsDecision ? <p className="asympta-request-card__decision"><ShieldAlert size={13} aria-hidden="true" />{copy.waiting}</p> : null}
          {request.events.length > 1 ? (
            <ol className="asympta-request-card__events">
              {request.events.slice(-3).map((event, index) => <li key={`${request.requestId}-${index}-${event}`}>{event}</li>)}
            </ol>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}
