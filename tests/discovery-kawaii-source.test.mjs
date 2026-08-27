import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

async function read(relative) {
  return readFile(path.join(root, relative), "utf8");
}

test("renders every selectable animal through the same full kawaii badge art language", async () => {
  const [catalog, badge, runtime, starter] = await Promise.all([
    read("lib/animal-catalog.ts"),
    read("lib/kawaii-animal-badge.ts"),
    read("components/animal-avatar-runtime.tsx"),
    read("components/starter-district-integration.tsx"),
  ]);
  const ids = catalog.match(/"[a-z-]+"/g)?.slice(0, 100) ?? [];
  assert.equal(ids.length, 100);
  assert.match(badge, /animalBadgeSvg/);
  assert.match(badge, /animalBadgeDataUri/);
  assert.match(badge, /<circle cx=\"32\" cy=\"32\" r=\"30\"/);
  assert.match(badge, /bandana/);
  assert.match(badge, /blush/);
  assert.match(badge, /MASKED/);
  assert.match(badge, /STRIPED/);
  assert.match(badge, /SPOTTED/);
  assert.match(badge, /ANTLERED/);
  assert.match(badge, /TENTACLED/);
  assert.match(runtime, /animalBadgeDataUri\(animal\)/);
  assert.match(runtime, /--animal-badge-image/);
  assert.match(runtime, /<img src=\{animalBadgeDataUri\(item\.id\)\}/);
  assert.match(runtime, /Choose from 100 kawaii badge animal agents/);
  assert.match(runtime, /background-image:var\(--animal-badge-image\)!important/);
  assert.match(runtime, /community-agent\[data-animal-id\]/);
  assert.match(runtime, /city-agent\[data-animal-id\]/);
  assert.match(starter, /width:44px!important; height:44px!important/);
  assert.match(starter, /\.city-agent,\.community-agent \{ width:30px!important; height:30px!important; \}/);
  assert.match(starter, /display:none!important; content:none!important/);
});

test("discovers and builds missing services and facilities as a first-class Earth workflow", async () => {
  const [engine, runtime, template] = await Promise.all([
    read("lib/community-discovery.ts"),
    read("components/community-discovery-builder-runtime.tsx"),
    read("app/template.tsx"),
  ]);
  assert.match(engine, /DiscoveryKind/);
  assert.match(engine, /"service" \| "facility" \| "community"/);
  assert.match(engine, /discoverCommunityGap/);
  assert.match(engine, /Neighbour Tool Library/);
  assert.match(engine, /Neighbour Care Desk/);
  assert.match(engine, /Shared Kitchen Table/);
  assert.match(engine, /pending local verification/);
  assert.match(engine, /proposalDescription/);
  assert.match(runtime, /Discover & Build/);
  assert.match(runtime, /DISCOVER GAP/);
  assert.match(runtime, /LET AGENT BUILD/);
  assert.match(runtime, /AUTO \{auto \? "ON" : "OFF"\}/);
  assert.match(runtime, /AUTO_FIRST_DELAY = 58_000/);
  assert.match(runtime, /AUTO_COOLDOWN = 4 \* 60_000/);
  assert.match(runtime, /MAX_AUTO_OPENINGS = 4/);
  assert.match(runtime, /earth_submit_local_evidence/);
  assert.match(runtime, /earth_process_submission/);
  assert.match(runtime, /earth_search_opportunities/);
  assert.match(runtime, /community-created/);
  assert.match(runtime, /pending local verification/);
  assert.match(runtime, /is-community-opening/);
  assert.match(template, /<CommunityDiscoveryBuilderRuntime \/>/);
});

test("exposes discovery through WebMCP and preserves human verification for physical truth", async () => {
  const runtime = await read("components/community-discovery-builder-runtime.tsx");
  for (const tool of [
    "earth_discover_service_gap",
    "earth_observe_discovery_projects",
    "earth_start_discovery_project",
    "earth_build_discovery_project",
  ]) assert.match(runtime, new RegExp(`name: "${tool}"`));
  assert.match(runtime, /__ASYMPTA_DISCOVERY_WEBMCP__/);
  assert.match(runtime, /modelContext\?\.registerTool/);
  assert.match(runtime, /Physical-world truth still needs human evidence/);
  assert.match(runtime, /does not fabricate an existing real-world POI/);
  assert.doesNotMatch(runtime, /google maps|openstreetmap|mapbox/i);
});

test("discovery panel participates in collision-free mobile UI coordination", async () => {
  const starter = await read("components/starter-district-integration.tsx");
  const runtime = await read("components/community-discovery-builder-runtime.tsx");
  assert.match(starter, /\.discovery-builder-panel/);
  assert.match(starter, /return "discovery"/);
  assert.match(starter, /data-asympta-overlay=\"discovery\"/);
  assert.match(starter, /\.need-composer \{ z-index:136!important; \}/);
  assert.match(runtime, /data-discovery-builder-open/);
  assert.match(runtime, /max-height:calc\(100svh - 300px\)/);
  assert.match(runtime, /html\[data-discovery-builder-open=\"true\"\] \.earth-panel/);
});
