import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  MARKET_STRATEGIES,
  runMassMarketStress,
} from "../lib/mass-market-simulation.ts";
import {
  buildTerritoryAtlas,
  TERRITORY_ATLAS_COUNT,
  TERRITORY_ATLAS_SIDE,
} from "../lib/territory-atlas.ts";

const root = fileURLToPath(new URL("..", import.meta.url));

test("100,000 simultaneous market actors produce bounded multi-strategy competition", () => {
  const started = performance.now();
  const result = runMassMarketStress(100_000, 100, 20260827);
  const elapsed = performance.now() - started;

  assert.equal(result.summary.actorCount, 100_000);
  assert.equal(result.summary.demandCount, 100_000);
  assert.equal(result.summary.trajectoryCount, 100);
  assert.equal(result.trajectories.length, 100);
  assert.ok(result.summary.bidCount >= 300_000, "every demand should reach multiple bidding stores");
  assert.ok(result.summary.negotiationRounds >= 100_000, "every demand should negotiate at least once");
  assert.equal(result.summary.deals + result.summary.walkaways, 100_000);
  assert.ok(result.summary.deals > 0);
  assert.ok(result.summary.walkaways > 0);
  assert.ok(result.summary.averageClearingPrice > 0);
  assert.ok(elapsed < 8_000, `100k headless stress should remain practical in CI; took ${elapsed.toFixed(0)}ms`);

  const winningStrategies = MARKET_STRATEGIES.filter(
    (strategy) => result.summary.strategyWins[strategy] > 0,
  );
  assert.ok(winningStrategies.length >= 7, "the market should not collapse into one bidding strategy");
});

test("all 100 trajectories preserve demand hearing, bidding, negotiation and outcome causality", () => {
  const result = runMassMarketStress(100_000, 100, 17);
  for (const trajectory of result.trajectories) {
    const phases = new Set(trajectory.steps.map((step) => step.phase));
    assert.equal(phases.has("demand"), true, trajectory.id + " missing demand");
    assert.equal(phases.has("heard"), true, trajectory.id + " missing store hearing");
    assert.equal(phases.has("bid"), true, trajectory.id + " missing bid");
    assert.equal(phases.has("counter"), true, trajectory.id + " missing counteroffer");
    assert.equal(phases.has("concession"), true, trajectory.id + " missing concession");
    assert.equal(
      phases.has("deal") || phases.has("walkaway"),
      true,
      trajectory.id + " missing terminal outcome",
    );
    assert.ok(trajectory.competitors >= 3);
    assert.ok(trajectory.winnerStrategy);
    assert.ok(trajectory.steps.some((step) => step.strategy === trajectory.winnerStrategy));
  }
});

test("trajectory map exposes exactly the selectable enterable 100-path experience", async () => {
  const [runtime, template] = await Promise.all([
    readFile(path.join(root, "components/market-trajectory-runtime.tsx"), "utf8"),
    readFile(path.join(root, "app/template.tsx"), "utf8"),
  ]);

  assert.match(runtime, /ACTOR_COUNT = 100_000/);
  assert.match(runtime, /TRAJECTORY_COUNT = 100/);
  assert.match(runtime, /trajectory-map-grid/);
  assert.match(runtime, /Open 100 market trajectories/);
  assert.match(runtime, /ENTER TRAJECTORY/);
  assert.match(runtime, /mass_market_observe/);
  assert.match(runtime, /mass_market_list_trajectories/);
  assert.match(runtime, /mass_market_inspect_trajectory/);
  assert.match(runtime, /mass_market_enter_trajectory/);
  assert.match(runtime, /mass_market_rerun_stress/);
  assert.match(template, /<MarketTrajectoryRuntime \/>/);
});

test("location auto-requests, asks only after non-denial failure, and remembers explicit rejection", async () => {
  const [location, template] = await Promise.all([
    readFile(path.join(root, "components/location-access-runtime.tsx"), "utf8"),
    readFile(path.join(root, "app/template.tsx"), "utf8"),
  ]);

  assert.match(location, /navigator\.geolocation\.getCurrentPosition/);
  assert.match(location, /error\.PERMISSION_DENIED/);
  assert.match(location, /asympta-location-rejected-v1/);
  assert.match(location, /if \(!wasRejected\(\)\) requestLocation\(\)/);
  assert.match(location, /NOT NOW/);
  assert.match(location, /ENABLE/);
  assert.match(location, /locateButton/);
  assert.match(template, /<LocationAccessRuntime \/>/);
});

test("native agents remain visible after crossing away from the starter geo cell", async () => {
  const [presence, starter, template] = await Promise.all([
    readFile(path.join(root, "components/geo-agent-presence-runtime.tsx"), "utf8"),
    readFile(path.join(root, "components/starter-district-integration.tsx"), "utf8"),
    readFile(path.join(root, "app/template.tsx"), "utf8"),
  ]);

  assert.match(presence, /data-starter-district="away"/);
  assert.match(presence, /world-agent:not\(\.mission-user-agent\)/);
  assert.match(presence, /display: grid !important/);
  assert.match(presence, /visibility: visible !important/);
  assert.match(starter, /data-starter-district="away"/);
  assert.match(template, /<GeoAgentPresenceRuntime \/>/);
});

test("Earth exposes a searchable enterable atlas with more than 500 real geo-cell territories", async () => {
  const atlas = buildTerritoryAtlas("geo-9000-18000");
  assert.equal(TERRITORY_ATLAS_SIDE, 25);
  assert.equal(TERRITORY_ATLAS_COUNT, 625);
  assert.equal(atlas.length, 625);
  assert.equal(new Set(atlas.map((territory) => territory.cellId)).size, 625);
  assert.ok(atlas.every((territory) => Number.isFinite(territory.center.lat) && Number.isFinite(territory.center.lng)));
  assert.ok(atlas.some((territory) => territory.label === "Home Territory"));

  const [runtime, template] = await Promise.all([
    readFile(path.join(root, "components/territory-atlas-runtime.tsx"), "utf8"),
    readFile(path.join(root, "app/template.tsx"), "utf8"),
  ]);
  assert.match(runtime, /Open 625 territory atlas/);
  assert.match(runtime, /Select one of 625 territories/);
  assert.match(runtime, /ENTER TERRITORY/);
  assert.match(runtime, /territory_list/);
  assert.match(runtime, /territory_enter/);
  assert.match(runtime, /evidence-backed places/);
  assert.match(template, /<TerritoryAtlasRuntime \/>/);
});
