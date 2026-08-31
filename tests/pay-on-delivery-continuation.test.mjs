import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  atlasSnapshot,
  advanceAtlasWorld,
  createAtlasWorld,
} from "../lib/atlas-simulation.ts";
import {
  resolveAtlasDemoApproval,
  startAtlasDemoWorkflow,
} from "../lib/atlas-demo.ts";
import {
  buildMarketplaceWorkflow,
  compileAsymptaContext,
  createMarketplaceExecution,
  marketplaceInventoryInvariant,
  marketplaceProfilePreset,
  marketplaceTaskIds,
  syncMarketplaceExecution,
  upsertMarketplaceWorkflow,
} from "../lib/asympta-marketplace-intent.ts";

function courierCodProfile() {
  return {
    ...marketplaceProfilePreset("everyday", 0),
    fulfilmentMethod: "courier_delivery",
    paymentMethod: "pay_on_delivery",
  };
}

function compileCourierCod(requestId = "courier-cod-regression") {
  const compilation = compileAsymptaContext("Buy food", {
    requestId,
    conversationId: requestId,
    locale: "en",
    now: 0,
    profile: courierCodProfile(),
  });
  assert.equal(compilation.supported, true, compilation.issues.join(" "));
  assert.ok(compilation.envelope);
  return compilation.envelope;
}

test("courier pay-on-delivery defers payment until the courier reaches the user", () => {
  const envelope = compileCourierCod();
  const workflow = buildMarketplaceWorkflow(envelope);
  const ids = marketplaceTaskIds(envelope.goals[0], 0);
  const travel = workflow.tasks.find((task) => task.id === ids.travel);
  const quality = workflow.tasks.find((task) => task.id === ids.quality);
  const payment = workflow.tasks.find((task) => task.id === ids.payment);
  const handoff = workflow.tasks.find((task) => task.id === ids.handoff);
  const returning = workflow.tasks.find((task) => task.id === ids.returning);
  const deliver = workflow.tasks.find((task) => task.id === ids.deliver);

  assert.ok(travel && quality && payment && handoff && returning && deliver);
  assert.deepEqual(travel.dependsOn, [quality.id]);
  assert.deepEqual(handoff.dependsOn, [travel.id]);
  assert.deepEqual(returning.dependsOn, [handoff.id]);
  assert.deepEqual(payment.dependsOn, [returning.id]);
  assert.deepEqual(deliver.dependsOn, [payment.id]);
  assert.equal(payment.locationId, "shibuya");
  assert.equal(payment.requiresApproval, true);
  assert.match(payment.title, /pay-on-delivery/i);
  assert.match(payment.approvalLabel ?? "", /pay-on-delivery/i);
});

test("Buy food with courier pay-on-delivery reaches handoff and return before payment approval, then completes", () => {
  const envelope = compileCourierCod("courier-cod-end-to-end");
  upsertMarketplaceWorkflow(envelope);
  const ids = marketplaceTaskIds(envelope.goals[0], 0);
  let world = startAtlasDemoWorkflow(createAtlasWorld(0), "marketplace-intent");
  let execution = createMarketplaceExecution(envelope);
  let paymentApproval = null;

  for (let index = 0; index < 12_000; index += 1) {
    world = advanceAtlasWorld(world, 120);
    execution = syncMarketplaceExecution(execution, atlasSnapshot(world));
    const pending = world.approvals.find((approval) => approval.taskId === ids.payment && approval.status === "pending");
    if (pending) {
      paymentApproval = pending;
      break;
    }
  }

  assert.ok(paymentApproval, "pay-on-delivery never reached its final payment checkpoint");
  assert.equal(world.phase, "waiting_approval");
  assert.equal(world.tasks.find((task) => task.id === ids.handoff)?.status, "done");
  assert.equal(world.tasks.find((task) => task.id === ids.returning)?.status, "done");
  assert.equal(world.tasks.find((task) => task.id === ids.deliver)?.status, "queued");
  assert.equal(world.tasks.find((task) => task.id === ids.payment)?.status, "waiting_approval");
  assert.equal(execution.transactions[0].payment, "awaiting_approval");
  assert.equal(execution.ledger[0].carrierCargo, 1);
  assert.ok(execution.packets.some((packet) => packet.kind === "goods_handoff"));
  assert.ok(execution.packets.some((packet) => packet.kind === "approval_request"));

  world = resolveAtlasDemoApproval(world, paymentApproval.id, true);
  execution = syncMarketplaceExecution(execution, atlasSnapshot(world));

  for (let index = 0; index < 12_000 && world.phase !== "completed"; index += 1) {
    world = advanceAtlasWorld(world, 120);
    execution = syncMarketplaceExecution(execution, atlasSnapshot(world));
  }

  assert.equal(world.phase, "completed");
  assert.equal(world.tasks.find((task) => task.id === ids.payment)?.status, "done");
  assert.equal(world.tasks.find((task) => task.id === ids.deliver)?.status, "done");
  assert.equal(world.tasks.find((task) => task.id === ids.verify)?.status, "done");
  assert.equal(execution.status, "completed");
  assert.equal(execution.transactions[0].payment, "authorized");
  assert.equal(execution.ledger[0].carrierCargo, 0);
  assert.equal(execution.ledger[0].userInventory, 1);
  assert.ok(execution.packets.some((packet) => packet.kind === "payment_authorized"));
  assert.ok(execution.packets.some((packet) => packet.kind === "delivery_receipt"));
});

