"use client";

import { useEffect, useState } from "react";

type Locale = "en" | "zh-Hant" | "ja";

type TaskSnapshot = {
  id: string;
  title: string;
  agentId: string;
  status: string;
  progress: number;
  dependencies: string[];
  actionType: string | null;
};

type AgentSnapshot = {
  id: string;
  name: string;
  side: string;
  role: string;
  status: string;
  taskId: string | null;
};

type ForegroundSnapshot = {
  phase: string;
  workflow: string | null;
  tasks: TaskSnapshot[];
  agents: AgentSnapshot[];
  pendingApprovals: Array<{ id: string }>;
};

type DemoSnapshot = {
  foreground?: ForegroundSnapshot;
};

type ScheduleRow = {
  id: string;
  title: string;
  agentId: string;
  agentName: string;
  agentSide: string;
  taskStatus: string;
  agentStatus: string;
  progress: number;
};

type ResourceRow = {
  key: string;
  agentName: string;
  side: string;
  resource: string;
  state: string;
};

type Projection = {
  locale: Locale;
  phase: string;
  workflow: string | null;
  activeCount: number;
  approvalCount: number;
  rows: ScheduleRow[];
  resources: ResourceRow[];
};

const COPY: Record<Locale, Record<string, string>> = {
  en: {
    schedule: "Schedule",
    status: "Status",
    resources: "Resources",
    ready: "Ready",
    running: "Coordinating",
    waiting_approval: "Waiting for approval",
    completed: "Completed",
    blocked: "Blocked",
    active: "active",
    approval: "approval",
    queued: "Queued",
    moving: "Moving",
    working: "Working",
    sharing: "Sharing",
    waiting: "Waiting",
    returning: "Returning",
    idle: "Ready",
    done: "Done",
    inUse: "in use",
    available: "available",
    next: "next",
  },
  "zh-Hant": {
    schedule: "工作排程",
    status: "狀態",
    resources: "資源",
    ready: "就緒",
    running: "協作中",
    waiting_approval: "等待批准",
    completed: "已完成",
    blocked: "已暫停",
    active: "進行中",
    approval: "待批准",
    queued: "排程中",
    moving: "移動中",
    working: "工作中",
    sharing: "交接中",
    waiting: "等待中",
    returning: "返回中",
    idle: "可用",
    done: "完成",
    inUse: "使用中",
    available: "可用",
    next: "下一步",
  },
  ja: {
    schedule: "タスク予定",
    status: "状態",
    resources: "リソース",
    ready: "準備完了",
    running: "連携中",
    waiting_approval: "承認待ち",
    completed: "完了",
    blocked: "停止中",
    active: "進行中",
    approval: "承認待ち",
    queued: "予定",
    moving: "移動中",
    working: "作業中",
    sharing: "共有中",
    waiting: "待機中",
    returning: "帰還中",
    idle: "利用可能",
    done: "完了",
    inUse: "使用中",
    available: "利用可能",
    next: "次",
  },
};

const RESOURCES: Record<Locale, Record<string, string>> = {
  en: {
    user: "Confirmed preferences",
    customer: "Acceptance criteria",
    business: "Commercial context",
    supplier: "Capacity context",
    operations: "Fulfilment plan",
    finance: "Cost model",
    logistics: "Route capacity",
    support: "Customer context",
    quality: "Specification evidence",
    market: "Demand signals",
  },
  "zh-Hant": {
    user: "已確認偏好",
    customer: "驗收條件",
    business: "商業資訊",
    supplier: "供應產能",
    operations: "履約計畫",
    finance: "成本模型",
    logistics: "路線運力",
    support: "客戶資訊",
    quality: "規格證據",
    market: "需求訊號",
  },
  ja: {
    user: "確認済みの希望",
    customer: "受入条件",
    business: "商取引コンテキスト",
    supplier: "供給能力",
    operations: "履行計画",
    finance: "コストモデル",
    logistics: "配送容量",
    support: "顧客コンテキスト",
    quality: "仕様エビデンス",
    market: "需要シグナル",
  },
};

const ACTIVE_TASK = new Set(["moving", "working", "waiting_approval", "blocked"]);

function currentLocale(): Locale {
  const value = String(document.documentElement.lang || "en").toLowerCase();
  if (value.startsWith("zh")) return "zh-Hant";
  if (value.startsWith("ja")) return "ja";
  return "en";
}

function safeProgress(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(Math.max(0, Math.min(1, value)) * 100);
}

