"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type ProcessDetail = {
  label?: string;
  detail?: string;
  progress?: number;
  tone?: string;
};

type Registry = {
  invoke: (name: string, input?: Record<string, unknown>) => Promise<unknown>;
  __asymptaRealWorldPacing?: boolean;
};

const PREFS_KEY = "asympta-user-preferences-v1";
const ZOOM_MIGRATION_KEY = "asympta-dialogue-zoom-77-v1";
const DEFAULT_DIALOGUE_SCALE = 0.77;

function delay(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function cameraNumbers(transform: string) {
  const match = transform.match(/translate\(\s*(-?[\d.]+)px\s*,\s*(-?[\d.]+)px\s*\)\s*scale\(\s*([\d.]+)\s*\)/);
  return match
    ? { x: Number(match[1]) || 0, y: Number(match[2]) || 0, scale: Number(match[3]) || 0.84 }
    : { x: 0, y: 0, scale: 0.84 };
}

function migrateDialogueZoom() {
  try {
    if (localStorage.getItem(ZOOM_MIGRATION_KEY) === "1") return;
    const raw = localStorage.getItem(PREFS_KEY);
    const parsed = raw ? JSON.parse(raw) as Record<string, unknown> : {};
    const current = Number(parsed.cameraScale);
    const shouldPreset = !Number.isFinite(current) || Math.abs(current - 0.84) < 0.035;
    if (shouldPreset) {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ ...parsed, version: 1, cameraScale: DEFAULT_DIALOGUE_SCALE, cameraFollow: parsed.cameraFollow ?? true }));
      const plane = document.querySelector<HTMLElement>(".world-plane");
      if (plane) {
        const camera = cameraNumbers(plane.style.transform);
        plane.style.transform = `translate(${camera.x.toFixed(2)}px,${camera.y.toFixed(2)}px) scale(${DEFAULT_DIALOGUE_SCALE.toFixed(4)})`;
      }
    }
    localStorage.setItem(ZOOM_MIGRATION_KEY, "1");
  } catch {
    // The live world can still use its current camera in memory.
  }
}

function pacingDelay(name: string) {
  if (name.includes("search")) return 1500;
  if (name.includes("inspect") || name.includes("observe") || name.includes("list")) return 1900;
  if (name.includes("quote") || name.includes("inquire")) return 2300;
  if (name.includes("execute") || name.includes("submit") || name.includes("accept") || name.includes("start")) return 2800;
  return 1600;
}

function wrapRegistry(registry: Registry | undefined) {
  if (!registry || registry.__asymptaRealWorldPacing) return;
  const original = registry.invoke.bind(registry);
  registry.invoke = async (name, input = {}) => {
    await delay(pacingDelay(name));
    return original(name, input);
  };
  registry.__asymptaRealWorldPacing = true;
}

export function RealWorldPacingRuntime() {
  const [agentHost, setAgentHost] = useState<HTMLElement | null>(null);
  const [process, setProcess] = useState<ProcessDetail | null>(null);
  const hideTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const initial = window.setTimeout(migrateDialogueZoom, 80);
    const timer = window.setInterval(() => {
      const plane = document.querySelector<HTMLElement>(".world-plane");
      const nextAgent = document.querySelector<HTMLElement>(".mission-user-agent");
      setAgentHost((current) => current === nextAgent ? current : nextAgent);
      if (plane) {
        const scale = cameraNumbers(plane.style.transform).scale;
        plane.dataset.zoomComfort = scale >= 0.72 && scale <= 0.83 ? "dialogue" : "normal";
      }
      const target = window as unknown as {
        __ASYMPTA_CITY_WEBMCP__?: Registry;
        __ASYMPTA_MISSION_WEBMCP__?: Registry;
      };
      wrapRegistry(target.__ASYMPTA_CITY_WEBMCP__);
      wrapRegistry(target.__ASYMPTA_MISSION_WEBMCP__);
    }, 520);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const onProcess = (event: Event) => {
      const detail = (event as CustomEvent<ProcessDetail>).detail ?? {};
      if (!detail.label) return;
      setProcess(detail);
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = window.setTimeout(() => setProcess(null), detail.progress === 100 ? 6200 : 7600);
    };
    window.addEventListener("asympta:user-task-process", onProcess);
    return () => {
      window.removeEventListener("asympta:user-task-process", onProcess);
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    };
  }, []);

  return (
    <>
      <style>{`
        .world-plane[data-zoom-comfort="dialogue"] .city-agent[data-perception="mid"] .city-agent-thought,
        .world-plane[data-zoom-comfort="dialogue"] .community-agent[data-perception="mid"] .community-agent-thought {
          display:block!important;
          opacity:.58!important;
          transform:scale(.86);
          transform-origin:left bottom;
        }
        .external-process-chip {
          position:absolute; z-index:80; left:50%; bottom:calc(100% + 76px); display:grid; gap:3px;
          min-width:128px; max-width:204px; padding:6px 8px 7px; transform:translateX(-50%);
          border:1px solid rgba(112,124,115,.17); border-radius:11px; background:rgba(248,247,241,.93);
          box-shadow:0 7px 22px rgba(54,63,58,.065); color:#59635d; pointer-events:none; backdrop-filter:blur(10px);
        }
        .external-process-chip strong { overflow:hidden; font-family:var(--pixel-font); font-size:.33rem; text-overflow:ellipsis; white-space:nowrap; }
        .external-process-chip small { overflow:hidden; color:#7a827d; font-size:.37rem; text-overflow:ellipsis; white-space:nowrap; }
        .external-process-bar { height:2px; margin-top:3px; overflow:hidden; border-radius:99px; background:rgba(110,122,113,.1); }
        .external-process-bar i { display:block; height:100%; width:var(--external-progress,0%); border-radius:inherit; background:#7a8eb5; transition:width 360ms ease; }
        @media(prefers-reduced-motion:reduce){.external-process-bar i{transition:none}}
      `}</style>
      {agentHost && process ? createPortal(
        <span
          className="external-process-chip"
          role="status"
          aria-label={(process.label ?? "") + ". " + (process.detail ?? "")}
          data-tone={process.tone ?? "planning"}
          style={{ "--external-progress": String(Math.max(0, Math.min(100, process.progress ?? 0))) + "%" } as CSSProperties}
        >
          <strong>{process.label}</strong>
          <small>{process.detail ?? "Evaluating the next real-world step"}</small>
          <span className="external-process-bar"><i /></span>
        </span>,
        agentHost,
        "external-process-chip",
      ) : null}
    </>
  );
}