test("declining COD before the marketplace projection observes handoff never creates negative inventory", () => {
  const envelope = compileCourierCod("courier-cod-fast-decline");
  upsertMarketplaceWorkflow(envelope);
  const ids = marketplaceTaskIds(envelope.goals[0], 0);
  let world = startAtlasDemoWorkflow(createAtlasWorld(0), "marketplace-intent");
  let paymentApproval = null;

  // Intentionally do not sync the marketplace projection while the courier is
  // moving. This reproduces the browser race where the approval card polls a
  // little faster than the marketplace ledger projection.
  for (let index = 0; index < 12_000; index += 1) {
    world = advanceAtlasWorld(world, 120);
    const pending = world.approvals.find((approval) => approval.taskId === ids.payment && approval.status === "pending");
    if (pending) {
      paymentApproval = pending;
      break;
    }
  }

  assert.ok(paymentApproval, "pay-on-delivery never reached approval");
  assert.equal(world.tasks.find((task) => task.id === ids.handoff)?.status, "done");
  assert.equal(world.tasks.find((task) => task.id === ids.returning)?.status, "done");

  world = resolveAtlasDemoApproval(world, paymentApproval.id, false);
  const execution = syncMarketplaceExecution(createMarketplaceExecution(envelope), atlasSnapshot(world));
  const line = execution.ledger[0];
  const invariant = marketplaceInventoryInvariant(execution);

  assert.equal(world.phase, "blocked");
  assert.equal(execution.status, "blocked");
  assert.equal(execution.transactions[0].payment, "declined");
  assert.equal(execution.transactions[0].status, "blocked");
  assert.equal(line.marketReserved, 0);
  assert.equal(line.carrierCargo, 1);
  assert.equal(line.userInventory, 0);
  assert.equal(line.marketAvailable + line.marketReserved + line.carrierCargo + line.userInventory, line.initialMarketStock);
  assert.equal(invariant.valid, true, invariant.issues.join(" "));
  assert.equal(
    execution.packets.findLast((packet) => packet.kind === "blocked")?.payload.inventoryReleased,
    false,
  );
});

test("changing the marketplace profile recovers a blocked attempt instead of leaving the card dead", async () => {
  const [recovery, page] = await Promise.all([
    readFile(new URL("../components/asympta-marketplace-recovery.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(page, /AsymptaMarketplaceRecovery/);
  assert.match(recovery, /subscribeAsymptaUserPreferences/);
  assert.match(recovery, /current\.status !== "blocked"/);
  assert.match(recovery, /current\.envelope\.rawMessage\.text/);
  assert.match(recovery, /marketplace\.runIntent\(intent\)/);
  assert.doesNotMatch(recovery, /approved:\s*true|resolveAtlasApproval|automatic.*approve/i);
});
