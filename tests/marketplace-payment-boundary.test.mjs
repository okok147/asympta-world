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
  advanceAtlasWorld as advanceCanonicalWorld,
  createAtlasWorld as createCanonicalWorld,
} from "../lib/atlas-canonical-world.ts";
import {
  repairApprovedMarketplaceCheckpoint,
  resolveAtlasDemoApproval as resolveCanonicalDemoApproval,
  startAtlasDemoWorkflow as startCanonicalDemoWorkflow,
} from "../lib/atlas-canonical-demo.ts";
import {
  compileAsymptaContext,
  createMarketplaceExecution,
  marketplaceInventoryInvariant,
  marketplaceProfilePreset,
  marketplaceTaskIds,
  syncMarketplaceExecution,
  upsertMarketplaceWorkflow,
} from "../lib/asympta-marketplace-intent.ts";

function courierCodEnvelope(requestId) {
  const profile = {
    ...marketplaceProfilePreset("everyday", 0),
    fulfilmentMethod: "courier_delivery",
    paymentMethod: "pay_on_delivery",
  };
  const compilation = compileAsymptaContext("Buy food", {
    requestId,
    conversationId: requestId,
    locale: "en",
    now: 0,
    profile,
  });
  assert.equal(compilation.supported, true, compilation.issues.join(" "));
  assert.ok(compilation.envelope);
  return compilation.envelope;
}

test("an immediate explicit COD confirmation can finish even when the projection is a poll behind", () => {
  const envelope = courierCodEnvelope("cod-manual-confirm-race");
  upsertMarketplaceWorkflow(envelope);
  const ids = marketplaceTaskIds(envelope.goals[0], 0);
  let world = startAtlasDemoWorkflow(createAtlasWorld(0), "marketplace-intent");
  let paymentApproval = null;

  // Advance the canonical engine without updating MarketplaceExecution. This is
  // the browser timing window in which the payment card can see the approval a
  // little before the marketplace projection sees the completed handoff.
  for (let index = 0; index < 12_000; index += 1) {
    world = advanceAtlasWorld(world, 120);
    const pending = world.approvals.find((approval) => approval.taskId === ids.payment && approval.status === "pending");
    if (pending) {
      paymentApproval = pending;
      break;
    }
  }

  assert.ok(paymentApproval, "COD approval did not appear");
  world = resolveAtlasDemoApproval(world, paymentApproval.id, true);

  for (let index = 0; index < 12_000 && world.phase !== "completed"; index += 1) {
    world = advanceAtlasWorld(world, 120);
  }

  const execution = syncMarketplaceExecution(createMarketplaceExecution(envelope), atlasSnapshot(world));
  const invariant = marketplaceInventoryInvariant(execution);

  assert.equal(world.phase, "completed");
  assert.equal(execution.status, "completed");
  assert.equal(execution.transactions[0].payment, "authorized");
  assert.equal(execution.ledger[0].marketReserved, 0);
  assert.equal(execution.ledger[0].carrierCargo, 0);
  assert.equal(execution.ledger[0].userInventory, 1);
  assert.equal(invariant.valid, true, invariant.issues.join(" "));
});

test("accepting marketplace payment cannot be rejected by the unrelated generic fund ledger", () => {
  const envelope = courierCodEnvelope("canonical-cod-accepts-empty-generic-ledger");
  upsertMarketplaceWorkflow(envelope);
  const ids = marketplaceTaskIds(envelope.goals[0], 0);
  const emptyGenericLedger = createCanonicalWorld(0);
  emptyGenericLedger.runtime.accounts.find((account) => account.ownerId === "agent-customer").balance = 0;
  let world = startCanonicalDemoWorkflow(emptyGenericLedger, "marketplace-intent");
  let approval = null;

  for (let index = 0; index < 20_000; index += 1) {
    world = advanceCanonicalWorld(world, 120);
    approval = world.approvals.find((candidate) => candidate.taskId === ids.payment && candidate.status === "pending");
    if (approval) break;
  }

  assert.ok(approval, "canonical marketplace payment approval did not appear");
  world = resolveCanonicalDemoApproval(world, approval.id, true);
  assert.notEqual(world.phase, "blocked");
  assert.equal(world.tasks.find((task) => task.id === ids.payment)?.approvalStatus, "approved");
  assert.equal(world.tasks.find((task) => task.id === ids.payment)?.blockingReason, undefined);

  for (let index = 0; index < 20_000 && world.phase !== "completed"; index += 1) {
    world = advanceCanonicalWorld(world, 120);
  }
  assert.equal(world.phase, "completed");
});

test("a persisted marketplace checkpoint accepted by the user is repaired, while a decline is not", () => {
  const envelope = courierCodEnvelope("repair-accepted-marketplace-checkpoint");
  upsertMarketplaceWorkflow(envelope);
  const ids = marketplaceTaskIds(envelope.goals[0], 0);
  let world = startCanonicalDemoWorkflow(createCanonicalWorld(0), "marketplace-intent");
  let approval = null;

  for (let index = 0; index < 20_000; index += 1) {
    world = advanceCanonicalWorld(world, 120);
    approval = world.approvals.find((candidate) => candidate.taskId === ids.payment && candidate.status === "pending");
    if (approval) break;
  }
  assert.ok(approval);
  world = resolveCanonicalDemoApproval(world, approval.id, true);

  const staleAcceptedWorld = structuredClone(world);
  const acceptedTask = staleAcceptedWorld.tasks.find((task) => task.id === ids.payment);
  acceptedTask.status = "blocked";
  acceptedTask.blockingReason = "Blocked by funds.";
  staleAcceptedWorld.phase = "blocked";
  const repaired = repairApprovedMarketplaceCheckpoint(staleAcceptedWorld);
  assert.equal(repaired.phase, "running");
  assert.equal(repaired.tasks.find((task) => task.id === ids.payment)?.status, "working");
  assert.equal(repaired.tasks.find((task) => task.id === ids.payment)?.blockingReason, undefined);

  const declinedWorld = structuredClone(staleAcceptedWorld);
  declinedWorld.tasks.find((task) => task.id === ids.payment).approvalStatus = "declined";
  assert.equal(repairApprovedMarketplaceCheckpoint(declinedWorld).phase, "blocked");
});

test("the payment card is the only marketplace payment decision owner", async () => {
  const [page, router, approval] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/asympta-marketplace-intent-router.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/asympta-marketplace-payment-approval.tsx", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(page, /AsymptaMarketplaceManualPaymentBoundary/);
  assert.doesNotMatch(router, /autoApproveSimulatedMarketplacePayment/);
  assert.doesNotMatch(router, /__ASYMPTA_DEMO__.*approve/s);
  assert.match(approval, /pendingMarketplacePayment/);
  assert.match(approval, /\.approve\(pending\.id, approved\)/);
  assert.match(approval, /onClick=\{\(\) => resolve\(true\)\}/);
  assert.match(approval, /onClick=\{\(\) => resolve\(false\)\}/);
});
