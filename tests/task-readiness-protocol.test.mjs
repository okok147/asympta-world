import assert from "node:assert/strict";
import test from "node:test";

import {
  AsymptaNeedsInformationError,
  assertAsymptaTaskReady,
  buildAsymptaTaskPacket,
  confirmedTaskFact,
  createAsymptaTaskIntent,
  recompileAsymptaTaskIntent,
  resolveAsymptaTaskFacts,
  validateAsymptaCompletionReceipt,
} from "../lib/asympta-task-protocol.ts";
import {
  emptyAsymptaUserContextProfile,
  selectAsymptaUserContextFacts,
  upsertAsymptaUserContextFact,
  userContextProfileAsTaskFacts,
  validateAsymptaUserContextProfile,
} from "../lib/asympta-user-context-profile.ts";
import {
  buildMarketplaceAgentTaskPacket,
  buildMarketplaceTaskProtocol,
} from "../lib/asympta-marketplace-task-protocol.ts";
import {
  buildMarketplaceWorkflow,
  compileAsymptaContext,
  marketplaceProfilePreset,
} from "../lib/asympta-marketplace-intent.ts";

function fact(key, value, status, source, updatedAt = "2026-01-01T00:00:00.000Z", extra = {}) {
  return {
    key,
    value,
    status,
    source: { type: source, ref: `${source}:${key}` },
    confidence: 1,
    scope: status === "profile" ? "long_term" : "task",
    updatedAt,
    ...extra,
  };
}

function requirement(id, field, stage, priority, prompt) {
  return {
    id,
    capability: "test.execute",
    field,
    stage,
    blocking: true,
    priority,
    userEffort: 1,
    description: { en: `${field} is necessary.` },
    question: {
      prompt: { en: prompt },
      answerType: "single_choice",
      options: [
        { value: "a", label: { en: "A" } },
        { value: "b", label: { en: "B" } },
      ],
      remember: "offer",
    },
  };
}

test("context resolution obeys explicit > confirmed > tool > profile > inference > default precedence", () => {
  const resolved = resolveAsymptaTaskFacts([
    [fact("choice", "default", "defaulted", "system_default")],
    [fact("choice", "inferred", "inferred", "agent_inference")],
    [fact("choice", "profile", "profile", "approved_user_profile")],
    [fact("choice", "tool", "tool_verified", "tool_result")],
    [fact("choice", "confirmed", "confirmed", "user_confirmation")],
    [fact("choice", "explicit", "explicit", "user_message")],
  ], 0);
  assert.equal(resolved.find((candidate) => candidate.key === "choice")?.value, "explicit");
});

test("readiness always returns one next necessary question and advances after the answer", () => {
  const initial = createAsymptaTaskIntent({
    taskId: "task-next-question",
    goal: { action: "obtain", domain: "test", desiredOutcome: "done" },
    targetStage: "commitment",
    factLayers: [[]],
    requirements: [
      requirement("selection", "preference", "selection", 80, "Which preference?"),
      requirement("commitment", "payment", "commitment", 100, "Which payment?"),
    ],
    locale: "en",
    now: 0,
  });

  assert.equal(initial.readiness.status, "needs_information");
  assert.equal(initial.readiness.nextRequirementId, "selection");
  assert.equal(initial.readiness.nextQuestion?.field, "preference");
  assert.equal(initial.readiness.nextQuestion?.prompt, "Which preference?");
  assert.throws(() => assertAsymptaTaskReady(initial), (error) => (
    error instanceof AsymptaNeedsInformationError
    && error.readiness.nextQuestion?.field === "preference"
  ));

  const afterPreference = recompileAsymptaTaskIntent(initial, [confirmedTaskFact({
    key: "preference",
    value: "a",
    requestId: initial.taskId,
    now: 1,
  })], { now: 1 });
  assert.equal(afterPreference.readiness.nextRequirementId, "commitment");
  assert.equal(afterPreference.readiness.nextQuestion?.field, "payment");

  const ready = recompileAsymptaTaskIntent(afterPreference, [confirmedTaskFact({
    key: "payment",
    value: "b",
    requestId: initial.taskId,
    now: 2,
  })], { now: 2 });
  assert.equal(ready.readiness.status, "ready");
  assert.equal(ready.readiness.nextQuestion, null);
  assert.doesNotThrow(() => assertAsymptaTaskReady(ready));
});

test("task packets disclose only scoped fields and exclude sensitive profile facts by default", () => {
  const task = createAsymptaTaskIntent({
    taskId: "task-packet",
    goal: { action: "obtain", domain: "food", desiredOutcome: "delivered" },
    targetStage: "commitment",
    factLayers: [[
      fact("food_preference", "japanese", "profile", "approved_user_profile"),
      fact("payment_method", "wallet_alias", "profile", "approved_user_profile", undefined, { sensitive: true }),
      fact("unrelated_clothing_size", "M", "profile", "approved_user_profile"),
    ]],
    requirements: [],
    permissions: [{ action: "search", mode: "allowed" }],
    successCriteria: [{ id: "delivered", description: "Food is delivered." }],
    now: 0,
  });

  const packet = buildAsymptaTaskPacket(task, {
    recipient: "agent-market",
    capability: "food.search",
    fields: ["food_preference", "payment_method"],
  });
  assert.deepEqual(packet.context, { food_preference: "japanese" });
  assert.equal("payment_method" in packet.context, false);
  assert.equal("unrelated_clothing_size" in packet.context, false);
  assert.equal(packet.contextProvenance.food_preference.source, "approved_user_profile");
});

