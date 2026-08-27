"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type MissionSubtask = {
  id: string;
  title: string;
  status: string;
  progress: number;
  assignedAgentName?: string;
};

type Mission = {
  id: string;
  title: string;
  status: string;
  progress: number;
  subtasks: MissionSubtask[];
  collaborators: string[];
  currentEncounterId?: string;
  updatedAt: number;
};

type Encounter = {
  id: string;
  missionId: string;
  subtaskId: string;
  participants: string[];
  phase: string;
  completed: boolean;
  updatedAt: number;
};

type CityTransaction = {
  id: string;
  at: number;
  agentId: string;
  action: string;
  itemId?: string;
  itemName?: string;
  quantity?: number;
  actorDelta: string;
  summary: string;
};

type CityState = {
  externalUnlimitedCredits?: boolean;
  externalResources?: number;
  externalInventory?: Record<string, number>;
  externalServices?: Record<string, number>;
  transactions?: CityTransaction[];
  businesses?: Array<{
    products: Array<{ id: string; name: string }>;
    services: Array<{ id: string; name: string }>;
  }>;
};

type InventoryKind = "product" | "service" | "resource" | "output";
type InventoryItem = {
  id: string;
  label: string;
  quantity: number;
  kind: InventoryKind;
  source: string;
  updatedAt: number;
};

type InventoryState = { version: 1; items: InventoryItem[] };
type ProcessUpdate = {
  id: string;
  at: number;
  label: string;
  detail: string;
  progress: number;
  tone: "planning" | "moving" | "talking" | "working" | "done" | "transaction" | "blocked";
};

type DerivedProcess = Omit<ProcessUpdate, "at">;

type BehaviorDetail = {
  actorName?: string;
  message?: string;
  partnerName?: string;
  durationMs?: number;
};

const MISSIONS_KEY = "asympta-user-missions-v1";
const ENCOUNTERS_KEY = "asympta-encounters-v1";
const CITY_KEY = "asympta-latent-city-v1";
const INVENTORY_KEY = "asympta-user-inventory-v1";
const UPDATES_KEY = "asympta-user-task-updates-v1";

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // The runtime remains functional in memory-only mode.
  }
}

function trim(text: string, max = 54) {
  const clean = text.trim();
  return clean.length > max ? clean.slice(0, max - 1).trimEnd() + "…" : clean;
}

function missionOutputLabel(title: string) {
  const lower = title.toLowerCase();
  if (/(design|logo|brand|visual)/.test(lower)) return "Design output · " + trim(title, 34);
  if (/(research|report|analysis)/.test(lower)) return "Research output · " + trim(title, 34);
  if (/(website|frontend|web|app)/.test(lower)) return "Build output · " + trim(title, 34);
  if (/(automation|workflow)/.test(lower)) return "Workflow output · " + trim(title, 34);
  if (/(copy|content|write|post)/.test(lower)) return "Content output · " + trim(title, 34);
  if (/(print|poster|card)/.test(lower)) return "Print output · " + trim(title, 34);
  return "Task output · " + trim(title, 36);
}

function syncInventory(city: CityState, missions: Mission[]) {
  const productNames = new Map<string, string>();
  const serviceNames = new Map<string, string>();
  city.businesses?.forEach((business) => {
    business.products.forEach((item) => productNames.set(item.id, item.name));
    business.services.forEach((item) => serviceNames.set(item.id, item.name));
  });

  const now = Date.now();
  const items: InventoryItem[] = [];
  Object.entries(city.externalInventory ?? {}).forEach(([id, quantity]) => {
    if (quantity <= 0) return;
    items.push({
      id: "product:" + id,
      label: productNames.get(id) ?? id,
      quantity,
      kind: "product",
      source: "city",
      updatedAt: now,
    });
  });
  Object.entries(city.externalServices ?? {}).forEach(([id, quantity]) => {
    if (quantity <= 0) return;
    items.push({
      id: "service:" + id,
      label: serviceNames.get(id) ?? id,
      quantity,
      kind: "service",
      source: "city",
      updatedAt: now,
    });
  });
  const resources = Math.max(0, Math.floor(city.externalResources ?? 0));
  if (resources > 0) {
    items.push({
      id: "resource:general",
      label: "General resource",
      quantity: resources,
      kind: "resource",
      source: "city",
      updatedAt: now,
    });
  }
  missions
    .filter((mission) => mission.status === "completed")
    .forEach((mission) => {
      items.push({
        id: "mission:" + mission.id,
        label: missionOutputLabel(mission.title),
        quantity: 1,
        kind: "output",
        source: mission.id,
        updatedAt: mission.updatedAt,
      });
    });

  const inventory: InventoryState = {
    version: 1,
    items: items.sort((a, b) => b.updatedAt - a.updatedAt),
  };
  writeJson(INVENTORY_KEY, inventory);
  return inventory;
}

