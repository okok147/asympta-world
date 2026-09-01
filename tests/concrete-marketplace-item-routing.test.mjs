import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMarketplaceTaskProtocol,
  buildMarketplaceWorkflow,
  compileAsymptaContext,
  marketplaceProfilePreset,
} from "../lib/asympta-marketplace-intent.ts";

function fact(goal, key) {
  return goal.facts.find((candidate) => candidate.key === key);
}

test("Buy an apple is owned by the marketplace instead of the public-agent fallback", () => {
  const result = compileAsymptaContext("Buy an apple", {
    requestId: "request-apple",
    conversationId: "conversation-apple",
    locale: "en",
    now: 0,
  });

  assert.equal(result.supported, true, result.issues.join(" "));
  assert.ok(result.envelope);
  assert.equal(result.envelope.goals.length, 1);
  assert.equal(result.envelope.goals[0].domain, "food");
  assert.equal(fact(result.envelope.goals[0], "requested_item")?.value, "apple");
  assert.equal(fact(result.envelope.goals[0], "requested_item")?.status, "explicit");
  assert.equal(fact(result.envelope.goals[0], "quantity")?.value, 1);
  assert.equal(fact(result.envelope.goals[0], "quantity")?.status, "explicit");
  assert.deepEqual(result.profileRequirements.missing, ["fulfilmentMethod", "paymentMethod"]);

  const protocol = buildMarketplaceTaskProtocol(result.envelope);
  assert.equal(protocol.readiness.status, "needs_information");
  assert.equal(protocol.readiness.nextQuestion?.field, "fulfilment_mode");
  assert.match(protocol.readiness.nextQuestion?.prompt ?? "", /personal agent|courier/i);
});

test("a saved profile lets a concrete apple request build and execute immediately", () => {
  const profile = marketplaceProfilePreset("everyday", 0);
  const result = compileAsymptaContext("Buy two apples", {
    requestId: "request-two-apples",
    conversationId: "conversation-two-apples",
    locale: "en",
    now: 0,
    profile,
  });

  assert.equal(result.supported, true, result.issues.join(" "));
  assert.ok(result.envelope);
  assert.deepEqual(result.profileRequirements.missing, []);
  assert.equal(fact(result.envelope.goals[0], "requested_item")?.value, "apple");
  assert.equal(fact(result.envelope.goals[0], "quantity")?.value, 2);
  assert.equal(fact(result.envelope.goals[0], "fulfilment_mode")?.source.type, "approved_user_profile");
  assert.equal(fact(result.envelope.goals[0], "payment_method")?.source.type, "approved_user_profile");

  const protocol = buildMarketplaceTaskProtocol(result.envelope);
  assert.equal(protocol.readiness.status, "ready");
  assert.equal(protocol.readiness.nextQuestion, null);

  const workflow = buildMarketplaceWorkflow(result.envelope);
  assert.equal(workflow.shortName, "Marketplace");
  assert.match(workflow.summary, /Buy two apples/);
});

test("Buy me a cola starts immediately with saved defaults instead of asking for location, budget, or quantity", () => {
  const profile = marketplaceProfilePreset("everyday", 0);
  const result = compileAsymptaContext("Buy me a cola", {
    requestId: "request-cola",
    conversationId: "conversation-cola",
    locale: "en",
    now: 0,
    profile,
  });

  assert.equal(result.supported, true, result.issues.join(" "));
  assert.ok(result.envelope);
  assert.deepEqual(result.profileRequirements.missing, []);
  assert.equal(result.envelope.rawMessage.text, "Buy me a cola");
  assert.equal(fact(result.envelope.goals[0], "requested_item")?.value, "cola");
  assert.equal(fact(result.envelope.goals[0], "requested_item")?.status, "explicit");
  assert.equal(fact(result.envelope.goals[0], "quantity")?.value, 1);
  assert.equal(fact(result.envelope.goals[0], "quantity")?.status, "explicit");
  assert.equal(fact(result.envelope.goals[0], "max_budget"), undefined);
  assert.equal(result.envelope.sharedFacts.find((candidate) => candidate.key === "user_handoff_location")?.value, "personal_agent_home");

  const protocol = buildMarketplaceTaskProtocol(result.envelope);
  assert.equal(protocol.readiness.status, "ready");
  assert.equal(protocol.readiness.nextQuestion, null);

  const workflow = buildMarketplaceWorkflow(result.envelope);
  assert.equal(workflow.shortName, "Marketplace");
  assert.match(workflow.summary, /Buy me a cola/);
});

