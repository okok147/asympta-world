import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { SCENARIOS, SCENARIO_ORDER } from "../lib/living-world/scenarios.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFile(path.join(root, relative), "utf8");

test("five scenario families retain the flagship 12-agent order economy", () => {
  assert.deepEqual(SCENARIO_ORDER, ["order", "dinner", "work", "shopping", "email"]);
  const order = SCENARIOS.order;
  assert.equal(order.agents.length, 12);
  assert.equal(order.tasks.length, 21);
  assert.equal(order.services.length, 10);
  assert.equal(order.journey?.length, 8);
  assert.equal(order.services.every((service) => service.mode === "simulated"), true);
  assert.match(order.result.disclosure.en, /No real order, charge, message or shipment occurred/i);
});

test("the map itself is now the primary UI and follows the original city-reference language", async () => {
  const [page, layout, app, css] = await Promise.all([
    read("app/page.tsx"),
    read("app/layout.tsx"),
    read("components/asympta-world-experience.tsx"),
    read("app/asympta-restoration.css"),
  ]);
  assert.match(page, /AsymptaWorldExperience/);
  assert.match(layout, /asympta-restoration\.css/);
  assert.match(css, /--aw-paper:\s*#eeede6/);
  assert.match(css, /--aw-blue-deep:\s*#566b9b/);
  assert.match(css, /\.aw-city-map__streets/);
  assert.match(css, /\.aw-city-map__major/);
  assert.match(css, /\.aw-city-map__block--red/);
  assert.match(css, /\.aw-language-menu/);
  assert.match(app, /CITY-SCALE LIVING WORLD/);
  assert.match(app, /Mori Paper Co\./);
  assert.match(app, /North Mill/);
  assert.match(app, /Harbour Courier/);
  assert.match(app, /aw-icon-button--language/);
  assert.match(app, />English</);
  assert.match(app, />繁體中文</);
});

test("personal, business, merchandising and supply actors share one continuous city", async () => {
  const [app, scenarios] = await Promise.all([
    read("components/asympta-world-experience.tsx"),
    read("lib/living-world/scenarios.ts"),
  ]);
  assert.match(app, /\/order/);
  assert.match(app, /SCENARIO_ORDER/);
  assert.match(app, /WorldSceneInner/);
  for (const term of ["Business receiving agent", "Merchandiser", "Warehouse", "Procurement", "Supplier", "Production", "Quality control", "Finance", "Carrier", "After-sales"]) {
    assert.ok(scenarios.includes(term), `missing stakeholder: ${term}`);
  }
  assert.match(scenarios, /Personal agent finds the store owner/);
  assert.match(scenarios, /Business agents confirm the order/);
});

test("movement and handoff choreography remain canonical engine state, not staged video", async () => {
  const [app, hook, engine] = await Promise.all([
    read("components/asympta-world-experience.tsx"),
    read("components/living-world/use-living-world.ts"),
    read("lib/living-world/engine.ts"),
  ]);
  assert.match(app, /useLivingWorld/);
  assert.match(app, /Same event state powers UI \+ WebMCP/);
  assert.match(hook, /asympta_observe_coordination/);
  assert.match(hook, /asympta_submit_need/);
  assert.match(hook, /asympta_request_action/);
  assert.match(engine, /CITY_SPAWNS/);
  assert.match(engine, /cityStreetWaypoint/);
  assert.match(engine, /dependentRecipients/);
  assert.match(engine, /AGENT_SPEED_PER_MS = 0\.0088/);
  assert.match(engine, /requiresApproval/);
  assert.match(engine, /kind:\s*"task"/);
});

test("literal pixel raster and real zoom camera are part of the product", async () => {
  const [app, css] = await Promise.all([read("components/asympta-world-experience.tsx"), read("app/asympta-restoration.css")]);
  assert.match(app, /PIXEL_MAP_WIDTH = 256/);
  assert.match(app, /<canvas[^>]+aw-pixel-city-map/);
  assert.match(app, /snapPoint/);
  assert.match(app, /onWheel=\{handleWheel\}/);
  assert.match(app, /onPointerDown=\{handlePointerDown\}/);
  assert.match(app, /aw-map-zoom/);
  assert.match(css, /image-rendering:\s*pixelated/);
  assert.match(css, /touch-action:\s*none/);
});

test("responsive, safe-area and reduced-motion rules remain explicit", async () => {
  const css = await read("app/asympta-restoration.css");
  for (const marker of ["@media (max-width: 1180px)", "@media (max-width: 900px)", "@media (max-width: 720px)", "@media (max-width: 430px)", "@media (max-height: 570px)", "@media (prefers-reduced-motion: reduce)", "env(safe-area-inset-top)", "env(safe-area-inset-bottom)"]) {
    assert.ok(css.includes(marker), `missing ${marker}`);
  }
});