function phaseLabel(phase: string) {
  if (phase === "approach") return "前往協作";
  if (phase === "greet") return "開始對話";
  if (phase === "discuss") return "討論方案";
  if (phase === "deal") return "確認合作";
  if (phase === "close") return "合作成立";
  if (phase === "depart") return "返回任務";
  return "處理任務";
}

function deriveMissionProcess(missions: Mission[], encounters: Encounter[]): DerivedProcess | null {
  const active =
    missions.find((mission) => mission.status !== "completed" && mission.status !== "new") ??
    missions.find((mission) => mission.status !== "completed");
  const recentCompleted = [...missions]
    .filter((mission) => mission.status === "completed")
    .sort((a, b) => b.updatedAt - a.updatedAt)[0];

  if (!active && recentCompleted && Date.now() - recentCompleted.updatedAt < 8000) {
    return {
      id: recentCompleted.id + ":completed",
      label: "任務完成",
      detail: missionOutputLabel(recentCompleted.title),
      progress: 100,
      tone: "done",
    };
  }
  if (!active) return null;

  const currentSubtask = active.subtasks.find((subtask) => subtask.status !== "completed");
  const encounter = active.currentEncounterId
    ? encounters.find((candidate) => candidate.id === active.currentEncounterId)
    : undefined;

  if (encounter && !encounter.completed) {
    return {
      id: [active.id, encounter.id, encounter.phase].join(":"),
      label: phaseLabel(encounter.phase),
      detail: trim(encounter.participants[1] ?? currentSubtask?.title ?? active.title),
      progress: active.progress,
      tone: encounter.phase === "approach" || encounter.phase === "depart" ? "moving" : "talking",
    };
  }

  if (active.status === "planning" || active.status === "new") {
    return {
      id: active.id + ":planning",
      label: active.status === "new" ? "任務排隊" : "開始任務",
      detail: trim(active.title),
      progress: active.progress,
      tone: "planning",
    };
  }
  if (active.status === "hiring") {
    return {
      id: active.id + ":hiring:" + (currentSubtask?.id ?? "none"),
      label: "尋找協作者",
      detail: trim(currentSubtask?.title ?? active.title),
      progress: active.progress,
      tone: "talking",
    };
  }
  if (active.status === "working") {
    return {
      id: active.id + ":working:" + (currentSubtask?.id ?? "none") + ":" + String(Math.floor(active.progress / 10)),
      label: "執行任務",
      detail: trim(currentSubtask?.title ?? active.title),
      progress: active.progress,
      tone: "working",
    };
  }
  if (active.status === "blocked") {
    return {
      id: active.id + ":blocked",
      label: "重新規劃",
      detail: trim(currentSubtask?.title ?? active.title),
      progress: active.progress,
      tone: "blocked",
    };
  }
  return {
    id: active.id + ":" + active.status,
    label: "處理任務",
    detail: trim(currentSubtask?.title ?? active.title),
    progress: active.progress,
    tone: "working",
  };
}

function behaviorProcess(detail: BehaviorDetail): DerivedProcess | null {
  if (detail.actorName !== "Your Agent") return null;
  const message = detail.message ?? "";
  const phase = message.match(/Mission encounter · (\w+)/)?.[1];
  if (phase) {
    return {
      id: "behavior:mission:" + phase + ":" + String(Date.now()),
      label: phaseLabel(phase),
      detail: trim(detail.partnerName ?? "Mission collaborator"),
      progress: 0,
      tone: phase === "approach" || phase === "depart" ? "moving" : "talking",
    };
  }
  if (message.includes("Mission accepted")) {
    return { id: "behavior:start:" + String(Date.now()), label: "開始任務", detail: "規劃路線與資源", progress: 0, tone: "planning" };
  }
  if (message.includes("Collaboration executing")) {
    return { id: "behavior:work:" + String(Date.now()), label: "執行任務", detail: trim(detail.partnerName ?? "Collaborator working"), progress: 0, tone: "working" };
  }
  if (message.includes("strategy updated")) {
    return { id: "behavior:strategy:" + String(Date.now()), label: "重新規劃", detail: "更新任務策略", progress: 0, tone: "blocked" };
  }
  if (message) {
    return {
      id: "behavior:city:" + String(Date.now()),
      label: "前往執行",
      detail: trim(message),
      progress: 0,
      tone: "moving",
    };
  }
  return null;
}

function appendUpdate(update: DerivedProcess, updates: ProcessUpdate[]) {
  const existing = updates[0];
  if (existing && existing.id === update.id) return updates;
  const next: ProcessUpdate[] = [{ ...update, at: Date.now() }, ...updates].slice(0, 8);
  writeJson(UPDATES_KEY, next);
  return next;
}

