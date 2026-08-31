import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildMarketplaceWorkflow,
  compileAsymptaContext,
  createMarketplaceExecution,
  marketplaceInventoryInvariant,
  marketplaceTaskIds,
  syncMarketplaceExecution,
  validateContextEnvelope,
} from "../lib/asympta-marketplace-intent.ts";

function compile(intent, requestId = "request-test") {
  const result = compileAsymptaContext(intent, {
    requestId,
    conversationId: "conversation-test",
    locale: "en",
    now: 0,
  });
  assert.equal(result.supported, true, result.issues.join(" "));
  assert.ok(result.envelope);
  return result.envelope;
}

function snapshot(states, phase = "running") {
  return {
    phase,
    tasks: Object.entries(states).map(([id, status]) => ({ id, status, progress: status === "done" ? 1 : 0.5 })),
    pendingApprovals: Object.entries(states)
      .filter(([, status]) => status === "waiting_approval")
      .map(([taskId], index) => ({ id: `approval-${index + 1}`, taskId, actionType: "authorize_payment" })),
  };
}

test("vague food language compiles into evidence-backed context without inventing budget or dietary facts", () => {
  const envelope = compile("I want to buy some food");
  assert.equal(envelope.schemaVersion, "asympta.context.v1");
  assert.equal(envelope.goals.length, 1);
  const [goal] = envelope.goals;
  assert.equal(goal.domain, "food");
  assert.equal(goal.desiredOutcome, "deliver_to_user");

  const domain = goal.facts.find((fact) => fact.key === "domain");
  const item = goal.facts.find((fact) => fact.key === "requested_item");
  assert.equal(domain.status, "explicit");
  assert.match(domain.source.evidence, /food/i);
  assert.equal(item.status, "defaulted");
  assert.equal(item.source.type, "system_default");
  assert.equal(goal.facts.some((fact) => fact.key === "max_budget"), false);
  assert.ok(goal.unknownFields.includes("max_budget"));
  assert.ok(goal.unknownFields.includes("dietary_constraints"));
  assert.equal(envelope.permissions.consequentialActionsRequireApproval, true);
  assert.ok(envelope.permissions.prohibited.includes("place_real_order"));
  assert.deepEqual(validateContextEnvelope(envelope), { valid: true, issues: [] });
});

test("compiler handles Cantonese and separates food from clothing goals", () => {
  const envelope = compile("幫我買一啲嘢食，同埋一件新衫", "request-multi");
  assert.deepEqual(envelope.goals.map((goal) => goal.domain), ["food", "clothing"]);
  assert.equal(envelope.goals[1].facts.find((fact) => fact.key === "quantity")?.value, 1);

  const workflow = buildMarketplaceWorkflow(envelope);
  assert.equal(workflow.shortName, "Marketplace");
  assert.ok(workflow.tasks.length >= 21);
  const foodIds = marketplaceTaskIds(envelope.goals[0], 0);
  const clothingIds = marketplaceTaskIds(envelope.goals[1], 1);
  const foodReturn = workflow.tasks.find((task) => task.id === foodIds.returning);
  const clothingTravel = workflow.tasks.find((task) => task.id === clothingIds.travel);
  assert.equal(foodReturn.locationId, "shibuya");
  assert.deepEqual(clothingTravel.dependsOn, [foodIds.verify]);
});

test("marketplace workflow makes the personal agent enter a market, pause for approval, collect goods and return home", () => {
  const envelope = compile("Buy one meal", "request-route");
  const workflow = buildMarketplaceWorkflow(envelope);
  const ids = marketplaceTaskIds(envelope.goals[0], 0);

  const travel = workflow.tasks.find((task) => task.id === ids.travel);
  const payment = workflow.tasks.find((task) => task.id === ids.payment);
  const handoff = workflow.tasks.find((task) => task.id === ids.handoff);
  const returning = workflow.tasks.find((task) => task.id === ids.returning);
  const deliver = workflow.tasks.find((task) => task.id === ids.deliver);

  assert.equal(travel.agentId, "agent-user");
  assert.notEqual(travel.locationId, "shibuya");
  assert.equal(payment.requiresApproval, true);
  assert.equal(payment.actionType, "authorize_payment");
  assert.equal(handoff.agentId, "agent-user");
  assert.equal(handoff.locationId, travel.locationId);
  assert.equal(returning.agentId, "agent-user");
  assert.equal(returning.locationId, "shibuya");
  assert.equal(deliver.locationId, "shibuya");
});