function buildProjection(snapshot: DemoSnapshot, locale: Locale): Projection | null {
  const foreground = snapshot.foreground;
  if (!foreground || !Array.isArray(foreground.tasks) || !Array.isArray(foreground.agents)) return null;

  const agents = new Map(foreground.agents.map((agent) => [agent.id, agent]));
  const unfinished = foreground.tasks.filter((task) => task.status !== "done");
  const active = unfinished.filter((task) => ACTIVE_TASK.has(task.status));
  const queued = unfinished.filter((task) => task.status === "queued");
  const visibleTasks = [...active, ...queued].slice(0, 6);

  const rows: ScheduleRow[] = visibleTasks.map((task) => {
    const agent = agents.get(task.agentId);
    return {
      id: task.id,
      title: task.title,
      agentId: task.agentId,
      agentName: agent?.name ?? task.agentId,
      agentSide: agent?.side ?? "",
      taskStatus: task.status,
      agentStatus: agent?.status ?? "idle",
      progress: safeProgress(task.progress),
    };
  });

  const resourceAgents = rows
    .map((row) => agents.get(row.agentId))
    .filter((agent): agent is AgentSnapshot => Boolean(agent));
  const seen = new Set<string>();
  const resources: ResourceRow[] = [];
  for (const agent of resourceAgents) {
    if (seen.has(agent.id)) continue;
    seen.add(agent.id);
    const activeState = ["moving", "working", "sharing", "waiting", "returning"].includes(agent.status);
    resources.push({
      key: agent.id,
      agentName: agent.name,
      side: agent.side,
      resource: RESOURCES[locale][agent.side] ?? agent.role,
      state: activeState ? COPY[locale].inUse : COPY[locale].available,
    });
    if (resources.length >= 4) break;
  }

  return {
    locale,
    phase: foreground.phase,
    workflow: foreground.workflow,
    activeCount: active.length,
    approvalCount: foreground.pendingApprovals?.length ?? 0,
    rows,
    resources,
  };
}

function focusAgent(agentId: string) {
  const marker = document.querySelector<HTMLElement>(`.animal-map-marker[data-agent-id="${agentId}"]`);
  marker?.click();
}

export function AsymptaSafeSchedule() {
  const [projection, setProjection] = useState<Projection | null>(null);

  useEffect(() => {
    let lastFingerprint = "";

    const sync = () => {
      if (document.visibilityState === "hidden") return;
      let snapshot: DemoSnapshot | undefined;
      try {
        snapshot = window.__ASYMPTA_DEMO__?.snapshot() as DemoSnapshot | undefined;
      } catch {
        return;
      }
      if (!snapshot) return;
      const next = buildProjection(snapshot, currentLocale());
      if (!next) return;
      const fingerprint = JSON.stringify(next);
      if (fingerprint === lastFingerprint) return;
      lastFingerprint = fingerprint;
      setProjection(next);
    };

    sync();
    const timer = window.setInterval(sync, 500);
    return () => window.clearInterval(timer);
  }, []);

  if (!projection) return null;

  const copy = COPY[projection.locale];
  const phase = copy[projection.phase] ?? projection.phase.replaceAll("_", " ");

  return (
    <aside className="atlas-safe-schedule" aria-label={copy.schedule}>
      <header className="atlas-safe-schedule__header">
        <div>
          <small>{copy.schedule}</small>
          <strong>{projection.workflow ?? copy.ready}</strong>
        </div>
        <span className={`atlas-safe-schedule__phase is-${projection.phase}`}><i />{phase}</span>
      </header>

      <div className="atlas-safe-schedule__summary" aria-label={copy.status}>
        <span><strong>{projection.activeCount}</strong> {copy.active}</span>
        {projection.approvalCount > 0 ? <span><strong>{projection.approvalCount}</strong> {copy.approval}</span> : null}
      </div>

      <div className="atlas-safe-schedule__tasks">
        {projection.rows.map((row) => {
          const status = copy[row.taskStatus] ?? copy[row.agentStatus] ?? row.taskStatus;
          const queued = row.taskStatus === "queued";
          return (
            <button key={row.id} type="button" className={`atlas-safe-task is-${row.taskStatus}`} onClick={() => focusAgent(row.agentId)}>
              <span className="atlas-safe-task__rail"><i /></span>
              <span className="atlas-safe-task__body">
                <strong>{row.title}</strong>
                <small>{row.agentName} · {status}</small>
              </span>
              <span className="atlas-safe-task__progress">{queued ? copy.next : `${row.progress}%`}</span>
            </button>
          );
        })}
      </div>

      {projection.resources.length > 0 ? (
        <section className="atlas-safe-resources" aria-label={copy.resources}>
          <div className="atlas-safe-resources__title">{copy.resources}</div>
          <div className="atlas-safe-resources__grid">
            {projection.resources.map((resource) => (
              <div key={resource.key} className="atlas-safe-resource">
                <span className="atlas-safe-resource__dot" data-side={resource.side} />
                <span><strong>{resource.resource}</strong><small>{resource.agentName} · {resource.state}</small></span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </aside>
  );
}
