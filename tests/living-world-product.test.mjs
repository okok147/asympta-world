import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../components/asympta-world-experience.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/asympta-restoration.css", import.meta.url), "utf8");

test("the product surface remains only a map app", () => {
  assert.match(app, /data-map-app="true"/);
  assert.match(app, /Interactive Tokyo-inspired vector city map/);
  assert.match(app, /Toggle district color layer/);
  assert.match(app, /Zoom in/);
  assert.match(app, /Zoom out/);
  assert.match(app, /Recenter map/);
  assert.doesNotMatch(app, /useLivingWorld/);
  assert.doesNotMatch(app, /Agent|WebMCP|Run the city order|Tell the city|HUMAN CHECKPOINT/);
});

test("map interaction supports pan, wheel zoom and touch pinch", () => {
  assert.match(app, /onWheel=\{handleWheel\}/);
  assert.match(app, /onPointerDown=\{handlePointerDown\}/);
  assert.match(app, /pointersRef/);
  assert.match(app, /gestureRef/);
  assert.match(app, /Math\.hypot/);
  assert.match(app, /clampZoom/);
});

test("cartography is a clear Tokyo-inspired vector city instead of a pixel grid", () => {
  assert.match(app, /data-map-style="tokyo-vector"/);
  assert.match(app, /<svg/);
  assert.match(app, /viewBox=/);
  assert.match(app, /DISTRICTS/);
  assert.match(app, /LOCAL_STREETS/);
  assert.match(app, /EXPRESSWAYS/);
  assert.match(app, /MAJOR_ROADS/);
  assert.match(app, /RAILS/);
  assert.match(app, /WATERWAYS/);
  assert.match(app, /PARKS/);
  assert.doesNotMatch(app, /PIXEL_SIZE/);
  assert.doesNotMatch(app, /seededRandom/);
  assert.doesNotMatch(app, /drawReferenceMap/);
  assert.doesNotMatch(css, /image-rendering:\s*pixelated/i);
  assert.doesNotMatch(css, /image-rendering:\s*crisp-edges/i);
});

test("map controls remain minimal and responsive", () => {
  assert.match(css, /\.map-app/);
  assert.match(css, /\.map-control--layers/);
  assert.match(css, /\.map-zoom/);
  assert.match(css, /touch-action:\s*none/);
  assert.match(css, /safe-area-inset/);
  assert.match(css, /prefers-reduced-motion/);
});
