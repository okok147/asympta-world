import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

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
});

test("the product mounts one completion coordinator and a queued prominent celebration screen", async () => {
  const [page, coordinator, celebration, css, workflow] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/asympta-completion-coordinator.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/asympta-task-celebration.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/asympta-completion-celebration.css", import.meta.url), "utf8"),
    readFile(new URL("../lib/asympta-marketplace-workflow.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /AsymptaCompletionCoordinator/);
  assert.match(page, /AsymptaTaskCelebration/);
  assert.match(coordinator, /completionReceiptFromMarketplaceExecution/);
  assert.match(coordinator, /MARKETPLACE_EXECUTION_EVENT/);
  assert.match(celebration, /subscribeAsymptaCompletionReceipts/);
  assert.match(celebration, /const queue: AsymptaCompletionReceipt\[\] = \[\]/);
  assert.match(celebration, /asympta-screen-celebration__content/);
  assert.match(celebration, /data.*completionId|dataset\.completionId/);
  assert.match(css, /width:\s*min\(620px/);
  assert.match(css, /asympta-completion-content/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(workflow, /assertAsymptaWorkflowContract/);
});
