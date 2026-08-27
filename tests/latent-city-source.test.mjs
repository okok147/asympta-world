import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

test("ships a ten-business latent city with one hundred resident agents", async () => {
  const source = await readFile(path.join(root, "lib/latent-city.ts"), "utf8");
  for (const business of [
    "corner-cafe","market-grocer","hearth-bakery","pixel-repair","soft-form-studio",
    "tiny-print","swift-courier","little-learning","quiet-desk","loop-lab",
  ]) assert.match(source, new RegExp('"' + business + '"'));
  assert.match(source, /seedCityAgents\(now = Date\.now\(\), count = 100\)/);
  assert.match(source, /ownerId: "resident-user-/);
  assert.match(source, /traits: \{/);
  assert.match(source, /memory: \[\]/);
  assert.match(source, /chooseBusinessForAgent/);
  assert.match(source, /thriftPenalty/);
  assert.match(source, /distancePenalty/);
  assert.match(source, /familiarity/);
  assert.match(source, /executeCityAction/);
  assert.match(source, /externalInventory/);
  assert.match(source, /externalResources/);
  assert.match(source, /externalServices/);
  assert.match(source, /actorDelta/);
  assert.match(source, /businessDelta/);
  assert.match(source, /item\.stock -= quantity/);
  assert.match(source, /businessState\.treasury \+= credits/);
});

test("renders subtle generative businesses, living agents, inventory deltas and an on-demand inspector", async () => {
  const source = await readFile(path.join(root, "components/latent-city-runtime.tsx"), "utf8");
  assert.match(source, /linePaths\(business\.seed\)/);
  assert.match(source, /latent-business/);
  assert.match(source, /latent-city-streets/);
  assert.match(source, /city-agent/);
  assert.match(source, /CITY_AGENT_COUNT = 100/);
  assert.match(source, /BEHAVIOR_BATCH = 10/);
  assert.match(source, /requestAnimationFrame\(animate\)/);
  assert.match(source, /city-business-inspector/);
  assert.match(source, /city-business-delta/);
  assert.match(source, /city-user-delta/);
  assert.match(source, /transaction\.actorDelta/);
  assert.match(source, /transaction\.businessDelta/);
  assert.match(source, /Products/);
  assert.match(source, /Services/);
  assert.match(source, /Actions · WebMCP/);
});

test("exposes four generic city WebMCP tools using the same transaction engine", async () => {
  const source = await readFile(path.join(root, "components/latent-city-runtime.tsx"), "utf8");
  for (const tool of ["city_search_businesses","city_inspect_business","city_list_actions","city_execute_action"]) {
    assert.match(source, new RegExp('name: "' + tool + '"'));
  }
  assert.match(source, /__ASYMPTA_CITY_WEBMCP__/);
  assert.match(source, /modelContext\?\.registerTool/);
  assert.match(source, /agentId='your-agent'/);
  assert.match(source, /executeCityAction\(/);
  assert.match(source, /ownershipRoot/);
});

test("keeps dialogue semantic but compact in Traditional Chinese", async () => {
  const source = await readFile(path.join(root, "components/semantic-dialogue-labels.tsx"), "utf8");
  for (const label of ["尋找食物","接受交易","交換技能","尋找協助","交易資源","執行任務","補充能量"]) {
    assert.match(source, new RegExp(label));
  }
});

test("adds a cryptographically hash-chained ownership ledger with an optional L2 anchor adapter", async () => {
  const source = await readFile(path.join(root, "lib/verifiable-ownership-ledger.ts"), "utf8");
  assert.match(source, /crypto\.subtle\.digest\("SHA-256"/);
  assert.match(source, /previousHash/);
  assert.match(source, /appendOwnershipTransaction/);
  assert.match(source, /verifyOwnershipLedger/);
  assert.match(source, /OwnershipAnchorAdapter/);
  assert.match(source, /mode: "evm-l2"/);
  assert.match(source, /anchorOwnershipLedger/);
});

test("mounts the latent city without replacing mission society or user controls", async () => {
  const source = await readFile(path.join(root, "app/template.tsx"), "utf8");
  assert.match(source, /<LatentCityRuntime \/>/);
  assert.match(source, /<MissionSocietyRuntime \/>/);
  assert.match(source, /<AgentTaskMenu \/>/);
  assert.match(source, /<UserAgentAura \/>/);
  assert.match(source, /<SemanticDialogueLabels \/>/);
});