test("completion receipts cannot claim success without every required criterion and evidence", () => {
  const task = createAsymptaTaskIntent({
    taskId: "task-receipt",
    goal: { action: "obtain", domain: "food", desiredOutcome: "delivered" },
    targetStage: "verification",
    factLayers: [[]],
    requirements: [],
    successCriteria: [{
      id: "delivery",
      description: "Item enters user inventory.",
      requiredEvidence: ["delivery_receipt"],
    }],
    now: 0,
  });

  const invalid = validateAsymptaCompletionReceipt(task, {
    schemaVersion: "asympta.receipt.v1",
    taskId: task.taskId,
    status: "completed",
    effects: [],
    criteria: [{ id: "delivery", passed: true, evidence: [] }],
    verifiedBy: "agent-quality",
    provenance: "simulated",
    createdAt: new Date(0).toISOString(),
  });
  assert.equal(invalid.valid, false);
  assert.match(invalid.issues.join(" "), /required evidence/i);

  const valid = validateAsymptaCompletionReceipt(task, {
    schemaVersion: "asympta.receipt.v1",
    taskId: task.taskId,
    status: "completed",
    effects: [{ type: "inventory_transfer", data: { quantity: 1 } }],
    criteria: [{ id: "delivery", passed: true, evidence: ["delivery_receipt"] }],
    verifiedBy: "agent-quality",
    provenance: "simulated",
    createdAt: new Date(0).toISOString(),
  });
  assert.deepEqual(valid, { valid: true, issues: [] });
});

test("app-wide user context is scoped, provenance-aware and rejects raw secret fields", () => {
  let profile = emptyAsymptaUserContextProfile(0);
  profile = upsertAsymptaUserContextFact(profile, {
    domain: "food",
    key: "food_preference",
    value: "japanese",
  }, 1);
  profile = upsertAsymptaUserContextFact(profile, {
    domain: "clothing",
    key: "size",
    value: "M",
  }, 2);
  profile = upsertAsymptaUserContextFact(profile, {
    domain: "payment",
    key: "payment_method",
    value: "wallet_alias",
    sensitivity: "sensitive",
  }, 3);

  assert.throws(() => upsertAsymptaUserContextFact(profile, {
    domain: "payment",
    key: "card_number",
    value: "4111111111111111",
  }), /not allowed/i);

  const food = selectAsymptaUserContextFacts(profile, { domains: ["food"] });
  assert.deepEqual(food.map((candidate) => candidate.key), ["food_preference"]);
  const taskFacts = userContextProfileAsTaskFacts(profile, { domains: ["food", "payment"] });
  assert.deepEqual(taskFacts.map((candidate) => candidate.key), ["food_preference"]);
  assert.equal(taskFacts[0].status, "profile");
  assert.deepEqual(validateAsymptaUserContextProfile(profile), { valid: true, issues: [] });
});

test("marketplace uses the generic readiness gate and never builds an incomplete action graph", () => {
  const incomplete = compileAsymptaContext("Buy some food", {
    requestId: "request-readiness-incomplete",
    locale: "en",
    now: 0,
    profile: null,
  });
  assert.ok(incomplete.envelope);
  const pending = buildMarketplaceTaskProtocol(incomplete.envelope);
  assert.equal(pending.readiness.status, "needs_information");
  assert.equal(pending.readiness.nextProfileField, "foodPreference");
  assert.equal(pending.readiness.nextQuestion?.field, "food_preference");
  assert.deepEqual(
    new Set(pending.readiness.missingProfileFields),
    new Set(["foodPreference", "fulfilmentMethod", "paymentMethod"]),
  );
  assert.throws(() => buildMarketplaceWorkflow(incomplete.envelope), AsymptaNeedsInformationError);

  const complete = compileAsymptaContext("Buy some food", {
    requestId: "request-readiness-complete",
    locale: "en",
    now: 0,
    profile: marketplaceProfilePreset("local_delivery", 0),
  });
  assert.ok(complete.envelope);
  const ready = buildMarketplaceTaskProtocol(complete.envelope);
  assert.equal(ready.readiness.status, "ready");
  assert.doesNotThrow(() => buildMarketplaceWorkflow(complete.envelope));

  const packet = buildMarketplaceAgentTaskPacket(complete.envelope, {
    goalId: complete.envelope.goals[0].id,
    recipient: "agent-market",
    capability: "food.enquiry",
    fields: ["requested_item", "food_preference", "fulfilment_mode", "payment_method"],
  });
  assert.equal(packet.schemaVersion, "asympta.task-packet.v1");
  assert.equal(packet.context.food_preference, "local_cantonese");
  assert.equal(packet.context.fulfilment_mode, "courier_delivery");
  assert.equal(packet.context.payment_method, "card_on_file");
});
