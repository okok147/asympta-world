"use client";

import {
  Gauge,
  Handshake,
  Map,
  Play,
  Radio,
  Store,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import {
  MARKET_STRATEGIES,
  runMassMarketStress,
  type MarketTrajectory,
  type MassMarketSimulation,
} from "@/lib/mass-market-simulation";

type MarketTool = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: Record<string, unknown>) => Promise<string>;
};

type MarketWindow = Window & {
  __ASYMPTA_MASS_MARKET__?: {
    tools: MarketTool[];
    invoke: (name: string, input?: Record<string, unknown>) => Promise<unknown>;
  };
};

const MARKET_KEY = "asympta-mass-market-simulation-v1";
const ACTOR_COUNT = 100_000;
const TRAJECTORY_COUNT = 100;

function loadSimulation(): MassMarketSimulation | null {
  try {
    const raw = localStorage.getItem(MARKET_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MassMarketSimulation;
    if (
      parsed.version !== 1 ||
      parsed.summary.actorCount !== ACTOR_COUNT ||
      parsed.trajectories.length < TRAJECTORY_COUNT
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveSimulation(value: MassMarketSimulation) {
  try {
    localStorage.setItem(MARKET_KEY, JSON.stringify(value));
  } catch {
    // The simulation can remain memory-only when storage is unavailable.
  }
}

function emitReplayStep(trajectory: MarketTrajectory, stepIndex: number) {
  const step = trajectory.steps[stepIndex];
  if (!step) return;
  const progress = Math.round(((stepIndex + 1) / trajectory.steps.length) * 100);
  window.dispatchEvent(
    new CustomEvent("asympta:user-task-process", {
      detail: {
        label:
          progress >= 100
            ? "Trajectory replay complete"
            : "Market trajectory · " + step.phase,
        detail: step.message,
        progress,
        tone:
          step.phase === "deal"
            ? "done"
            : step.phase === "walkaway"
              ? "blocked"
              : step.phase === "bid" || step.phase === "counter" || step.phase === "concession"
                ? "talking"
                : "planning",
      },
    }),
  );
}

export function MarketTrajectoryRuntime() {
  const [viewport, setViewport] = useState<HTMLElement | null>(null);
  const [simulation, setSimulation] = useState<MassMarketSimulation | null>(null);
  const [computeMs, setComputeMs] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [enteredId, setEnteredId] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [running, setRunning] = useState(false);

  const runStress = useCallback((seed = Date.now()) => {
    setRunning(true);
    const started = performance.now();
    const next = runMassMarketStress(ACTOR_COUNT, TRAJECTORY_COUNT, seed);
    const elapsed = performance.now() - started;
    saveSimulation(next);
    setSimulation(next);
    setComputeMs(elapsed);
    setRunning(false);
    return next;
  }, []);

  useEffect(() => {
    const initialize = window.setTimeout(() => {
      setViewport(document.querySelector<HTMLElement>(".world-viewport"));
      const cached = loadSimulation();
      if (cached) {
        setSimulation(cached);
        setComputeMs(null);
      } else {
        runStress(20260827);
      }
    }, 820);
    const scan = window.setInterval(() => {
      const next = document.querySelector<HTMLElement>(".world-viewport");
      setViewport((current) => (current === next ? current : next));
    }, 700);
    return () => {
      window.clearTimeout(initialize);
      window.clearInterval(scan);
    };
  }, [runStress]);

  const trajectories = simulation?.trajectories ?? [];
  const selected = useMemo(
    () => trajectories.find((trajectory) => trajectory.id === selectedId) ?? null,
    [selectedId, trajectories],
  );
  const entered = useMemo(
    () => trajectories.find((trajectory) => trajectory.id === enteredId) ?? null,
    [enteredId, trajectories],
  );

  useEffect(() => {
    if (!entered) return;
    setActiveStep(0);
    emitReplayStep(entered, 0);
    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      if (index >= entered.steps.length) {
        window.clearInterval(timer);
        return;
      }
      setActiveStep(index);
      emitReplayStep(entered, index);
    }, 760);
    return () => window.clearInterval(timer);
  }, [entered]);

  useEffect(() => {
    const onEnter = (event: Event) => {
      const detail = (event as CustomEvent<{ trajectoryId?: string }>).detail;
      const id = detail?.trajectoryId;
      if (!id) return;
      setSelectedId(id);
      setEnteredId(id);
      setOpen(true);
    };
    window.addEventListener("asympta:enter-market-trajectory", onEnter as EventListener);
    return () => window.removeEventListener("asympta:enter-market-trajectory", onEnter as EventListener);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const tools: MarketTool[] = [
      {
        name: "mass_market_observe",
        title: "Observe the 100k simultaneous market stress test",
        description:
          "Read aggregate demand, bids, negotiations, deals, walkaways, clearing price and strategy wins from the headless 100,000-actor market simulation.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute: async () =>
          JSON.stringify({ ok: Boolean(simulation), summary: simulation?.summary, strategies: MARKET_STRATEGIES }),
      },
      {
        name: "mass_market_list_trajectories",
        title: "List market negotiation trajectories",
        description:
          "List the representative trajectories that can be entered from the trajectory map.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute: async () =>
          JSON.stringify({
            ok: Boolean(simulation),
            trajectories: trajectories.map((trajectory) => ({
              id: trajectory.id,
              title: trajectory.title,
              product: trajectory.product,
              budget: trajectory.budget,
              outcome: trajectory.outcome,
              winner: trajectory.winnerStoreName,
              strategy: trajectory.winnerStrategy,
              steps: trajectory.steps.length,
            })),
          }),
      },
      {
        name: "mass_market_inspect_trajectory",
        title: "Inspect one market trajectory",
        description:
          "Read the complete causal sequence: demand broadcast, store hearing, bids, counters, concessions and final deal or walkaway.",
        inputSchema: {
          type: "object",
          properties: { trajectoryId: { type: "string" } },
          required: ["trajectoryId"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute: async (input) => {
          const trajectory = trajectories.find((item) => item.id === String(input.trajectoryId));
          return JSON.stringify(trajectory ? { ok: true, trajectory } : { ok: false, error: "Trajectory not found." });
        },
      },
      {
        name: "mass_market_enter_trajectory",
        title: "Enter and replay a market trajectory",
        description:
          "Open the trajectory map UI and replay one negotiation sequence step by step.",
        inputSchema: {
          type: "object",
          properties: { trajectoryId: { type: "string" } },
          required: ["trajectoryId"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute: async (input) => {
          const id = String(input.trajectoryId);
          const trajectory = trajectories.find((item) => item.id === id);
          if (!trajectory) return JSON.stringify({ ok: false, error: "Trajectory not found." });
          window.dispatchEvent(new CustomEvent("asympta:enter-market-trajectory", { detail: { trajectoryId: id } }));
          return JSON.stringify({ ok: true, trajectoryId: id });
        },
      },
      {
        name: "mass_market_rerun_stress",
        title: "Re-run the 100k market stress test",
        description:
          "Run another deterministic headless 100,000-actor simultaneous market batch and replace the trajectory sample.",
        inputSchema: {
          type: "object",
          properties: { seed: { type: "number" } },
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute: async (input) => {
          const next = runStress(typeof input.seed === "number" ? input.seed : Date.now());
          return JSON.stringify({ ok: true, summary: next.summary });
        },
      },
    ];

    const marketWindow = window as MarketWindow;
    marketWindow.__ASYMPTA_MASS_MARKET__ = {
      tools,
      invoke: async (name, input = {}) => {
        const tool = tools.find((candidate) => candidate.name === name);
        if (!tool) throw new Error("Unknown mass market tool: " + name);
        return JSON.parse(await tool.execute(input)) as unknown;
      },
    };

    const modelContext = (document as unknown as {
      modelContext?: {
        registerTool: (
          tool: MarketTool,
          options?: { signal?: AbortSignal },
        ) => Promise<void> | void;
      };
    }).modelContext;
    if (modelContext?.registerTool) {
      tools.forEach((tool) => {
        void Promise.resolve(
          modelContext.registerTool(tool, { signal: controller.signal }),
        ).catch(() => undefined);
      });
    }

    return () => {
      controller.abort();
      delete marketWindow.__ASYMPTA_MASS_MARKET__;
    };
  }, [runStress, simulation, trajectories]);

  const enterSelected = () => {
    if (!selected) return;
    setEnteredId(selected.id);
  };

  if (!viewport) return null;

  return createPortal(
    <>
      <style>{`
        .trajectory-map-control{position:absolute;z-index:178;right:max(13px,env(safe-area-inset-right));bottom:max(86px,calc(env(safe-area-inset-bottom) + 78px));pointer-events:auto}
        .trajectory-map-button{position:relative;display:grid;place-items:center;width:39px;height:39px;padding:0;border:1px solid rgba(112,124,115,.13);border-radius:50%;background:rgba(248,247,241,.86);color:#65746b;box-shadow:0 7px 22px rgba(49,60,53,.07);backdrop-filter:blur(12px);cursor:pointer}
        .trajectory-map-button svg{width:15px;height:15px}.trajectory-map-button b{position:absolute;right:-4px;top:-4px;min-width:19px;height:19px;padding:0 4px;border-radius:10px;background:#7184ad;color:white;font-family:var(--pixel-font);font-size:.26rem;line-height:19px;text-align:center}
        .trajectory-map-panel{position:absolute;z-index:177;right:max(12px,env(safe-area-inset-right));top:max(62px,calc(env(safe-area-inset-top) + 54px));display:grid;gap:9px;width:min(404px,calc(100vw - 24px));max-height:calc(100svh - 154px);overflow:auto;padding:12px;border:1px solid rgba(112,124,115,.17);border-radius:18px;background:rgba(248,247,241,.97);box-shadow:0 18px 50px rgba(49,60,53,.12);color:#455149;backdrop-filter:blur(20px);pointer-events:auto;overscroll-behavior:contain;touch-action:pan-y}
        .trajectory-map-head{display:flex;align-items:flex-start;gap:8px}.trajectory-map-head>span{display:grid;gap:2px;min-width:0;flex:1}.trajectory-map-head strong{font-size:.66rem}.trajectory-map-head small{color:#7d8780;font-size:.38rem;line-height:1.35}.trajectory-close{display:grid;place-items:center;width:27px;height:27px;padding:0;border:0;border-radius:50%;background:rgba(90,103,94,.06);color:#707a73;cursor:pointer}.trajectory-close svg{width:12px;height:12px}
        .trajectory-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px}.trajectory-stat{display:grid;gap:3px;min-width:0;padding:7px;border-radius:10px;background:rgba(105,119,108,.055)}.trajectory-stat span{display:flex;align-items:center;gap:4px;color:#7b847e;font-family:var(--pixel-font);font-size:.27rem;text-transform:uppercase}.trajectory-stat span svg{width:9px;height:9px}.trajectory-stat b{overflow:hidden;font-size:.46rem;text-overflow:ellipsis;white-space:nowrap}
        .trajectory-map-grid{display:grid;grid-template-columns:repeat(10,minmax(0,1fr));gap:4px;padding:8px;border:1px solid rgba(112,123,115,.1);border-radius:14px;background:rgba(255,255,255,.18)}.trajectory-node{aspect-ratio:1;padding:0;border:1px solid rgba(111,123,114,.13);border-radius:6px;background:rgba(102,117,106,.045);color:#758078;font-family:var(--pixel-font);font-size:.25rem;cursor:pointer}.trajectory-node[data-outcome="deal"]{background:rgba(103,143,117,.09);color:#5f7d66}.trajectory-node[data-outcome="walkaway"]{background:rgba(161,108,91,.07);color:#8a6960}.trajectory-node.is-selected{border-color:rgba(118,139,181,.48);box-shadow:0 0 0 2px rgba(118,139,181,.08);color:#536d9e}
        .trajectory-selection{display:grid;gap:6px;padding:9px;border-radius:12px;background:rgba(105,119,108,.045)}.trajectory-selection header{display:flex;align-items:center;gap:6px}.trajectory-selection header svg{width:12px;height:12px;color:#6d82ac}.trajectory-selection header strong{font-size:.53rem}.trajectory-selection p{margin:0;color:#707a73;font-size:.4rem;line-height:1.45}.trajectory-enter{display:flex;align-items:center;justify-content:center;gap:5px;min-height:32px;border:1px solid rgba(118,139,181,.2);border-radius:9px;background:rgba(118,139,181,.08);color:#59709d;font-family:var(--pixel-font);font-size:.3rem;cursor:pointer}.trajectory-enter svg{width:11px;height:11px}
        .trajectory-replay{display:grid;gap:7px}.trajectory-replay-summary{display:flex;flex-wrap:wrap;gap:5px}.trajectory-replay-summary span{padding:5px 6px;border-radius:8px;background:rgba(105,119,108,.055);font-family:var(--pixel-font);font-size:.29rem}.trajectory-step-list{display:grid;gap:4px}.trajectory-step{display:grid;grid-template-columns:64px minmax(0,1fr);gap:7px;padding:6px 7px;border-radius:9px;background:rgba(255,255,255,.16);opacity:.5}.trajectory-step.is-active{background:rgba(118,139,181,.08);opacity:1}.trajectory-step.is-past{opacity:.82}.trajectory-step b{color:#6c7fa7;font-family:var(--pixel-font);font-size:.28rem;text-transform:uppercase}.trajectory-step span{color:#626c65;font-size:.39rem;line-height:1.38}
        .trajectory-rerun{border:0;background:transparent;color:#818983;font-family:var(--pixel-font);font-size:.27rem;cursor:pointer;text-decoration:underline;text-underline-offset:3px}
        @media(max-width:620px){.trajectory-map-control{right:max(9px,env(safe-area-inset-right));bottom:max(84px,calc(env(safe-area-inset-bottom) + 76px))}.trajectory-map-panel{left:9px;right:9px;top:max(58px,calc(env(safe-area-inset-top) + 50px));width:auto;max-height:calc(100svh - 150px)}.trajectory-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.trajectory-map-grid{gap:3px;padding:6px}.trajectory-node{border-radius:5px;font-size:.22rem}}
      `}</style>

      <div className="trajectory-map-control" onPointerDown={(event) => event.stopPropagation()}>
        <button
          type="button"
          className="trajectory-map-button"
          aria-label="Open 100 market trajectories"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <Map aria-hidden="true" />
          <b>{trajectories.length || 100}</b>
        </button>
      </div>

      {open ? (
        <section
          className="trajectory-map-panel"
          aria-label="100 market negotiation trajectories"
          onPointerDown={(event) => event.stopPropagation()}
          onWheel={(event) => event.stopPropagation()}
        >
          <div className="trajectory-map-head">
            <Map aria-hidden="true" style={{ width: 17, height: 17 }} />
            <span>
              <strong>{entered ? entered.title : "Market Trajectory Map"}</strong>
              <small>
                {entered
                  ? "Replay the exact demand → bid → negotiation → outcome chain."
                  : "100 representative causal paths sampled from one 100,000-actor simultaneous market tick."}
              </small>
            </span>
            <button
              type="button"
              className="trajectory-close"
              aria-label="Close trajectory map"
              onClick={() => {
                setOpen(false);
                setEnteredId(null);
              }}
            >
              <X aria-hidden="true" />
            </button>
          </div>

          {!entered ? (
            <>
              <div className="trajectory-stats">
                <div className="trajectory-stat"><span><Users aria-hidden="true" />actors</span><b>{simulation?.summary.actorCount.toLocaleString() ?? "100,000"}</b></div>
                <div className="trajectory-stat"><span><Radio aria-hidden="true" />bids</span><b>{simulation?.summary.bidCount.toLocaleString() ?? "…"}</b></div>
                <div className="trajectory-stat"><span><Handshake aria-hidden="true" />deals</span><b>{simulation?.summary.deals.toLocaleString() ?? "…"}</b></div>
                <div className="trajectory-stat"><span><Gauge aria-hidden="true" />compute</span><b>{computeMs === null ? "cached" : computeMs.toFixed(0) + "ms"}</b></div>
              </div>

              <div className="trajectory-map-grid" aria-label="Select a trajectory">
                {trajectories.map((trajectory) => (
                  <button
                    type="button"
                    key={trajectory.id}
                    className={"trajectory-node" + (selectedId === trajectory.id ? " is-selected" : "")}
                    data-outcome={trajectory.outcome}
                    aria-label={trajectory.id + ", " + trajectory.title + ", " + trajectory.outcome}
                    onClick={() => setSelectedId(trajectory.id)}
                  >
                    {String(trajectory.index + 1).padStart(2, "0")}
                  </button>
                ))}
              </div>

              {selected ? (
                <section className="trajectory-selection">
                  <header><Store aria-hidden="true" /><strong>{selected.title}</strong></header>
                  <p>
                    {selected.buyer} · budget ₡{selected.budget.toFixed(0)} · {selected.competitors} competing stores · {selected.winnerStoreName} · {selected.winnerStrategy} · {selected.outcome}
                  </p>
                  <button type="button" className="trajectory-enter" onClick={enterSelected}>
                    <Play aria-hidden="true" /> ENTER TRAJECTORY
                  </button>
                </section>
              ) : null}

              <button type="button" className="trajectory-rerun" disabled={running} onClick={() => runStress(Date.now())}>
                {running ? "RUNNING 100,000-ACTOR STRESS…" : "RE-RUN 100,000-ACTOR STRESS"}
              </button>
            </>
          ) : (
            <section className="trajectory-replay">
              <div className="trajectory-replay-summary">
                <span>{entered.outcome.toUpperCase()}</span>
                <span>{entered.winnerStrategy}</span>
                <span>₡{entered.finalPrice?.toFixed(2)}</span>
                <span>{entered.competitors} bidders</span>
              </div>
              <div className="trajectory-step-list">
                {entered.steps.map((step, index) => (
                  <div
                    className={
                      "trajectory-step" +
                      (index === activeStep ? " is-active" : index < activeStep ? " is-past" : "")
                    }
                    key={String(index) + step.phase + step.actor}
                  >
                    <b>{step.phase}</b>
                    <span>{step.message}</span>
                  </div>
                ))}
              </div>
              <button type="button" className="trajectory-enter" onClick={() => setEnteredId(null)}>
                <Map aria-hidden="true" /> BACK TO 100 TRAJECTORIES
              </button>
            </section>
          )}
        </section>
      ) : null}
    </>,
    viewport,
    "market-trajectory-runtime",
  );
}
