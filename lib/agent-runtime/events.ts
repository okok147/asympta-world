import type { AtlasEvent, AtlasWorldState, WorkflowId } from "../atlas-simulation.ts";
import { profileForAgent } from "./profiles.ts";
import type {
  AgentEventCursor,
  AgentEventKind,
  AgentRuntimeEvent,
  CanonicalDomainEvent,
  CanonicalDomainEventType,
} from "./types.ts";

const MAX_SEEN_EVENT_IDS_PER_AGENT = 256;

function unique(values: Iterable<string>) {
  return [...new Set(values)];
}

function isKnownAgent(world: AtlasWorldState, agentId: string | undefined) {
  return Boolean(agentId && world.agents.some((agent) => agent.id === agentId));
}

function isTaskCompletion(event: AtlasEvent) {
  return /\bcomplete(?:d)?\b/i.test(event.title) || /completed the work and published/i.test(event.detail);
}

function targetsForAtlasEvent(world: AtlasWorldState, event: AtlasEvent) {
  const targets = new Set<string>();
  if (isKnownAgent(world, event.agentId)) targets.add(event.agentId as string);

  if (event.taskId) {
    const task = world.tasks.find((candidate) => candidate.id === event.taskId);
    if (task) targets.add(task.agentId);
    if (task && isTaskCompletion(event)) {
      for (const dependent of world.tasks.filter((candidate) => candidate.dependsOn.includes(task.id))) {
        targets.add(dependent.agentId);
      }
    }
  }
  return [...targets];
}

function correlationIdFor(workflowId: WorkflowId | null, taskId: string | null) {
  if (taskId) return `task:${taskId}`;
  if (workflowId) return `workflow:${workflowId}`;
  return null;
}

function canonicalEnvelope(
  world: AtlasWorldState,
  input: {
    eventId: string;
    type: CanonicalDomainEventType;
    runtimeKind: AgentEventKind;
    occurredAt: number;
    actorId: string | null;
    targetAgentIds: readonly string[];
    taskId: string | null;
    evidenceRef: string;
    payload: Readonly<Record<string, unknown>>;
    workflowId?: WorkflowId | null;
    causationId?: string | null;
    correlationId?: string | null;
  },
): CanonicalDomainEvent {
  const workflowId = input.workflowId ?? world.workflowId ?? null;
  return {
    version: 1,
    eventId: input.eventId,
    type: input.type,
    runtimeKind: input.runtimeKind,
    worldRevision: world.revision,
    occurredAt: input.occurredAt,
    causationId: input.causationId ?? null,
    correlationId: input.correlationId ?? correlationIdFor(workflowId, input.taskId),
    actorId: input.actorId,
    targetAgentIds: input.targetAgentIds,
    workflowId,
    taskId: input.taskId,
    evidenceRef: input.evidenceRef,
    payload: input.payload,
  };
}

function approvalType(status: "pending" | "approved" | "declined"): CanonicalDomainEventType {
  switch (status) {
    case "approved": return "approval.approved";
    case "declined": return "approval.declined";
    default: return "approval.requested";
  }
}

