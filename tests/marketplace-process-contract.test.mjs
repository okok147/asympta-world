import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createAsymptaActivity,
  finishAsymptaActivity,
} from "../lib/asympta-activity.ts";
import {
  ATLAS_AGENTS,
  ATLAS_LOCATIONS,
  ATLAS_WORKFLOWS,
  atlasSnapshot,
  advanceAtlasWorld,
  createAtlasWorld,
  resolveAtlasApproval,
  startAtlasWorkflow,
} from "../lib/atlas-simulation.ts";
import {
  completionReceiptFromActivity,
  completionReceiptFromCurrentRequest,
  completionReceiptFromMarketplaceExecution,
} from "../lib/asympta-completion-receipt.ts";
import {
  buildMarketplaceWorkflow,
  compileAsymptaContext,
  createMarketplaceExecution,
  marketplaceInventoryInvariant,
  marketplaceProfilePreset,
  syncMarketplaceExecution,
  upsertMarketplaceWorkflow,
} from "../lib/asympta-marketplace-intent.ts";
import { marketplaceCurrentRequestFromExecution } from "../lib/asympta-marketplace-request-routing.ts";
import {
  inspectAsymptaWorkflowLiveness,
  validateAsymptaWorkflowContract,
} from "../lib/asympta-workflow-contract.ts";
import {
  createAsymptaWorkflowLifecycleTracker,
  observeAsymptaWorkflowLifecycle,
  seedAsymptaWorkflowLifecycle,
} from "../lib/asympta-workflow-lifecycle.ts";

function compileBuySomeFood(requestId = "buy-some-food-process") {
  const compilation = compileAsymptaContext("Buy some food", {
    requestId,
    conversationId: requestId,
    locale: "en",
    now: 0,
    profile: marketplaceProfilePreset("local_delivery", 0),
  });
  assert.equal(compilation.supported, true, compilation.issues.join(" "));
  assert.ok(compilation.envelope);
  return compilation.envelope;
}

function runBuySomeFoodToCompletion() {
  const envelope = compileBuySomeFood();
  const workflow = buildMarketplaceWorkflow(envelope);
  const validation = validateAsymptaWorkflowContract(workflow, {
    agentIds: ATLAS_AGENTS.map((agent) => agent.id),
    locationIds: Object.keys(ATLAS_LOCATIONS),
  });
  assert.equal(validation.valid, true, validation.issues.map((issue) => issue.message).join(" "));
  assert.equal(validation.topologicalOrder.length, workflow.tasks.length);
  assert.ok(validation.roots.length >= 1);
  assert.ok(validation.terminalTasks.length >= 1);

  upsertMarketplaceWorkflow(envelope);
  let world = startAtlasWorkflow(createAtlasWorld(0), "marketplace-intent");
  let execution = createMarketplaceExecution(envelope);
  let decisions = 0;
  let sawStore = false;
  let sawReservedInventory = false;
  let sawCarrier = false;

  for (let index = 0; index < 20_000 && world.phase !== "completed"; index += 1) {
    const snapshot = atlasSnapshot(world);
    const liveness = inspectAsymptaWorkflowLiveness(snapshot);
    assert.notEqual(liveness.state, "stalled", `${liveness.reason}\n${JSON.stringify(snapshot.tasks)}`);
    assert.notEqual(liveness.state, "invalid", `${liveness.reason}\n${JSON.stringify(snapshot)}`);

    execution = syncMarketplaceExecution(execution, snapshot);
    sawStore ||= execution.transactions.some((transaction) => transaction.status !== "planned");
    sawReservedInventory ||= execution.ledger.some((line) => line.marketReserved > 0);
    sawCarrier ||= execution.ledger.some((line) => line.carrierCargo > 0);

    const approval = world.approvals.find((candidate) => candidate.status === "pending");
    if (approval) {
      decisions += 1;
      world = resolveAtlasApproval(world, approval.id, true);
      execution = syncMarketplaceExecution(execution, atlasSnapshot(world));
      continue;
    }
    world = advanceAtlasWorld(world, 120);
  }

  execution = syncMarketplaceExecution(execution, atlasSnapshot(world));
  return { envelope, workflow, world, execution, decisions, sawStore, sawReservedInventory, sawCarrier };
}