export function UserTaskProcessRuntime() {
  const lastCityTransactionRef = useRef<string>("");
  const ephemeralRef = useRef<{ process: DerivedProcess; until: number } | null>(null);
  const [agentHost, setAgentHost] = useState<HTMLElement | null>(null);
  const [menuHost, setMenuHost] = useState<HTMLElement | null>(null);
  const [resourceHost, setResourceHost] = useState<HTMLElement | null>(null);
  const [process, setProcess] = useState<DerivedProcess | null>(null);
  const [inventory, setInventory] = useState<InventoryState>({ version: 1, items: [] });
  const [updates, setUpdates] = useState<ProcessUpdate[]>([]);

  useEffect(() => {
    setUpdates(readJson<ProcessUpdate[]>(UPDATES_KEY, []));
    setInventory(readJson<InventoryState>(INVENTORY_KEY, { version: 1, items: [] }));

    const onBehavior = (event: Event) => {
      const next = behaviorProcess((event as CustomEvent<BehaviorDetail>).detail ?? {});
      if (!next) return;
      ephemeralRef.current = { process: next, until: Date.now() + 5200 };
      setProcess(next);
      setUpdates((current) => appendUpdate(next, current));
    };
    window.addEventListener("asympta:agent-behavior", onBehavior);
    return () => window.removeEventListener("asympta:agent-behavior", onBehavior);
  }, []);

  useEffect(() => {
    const sync = () => {
      const nextAgentHost = document.querySelector<HTMLElement>(".mission-user-agent");
      const nextMenuHost = document.querySelector<HTMLElement>(".agent-task-panel");
      const nextResourceHost = document.querySelector<HTMLElement>(".agent-resource-row");
      if (nextAgentHost !== agentHost) setAgentHost(nextAgentHost);
      if (nextMenuHost !== menuHost) setMenuHost(nextMenuHost);
      if (nextResourceHost !== resourceHost) setResourceHost(nextResourceHost);

      const missions = readJson<Mission[]>(MISSIONS_KEY, []);
      const encounters = readJson<Encounter[]>(ENCOUNTERS_KEY, []);
      const city = readJson<CityState>(CITY_KEY, {});
      const nextInventory = syncInventory(city, missions);
      setInventory(nextInventory);

      const latestUserTransaction = city.transactions?.find((transaction) => transaction.agentId === "your-agent");
      if (latestUserTransaction && latestUserTransaction.id !== lastCityTransactionRef.current) {
        lastCityTransactionRef.current = latestUserTransaction.id;
        if (Date.now() - latestUserTransaction.at < 6500) {
          const transactionProcess: DerivedProcess = {
            id: "transaction:" + latestUserTransaction.id,
            label: "完成互動",
            detail: trim(latestUserTransaction.actorDelta + " · " + latestUserTransaction.summary),
            progress: 100,
            tone: "transaction",
          };
          ephemeralRef.current = { process: transactionProcess, until: Date.now() + 4800 };
          setProcess(transactionProcess);
          setUpdates((current) => appendUpdate(transactionProcess, current));
          return;
        }
      }

      const ephemeral = ephemeralRef.current;
      if (ephemeral && ephemeral.until > Date.now()) {
        setProcess(ephemeral.process);
        return;
      }
      if (ephemeral && ephemeral.until <= Date.now()) ephemeralRef.current = null;

      const missionProcess = deriveMissionProcess(missions, encounters);
      setProcess(missionProcess);
      if (missionProcess) setUpdates((current) => appendUpdate(missionProcess, current));
    };

    const initial = window.setTimeout(sync, 0);
    const timer = window.setInterval(sync, 460);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [agentHost, menuHost, resourceHost]);

  const visibleInventory = useMemo(() => inventory.items.slice(0, 6), [inventory.items]);
  const visibleUpdates = useMemo(() => updates.slice(0, 4), [updates]);

  return (
    <>
      <style>{`
        .user-task-process-chip {
          position: absolute;
          z-index: 72;
          left: 50%;
          bottom: calc(100% + 46px);
          display: grid;
          min-width: 116px;
          max-width: 190px;
          padding: 6px 8px 7px;
          transform: translateX(-50%);
          border: 1px solid rgba(112,124,115,.17);
          border-radius: 11px;
          background: rgba(248,247,241,.92);
          box-shadow: 0 6px 20px rgba(54,63,58,.065);
          color: #59635d;
          pointer-events: none;
          backdrop-filter: blur(10px);
        }
        .user-task-process-chip strong {
          overflow: hidden;
          font-family: var(--pixel-font);
          font-size: .34rem;
          letter-spacing: .025em;
          line-height: 1.2;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .user-task-process-chip small {
          margin-top: 3px;
          overflow: hidden;
          color: #7a827d;
          font-size: .38rem;
          line-height: 1.15;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .user-task-process-chip i {
          display: block;
          width: 100%;
          height: 2px;
          margin-top: 5px;
          overflow: hidden;
          border-radius: 99px;
          background: rgba(110,122,113,.1);
        }
        .user-task-process-chip i::after {
          content: "";
          display: block;
          width: var(--task-progress, 0%);
          height: 100%;
          border-radius: inherit;
          background: #7a8eb5;
        }
        .user-task-process-chip[data-tone="done"],
        .user-task-process-chip[data-tone="transaction"] { border-color: rgba(111,142,119,.24); }
        .user-task-process-chip[data-tone="blocked"] { border-color: rgba(158,117,99,.25); }

        .agent-task-panel .agent-resource-row > .agent-resource-pill:nth-child(1),
        .agent-task-panel .agent-resource-row > .agent-resource-pill:nth-child(2) {
          display: none !important;
        }
        .user-unlimited-credit-pill {
          border: 1px solid rgba(118,139,181,.16);
          background: rgba(118,139,181,.07) !important;
          color: #586d9a !important;
        }
        .user-inventory-section,
        .user-process-history {
          display: grid;
          gap: 5px;
          margin-top: 10px;
          padding-top: 9px;
          border-top: 1px solid rgba(112,120,114,.11);
        }
        .user-inventory-title {
          color: #858b86;
          font-family: var(--pixel-font);
          font-size: .36rem;
          letter-spacing: .06em;
          text-transform: uppercase;
        }
        .user-inventory-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
        }
        .user-inventory-item {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          max-width: 126px;
          padding: 5px 6px;
          border-radius: 9px;
          background: rgba(104,119,108,.055);
          color: #606a63;
          font-size: .4rem;
        }
        .user-inventory-item span:first-child {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .user-inventory-item b {
          color: #48534c;
          font-family: var(--pixel-font);
          font-size: .34rem;
        }
        .user-process-line {
          display: grid;
          grid-template-columns: auto 1fr auto;
          gap: 5px;
          align-items: center;
          min-height: 21px;
          color: #6d756f;
          font-size: .4rem;
        }
        .user-process-line i {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #7f91b2;
        }
        .user-process-line span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .user-process-line small {
          color: #929892;
          font-family: var(--pixel-font);
          font-size: .3rem;
        }
        @media (max-width: 620px) {
          .user-task-process-chip {
            bottom: calc(100% + 42px);
            max-width: 160px;
          }
        }
      `}</style>

      {agentHost && process
        ? createPortal(
            <span
              className="user-task-process-chip"
              data-tone={process.tone}
              role="status"
              aria-label={process.label + ". " + process.detail}
              style={{ "--task-progress": String(Math.max(0, Math.min(100, process.progress))) + "%" } as React.CSSProperties}
            >
              <strong>{process.label}</strong>
              <small>{process.detail}</small>
              <i aria-hidden="true" />
            </span>,
            agentHost,
            "user-task-process-chip",
          )
        : null}

      {resourceHost
        ? createPortal(
            <span className="agent-resource-pill user-unlimited-credit-pill" title="Unlimited sandbox credits">
              ∞ credits
            </span>,
            resourceHost,
            "user-unlimited-credit",
          )
        : null}

      {menuHost
        ? createPortal(
            <>
              <section className="user-inventory-section" aria-label="Your persistent inventory">
                <span className="user-inventory-title">Inventory</span>
                <div className="user-inventory-grid">
                  {visibleInventory.length > 0 ? (
                    visibleInventory.map((item) => (
                      <span className="user-inventory-item" key={item.id} title={item.kind + " · " + item.source}>
                        <span>{item.label}</span>
                        <b>×{item.quantity}</b>
                      </span>
                    ))
                  ) : (
                    <span className="user-inventory-item"><span>No items yet</span></span>
                  )}
                </div>
              </section>
              <section className="user-process-history" aria-label="Recent task process updates">
                <span className="user-inventory-title">Process</span>
                {visibleUpdates.length > 0 ? (
                  visibleUpdates.map((update) => (
                    <div className="user-process-line" key={update.id + ":" + String(update.at)}>
                      <i aria-hidden="true" />
                      <span>{update.label} · {update.detail}</span>
                      <small>{update.progress}%</small>
                    </div>
                  ))
                ) : (
                  <div className="user-process-line"><i aria-hidden="true" /><span>Ready for a task</span><small>—</small></div>
                )}
              </section>
            </>,
            menuHost,
            "user-task-menu-augment",
          )
        : null}
    </>
  );
}
