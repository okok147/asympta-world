import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const activity = await readFile(new URL("../components/asympta-block-activity.tsx", import.meta.url), "utf8");
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

test("activity blocks stay bounded and off the animation loop", () => {
  assert.match(page, /AsymptaBlockActivity/);
  assert.match(activity, /ACTIVITY_REFRESH_MS = 900/);
  assert.match(activity, /MAX_ACTIVE_AGENTS = 4/);
  assert.match(activity, /MAX_BLOCKS_PER_AGENT = 4/);
  assert.match(activity, /MAX_ACTIVITY_BLOCKS = 28/);
  assert.match(activity, /ACTIVITY_HOLD_MS = 2_600/);
  assert.match(activity, /ACTIVITY_FADE_MS = 15_000/);
  assert.match(activity, /queryRenderedFeatures/);
  assert.match(activity, /asympta-activity-blocks-fill/);
  assert.doesNotMatch(activity, /requestAnimationFrame|MutationObserver|setState|advanceAtlasWorld/);
});
