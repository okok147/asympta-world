import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../components/asympta-world-experience.tsx", import.meta.url), "utf8");
const engine = await readFile(new URL("../lib/atlas-simulation.ts", import.meta.url), "utf8");
const css = await readFile(new URL("../app/asympta-restoration.css", import.meta.url), "utf8");

test("the product is a paper map-first coordination atlas", () => {
  assert.match(app, /data-map-app="true"/);
  assert.match(app, /data-map-style="paper-agent-coordination-atlas"/);
  assert.match(app, /Interactive paper map with autonomous stakeholder agent coordination/);
  assert.match(app, /Coordination Atlas/);
  assert.match(app, /Live coordination/);
  assert.match(app, /Zoom in/);
  assert.match(app, /Zoom out/);
  assert.match(app, /Recenter map/);
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

test("the new simulation is independent and multi-stakeholder", () => {
  assert.match(engine, /StakeholderSide/);
  assert.match(engine, /"user"/);
  assert.match(engine, /"customer"/);
  assert.match(engine, /"business"/);
  assert.match(engine, /"supplier"/);
  assert.match(engine, /"operations"/);
  assert.match(engine, /"finance"/);
  assert.match(engine, /"logistics"/);
  assert.match(engine, /"support"/);
  assert.match(engine, /custom-order/);
  assert.match(engine, /dinner-network/);
  assert.match(engine, /launch-stock/);
  assert.match(engine, /service-recovery/);
  assert.match(app, /atlas-routes/);
  assert.match(app, /atlas-messages/);
  assert.match(app, /atlas-agents/);
});

test("WebMCP tools are current and consequential requests are human-gated", () => {
  assert.match(app, /document\.modelContext/);
  assert.match(app, /registerTool\(tool, \{ signal: controller\.signal \}\)/);
  assert.match(app, /asympta_observe_coordination_atlas/);
  assert.match(app, /asympta_list_workflows/);
  assert.match(app, /asympta_request_workflow/);
  assert.match(app, /asympta_request_external_action/);
  assert.match(app, /asympta_follow_agent/);
  assert.match(app, /Allow simulated action/);
  assert.match(engine, /requestWebMcpWorkflow/);
  assert.match(engine, /requestWebMcpAction/);
  assert.match(engine, /queuedForHumanApproval|pending/);
});

test("Asympta paper texture stays calm despite the new workflow UI", () => {
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
