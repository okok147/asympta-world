import type { CanonicalDomainEvent, CanonicalDomainEventType } from "./types.ts";

export type CanonicalTrajectoryNode = {
  id: string;
  type: CanonicalDomainEventType;
  worldRevision: number;
  occurredAt: number;
  actorId: string | null;
  targetAgentIds: readonly string[];
  correlationId: string | null;
  taskId: string | null;
  evidenceRef: string;
  payload: Readonly<Record<string, unknown>>;
};

export type CanonicalTrajectoryEdge = {
  fromEventId: string;
  toEventId: string;
  relation: "causes" | "next_in_correlation";
};

export type CanonicalEventTrajectory = {
  version: 1;
  nodes: readonly CanonicalTrajectoryNode[];
  edges: readonly CanonicalTrajectoryEdge[];
};

function eventOrder(a: CanonicalDomainEvent, b: CanonicalDomainEvent) {
  return a.occurredAt - b.occurredAt || a.eventId.localeCompare(b.eventId);
}

/**
 * Convert committed canonical events into an explicit graph trajectory.
 *
 * This deliberately keeps graph structure separate from natural-language
 * rendering. It can be serialized later for a token baseline, consumed as
 * node/edge targets by a graph model, or projected into another trajectory
 * representation without changing the authoritative world event stream.
 */
export function buildCanonicalEventTrajectory(
  events: readonly CanonicalDomainEvent[],
): CanonicalEventTrajectory {
  const ordered = [...events].sort(eventOrder);
  const ids = new Set(ordered.map((event) => event.eventId));
  const nodes: CanonicalTrajectoryNode[] = ordered.map((event) => ({
    id: event.eventId,
    type: event.type,
    worldRevision: event.worldRevision,
    occurredAt: event.occurredAt,
    actorId: event.actorId,
    targetAgentIds: [...event.targetAgentIds],
    correlationId: event.correlationId,
    taskId: event.taskId,
    evidenceRef: event.evidenceRef,
    payload: event.payload,
  }));

  const edges: CanonicalTrajectoryEdge[] = [];
  const edgeKeys = new Set<string>();
  const previousByCorrelation = new Map<string, string>();

  const addEdge = (edge: CanonicalTrajectoryEdge) => {
    if (edge.fromEventId === edge.toEventId) return;
    const key = `${edge.relation}:${edge.fromEventId}->${edge.toEventId}`;
    if (edgeKeys.has(key)) return;
    edgeKeys.add(key);
    edges.push(edge);
  };

  for (const event of ordered) {
    if (event.causationId && ids.has(event.causationId)) {
      addEdge({
        fromEventId: event.causationId,
        toEventId: event.eventId,
        relation: "causes",
      });
    }

    if (event.correlationId) {
      const previous = previousByCorrelation.get(event.correlationId);
      if (previous) {
        addEdge({
          fromEventId: previous,
          toEventId: event.eventId,
          relation: "next_in_correlation",
        });
      }
      previousByCorrelation.set(event.correlationId, event.eventId);
    }
  }

  return {
    version: 1,
    nodes,
    edges,
  };
}
