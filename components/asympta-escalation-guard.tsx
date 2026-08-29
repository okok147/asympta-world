"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { AnimalPortrait } from "@/components/asympta-animal-art";
import {
  decideWorkflowEscalation,
  foregroundProgressSignature,
  type ForegroundSnapshot,
  type WorkflowId,
} from "@/lib/asympta-escalation-policy";

type Locale = "en" | "zh-Hant" | "ja";
type DemoApi = {
  snapshot: () => { foreground?: ForegroundSnapshot };
  startWorkflow: (workflowId: WorkflowId) => unknown;
  approve: (approvalId: string, approved: boolean) => unknown;
};

type NoticeCode = "auto-approve-recovery" | "human-authority-required" | "safe-replay";
type Notice = { code: NoticeCode; workflow?: string | null };

const POLL_MS = 650;
const NOTICE_MS = 5_200;

const COPY: Record<Locale, Record<NoticeCode | "title", string>> = {
  en: {
    title: "Senior Coordinator",
    "auto-approve-recovery": "No progress was detected at an Auto Approve checkpoint. The senior agent recovered the missed simulated approval and continued the workflow.",
    "human-authority-required": "This step still needs a human decision. The senior agent escalated it, clarified the dependency, and will not override human authority.",
    "safe-replay": "The workflow stopped making progress. The senior agent chose a clean safe replay so the demo cannot remain permanently stuck.",
  },
  "zh-Hant": {
    title: "高階協調代理",
    "auto-approve-recovery": "系統在自動批准節點偵測到長時間沒有進度。高階代理已補救漏掉的模擬批准並繼續流程。",
    "human-authority-required": "這一步仍需要人類決定。高階代理已升級處理並釐清依賴，但不會越權取代人類批准。",
    "safe-replay": "工作流長時間沒有任何進度。高階代理已決定從安全基準重新執行，避免示範永久卡死。",
  },
  ja: {
    title: "上位調整エージェント",
    "auto-approve-recovery": "自動承認チェックポイントで進行停止を検知しました。上位エージェントが欠落したシミュレーション承認を復旧し、処理を継続しました。",
    "human-authority-required": "この手順は人の判断が必要です。上位エージェントがエスカレーションして依存関係を整理しましたが、人の権限を上書きしません。",
    "safe-replay": "ワークフローの進行が停止しました。上位エージェントが安全な再実行を選び、デモが永久停止しないよう復旧しました。",
  },
};

function browserWindow() {
  return window as unknown as { __ASYMPTA_DEMO__?: DemoApi };
}

function currentLocale(): Locale {
  const value = document.documentElement.lang.toLowerCase();
  if (value.startsWith("zh")) return "zh-Hant";
  if (value.startsWith("ja")) return "ja";
  return "en";
}

function autoApproveIsOn() {
  const toggles = document.querySelectorAll<HTMLButtonElement>(".atlas-safe-automation__toggle");
  return toggles.length >= 2 && toggles[1].getAttribute("aria-pressed") === "true";
}

export function AsymptaEscalationGuard() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [locale, setLocale] = useState<Locale>("en");
  const signatureRef = useRef("");
  const lastProgressAtRef = useRef(0);
  const handledDecisionRef = useRef("");
  const noticeSequenceRef = useRef(0);

  useEffect(() => {
    const tick = () => {
      const nextTarget = document.querySelector<HTMLElement>(".map-app");
      if (nextTarget) setTarget((value) => value === nextTarget ? value : nextTarget);
      const nextLocale = currentLocale();
      setLocale((value) => value === nextLocale ? value : nextLocale);

      const api = browserWindow().__ASYMPTA_DEMO__;
      if (!api) return;
      let foreground: ForegroundSnapshot | undefined;
      try {
        foreground = api.snapshot()?.foreground;
      } catch {
        return;
      }
      if (!foreground) return;

      const now = performance.now();
      const signature = foregroundProgressSignature(foreground);
      if (!signatureRef.current || signature !== signatureRef.current) {
        signatureRef.current = signature;
        lastProgressAtRef.current = now;
        handledDecisionRef.current = "";
        return;
      }

      const stagnantMs = Math.max(0, now - lastProgressAtRef.current);
      const decision = decideWorkflowEscalation(foreground, stagnantMs, autoApproveIsOn());
      if (decision.kind === "none") return;

      const decisionKey = `${decision.kind}:${decision.kind === "restart-workflow" ? decision.workflowId : decision.approvalId}`;
      if (handledDecisionRef.current === decisionKey) return;
      handledDecisionRef.current = decisionKey;
      lastProgressAtRef.current = now;

      if (decision.kind === "approve-missed-auto") {
        try { api.approve(decision.approvalId, true); } catch {}
      } else if (decision.kind === "restart-workflow") {
        try { api.startWorkflow(decision.workflowId); } catch {}
      }

      const code = decision.code;
      setNotice({ code, workflow: foreground.workflow ?? null });
      const sequence = ++noticeSequenceRef.current;
      window.setTimeout(() => {
        if (noticeSequenceRef.current === sequence) setNotice(null);
      }, NOTICE_MS);
    };

    const kickoff = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, POLL_MS);
    return () => {
      window.clearTimeout(kickoff);
      window.clearInterval(timer);
    };
  }, []);

  if (!target) return null;
  const copy = COPY[locale];

  return createPortal(
    <>
      <style>{`
        .asympta-escalation-notice{position:absolute;z-index:92;top:92px;right:14px;width:min(308px,calc(100% - 28px));display:grid;grid-template-columns:42px minmax(0,1fr);gap:10px;align-items:center;padding:10px 11px;border:1px solid rgba(67,63,56,.12);border-radius:14px;background:rgba(249,246,238,.96);box-shadow:0 8px 24px rgba(54,50,42,.08);pointer-events:none;color:#514d46}.asympta-escalation-notice__avatar{width:42px;height:42px}.asympta-escalation-notice strong,.asympta-escalation-notice p{display:block;margin:0}.asympta-escalation-notice strong{font-size:10px;line-height:1.2}.asympta-escalation-notice small{display:block;margin-top:2px;color:#8b8277;font-size:7px;letter-spacing:.07em;text-transform:uppercase}.asympta-escalation-notice p{margin-top:5px;color:#6d675f;font-size:8px;line-height:1.45}.asympta-escalation-notice i{position:absolute;left:0;top:0;bottom:0;width:3px;border-radius:14px 0 0 14px;background:#806b9c;opacity:.7}@media(max-width:700px){.asympta-escalation-notice{top:116px;right:10px;width:min(290px,calc(100% - 20px))}}@media(prefers-reduced-motion:no-preference){.asympta-escalation-notice{animation:asympta-escalation-in .2s ease-out}}@keyframes asympta-escalation-in{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
      `}</style>
      {notice ? (
        <aside className="asympta-escalation-notice" aria-live="polite" data-code={notice.code}>
          <i aria-hidden="true" />
          <AnimalPortrait id="agent-senior-coordinator" side="operations" className="asympta-escalation-notice__avatar" />
          <div>
            <strong>{copy.title}</strong>
            <small>{notice.workflow ?? "Asympta World"}</small>
            <p>{copy[notice.code]}</p>
          </div>
        </aside>
      ) : null}
    </>,
    target,
  );
}