test("Buy some food progresses through the real engine, one approval, delivery and verification", () => {
  const result = runBuySomeFoodToCompletion();
  assert.equal(result.world.phase, "completed");
  assert.ok(result.world.tasks.every((task) => task.status === "done"));
  assert.equal(result.decisions, 1, "the food process should pause only once for simulated payment approval");
  assert.equal(result.execution.status, "completed");
  assert.equal(result.execution.transactions.length, 1);
  assert.equal(result.execution.transactions[0].status, "completed");
  assert.equal(result.execution.transactions[0].payment, "authorized");
  assert.equal(result.execution.ledger[0].marketReserved, 0);
  assert.equal(result.execution.ledger[0].carrierCargo, 0);
  assert.equal(result.execution.ledger[0].userInventory, result.execution.ledger[0].quantity);
  assert.equal(result.sawStore, true);
  assert.equal(result.sawReservedInventory, true);
  assert.equal(result.sawCarrier, true);
  assert.ok(result.execution.packets.some((packet) => packet.kind === "approval_request"));
  assert.ok(result.execution.packets.some((packet) => packet.kind === "payment_authorized"));
  assert.ok(result.execution.packets.some((packet) => packet.kind === "goods_handoff"));
  assert.ok(result.execution.packets.some((packet) => packet.kind === "delivery_receipt"));
  assert.deepEqual(marketplaceInventoryInvariant(result.execution), { valid: true, issues: [] });
});

test("completion is receipt-backed and drives the same verified job id used by the celebration", () => {
  const { execution } = runBuySomeFoodToCompletion();
  const request = marketplaceCurrentRequestFromExecution(execution, "human", "en");
  assert.equal(request.status, "completed");
  assert.equal(request.verification, "verified");

  const executionReceipt = completionReceiptFromMarketplaceExecution(execution, 1_000);
  const requestReceipt = completionReceiptFromCurrentRequest(request, 1_000);
  assert.ok(executionReceipt);
  assert.ok(requestReceipt);
  assert.equal(executionReceipt.id, requestReceipt.id);
  assert.equal(executionReceipt.id, `request:${execution.envelope.requestId}`);
  assert.equal(executionReceipt.verification, "verified");
  assert.equal(executionReceipt.simulated, true);
  assert.match(executionReceipt.summary, /delivered|inventory/i);

  const missingReceipt = structuredClone(execution);
  missingReceipt.packets = missingReceipt.packets.filter((packet) => packet.kind !== "delivery_receipt");
  assert.equal(completionReceiptFromMarketplaceExecution(missingReceipt, 1_000), null);

  const missingInventory = structuredClone(execution);
  missingInventory.ledger[0].userInventory = 0;
  missingInventory.ledger[0].marketAvailable += missingInventory.ledger[0].quantity;
  assert.equal(completionReceiptFromMarketplaceExecution(missingInventory, 1_000), null);
});

test("activity fallback preserves verification and simulation provenance instead of trusting completed text", () => {
  const base = createAsymptaActivity({ intent: "Prepare a verified result", now: 0 });
  const bareCompleted = {
    ...base,
    status: "completed",
  };
  assert.equal(completionReceiptFromActivity(bareCompleted, 1_000), null);

  const unverifiedCompleted = {
    ...base,
    status: "completed",
    outcome: {
      verified: false,
      verification: "protocol-response",
      summary: "A result exists but was not verified.",
      value: { provenance: { simulated: false } },
    },
  };
  assert.equal(completionReceiptFromActivity(unverifiedCompleted, 1_000), null);

  const unknownMode = finishAsymptaActivity(base, {
    verified: true,
    verification: "protocol-response",
    summary: "Verified but without execution-mode provenance.",
    value: { answer: "done" },
  }, 500);
  assert.equal(completionReceiptFromActivity(unknownMode, 1_000), null);

  const simulated = finishAsymptaActivity(base, {
    verified: true,
    verification: "task-completed",
    summary: "The simulated task completed.",
    value: { mode: "simulated", result: { simulated: true } },
  }, 500);
  const simulatedReceipt = completionReceiptFromActivity(simulated, 1_000);
  assert.ok(simulatedReceipt);
  assert.equal(simulatedReceipt.verification, "verified");
  assert.equal(simulatedReceipt.simulated, true);

  const live = finishAsymptaActivity(base, {
    verified: true,
    verification: "protocol-response",
    summary: "The connected result completed.",
    value: { provenance: { simulated: false } },
  }, 500);
  const liveReceipt = completionReceiptFromActivity(live, 1_000);
  assert.ok(liveReceipt);
  assert.equal(liveReceipt.simulated, false);

  const projectedAction = {
    requestId: "action-without-mode",
    source: "human",
    intent: "Do a live action",
    goal: "Do a live action",
    kind: "action",
    permission: "WRITE_REQUEST",
    status: "completed",
    actor: "Asympta",
    step: "Done",
    destination: null,
    sourceCount: 0,
    verification: "verified",
    events: [],
    updatedAt: new Date(0).toISOString(),
  };
  assert.equal(completionReceiptFromCurrentRequest(projectedAction, 1_000), null);
});