test("common grocery and convenience-store nouns are recognized across languages", () => {
  const examples = [
    ["Buy milk", "milk"],
    ["Buy me a cola", "cola"],
    ["幫我買兩個蘋果", "apple"],
    ["幫我買一罐可樂", "cola"],
    ["牛乳を買いたい", "milk"],
    ["コーラを買いたい", "cola"],
  ];

  for (const [intent, expectedItem] of examples) {
    const result = compileAsymptaContext(intent, { now: 0 });
    assert.equal(result.supported, true, `${intent}: ${result.issues.join(" ")}`);
    assert.equal(fact(result.envelope.goals[0], "requested_item")?.value, expectedItem);
  }
});

test("simple consumable fallback does not claim finance or company requests", () => {
  for (const intent of ["Buy Coca-Cola shares", "Buy Coca-Cola stock", "Research the Coca-Cola company"]) {
    const result = compileAsymptaContext(intent, { now: 0 });
    assert.equal(result.supported, false, intent);
    assert.equal(result.envelope, null);
  }
});

test("Apple technology requests are not misclassified as food", () => {
  const watch = compileAsymptaContext("Buy an Apple Watch", { now: 0 });
  assert.equal(watch.supported, true, watch.issues.join(" "));
  assert.equal(watch.envelope.goals[0].domain, "retail");
  assert.equal(fact(watch.envelope.goals[0], "requested_item")?.value, "apple watch");

  for (const intent of ["Buy Apple stock", "Buy shares of Apple"]) {
    const result = compileAsymptaContext(intent, { now: 0 });
    assert.equal(result.supported, false, intent);
    assert.equal(result.envelope, null);
  }
});

test("Buy a guitar is owned by retail and asks only for execution preferences", () => {
  const result = compileAsymptaContext("Buy a guitar", {
    requestId: "request-guitar",
    conversationId: "conversation-guitar",
    locale: "en",
    now: 0,
  });

  assert.equal(result.supported, true, result.issues.join(" "));
  assert.ok(result.envelope);
  assert.equal(result.envelope.goals.length, 1);
  assert.equal(result.envelope.goals[0].domain, "retail");
  assert.equal(fact(result.envelope.goals[0], "requested_item")?.value, "guitar");
  assert.equal(fact(result.envelope.goals[0], "requested_item")?.status, "explicit");
  assert.equal(fact(result.envelope.goals[0], "quantity")?.value, 1);
  assert.equal(fact(result.envelope.goals[0], "quantity")?.status, "explicit");
  assert.deepEqual(result.profileRequirements.missing, ["fulfilmentMethod", "paymentMethod"]);

  const protocol = buildMarketplaceTaskProtocol(result.envelope);
  assert.equal(protocol.readiness.status, "needs_information");
  assert.equal(protocol.readiness.nextQuestion?.field, "fulfilment_mode");
});

test("saved preferences make a guitar run reach merchant, supplier, approval and delivery tasks", () => {
  const profile = marketplaceProfilePreset("everyday", 0);
  const result = compileAsymptaContext("Buy a guitar", {
    requestId: "request-guitar-ready",
    conversationId: "conversation-guitar-ready",
    locale: "en",
    now: 0,
    profile,
  });

  assert.equal(result.supported, true, result.issues.join(" "));
  assert.deepEqual(result.profileRequirements.missing, []);
  const workflow = buildMarketplaceWorkflow(result.envelope);
  const titles = workflow.tasks.map((task) => task.title).join("\n");
  assert.match(workflow.name, /retail product/i);
  assert.match(titles, /Marketplace agent accepts typed enquiry/);
  assert.match(titles, /Supplier agent checks and reserves simulated stock/);
  assert.match(titles, /Store agent returns a bounded offer/);
  assert.match(titles, /Authorise simulated payment/);
  assert.match(titles, /Store hands the item/);
  assert.match(titles, /Transfer the item into user inventory/);
  assert.match(titles, /Verify delivery and close the goal/);
});

test("generic retail products preserve item and quantity evidence across languages", () => {
  for (const [intent, item, quantity] of [
    ["Buy two guitars", "guitars", 2],
    ["幫我買一把結他", "結他", 1],
    ["ギターを買いたい", "ギター", 1],
  ]) {
    const result = compileAsymptaContext(intent, { now: 0 });
    assert.equal(result.supported, true, `${intent}: ${result.issues.join(" ")}`);
    assert.equal(result.envelope.goals[0].domain, "retail");
    assert.equal(fact(result.envelope.goals[0], "requested_item")?.value, item);
    assert.equal(fact(result.envelope.goals[0], "quantity")?.value, quantity);
  }
});

test("generic retail fallback rejects financial, service and high-authority purchases", () => {
  for (const intent of [
    "Buy guitar company shares",
    "Buy a software subscription",
    "Buy a plane ticket",
    "Buy a house",
    "Buy a gun",
    "幫我買一把槍",
  ]) {
    const result = compileAsymptaContext(intent, { now: 0 });
    assert.equal(result.supported, false, intent);
    assert.equal(result.envelope, null);
  }
});
