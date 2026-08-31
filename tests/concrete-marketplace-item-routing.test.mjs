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

test("common grocery nouns are recognized in English, Traditional Chinese and Japanese", () => {
  const examples = [
    ["Buy milk", "milk"],
    ["幫我買兩個蘋果", "apple"],
    ["牛乳を買いたい", "milk"],
  ];

  for (const [intent, expectedItem] of examples) {
    const result = compileAsymptaContext(intent, { now: 0 });
    assert.equal(result.supported, true, `${intent}: ${result.issues.join(" ")}`);
    assert.equal(fact(result.envelope.goals[0], "requested_item")?.value, expectedItem);
  }
});

test("Apple technology requests are not misclassified as food", () => {
  for (const intent of ["Buy an Apple Watch", "Buy Apple stock", "Buy shares of Apple"]) {
    const result = compileAsymptaContext(intent, { now: 0 });
    assert.equal(result.supported, false, intent);
    assert.equal(result.envelope, null);
  }
});
