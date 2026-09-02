import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMarketplaceTaskProtocol,
  buildMarketplaceWorkflow,
  compileAsymptaContext,
  marketplaceProfilePreset,
  marketplaceRuntimeSpecs,
} from "../lib/asympta-marketplace-intent.ts";

function fact(goal, key) {
  return goal.facts.find((candidate) => candidate.key === key);
}

test("Buy a car starts the vehicle agent workflow immediately without generic profile questions", () => {
  const result = compileAsymptaContext("Buy a car", {
    requestId: "request-car",
    conversationId: "conversation-car",
    locale: "en",
    now: 0,
  });

  assert.equal(result.supported, true, result.issues.join(" "));
  assert.ok(result.envelope);
  const goal = result.envelope.goals[0];
  assert.equal(goal.domain, "retail");
  assert.equal(fact(goal, "requested_item")?.value, "car");
  assert.equal(fact(goal, "requested_item")?.status, "explicit");
  assert.equal(fact(goal, "quantity")?.value, 1);
  assert.equal(fact(goal, "product_class")?.value, "vehicle");
  assert.equal(fact(goal, "handling_class")?.value, "vehicle_transport");
  assert.equal(fact(goal, "fulfilment_mode")?.value, "courier_delivery");
  assert.equal(fact(goal, "payment_method")?.value, "asympta_wallet");
  assert.equal(fact(goal, "payment_method")?.status, "defaulted");
  assert.deepEqual(result.profileRequirements, {
    required: [],
    missing: [],
    resolvedFromProfile: [],
  });

  const protocol = buildMarketplaceTaskProtocol(result.envelope);
  assert.equal(protocol.readiness.status, "ready");
  assert.equal(protocol.readiness.nextQuestion, null);
  assert.equal(protocol.readiness.nextProfileField, null);
  assert.deepEqual(protocol.readiness.missingProfileFields, []);
});

test("an unprofiled car purchase reaches dealer, approval, transport and verified handover", () => {
  const result = compileAsymptaContext("Buy a car", {
    requestId: "request-car-ready",
    conversationId: "conversation-car-ready",
    locale: "en",
    now: 0,
  });

  assert.equal(result.supported, true, result.issues.join(" "));
  assert.deepEqual(result.profileRequirements.missing, []);
  const runtime = marketplaceRuntimeSpecs(result.envelope)[0];
  assert.equal(runtime.carrierAgentId, "agent-logistics");

  const workflow = buildMarketplaceWorkflow(result.envelope);
  const titles = workflow.tasks.map((task) => task.title).join("\n");
  assert.match(workflow.name, /vehicle purchase/i);
  assert.match(titles, /Vehicle dealer agent accepts typed enquiry/);
  assert.match(titles, /Dealer inventory agent checks simulated vehicle availability/);
  assert.match(titles, /Inspection agent checks vehicle offer and handoff terms/);
  assert.match(titles, /Authorise simulated vehicle purchase/);
  assert.match(titles, /Vehicle transport agent travels to the dealer/);
  assert.match(titles, /Dealer hands the vehicle to the transport agent/);
  assert.match(titles, /Record vehicle handover to the user/);
  assert.match(titles, /Verify vehicle purchase and delivery/);
  const payment = workflow.tasks.find((task) => /Authorise simulated vehicle purchase/.test(task.title));
  assert.equal(payment?.requiresApproval, true);
});

test("explicit vehicle payment wording overrides the non-blocking simulated default", () => {
  const result = compileAsymptaContext("Buy a car with pay on delivery", { now: 0 });
  assert.equal(result.supported, true, result.issues.join(" "));
  const payment = fact(result.envelope.goals[0], "payment_method");
  assert.equal(payment?.value, "pay_on_delivery");
  assert.equal(payment?.status, "explicit");
});

test("vehicle purchase routing generalizes across common vehicle nouns and languages", () => {
  for (const intent of ["Buy a motorcycle", "幫我買一架汽車", "自動車を買いたい"]) {
    const result = compileAsymptaContext(intent, { now: 0 });
    assert.equal(result.supported, true, `${intent}: ${result.issues.join(" ")}`);
    assert.equal(fact(result.envelope.goals[0], "product_class")?.value, "vehicle");
    assert.equal(fact(result.envelope.goals[0], "fulfilment_mode")?.value, "courier_delivery");
    assert.equal(result.profileRequirements.missing.length, 0);
  }
});

test("vehicle-adjacent financial or service products are not mistaken for a vehicle purchase", () => {
  for (const intent of ["Buy car insurance", "Buy car parts", "Buy car stock"]) {
    const result = compileAsymptaContext(intent, { now: 0 });
    assert.equal(result.supported, false, intent);
    assert.equal(result.envelope, null);
  }
});

test("ordinary retail routing remains unchanged", () => {
  const result = compileAsymptaContext("Buy a guitar", { now: 0 });
  assert.equal(result.supported, true, result.issues.join(" "));
  assert.equal(result.envelope.goals[0].domain, "retail");
  assert.equal(fact(result.envelope.goals[0], "requested_item")?.value, "guitar");
  assert.equal(fact(result.envelope.goals[0], "product_class"), undefined);
  assert.deepEqual(result.profileRequirements.missing, ["fulfilmentMethod", "paymentMethod"]);
});

test("saved marketplace preferences still work for ordinary retail", () => {
  const result = compileAsymptaContext("Buy a guitar", { now: 0, profile: marketplaceProfilePreset("everyday", 0) });
  assert.equal(result.supported, true, result.issues.join(" "));
  assert.deepEqual(result.profileRequirements.missing, []);
});
