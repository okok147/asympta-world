"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Locale = "en" | "zh-Hant" | "ja";
type SimulationSpeed = 1 | 2 | 3 | 4 | 5;
type DemoApi = {
  advance: (milliseconds: number) => unknown;
};

const SPEEDS: SimulationSpeed[] = [1, 2, 3, 4, 5];
const DEFAULT_SPEED: SimulationSpeed = 2;
const STORAGE_KEY = "asympta-world.simulation-speed.v2";
const ACCELERATOR_TICK_MS = 160;

const COPY: Record<Locale, string> = {
  en: "Agent speed",
  "zh-Hant": "代理速度",
  ja: "エージェント速度",
};

function currentLocale(): Locale {
  const value = document.documentElement.lang.toLowerCase();
  if (value.startsWith("zh")) return "zh-Hant";
  if (value.startsWith("ja")) return "ja";
  return "en";
}

function readSpeed(): SimulationSpeed {
  try {
    const value = Number(localStorage.getItem(STORAGE_KEY));
    if (SPEEDS.includes(value as SimulationSpeed)) return value as SimulationSpeed;
  } catch {}
  return DEFAULT_SPEED;
}

function writeSpeed(speed: SimulationSpeed) {
  try { localStorage.setItem(STORAGE_KEY, String(speed)); } catch {}
}

function demoApi() {
  return (window as unknown as Window & { __ASYMPTA_DEMO__?: DemoApi }).__ASYMPTA_DEMO__;
}

export function AsymptaSimulationSpeed() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [locale, setLocale] = useState<Locale>("en");
  const [speed, setSpeed] = useState<SimulationSpeed>(DEFAULT_SPEED);
  const speedRef = useRef<SimulationSpeed>(DEFAULT_SPEED);

  useEffect(() => {
    const stored = readSpeed();
    speedRef.current = stored;
    const frame = window.requestAnimationFrame(() => setSpeed(stored));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const sync = () => {
      const schedule = document.querySelector<HTMLElement>(".atlas-safe-schedule");
      if (schedule) setTarget((current) => current === schedule ? current : schedule);
      const nextLocale = currentLocale();
      setLocale((current) => current === nextLocale ? current : nextLocale);
    };
    const kickoff = window.setTimeout(sync, 0);
    const timer = window.setInterval(sync, 500);
    return () => {
      window.clearTimeout(kickoff);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let previous = performance.now();
    const timer = window.setInterval(() => {
      if (document.hidden) {
        previous = performance.now();
        return;
      }
      const now = performance.now();
      const elapsed = Math.min(400, Math.max(0, now - previous));
      previous = now;
      const multiplier = speedRef.current;
      if (multiplier <= 1) return;
      const api = demoApi();
      if (!api) return;
      try {
        // The normal 60Hz loop already advances 1x. Add only the extra world-time
        // budget so movement, task work, events and deliveries all scale together.
        api.advance(elapsed * (multiplier - 1));
      } catch {}
    }, ACCELERATOR_TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  const selectSpeed = (value: SimulationSpeed) => {
    speedRef.current = value;
    writeSpeed(value);
    setSpeed(value);
  };

  if (!target) return null;

  return createPortal(
    <>
      <style>{`
        .atlas-simulation-speed{display:flex;align-items:center;gap:5px;margin-top:7px;padding-top:7px;border-top:1px solid rgba(67,63,56,.055)}
        .atlas-simulation-speed>span{margin-right:auto;color:#827b72;font-size:7px;line-height:1;letter-spacing:.035em;white-space:nowrap}
        .atlas-simulation-speed__options{display:inline-flex;align-items:center;gap:2px;padding:2px;border:1px solid rgba(67,63,56,.06);border-radius:9px;background:rgba(255,255,255,.12)}
        .atlas-simulation-speed button{min-width:28px;height:23px;padding:0 5px;border:0;border-radius:7px;background:transparent;color:#8a8379;font-size:7.5px;font-weight:700;font-variant-numeric:tabular-nums}
        .atlas-simulation-speed button:hover{background:rgba(255,255,255,.28);color:#5f5a53}
        .atlas-simulation-speed button.is-active{background:rgba(75,127,166,.11);color:#4b6f8c;box-shadow:inset 0 0 0 1px rgba(75,127,166,.10)}
        @media(max-width:700px){.atlas-simulation-speed{gap:4px}.atlas-simulation-speed button{min-width:26px}}
      `}</style>
      <section className="atlas-simulation-speed" aria-label={COPY[locale]}>
        <span>{COPY[locale]}</span>
        <div className="atlas-simulation-speed__options">
          {SPEEDS.map((value) => (
            <button
              key={value}
              type="button"
              className={speed === value ? "is-active" : ""}
              aria-pressed={speed === value}
              onClick={() => selectSpeed(value)}
            >
              {value}×
            </button>
          ))}
        </div>
      </section>
    </>,
    target,
  );
}
