import assert from "node:assert/strict";
import test from "node:test";

import {
  createAdaptiveInteractionSchema,
  mergeAdaptiveClarifications,
  missingFieldsFromAdaptiveActivityData,
  normalizeAdaptiveMissingFields,
} from "../lib/asympta-adaptive-interaction.ts";

test("adaptive schema turns a TV screen-size gap into immediate useful choices", () => {
  const schema = createAdaptiveInteractionSchema({
    intent: "I want to buy a television",
    missingFields: ["screen size", "budget", "brand preference"],
    locale: "en",
    interactionId: "tv-1",
    now: "2026-08-31T05:00:00.000Z",
  });

  assert.equal(schema.schemaVersion, "asympta.adaptive-ui.v1");
  assert.equal(schema.nextField?.key, "screen_size");
  assert.equal(schema.nextField?.control, "single_choice");
  assert.ok(schema.nextField?.options.some((candidate) => candidate.label === "55″"));
  assert.equal(schema.provenance.factPolicy, "unknown_until_user_confirmation");
});

test("unseen missing fields safely fall back to a generic text control instead of requiring new UI code", () => {
  const schema = createAdaptiveInteractionSchema({
    intent: "Arrange a new kind of neighbourhood service",
    missingFields: ["locker compatibility protocol"],
    locale: "zh-Hant",
    interactionId: "unknown-1",
    now: "2026-08-31T05:00:00.000Z",
  });

  assert.equal(schema.nextField?.sourceField, "locker compatibility protocol");
  assert.equal(schema.nextField?.control, "text");
  assert.equal(schema.nextField?.options.length, 0);
  assert.equal(schema.nextField?.required, true);
});

test("missing fields are split, normalized, deduplicated and keep agent order", () => {
  const normalized = normalizeAdaptiveMissingFields([
    "screen size, budget",
    "Budget",
    "purchase-location",
  ]);

  assert.deepEqual(normalized.map((candidate) => candidate.normalized), [
    "screen_size",
    "budget",
    "purchase_location",
  ]);
});

test("clarification continuation contains only user-confirmed facts and preserves the original intent", () => {
  const intention = mergeAdaptiveClarifications({
    intent: "Buy a TV",
    confirmations: [
      { field: "screen size", value: "55-inch", label: "55″" },
      { field: "budget", value: "balanced_value", label: "Best value / balanced" },
    ],
    locale: "en",
  });

  assert.match(intention, /^Buy a TV/);
  assert.match(intention, /screen size: 55″/);
  assert.match(intention, /budget: Best value \/ balanced/);
  assert.doesNotMatch(intention, /brand preference:/);
  assert.match(intention, /Keep every other required fact unknown/);
});

test("activity data accepts only real missing-field strings", () => {
  assert.deepEqual(missingFieldsFromAdaptiveActivityData({
    missingFields: ["budget", "", 42, null, "brand"],
  }), ["budget", "brand"]);
  assert.deepEqual(missingFieldsFromAdaptiveActivityData(null), []);
});
