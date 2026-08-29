import assert from "node:assert/strict";
import test from "node:test";

import {
  ATLAS_WORKFLOWS,
  advanceAtlasWorld,
  createAtlasWorld,
  requestWebMcpAction,
  requestWebMcpWorkflow,
  resolveAtlasApproval,
  startAtlasWorkflow,
} from "../lib/atlas-simulation.ts";

function runUntilSettled(initial, maxSteps = 7000) {
  let world = initial;
  for (let index = 0; index < maxSteps; index += 1) {
    world = advanceAtlasWorld(world, 120);
    const approval = world.approvals.find((item) => item.status === "pending");
    if (approval) world = resolveAtlasApproval(world, approval.id, true);
    if (world.phase === "completed" || world.phase === "blocked") break;
  }
  return world;
}

test("new atlas defines several multi-stakeholder workflows", () => {
  assert.equal(ATLAS_WORKFLOWS.length, 4);
  for (const workflow of ATLAS_WORKFLOWS) {
    assert.ok(workflow.tasks.length >= 10);
    assert.ok(workflow.tasks.some((task) => task.requiresApproval));
    assert.ok(workflow.tasks.some((task) => task.dependsOn.length > 1));
  }
});

test("custom order advances through movement, approvals and completion", () => {
  const started = startAtlasWorkflow(createAtlasWorld(1_000), "custom-order");
  assert.equal(started.phase, "running");
  assert.ok(started.agents.some((agent) => agent.status === "moving" || agent.status === "working"));

  const completed = runUntilSettled(started);
  assert.equal(completed.phase, "completed");
  assert.ok(completed.tasks.every((task) => task.status === "done"));
  assert.ok(completed.approvals.filter((approval) => approval.source === "workflow").length >= 3);
  assert.ok(completed.approvals.filter((approval) => approval.status === "approved").length >= 3);
  assert.ok(completed.events.some((event) => event.title === "Workflow complete"));
  assert.ok(completed.events.some((event) => event.detail.includes("published the result")));
});

test("WebMCP workflow requests cannot start without explicit approval", () => {
  const idle = createAtlasWorld(2_000);
  const requested = requestWebMcpWorkflow(idle, "launch-stock");
  assert.equal(requested.phase, "idle");
  assert.equal(requested.workflowId, undefined);
  const approval = requested.approvals.find((item) => item.kind === "webmcp-start" && item.status === "pending");
  assert.ok(approval);

  const allowed = resolveAtlasApproval(requested, approval.id, true);
  assert.equal(allowed.workflowId, "launch-stock");
  assert.equal(allowed.phase, "running");
});

test("WebMCP external actions are queued rather than claimed as real side effects", () => {
  const world = startAtlasWorkflow(createAtlasWorld(3_000), "service-recovery");
  const requested = requestWebMcpAction(world, "release_shipment", "agent-logistics", "Prioritise the simulated replacement handoff.");
  const approval = requested.approvals.find((item) => item.source === "webmcp" && item.actionType === "release_shipment" && item.status === "pending");
  assert.ok(approval);
  assert.match(approval.consequence, /simulated|simulation/i);
  assert.doesNotMatch(approval.consequence, /real shipment was|payment completed/i);
});
