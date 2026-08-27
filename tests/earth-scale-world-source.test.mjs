import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

async function sources() {
  return Promise.all([
    readFile(path.join(root, "lib/earth-world.ts"), "utf8"),
    readFile(path.join(root, "components/earth-scale-world-runtime.tsx"), "utf8"),
    readFile(path.join(root, "app/template.tsx"), "utf8"),
  ]);
}

test("builds a planet-scale blank geolocation substrate from virtualized community cells", async () => {
  const [engine, runtime, template] = await sources();
  assert.match(engine, /GEO_CELL_DEGREES = 0\.01/);
  assert.match(engine, /cellFor\(/);
  assert.match(engine, /neighboringCells\(/);
  assert.match(engine, /projectIntoNeighborhood\(/);
  assert.match(engine, /haversineMeters\(/);
  assert.match(runtime, /Earth-scale blank geolocation world built only from community discovery/);
  assert.match(runtime, /UNDISCOVERED/);
  assert.match(runtime, /No imported POIs/);
  assert.match(runtime, /data-earth-world/);
  assert.match(runtime, /\.latent-city-layer/);
  assert.match(runtime, /\.community-layer/);
  assert.match(template, /<ClientEarthSharedWorld \/>/);
});

test("rewards people for uploading local store information and brightens places as information improves", async () => {
  const [engine, runtime] = await sources();
  assert.match(engine, /ContributorProfile/);
  assert.match(engine, /xpGain = 35/);
  assert.match(engine, /completeness/);
  assert.match(engine, /confidence/);
  assert.match(engine, /brightness/);
  assert.match(engine, /opportunityForPlace/);
  assert.match(runtime, /UPLOAD & BUILD/);
  assert.match(runtime, /Store Agent · 讀取資料/);
  assert.match(runtime, /Store Agent · 結構化/);
  assert.match(runtime, /ADD MISSING INFO · EARN XP/);
  assert.match(runtime, /brightness \{Math\.round\(selectedPlace\.brightness \* 100\)\}%/);
  assert.match(runtime, /input type="file" accept="image\/\*"/);
});

test("store agent has a real WebMCP path for turning human evidence or vision output into products and services", async () => {
  const [engine, runtime] = await sources();
  assert.match(engine, /extractCatalogFromDescription/);
  assert.match(engine, /processEvidence/);
  assert.match(runtime, /name: "earth_submit_local_evidence"/);
  assert.match(runtime, /name: "earth_process_submission"/);
  assert.match(runtime, /extractedCatalog/);
  assert.match(runtime, /imageDataUrl/);
  assert.match(runtime, /__ASYMPTA_EARTH_WEBMCP__/);
  assert.match(runtime, /modelContext\?\.registerTool/);
});

test("creates local jobs and lets Opportunity Mode split agent work from human physical work", async () => {
  const [engine, runtime] = await sources();
  assert.match(engine, /GeoOpportunity/);
  assert.match(engine, /agentTasks/);
  assert.match(engine, /humanTasks/);
  assert.match(engine, /Human handoff for:/);
  assert.match(engine, /status: needsHuman \? "human-needed" : "completed"/);
  assert.match(runtime, /AGENT SEARCH MODE/);
  assert.match(runtime, /Agent 執行可自動部分/);
  assert.match(runtime, /整理人類 Handoff/);
  assert.match(runtime, /POST LOCAL OPPORTUNITY/);
  assert.match(runtime, /name: "earth_search_opportunities"/);
  assert.match(runtime, /name: "earth_work_opportunity"/);
  assert.match(runtime, /name: "earth_post_opportunity"/);
});

test("agents can cross geolocation borders without importing default map routes", async () => {
  const [engine, runtime] = await sources();
  assert.match(engine, /activeCellId/);
  assert.match(engine, /moveAgentGeo/);
  assert.match(runtime, /跨越社區邊界/);
  assert.match(runtime, /不使用既有道路/);
  assert.match(runtime, /Long-distance transfer/);
  assert.match(runtime, /waitWorldArrival/);
  assert.match(runtime, /未完成到達/);
  assert.match(runtime, /name: "earth_travel_to"/);
  assert.doesNotMatch(runtime, /google maps|openstreetmap|mapbox/i);
});

test("does not fabricate a user's location when geolocation permission is absent", async () => {
  const [, runtime] = await sources();
  assert.match(runtime, /navigator\.geolocation\.getCurrentPosition/);
  assert.match(runtime, /Location permission was not granted · no location is fabricated/);
  assert.match(runtime, /Geolocation is unavailable in this browser/);
});
