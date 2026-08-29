import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../components/asympta-world-live-demo.tsx", import.meta.url), "utf8");
const animalArt = await readFile(new URL("../components/asympta-animal-art.tsx", import.meta.url), "utf8");
const engine = await readFile(new URL("../lib/atlas-simulation.ts", import.meta.url), "utf8");
const demo = await readFile(new URL("../lib/atlas-demo.ts", import.meta.url), "utf8");
const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/asympta-restoration.css", import.meta.url), "utf8");
const animalCss = await readFile(new URL("../app/asympta-animal-art.css", import.meta.url), "utf8");

test("the product remains a paper illustrated-animal living-city demonstration", () => {
  assert.match(page, /AsymptaWorldLiveDemo/);
  assert.match(app, /data-map-app="true"/);
  assert.match(app, /data-map-style="paper-illustrated-animal-living-city-demo"/);
  assert.match(app, /data-render-mode="imperative-map-loop"/);
  assert.match(app, /illustrated animal stakeholder agents/);
  assert.match(app, /createAtlasDemoWorld/);
  assert.match(app, /CITY_LIFE_COUNT/);
  assert.match(app, /createAnimalMarkerElement/);
  assert.match(app, /animalSvgMarkup/);
  assert.match(app, /AnimalPortrait/);
  assert.doesNotMatch(app, /🐱|🐰|🐹|🐶|🦊|🐻|🐯|🐼|🐮|🦝|🐨|🐵|🦉|🐧|🐦/u);
  assert.doesNotMatch(app, /useLivingWorld/);
  assert.doesNotMatch(app, /@\/lib\/living-world/);
});

