import assert from "node:assert/strict";
import test from "node:test";

import { readAdaptiveActivityIntent } from "../lib/asympta-adaptive-activity-bridge.ts";
import {
  createAdaptiveInteractionSchema,
  mergeAdaptiveClarifications,
  missingFieldsFromAdaptiveActivityData,
  normalizeAdaptiveMissingFields,
  planAdaptiveMissingFields,
} from "../lib/asympta-adaptive-interaction.ts";

test("adaptive activity listener reads the canonical Asympta IR intent object", () => {
  assert.equal(readAdaptiveActivityIntent({
    intent: { raw: "  Buy a television  ", locale: "en" },
  }), "Buy a television");
  assert.equal(readAdaptiveActivityIntent({ intent: " Legacy browser probe " }), "Legacy browser probe");
  assert.equal(readAdaptiveActivityIntent({ intent: { locale: "en" } }), "");
  assert.equal(readAdaptiveActivityIntent(null), "");
});

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

test("concert ticket gaps collapse into one high-information show choice", () => {
  const schema = createAdaptiveInteractionSchema({
    intent: "使用者希望購買一張演唱會門票，預算彈性可接受高階",
    missingFields: ["演出、日期、地點、數量"],
    locale: "zh-Hant",
    interactionId: "concert-1",
    now: "2026-08-31T05:00:00.000Z",
  });

  assert.deepEqual(schema.fields.map((field) => field.key), ["event_intent"]);
  assert.equal(schema.nextField?.prompt, "你想看哪位歌手或哪個演唱會？");
  assert.equal(schema.nextField?.control, "single_choice");
  assert.equal(schema.nextField?.customPlaceholder, "輸入歌手、樂隊或演唱會名稱…");
  assert.deepEqual(schema.nextField?.options.map((candidate) => candidate.label), [
    "按我的喜好推薦",
    "香港近期熱門",
    "不限歌手，只看有票",
  ]);
  assert.match(schema.nextField?.reason ?? "", /日期、時間和地點應由找到的實際場次提供/);
});

test("ticket planner does not repeat an explicit one-ticket quantity", () => {
  const fields = planAdaptiveMissingFields({
    intent: "Buy one concert ticket",
    missingFields: ["artist", "date", "venue", "ticket count", "budget"],
  });

  assert.deepEqual(fields.map((field) => field.normalized), ["event_intent", "budget"]);
});

test("non-concert ticket requests are not forced into artist choices", () => {
  const fields = planAdaptiveMissingFields({
    intent: "Buy one football match ticket",
    missingFields: ["match", "date", "venue"],
  });

  assert.deepEqual(fields.map((field) => field.normalized), ["match", "date", "venue"]);
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

test("event confirmation tells the agent to search performances instead of asking date and venue fields", () => {
  const intention = mergeAdaptiveClarifications({
    intent: "購買一張演唱會門票",
    confirmations: [
      { field: "event intent", value: "hong_kong_popular", label: "香港近期熱門" },
    ],
    locale: "zh-Hant",
  });

  assert.match(intention, /event intent: 香港近期熱門/);
  assert.match(intention, /先按這個演出意向搜尋可用場次/);
  assert.match(intention, /不要要求使用者逐項輸入/);
  assert.match(intention, /明確消費上限應保持未確認/);
});

test("activity data accepts only real missing-field strings", () => {
  assert.deepEqual(missingFieldsFromAdaptiveActivityData({
    missingFields: ["budget", "", 42, null, "brand"],
  }), ["budget", "brand"]);
  assert.deepEqual(missingFieldsFromAdaptiveActivityData(null), []);
});