export function collectCommittedAgentEvents(world: AtlasWorldState): AgentRuntimeEvent[] {
  const atlasEvents: AgentRuntimeEvent[] = world.events.map((event) => {
    const targetAgentIds = targetsForAtlasEvent(world, event);
    const id = `atlas:${event.id}`;
    const kind: AgentEventKind = targetAgentIds.length > 0 ? "task" : "workflow";
    const taskId = event.taskId ?? null;
    const sourceAgentId = isKnownAgent(world, event.agentId) ? event.agentId ?? null : null;
    return {
      id,
      kind,
      createdAt: event.createdAt,
      worldRevision: world.revision,
      title: event.title,
      detail: event.detail,
      sourceAgentId,
      targetAgentIds,
      taskId,
      canonical: canonicalEnvelope(world, {
        eventId: id,
        type: kind === "task" ? "task.observed" : "workflow.observed",
        runtimeKind: kind,
        occurredAt: event.createdAt,
        actorId: sourceAgentId,
        targetAgentIds,
        taskId,
        evidenceRef: `atlas-event:${event.id}`,
        payload: {
          title: event.title,
          detail: event.detail,
        },
      }),
    };
  });

  const messageEvents: AgentRuntimeEvent[] = world.messages.map((message) => {
    const id = `message:${message.id}`;
    const sourceAgentId = isKnownAgent(world, message.fromAgentId) ? message.fromAgentId : null;
    const targetAgentIds = isKnownAgent(world, message.toAgentId) ? [message.toAgentId] : [];
    return {
      id,
      kind: "message",
      createdAt: message.createdAt,
      worldRevision: world.revision,
      title: "Agent message",
      detail: message.text,
      sourceAgentId,
      targetAgentIds,
      taskId: null,
      canonical: canonicalEnvelope(world, {
        eventId: id,
        type: "message.sent",
        runtimeKind: "message",
        occurredAt: message.createdAt,
        actorId: sourceAgentId,
        targetAgentIds,
        taskId: null,
        evidenceRef: `atlas-message:${message.id}`,
        payload: {
          text: message.text,
          expiresAt: message.expiresAt,
        },
      }),
    };
  });

  const approvalEvents: AgentRuntimeEvent[] = world.approvals.map((approval) => {
    const task = approval.taskId ? world.tasks.find((candidate) => candidate.id === approval.taskId) : undefined;
    const targetAgentIds = unique([
      ...(isKnownAgent(world, approval.agentId) ? [approval.agentId as string] : []),
      ...(task ? [task.agentId] : []),
    ]);
    const id = `approval:${approval.id}:${approval.status}`;
    const occurredAt = approval.resolvedAt ?? approval.requestedAt;
    const taskId = approval.taskId ?? null;
    return {
      id,
      kind: "approval",
      createdAt: occurredAt,
      worldRevision: world.revision,
      title: approval.title,
      detail: `${approval.detail} · ${approval.status}`,
      sourceAgentId: null,
      targetAgentIds,
      taskId,
      canonical: canonicalEnvelope(world, {
        eventId: id,
        type: approvalType(approval.status),
        runtimeKind: "approval",
        occurredAt,
        actorId: null,
        targetAgentIds,
        taskId,
        workflowId: approval.workflowId ?? world.workflowId ?? null,
        evidenceRef: `atlas-approval:${approval.id}:${approval.status}`,
        payload: {
          source: approval.source,
          kind: approval.kind,
          status: approval.status,
          actionType: approval.actionType ?? null,
          consequence: approval.consequence,
        },
      }),
    };
  });

  const deduplicated = new Map<string, AgentRuntimeEvent>();
  for (const event of [...atlasEvents, ...messageEvents, ...approvalEvents]) deduplicated.set(event.id, event);
  return [...deduplicated.values()].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
}

/**
 * Direct structured stream for replay, causal inspection, and model datasets.
 * No language serialization is required to consume this representation.
 */
export function collectCanonicalDomainEvents(world: AtlasWorldState): CanonicalDomainEvent[] {
  return collectCommittedAgentEvents(world).map((event) => event.canonical);
}

export function createAgentEventCursor(): AgentEventCursor {
  return { version: 1, seenByAgent: {} };
}

export function subscribedEventsForAgent(
  world: AtlasWorldState,
  agentId: string,
  cursor: AgentEventCursor = createAgentEventCursor(),
) {
  const profile = profileForAgent(agentId);
  const seen = new Set(cursor.seenByAgent[agentId] ?? []);
  return collectCommittedAgentEvents(world).filter((event) => {
    if (seen.has(event.id) || !profile.subscriptions.kinds.includes(event.kind)) return false;
    if (event.kind === "workflow") return event.targetAgentIds.length === 0;
    return event.targetAgentIds.includes(agentId);
  });
}

export function markAgentEventsSeen(cursor: AgentEventCursor, agentId: string, eventIds: readonly string[]): AgentEventCursor {
  if (eventIds.length === 0) return cursor;
  const existing = cursor.seenByAgent[agentId] ?? [];
  const merged = unique([...existing, ...eventIds]).slice(-MAX_SEEN_EVENT_IDS_PER_AGENT);
  return {
    version: 1,
    seenByAgent: {
      ...cursor.seenByAgent,
      [agentId]: merged,
    },
  };
}
