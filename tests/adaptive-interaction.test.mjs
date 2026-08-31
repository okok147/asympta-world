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

test("TV purchase gaps automatically become concrete option groups instead of a prose checklist", () => {
  const schema = createAdaptiveOptionPrimitiveSchema({
    intent: "使用者想購買一台電視機",
    missingFields: ["預算、尺寸、品牌偏好、配送地點"],
    locale: "zh-Hant",
    interactionId: "tv-options-1",
    now: "2026-08-31T09:00:00.000Z",
  });

  assert.deepEqual(schema.fields.map((field) => field.key), [
    "預算",
    "尺寸",
    "品牌偏好",
    "delivery_destination",
  ]);
  assert.equal(schema.fields.length, 4);
  assert.ok(schema.fields.every((field) => field.control === "single_choice"));

  const [budget, size, brand, delivery] = schema.fields;
  assert.ok(budget.options.some((candidate) => candidate.label.includes("性價比")));
  assert.ok(size.options.some((candidate) => candidate.label === "55″"));
  assert.ok(brand.options.some((candidate) => candidate.label === "Sony"));
  assert.ok(brand.options.some((candidate) => candidate.label === "Samsung"));
  assert.equal(delivery.prompt, "希望送到哪裏？");
  assert.ok(delivery.options.some((candidate) => candidate.value === "saved_delivery_address"));
  assert.ok(delivery.options.some((candidate) => candidate.value === "current_location"));
});

test("English delivery location is not mistaken for where to shop", () => {
  const schema = createAdaptiveOptionPrimitiveSchema({
    intent: "Buy a TV",
    missingFields: ["delivery location"],
    locale: "en",
  });
  assert.equal(schema.nextField?.key, "delivery_destination");
  assert.equal(schema.nextField?.prompt, "Where should it be delivered?");
  assert.equal(schema.nextField?.control, "single_choice");
});

test("concert ticket gaps collapse into one high-information show choice", () => {
  const schema = createAdaptiveOptionPrimitiveSchema({
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

test("common real-life missing details compile into reusable choice primitives", () => {
  const scenarios = [
    {
      name: "grocery delivery",
      intent: "Order groceries for dinner",
      missing: ["dietary preference", "delivery address", "payment method"],
      expected: ["dietary_preference", "delivery_destination", "payment_method"],
    },
    {
      name: "restaurant meal",
      intent: "Order dinner for two",
      missing: ["dietary restrictions", "budget", "delivery location"],
      expected: ["dietary_preference", "budget", "delivery_destination"],
    },
    {
      name: "hotel booking",
      intent: "Book a hotel room",
      missing: ["room type", "budget"],
      expected: ["room_preference", "budget"],
    },
    {
      name: "flight booking",
      intent: "Book a flight",
      missing: ["travel class", "budget"],
      expected: ["transport_class", "budget"],
    },
    {
      name: "cinema seat",
      intent: "Book a movie ticket",
      missing: ["seat preference"],
      expected: ["seat_preference"],
    },
    {
      name: "concert seat strategy",
      intent: "Buy concert tickets for Coldplay",
      missing: ["seat preference", "budget"],
      expected: ["seat_preference", "budget"],
    },
    {
      name: "parcel delivery",
      intent: "Send this parcel to my family",
      missing: ["shipping address", "payment method"],
      expected: ["delivery_destination", "payment_method"],
    },
    {
      name: "Japanese delivery",
      intent: "テレビを買いたい",
      missing: ["配送先", "ブランド"],
      expected: ["delivery_destination", "ブランド"],
      locale: "ja",
    },
    {
      name: "Traditional Chinese grocery",
      intent: "幫我買晚餐材料",
      missing: ["飲食要求", "配送地址", "付款方式"],
      expected: ["dietary_preference", "delivery_destination", "payment_method"],
      locale: "zh-Hant",
    },
  ];

  for (const scenario of scenarios) {
    const schema = createAdaptiveOptionPrimitiveSchema({
      intent: scenario.intent,
      missingFields: scenario.missing,
      locale: scenario.locale ?? "en",
    });
    assert.deepEqual(schema.fields.map((field) => field.key), scenario.expected, scenario.name);
    assert.equal(fieldsUsingChoicePrimitives(schema).length, schema.fields.length, scenario.name);
  }
});

test("option primitive keeps unknown facts as text rather than inventing choices", () => {
  const schema = createAdaptiveOptionPrimitiveSchema({
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
