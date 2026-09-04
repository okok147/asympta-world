import assert from "node:assert/strict";
import test from "node:test";

import { createAtlasWorld, startAtlasWorkflow } from "../lib/atlas-simulation.ts";
import {
  buildCanonicalEventTrajectory,
  collectCanonicalDomainEvents,
} from "../lib/agent-runtime/index.ts";

test("committed runtime events expose canonical graph-ready envelopes", () => {
  const world = startAtlasWorkflow(createAtlasWorld(11_000), "custom-order");
  const events = collectCanonicalDomainEvents(world);

  assert.ok(events.length > 0);
  for (const event of events) {
    assert.equal(event.version, 1);
    assert.equal(event.worldRevision, world.revision);
    assert.ok(event.eventId.length > 0);
    assert.ok(event.evidenceRef.length > 0);
    assert.ok(event.type.includes("."));
    assert.ok(["workflow", "task", "message", "approval"].includes(event.runtimeKind));
    assert.equal(event.workflowId, "custom-order");
    assert.ok(event.correlationId?.startsWith("task:") || event.correlationId === "workflow:custom-order");
  }
});

test("canonical events can become a causal/correlation trajectory without text serialization", () => {
  const first = {
    version: 1,
    eventId: "event:request",
    type: "task.observed",
    runtimeKind: "task",
    worldRevision: 1,
    occurredAt: 100,
    causationId: null,
    correlationId: "task:purchase",
    actorId: "agent-user",
    targetAgentIds: ["agent-business"],
    workflowId: "custom-order",
    taskId: "purchase",
    evidenceRef: "test:request",
    payload: { intent: "buy guitar" },
  };
  const second = {
    ...first,
    eventId: "event:quote",
    type: "message.sent",
    runtimeKind: "message",
    worldRevision: 2,
    occurredAt: 200,
    causationId: "event:request",
    actorId: "agent-business",
    targetAgentIds: ["agent-user"],
    evidenceRef: "test:quote",
    payload: { price: 2300 },
  };

  const trajectory = buildCanonicalEventTrajectory([second, first]);

  assert.equal(trajectory.version, 1);
  assert.deepEqual(trajectory.nodes.map((node) => node.id), ["event:request", "event:quote"]);
  assert.ok(trajectory.edges.some((edge) =>
    edge.relation === "causes"
      && edge.fromEventId === "event:request"
      && edge.toEventId === "event:quote"));
  assert.ok(trajectory.edges.some((edge) =>
    edge.relation === "next_in_correlation"
      && edge.fromEventId === "event:request"
      && edge.toEventId === "event:quote"));
});
