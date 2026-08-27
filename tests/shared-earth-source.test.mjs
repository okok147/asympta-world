import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

test("keeps global Earth places, evidence and opportunities in shared D1 authority", async () => {
  const [store, route] = await Promise.all([
    readFile(path.join(root, "db/earth-store.ts"), "utf8"),
    readFile(path.join(root, "app/api/earth/route.ts"), "utf8"),
  ]);
  assert.match(store, /EARTH_WORLD_ID = "asympta-earth-community"/);
  assert.match(store, /world_snapshots/);
  assert.match(store, /mergeSharedEarth/);
  assert.match(store, /updatedAt >= current\.updatedAt/);
  assert.match(store, /imageDataUrl\.length <= 150_000/);
  assert.match(route, /getSharedEarth/);
  assert.match(route, /mergeIntoSharedEarth/);
  assert.match(route, /persistence: "d1-shared"/);
  assert.match(route, /text\.length > 500_000/);
});

test("does not put private user location, agent state or personal XP into the shared Earth snapshot", async () => {
  const store = await readFile(path.join(root, "db/earth-store.ts"), "utf8");
  const sharedType = store.slice(store.indexOf("export type EarthSharedState"), store.indexOf("type SnapshotRow"));
  assert.match(sharedType, /places: GeoPlace\[\]/);
  assert.match(sharedType, /evidence: GeoEvidence\[\]/);
  assert.match(sharedType, /opportunities: GeoOpportunity\[\]/);
  assert.doesNotMatch(sharedType, /userLocation/);
  assert.doesNotMatch(sharedType, /contributor/);
  assert.doesNotMatch(sharedType, /agent:/);
});

test("uses shared Earth when the API exists and a transparent local mirror on static Pages", async () => {
  const [client, template] = await Promise.all([
    readFile(path.join(root, "components/client-earth-shared-world.tsx"), "utf8"),
    readFile(path.join(root, "app/template.tsx"), "utf8"),
  ]);
  assert.match(client, /fetch\("\/api\/earth"/);
  assert.match(client, /"d1-shared"/);
  assert.match(client, /"local-mirror"/);
  assert.match(client, /SHARED/);
  assert.match(client, /LOCAL/);
  assert.match(client, /12000/);
  assert.match(client, /2400/);
  assert.match(client, /mergeRemote/);
  assert.match(template, /<ClientEarthSharedWorld \/>/);
  assert.doesNotMatch(template, /<EarthScaleWorldRuntime \/>/);
});
