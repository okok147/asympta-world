export type AsymptaActivityStatus =
  | "interpreting"
  | "discovering"
  | "coordinating"
  | "waiting_input"
  | "executing"
  | "verifying"
  | "completed"
  | "blocked"
  | "failed";

export type AsymptaProtocolKind = "asympta" | "a2a" | "mcp" | "human";

export type AsymptaActivityEvent = {
  id: string;
  at: number;
  status: AsymptaActivityStatus;
  protocol: AsymptaProtocolKind;
  actorId?: string;
  peer?: string;
  summary: string;
  data?: Record<string, unknown>;
};

export type AsymptaEvidence = {
  id: string;
  at: number;
  protocol: Exclude<AsymptaProtocolKind, "human">;
  source: string;
  kind: "agent-card" | "tool-list" | "protocol-response" | "artifact" | "receipt";
  value: unknown;
};

export type AsymptaOutcome = {
  verified: boolean;
  verification: "protocol-response" | "task-completed" | "tool-result" | "none";
  summary: string;
  value?: unknown;
};

export type AsymptaActivity = {
  version: "asympta-ir/0.1";
  id: string;
  principal: { id: string; kind: "human" };
  intent: {
    raw: string;
    locale: string;
  };
  status: AsymptaActivityStatus;
  createdAt: number;
  updatedAt: number;
  events: AsymptaActivityEvent[];
  evidence: AsymptaEvidence[];
  outcome?: AsymptaOutcome;
};

function uid(prefix: string) {
  const random = typeof globalThis.crypto?.randomUUID === "function"
    ? globalThis.crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
}

export function createAsymptaActivity(input: {
  intent: string;
  locale?: string;
  principalId?: string;
  now?: number;
}): AsymptaActivity {
  const now = input.now ?? Date.now();
  const intent = input.intent.trim();
  if (!intent) throw new Error("An activity requires a human intention.");

  return {
    version: "asympta-ir/0.1",
    id: uid("activity"),
    principal: { id: input.principalId ?? "human", kind: "human" },
    intent: { raw: intent, locale: input.locale ?? "en" },
    status: "interpreting",
    createdAt: now,
    updatedAt: now,
    events: [],
    evidence: [],
  };
}

export function appendAsymptaEvent(
  activity: AsymptaActivity,
  event: Omit<AsymptaActivityEvent, "id" | "at"> & { at?: number },
): AsymptaActivity {
  const at = event.at ?? Date.now();
  return {
    ...activity,
    status: event.status,
    updatedAt: at,
    events: [
      ...activity.events,
      {
        id: uid("event"),
        at,
        status: event.status,
        protocol: event.protocol,
        actorId: event.actorId,
        peer: event.peer,
        summary: event.summary,
        data: event.data,
      },
    ],
  };
}

export function appendAsymptaEvidence(
  activity: AsymptaActivity,
  evidence: Omit<AsymptaEvidence, "id" | "at"> & { at?: number },
): AsymptaActivity {
  const at = evidence.at ?? Date.now();
  return {
    ...activity,
    updatedAt: at,
    evidence: [
      ...activity.evidence,
      {
        id: uid("evidence"),
        at,
        protocol: evidence.protocol,
        source: evidence.source,
        kind: evidence.kind,
        value: evidence.value,
      },
    ],
  };
}

export function finishAsymptaActivity(
  activity: AsymptaActivity,
  outcome: AsymptaOutcome,
  now = Date.now(),
): AsymptaActivity {
  return {
    ...activity,
    status: outcome.verified ? "completed" : "failed",
    updatedAt: now,
    outcome,
  };
}
