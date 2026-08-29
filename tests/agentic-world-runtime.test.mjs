import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceAgenticWorldRuntime,
  createAgenticWorldRuntime,
  createRuntimeIntent,
  executeRuntimeIntent,
  observeRuntime,
  prepareRuntimeForWorkflow,
  restoreRuntime,
  runtimeInvariantViolations,
  serializeRuntime,
} from "../lib/agentic-world-runtime.ts";

function prepared(workflowId = "custom-order", seed = 42, now = 1_000) {
  return prepareRuntimeForWorkflow(createAgenticWorldRuntime(seed, now), workflowId, now);
}

function apply(world, actorId, action, partial = {}) {
  const intent = createRuntimeIntent(world, actorId, action, partial);
  return executeRuntimeIntent(world, intent);
}

test("private supply disruption is not globally visible", () => {
  const world = advanceAgenticWorldRuntime(prepared(), 12_000);
  const customer = observeRuntime(world, "agent-customer");
  const supplier = observeRuntime(world, "agent-supplier");
  assert.equal(customer.information.some((item) => item.subject === "supplier-capacity"), false);
  assert.equal(supplier.information.some((item) => item.subject === "supplier-capacity"), true);
});

test("reservation adapts to a feasible supplier and conserves finite inventory", () => {
  let world = advanceAgenticWorldRuntime(prepared(), 12_000);
  const order = world.orders.at(-1);
  assert.ok(order);
  const first = apply(world, "agent-supplier", "reserve_capacity", {
    targetId: "supplier-primary",
    resourceId: order.resourceId,
    quantity: order.quantity,
  });
  world = first.world;
  assert.equal(first.result.ok, true);
  assert.equal(first.result.selectedTargetId, "supplier-alternate");
  assert.equal(first.result.adaptedFrom, "supplier-primary");
  assert.equal(world.metrics.alternativePlansTriggered, 1);

  const competing = apply(world, "agent-supplier", "reserve_capacity", {
    targetId: "supplier-alternate",
    resourceId: order.resourceId,
    quantity: 20,
  });
  assert.equal(competing.result.ok, false);
  assert.match(competing.result.validation.reason, /inventory|capacity/i);
  assert.deepEqual(runtimeInvariantViolations(competing.world), []);
});

test("payment, shipment and delivery mutate one conserved canonical ledger", () => {
  let world = advanceAgenticWorldRuntime(prepared(), 12_000);
  const order = world.orders.at(-1);
  assert.ok(order);
  const buyerBefore = world.accounts.find((item) => item.ownerId === order.buyerId)?.balance;
  const sellerBefore = world.accounts.find((item) => item.ownerId === order.sellerId)?.balance;
  assert.ok(Number.isFinite(buyerBefore));
  assert.ok(Number.isFinite(sellerBefore));

  let result = apply(world, "agent-supplier", "reserve_capacity", {
    targetId: "supplier-primary",
    resourceId: order.resourceId,
    quantity: order.quantity,
  });
  assert.equal(result.result.ok, true);
  world = result.world;

  const amount = order.quantity * order.unitPrice;
  result = apply(world, "agent-finance", "authorize_payment", { targetId: order.sellerId, amount });
  assert.equal(result.result.ok, true);
  world = result.world;
  assert.equal(world.accounts.find((item) => item.ownerId === order.buyerId)?.balance, buyerBefore - amount);
  assert.equal(world.accounts.find((item) => item.ownerId === order.sellerId)?.balance, sellerBefore + amount);

  result = apply(world, "agent-logistics", "release_shipment", {
    targetId: order.buyerId,
    resourceId: order.resourceId,
    quantity: order.quantity,
  });
  assert.equal(result.result.ok, true);
  world = result.world;
  assert.equal(world.orders.at(-1)?.status, "in_transit");

  world = advanceAgenticWorldRuntime(world, 4_300);
  assert.equal(world.orders.at(-1)?.status, "delivered");
  assert.equal(world.inventories.find((item) => item.ownerId === order.buyerId && item.resourceId === order.resourceId)?.onHand, order.quantity);
  assert.equal(world.metrics.completedTransactions, 1);
  assert.equal(world.metrics.completedDeliveries, 1);
  assert.deepEqual(runtimeInvariantViolations(world), []);
});

test("invalid payment leaves account balances unchanged", () => {
  let world = prepared("launch-stock");
  const order = world.orders.at(-1);
  assert.ok(order);
  const payer = world.accounts.find((item) => item.ownerId === order.buyerId);
  const payee = world.accounts.find((item) => item.ownerId === order.sellerId);
  assert.ok(payer && payee);
  payer.balance = 0;
  const before = { payer: payer.balance, payee: payee.balance };
  const result = apply(world, "agent-finance", "authorize_payment", {
    targetId: order.sellerId,
    amount: order.quantity * order.unitPrice,
  });
  world = result.world;
  assert.equal(result.result.ok, false);
  assert.match(result.result.validation.reason, /funds/i);
  assert.equal(world.accounts.find((item) => item.ownerId === order.buyerId)?.balance, before.payer);
  assert.equal(world.accounts.find((item) => item.ownerId === order.sellerId)?.balance, before.payee);
});

test("missed commitment generates a real penalty and reputation consequence", () => {
  let world = prepared();
  const buyerBefore = world.accounts.find((item) => item.ownerId === "agent-customer")?.balance ?? 0;
  const sellerBefore = world.accounts.find((item) => item.ownerId === "agent-business")?.balance ?? 0;
  world = advanceAgenticWorldRuntime(world, 96_000);
  const commitment = world.commitments[0];
  assert.equal(commitment.status, "violated");
  assert.equal(world.metrics.commitmentViolations, 1);
  assert.ok((world.accounts.find((item) => item.ownerId === "agent-customer")?.balance ?? 0) > buyerBefore);
  assert.ok((world.accounts.find((item) => item.ownerId === "agent-business")?.balance ?? 0) < sellerBefore);
  assert.ok(world.history.some((event) => event.type === "commitment_violated"));
});

test("runtime persistence round-trip keeps future events and world invariants", () => {
  const world = advanceAgenticWorldRuntime(prepared("service-recovery", 77, 4_000), 8_000);
  const restored = restoreRuntime(serializeRuntime(world));
  assert.ok(restored);
  assert.deepEqual(restored.orders, world.orders);
  assert.deepEqual(restored.eventQueue, JSON.parse(JSON.stringify(world.eventQueue)));
  assert.deepEqual(runtimeInvariantViolations(restored), []);
});
