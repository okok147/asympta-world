import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../components/asympta-world-experience.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/asympta-restoration.css", import.meta.url), "utf8");

test("the product surface remains a map-first visualizer", () => {
  assert.match(app, /data-map-app="true"/);
  assert.match(app, /Interactive real-world map visualizer/);
  assert.match(app, /Visualizer filters/);
  assert.match(app, /Zoom in/);
  assert.match(app, /Zoom out/);
  assert.match(app, /Recenter map/);
  assert.doesNotMatch(app, /useLivingWorld/);
  assert.doesNotMatch(app, /WebMCP|Run the city order|Tell the city|HUMAN CHECKPOINT/);
});

test("map interaction supports pan and cursor-centered wheel zoom", () => {
  assert.match(app, /onWheel=\{handleWheel\}/);
  assert.match(app, /onPointerDown=\{handlePointerDown\}/);
  assert.match(app, /onPointerMove=\{handlePointerMove\}/);
  assert.match(app, /setPointerCapture/);
  assert.match(app, /zoomAt/);
  assert.match(app, /lonToWorldX/);
  assert.match(app, /latToWorldY/);
});

test("cartography uses a real raster basemap with a separate data overlay", () => {
  assert.match(app, /data-map-style="real-map-visualizer"/);
  assert.match(app, /basemaps\.cartocdn\.com\/dark_all/);
  assert.match(app, /OpenStreetMap contributors/);
  assert.match(app, /map-overlay/);
  assert.match(app, /MARKERS/);
  assert.match(app, /CATEGORY_LABELS/);
  assert.doesNotMatch(app, /DISTRICTS/);
  assert.doesNotMatch(app, /LOCAL_STREETS/);
  assert.doesNotMatch(app, /PIXEL_SIZE/);
  assert.doesNotMatch(app, /seededRandom/);
  assert.doesNotMatch(css, /image-rendering:\s*pixelated/i);
  assert.doesNotMatch(css, /image-rendering:\s*crisp-edges/i);
});

test("visualizer controls remain minimal and responsive", () => {
  assert.match(css, /\.map-app/);
  assert.match(css, /\.map-legend/);
  assert.match(css, /\.map-filter/);
  assert.match(css, /\.map-zoom/);
  assert.match(css, /touch-action:\s*none/);
  assert.match(css, /safe-area-inset/);
  assert.match(css, /prefers-reduced-motion/);
});
