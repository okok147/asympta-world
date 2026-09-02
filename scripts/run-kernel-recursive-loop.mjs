import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createInitialKernelRecursiveState,
  normalizeKernelRecursiveState,
  runRecursiveKernelLab,
} from "../lib/asympta-kernel-recursive-lab.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function argument(name, fallback = null) {
  const prefix = `--${name}=`;
  const entry = process.argv.find((value) => value.startsWith(prefix));
  return entry ? entry.slice(prefix.length) : fallback;
}

function integerArgument(name, fallback) {
  const value = Number(argument(name, String(fallback)));
  return Number.isFinite(value) ? Math.floor(value) : fallback;
}

async function loadState(statePath) {
  if (!statePath) return createInitialKernelRecursiveState();
  try {
    return normalizeKernelRecursiveState(JSON.parse(await readFile(statePath, "utf8")));
  } catch {
    return createInitialKernelRecursiveState();
  }
}

function percent(value) {
  return `${(value * 100).toFixed(2)}%`;
}

function summary(report) {
  const familyLines = Object.entries(report.families)
    .map(([family, value]) => `| ${family} | ${value.total} | ${value.completed} | ${value.controlledFailures} | ${value.uncontrolledFailures} |`)
    .join("\n");
  const attack = Object.entries(report.nextState.attackWeights)
    .sort((left, right) => right[1] - left[1])
    .map(([key, value]) => `${key}=${value.toFixed(3)}`)
    .join(", ");
  const repair = Object.entries(report.nextState.repairWeights)
    .sort((left, right) => right[1] - left[1])
    .map(([key, value]) => `${key}=${value.toFixed(3)}`)
    .join(", ");

  return `# Asympta Kernel Recursive Lab — generation ${report.generation}

Seed: \`${report.seed}\`

## Process integrity

- Cases: **${report.total}**
- Completed: **${report.completed}**
- Controlled / predictable failures: **${report.controlledFailures}**
- Uncontrolled failures: **${report.uncontrolledFailures}**
- Process integrity rate: **${percent(report.processIntegrityRate)}**
- Deterministic replay rate: **${percent(report.deterministicRate)}**
- New uncontrolled fingerprints: **${report.newUncontrolledFingerprints.length}**

A controlled failure is a valid terminal result. The lab only treats hangs, non-terminal stalls, nondeterminism, false completion, missing failure ownership/reason, or broken verification/handoff as kernel failures.

## Families

| Family | Total | Completed | Controlled failure | Uncontrolled |
| --- | ---: | ---: | ---: | ---: |
${familyLines}

## Adaptive weights

Attack curriculum: ${attack}

Repair priority: ${repair}

## Repair contract

The repair loop must optimize **uncontrolled process-integrity failures**, not completion rate. It must not turn a predictable refusal, missing capability, human clarification, approval boundary, bounded timeout, or other controlled terminal failure into invented success.
`;
}

async function main() {
  const count = Math.max(10, integerArgument("count", Number(process.env.KERNEL_LOOP_CASES ?? 320)));
  const seed = integerArgument("seed", Number(process.env.KERNEL_LOOP_SEED ?? Date.now()));
  const statePath = argument("state", process.env.KERNEL_LOOP_STATE_PATH ?? null);
  const outArgument = argument("out", process.env.KERNEL_LOOP_OUTPUT_DIR ?? ".kernel-loop-output");
  const outDir = path.resolve(root, outArgument);
  const state = await loadState(statePath);

  const report = runRecursiveKernelLab({
    count,
    seed,
    state,
    now: process.env.KERNEL_LOOP_NOW ?? Date.now(),
  });

  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(path.join(outDir, "state.json"), `${JSON.stringify(report.nextState, null, 2)}\n`, "utf8");
  await writeFile(
    path.join(outDir, "trajectories.jsonl"),
    `${report.trajectories.map((trajectory) => JSON.stringify(trajectory)).join("\n")}\n`,
    "utf8",
  );
  await writeFile(path.join(outDir, "summary.md"), summary(report), "utf8");
  await writeFile(
    path.join(outDir, "metrics.env"),
    [
      `KERNEL_LOOP_TOTAL=${report.total}`,
      `KERNEL_LOOP_COMPLETED=${report.completed}`,
      `KERNEL_LOOP_CONTROLLED_FAILURES=${report.controlledFailures}`,
      `KERNEL_LOOP_UNCONTROLLED_FAILURES=${report.uncontrolledFailures}`,
      `KERNEL_LOOP_PROCESS_INTEGRITY_RATE=${report.processIntegrityRate}`,
      `KERNEL_LOOP_DETERMINISTIC_RATE=${report.deterministicRate}`,
      `KERNEL_LOOP_GENERATION=${report.generation}`,
    ].join("\n") + "\n",
    "utf8",
  );

  console.log(JSON.stringify({
    version: report.version,
    generation: report.generation,
    seed: report.seed,
    total: report.total,
    completed: report.completed,
    controlledFailures: report.controlledFailures,
    uncontrolledFailures: report.uncontrolledFailures,
    processIntegrityRate: report.processIntegrityRate,
    deterministicRate: report.deterministicRate,
    output: path.relative(root, outDir),
  }));
}

await main();
