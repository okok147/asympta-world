import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
const read = (p) => readFile(new URL(p, import.meta.url), "utf8");

test("MapLibre shows real map tiles and never requests location until click", async () => {
  const [page, layout] = await Promise.all([
    read("../app/page.tsx"),
    read("../app/layout.tsx"),
  ]);
  assert.match(page, /tiles\.openfreemap\.org\/styles\/positron/);
  assert.match(page, /maplibre-gl@5\.6\.2/);
  assert.match(page, /navigator\.geolocation\.getCurrentPosition\(/);
  assert.match(page, /onClick=\{locateMe\}/);
  assert.match(page, /window\.isSecureContext/);
  assert.match(page, /getCurrentPosition\([\s\S]*?enableHighAccuracy: false/);
  assert.match(page, /map\.flyTo\(/);
  assert.match(page, /aria-label="Show my location on the map"/);
  assert.match(page, /not live users/);
  assert.doesNotMatch(page, /AsymptaWorldLive60Hz|AsymptaIntentComposer|AsymptaTaskKernelBridge|ASYMPTA_MAP_BRIDGE_BOOTSTRAP/);
  assert.match(layout, /import "\.\/paper-world\.css"/);
  assert.doesNotMatch(layout, /asympta-restoration|asympta-live-60hz|dangerouslySetInnerHTML/);
});

test("four transparent full-body hand-drawn creatures, not a painted fantasy-map background", async () => {
  const [page, art, css] = await Promise.all([
    read("../app/page.tsx"),
    read("../lib/world-creatures.ts"),
    read("../app/paper-world.css"),
  ]);
  for (const name of ["fox", "bear", "bunny", "otter"]) {
    assert.match(art, new RegExp("const " + name.toUpperCase() + " ="));
    assert.match(page, new RegExp('kind: "' + name + '"'));
  }
  assert.match(art, /viewBox="0 0 100 106"/);
  assert.match(page, /dataset\.illustration = "true"/);
  assert.match(css, /asympta-creature-breathe/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /pointer-events: none/);
  assert.doesNotMatch(css, /background-image:|filter:|backdrop-filter:|background: url\(/);
});
