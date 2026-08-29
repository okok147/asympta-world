import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../components/asympta-world-experience.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/asympta-restoration.css", import.meta.url), "utf8");

test("the product surface remains a map-first atlas visualizer", () => {
  assert.match(app, /data-map-app="true"/);
  assert.match(app, /data-map-style="paper-capital-atlas"/);
  assert.match(app, /Interactive paper-textured real-world street map visualizer/);
  assert.match(app, /Visualizer filters/);
  assert.match(app, /Activity Atlas/);
  assert.match(app, /Zoom in/);
  assert.match(app, /Zoom out/);
  assert.match(app, /Recenter map/);
  assert.doesNotMatch(app, /useLivingWorld/);
  assert.doesNotMatch(app, /WebMCP|Run the city order|Tell the city|HUMAN CHECKPOINT/);
});

test("map interaction delegates native pan and two-finger pinch to MapLibre", () => {
  assert.match(app, /maplibre-gl@5/);
  assert.match(app, /touchZoomRotate\.enable\(\)/);
  assert.match(app, /touchZoomRotate\.disableRotation\(\)/);
  assert.match(app, /dragRotate\.disable\(\)/);
  assert.match(app, /touchPitch\?\.disable\(\)/);
  assert.match(app, /cooperativeGestures:\s*false/);
  assert.doesNotMatch(app, /pointersRef/);
  assert.doesNotMatch(app, /pinchRef/);
  assert.doesNotMatch(app, /lonToWorldX/);
  assert.doesNotMatch(app, /latToWorldY/);
});

test("cartography uses real OpenStreetMap vector streets with a data overlay", () => {
  assert.match(app, /tiles\.openfreemap\.org\/styles\/positron/);
  assert.match(app, /addSource\("activity"/);
  assert.match(app, /activity-dots/);
  assert.match(app, /activity-labels/);
  assert.match(app, /MARKERS/);
  assert.match(app, /CATEGORY_LABELS/);
  assert.doesNotMatch(app, /tile\.openstreetmap\.org/);
  assert.doesNotMatch(app, /map-tiles/);
  assert.doesNotMatch(app, /DISTRICTS/);
  assert.doesNotMatch(app, /LOCAL_STREETS/);
  assert.doesNotMatch(app, /PIXEL_SIZE/);
  assert.doesNotMatch(app, /seededRandom/);
});

test("Asympta paper texture and minimal explorer controls remain present", () => {
  assert.match(css, /--paper:\s*#EEEDE6/i);
  assert.match(css, /\.map-paper-wash/);
  assert.match(css, /\.map-paper-grain/);
  assert.match(css, /mix-blend-mode:\s*multiply/);
  assert.match(css, /\.map-legend/);
  assert.match(css, /\.map-filter/);
  assert.match(css, /\.map-zoom/);
  assert.match(css, /touch-action:\s*none/);
  assert.match(css, /safe-area-inset/);
  assert.match(css, /prefers-reduced-motion/);
  assert.doesNotMatch(css, /image-rendering:\s*pixelated/i);
  assert.doesNotMatch(css, /image-rendering:\s*crisp-edges/i);
});
