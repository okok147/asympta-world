import assert from "node:assert/strict";
import test from "node:test";

import "../lib/atlas-workflow-expansion.ts";
import {
  advanceAtlasWorld,
  atlasAgentObservation,
  atlasInvariantViolations,
  atlasSnapshot,
  createAtlasWorld,
  requestWebMcpAction,
  resolveAtlasApproval,
  restoreAtlasWorld,
  serializeAtlasWorld,
  startAtlasWorkflow,
} from "../lib/atlas-canonical-world.ts";

function completeWorld(initial, maxSteps = 12_000) {
  let world = initial;
  for (let index = 0; index < maxSteps; index += 1) {
    world = advanceAtlasWorld(world, 120);
    let approval = world.approvals.find((item) => item.status === "pending");
    while (approval) {
      world = resolveAtlasApproval(world, approval.id, true);
      if (world.phase === "blocked") break;
      approval = world.approvals.find((item) => item.status === "pending");
    }
    if (world.phase === "completed" || world.phase === "blocked") return world;
  }
  return world;
}

test("foreground workflow and world runtime advance as one state machine", () => {
  const started = startAtlasWorkflow(createAtlasWorld(1_000, 1234), "custom-order");
  const completed = completeWorld(started);
  assert.equal(completed.phase, "completed");
  assert.equal(completed.runtime.orders.at(-1)?.status, "delivered");
  assert.ok(completed.runtime.metrics.completedTransactions >= 1);
  assert.ok(completed.runtime.metrics.completedDeliveries >= 1);
  assert.ok(completed.runtime.metrics.alternativePlansTriggered >= 1);
  assert.deepEqual(atlasInvariantViolations(completed), []);
  assert.ok(completed.tasks.some((task) => Boolean(task.runtimeIntentId)));
  assert.ok(completed.events.some((event) => /adapted|fallback|constraint/i.test(`${event.title} ${event.detail}`)));
});

test("WebMCP action request only mutates the runtime after human approval", () => {
  let world = startAtlasWorkflow(createAtlasWorld(5_000, 81), "custom-order");
  world = advanceAtlasWorld(world, 12_000);
  const beforeReservations = world.runtime.reservations.length;
  world = requestWebMcpAction(world, "reserve_capacity", "agent-supplier", "Use current world constraints to reserve feasible supply.");
  assert.equal(world.runtime.reservations.length, beforeReservations);
  const approval = world.approvals.find((item) => item.source === "webmcp" && item.status === "pending");
  assert.ok(approval);
  world = resolveAtlasApproval(world, approval.id, true);
  assert.ok(world.runtime.reservations.length > beforeReservations);
  assert.equal(world.runtime.orders.at(-1)?.supplierId, "supplier-alternate");
});

test("agent observation boundary stays filtered even while human snapshot exposes inspectable world state", () => {
  let world = startAtlasWorkflow(createAtlasWorld(2_000, 19), "custom-order");
  for (let index = 0; index < 100; index += 1) world = advanceAtlasWorld(world, 120);
  const customer = atlasAgentObservation(world, "agent-customer");
  const supplier = atlasAgentObservation(world, "agent-supplier");
  assert.equal(customer.information.some((item) => item.subject === "supplier-capacity"), false);
  assert.equal(supplier.information.some((item) => item.subject === "supplier-capacity"), true);
  const snapshot = atlasSnapshot(world);
  assert.equal(snapshot.schemaVersion, 2);
  assert.ok(snapshot.runtime.scheduledEvents.length > 0);
});

test("canonical Atlas persistence round-trip restores runtime and workflow state", () => {
  let world = startAtlasWorkflow(createAtlasWorld(8_000, 404), "service-recovery");
  for (let i = 0; i < 80; i += 1) world = advanceAtlasWorld(world, 120);
  const restored = restoreAtlasWorld(serializeAtlasWorld(world));
  assert.ok(restored);
  assert.equal(restored.workflowId, world.workflowId);
  assert.deepEqual(restored.runtime.orders, world.runtime.orders);
  assert.deepEqual(atlasInvariantViolations(restored), []);
});
