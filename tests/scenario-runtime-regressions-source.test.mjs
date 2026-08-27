import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

test("legacy city snapshots repair singular product/service objects before LatentCityRuntime loads", async () => {
  const [guard, template] = await Promise.all([
    readFile(path.join(root, "components/city-schema-guard-runtime.tsx"), "utf8"),
    readFile(path.join(root, "app/template.tsx"), "utf8"),
  ]);

  assert.match(guard, /useLayoutEffect/);
  assert.match(guard, /business\.products \?\? business\.product \?\? business\.items/);
  assert.match(guard, /business\.services \?\? business\.service/);
  assert.match(guard, /function collection\(value/);
  assert.match(guard, /Array\.isArray\(value\)/);
  assert.match(guard, /Object\.values\(row\)/);
  assert.match(guard, /products: normalizeProducts\(productsSource\)/);
  assert.match(guard, /services: normalizeServices\(servicesSource\)/);
  assert.doesNotMatch(guard, /\.product\s*\(/);
  assert.ok(template.indexOf("<CitySchemaGuardRuntime />") < template.indexOf("<LatentCityRuntime />"));
});

test("WebMCP scenario input clears after both completion and failure", async () => {
  const [cleanup, template] = await Promise.all([
    readFile(path.join(root, "components/scenario-input-cleanup-runtime.tsx"), "utf8"),
    readFile(path.join(root, "app/template.tsx"), "utf8"),
  ]);

  assert.match(cleanup, /Scenario 完成/);
  assert.match(cleanup, /Scenario 暫停/);
  assert.match(cleanup, /setNativeInputValue\(input, ""\)/);
  assert.match(cleanup, /dispatchEvent\(new Event\("input"/);
  assert.match(cleanup, /requestAnimationFrame\(clearScenarioInput\)/);
  assert.match(template, /<ScenarioInputCleanupRuntime \/>/);
});
