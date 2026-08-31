import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const localeSource = readFileSync(new URL("../components/asympta-complete-locale.tsx", import.meta.url), "utf8");
const pageSource = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");

const statuses = [
  "idle", "queued", "moving", "working", "sharing", "waiting", "returning", "waiting_approval", "blocked", "done",
  "interpreting", "discovering", "coordinating", "waiting_input", "executing", "verifying", "completed", "failed",
];
const marketplaceStages = [
  "context", "travel_personal", "travel_courier", "store", "stock", "offer", "quality", "payment", "handoff", "return", "deliver", "verify",
];

test("complete locale runtime is mounted after the semantic locale overlays", () => {
  assert.match(pageSource, /import \{ AsymptaCompleteLocale \}/);
  assert.match(pageSource, /<AsymptaGlobalLocale \/>\s*<AsymptaCompleteLocale \/>/);
});

test("English, Traditional Chinese and Japanese cover dynamic marketplace agent dialogue", () => {
  for (const locale of ["en", "zh-Hant", "ja"]) assert.ok(localeSource.includes(locale));
  for (const stage of marketplaceStages) {
    const matches = localeSource.match(new RegExp(`${stage}:`, "g")) ?? [];
    assert.ok(matches.length >= 3, `${stage} must exist in all three locale catalogs`);
  }
  assert.match(localeSource, /marketplaceKey\(task\)/);
  assert.match(localeSource, /dataset\.asymptaLocaleText = dialogue/);
});

test("agent, task and request statuses do not fall back to raw protocol values", () => {
  for (const status of statuses) {
    const matches = localeSource.match(new RegExp(`${status}:`, "g")) ?? [];
    assert.ok(matches.length >= 3, `${status} must exist in all three status catalogs`);
  }
  assert.match(localeSource, /syncAgents\(locale, value\)/);
  assert.match(localeSource, /dataset\.asymptaAmbientStatus = state/);
  assert.match(localeSource, /dataset\.asymptaLocalized = text/);
});

test("visible text, accessibility labels, errors and deterministic weather are localized", () => {
  for (const marker of [
    "mapLabel", "webMcpActions", "zoomControls", "closeAgent", "activeNearby", "approvalsWaiting",
    "translateKnown", "translateWeather", "aria-label", "title", "Open-Meteo forecast",
  ]) assert.ok(localeSource.includes(marker), `missing localization surface: ${marker}`);
  assert.match(localeSource, /document\.documentElement\.dataset\.asymptaLocale/);
  assert.match(localeSource, /MutationObserver\(schedule\)/);
});
