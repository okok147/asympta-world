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

test("the manual payment boundary runs before the legacy router auto-approval listener", async () => {
  const [page, boundary, router, approval] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/asympta-marketplace-manual-payment-boundary.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/asympta-marketplace-intent-router.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/asympta-marketplace-payment-approval.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(page, /AsymptaMarketplaceManualPaymentBoundary/);
  assert.ok(page.indexOf("<AsymptaMarketplaceManualPaymentBoundary") < page.indexOf("<AsymptaMarketplaceIntentRouter"));
  assert.match(boundary, /addEventListener\(MARKETPLACE_EXECUTION_EVENT, onExecution, true\)/);
  assert.match(boundary, /Marketplace payment requires explicit user confirmation/);
  assert.match(boundary, /queueMicrotask/);
  assert.match(router, /autoApproveSimulatedMarketplacePayment/);
  assert.match(approval, /onClick=\{\(\) => resolve\(true\)\}/);
  assert.match(approval, /onClick=\{\(\) => resolve\(false\)\}/);
});
