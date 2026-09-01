import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildMarketplaceWorkflow,
  compileAsymptaContext,
  createMarketplaceExecution,
  isMarketplaceProfileComplete,
  marketplaceInventoryInvariant,
  marketplaceProfilePreset,
  marketplaceTaskIds,
  normalizeMarketplaceProfile,
  syncMarketplaceExecution,
} from "../lib/asympta-marketplace-intent.ts";
import {
  readAsymptaMarketplaceProfile,
  readAsymptaUserPreferences,
  writeAsymptaMarketplaceProfile,
} from "../lib/asympta-user-preferences.ts";

function compileWithProfile(intent, profile, requestId = "request-profile") {
  const result = compileAsymptaContext(intent, {
    requestId,
    conversationId: "conversation-profile",
    locale: "en",
    now: 0,
    profile,
  });
  assert.equal(result.supported, true, result.issues.join(" "));
  assert.ok(result.envelope);
  return result;
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

function fakeStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear(),
  };
}

test("marketplace presets are complete safe preference aliases", () => {
  const profile = marketplaceProfilePreset("local_delivery", 0);
  assert.equal(profile.schemaVersion, "asympta.marketplace-profile.v1");
  assert.equal(profile.presetId, "local_delivery");
  assert.equal(profile.foodPreference, "local_cantonese");
  assert.equal(profile.fulfilmentMethod, "courier_delivery");
  assert.equal(profile.paymentMethod, "card_on_file");
  assert.equal(isMarketplaceProfileComplete(profile), true);
  assert.deepEqual(normalizeMarketplaceProfile({
    ...profile,
    cardNumber: "must-not-survive",
    address: "must-not-survive",
  }), profile);
});

test("a vague food request pauses for profile choices when no profile or explicit choices exist", () => {
  const result = compileWithProfile("Buy some food", null, "request-needs-profile");
  assert.deepEqual(
    new Set(result.profileRequirements.missing),
    new Set(["foodPreference", "fulfilmentMethod", "paymentMethod"]),
  );
  assert.ok(result.envelope.goals[0].unknownFields.includes("food_preference"));
  assert.ok(result.envelope.goals[0].unknownFields.includes("fulfilment_mode"));
  assert.ok(result.envelope.goals[0].unknownFields.includes("payment_method"));
});

test("approved profile fills missing context with provenance instead of pretending the user said it", () => {
  const profile = marketplaceProfilePreset("local_delivery", 0);
  const result = compileWithProfile("Buy some food", profile, "request-profile-context");
  assert.deepEqual(result.profileRequirements.missing, []);
  const goal = result.envelope.goals[0];
  const item = goal.facts.find((fact) => fact.key === "requested_item");
  const food = goal.facts.find((fact) => fact.key === "food_preference");
  const fulfilment = goal.facts.find((fact) => fact.key === "fulfilment_mode");
  const payment = goal.facts.find((fact) => fact.key === "payment_method");

  assert.equal(item.value, "Cantonese comfort meal");
  for (const fact of [item, food, fulfilment, payment]) {
    assert.equal(fact.status, "profile");
    assert.equal(fact.source.type, "approved_user_profile");
    assert.match(fact.source.ref, /^approved-profile:local_delivery:/);
    assert.equal(fact.source.evidence, undefined);
  }
  assert.match(result.envelope.provenance.profileRef, /^approved-profile:local_delivery:/);
});

test("explicit natural-language choices override a conflicting saved profile", () => {
  const profile = marketplaceProfilePreset("local_delivery", 0);
  const result = compileWithProfile(
    "Buy sushi, let my personal agent pick it up, and use pay on delivery",
    profile,
    "request-explicit-overrides",
  );
  assert.deepEqual(result.profileRequirements.missing, []);
  const goal = result.envelope.goals[0];
  const item = goal.facts.find((fact) => fact.key === "requested_item");
  const food = goal.facts.find((fact) => fact.key === "food_preference");
  const fulfilment = goal.facts.find((fact) => fact.key === "fulfilment_mode");
  const payment = goal.facts.find((fact) => fact.key === "payment_method");

  assert.equal(item.value, "sushi");
  assert.equal(food.value, "japanese");
  assert.equal(fulfilment.value, "personal_agent_pickup");
  assert.equal(payment.value, "pay_on_delivery");
  for (const fact of [item, food, fulfilment, payment]) {
    assert.equal(fact.status, "explicit");
    assert.equal(fact.source.type, "user_message");
  }
});

test("clothing requests ask only for fulfilment and payment when profile is absent", () => {
  const result = compileWithProfile("Buy a new shirt", null, "request-clothing-profile");
  assert.deepEqual(
    new Set(result.profileRequirements.missing),
    new Set(["fulfilmentMethod", "paymentMethod"]),
  );
  assert.equal(result.profileRequirements.missing.includes("foodPreference"), false);
});

