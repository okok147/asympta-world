import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMarketplaceTaskProtocol,
  buildMarketplaceWorkflow,
  compileAsymptaContext,
  marketplaceProfilePreset,
  marketplaceRuntimeSpecs,
  marketplaceSelectionConfirmationIntent,
} from "../lib/asympta-marketplace-intent.ts";

function fact(goal, key) {
  return goal.facts.find((candidate) => candidate.key === key);
}

function confirmOffer(compilation, offerId) {
  assert.ok(compilation.envelope);
  const original = compilation.envelope;
  const intent = marketplaceSelectionConfirmationIntent(original.rawMessage.text, original.goals[0], offerId);
  return compileAsymptaContext(intent, {
    requestId: original.requestId,
    conversationId: original.conversationId,
    locale: original.locale,
    now: 1,
  });
}

test("Buy a car stops at a concrete option gate before any agent workflow can start", () => {
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
  assert.equal(fact(goal, "selected_offer_id"), undefined);
  assert.ok(goal.unknownFields.includes("selected_offer_id"));
  assert.deepEqual(result.profileRequirements, {
    required: [],
    missing: [],
    resolvedFromProfile: [],
  });

  const protocol = buildMarketplaceTaskProtocol(result.envelope);
  assert.equal(protocol.readiness.status, "needs_information");
  assert.equal(protocol.readiness.nextQuestion?.field, "selected_offer_id");
  assert.match(protocol.readiness.nextQuestion?.prompt ?? "", /which car/i);
  assert.deepEqual(protocol.readiness.nextQuestion?.options.map((option) => option.label), [
    "Mercedes-Benz C 200",
    "Tesla Model 3",
    "Toyota Corolla Cross",
  ]);
  assert.throws(() => buildMarketplaceWorkflow(result.envelope));
});

test("confirming one listed car binds the concrete target and only then permits agent execution", () => {
  const initial = compileAsymptaContext("I want to buy a car", {
    requestId: "request-car-ready",
    conversationId: "conversation-car-ready",
    locale: "en",
    now: 0,
  });
  assert.equal(initial.supported, true, initial.issues.join(" "));
  assert.ok(initial.envelope);
  assert.equal(buildMarketplaceTaskProtocol(initial.envelope).readiness.status, "needs_information");

  const result = confirmOffer(initial, "vehicle:tesla-model-3");
  assert.equal(result.supported, true, result.issues.join(" "));
  assert.ok(result.envelope);
  const goal = result.envelope.goals[0];
  assert.equal(fact(goal, "selected_offer_id")?.value, "vehicle:tesla-model-3");
  assert.equal(fact(goal, "selected_offer_id")?.status, "explicit");
  assert.equal(fact(goal, "requested_item")?.value, "Tesla Model 3");
  assert.equal(fact(goal, "offer_price_hkd")?.value, 268000);
  assert.equal(fact(goal, "offer_provenance")?.value, "simulated");
  assert.equal(buildMarketplaceTaskProtocol(result.envelope).readiness.status, "ready");

  const runtime = marketplaceRuntimeSpecs(result.envelope)[0];
  assert.equal(runtime.itemLabel, "Tesla Model 3");
  assert.equal(runtime.carrierAgentId, "agent-logistics");

  const workflow = buildMarketplaceWorkflow(result.envelope);
  const titles = workflow.tasks.map((task) => task.title).join("\n");
  const details = workflow.tasks.map((task) => task.detail).join("\n");
  assert.match(details, /Tesla Model 3/);
  assert.match(titles, /Vehicle dealer agent accepts typed enquiry/);
  assert.match(titles, /Dealer inventory agent checks simulated vehicle availability/);
  assert.match(titles, /Dealer agent returns a bounded vehicle offer/);
  assert.match(titles, /Inspection agent checks vehicle offer and handoff terms/);
  assert.match(titles, /Authorise simulated vehicle purchase/);
  assert.match(titles, /Vehicle transport agent travels to the dealer/);
  assert.match(titles, /Dealer hands the vehicle to the transport agent/);
  assert.match(titles, /Vehicle transport agent delivers the vehicle to the user/);
  assert.match(titles, /Record vehicle handover to the user/);
  assert.match(titles, /Verify vehicle purchase and delivery/);
  const payment = workflow.tasks.find((task) => task.actionType === "authorize_payment");
  assert.equal(payment?.requiresApproval, true);
});

test("explicit vehicle payment wording survives selection and still keeps the later approval boundary", () => {
  const initial = compileAsymptaContext("Buy a car with pay on delivery", { now: 0 });
  assert.equal(initial.supported, true, initial.issues.join(" "));
  assert.ok(initial.envelope);
  assert.equal(buildMarketplaceTaskProtocol(initial.envelope).readiness.status, "needs_information");

  const result = confirmOffer(initial, "vehicle:mercedes-c200");
  assert.equal(result.supported, true, result.issues.join(" "));
  assert.ok(result.envelope);
  const payment = fact(result.envelope.goals[0], "payment_method");
  assert.equal(payment?.value, "pay_on_delivery");
  assert.equal(payment?.status, "explicit");

  const workflow = buildMarketplaceWorkflow(result.envelope);
  const paymentTask = workflow.tasks.find((task) => task.actionType === "authorize_payment");
  assert.match(paymentTask?.title ?? "", /Authorise simulated vehicle purchase/);
  assert.equal(paymentTask?.requiresApproval, true);
});

test("vehicle option gating generalizes across common vehicle nouns and all supported locales", () => {
  const cases = [
    ["Buy a motorcycle", "en", /which car/i],
    ["幫我買一架汽車", "zh-Hant", /哪一架車/],
    ["自動車を買いたい", "ja", /どの車/],
  ];
  for (const [intent, locale, prompt] of cases) {
    const result = compileAsymptaContext(intent, { now: 0, locale });
    assert.equal(result.supported, true, `${intent}: ${result.issues.join(" ")}`);
    assert.ok(result.envelope);
    assert.equal(fact(result.envelope.goals[0], "product_class")?.value, "vehicle");
    assert.equal(result.profileRequirements.missing.length, 0);
    const protocol = buildMarketplaceTaskProtocol(result.envelope);
    assert.equal(protocol.readiness.status, "needs_information");
    assert.equal(protocol.readiness.nextQuestion?.field, "selected_offer_id");
    assert.match(protocol.readiness.nextQuestion?.prompt ?? "", prompt);

    const confirmed = confirmOffer(result, "vehicle:toyota-corolla-cross");
    assert.equal(confirmed.supported, true, intent);
    assert.ok(confirmed.envelope);
    assert.equal(buildMarketplaceTaskProtocol(confirmed.envelope).readiness.status, "ready");
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