test("structured execution conserves inventory from market reservation through cargo and user delivery", () => {
  const envelope = compile("I want to buy some food", "request-ledger");
  const goal = envelope.goals[0];
  const ids = marketplaceTaskIds(goal, 0);
  let execution = createMarketplaceExecution(envelope);
  const initial = execution.ledger[0].initialMarketStock;

  execution = syncMarketplaceExecution(execution, snapshot({
    "mp-context": "done",
    [ids.travel]: "done",
    [ids.store]: "done",
    [ids.stock]: "done",
  }));
  assert.equal(execution.ledger[0].marketAvailable, initial - 1);
  assert.equal(execution.ledger[0].marketReserved, 1);
  assert.equal(execution.transactions[0].status, "stock_reserved");
  assert.ok(execution.packets.some((packet) => packet.kind === "availability"));

  execution = syncMarketplaceExecution(execution, snapshot({
    "mp-context": "done",
    [ids.travel]: "done",
    [ids.store]: "done",
    [ids.stock]: "done",
    [ids.offer]: "done",
    [ids.quality]: "done",
    [ids.payment]: "waiting_approval",
  }, "waiting_approval"));
  assert.equal(execution.status, "awaiting_approval");
  assert.equal(execution.transactions[0].payment, "awaiting_approval");
  assert.ok(execution.packets.some((packet) => packet.kind === "approval_request"));

  execution = syncMarketplaceExecution(execution, snapshot({
    "mp-context": "done",
    [ids.travel]: "done",
    [ids.store]: "done",
    [ids.stock]: "done",
    [ids.offer]: "done",
    [ids.quality]: "done",
    [ids.payment]: "done",
    [ids.handoff]: "done",
    [ids.returning]: "moving",
  }));
  assert.equal(execution.ledger[0].marketReserved, 0);
  assert.equal(execution.ledger[0].carriedByPersonalAgent, 1);
  assert.equal(execution.status, "returning_to_user");
  assert.ok(execution.packets.some((packet) => packet.kind === "goods_handoff"));

  execution = syncMarketplaceExecution(execution, snapshot({
    "mp-context": "done",
    [ids.travel]: "done",
    [ids.store]: "done",
    [ids.stock]: "done",
    [ids.offer]: "done",
    [ids.quality]: "done",
    [ids.payment]: "done",
    [ids.handoff]: "done",
    [ids.returning]: "done",
    [ids.deliver]: "done",
    [ids.verify]: "done",
  }, "completed"));
  assert.equal(execution.status, "completed");
  assert.equal(execution.ledger[0].carriedByPersonalAgent, 0);
  assert.equal(execution.ledger[0].userInventory, 1);
  assert.equal(execution.transactions[0].status, "completed");
  assert.ok(execution.packets.some((packet) => packet.kind === "delivery_receipt"));
  assert.deepEqual(marketplaceInventoryInvariant(execution), { valid: true, issues: [] });
  assert.equal(
    execution.ledger[0].marketAvailable
      + execution.ledger[0].marketReserved
      + execution.ledger[0].carriedByPersonalAgent
      + execution.ledger[0].userInventory,
    initial,
  );
});

test("messages that only mention a domain do not silently start a purchase", () => {
  const result = compileAsymptaContext("Tell me about food markets", { now: 0 });
  assert.equal(result.supported, false);
  assert.equal(result.envelope, null);
  assert.match(result.issues.join(" "), /does not ask to obtain/i);
});

test("website input is bridged into the canonical map workflow and exposes inspectable structured state", async () => {
  const [page, bridge, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/asympta-marketplace-intent-bridge.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/asympta-marketplace-intent-bridge.module.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /AsymptaMarketplaceIntentBridge/);
  assert.match(bridge, /subscribeAsymptaCurrentRequest/);
  assert.match(bridge, /asympta:activity/);
  assert.match(bridge, /startWorkflow\(MARKETPLACE_WORKFLOW_ID\)/);
  assert.match(bridge, /__ASYMPTA_MARKETPLACE__/);
  assert.match(bridge, /syncMarketplaceExecution/);
  assert.match(bridge, /data-asympta-marketplace/);
  assert.match(bridge, /data-provenance="simulated"/);
  assert.match(bridge, /asympta-marketplace-cargo/);
  assert.match(css, /personal_agent_cargo|asympta-marketplace-cargo/);
  assert.doesNotMatch(bridge, /setTimeout\([^)]*completed|playRecordedAnimation|fakeMarketplaceResult/i);
});
