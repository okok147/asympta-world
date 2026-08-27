"use client";

import {
  Check,
  Coins,
  Crosshair,
  Menu,
  Package,
  PawPrint,
  Target,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type AvatarKind = "human" | "cat" | "fox" | "rabbit" | "bear";

type MissionSubtaskSnapshot = {
  id: string;
  title: string;
  status: string;
  progress: number;
  assignedAgentName?: string;
};

type MissionSnapshot = {
  id: string;
  title: string;
  description: string;
  budget: number;
  status: string;
  progress: number;
  collaborators: string[];
  subtasks: MissionSubtaskSnapshot[];
  currentEncounterId?: string;
};

type EncounterSnapshot = {
  id: string;
  phase: string;
  participants: string[];
  completed: boolean;
};

type Snapshot = {
  missions: MissionSnapshot[];
  encounters: EncounterSnapshot[];
};

const MISSIONS_KEY = "asympta-user-missions-v1";
const ENCOUNTERS_KEY = "asympta-encounters-v1";
const AVATAR_KEY = "asympta-user-agent-avatar-v1";
const EMPTY: Snapshot = { missions: [], encounters: [] };
const AVATARS: AvatarKind[] = ["human", "cat", "fox", "rabbit", "bear"];
const ANIMALS: AvatarKind[] = ["cat", "fox", "rabbit", "bear"];

function safeArray<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value) ? (value as T[]) : [];
  } catch {
    return [];
  }
}

function readSnapshot(): Snapshot {
  return {
    missions: safeArray<MissionSnapshot>(MISSIONS_KEY),
    encounters: safeArray<EncounterSnapshot>(ENCOUNTERS_KEY),
  };
}

function validAvatar(value: string | null): AvatarKind {
  return AVATARS.includes(value as AvatarKind) ? (value as AvatarKind) : "human";
}

function cameraNumbers(transform: string) {
  const match = transform.match(
    /translate\(\s*(-?[\d.]+)px\s*,\s*(-?[\d.]+)px\s*\)\s*scale\(\s*([\d.]+)\s*\)/,
  );
  if (!match) return { x: 0, y: 0, scale: 0.84 };
  return {
    x: Number(match[1]) || 0,
    y: Number(match[2]) || 0,
    scale: Number(match[3]) || 0.84,
  };
}