test("workflow lifecycle gives a short start signal, one completion gate, and never replays hydration completion", () => {
  const completedObservation = {
    source: "workflow",
    fingerprint: "dinner-network",
    workflowId: "dinner-network",
    title: "Dinner Coordination",
    phase: "completed",
    simulated: true,
    requestId: null,
  };
  const hydrationTracker = createAsymptaWorkflowLifecycleTracker();
  seedAsymptaWorkflowLifecycle(hydrationTracker, "workflow", completedObservation);
  assert.deepEqual(
    observeAsymptaWorkflowLifecycle(hydrationTracker, completedObservation, 100),
    { start: null, completionRunId: null },
  );

  const tracker = createAsymptaWorkflowLifecycleTracker();
  seedAsymptaWorkflowLifecycle(tracker, "marketplace", null);
  const active = {
    source: "marketplace",
    fingerprint: "execution-food-1",
    workflowId: "marketplace-intent",
    title: "Buy some food",
    phase: "active",
    simulated: true,
    requestId: "food-1",
  };
  const started = observeAsymptaWorkflowLifecycle(tracker, active, 1_000);
  assert.ok(started.start);
  assert.equal(started.start.title, "Buy some food");
  assert.equal(started.start.schemaVersion, "asympta.workflow-start.v1");
  assert.equal(started.completionRunId, null);
  assert.deepEqual(
    observeAsymptaWorkflowLifecycle(tracker, active, 1_100),
    { start: null, completionRunId: null },
  );

  const completed = observeAsymptaWorkflowLifecycle(tracker, { ...active, phase: "completed" }, 2_000);
  assert.equal(completed.start, null);
  assert.equal(completed.completionRunId, started.start.id);
  assert.deepEqual(
    observeAsymptaWorkflowLifecycle(tracker, { ...active, phase: "completed" }, 2_100),
    { start: null, completionRunId: null },
  );

  const restarted = observeAsymptaWorkflowLifecycle(tracker, active, 3_000);
  assert.ok(restarted.start);
  assert.notEqual(restarted.start.id, started.start.id);

  const restoredActiveTracker = createAsymptaWorkflowLifecycleTracker();
  seedAsymptaWorkflowLifecycle(restoredActiveTracker, "marketplace", active);
  const restoredCompletion = observeAsymptaWorkflowLifecycle(
    restoredActiveTracker,
    { ...active, phase: "completed" },
    4_000,
  );
  assert.equal(restoredCompletion.start, null);
  assert.ok(restoredCompletion.completionRunId);
});