test("courier profile routes collection, return and delivery through the logistics agent", () => {
  const profile = marketplaceProfilePreset("local_delivery", 0);
  const { envelope } = compileWithProfile("Buy some food", profile, "request-courier-route");
  const workflow = buildMarketplaceWorkflow(envelope);
  const ids = marketplaceTaskIds(envelope.goals[0], 0);
  const travel = workflow.tasks.find((task) => task.id === ids.travel);
  const payment = workflow.tasks.find((task) => task.id === ids.payment);
  const handoff = workflow.tasks.find((task) => task.id === ids.handoff);
  const returning = workflow.tasks.find((task) => task.id === ids.returning);
  const deliver = workflow.tasks.find((task) => task.id === ids.deliver);

  assert.equal(travel.agentId, "agent-logistics");
  assert.deepEqual(travel.dependsOn, [ids.payment]);
  assert.equal(payment.requiresApproval, true);
  assert.match(payment.title, /card_on_file/);
  assert.equal(handoff.agentId, "agent-logistics");
  assert.deepEqual(handoff.dependsOn, [ids.travel]);
  assert.equal(returning.agentId, "agent-logistics");
  assert.equal(deliver.agentId, "agent-logistics");
});

test("courier delivery conserves stock through logistics cargo without claiming personal-agent cargo", () => {
  const profile = marketplaceProfilePreset("local_delivery", 0);
  const { envelope } = compileWithProfile("Buy some food", profile, "request-courier-ledger");
  const goal = envelope.goals[0];
  const ids = marketplaceTaskIds(goal, 0);
  let execution = createMarketplaceExecution(envelope);
  const initial = execution.ledger[0].initialMarketStock;

  execution = syncMarketplaceExecution(execution, snapshot({
    "mp-context": "done",
    [ids.store]: "done",
    [ids.stock]: "done",
    [ids.offer]: "done",
    [ids.quality]: "done",
    [ids.payment]: "done",
    [ids.travel]: "done",
    [ids.handoff]: "done",
    [ids.returning]: "moving",
  }));

  assert.equal(execution.ledger[0].carrierAgentId, "agent-logistics");
  assert.equal(execution.ledger[0].carrierCargo, 1);
  assert.equal(execution.ledger[0].carriedByPersonalAgent, 0);
  assert.equal(execution.transactions[0].fulfilmentMethod, "courier_delivery");
  assert.equal(execution.transactions[0].paymentMethod, "card_on_file");
  assert.ok(execution.packets.some((packet) => packet.kind === "goods_handoff" && packet.to === "agent-logistics"));
  assert.deepEqual(marketplaceInventoryInvariant(execution), { valid: true, issues: [] });

  execution = syncMarketplaceExecution(execution, snapshot({
    "mp-context": "done",
    [ids.store]: "done",
    [ids.stock]: "done",
    [ids.offer]: "done",
    [ids.quality]: "done",
    [ids.payment]: "done",
    [ids.travel]: "done",
    [ids.handoff]: "done",
    [ids.returning]: "done",
    [ids.deliver]: "done",
    [ids.verify]: "done",
  }, "completed"));

  assert.equal(execution.ledger[0].carrierCargo, 0);
  assert.equal(execution.ledger[0].userInventory, 1);
  assert.ok(execution.packets.some((packet) => packet.kind === "delivery_receipt" && packet.from === "agent-logistics"));
  assert.equal(
    execution.ledger[0].marketAvailable
      + execution.ledger[0].marketReserved
      + execution.ledger[0].carrierCargo
      + execution.ledger[0].userInventory,
    initial,
  );
});

test("marketplace profile persists within the existing browser user-preference record", () => {
  const originalWindow = globalThis.window;
  const storage = fakeStorage();
  globalThis.window = {
    localStorage: storage,
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
  };

  try {
    const profile = marketplaceProfilePreset("plant_friendly", 0);
    const saved = writeAsymptaMarketplaceProfile(profile);
    assert.deepEqual(saved, profile);
    assert.deepEqual(readAsymptaMarketplaceProfile(), profile);
    assert.deepEqual(readAsymptaUserPreferences().marketplaceProfile, profile);
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

test("marketplace context stays in the collapsible top-right request card without progress forcing it closed", async () => {
  const [bridge, css, schedule, preferences] = await Promise.all([
    readFile(new URL("../components/asympta-marketplace-intent-bridge.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/asympta-marketplace-intent-bridge.module.css", import.meta.url), "utf8"),
    readFile(new URL("../components/asympta-safe-schedule.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/asympta-user-preferences.ts", import.meta.url), "utf8"),
  ]);

  assert.match(bridge, /\.atlas-safe-schedule\.asympta-request-card/);
  assert.doesNotMatch(bridge, /\.asympta-intent-shell/);
  assert.match(bridge, /asympta-marketplace-trace__toggle/);
  assert.match(bridge, /aria-expanded=\{panelExpanded\}/);
  assert.match(bridge, /MARKETPLACE_PROFILE_PRESETS/);
  assert.match(bridge, /writeAsymptaMarketplaceProfile/);
  assert.match(css, /atlas-safe-schedule\.is-collapsed \.asympta-marketplace-trace/);
  assert.match(css, /right: max\(12px, env\(safe-area-inset-right\)\)/);
  assert.match(schedule, /MARKETPLACE_PROFILE_REQUIRED_EVENT/);
  assert.match(schedule, /setExpanded\(true\)/);
  assert.match(schedule, /Workflow progress updates must preserve the user's open\/collapsed choice/);
  assert.doesNotMatch(schedule, /next\.kind === "marketplace" && next\.status === "gathering"/);
  assert.doesNotMatch(schedule, /setExpanded\(false\)/);
  assert.match(preferences, /marketplaceProfile/);
  assert.doesNotMatch(`${bridge}\n${preferences}`, /cardNumber|fullAddress|streetAddress/i);
});
