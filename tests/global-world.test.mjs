import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  GLOBAL_CORRIDORS,
  GLOBAL_FLOWS,
  GLOBAL_MAX_RENDERED_VEHICLES_DESKTOP,
  GLOBAL_MAX_SHIPMENTS,
  GLOBAL_NODES,
  advanceGlobalWorld,
  createGlobalWorld,
  globalCorridorPolyline,
  globalFlowRealHours,
  globalMissionForWorkflow,
  globalWorldInvariantViolations,
  globalWorldSnapshot,
  selectGlobalVehicles,
} from "../lib/asympta-global-world.ts";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
const component = await readFile(new URL("../components/asympta-global-world.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/asympta-global-world.css", import.meta.url), "utf8");

test("global model spans world regions, resources, transport modes and real multi-leg supply chains", () => {
  assert.ok(new Set(GLOBAL_NODES.map((node) => node.country)).size >= 12);
  assert.ok(Math.min(...GLOBAL_NODES.map((node) => node.lon)) < -100);
  assert.ok(Math.max(...GLOBAL_NODES.map((node) => node.lon)) > 130);
  assert.ok(Math.min(...GLOBAL_NODES.map((node) => node.lat)) < -30);
  assert.ok(Math.max(...GLOBAL_NODES.map((node) => node.lat)) > 55);

  const resources = new Set(GLOBAL_FLOWS.map((flow) => flow.resource));
  assert.deepEqual([...resources].sort(), ["food", "material", "medicine", "merchandise", "power"]);
  const modes = new Set(GLOBAL_CORRIDORS.map((corridor) => corridor.mode));
  for (const mode of ["ship", "air", "rail", "truck", "van", "car", "grid"]) assert.ok(modes.has(mode));

  const dinner = GLOBAL_FLOWS.find((flow) => flow.id === "food-grain-tokyo");
  assert.ok(dinner);
  const dinnerModes = dinner.corridorIds.map((id) => GLOBAL_CORRIDORS.find((corridor) => corridor.id === id)?.mode);
  assert.deepEqual(dinnerModes, ["truck", "ship", "rail", "van", "car"]);
  assert.ok(globalFlowRealHours(dinner) > 250);

  const medicine = GLOBAL_FLOWS.find((flow) => flow.id === "medicine-europe-tokyo");
  assert.ok(medicine?.corridorIds.some((id) => GLOBAL_CORRIDORS.find((corridor) => corridor.id === id)?.mode === "air"));
});

test("world simulation conserves bounded state while producing delivery, cost, power and resilient rerouting", () => {
  let world = createGlobalWorld(42);
  assert.equal(world.shipments.length <= GLOBAL_MAX_SHIPMENTS, true);
  assert.deepEqual(globalWorldInvariantViolations(world), []);

  for (let index = 0; index < 720; index += 1) world = advanceGlobalWorld(world, 180);
  const snapshot = globalWorldSnapshot(world);
  assert.ok(snapshot.deliveredValue > 0);
  assert.ok(snapshot.operatingCost > 0);
  assert.ok(Number.isFinite(snapshot.powerBalanceMw));
  assert.ok(snapshot.reliability >= 92 && snapshot.reliability <= 100);
  assert.ok(snapshot.reroutes >= 1);
  assert.ok(snapshot.coldChainIntegrity >= 90);
  assert.deepEqual(globalWorldInvariantViolations(world), []);
});

test("render selection is level-of-detail bounded instead of scaling with every simulated shipment", () => {
  const world = createGlobalWorld();
  const overview = selectGlobalVehicles(world, { lon: 24, lat: 22 }, 1.35, GLOBAL_MAX_RENDERED_VEHICLES_DESKTOP, 90);
  assert.ok(overview.length <= GLOBAL_MAX_RENDERED_VEHICLES_DESKTOP);
  assert.ok(overview.every((vehicle) => ["ship", "air", "grid"].includes(vehicle.mode)));

  const regional = selectGlobalVehicles(world, { lon: 139.75, lat: 35.68 }, 6.5, 12, 90);
  assert.ok(regional.length <= 12);
  assert.ok(regional.every((vehicle) => ["rail", "truck", "van", "car", "air", "grid"].includes(vehicle.mode)));
});

test("global corridors use curved bounded polylines and workflow intent selects the matching world economy", () => {
  const air = globalCorridorPolyline("frankfurt-narita-air", 30);
  assert.equal(air.length, 31);
  assert.ok(air.every((point) => Number.isFinite(point.lon) && Number.isFinite(point.lat)));
  assert.ok(Math.max(...air.map((point) => point.lat)) > Math.max(50.04, 35.7767));
  assert.equal(globalMissionForWorkflow("Dinner Coordination"), "food");
  assert.equal(globalMissionForWorkflow("Launch Stock Orchestration"), "merchandise");
  assert.equal(globalMissionForWorkflow("Service Recovery Network"), "medicine");
  assert.equal(globalMissionForWorkflow("Custom Order Network"), "material");
});

test("legacy world-scale renderer remains bounded but is not mounted in the intention-first product", () => {
  assert.match(page, /AsymptaIntentWorld/);
  assert.doesNotMatch(page, /AsymptaGlobalWorld/);
  assert.doesNotMatch(layout, /asympta-global-world\.css/);
  assert.match(layout, /asympta-intent-world\.css/);
  assert.match(component, /__ASYMPTA_MAP__/);
  assert.match(component, /requestAnimationFrame/);
  assert.match(component, /GLOBAL_SIMULATION_STEP_MS/);
  assert.match(component, /GLOBAL_SOURCE_REFRESH_MS/);
  assert.match(component, /GLOBAL_CULL_REFRESH_MS/);
  assert.match(component, /GLOBAL_MAX_RENDERED_VEHICLES_MOBILE/);
  assert.match(component, /asympta_observe_global_supply_network/);
  assert.doesNotMatch(component, /createPortal/);
  assert.doesNotMatch(component, /new maplibregl\.Map|new GlobalMap/);
  assert.match(css, /data-asympta-scale="world"/);
  assert.match(css, /asympta-global-vehicle/);
  assert.match(css, /pointer-events: none !important/);
});