test("the animation loop avoids high-frequency React re-rendering", () => {
  assert.match(app, /SIMULATION_STEP_MS = 70/);
  assert.match(app, /AMBIENT_REFRESH_MS = 110/);
  assert.match(app, /MAP_SOURCE_REFRESH_MS = 210/);
  assert.match(app, /UI_REFRESH_MS = 260/);
  assert.match(app, /worldRef\.current = advanceAtlasWorld/);
  assert.match(app, /syncForegroundMarkers\(worldRef\.current/);
  assert.match(app, /syncCityMarkers\(worldRef\.current\.now/);
  assert.match(app, /if \(uiAccumulator >= UI_REFRESH_MS\)/);
  assert.match(app, /setWorld\(worldRef\.current\)/);
  assert.match(app, /document\.hidden/);
  assert.doesNotMatch(app, /accumulator >= 42/);
  assert.doesNotMatch(css, /backdrop-filter/);
  assert.doesNotMatch(css, /filter:\s*drop-shadow/);
  assert.match(animalCss, /Only the selected foreground character breathes/);
});

test("top atlas surface is collapsible and behaves like a compact menu", () => {
  assert.match(app, /menuOpen/);
  assert.match(app, /atlas-console \$\{menuOpen \? "is-open" : "is-collapsed"\}/);
  assert.match(app, /atlas-menu-bar/);
  assert.match(app, /atlas-menu-identity/);
  assert.match(app, /aria-expanded=\{menuOpen\}/);
  assert.match(app, /atlas-menu-panel/);
  assert.match(css, /\.atlas-console\.is-collapsed/);
  assert.match(css, /\.atlas-console\.is-collapsed \.atlas-menu-panel \{ display: none; \}/);
});

test("WebMCP demo actions, camera follow and language icon are visible controls", () => {
  assert.match(app, /WebMCP actions/);
  assert.match(app, /queueWebMcpDemoAction/);
  assert.match(app, /reserve_capacity/);
  assert.match(app, /authorize_payment/);
  assert.match(app, /release_shipment/);
  assert.match(app, /send_customer_update/);
  assert.match(app, /toggleCameraFollow/);
  assert.match(app, /Camera follow/);
  assert.match(app, /Globe2/);
  assert.match(app, /繁體中文/);
  assert.match(app, /日本語/);
  assert.match(app, /document\.documentElement\.lang = locale/);
  assert.match(css, /\.atlas-language-menu/);
  assert.match(css, /\.atlas-webmcp-menu/);
});

test("native MapLibre pinch and camera follow remain first-class", () => {
  assert.match(app, /maplibre-gl@5/);
  assert.match(app, /touchZoomRotate\.enable\(\)/);
  assert.match(app, /touchZoomRotate\.disableRotation\(\)/);
  assert.match(app, /easeTo\(/);
  assert.match(app, /dragstart/);
  assert.match(app, /zoomstart/);
  assert.doesNotMatch(app, /pointersRef/);
  assert.doesNotMatch(app, /pinchRef/);
});

test("foreground workflow and independent ambient city both render on the real map", () => {
  assert.match(engine, /StakeholderSide/);
  assert.match(demo, /CITY_NAMES/);
  assert.match(demo, /Other user agent/);
  assert.match(demo, /Business agent/);
  assert.match(demo, /Supplier agent/);
  assert.match(demo, /Logistics agent/);
  assert.match(demo, /cityLifeSnapshot/);
  assert.match(demo, /simulated:\s*true/);
  assert.match(app, /city-life-agents/);
  assert.match(app, /city-life-routes/);
  assert.match(app, /atlas-routes/);
  assert.match(app, /atlas-messages/);
  assert.match(app, /atlas-agents/);
});

test("visible demo workflow movement is forced even when semantic work starts at an agent home", () => {
  assert.match(demo, /forceFreshActiveTasksToTravel/);
  assert.match(demo, /pickVisibleOrigin/);
  assert.match(demo, /task\.status = "moving"/);
  assert.match(demo, /agent\.status = "moving"/);
  assert.match(demo, /resolveAtlasDemoApproval/);
});

test("WebMCP requests remain human-gated while the ambient city keeps moving", () => {
  assert.match(app, /document\.modelContext/);
  assert.match(app, /registerTool\(tool, \{ signal: controller\.signal \}\)/);
  assert.match(app, /asympta_observe_living_city/);
  assert.match(app, /asympta_list_workflows/);
  assert.match(app, /asympta_request_workflow/);
  assert.match(app, /asympta_request_external_action/);
  assert.match(app, /asympta_follow_agent/);
  assert.match(app, /Allow simulated action/);
  assert.match(engine, /requestWebMcpWorkflow/);
  assert.match(engine, /requestWebMcpAction/);
  assert.match(demo, /Background users and businesses are synthetic demonstration actors/);
});

test("original animal art uses inline SVG rather than OS emoji rendering", () => {
  assert.match(animalArt, /AnimalKind/);
  assert.match(animalArt, /cat/);
  assert.match(animalArt, /rabbit/);
  assert.match(animalArt, /fox/);
  assert.match(animalArt, /bear/);
  assert.match(animalArt, /raccoon/);
  assert.match(animalArt, /panda/);
  assert.match(animalArt, /dog/);
  assert.match(animalArt, /koala/);
  assert.match(animalArt, /owl/);
  assert.match(animalArt, /bird/);
  assert.match(animalArt, /<svg class="asympta-animal-svg"/);
  assert.doesNotMatch(animalArt, /🐱|🐰|🐶|🦊|🐻|🐼|🦝|🐨|🦉|🐧|🐦/u);
});

test("Asympta paper texture and lightweight controls stay calm on mobile", () => {
  assert.match(css, /--paper:\s*#EEEDE6/i);
  assert.match(css, /\.map-paper-wash/);
  assert.match(css, /\.map-paper-grain/);
  assert.match(css, /mix-blend-mode:\s*multiply/);
  assert.match(css, /\.animal-map-marker/);
  assert.match(css, /contain:\s*layout paint style/);
  assert.match(animalCss, /\.asympta-animal-svg/);
  assert.match(css, /grid-template-columns:\s*repeat\(4/);
  assert.match(css, /\.atlas-sheet-handle/);
  assert.match(css, /\.atlas-approval/);
  assert.match(css, /\.map-zoom/);
  assert.match(css, /touch-action:\s*none/);
  assert.match(css, /safe-area-inset/);
  assert.match(css, /prefers-reduced-motion/);
  assert.doesNotMatch(css, /image-rendering:\s*pixelated/i);
  assert.doesNotMatch(css, /image-rendering:\s*crisp-edges/i);
});
