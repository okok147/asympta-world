"use client";

import { ChevronDown, ChevronUp, Clock3, Compass, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  currentAtlasLocale,
  localizeAgent,
  localizeAmbientTask,
  localizeApproval,
  localizeAtlasSnapshot,
  localizeHealth,
  localizeSide,
  localizeStatus,
  normalizeAtlasLocale,
  uiText,
  type AtlasLocale,
} from "@/lib/atlas-i18n";
import { setExplorePreference } from "@/lib/atlas-simulation";

type AnyRecord = Record<string, any>;
type DemoSnapshot = { foreground?: AnyRecord; ambient?: AnyRecord[]; disclosure?: string };

const TOOL_LABELS: Record<string, { en: string; "zh-Hant": string; ja: string }> = {
  asympta_observe_living_city: { en: "Observe living city", "zh-Hant": "觀察協作城市", ja: "協調都市を観察" },
  asympta_list_workflows: { en: "List workflows", "zh-Hant": "列出工作流", ja: "ワークフロー一覧" },
  asympta_follow_agent: { en: "Follow agent", "zh-Hant": "跟隨角色", ja: "エージェント追従" },
  asympta_request_workflow: { en: "Request workflow", "zh-Hant": "請求工作流", ja: "ワークフローを依頼" },
  asympta_request_external_action: { en: "Request external action", "zh-Hant": "請求外部動作", ja: "外部アクションを依頼" },
};

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

function taskBubble(task: AnyRecord | undefined, locale: AtlasLocale) {
  if (!task) return uiText("standingBy", locale);
  if (task.scheduleHealth === "obstacle" && task.obstacle) return `${uiText("obstacle", locale)} → ${task.obstacle}`;
  if (task.taskKind === "opportunity") return `${uiText("explore", locale)} → ${task.title}`;
  if (task.scheduleHealth === "ahead") return `${uiText("goingWell", locale)} · ${uiText("eta", locale)} ${task.etaSeconds ?? "—"}s`;
  if (task.status === "waiting_approval") return uiText("waitingApproval", locale);
  return task.title ?? uiText("standingBy", locale);
}

function taskStatus(task: AnyRecord | undefined, agent: AnyRecord | undefined, locale: AtlasLocale) {
  if (!agent) return "";
  if (!task) return agent.statusLabel ?? localizeStatus(agent.status ?? "idle", locale);
  const eta = typeof task.etaSeconds === "number" ? `${Math.max(0, task.etaSeconds)}s` : "—";
  const progress = `${Math.round(Number(task.progress ?? 0) * 100)}%`;
  if (task.scheduleHealth === "obstacle") return `${localizeHealth("obstacle", locale)} · ${eta}`;
  if (task.taskKind === "opportunity") return `${localizeHealth("exploring", locale)} · ${progress} · ${eta}`;
  if (task.status === "waiting_approval") return uiText("waitingApproval", locale);
  return `${agent.statusLabel ?? localizeStatus(agent.status ?? "", locale)} · ${progress} · ${eta}`;
}

function toolPermissionFromButton(button: Element | null) {
  const className = button?.querySelector(".atlas-permission")?.className ?? "";
  return String(className).includes("write") ? "WRITE" : "READ";
}