export function AgentTaskMenu() {
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY);
  const [open, setOpen] = useState(false);
  const [follow, setFollow] = useState(false);
  const [avatar, setAvatar] = useState<AvatarKind>("human");

  useEffect(() => {
    const initialize = window.setTimeout(() => {
      setPortalHost(document.querySelector<HTMLElement>(".world-viewport"));
      setSnapshot(readSnapshot());
      setAvatar(validAvatar(localStorage.getItem(AVATAR_KEY)));
    }, 0);
    const timer = window.setInterval(() => setSnapshot(readSnapshot()), 720);
    return () => {
      window.clearTimeout(initialize);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(AVATAR_KEY, avatar);
    } catch {
      // Avatar preference remains available for the current session.
    }
    const apply = () => {
      document
        .querySelectorAll<HTMLElement>(".mission-user-agent")
        .forEach((node) => node.setAttribute("data-user-avatar", avatar));
    };
    apply();
    const timer = window.setInterval(apply, 650);
    return () => window.clearInterval(timer);
  }, [avatar]);

  useEffect(() => {
    if (!follow) return;
    let frame = 0;
    const animate = () => {
      const viewport = document.querySelector<HTMLElement>(".world-viewport");
      const plane = document.querySelector<HTMLElement>(".world-plane");
      const agent = document.querySelector<HTMLElement>(".mission-user-agent");
      if (viewport && plane && agent) {
        const current = cameraNumbers(plane.style.transform);
        const agentX = Number.parseFloat(agent.style.left) || agent.offsetLeft || 600;
        const agentY = Number.parseFloat(agent.style.top) || agent.offsetTop || 380;
        const targetX = viewport.clientWidth / 2 - agentX * current.scale;
        const targetY = viewport.clientHeight / 2 - agentY * current.scale;
        const nextX = current.x + (targetX - current.x) * 0.11;
        const nextY = current.y + (targetY - current.y) * 0.11;
        plane.style.transform =
          "translate(" +
          nextX.toFixed(2) +
          "px," +
          nextY.toFixed(2) +
          "px) scale(" +
          current.scale.toFixed(4) +
          ")";
      }
      frame = window.requestAnimationFrame(animate);
    };
    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [follow]);

  const activeMission = useMemo(
    () =>
      snapshot.missions.find(
        (mission) => mission.status !== "completed" && mission.status !== "new",
      ) ?? snapshot.missions.find((mission) => mission.status !== "completed"),
    [snapshot.missions],
  );

  const activeEncounter = useMemo(
    () =>
      activeMission?.currentEncounterId
        ? snapshot.encounters.find(
            (encounter) => encounter.id === activeMission.currentEncounterId,
          )
        : undefined,
    [activeMission, snapshot.encounters],
  );

  if (!portalHost) return null;

  const progress = Math.max(0, Math.min(100, activeMission?.progress ?? 0));
  const currentSubtask = activeMission?.subtasks.find(
    (subtask) => subtask.status !== "completed",
  );
  const completed = activeMission?.subtasks.filter(
    (subtask) => subtask.status === "completed",
  ).length ?? 0;
  const totalTasks = activeMission?.subtasks.length ?? 0;
  const team = activeMission?.collaborators.length ?? 0;
  const hasAgent = Boolean(document.querySelector(".mission-user-agent"));
  const stage = activeEncounter?.phase ?? activeMission?.status ?? "idle";

  return createPortal(
    <>
      <style>{`
        .agent-task-control {
          position: absolute;
          z-index: 88;
          top: max(14px, env(safe-area-inset-top));
          right: max(14px, env(safe-area-inset-right));
          display: grid;
          justify-items: end;
          gap: 9px;
          pointer-events: none;
        }
        .agent-task-button,
        .agent-task-panel {
          pointer-events: auto;
        }
        .agent-task-button {
          position: relative;
          display: grid;
          place-items: center;
          width: 44px;
          height: 44px;
          padding: 3px;
          border: 0;
          border-radius: 50%;
          background: conic-gradient(
            #768bb5 0deg,
            #768bb5 ${String(progress * 3.6)}deg,
            rgba(119, 127, 121, .16) ${String(progress * 3.6)}deg,
            rgba(119, 127, 121, .16) 360deg
          );
          color: #59635d;
          cursor: pointer;
          box-shadow: 0 5px 18px rgba(54, 63, 58, .09);
        }
        .agent-task-button::before {
          content: "";
          position: absolute;
          inset: 3px;
          border-radius: 50%;
          background: rgba(248, 247, 241, .94);
          backdrop-filter: blur(12px);
        }
        .agent-task-button svg {
          position: relative;
          z-index: 1;
          width: 17px;
          height: 17px;
          stroke-width: 1.8;
        }
        .agent-task-panel {
          width: min(286px, calc(100vw - 28px));
          padding: 13px;
          border: 1px solid rgba(121, 129, 123, .2);
          border-radius: 18px;
          background: rgba(248, 247, 241, .94);
          box-shadow: 0 14px 40px rgba(54, 63, 58, .11);
          color: #39413c;
          backdrop-filter: blur(18px);
        }
        .agent-task-panel header,
        .agent-task-row,
        .agent-resource-row,
        .agent-avatar-row {
          display: flex;
          align-items: center;
        }
        .agent-task-panel header {
          justify-content: space-between;
          gap: 12px;
        }
        .agent-task-panel header span {
          display: grid;
          gap: 2px;
          min-width: 0;
        }
        .agent-task-panel header small,
        .agent-task-section-label,
        .agent-avatar-choice {
          font-family: var(--pixel-font);
          letter-spacing: .06em;
          text-transform: uppercase;
        }
        .agent-task-panel header small,
        .agent-task-section-label {
          color: #858b86;
          font-size: .38rem;
        }
        .agent-task-panel header strong {
          overflow: hidden;
          font-size: .68rem;
          line-height: 1.25;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .agent-task-close {
          display: grid;
          place-items: center;
          width: 30px;
          height: 30px;
          flex: 0 0 30px;
          padding: 0;
          border: 0;
          border-radius: 50%;
          background: rgba(90, 101, 93, .06);
          color: #6e7771;
          cursor: pointer;
        }
        .agent-task-close svg { width: 14px; height: 14px; }
        .agent-task-progress {
          position: relative;
          height: 5px;
          margin: 12px 0 10px;
          overflow: hidden;
          border-radius: 99px;
          background: rgba(110, 120, 113, .12);
        }
        .agent-task-progress i {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: #788db5;
          transition: width 360ms ease;
        }
        .agent-task-row {
          gap: 8px;
          min-height: 31px;
          color: #646d67;
          font-size: .52rem;
        }
        .agent-task-row svg,
        .agent-resource-pill svg {
          width: 13px;
          height: 13px;
          flex: 0 0 auto;
          stroke-width: 1.8;
        }
        .agent-task-row strong {
          margin-left: auto;
          color: #454e48;
          font-size: .52rem;
          font-weight: 650;
        }
        .agent-task-divider {
          height: 1px;
          margin: 10px 0;
          background: rgba(112, 120, 114, .11);
        }
        .agent-resource-row {
          gap: 6px;
          margin-top: 7px;
        }
        .agent-resource-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          min-width: 0;
          padding: 6px 7px;
          border-radius: 10px;
          background: rgba(104, 119, 108, .06);
          color: #5f6962;
          font-size: .46rem;
        }
        .agent-follow-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          width: 100%;
          min-height: 36px;
          margin-top: 10px;
          border: 1px solid rgba(118, 139, 181, .2);
          border-radius: 12px;
          background: ${follow ? "rgba(118, 139, 181, .12)" : "rgba(118, 139, 181, .05)"};
          color: ${follow ? "#526b9c" : "#69736d"};
          cursor: ${hasAgent ? "pointer" : "default"};
          opacity: ${hasAgent ? "1" : ".42"};
          font-size: .5rem;
        }
        .agent-follow-button svg { width: 14px; height: 14px; }
        .agent-avatar-row {
          flex-wrap: wrap;
          gap: 5px;
          margin-top: 7px;
        }
        .agent-avatar-choice {
          min-height: 28px;
          padding: 0 7px;
          border: 1px solid rgba(112, 120, 114, .14);
          border-radius: 9px;
          background: rgba(255,255,255,.22);
          color: #737a75;
          cursor: pointer;
          font-size: .32rem;
        }
        .agent-avatar-choice.is-selected {
          border-color: rgba(118, 139, 181, .36);
          background: rgba(118, 139, 181, .1);
          color: #526b9c;
        }
        .agent-avatar-random {
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .agent-avatar-random svg { width: 11px; height: 11px; }

        /* Compact semantic dialogue: icon + a few words, never a paragraph. */
        .business-thought {
          min-width: 64px !important;
          max-width: 116px !important;
          padding: 5px 7px !important;
        }
        .business-thought-icons {
          display: inline-flex !important;
          align-items: center !important;
          gap: 4px !important;
          white-space: nowrap;
        }
        .business-thought-icons::after {
          color: #5f6862;
          font-family: var(--pixel-font);
          font-size: .35rem;
          font-weight: 700;
          letter-spacing: .015em;
          line-height: 1;
          text-transform: none;
        }
        .business-thought--food .business-thought-icons::after { content: "Find food"; }
        .business-thought--deal .business-thought-icons::after { content: "Accept deal"; }
        .business-thought--skill .business-thought-icons::after { content: "Share skill"; }
        .business-thought--enquiry .business-thought-icons::after { content: "Find help"; }
        .business-thought--resource .business-thought-icons::after { content: "Trade resource"; }
        .business-thought--workflow .business-thought-icons::after { content: "Do task"; }
        .business-thought--energy .business-thought-icons::after { content: "Restore"; }
        .business-thought--status .business-thought-icons::after { content: "Observe"; }

        /* User-selected cute pixel animal forms. Human remains the default. */
        .mission-user-agent[data-user-avatar]:not([data-user-avatar="human"]) .mission-pixel-person::before {
          width: 4px !important;
          height: 4px !important;
          border-radius: 1px !important;
        }
        .mission-user-agent[data-user-avatar="cat"] .mission-pixel-person::before {
          left: 3px !important;
          top: 2px !important;
          background: #655f5b !important;
          box-shadow:
            16px 0 #655f5b,
            4px 4px #756e68, 8px 4px #756e68, 12px 4px #756e68,
            0 8px #756e68, 4px 8px #9b9188, 8px 8px #9b9188, 12px 8px #9b9188, 16px 8px #756e68,
            4px 12px #756e68, 8px 12px #756e68, 12px 12px #756e68,
            4px 16px #756e68, 8px 16px #756e68, 12px 16px #756e68,
            0 20px #655f5b, 4px 20px #655f5b, 12px 20px #655f5b, 16px 20px #655f5b !important;
        }
        .mission-user-agent[data-user-avatar="fox"] .mission-pixel-person::before {
          left: 3px !important;
          top: 2px !important;
          background: #9a6548 !important;
          box-shadow:
            16px 0 #9a6548,
            4px 4px #b57651, 8px 4px #b57651, 12px 4px #b57651,
            0 8px #b57651, 4px 8px #d0a180, 8px 8px #eee1cf, 12px 8px #d0a180, 16px 8px #b57651,
            4px 12px #a96e4d, 8px 12px #a96e4d, 12px 12px #a96e4d,
            4px 16px #a96e4d, 8px 16px #a96e4d, 12px 16px #a96e4d,
            0 20px #714f3f, 4px 20px #714f3f, 12px 20px #714f3f, 16px 20px #714f3f !important;
        }
        .mission-user-agent[data-user-avatar="rabbit"] .mission-pixel-person::before {
          left: 3px !important;
          top: 0 !important;
          background: transparent !important;
          box-shadow:
            4px 0 #b7aea4, 12px 0 #b7aea4,
            4px 4px #c8c0b8, 12px 4px #c8c0b8,
            4px 8px #b7aea4, 8px 8px #b7aea4, 12px 8px #b7aea4,
            0 12px #b7aea4, 4px 12px #d8d1ca, 8px 12px #d8d1ca, 12px 12px #d8d1ca, 16px 12px #b7aea4,
            4px 16px #b7aea4, 8px 16px #b7aea4, 12px 16px #b7aea4,
            4px 20px #b7aea4, 8px 20px #b7aea4, 12px 20px #b7aea4,
            0 24px #9d968f, 4px 24px #9d968f, 12px 24px #9d968f, 16px 24px #9d968f !important;
        }
        .mission-user-agent[data-user-avatar="bear"] .mission-pixel-person::before {
          left: 3px !important;
          top: 3px !important;
          background: #77645a !important;
          box-shadow:
            16px 0 #77645a,
            4px 4px #806b60, 8px 4px #806b60, 12px 4px #806b60,
            0 8px #806b60, 4px 8px #a58c7e, 8px 8px #b9a193, 12px 8px #a58c7e, 16px 8px #806b60,
            4px 12px #806b60, 8px 12px #806b60, 12px 12px #806b60,
            4px 16px #806b60, 8px 16px #806b60, 12px 16px #806b60,
            0 20px #69584f, 4px 20px #69584f, 12px 20px #69584f, 16px 20px #69584f !important;
        }

        @media (max-width: 620px) {
          .agent-task-control {
            top: max(10px, env(safe-area-inset-top));
            right: max(10px, env(safe-area-inset-right));
          }
          .agent-task-panel { width: min(270px, calc(100vw - 20px)); }
        }
      `}</style>

      <div
        className="agent-task-control"
        onPointerDown={(event) => event.stopPropagation()}
        onWheel={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="agent-task-button"
          aria-label="Open your agent task menu"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <Menu aria-hidden="true" /> : <Target aria-hidden="true" />}
        </button>

        {open && (
          <section className="agent-task-panel" aria-label="Your agent task and resources">
            <header>
              <span>
                <small>{activeMission ? "Current mission" : "Your agent"}</small>
                <strong>{activeMission?.title ?? "Ready for a goal"}</strong>
              </span>
              <button
                type="button"
                className="agent-task-close"
                aria-label="Close agent menu"
                onClick={() => setOpen(false)}
              >
                <X aria-hidden="true" />
              </button>
            </header>

            <div className="agent-task-progress" aria-label={String(progress) + "% complete"}>
              <i style={{ width: String(progress) + "%" }} />
            </div>

            <div className="agent-task-row">
              <Target aria-hidden="true" />
              <span>{currentSubtask?.title ?? "Waiting for a mission"}</span>
              <strong>{progress}%</strong>
            </div>
            <div className="agent-task-row">
              <Check aria-hidden="true" />
              <span>Stage</span>
              <strong>{stage}</strong>
            </div>

            <div className="agent-task-divider" />
            <div className="agent-task-section-label">Resources</div>
            <div className="agent-resource-row">
              <span className="agent-resource-pill">
                <Coins aria-hidden="true" />
                {activeMission ? Math.round(activeMission.budget) : 0} cr
              </span>
              <span className="agent-resource-pill">
                <Package aria-hidden="true" />
                {completed}/{totalTasks} outputs
              </span>
              <span className="agent-resource-pill">
                <Users aria-hidden="true" />
                {team} allies
              </span>
            </div>

            <button
              type="button"
              className="agent-follow-button"
              disabled={!hasAgent}
              onClick={() => hasAgent && setFollow((value) => !value)}
            >
              <Crosshair aria-hidden="true" />
              {follow ? "Following your agent" : "Camera follow"}
            </button>

            <div className="agent-task-divider" />
            <div className="agent-task-section-label">Agent form</div>
            <div className="agent-avatar-row">
              {AVATARS.map((kind) => (
                <button
                  key={kind}
                  type="button"
                  className={
                    "agent-avatar-choice" + (avatar === kind ? " is-selected" : "")
                  }
                  onClick={() => setAvatar(kind)}
                  aria-pressed={avatar === kind}
                >
                  {kind === "rabbit" ? "BUN" : kind.toUpperCase()}
                </button>
              ))}
              <button
                type="button"
                className="agent-avatar-choice agent-avatar-random"
                onClick={() =>
                  setAvatar(ANIMALS[Math.floor(Math.random() * ANIMALS.length)])
                }
              >
                <PawPrint aria-hidden="true" />
                CUTE
              </button>
            </div>
          </section>
        )}
      </div>
    </>,
    portalHost,
  );
}