test("all current workflow graphs validate and malformed graphs fail before they can stall", () => {
  for (const workflow of ATLAS_WORKFLOWS) {
    const validation = validateAsymptaWorkflowContract(workflow, {
      agentIds: ATLAS_AGENTS.map((agent) => agent.id),
      locationIds: Object.keys(ATLAS_LOCATIONS),
    });
    assert.equal(validation.valid, true, `${workflow.id}: ${validation.issues.map((issue) => issue.message).join(" ")}`);
  }

  const missingDependency = validateAsymptaWorkflowContract({
    id: "missing-dependency",
    tasks: [{
      id: "finish",
      agentId: "agent-user",
      locationId: "shibuya",
      dependsOn: ["never-created"],
      workMs: 100,
    }],
  });
  assert.equal(missingDependency.valid, false);
  assert.ok(missingDependency.issues.some((issue) => issue.code === "unknown_dependency"));

  const cycle = validateAsymptaWorkflowContract({
    id: "cycle",
    tasks: [
      { id: "a", agentId: "agent-user", locationId: "shibuya", dependsOn: ["b"], workMs: 100 },
      { id: "b", agentId: "agent-user", locationId: "shibuya", dependsOn: ["a"], workMs: 100 },
    ],
  });
  assert.equal(cycle.valid, false);
  assert.ok(cycle.issues.some((issue) => issue.code === "dependency_cycle"));

  const noncanonicalTask = validateAsymptaWorkflowContract({
    id: "noncanonical-task",
    tasks: [
      { id: "prepare ", agentId: "agent-user", locationId: "shibuya", dependsOn: [], workMs: 100 },
      { id: "finish", agentId: "agent-user", locationId: "shibuya", dependsOn: ["prepare"], workMs: 100 },
    ],
  });
  assert.equal(noncanonicalTask.valid, false);
  assert.ok(noncanonicalTask.issues.some((issue) => issue.code === "invalid_task_id"));
  assert.ok(noncanonicalTask.issues.some((issue) => issue.code === "unknown_dependency"));

  const noncanonicalDependency = validateAsymptaWorkflowContract({
    id: "noncanonical-dependency",
    tasks: [
      { id: "prepare", agentId: "agent-user", locationId: "shibuya", dependsOn: [], workMs: 100 },
      { id: "finish", agentId: "agent-user", locationId: "shibuya", dependsOn: ["prepare "], workMs: 100 },
    ],
  });
  assert.equal(noncanonicalDependency.valid, false);
  assert.ok(noncanonicalDependency.issues.some((issue) => issue.code === "invalid_dependency_id"));
});

test("the product separates the short start celebration from the verified large finish celebration", async () => {
  const [page, layout, coordinator, lifecycle, threeEffects, effectsCss, celebration, completionCss, workflow] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/asympta-completion-coordinator.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/asympta-workflow-lifecycle.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/asympta-three-world-effects.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/asympta-three-world-effects.css", import.meta.url), "utf8"),
    readFile(new URL("../components/asympta-task-celebration.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/asympta-completion-celebration.css", import.meta.url), "utf8"),
    readFile(new URL("../lib/asympta-marketplace-workflow.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /AsymptaCompletionCoordinator/);
  assert.match(page, /AsymptaThreeWorldEffects/);
  assert.match(page, /AsymptaTaskCelebration/);
  assert.match(layout, /asympta-three-world-effects\.css/);
  assert.match(coordinator, /seedAsymptaWorkflowLifecycle/);
  assert.match(coordinator, /observeAsymptaWorkflowLifecycle/);
  assert.match(coordinator, /publishAsymptaWorkflowStart/);
  assert.match(coordinator, /bindWorkflowReceiptToRun/);
  assert.match(lifecycle, /asympta\.workflow-start\.v1/);
  assert.match(lifecycle, /already-completed persisted job cannot replay|completed run found during hydration/i);
  assert.match(threeEffects, /import\("three"\)/);
  assert.match(threeEffects, /subscribeAsymptaWorkflowStarts/);
  assert.match(threeEffects, /subscribeAsymptaCompletionReceipts/);
  assert.match(threeEffects, /FRAME_INTERVAL_MS/);
  assert.match(threeEffects, /powerPreference:\s*"low-power"/);
  assert.match(threeEffects, /allowsVisualEnhancement/);
  assert.match(threeEffects, /asympta-workflow-start-celebration/);
  assert.match(effectsCss, /pointer-events:\s*none/);
  assert.match(effectsCss, /prefers-reduced-motion/);
  assert.match(effectsCss, /asympta-workflow-start-card/);
  assert.match(celebration, /subscribeAsymptaCompletionReceipts/);
  assert.match(celebration, /subscribeAsymptaWorkflowStarts/);
  assert.match(celebration, /const queue: AsymptaCompletionReceipt\[\] = \[\]/);
  assert.match(celebration, /dismissCompletionPresentation/);
  assert.match(celebration, /queue\.length = 0/);
  assert.match(celebration, /removeAllScreenCelebrations/);
  assert.match(celebration, /asympta-screen-celebration__content/);
  assert.match(celebration, /data.*completionId|dataset\.completionId/);
  assert.match(threeEffects, /completionPulseAtRef\.current = Number\.NEGATIVE_INFINITY/);
  assert.match(threeEffects, /startPulseAtRef\.current = Number\.NEGATIVE_INFINITY/);
  assert.match(completionCss, /width:\s*min\(620px/);
  assert.match(completionCss, /asympta-completion-content/);
  assert.match(completionCss, /prefers-reduced-motion/);
  assert.match(workflow, /assertAsymptaWorkflowContract/);
});