function syncExistingSurface(locale: AtlasLocale, raw: DemoSnapshot | null) {
  if (!raw?.foreground) return;
  const foreground = localizeAtlasSnapshot(raw.foreground, locale) as AnyRecord;
  const tasks = foreground.tasks ?? [];
  const agents = foreground.agents ?? [];

  const map = document.querySelector<HTMLElement>(".map-canvas");
  if (map) map.setAttribute("aria-label", locale === "zh-Hant" ? "互動紙張城市地圖，顯示動物代理與模擬協作" : locale === "ja" ? "動物エージェントと模擬連携を表示する紙調の都市地図" : "Interactive paper city map with animal agents and simulated coordination");
  document.querySelector(".atlas-console")?.setAttribute("aria-label", uiText("coordinationMenu", locale));
  document.querySelector(".atlas-webmcp-inspector")?.setAttribute("aria-label", uiText("webmcpInspector", locale));

  agents.forEach((agent: AnyRecord) => {
    const marker = document.querySelector<HTMLElement>(`.animal-map-marker[data-agent-id="${agent.id}"]`);
    if (!marker) return;
    const task = activeTaskForAgent(foreground, agent.id);
    const role = localizeAgent(agent.id, locale, agent.role ?? "", agent.organisation ?? "");
    const label = `${agent.name} · ${localizeSide(agent.side ?? "", locale)} · ${role.role}`;
    marker.title = label;
    if (marker.tagName === "BUTTON") marker.setAttribute("aria-label", label);
    const dialogue = marker.querySelector<HTMLElement>(".animal-map-marker__dialogue");
    const status = marker.querySelector<HTMLElement>(".animal-map-marker__status-text");
    const bubble = taskBubble(task, locale);
    const statusValue = taskStatus(task, agent, locale);
    if (dialogue && dialogue.textContent !== bubble) dialogue.textContent = bubble;
    if (status && status.textContent !== statusValue) status.textContent = statusValue;
  });

  (raw.ambient ?? []).forEach((actor: AnyRecord) => {
    const marker = document.querySelector<HTMLElement>(`.animal-map-marker[data-agent-id="${actor.id}"]`);
    if (!marker) return;
    const dialogue = marker.querySelector<HTMLElement>(".animal-map-marker__dialogue");
    const status = marker.querySelector<HTMLElement>(".animal-map-marker__status-text");
    const task = localizeAmbientTask(String(actor.task ?? ""), locale);
    if (dialogue && dialogue.textContent !== task) dialogue.textContent = task;
    const statusValue = localizeStatus(String(actor.status ?? ""), locale);
    if (status && status.textContent !== statusValue) status.textContent = statusValue;
    marker.title = `${actor.name} · ${localizeSide(String(actor.side ?? ""), locale)} · ${task}`;
  });

  const selectedMarker = document.querySelector<HTMLElement>(".animal-map-marker--foreground.is-selected");
  const selectedAgent = selectedMarker ? agents.find((agent: AnyRecord) => agent.id === selectedMarker.dataset.agentId) : undefined;
  if (selectedAgent) {
    const task = activeTaskForAgent(foreground, selectedAgent.id);
    const role = localizeAgent(selectedAgent.id, locale, selectedAgent.role ?? "", selectedAgent.organisation ?? "");
    const card = document.querySelector<HTMLElement>(".atlas-agent-card");
    const small = card?.querySelector<HTMLElement>(".atlas-agent-card__top small");
    const statusSpans = card?.querySelectorAll<HTMLElement>(".atlas-agent-status span");
    if (small) small.textContent = `${role.role} · ${role.organisation}`;
    if (statusSpans?.[0]) statusSpans[0].textContent = selectedAgent.statusLabel ?? localizeStatus(selectedAgent.status ?? "", locale);
    if (statusSpans?.[1]) statusSpans[1].textContent = task?.title ?? uiText("standingBy", locale);
    card?.querySelector(".atlas-card-close")?.setAttribute("aria-label", uiText("closeAgent", locale));
  }

  const pending = foreground.pendingApprovals?.[0];
  if (pending) {
    const approval = localizeApproval(pending, tasks, locale);
    const sheet = document.querySelector<HTMLElement>(".atlas-approval");
    const title = sheet?.querySelector<HTMLElement>(".atlas-approval__copy strong");
    const detail = sheet?.querySelector<HTMLElement>(".atlas-approval__copy p");
    const consequence = sheet?.querySelector<HTMLElement>(".atlas-approval__copy small");
    if (title && approval?.title) title.textContent = approval.title;
    if (detail && approval?.detail) detail.textContent = approval.detail;
    if (consequence && approval?.consequence) consequence.textContent = approval.consequence;
  }

  const statusRows = document.querySelectorAll<HTMLElement>(".atlas-status-stack .atlas-tool-state");
  if (statusRows[1]) {
    const visible = raw.ambient?.length ?? 0;
    const moving = agents.filter((agent: AnyRecord) => agent.status === "moving").length;
    statusRows[1].textContent = `${uiText("visualRefresh", locale)} · ${visible} ${uiText("nearbyAmbient", locale)} · ${moving} ${uiText("workflowAgents", locale)}`;
  }

  document.querySelectorAll<HTMLElement>(".atlas-webmcp-tool-list > button").forEach((button) => {
    const name = button.querySelector("small")?.textContent ?? "";
    const strong = button.querySelector<HTMLElement>("strong");
    const permission = button.querySelector<HTMLElement>(".atlas-permission");
    if (strong && TOOL_LABELS[name]) strong.textContent = TOOL_LABELS[name][locale];
    if (permission) permission.textContent = toolPermissionFromButton(button) === "WRITE" ? uiText("write", locale) : uiText("read", locale);
  });

  const jsonBlocks = document.querySelectorAll<HTMLElement>(".atlas-json-grid pre");
  if (jsonBlocks[0]) {
    try {
      const call = JSON.parse(jsonBlocks[0].textContent || "{}");
      call.locale = locale;
      if (call.arguments?.reason === "Demonstration request from the Asympta World WebMCP inspector.") {
        call.arguments.reason = locale === "zh-Hant" ? "由 Asympta World WebMCP 即時檢視提出的示範請求。" : locale === "ja" ? "Asympta World WebMCP ライブインスペクタからのデモ依頼。" : call.arguments.reason;
      }
      jsonBlocks[0].textContent = JSON.stringify(call, null, 2);
    } catch {}
  }
  if (jsonBlocks[1]) {
    const selected = selectedAgent ?? agents.find((agent: AnyRecord) => agent.status === "moving") ?? agents[0];
    const task = selected ? activeTaskForAgent(foreground, selected.id) : undefined;
    const activeTool = document.querySelector(".atlas-webmcp-tool-list > button.is-active");
    const permission = toolPermissionFromButton(activeTool);
    const live = {
      locale,
      phase: foreground.phase,
      phaseLabel: foreground.phaseLabel,
      permission,
      permissionLabel: permission === "WRITE" ? uiText("write", locale) : uiText("read", locale),
      exploreMode: foreground.scheduler?.exploreMode ?? foreground.exploreMode ?? true,
      agent: selected ? { id: selected.id, name: selected.name, side: selected.side, sideLabel: selected.sideLabel, status: selected.status, statusLabel: selected.statusLabel } : null,
      task: task ? { id: task.id, title: task.title, status: task.status, statusLabel: task.statusLabel, progress: task.progress, scheduleHealth: task.scheduleHealth, scheduleHealthLabel: task.scheduleHealthLabel, etaSeconds: task.etaSeconds, obstacle: task.obstacle ?? null, taskKind: task.taskKind } : null,
      pendingApproval: foreground.pendingApprovals?.[0] ?? null,
      visibleAmbientAgents: raw.ambient?.length ?? 0,
    };
    jsonBlocks[1].textContent = JSON.stringify(live, null, 2);
  }

  document.querySelector('[aria-label="Zoom in"]')?.setAttribute("aria-label", uiText("zoomIn", locale));
  document.querySelector('[aria-label="Zoom out"]')?.setAttribute("aria-label", uiText("zoomOut", locale));
  document.querySelector('[aria-label="Recenter map"]')?.setAttribute("aria-label", uiText("recenter", locale));
}

