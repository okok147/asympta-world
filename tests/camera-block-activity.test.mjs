import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const activity = await readFile(new URL("../components/asympta-block-activity.tsx", import.meta.url), "utf8");
const paperTone = await readFile(new URL("../components/asympta-paper-map-tone.tsx", import.meta.url), "utf8");
const renderer = await readFile(new URL("../components/asympta-world-live-60hz.tsx", import.meta.url), "utf8");

test("legacy camera input hooks remain available without being mounted by the intention world", () => {
  assert.match(page, /AsymptaIntentWorld/);
  assert.doesNotMatch(page, /AsymptaWorldLive60Hz/);
  assert.match(layout, /asympta-intent-world\.css/);
  assert.match(renderer, /map\.on\("dragstart", stopFollow\)/);
  assert.match(renderer, /map\.on\("zoomstart", stopFollow\)/);
  assert.match(renderer, /__ASYMPTA_MAP__/);
});

test("legacy active-block tinting remains bounded and is not mounted in the preset-free entry point", () => {
  assert.doesNotMatch(page, /AsymptaBlockActivity/);
  assert.match(activity, /ACTIVITY_REFRESH_MS = 900/);
  assert.match(activity, /QUERY_RADIUS_PX = 11/);
  assert.match(activity, /MAX_ACTIVE_AGENTS = 24/);
  assert.match(activity, /MAX_BLOCKS_PER_AGENT = 1/);
  assert.match(activity, /MAX_ACTIVITY_BLOCKS = 20/);
  assert.match(activity, /MAX_BLOCK_SPAN_DEGREES = 0\.0011/);
  assert.match(activity, /MAX_OPACITY = 0\.30/);
  assert.match(activity, /ACTIVE_AGENT_STATUSES = new Set\(\["moving", "working", "sharing", "waiting", "returning"\]\)/);
  assert.match(activity, /ACTIVE_AMBIENT_STATUSES = new Set\(\["moving", "working"\]\)/);
  assert.match(activity, /snapshot\.ambient/);
  assert.match(activity, /Camera selection and stakeholder side never affect eligibility/);
  assert.match(activity, /geometryFitsBudget/);
  assert.match(activity, /ACTIVITY_HOLD_MS = 1_900/);
  assert.match(activity, /ACTIVITY_FADE_MS = 8_500/);
  assert.match(activity, /queryRenderedFeatures/);
  assert.match(activity, /asympta-activity-blocks-fill/);
  assert.doesNotMatch(activity, /requestAnimationFrame|MutationObserver|setState|advanceAtlasWorld/);
});

test("legacy paper-map module keeps only major network lines when reused", () => {
  assert.doesNotMatch(page, /AsymptaPaperMapTone/);
  assert.match(paperTone, /#EEEDE6/);
  assert.match(paperTone, /#DDE3E0/);
  assert.match(paperTone, /#DDD8CC/);
  assert.match(paperTone, /#E8E4DB/);
  assert.match(paperTone, /#E3E7DD/);
  assert.match(paperTone, /MAX_ATTEMPTS = 24/);
  assert.match(paperTone, /MAX_MAP_PIXEL_RATIO = 2/);
  assert.match(paperTone, /setPixelRatio/);
  assert.match(paperTone, /setLayoutProperty/);
  assert.match(paperTone, /fill-extrusion/);
  assert.match(paperTone, /NOISY_SYMBOL/);
  assert.match(paperTone, /MAJOR_ROUTE/);
  assert.match(paperTone, /NONESSENTIAL_LINE/);
  assert.match(paperTone, /motorway\|trunk\|highway\|primary\|rail\|transit/);
  assert.match(paperTone, /id === "city-life-routes"/);
  assert.match(paperTone, /id\.startsWith\("atlas-"\)/);
  assert.match(paperTone, /id\.startsWith\("asympta-"\)/);
  assert.match(paperTone, /dataset\.asymptaMapDetail = "minimal-essential-routes"/);
  assert.match(paperTone, /clearInterval/);
  assert.doesNotMatch(paperTone, /requestAnimationFrame|MutationObserver|setState|advanceAtlasWorld/);
});
