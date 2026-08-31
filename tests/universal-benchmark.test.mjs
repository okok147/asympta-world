import assert from "node:assert/strict";
import test from "node:test";

import {
  generateUniversalStressCases,
  generateUniversalUseCases,
  runUniversalBenchmark,
} from "../lib/asympta-universal-benchmark.ts";

test("the core benchmark generates 100 real-life cases across 25 archetypes instead of hand-writing 100 workflows", () => {
  const cases = generateUniversalUseCases(100);
  assert.equal(cases.length, 100);
  assert.equal(new Set(cases.map((entry) => entry.archetypeId)).size, 25);
  assert.equal(new Set(cases.map((entry) => entry.domain)).size >= 15, true);
  assert.deepEqual(new Set(cases.map((entry) => entry.locale)), new Set(["en", "zh-Hant", "ja"]));
  assert.equal(cases.every((entry) => entry.mode === "benchmark" && entry.preauthorized === true), true);
});

test("all 100 core cases and 500 stress mutations complete without human intervention", () => {
  const report = runUniversalBenchmark({ coreCount: 100, stressCount: 500, seed: 20260831 });
  assert.equal(report.core.total, 100);
  assert.equal(report.stress.total, 500);
  assert.equal(report.completed, 600);
  assert.equal(report.stuck, 0, JSON.stringify([...report.core.failures, ...report.stress.failures].slice(0, 10), null, 2));
  assert.equal(report.humanInterventions, 0);
  assert.equal(report.passed, true);
  assert.equal(report.domains.length >= 15, true);
  assert.equal(Object.keys(report.semantics).length >= 20, true);
});

test("stress generation is deterministic and includes unseen fields and reordered requirements", () => {
  const first = generateUniversalStressCases({ count: 80, seed: 42 });
  const second = generateUniversalStressCases({ count: 80, seed: 42 });
  assert.deepEqual(first, second);
  assert.ok(first.some((entry) => entry.requiredFields?.some((field) => /novel|unseen|新型|未知/i.test(field))));
  assert.ok(first.some((entry) => entry.requiredFields?.some((field) => field.includes("_"))));
});
