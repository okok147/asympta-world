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

test("interactive popup surfaces expose explicit close controls plus Escape fallback", async () => {
  const [popup, template] = await Promise.all([
    readFile(path.join(root, "components/popup-dismiss-runtime.tsx"), "utf8"),
    readFile(path.join(root, "app/template.tsx"), "utf8"),
  ]);

  assert.match(popup, /\.places-directory-panel/);
  assert.match(popup, /\.route-visit-card/);
  assert.match(popup, /\.webmcp-scenario-picker/);
  assert.match(popup, /data-asympta-runtime-close="true"/);
  assert.match(popup, /Close places directory/);
  assert.match(popup, /Close comparison card/);
  assert.match(popup, /Close scenario picker/);
  assert.match(popup, /event\.key !== "Escape"/);
  assert.match(popup, /\[data-slot="sheet-close"\]/);
  assert.match(popup, /button\[aria-label\^="Close"\]/);
  assert.match(template, /<PopupDismissRuntime \/>/);
});

test("task completion creates a non-blocking celebration without replaying history", async () => {
  const [celebration, template] = await Promise.all([
    readFile(path.join(root, "components/task-celebration-runtime.tsx"), "utf8"),
    readFile(path.join(root, "app/template.tsx"), "utf8"),
  ]);

  assert.match(celebration, /asympta:task-process/);
  assert.match(celebration, /asympta:user-task-process/);
  assert.match(celebration, /status === "completed"/);
  assert.match(celebration, /progress < 100/);
  assert.match(celebration, /task-celebration-particle/);
  assert.match(celebration, /pointer-events: none/);
  assert.match(celebration, /prefers-reduced-motion/);
  assert.match(celebration, /missionsReadyRef\.current/);
  assert.match(celebration, /scenarioReadyRef\.current/);
  assert.match(template, /<TaskCelebrationRuntime \/>/);
});

test("Earth jobs panel scrolls independently from the draggable and zoomable world", async () => {
  const [jobs, template] = await Promise.all([
    readFile(path.join(root, "components/earth-jobs-usability-runtime.tsx"), "utf8"),
    readFile(path.join(root, "app/template.tsx"), "utf8"),
  ]);

  assert.match(jobs, /Opportunity Mode/);
  assert.match(jobs, /data-earth-jobs-panel/);
  assert.match(jobs, /overflow-y: auto/);
  assert.match(jobs, /touch-action: pan-y/);
  assert.match(jobs, /overscroll-behavior: contain/);
  assert.match(jobs, /panel\.addEventListener\("wheel"/);
  assert.match(jobs, /panel\.addEventListener\("pointerdown"/);
  assert.match(jobs, /event\.stopPropagation\(\)/);
  assert.doesNotMatch(jobs, /document\.addEventListener\("pointerdown".*true/);
  assert.match(template, /<EarthJobsUsabilityRuntime \/>/);
});
