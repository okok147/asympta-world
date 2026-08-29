import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../components/asympta-world-live-60hz.tsx", import.meta.url), "utf8");
const animalArt = await readFile(new URL("../components/asympta-animal-art.tsx", import.meta.url), "utf8");
const engine = await readFile(new URL("../lib/atlas-simulation.ts", import.meta.url), "utf8");
const demo = await readFile(new URL("../lib/atlas-demo.ts", import.meta.url), "utf8");
const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/asympta-restoration.css", import.meta.url), "utf8");
const fpsCss = await readFile(new URL("../app/asympta-live-60hz.css", import.meta.url), "utf8");
const paperMapCss = await readFile(new URL("../app/asympta-paper-map.css", import.meta.url), "utf8");
const animalCss = await readFile(new URL("../app/asympta-animal-art.css", import.meta.url), "utf8");

test("the product now boots the 60Hz culled paper living-city renderer", () => {
  assert.match(page, /AsymptaWorldLive60Hz/);
  assert.match(app, /data-map-app="true"/);
  assert.match(app, /data-map-style="paper-illustrated-animal-living-city-demo"/);
  assert.match(app, /data-render-mode="raf-60hz-viewport-culling"/);
  assert.match(app, /createAtlasDemoWorld/);
  assert.match(app, /animalSvgMarkup/);
  assert.match(app, /AnimalPortrait/);
  assert.doesNotMatch(app, /🐱|🐰|🐹|🐶|🦊|🐻|🐯|🐼|🐮|🦝|🐨|🐵|🦉|🐧|🐦/u);
});

test("visual positions are updated every requestAnimationFrame while expensive work stays throttled", () => {
  assert.match(app, /requestAnimationFrame\(animate\)/);
  assert.match(app, /updateForegroundVisual60Hz\(worldRef\.current, elapsed\)/);
  assert.match(app, /updateAmbientVisual60Hz\(visualNow\)/);
  assert.match(app, /SIMULATION_STEP_MS = 80/);
  assert.match(app, /MAP_SOURCE_REFRESH_MS = 240/);
  assert.match(app, /UI_REFRESH_MS = 250/);
  assert.match(app, /FOREGROUND_SMOOTHING_MS = 54/);
  assert.match(app, /document\.hidden/);
  assert.match(app, /setCenter\(\[visual\.lon, visual\.lat\]\)/);
});

