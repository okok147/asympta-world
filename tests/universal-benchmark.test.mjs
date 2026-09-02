import assert from "node:assert/strict";
import test from "node:test";

import {
  generateKernelAdversarialScenarios,
  runKernelAdversarialBenchmark,
} from "../lib/asympta-kernel-adversarial-benchmark.ts";
import {
  generateKernelHoldoutScenarios,
  runKernelHoldoutBenchmark,
} from "../lib/asympta-kernel-holdout-benchmark.ts";
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

test("100 core cases and 5,000 stress mutations across ten seeds complete without human intervention", () => {
  const seeds = [20260831, 17, 42, 101, 997, 4093, 8191, 65537, 104729, 999983];
  let total = 0;
  let completed = 0;
  let stuck = 0;
  let interventions = 0;
  const failures = [];

  seeds.forEach((seed, index) => {
    const report = runUniversalBenchmark({
      coreCount: index === 0 ? 100 : 0,
      stressCount: 500,
      seed,
    });
    total += report.total;
    completed += report.completed;
    stuck += report.stuck;
    interventions += report.humanInterventions;
    failures.push(...report.core.failures, ...report.stress.failures);
    assert.equal(report.passed, true, `seed ${seed}: ${JSON.stringify(failures.slice(-10), null, 2)}`);
    if (index === 0) {
      assert.equal(report.domains.length >= 15, true);
      assert.equal(Object.keys(report.semantics).length >= 20, true);
    }
  });

  assert.equal(total, 5_100);
  assert.equal(completed, 5_100);
  assert.equal(stuck, 0, JSON.stringify(failures.slice(0, 10), null, 2));
  assert.equal(interventions, 0);
});

test("stress generation is deterministic and includes unseen fields and reordered requirements", () => {
  const first = generateUniversalStressCases({ count: 80, seed: 42 });
  const second = generateUniversalStressCases({ count: 80, seed: 42 });
  assert.deepEqual(first, second);
  assert.ok(first.some((entry) => entry.requiredFields?.some((field) => /novel|unseen|新型|未知/i.test(field))));
  assert.ok(first.some((entry) => entry.requiredFields?.some((field) => field.includes("_"))));
});

test("the independent 1,000-case kernel attack cannot regress while structural fixes are allowed to reduce failures", () => {
  const scenarios = generateKernelAdversarialScenarios();
  const report = runKernelAdversarialBenchmark();
  assert.equal(scenarios.length, 1_000);
  assert.equal(new Set(scenarios.map((scenario) => scenario.id)).size, 1_000);
  assert.deepEqual(new Set(scenarios.map((scenario) => scenario.locale)), new Set(["en", "zh-Hant", "ja"]));
  assert.equal(report.total, 1_000);

  console.log(`KERNEL_ATTACK_REPORT ${JSON.stringify({
    version: report.version,
    total: report.total,
    passed: report.passed,
    failed: report.failed,
    passRate: report.passRate,
    byFamily: report.byFamily,
  })}`);

  const failureCeilings = {
    explicit_fact_binding: 100,
    numeric_disambiguation: 100,
    currency_integrity: 100,
    sensitive_metadata: 90,
    write_approval_coverage: 100,
    domain_contract_coverage: 100,
    blocked_requirement_safety: 100,
    benchmark_false_pass: 100,
    positive_approval_control: 0,
    positive_explicit_control: 0,
  };

  for (const [family, ceiling] of Object.entries(failureCeilings)) {
    assert.equal(report.byFamily[family].total, 100);
    assert.ok(
      report.byFamily[family].failed <= ceiling,
      `${family} regressed beyond its measured failure ceiling: ${report.byFamily[family].failed} > ${ceiling}`,
    );
  }

  assert.equal(report.failed, 0, `Frozen kernel regression suite must stay fully green: ${report.failed} failures.`);
});

test("a fresh 1,000-case semantic holdout attacks composition, contradiction, authority, data class, provenance, and truthfulness", () => {
  const scenarios = generateKernelHoldoutScenarios();
  const report = runKernelHoldoutBenchmark();

  assert.equal(scenarios.length, 1_000);
  assert.equal(new Set(scenarios.map((scenario) => scenario.id)).size, 1_000);
  assert.deepEqual(new Set(scenarios.map((scenario) => scenario.locale)), new Set(["en", "zh-Hant", "ja"]));
  assert.equal(report.total, 1_000);
  for (const family of Object.values(report.byFamily)) assert.equal(family.total, 100);

  console.log(`KERNEL_HOLDOUT_V2_REPORT ${JSON.stringify({
    version: report.version,
    total: report.total,
    passed: report.passed,
    failed: report.failed,
    passRate: report.passRate,
    byFamily: report.byFamily,
  })}`);

  assert.equal(report.failed, 0, `Fresh semantic holdout must be fully green: ${JSON.stringify(report.failures.slice(0, 10), null, 2)}`);
});
