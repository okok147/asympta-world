import assert from "node:assert/strict";
import test from "node:test";

import {
  createAdaptiveInteractionSchema,
  expandAutomaticClarificationFields,
} from "../lib/asympta-automatic-clarification-options.ts";

test("a natural-language TV clarification summary becomes atomic option fields", () => {
  const schema = createAdaptiveInteractionSchema({
    intent: "使用者想購買一台電視機",
    missingFields: ["使用者想購買一台電視機，需先釐清預算、尺寸、品牌偏好與配送地點等資訊。"],
    locale: "zh-Hant",
    interactionId: "tv-options-1",
    now: "2026-08-31T08:45:00.000Z",
  });

  assert.deepEqual(schema.fields.map((field) => field.key), [
    "budget",
    "screen_size",
    "brand",
    "delivery_location",
  ]);
  assert.deepEqual(schema.fields.map((field) => field.control), [
    "single_choice",
    "single_choice",
    "single_choice",
    "single_choice",
  ]);

  const [budget, size, brand, destination] = schema.fields;
  assert.ok(budget.options.some((candidate) => candidate.label === "HK$3,000–6,000"));
  assert.ok(size.options.some((candidate) => candidate.label === "75″"));
  assert.ok(brand.options.some((candidate) => candidate.label === "Sony"));
  assert.equal(destination.key, "delivery_location");
  assert.equal(destination.prompt, "電視要送到哪裏？");
  assert.deepEqual(destination.options.map((candidate) => candidate.label), [
    "常用住址",
    "目前位置",
    "門市自取",
  ]);
  assert.equal(destination.customPlaceholder, "輸入送貨地址或地區…");
});

test("broad TV specification language is repaired into concrete next choices", () => {
  const schema = createAdaptiveInteractionSchema({
    intent: "Buy a television",
    missingFields: ["尚需確認其他必要規格以提供合適建議。"],
    locale: "zh-Hant",
    interactionId: "tv-broad-gap-1",
    now: "2026-08-31T09:55:00.000Z",
  });

  assert.deepEqual(schema.fields.map((field) => field.key), [
    "screen_size",
    "brand",
    "delivery_location",
  ]);
  assert.ok(schema.fields.every((field) => field.control === "single_choice"));
  assert.equal(schema.nextField?.key, "screen_size");
  assert.ok(schema.nextField?.options.some((candidate) => candidate.label === "55″"));
});

test("delivery location stays separate from purchase location", () => {
  const schema = createAdaptiveInteractionSchema({
    intent: "Buy a television",
    missingFields: ["delivery location", "purchase location"],
    locale: "en",
    interactionId: "tv-location-1",
    now: "2026-08-31T08:45:00.000Z",
  });

  assert.equal(schema.fields[0]?.key, "delivery_location");
  assert.equal(schema.fields[0]?.prompt, "Where should it be delivered?");
  assert.ok(schema.fields[0]?.options.some((candidate) => candidate.value === "saved_home"));
  assert.equal(schema.fields[1]?.prompt, "Where should I look first?");
});

test("atomic missing-field arrays remain in the agent's original order", () => {
  assert.deepEqual(
    expandAutomaticClarificationFields(["budget", "screen size", "brand preference", "delivery location"]),
    ["budget", "screen size", "brand preference", "delivery location"],
  );
});

test("movie clarification becomes four calm sequential choices", () => {
  const schema = createAdaptiveInteractionSchema({
    intent: "Go to watch movie",
    missingFields: ["想看的電影", "戲院地區", "場次時間", "門票數量"],
    locale: "zh-Hant",
    interactionId: "cinema-options-1",
    now: "2026-09-01T02:50:00.000Z",
  });

  assert.deepEqual(schema.fields.map((field) => field.key), [
    "movie_preference",
    "cinema_area",
    "showtime",
    "quantity",
  ]);
  assert.equal(schema.nextField?.prompt, "你想看哪一套電影？");
  assert.ok(schema.nextField?.options.some((candidate) => candidate.value === "personalized_recommendation"));
  assert.ok(schema.fields[1]?.options.some((candidate) => candidate.value === "nearby"));
  assert.ok(schema.fields[2]?.options.some((candidate) => candidate.value === "tonight_after_7"));
  assert.equal(schema.fields[3]?.control, "number");
});