export function AsymptaRuntimeOverlay() {
  const [snapshot, setSnapshot] = useState<DemoSnapshot | null>(null);
  const [locale, setLocale] = useState<AtlasLocale>("en");
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [followingAgentId, setFollowingAgentId] = useState<string | null>(null);
  const [surfaceState, setSurfaceState] = useState({ menuOpen: false, agentCard: false, approval: false });

  useEffect(() => {
    const read = () => {
      const nextLocale = normalizeAtlasLocale(document.documentElement.lang);
      const nextSnapshot = safeSnapshot();
      const selectedMarker = document.querySelector<HTMLElement>(".animal-map-marker--foreground.is-selected");
      setLocale((current) => current === nextLocale ? current : nextLocale);
      setSnapshot(nextSnapshot);
      setFollowingAgentId(selectedMarker?.dataset.agentId ?? null);
      setSurfaceState({
        menuOpen: Boolean(document.querySelector(".atlas-console.is-open")),
        agentCard: Boolean(document.querySelector(".atlas-agent-card")),
        approval: Boolean(document.querySelector(".atlas-approval")),
      });
    };
    read();
    const timer = window.setInterval(read, 250);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const sync = () => syncExistingSurface(currentAtlasLocale(), safeSnapshot());
    sync();
    const timer = window.setInterval(sync, 120);
    return () => window.clearInterval(timer);
  }, []);

  const foreground = useMemo(() => localizeAtlasSnapshot(snapshot?.foreground, locale) as AnyRecord | null, [snapshot, locale]);
  const rows = foreground?.scheduler?.active ?? [];
  const exploreOn = foreground?.scheduler?.exploreMode ?? foreground?.exploreMode ?? true;
  const visibleRows = scheduleOpen ? rows.slice(0, 7) : rows.slice(0, 1);
  const primary = rows[0];

  const toggleExplore = () => {
    const next = !exploreOn;
    setExplorePreference(next);
    try { window.__ASYMPTA_DEMO__?.advance(0); } catch {}
    setSnapshot(safeSnapshot());
  };

  const followScheduledAgent = (agentId: string) => {
    const marker = document.querySelector<HTMLButtonElement>(`.animal-map-marker--foreground[data-agent-id="${agentId}"]`);
    if (!marker) return;
    marker.click();
    setFollowingAgentId(agentId);
  };

  return (
    <div
      className="atlas-runtime-overlay"
      data-menu-open={surfaceState.menuOpen ? "true" : "false"}
      data-agent-card={surfaceState.agentCard ? "true" : "false"}
      data-approval={surfaceState.approval ? "true" : "false"}
      aria-hidden={false}
    >
      <aside className={`atlas-schedule-float${scheduleOpen ? " is-open" : ""}`} aria-label={uiText("scheduleQueue", locale)}>
        <button type="button" className="atlas-schedule-head" aria-expanded={scheduleOpen} onClick={() => setScheduleOpen((value) => !value)}>
          <span className="atlas-schedule-icon"><Clock3 size={15} strokeWidth={1.7} /></span>
          <span className="atlas-schedule-heading">
            <small>{uiText("schedule", locale)}</small>
            <strong>{primary?.title ?? uiText("standingBy", locale)}</strong>
          </span>
          <span className={`atlas-schedule-health atlas-schedule-health--${primary?.health ?? "queued"}`}>
            {primary?.eta ?? "—"}
          </span>
          {scheduleOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {scheduleOpen ? (
          <div className="atlas-schedule-list">
            {visibleRows.map((row: AnyRecord, index: number) => {
              const agent = foreground?.agents?.find((item: AnyRecord) => item.id === row.agentId);
              const isFollowing = followingAgentId === row.agentId;
              return (
                <button
                  type="button"
                  className={`atlas-schedule-row${isFollowing ? " is-following" : ""}`}
                  key={row.id}
                  aria-pressed={isFollowing}
                  onClick={() => followScheduledAgent(row.agentId)}
                >
                  <span className={`atlas-schedule-dot atlas-schedule-dot--${row.health ?? "queued"}`} />
                  <span className="atlas-schedule-copy">
                    <small>{index === 0 ? uiText("current", locale) : uiText("next", locale)} · {agent?.name ?? row.agentId}</small>
                    <strong>{row.title}</strong>
                    <em>{row.healthLabel ?? localizeHealth(row.health ?? "queued", locale)}{row.obstacle ? ` · ${row.obstacle}` : ""}</em>
                  </span>
                  <span className="atlas-schedule-eta">{row.eta ?? "—"}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </aside>

      <button
        type="button"
        className={`atlas-explore-float${exploreOn ? " is-on" : " is-off"}`}
        aria-pressed={exploreOn}
        aria-label={`${uiText("exploreMode", locale)} ${exploreOn ? uiText("on", locale) : uiText("off", locale)}`}
        onClick={toggleExplore}
      >
        <span className="atlas-explore-icon">{exploreOn ? <Sparkles size={14} strokeWidth={1.7} /> : <Compass size={14} strokeWidth={1.7} />}</span>
        <span><small>{uiText("autoExplore", locale)}</small><strong>{exploreOn ? uiText("on", locale) : uiText("off", locale)}</strong></span>
      </button>
    </div>
  );
}
