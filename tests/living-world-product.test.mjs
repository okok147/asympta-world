import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../components/asympta-world-experience.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/asympta-restoration.css", import.meta.url), "utf8");

test("the product surface remains only a map app", () => {
  assert.match(app, /data-map-app="true"/);
  assert.match(app, /Interactive pixel city map/);
  assert.match(app, /Toggle map color layer/);
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

test("cartography now matches the high-contrast pixel reference", () => {
  assert.match(app, /PIXEL_SIZE/);
  assert.match(app, /PURPLE_CORRIDORS/);
  assert.match(app, /CYAN_CORRIDORS/);
  assert.match(app, /EXPRESSWAYS/);
  assert.match(app, /MAJOR_ROADS/);
  assert.match(app, /LAND_COLORS/);
  assert.match(app, /drawPolyline/);
  assert.match(app, /lineCap = "butt"/);
  assert.match(app, /lineJoin = "miter"/);
  assert.doesNotMatch(app, /quadraticCurveTo/);
  assert.match(css, /image-rendering:\s*pixelated/i);
  assert.match(css, /image-rendering:\s*crisp-edges/i);
});

test("map controls remain minimal and responsive", () => {
  assert.match(css, /\.map-app/);
  assert.match(css, /\.map-control--layers/);
  assert.match(css, /\.map-zoom/);
  assert.match(css, /touch-action:\s*none/);
  assert.match(css, /safe-area-inset/);
  assert.match(css, /prefers-reduced-motion/);
});
