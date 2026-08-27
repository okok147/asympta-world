"use client";

import {
  type CSSProperties,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

type Celebration = {
  token: number;
  label: string;
  x: number;
  y: number;
};

type MissionSnapshot = {
  id: string;
  title?: string;
  status?: string;
};

type ScenarioRun = {
  scenarioId?: string;
  title?: string;
  status?: string;
};

type ProcessDetail = {
  missionId?: string;
  label?: string;
  detail?: string;
  progress?: number;
  tone?: string;
};

const MISSIONS_KEY = "asympta-user-missions-v1";
const SCENARIO_KEY = "asympta-webmcp-scenario-run-v1";
const EFFECT_MS = 1800;
const COMPLETION_SIGNAL = /(完成|complete|completed|done|建立|built|開放|opened|購買|bought|交易|成交|delivered|delivery|發佈|posted|released)/i;
const PARTICLES = Array.from({ length: 14 }, (_, index) => {
  const angle = (Math.PI * 2 * index) / 14 - Math.PI / 2;
  const distance = 42 + (index % 3) * 10;
  return {
    x: Math.cos(angle) * distance,
    y: Math.sin(angle) * distance,
  };
});

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function trimLabel(value: string) {
  const clean = value.replace(/\s+/g, " ").trim();
  if (!clean) return "Task complete";
  return clean.length > 58 ? clean.slice(0, 55).trimEnd() + "…" : clean;
}

export function TaskCelebrationRuntime() {
  const [viewport, setViewport] = useState<HTMLElement | null>(null);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const firedRef = useRef(new Map<string, number>());
  const seenMissionsRef = useRef(new Set<string>());
  const missionsReadyRef = useRef(false);
  const seenScenarioRef = useRef<string | null>(null);
  const scenarioReadyRef = useRef(false);
  const clearTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const sync = () => {
      const next = document.querySelector<HTMLElement>(".world-viewport");
      setViewport((current) => (current === next ? current : next));
    };
    const initial = window.setTimeout(sync, 0);
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      window.clearTimeout(initial);
      observer.disconnect();
    };
  }, []);

  const fire = useCallback((signature: string, rawLabel: string) => {
    const now = Date.now();
    const previous = firedRef.current.get(signature) ?? 0;
    if (now - previous < 8000) return;
    firedRef.current.set(signature, now);

    for (const [key, at] of firedRef.current) {
      if (now - at > 60_000) firedRef.current.delete(key);
    }

    const host = document.querySelector<HTMLElement>(".world-viewport");
    if (!host) return;
    const hostRect = host.getBoundingClientRect();
    const agent = document.querySelector<HTMLElement>(
      ".mission-user-agent:not([data-presence-fallback])",
    ) ?? document.querySelector<HTMLElement>(".mission-user-agent");
    const agentRect = agent?.getBoundingClientRect();
    const rawX = agentRect
      ? agentRect.left + agentRect.width / 2 - hostRect.left
      : hostRect.width / 2;
    const rawY = agentRect
      ? agentRect.top + agentRect.height / 2 - hostRect.top
      : hostRect.height / 2;
    const x = Math.max(70, Math.min(Math.max(70, hostRect.width - 70), rawX));
    const y = Math.max(70, Math.min(Math.max(70, hostRect.height - 90), rawY));

    setCelebration({
      token: now,
      label: trimLabel(rawLabel),
      x,
      y,
    });
    if (clearTimerRef.current !== null) {
      window.clearTimeout(clearTimerRef.current);
    }
    clearTimerRef.current = window.setTimeout(() => {
      setCelebration(null);
      clearTimerRef.current = null;
    }, EFFECT_MS);
  }, []);

  useEffect(() => {
    const onTaskProcess = (event: Event) => {
      const detail = (event as CustomEvent<ProcessDetail>).detail ?? {};
      const progress = Number(detail.progress ?? 0);
      if (progress < 100) return;
      const missionId = detail.missionId ?? "unknown";
      fire(
        "mission:" + missionId,
        String(detail.label ?? detail.detail ?? "Task complete"),
      );
    };

    const onUserProcess = (event: Event) => {
      const detail = (event as CustomEvent<ProcessDetail>).detail ?? {};
      const progress = Number(detail.progress ?? 0);
      const tone = String(detail.tone ?? "").toLowerCase();
      const label = String(detail.label ?? "");
      const text = label + " " + String(detail.detail ?? "");
      if (progress < 100 && tone !== "done") return;
      if (tone === "done" && progress > 0 && progress < 96) return;
      if (!COMPLETION_SIGNAL.test(text)) return;
      fire(
        "process:" + trimLabel(text).toLowerCase(),
        label || String(detail.detail ?? "Task complete"),
      );
    };

    window.addEventListener("asympta:task-process", onTaskProcess as EventListener);
    window.addEventListener(
      "asympta:user-task-process",
      onUserProcess as EventListener,
    );
    return () => {
      window.removeEventListener("asympta:task-process", onTaskProcess as EventListener);
      window.removeEventListener(
        "asympta:user-task-process",
        onUserProcess as EventListener,
      );
    };
  }, [fire]);

  useEffect(() => {
    const scanCompletionState = () => {
      const missions = readJson<MissionSnapshot[]>(MISSIONS_KEY, []);
      const completed = missions.filter((mission) => mission.status === "completed");
      if (!missionsReadyRef.current) {
        completed.forEach((mission) => seenMissionsRef.current.add(mission.id));
        missionsReadyRef.current = true;
      } else {
        completed.forEach((mission) => {
          if (seenMissionsRef.current.has(mission.id)) return;
          seenMissionsRef.current.add(mission.id);
          fire("mission:" + mission.id, mission.title ?? "Mission complete");
        });
      }

      const scenario = readJson<ScenarioRun | null>(SCENARIO_KEY, null);
      const completedScenario =
        scenario?.status === "completed"
          ? scenario.scenarioId ?? scenario.title ?? "scenario"
          : null;
      if (!scenarioReadyRef.current) {
        seenScenarioRef.current = completedScenario;
        scenarioReadyRef.current = true;
      } else if (
        completedScenario &&
        completedScenario !== seenScenarioRef.current
      ) {
        seenScenarioRef.current = completedScenario;
        fire(
          "scenario:" + completedScenario,
          scenario?.title ?? "Scenario complete",
        );
      } else if (!completedScenario) {
        seenScenarioRef.current = null;
      }
    };

    const initial = window.setTimeout(scanCompletionState, 0);
    const timer = window.setInterval(scanCompletionState, 420);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
      if (clearTimerRef.current !== null) {
        window.clearTimeout(clearTimerRef.current);
      }
    };
  }, [fire]);

  if (!viewport || !celebration) return null;

  return createPortal(
    <>
      <style>{`
        .task-celebration-effect {
          position: absolute;
          z-index: 198;
          width: 1px;
          height: 1px;
          pointer-events: none;
          isolation: isolate;
        }
        .task-celebration-core {
          position: absolute;
          left: 0;
          top: 0;
          display: grid;
          place-items: center;
          gap: 2px;
          min-width: 92px;
          max-width: 164px;
          padding: 7px 10px;
          transform: translate(-50%, -50%);
          border: 1px solid rgba(111, 139, 118, .22);
          border-radius: 13px;
          background: rgba(248, 247, 241, .94);
          box-shadow: 0 10px 30px rgba(55, 69, 60, .1);
          color: #52635a;
          text-align: center;
          backdrop-filter: blur(12px);
          animation: asympta-celebration-core ${EFFECT_MS}ms ease-out both;
        }
        .task-celebration-core b {
          display: grid;
          place-items: center;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: rgba(107, 145, 116, .12);
          color: #5c8065;
          font-family: var(--pixel-font);
          font-size: .55rem;
        }
        .task-celebration-core strong {
          font-family: var(--pixel-font);
          font-size: .34rem;
          letter-spacing: .09em;
        }
        .task-celebration-core small {
          display: block;
          max-width: 144px;
          overflow: hidden;
          color: #7d8780;
          font-size: .36rem;
          line-height: 1.25;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .task-celebration-ring {
          position: absolute;
          left: 0;
          top: 0;
          width: 34px;
          height: 34px;
          transform: translate(-50%, -50%);
          border: 1px solid rgba(112, 139, 119, .38);
          border-radius: 50%;
          animation: asympta-celebration-ring 1150ms ease-out both;
        }
        .task-celebration-particle {
          position: absolute;
          left: -2px;
          top: -2px;
          width: 4px;
          height: 4px;
          border-radius: 1px;
          background: #829985;
          box-shadow: 0 0 0 2px rgba(130, 153, 133, .06);
          animation: asympta-celebration-particle 1050ms cubic-bezier(.18,.8,.26,1) both;
          animation-delay: var(--delay);
        }
        .task-celebration-particle:nth-of-type(3n) { background: #8293ad; }
        .task-celebration-particle:nth-of-type(4n) { background: #a58b70; }
        @keyframes asympta-celebration-core {
          0% { opacity: 0; transform: translate(-50%, -42%) scale(.84); }
          14% { opacity: 1; transform: translate(-50%, -58%) scale(1.06); }
          24%, 72% { opacity: 1; transform: translate(-50%, -54%) scale(1); }
          100% { opacity: 0; transform: translate(-50%, -72%) scale(.96); }
        }
        @keyframes asympta-celebration-ring {
          0% { opacity: .8; transform: translate(-50%, -50%) scale(.3); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(3.2); }
        }
        @keyframes asympta-celebration-particle {
          0% { opacity: 0; transform: translate(0, 0) scale(.4); }
          18% { opacity: 1; }
          100% { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(.7); }
        }
        @media (prefers-reduced-motion: reduce) {
          .task-celebration-ring,
          .task-celebration-particle { display: none; }
          .task-celebration-core { animation: asympta-celebration-fade ${EFFECT_MS}ms ease-out both; }
          @keyframes asympta-celebration-fade {
            0%, 100% { opacity: 0; }
            15%, 78% { opacity: 1; }
          }
        }
      `}</style>
      <div
        className="task-celebration-effect"
        style={{ left: celebration.x, top: celebration.y }}
        aria-live="polite"
        aria-label={"Task complete. " + celebration.label}
        key={celebration.token}
      >
        <i className="task-celebration-ring" aria-hidden="true" />
        {PARTICLES.map((particle, index) => (
          <i
            className="task-celebration-particle"
            aria-hidden="true"
            key={index}
            style={
              {
                "--dx": particle.x.toFixed(1) + "px",
                "--dy": particle.y.toFixed(1) + "px",
                "--delay": String((index % 4) * 22) + "ms",
              } as CSSProperties
            }
          />
        ))}
        <span className="task-celebration-core">
          <b aria-hidden="true">✓</b>
          <strong>DONE</strong>
          <small>{celebration.label}</small>
        </span>
      </div>
    </>,
    viewport,
    "task-celebration-effect",
  );
}
