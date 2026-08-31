import assert from "node:assert/strict";
import test from "node:test";

import {
  prepareUniversalMcpArguments,
  runUniversalTask,
} from "../lib/asympta-universal-task-protocol.ts";

const profile = {
  id: "benchmark-person",
  locale: "zh-Hant",
  timezone: "Asia/Hong_Kong",
  homeLocation: "saved-home-token",
  currentLocation: "current-location-token",
  contactToken: "contact-token",
  identityToken: "identity-token",
  paymentToken: "payment-token",
  accountToken: "account-token",
  documentToken: "document-token",
  evidenceToken: "evidence-token",
  budgetPolicy: "compare_first",
  brandPreference: "no_preference",
  sizePreference: "agent_choice",
  fulfilmentPreference: "delivery",
  preferences: { amount: 500 },
  authorizations: { simulatedWrites: true },
};

test("benchmark task resolves missing requirements and reaches a verified terminal state", () => {
  const result = runUniversalTask({
    id: "tv-1",
    domain: "electronics",
    actionFamily: "purchase",
    intent: "幫我買一台電視機",
    locale: "zh-Hant",
    requiredFields: ["budget", "screen size", "brand preference", "delivery location"],
    profile,
    mode: "benchmark",
    preauthorized: true,
  });
  assert.equal(result.status, "completed");
  assert.equal(result.humanInterventions, 0);
  assert.equal(result.requirements.every((field) => field.value !== undefined), true);
  assert.equal(result.packets.every((entry, index) => entry.sequence === index + 1), true);
  assert.equal(result.result?.simulated, true);
});

test("unseen fields use capability discovery instead of requiring new UI code", () => {
  const result = runUniversalTask({
    domain: "unknown-neighbourhood-service",
    actionFamily: "coordinate",
    intent: "Arrange a new neighbourhood locker exchange",
    requiredFields: ["locker compatibility protocol", "handoff ritual"],
    profile,
    mode: "benchmark",
    preauthorized: true,
  });
  assert.equal(result.status, "completed");
  assert.equal(result.humanInterventions, 0);
  assert.ok(result.requirements.every((field) => ["world", "simulation", "policy", "profile"].includes(field.resolution)));
  assert.equal(result.requirements[0].semantic, "generic", "compatibility must not be misread as city/location");
});

test("live high-risk writes keep the human approval boundary", () => {
  const result = runUniversalTask({
    domain: "finance",
    actionFamily: "transfer",
    intent: "Transfer money to a new recipient",
    risk: "high",
    requiredFields: ["recipient", "amount", "currency", "approval"],
    facts: { recipient: "recipient-token", amount: 500, currency: "HKD" },
    profile,
    mode: "live",
    preauthorized: false,
  });
  assert.equal(result.status, "needs_human");
  assert.equal(result.stuckReason, "approval_required");
  assert.equal(result.humanInterventions, 1);
  assert.equal(result.packets.some((packet) => packet.kind === "execution"), false);
});

test("MCP argument preparation resolves safe schema fields but not live payment data", () => {
  const search = prepareUniversalMcpArguments("find dinner", {
    name: "search",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        locale: { type: "string" },
        timezone: { type: "string" },
      },
      required: ["query", "locale", "timezone"],
    },
  }, { mode: "live", profile });
  assert.deepEqual(search.arguments, {
    query: "find dinner",
    locale: "zh-Hant",
    timezone: "Asia/Hong_Kong",
  });
  assert.deepEqual(search.missing, []);

  const payment = prepareUniversalMcpArguments("pay for dinner", {
    name: "pay",
    inputSchema: {
      type: "object",
      properties: {
        amount: { type: "number" },
        currency: { type: "string" },
      },
      required: ["amount", "currency"],
    },
  }, { mode: "live" });
  assert.deepEqual(payment.arguments, { currency: "HKD" });
  assert.deepEqual(payment.missing, ["amount"]);
});
