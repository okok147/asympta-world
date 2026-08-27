import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

test("every completed local discovery immediately grows Places and appears in the directory", async () => {
  const [growth, discovery, template] = await Promise.all([
    readFile(path.join(root, "components/discovery-place-growth-runtime.tsx"), "utf8"),
    readFile(path.join(root, "components/community-discovery-builder-runtime.tsx"), "utf8"),
    readFile(path.join(root, "app/template.tsx"), "utf8"),
  ]);
  assert.match(discovery, /asympta:discovery-place-opened/);
  assert.match(discovery, /earth_process_submission/);
  assert.match(growth, /asympta-earth-world-v1/);
  assert.match(growth, /basePlaceCount\(\) \+ nextPlaces\.length/);
  assert.match(growth, /Places · \$\{total\}/);
  assert.match(growth, /Community discovered/);
  assert.match(growth, /is-earth-discovered/);
  assert.match(growth, /earth_travel_to/);
  assert.match(template, /<DiscoveryPlaceGrowthRuntime \/>/);
});

test("newly opened places get the small celebration and brightness pulse", async () => {
  const growth = await readFile(path.join(root, "components/discovery-place-growth-runtime.tsx"), "utf8");
  assert.match(growth, /\+1 place/);
  assert.match(growth, /is-community-opening/);
  assert.match(growth, /community-opening-glow/);
  assert.match(growth, /community-opening-halo/);
  assert.match(growth, /community-opening-pixels/);
  assert.match(growth, /box-shadow:-34px -24px/);
  assert.match(growth, /Date\.now\(\) \+ 9000/);
  assert.match(growth, /prefers-reduced-motion/);
});

test("all ten WebMCP scenarios gain a real multi-candidate comparison layer before execution", async () => {
  const [scenario, comparison, template] = await Promise.all([
    readFile(path.join(root, "components/webmcp-scenario-runtime.tsx"), "utf8"),
    readFile(path.join(root, "components/webmcp-comparison-router-runtime.tsx"), "utf8"),
    readFile(path.join(root, "app/template.tsx"), "utf8"),
  ]);
  const scenarioBlock = scenario.match(/const SCENARIOS: WebMcpScenario\[\] = \[([\s\S]*?)\n\];/)?.[1] ?? "";
  const ids = [...scenarioBlock.matchAll(/\n\s*id: "([^"]+)"/g)].map((match) => match[1]);
  assert.equal(ids.length, 10);
  assert.match(comparison, /__spatialWrapped/);
  assert.match(comparison, /__comparisonWrapped/);
  assert.match(comparison, /name === "city_execute_action"/);
  assert.match(comparison, /city_search_businesses/);
  assert.match(comparison, /city_inspect_business/);
  assert.match(comparison, /slice\(0, 4\)/);
  for (const signal of ["reputation", "price", "availability", "distance", "fit"]) assert.match(comparison, new RegExp(signal));
  assert.match(comparison, /cheap\|budget/);
  assert.match(comparison, /best\|quality/);
  assert.match(comparison, /near\|nearby/);
  assert.match(comparison, /選出最佳方案/);
  assert.match(comparison, /asympta:webmcp-comparison/);
  assert.match(comparison, /comparison: \{ selected:/);
  assert.match(template, /<WebMcpComparisonRouterRuntime \/>/);
  assert.ok(template.indexOf("<WebMcpComparisonRouterRuntime />") > template.indexOf("<AgentSpatialInteractionRuntime />"));
});
