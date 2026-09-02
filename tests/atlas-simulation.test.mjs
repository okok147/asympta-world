import assert from "node:assert/strict";
import test from "node:test";

import {
  ATLAS_LOCATIONS,
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
import {
  compileAsymptaContext,
  marketplaceProfilePreset,
  marketplaceTaskIds,
  upsertMarketplaceWorkflow,
} from "../lib/asympta-marketplace-intent.ts";
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

function pointDistance(left, right) {
  const scale = Math.cos(((left.lat + right.lat) / 2) * Math.PI / 180);
  return Math.hypot((left.lon - right.lon) * scale, left.lat - right.lat);
}

function assertContinuationInvariant(world) {
  if (["completed", "blocked", "idle"].includes(world.phase)) return;
  const pendingApproval = world.approvals.some((approval) => approval.status === "pending");
  const activeTask = world.tasks.some((task) => ["moving", "working"].includes(task.status));
  if (world.phase === "waiting_approval") {
    assert.equal(pendingApproval, true, "waiting_approval must always expose a real pending approval");
    return;
  }
  assert.equal(pendingApproval, false, "a pending approval must be the only normal pause state");
  assert.equal(activeTask, true, "a non-terminal workflow without an approval must keep doing work");
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

test("landing demo stays idle until a real workflow starts while ambient city remains alive", () => {
  const demo = createAtlasDemoWorld(5_000);
  assert.equal(demo.phase, "idle");
  assert.equal(demo.workflowId, undefined);
  assert.equal(demo.tasks.length, 0);
  assert.equal(demo.approvals.length, 0);
  assert.ok(demo.agents.every((agent) => agent.status === "idle"));

  const ambient = cityLifeSnapshot(5_000);
  assert.ok(ambient.some((actor) => actor.status === "moving"));
  assert.ok(ambient.some((actor) => actor.status === "working"));
});

test("approving a demo checkpoint resumes work immediately at the checkpoint", () => {
  let world = startAtlasDemoWorkflow(createAtlasWorld(8_000), "custom-order");
  for (let index = 0; index < 7000; index += 1) {
    world = advanceAtlasWorld(world, 120);
    const approval = world.approvals.find((item) => item.status === "pending");
    if (!approval?.taskId) continue;

    const waitingTask = world.tasks.find((item) => item.id === approval.taskId);
    const waitingAgent = waitingTask ? world.agents.find((item) => item.id === waitingTask.agentId) : null;
    assert.ok(waitingTask);
    assert.ok(waitingAgent);
    assert.equal(waitingTask.status, "waiting_approval");
    const checkpointPosition = { ...waitingAgent.position };
    assert.ok(
      pointDistance(checkpointPosition, ATLAS_LOCATIONS[waitingTask.locationId].point) <= 0.00034,
      "the agent must already be at the approval checkpoint",
    );

    const next = resolveAtlasDemoApproval(world, approval.id, true);
    const task = next.tasks.find((item) => item.id === approval.taskId);
    const agent = task ? next.agents.find((item) => item.id === task.agentId) : null;
    assert.ok(task);
    assert.ok(agent);
    assert.equal(task.approvalStatus, "approved");
    assert.equal(task.status, "working");
    assert.equal(agent.status, "working");
    assert.deepEqual(agent.position, checkpointPosition);
    assert.ok(Number.isFinite(task.workStartedAt));
    assertContinuationInvariant(next);
    return;
  }
  assert.fail("demo never reached an approval checkpoint");
});

test("authorised marketplace payment continues through handoff and delivery", () => {
  const compilation = compileAsymptaContext("Buy one meal", {
    requestId: "approval-continuation-marketplace",
    conversationId: "approval-continuation-marketplace",
    locale: "en",
    now: 0,
    profile: marketplaceProfilePreset("everyday", 0),
  });
  assert.equal(compilation.supported, true, compilation.issues.join(" "));
  assert.ok(compilation.envelope);
  const envelope = compilation.envelope;
  upsertMarketplaceWorkflow(envelope);
  const ids = marketplaceTaskIds(envelope.goals[0], 0);
  let world = startAtlasDemoWorkflow(createAtlasWorld(0), "marketplace-intent");
  let paymentApproval = null;

  for (let index = 0; index < 12_000; index += 1) {
    world = advanceAtlasWorld(world, 120);
    assertContinuationInvariant(world);
    paymentApproval = world.approvals.find((approval) => approval.taskId === ids.payment && approval.status === "pending") ?? null;
    if (paymentApproval) break;
  }

  assert.ok(paymentApproval, "marketplace never reached the payment checkpoint");
  const waitingPayment = world.tasks.find((task) => task.id === ids.payment);
  assert.equal(waitingPayment.status, "waiting_approval");

  world = resolveAtlasDemoApproval(world, paymentApproval.id, true);
  const resumedPayment = world.tasks.find((task) => task.id === ids.payment);
  assert.equal(resumedPayment.approvalStatus, "approved");
  assert.equal(resumedPayment.status, "working");
  assertContinuationInvariant(world);

  let sawPostPaymentWork = false;
  for (let index = 0; index < 12_000; index += 1) {
    world = advanceAtlasWorld(world, 120);
    assertContinuationInvariant(world);
    const payment = world.tasks.find((task) => task.id === ids.payment);
    const downstream = [ids.handoff, ids.returning, ids.deliver, ids.verify]
      .map((id) => world.tasks.find((task) => task.id === id))
      .filter(Boolean);
    if (payment?.status === "done" && downstream.some((task) => task.status !== "queued")) sawPostPaymentWork = true;
    if (world.phase === "completed") break;
  }

  assert.equal(sawPostPaymentWork, true, "payment completed but no dependent task continued");
  assert.equal(world.phase, "completed");
  assert.equal(world.tasks.find((task) => task.id === ids.handoff)?.status, "done");
  assert.equal(world.tasks.find((task) => task.id === ids.deliver)?.status, "done");
  assert.equal(world.tasks.find((task) => task.id === ids.verify)?.status, "done");
});

test("workflow total-time estimator stays within 10 percent of the real demo engine", () => {
  // Dynamic marketplace workflows have a dedicated end-to-end liveness test above.
  // This calibration covers the four stable built-in workflow definitions only.
  for (const workflow of ATLAS_WORKFLOWS.filter((candidate) => candidate.id !== "marketplace-intent")) {
    const actualMs = runDemoDuration(workflow.id);
    const estimatedMs = estimateWorkflowTotalMs(workflow.id);
    const relativeError = Math.abs(estimatedMs - actualMs) / Math.max(1, actualMs);
    const breakdown = estimateWorkflowTiming(workflow.id);

    assert.ok(breakdown.approvalCount > 0, `${workflow.id} should include approval checkpoints`);
    assert.equal(breakdown.approvalTravelMs, 0, `${workflow.id} approvals must resume at the existing checkpoint`);
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
