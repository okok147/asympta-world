import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../components/asympta-task-kernel-locale.tsx", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");

test("Task Kernel locale projection is mounted after the global locale layers", () => {
  assert.match(page, /import \{ AsymptaTaskKernelLocale \}/);
  assert.match(page, /<AsymptaGlobalLocale \/>\s*<AsymptaCompleteLocale \/>\s*<AsymptaTaskKernelLocale \/>/);
});

test("agent mesh dialogue, result, approval and verifier copy follow the selected language", () => {
  for (const marker of [
    "Retailer agents", "The coordinator", "The specialist agent mesh completed", "Approve the connected external action",
    "All required facts", "獨立驗證代理", "独立検証エージェント", "zh-Hant", "ja",
  ]) assert.ok(source.includes(marker), `missing Task Kernel surface: ${marker}`);
  assert.ok((source.match(/^  \[\//gm) ?? []).length >= 20);
});

test("dynamic Task Kernel conflicts and failures never leak raw protocol errors", () => {
  for (const marker of [
    "revision", "locked by a human confirmation", "was not found", "is already", "is not pending",
    "Task verification failed:", "No logical agent is registered for",
  ]) assert.ok(source.includes(marker), `missing dynamic error rule: ${marker}`);
  assert.match(source, /MutationObserver\(schedule\)/);
  assert.match(source, /dataset\.asymptaTaskKernelLocale/);
});