test("ambient city uses viewport culling and mounts only a small nearby set", () => {
  assert.match(app, /MAX_AMBIENT_MOBILE = 8/);
  assert.match(app, /MAX_AMBIENT_DESKTOP = 12/);
  assert.match(app, /expandedBounds/);
  assert.match(app, /actorInside/);
  assert.match(app, /reconcileAmbientMarkers/);
  assert.match(app, /visibleAmbientIndicesRef/);
  assert.match(app, /moveend/);
  assert.match(app, /zoomend/);
  assert.match(demo, /cityLifeActorAt/);
  assert.match(demo, /Array\.from\(\{ length: CITY_LIFE_COUNT \}/);
});

test("dialogue above and status below are visible outside the marker paint box", () => {
  assert.match(app, /animal-map-marker__dialogue/);
  assert.match(app, /animal-map-marker__status-text/);
  assert.match(app, /foregroundDialogue/);
  assert.match(app, /foregroundStatus/);
  assert.match(app, /WebMCP →/);
  assert.match(fpsCss, /\.animal-map-marker__dialogue/);
  assert.match(fpsCss, /bottom:\s*calc\(100% \+ 5px\)/);
  assert.match(fpsCss, /\.animal-map-marker__status-text/);
  assert.match(fpsCss, /top:\s*calc\(100% \+ 3px\)/);
  assert.match(app, /AMBIENT_DIALOGUE_LIMIT = 4/);
  assert.match(paperMapCss, /contain:\s*layout style\s*!important/);
  assert.match(paperMapCss, /overflow:\s*visible\s*!important/);
  assert.match(paperMapCss, /width:\s*max-content/);
  assert.doesNotMatch(paperMapCss, /contain:\s*paint/);
});

test("MapLibre vector blocks are recoloured to the Asympta paper palette", () => {
  assert.match(layout, /ASYMPTA_MAP_PALETTE_BOOTSTRAP/);
  assert.match(layout, /#EEEDE6/);
  assert.match(layout, /#DDE3E0/);
  assert.match(layout, /#DDD8CC/);
  assert.match(layout, /#E8E4DB/);
  assert.match(layout, /setPaintProperty/);
  assert.match(layout, /fill-extrusion-color/);
  assert.match(layout, /text-halo-color/);
  assert.match(layout, /asymptaMapPalette = "paper"/);
  assert.match(layout, /asympta-paper-map\.css/);
  assert.match(paperMapCss, /\.map-canvas \.maplibregl-canvas/);
});

test("WebMCP inspector shows callable JSON, permission mode and live agent state", () => {
  assert.match(app, /WEBMCP_CATALOG/);
  assert.match(app, /PermissionMode = "READ" \| "WRITE"/);
  assert.match(app, /asympta_observe_living_city/);
  assert.match(app, /asympta_request_external_action/);
  assert.match(app, /JSON\.stringify\(currentCall, null, 2\)/);
  assert.match(app, /JSON\.stringify\(liveWebMcpState, null, 2\)/);
  assert.match(app, /pendingApproval/);
  assert.match(app, /visibleAmbientAgents/);
  assert.match(app, /navigator\.clipboard/);
  assert.match(fpsCss, /\.atlas-webmcp-inspector/);
  assert.match(fpsCss, /\.atlas-permission--read/);
  assert.match(fpsCss, /\.atlas-permission--write/);
});

test("WebMCP writes remain explicit human-gated simulation requests", () => {
  assert.match(app, /document\.modelContext/);
  assert.match(app, /registerTool\(tool, \{ signal: controller\.signal \}\)/);
  assert.match(app, /queuedForHumanApproval/);
  assert.match(app, /requestWebMcpWorkflow/);
  assert.match(app, /requestWebMcpAction/);
  assert.match(engine, /requestWebMcpWorkflow/);
  assert.match(engine, /requestWebMcpAction/);
  assert.match(demo, /Background users and businesses are synthetic demonstration actors/);
});

test("collapsible menu, camera follow and language control remain calm and clear", () => {
  assert.match(app, /menuOpen/);
  assert.match(app, /atlas-menu-bar/);
  assert.match(app, /atlas-menu-panel/);
  assert.match(app, /toggleCameraFollow/);
  assert.match(app, /Globe2/);
  assert.match(app, /繁體中文/);
  assert.match(app, /日本語/);
  assert.match(app, /document\.documentElement\.lang = locale/);
  assert.match(css, /\.atlas-console\.is-collapsed/);
  assert.match(css, /\.atlas-language-menu/);
  assert.match(fpsCss, /max-height:\s*min\(68vh, 610px\)/);
});

test("native MapLibre pinch zoom remains first-class", () => {
  assert.match(app, /maplibre-gl@5/);
  assert.match(app, /touchZoomRotate\.enable\(\)/);
  assert.match(app, /touchZoomRotate\.disableRotation\(\)/);
  assert.match(app, /dragstart/);
  assert.match(app, /zoomstart/);
  assert.doesNotMatch(app, /pointersRef/);
  assert.doesNotMatch(app, /pinchRef/);
});

test("original animal art and paper texture remain lightweight", () => {
  assert.match(animalArt, /AnimalKind/);
  assert.match(animalArt, /<svg class="asympta-animal-svg"/);
  assert.doesNotMatch(animalArt, /🐱|🐰|🐶|🦊|🐻|🐼|🦝|🐨|🦉|🐧|🐦/u);
  assert.match(css, /--paper:\s*#EEEDE6/i);
  assert.match(css, /\.map-paper-wash/);
  assert.match(css, /\.map-paper-grain/);
  assert.match(css, /contain:\s*layout paint style/);
  assert.match(animalCss, /\.asympta-animal-svg/);
  assert.doesNotMatch(css, /image-rendering:\s*pixelated/i);
  assert.doesNotMatch(css, /image-rendering:\s*crisp-edges/i);
});
