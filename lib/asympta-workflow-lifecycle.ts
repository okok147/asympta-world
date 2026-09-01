export const ASYMPTA_WORKFLOW_START_EVENT = "asympta:workflow-start" as const;

export type AsymptaWorkflowLifecycleSource = "marketplace" | "workflow";
export type AsymptaWorkflowLifecyclePhase = "active" | "completed" | "blocked";

export type AsymptaWorkflowLifecycleObservation = {
  source: AsymptaWorkflowLifecycleSource;
  fingerprint: string;
  workflowId: string;
  title: string;
  phase: AsymptaWorkflowLifecyclePhase;
  simulated: boolean;
  requestId?: string | null;
  details?: Record<string, unknown>;
};

export type AsymptaWorkflowStartSignal = {
  schemaVersion: "asympta.workflow-start.v1";
  id: string;
  workflowId: string;
  title: string;
  simulated: boolean;
  source: AsymptaWorkflowLifecycleSource;
  requestId: string | null;
  startedAt: string;
  details?: Record<string, unknown>;
};

type LifecycleSourceState = {
  seeded: boolean;
  fingerprint: string | null;
  runId: string | null;
  sequence: number;
  activeSeen: boolean;
  terminal: boolean;
  startPublished: boolean;
  completionPublished: boolean;
};

export type AsymptaWorkflowLifecycleTracker = {
  sources: Record<AsymptaWorkflowLifecycleSource, LifecycleSourceState>;
};

export type AsymptaWorkflowLifecycleTransition = {
  start: AsymptaWorkflowStartSignal | null;
  completionRunId: string | null;
};

function sourceState(): LifecycleSourceState {
  return {
    seeded: false,
    fingerprint: null,
    runId: null,
    sequence: 0,
    activeSeen: false,
    terminal: false,
    startPublished: false,
    completionPublished: false,
  };
}

function compactText(value: unknown, fallback: string, max = 140) {
  const clean = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return (clean || fallback).slice(0, max);
}

function canonicalFingerprint(value: unknown) {
  const clean = compactText(value, "run", 180);
  return clean.replace(/[^A-Za-z0-9._:-]+/g, "-").replace(/^-+|-+$/g, "") || "run";
}

function timestamp(now: string | number | Date = Date.now()) {
  const value = now instanceof Date ? now : new Date(now);
  return Number.isFinite(value.getTime()) ? value.toISOString() : new Date().toISOString();
}

function nextRunId(
  state: LifecycleSourceState,
  observation: AsymptaWorkflowLifecycleObservation,
) {
  state.sequence += 1;
  return `${observation.source}:${canonicalFingerprint(observation.fingerprint)}:${state.sequence}`;
}

function startSignal(
  observation: AsymptaWorkflowLifecycleObservation,
  runId: string,
  now: string | number | Date,
): AsymptaWorkflowStartSignal {
  return {
    schemaVersion: "asympta.workflow-start.v1",
    id: runId,
    workflowId: compactText(observation.workflowId, "workflow", 120),
    title: compactText(observation.title, "Workflow started"),
    simulated: observation.simulated,
    source: observation.source,
    requestId: typeof observation.requestId === "string" && observation.requestId.trim()
      ? observation.requestId.trim()
      : null,
    startedAt: timestamp(now),
    details: observation.details,
  };
}

export function createAsymptaWorkflowLifecycleTracker(): AsymptaWorkflowLifecycleTracker {
  return {
    sources: {
      marketplace: sourceState(),
      workflow: sourceState(),
    },
  };
}

/**
 * Establish the browser's initial canonical state without producing animation.
 * A restored active run remains eligible for a completion celebration, while a
 * completed run found during hydration can never replay as a fresh completion.
 */
export function seedAsymptaWorkflowLifecycle(
  tracker: AsymptaWorkflowLifecycleTracker,
  source: AsymptaWorkflowLifecycleSource,
  observation: AsymptaWorkflowLifecycleObservation | null,
) {
  const state = tracker.sources[source];
  state.seeded = true;
  if (!observation) {
    state.fingerprint = null;
    state.runId = null;
    state.activeSeen = false;
    state.terminal = false;
    state.startPublished = false;
    state.completionPublished = false;
    return;
  }

  state.fingerprint = observation.fingerprint;
  state.runId = nextRunId(state, observation);
  state.activeSeen = observation.phase === "active";
  state.terminal = observation.phase !== "active";
  state.startPublished = true;
  state.completionPublished = observation.phase === "completed";
}

export function observeAsymptaWorkflowLifecycle(
  tracker: AsymptaWorkflowLifecycleTracker,
  observation: AsymptaWorkflowLifecycleObservation,
  now: string | number | Date = Date.now(),
): AsymptaWorkflowLifecycleTransition {
  const state = tracker.sources[observation.source];
  if (!state.seeded) {
    seedAsymptaWorkflowLifecycle(tracker, observation.source, observation);
    return { start: null, completionRunId: null };
  }

  const startsNewRun = !state.runId
    || state.fingerprint !== observation.fingerprint
    || (state.terminal && observation.phase === "active");

  if (startsNewRun) {
    state.fingerprint = observation.fingerprint;
    state.runId = nextRunId(state, observation);
    state.activeSeen = observation.phase === "active";
    state.terminal = observation.phase !== "active";
    state.startPublished = false;
    state.completionPublished = observation.phase === "completed";

    if (observation.phase === "active" && state.runId) {
      state.startPublished = true;
      return {
        start: startSignal(observation, state.runId, now),
        completionRunId: null,
      };
    }
    return { start: null, completionRunId: null };
  }

  if (observation.phase === "active") {
    state.activeSeen = true;
    state.terminal = false;
    if (!state.startPublished && state.runId) {
      state.startPublished = true;
      return {
        start: startSignal(observation, state.runId, now),
        completionRunId: null,
      };
    }
    return { start: null, completionRunId: null };
  }

  state.terminal = true;
  if (
    observation.phase === "completed"
    && state.activeSeen
    && !state.completionPublished
    && state.runId
  ) {
    state.completionPublished = true;
    return { start: null, completionRunId: state.runId };
  }

  if (observation.phase === "completed") state.completionPublished = true;
  return { start: null, completionRunId: null };
}

export function publishAsymptaWorkflowStart(signal: AsymptaWorkflowStartSignal) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<AsymptaWorkflowStartSignal>(ASYMPTA_WORKFLOW_START_EVENT, {
    detail: signal,
  }));
}

export function subscribeAsymptaWorkflowStarts(
  listener: (signal: AsymptaWorkflowStartSignal) => void,
) {
  if (typeof window === "undefined") return () => undefined;
  const onStart = (event: Event) => {
    const signal = (event as CustomEvent<AsymptaWorkflowStartSignal>).detail;
    if (signal?.schemaVersion === "asympta.workflow-start.v1" && signal.id) listener(signal);
  };
  window.addEventListener(ASYMPTA_WORKFLOW_START_EVENT, onStart);
  return () => window.removeEventListener(ASYMPTA_WORKFLOW_START_EVENT, onStart);
}
