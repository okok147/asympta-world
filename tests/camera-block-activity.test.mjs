import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const activity = await readFile(new URL("../components/asympta-block-activity.tsx", import.meta.url), "utf8");
const paperTone = await readFile(new URL("../components/asympta-paper-map-tone.tsx", import.meta.url), "utf8");
const renderer = await readFile(new URL("../components/asympta-world-live-60hz.tsx", import.meta.url), "utf8");

test("camera follow survives zoom while real drag still unlocks", () => {
  assert.match(renderer, /map\.on\("dragstart", stopFollow\)/);
  assert.match(renderer, /map\.on\("zoomstart", stopFollow\)/);
  assert.match(layout, /type === "zoomstart"/);
  assert.match(layout, /return this/);
  assert.match(layout, /type === "dragstart"/);
  assert.match(layout, /touches\.length > 1/);
  assert.match(layout, /__ASYMPTA_MAP__/);
});

test("activity blocks stay small, bounded and off the animation loop", () => {
  assert.match(page, /AsymptaBlockActivity/);
  assert.match(activity, /ACTIVITY_REFRESH_MS = 900/);
  assert.match(activity, /QUERY_RADIUS_PX = 10/);
  assert.match(activity, /MAX_ACTIVE_AGENTS = 3/);
  assert.match(activity, /MAX_BLOCKS_PER_AGENT = 2/);
  assert.match(activity, /MAX_ACTIVITY_BLOCKS = 10/);
  assert.match(activity, /MAX_BLOCK_SPAN_DEGREES = 0\.0012/);
  assert.match(activity, /MAX_OPACITY = 0\.32/);
  assert.match(activity, /geometryFitsBudget/);
  assert.match(activity, /ACTIVITY_HOLD_MS = 2_600/);
  assert.match(activity, /ACTIVITY_FADE_MS = 15_000/);
  assert.match(activity, /queryRenderedFeatures/);
  assert.match(activity, /asympta-activity-blocks-fill/);
  assert.doesNotMatch(activity, /requestAnimationFrame|MutationObserver|setState|advanceAtlasWorld/);
});

test("paper map keeps essential routes while removing expensive visual noise", () => {
  assert.match(page, /AsymptaPaperMapTone/);
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
  assert.match(paperTone, /MINOR_ROUTE/);
  assert.match(paperTone, /id === "city-life-routes"/);
  assert.match(paperTone, /id\.startsWith\("atlas-"\)/);
  assert.match(paperTone, /id\.startsWith\("asympta-"\)/);
  assert.match(paperTone, /dataset\.asymptaMapDetail = "essential"/);
  assert.match(paperTone, /clearInterval/);
  assert.doesNotMatch(paperTone, /requestAnimationFrame|MutationObserver|setState|advanceAtlasWorld/);
});
