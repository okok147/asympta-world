"use client";

import { CheckCircle2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  localizeAmbientTask,
  localizeAtlasSnapshot,
  localizeHealth,
  localizeStatus,
  normalizeAtlasLocale,
  uiText,
  type AtlasLocale,
} from "@/lib/atlas-i18n";

type AnyRecord = Record<string, any>;
type DemoSnapshot = { foreground?: AnyRecord; ambient?: AnyRecord[] };

function safeSnapshot(): DemoSnapshot | null {
  try {
    const value = window.__ASYMPTA_DEMO__?.snapshot();
    return value && typeof value === "object" ? value as DemoSnapshot : null;
  } catch {
    return null;
  }
}

function activeTaskForAgent(foreground: AnyRecord, agentId: string) {
  const agent = foreground.agents?.find((item: AnyRecord) => item.id === agentId);
  const byId = agent?.taskId ? foreground.tasks?.find((item: AnyRecord) => item.id === agent.taskId) : undefined;
  return byId ?? foreground.tasks?.find((item: AnyRecord) => item.agentId === agentId && ["moving", "working", "waiting_approval"].includes(item.status));
}

function localizedBubble(task: AnyRecord | undefined, locale: AtlasLocale) {
  if (!task) return uiText("standingBy", locale);
  if (task.scheduleHealth === "obstacle" && task.obstacle) return `${uiText("obstacle", locale)} → ${task.obstacle}`;
  if (task.taskKind === "opportunity") return `${uiText("explore", locale)} → ${task.title}`;
  if (task.scheduleHealth === "ahead") return `${uiText("goingWell", locale)} · ${uiText("eta", locale)} ${task.etaSeconds ?? "—"}s`;
  if (task.status === "waiting_approval") return uiText("waitingApproval", locale);
  return task.title ?? uiText("standingBy", locale);
}

function localizedStatus(task: AnyRecord | undefined, agent: AnyRecord | undefined, locale: AtlasLocale) {
  if (!agent) return "";
  if (!task) return agent.statusLabel ?? localizeStatus(agent.status ?? "idle", locale);
  const eta = typeof task.etaSeconds === "number" ? `${Math.max(0, task.etaSeconds)}s` : "—";
  const progress = `${Math.round(Number(task.progress ?? 0) * 100)}%`;
  if (task.scheduleHealth === "obstacle") return `${localizeHealth("obstacle", locale)} · ${eta}`;
  if (task.taskKind === "opportunity") return `${localizeHealth("exploring", locale)} · ${progress} · ${eta}`;
  if (task.status === "waiting_approval") return uiText("waitingApproval", locale);
  return `${agent.statusLabel ?? localizeStatus(agent.status ?? "", locale)} · ${progress} · ${eta}`;
}

function stabilizeMarkerLanguage() {
  const locale = normalizeAtlasLocale(document.documentElement.lang);
  const raw = safeSnapshot();
  if (!raw?.foreground) return;
  const foreground = localizeAtlasSnapshot(raw.foreground, locale) as AnyRecord;
  const agents = foreground.agents ?? [];

  agents.forEach((agent: AnyRecord) => {
    const marker = document.querySelector<HTMLElement>(`.animal-map-marker--foreground[data-agent-id="${agent.id}"]`);
    if (!marker) return;
    const task = activeTaskForAgent(foreground, agent.id);
    const dialogue = marker.querySelector<HTMLElement>(".animal-map-marker__dialogue");
    const status = marker.querySelector<HTMLElement>(".animal-map-marker__status-text");
    const nextDialogue = localizedBubble(task, locale);
    const nextStatus = localizedStatus(task, agent, locale);
    if (dialogue && dialogue.textContent !== nextDialogue) dialogue.textContent = nextDialogue;
    if (status && status.textContent !== nextStatus) status.textContent = nextStatus;
  });

  (raw.ambient ?? []).forEach((actor: AnyRecord) => {
    const marker = document.querySelector<HTMLElement>(`.animal-map-marker--ambient[data-agent-id="${actor.id}"]`);
    if (!marker) return;
    const dialogue = marker.querySelector<HTMLElement>(".animal-map-marker__dialogue");
    const status = marker.querySelector<HTMLElement>(".animal-map-marker__status-text");
    const nextDialogue = localizeAmbientTask(String(actor.task ?? ""), locale);
    const nextStatus = localizeStatus(String(actor.status ?? ""), locale);
    if (dialogue && dialogue.textContent !== nextDialogue) dialogue.textContent = nextDialogue;
    if (status && status.textContent !== nextStatus) status.textContent = nextStatus;
  });
}

const AUTO_APPROVE_LABEL: Record<AtlasLocale, string> = {
  en: "Auto approve",
  "zh-Hant": "自動批准",
  ja: "自動承認",
};

export function AsymptaDemoControls() {
  const [autoApprove, setAutoApprove] = useState(false);
  const [locale, setLocale] = useState<AtlasLocale>("en");
  const [lift, setLift] = useState(0);
  const lastApprovedRef = useRef<string | null>(null);

  useEffect(() => {
    let queued = false;
    const sync = () => {
      queued = false;
      stabilizeMarkerLanguage();
      setLocale(normalizeAtlasLocale(document.documentElement.lang));
      const approval = Boolean(document.querySelector(".atlas-approval"));
      const agentCard = Boolean(document.querySelector(".atlas-agent-card"));
      setLift(approval ? 178 : agentCard ? 116 : 0);
    };
    const scheduleSync = () => {
      if (queued) return;
      queued = true;
      queueMicrotask(sync);
    };
    sync();
    const observer = new MutationObserver(scheduleSync);
    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["lang", "class"],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!autoApprove) {
      lastApprovedRef.current = null;
      return;
    }
    const timer = window.setInterval(() => {
      const raw = safeSnapshot();
      const pending = raw?.foreground?.pendingApprovals?.[0];
      const id = String(pending?.id ?? "");
      if (!id || id === lastApprovedRef.current) return;
      lastApprovedRef.current = id;
      try {
        window.__ASYMPTA_DEMO__?.approve(id, true);
      } catch {
        lastApprovedRef.current = null;
      }
    }, 160);
    return () => window.clearInterval(timer);
  }, [autoApprove]);

  const stateLabel = useMemo(() => autoApprove ? uiText("on", locale) : uiText("off", locale), [autoApprove, locale]);

  return (
    <button
      type="button"
      className={`atlas-auto-approve-float${autoApprove ? " is-on" : " is-off"}`}
      style={{ bottom: `calc(max(12px, env(safe-area-inset-bottom)) + ${lift}px)` }}
      aria-pressed={autoApprove}
      aria-label={`${AUTO_APPROVE_LABEL[locale]} ${stateLabel}`}
      onClick={() => setAutoApprove((value) => !value)}
    >
      <span className="atlas-auto-approve-icon"><CheckCircle2 size={14} strokeWidth={1.7} /></span>
      <span><small>{AUTO_APPROVE_LABEL[locale]}</small><strong>{stateLabel}</strong></span>
    </button>
  );
}
