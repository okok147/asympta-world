import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

test("keeps thought dialogue above agents and task/status information below", async () => {
  const source = await readFile(path.join(root, "components/agent-spatial-interaction-runtime.tsx"), "utf8");
  assert.match(source, /\.business-thought,/);
  assert.match(source, /\.city-agent-thought,/);
  assert.match(source, /\.community-agent-thought/);
  assert.match(source, /bottom: calc\(100% \+ 8px\) !important/);
  assert.match(source, /\.task-process-bubble \{/);
  assert.match(source, /top: calc\(100% \+ 9px\) !important/);
  assert.match(source, /bottom: auto !important/);
  assert.match(source, /\.city-user-delta,/);
  assert.match(source, /top: calc\(100% \+ 58px\) !important/);
});

test("blocks city and community execution until Your Agent physically arrives", async () => {
  const source = await readFile(path.join(root, "components/agent-spatial-interaction-runtime.tsx"), "utf8");
  assert.match(source, /ARRIVAL_RADIUS = 36/);
  assert.match(source, /ARRIVAL_TIMEOUT_MS = 52000/);
  assert.match(source, /Math\.hypot\(position\.x - destination\.x, position\.y - destination\.y\)/);
  assert.match(source, /if \(distance <= ARRIVAL_RADIUS\)/);
  assert.match(source, /asympta:agent-motion-target/);
  assert.match(source, /RETARGET_INTERVAL_MS = 4800/);
  assert.match(source, /name === "city_execute_action"/);
  assert.match(source, /name === "community_execute_action"/);
  assert.match(source, /Action was not executed/);
  assert.match(source, /is-user-destination/);
  assert.match(source, /到達後才執行/);
});

test("captures inspector actions so direct UI clicks use the same spatial gate", async () => {
  const source = await readFile(path.join(root, "components/agent-spatial-interaction-runtime.tsx"), "utf8");
  assert.match(source, /\.city-inspector-action/);
  assert.match(source, /\.community-action/);
  assert.match(source, /document\.addEventListener\("click", onClick, true\)/);
  assert.match(source, /stopImmediatePropagation/);
  assert.match(source, /registry\.invoke\("city_execute_action"/);
  assert.match(source, /registry\.invoke\("community_execute_action"/);
});

test("ships a multi-bakery route planner with physical visits and product comparison", async () => {
  const source = await readFile(path.join(root, "components/agent-shopping-router-runtime.tsx"), "utf8");
  assert.match(source, /Morning Crumb/);
  assert.match(source, /Grain & Glow/);
  assert.match(source, /kind === "bakery"/);
  assert.match(source, /visitDestination/);
  assert.match(source, /逐間實地查看/);
  assert.match(source, /到店後才讀取產品 overview/);
  assert.match(source, /查看產品/);
  assert.match(source, /market_compare_bakeries/);
  assert.match(source, /market_buy_best_bread/);
  assert.match(source, /Preferred action when the user asks to buy bread/);
  assert.match(source, /bread\|bakery\|loaf\|麵包/);
});

test("ranks bakeries from user requirements and exposes Asympta Points", async () => {
  const source = await readFile(path.join(root, "components/agent-shopping-router-runtime.tsx"), "utf8");
  for (const signal of [
    "routeVisits",
    "routeSelections",
    "successfulPurchases",
    "repeatSelections",
    "reviews",
    "stockReliability",
  ]) {
    assert.match(source, new RegExp(signal));
  }
  assert.match(source, /baseReputation \* 0\.26/);
  assert.match(source, /routeSignal \* 0\.24/);
  assert.match(source, /reviews \* 0\.16/);
  assert.match(source, /market_review_store/);
  assert.match(source, /market_inspect_asympta_point/);
  assert.match(source, /asympta-point-badge/);
  assert.match(source, /AP \{store\.point\}/);
  assert.match(source, /budget:/);
  assert.match(source, /quality:/);
  assert.match(source, /nearby:/);
  assert.match(source, /healthy:/);
  assert.match(source, /fresh:/);
});

test("mounts spatial and shopping runtimes in the real world template", async () => {
  const template = await readFile(path.join(root, "app/template.tsx"), "utf8");
  assert.match(template, /<AgentSpatialInteractionRuntime \/>/);
  assert.match(template, /<AgentShoppingRouterRuntime \/>/);
  assert.match(template, /<LatentCityRuntime \/>/);
  assert.match(template, /<CommunityV2Runtime \/>/);
  assert.match(template, /<ContinuousAgentMotion \/>/);
});
