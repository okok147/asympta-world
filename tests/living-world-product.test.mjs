import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../components/asympta-world-live-demo.tsx", import.meta.url), "utf8");
const engine = await readFile(new URL("../lib/atlas-simulation.ts", import.meta.url), "utf8");
const demo = await readFile(new URL("../lib/atlas-demo.ts", import.meta.url), "utf8");
const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/asympta-restoration.css", import.meta.url), "utf8");

test("the product boots directly into a paper living-city demonstration", () => {
  assert.match(page, /AsymptaWorldLiveDemo/);
  assert.match(app, /data-map-app="true"/);
  assert.match(app, /data-map-style="paper-living-city-demo"/);
  assert.match(app, /Interactive paper map with autonomous stakeholder agents and simulated city activity/);
  assert.match(app, /Living Coordination Atlas/);
  assert.match(app, /createAtlasDemoWorld/);
  assert.match(app, /CITY_LIFE_COUNT/);
  assert.match(app, /ambient actors moving/);
  assert.match(app, /workflow agents moving/);
  assert.doesNotMatch(app, /useLivingWorld/);
  assert.doesNotMatch(app, /@\/lib\/living-world/);
});

test("native MapLibre pinch and camera follow remain first-class", () => {
  assert.match(app, /maplibre-gl@5/);
  assert.match(app, /touchZoomRotate\.enable\(\)/);
  assert.match(app, /touchZoomRotate\.disableRotation\(\)/);
  assert.match(app, /easeTo\(/);
  assert.match(app, /Tracking agent/);
  assert.match(app, /Follow agent/);
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

test("Asympta paper texture stays calm despite the living simulation", () => {
  assert.match(css, /--paper:\s*#EEEDE6/i);
  assert.match(css, /\.map-paper-wash/);
  assert.match(css, /\.map-paper-grain/);
  assert.match(css, /mix-blend-mode:\s*multiply/);
  assert.match(css, /\.atlas-console/);
  assert.match(css, /\.atlas-agent-card/);
  assert.match(css, /\.atlas-approval/);
  assert.match(css, /\.map-zoom/);
  assert.match(css, /touch-action:\s*none/);
  assert.match(css, /safe-area-inset/);
  assert.match(css, /prefers-reduced-motion/);
  assert.doesNotMatch(css, /image-rendering:\s*pixelated/i);
  assert.doesNotMatch(css, /image-rendering:\s*crisp-edges/i);
});
