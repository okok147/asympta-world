import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

test("ships a second selectable territory that Your Agent crosses through the Earth travel path", async () => {
  const [territory, template] = await Promise.all([
    readFile(path.join(root, "components/territory-navigation-runtime.tsx"), "utf8"),
    readFile(path.join(root, "app/template.tsx"), "utf8"),
  ]);
  assert.match(territory, /Home Territory/);
  assert.match(territory, /Neighbour Territory/);
  assert.match(territory, /neighbourCellId/);
  assert.match(territory, /scale <= \.72/);
  assert.match(territory, /earth_travel_to/);
  assert.match(territory, /跨 Territory/);
  assert.match(territory, /進入 Territory/);
  assert.match(template, /<TerritoryNavigationRuntime \/>/);
});

test("the neighbour territory is not empty and uses normal Earth evidence and place processing", async () => {
  const territory = await readFile(path.join(root, "components/territory-navigation-runtime.tsx"), "utf8");
  assert.match(territory, /Neighbour Commons/);
  assert.match(territory, /East Pantry/);
  assert.match(territory, /earth_submit_local_evidence/);
  assert.match(territory, /earth_process_submission/);
  assert.match(territory, /pending local verification/);
  assert.match(territory, /asympta-neighbour-territory-seeded-v1/);
});

test("resident society remains alive in both demo territories", async () => {
  const territory = await readFile(path.join(root, "components/territory-navigation-runtime.tsx"), "utf8");
  assert.match(territory, /data-living-territory/);
  assert.match(territory, /\.latent-city-layer/);
  assert.match(territory, /\.community-layer/);
  assert.match(territory, /world-agent:not\(\.mission-user-agent\)/);
  assert.match(territory, /display:grid!important/);
});

test("top-left controls collapse into one quiet menu when idle", async () => {
  const territory = await readFile(path.join(root, "components/territory-navigation-runtime.tsx"), "utf8");
  assert.match(territory, /asympta-zoom-control/);
  assert.match(territory, /places-directory-control/);
  assert.match(territory, /earth-control/);
  assert.match(territory, /data-world-dock-open="false"/);
  assert.match(territory, /opacity:0!important/);
  assert.match(territory, /pointer-events:none!important/);
  assert.match(territory, /world-dock-toggle/);
  assert.match(territory, /DOCK_IDLE_MS = 6200/);
});
