import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

test("ships exactly ten selectable WebMCP AI simulation scenarios", async () => {
  const source = await readFile(path.join(root, "components/webmcp-scenario-runtime.tsx"), "utf8");
  const ids = [
    "breakfast-run",
    "weekly-groceries",
    "device-repair",
    "brand-launch-kit",
    "event-setup",
    "focus-learning-day",
    "support-automation",
    "print-campaign",
    "product-launch",
    "local-business-launch",
  ];
  for (const id of ids) assert.match(source, new RegExp('id: "' + id + '"'));
  const scenarioIds = [...source.matchAll(/\n\s{4}id: "([^"]+)",\n\s{4}title:/g)].map((match) => match[1]);
  assert.equal(scenarioIds.length, 10);
  assert.deepEqual(scenarioIds, ids);
});

test("scenario autocomplete attaches to the existing need composer and supports keyboard selection", async () => {
  const source = await readFile(path.join(root, "components/webmcp-scenario-runtime.tsx"), "utf8");
  assert.match(source, /\.need-composer/);
  assert.match(source, /input\[aria-label="What do you need\?"\]/);
  assert.match(source, /webmcp-scenario-picker/);
  assert.match(source, /type to filter/);
  assert.match(source, /ArrowDown/);
  assert.match(source, /ArrowUp/);
  assert.match(source, /event\.key === "Enter"/);
  assert.match(source, /event\.key === "Escape"/);
  assert.match(source, /setNativeInputValue/);
});

test("each simulation executes real mission and city WebMCP tool paths instead of a prerecorded animation", async () => {
  const source = await readFile(path.join(root, "components/webmcp-scenario-runtime.tsx"), "utf8");
  for (const tool of [
    "city_search_businesses",
    "city_inspect_business",
    "city_execute_action",
    "submit_user_goal",
  ]) {
    assert.match(source, new RegExp('tool: "' + tool + '"'));
  }
  assert.match(source, /__ASYMPTA_CITY_WEBMCP__/);
  assert.match(source, /__ASYMPTA_MISSION_WEBMCP__/);
  assert.match(source, /targetRegistry\.invoke\(step\.tool, step\.input\)/);
  assert.match(source, /asympta:user-task-process/);
  assert.match(source, /asympta-webmcp-scenario-run-v1/);
  assert.match(source, /inventory 與 services 已同步/);
  assert.doesNotMatch(source, /<video|play\(\)|setCurrentTime|pre.?recorded/i);
});

test("mounts the scenario harness alongside the real city and mission runtimes", async () => {
  const template = await readFile(path.join(root, "app/template.tsx"), "utf8");
  assert.match(template, /<LatentCityRuntime \/>/);
  assert.match(template, /<MissionSocietyRuntime \/>/);
  assert.match(template, /<TaskProcessRuntime \/>/);
  assert.match(template, /<WebMcpScenarioRuntime \/>/);
});
