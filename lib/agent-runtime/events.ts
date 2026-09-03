import type { AtlasEvent, AtlasWorldState } from "../atlas-simulation.ts";
import { profileForAgent } from "./profiles.ts";
import type { AgentEventCursor, AgentRuntimeEvent } from "./types.ts";

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

export function collectCommittedAgentEvents(world: AtlasWorldState): AgentRuntimeEvent[] {
  const atlasEvents: AgentRuntimeEvent[] = world.events.map((event) => {
    const targetAgentIds = targetsForAtlasEvent(world, event);
    return {
      id: `atlas:${event.id}`,
      kind: targetAgentIds.length > 0 ? "task" : "workflow",
      createdAt: event.createdAt,
      worldRevision: world.revision,
      title: event.title,
      detail: event.detail,
      sourceAgentId: isKnownAgent(world, event.agentId) ? event.agentId ?? null : null,
      targetAgentIds,
      taskId: event.taskId ?? null,
    };
  });

  const messageEvents: AgentRuntimeEvent[] = world.messages.map((message) => ({
    id: `message:${message.id}`,
    kind: "message",
    createdAt: message.createdAt,
    worldRevision: world.revision,
    title: "Agent message",
    detail: message.text,
    sourceAgentId: isKnownAgent(world, message.fromAgentId) ? message.fromAgentId : null,
    targetAgentIds: isKnownAgent(world, message.toAgentId) ? [message.toAgentId] : [],
    taskId: null,
  }));

  const approvalEvents: AgentRuntimeEvent[] = world.approvals.map((approval) => {
    const task = approval.taskId ? world.tasks.find((candidate) => candidate.id === approval.taskId) : undefined;
    const targetAgentIds = unique([
      ...(isKnownAgent(world, approval.agentId) ? [approval.agentId as string] : []),
      ...(task ? [task.agentId] : []),
    ]);
    return {
      id: `approval:${approval.id}:${approval.status}`,
      kind: "approval",
      createdAt: approval.resolvedAt ?? approval.requestedAt,
      worldRevision: world.revision,
      title: approval.title,
      detail: `${approval.detail} · ${approval.status}`,
      sourceAgentId: null,
      targetAgentIds,
      taskId: approval.taskId ?? null,
    };
  });

  const deduplicated = new Map<string, AgentRuntimeEvent>();
  for (const event of [...atlasEvents, ...messageEvents, ...approvalEvents]) deduplicated.set(event.id, event);
  return [...deduplicated.values()].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
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
