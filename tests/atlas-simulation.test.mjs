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
import {
  CITY_LIFE_COUNT,
  cityLifeSnapshot,
  createAtlasDemoWorld,
  resolveAtlasDemoApproval,
  startAtlasDemoWorkflow,
} from "../lib/atlas-demo.ts";
import { estimateWorkflowTiming, estimateWorkflowTotalMs } from "../lib/atlas-workflow-time.ts";

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

function runDemoDuration(workflowId, maxSteps = 12000) {
  let world = startAtlasDemoWorkflow(createAtlasWorld(0), workflowId);
  const startedAt = world.now;
  for (let index = 0; index < maxSteps; index += 1) {
    world = advanceAtlasWorld(world, 80);
    let approval = world.approvals.find((item) => item.status === "pending");
    while (approval) {
      world = resolveAtlasDemoApproval(world, approval.id, true);
      approval = world.approvals.find((item) => item.status === "pending");
    }
    if (world.phase === "completed") return world.now - startedAt;
    if (world.phase === "blocked") throw new Error(`${workflowId} unexpectedly blocked during calibration`);
  }
  throw new Error(`${workflowId} did not complete during calibration`);
}

test("new atlas defines several multi-stakeholder workflows", () => {
  assert.equal(ATLAS_WORKFLOWS.length, 4);
  for (const workflow of ATLAS_WORKFLOWS) {
    assert.ok(workflow.tasks.length >= 10);
    assert.ok(workflow.tasks.some((task) => task.requiresApproval));
    assert.ok(workflow.tasks.some((task) => task.dependsOn.length > 1));
  }
});

test("custom order advances through approvals and completion", () => {
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

test("demo boots with a foreground agent visibly travelling", () => {
  const demo = createAtlasDemoWorld(5_000);
  const moving = demo.agents.filter((agent) => agent.status === "moving");
  assert.ok(moving.length >= 1);
  for (const agent of moving) {
    assert.notDeepEqual(agent.position, agent.target);
  }
});

test("approving a demo checkpoint produces another visible travel leg", () => {
  let world = createAtlasDemoWorld(8_000);
  for (let index = 0; index < 7000; index += 1) {
    world = advanceAtlasWorld(world, 120);
    const approval = world.approvals.find((item) => item.status === "pending");
    if (approval) {
      const next = resolveAtlasDemoApproval(world, approval.id, true);
      const task = approval.taskId ? next.tasks.find((item) => item.id === approval.taskId) : null;
      const agent = task ? next.agents.find((item) => item.id === task.agentId) : null;
      assert.ok(agent);
      assert.equal(agent.status, "moving");
      assert.notDeepEqual(agent.position, agent.target);
      return;
    }
  }
  assert.fail("demo never reached an approval checkpoint");
});

test("workflow total-time estimator stays within 10 percent of the real demo engine", () => {
  for (const workflow of ATLAS_WORKFLOWS) {
    const actualMs = runDemoDuration(workflow.id);
    const estimatedMs = estimateWorkflowTotalMs(workflow.id);
    const relativeError = Math.abs(estimatedMs - actualMs) / Math.max(1, actualMs);
    const breakdown = estimateWorkflowTiming(workflow.id);

    assert.ok(breakdown.approvalCount > 0, `${workflow.id} should include approval checkpoints`);
    assert.ok(breakdown.approvalTravelMs > 0, `${workflow.id} should include post-approval travel`);
    assert.ok(
      relativeError <= 0.10,
      `${workflow.id} ETA error ${(relativeError * 100).toFixed(1)}%: estimated ${estimatedMs}ms vs actual ${actualMs}ms`,
    );
  }
});

test("ambient city has many independent synthetic user and business actors that keep moving", () => {
  const first = cityLifeSnapshot(10_000);
  const second = cityLifeSnapshot(12_000);
  assert.equal(first.length, CITY_LIFE_COUNT);
  assert.ok(first.length >= 24);
  assert.ok(first.some((actor) => actor.side === "user"));
  assert.ok(first.some((actor) => actor.side === "business"));
  assert.ok(first.some((actor) => actor.side === "supplier"));
  assert.ok(first.some((actor) => actor.side === "logistics"));
  assert.ok(first.every((actor) => actor.simulated === true));
  assert.ok(first.some((actor, index) => actor.position.lon !== second[index].position.lon || actor.position.lat !== second[index].position.lat));
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
