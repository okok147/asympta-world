import assert from "node:assert/strict";
import test from "node:test";

import {
  createAdaptiveInteractionSchema,
  mergeAdaptiveClarifications,
  missingFieldsFromAdaptiveActivityData,
  normalizeAdaptiveMissingFields,
  planAdaptiveMissingFields,
} from "../lib/asympta-adaptive-interaction.ts";
import {
  createAdaptiveOptionPrimitiveSchema,
  fieldsUsingChoicePrimitives,
} from "../lib/asympta-option-primitives.ts";

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

test("TV narrative gaps become four concrete option primitives in one schema", () => {
  const schema = createAdaptiveOptionPrimitiveSchema({
    intent: "使用者想購買一台電視機",
    missingFields: ["使用者想購買一台電視機，需先釐清預算、尺寸、品牌偏好與配送地點等資訊。"],
    locale: "zh-Hant",
  });
  assert.deepEqual(schema.fields.map((field) => field.key), ["budget", "screen_size", "brand", "delivery_location"]);
  assert.ok(schema.fields.every((field) => field.control === "single_choice"));
  assert.ok(schema.fields[0].options.some((candidate) => candidate.label === "HK$3,000–6,000"));
  assert.ok(schema.fields[1].options.some((candidate) => candidate.label === "75″"));
  assert.ok(schema.fields[2].options.some((candidate) => candidate.label === "Sony"));
  assert.ok(schema.fields[3].options.some((candidate) => candidate.label === "常用住址"));
  assert.ok(schema.fields[3].options.some((candidate) => candidate.label === "門市自取"));
  assert.equal(schema.fields[3].customPlaceholder, "輸入送貨地址或地區…");
});

test("reusable real-life primitive layer covers common choices without inventing unknown facts", () => {
  const scenarios = [
    ["Order groceries for dinner", ["dietary preference", "payment method"], ["dietary_preference", "payment_method"]],
    ["Book a hotel room", ["room type", "budget"], ["room_preference", "budget"]],
    ["Book a flight", ["travel class", "budget"], ["transport_class", "budget"]],
    ["Book a movie ticket", ["seat preference"], ["seat_preference"]],
    ["幫我買晚餐材料", ["飲食要求", "配送地址", "付款方式"], ["dietary_preference", "delivery_location", "payment_method"]],
    ["テレビを買いたい", ["配送先", "ブランド"], ["delivery_location", "ブランド"]],
  ];
  for (const [intent, missingFields, expected] of scenarios) {
    const schema = createAdaptiveOptionPrimitiveSchema({ intent, missingFields, locale: String(intent).match(/[\u3040-\u30ff]/u) ? "ja" : "zh-Hant" });
    assert.deepEqual(schema.fields.map((field) => field.key), expected, String(intent));
    assert.equal(fieldsUsingChoicePrimitives(schema).length, schema.fields.length, String(intent));
  }

  const unknown = createAdaptiveOptionPrimitiveSchema({
    intent: "Arrange a new kind of neighbourhood service",
    missingFields: ["locker compatibility protocol"],
    locale: "en",
  });
  assert.equal(unknown.nextField?.control, "text");
  assert.equal(unknown.nextField?.options.length, 0);
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
  assert.deepEqual(schema.nextField?.options.map((candidate) => candidate.label), ["按我的喜好推薦", "香港近期熱門", "不限歌手，只看有票"]);
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
  const normalized = normalizeAdaptiveMissingFields(["screen size, budget", "Budget", "purchase-location"]);
  assert.deepEqual(normalized.map((candidate) => candidate.normalized), ["screen_size", "budget", "purchase_location"]);
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
    confirmations: [{ field: "event intent", value: "hong_kong_popular", label: "香港近期熱門" }],
    locale: "zh-Hant",
  });
  assert.match(intention, /event intent: 香港近期熱門/);
  assert.match(intention, /先按這個演出意向搜尋可用場次/);
  assert.match(intention, /不要要求使用者逐項輸入/);
  assert.match(intention, /明確消費上限應保持未確認/);
});

test("activity data accepts only real missing-field strings", () => {
  assert.deepEqual(missingFieldsFromAdaptiveActivityData({ missingFields: ["budget", "", 42, null, "brand"] }), ["budget", "brand"]);
  assert.deepEqual(missingFieldsFromAdaptiveActivityData(null), []);
});
