import assert from "node:assert/strict";
import test from "node:test";

import {
  KERNEL_ATTACK_FAMILIES,
  createInitialKernelRecursiveState,
  evaluateUniversalProcessTrajectory,
  generateRecursiveKernelCases,
  runRecursiveKernelLab,
} from "../lib/asympta-kernel-recursive-lab.ts";
import { runUniversalTask } from "../lib/asympta-universal-task-protocol.ts";

test("recursive case generation is deterministic and always covers every attack family", () => {
  const first = generateRecursiveKernelCases({ count: 80, seed: 260902 });
  const second = generateRecursiveKernelCases({ count: 80, seed: 260902 });

  assert.deepEqual(first, second);
  assert.equal(first.length, 80);
  for (const family of KERNEL_ATTACK_FAMILIES) {
    assert.ok(first.some((entry) => entry.family === family), `missing family ${family}`);
  }
});

test("controlled failures count as process-integrity success while completed cases require real multi-agent handoff and verification", () => {
  const report = runRecursiveKernelLab({
    count: 80,
    seed: 260903,
    state: createInitialKernelRecursiveState(),
    now: "2026-09-02T15:00:00.000Z",
  });

  assert.equal(report.uncontrolledFailures, 0);
  assert.equal(report.processIntegrityRate, 1);
  assert.equal(report.deterministicRate, 1);
  assert.ok(report.completed > 0);
  assert.ok(report.controlledFailures > 0);

  const noCapability = report.trajectories.find((entry) => entry.family === "controlled_no_capability");
  assert.ok(noCapability);
  assert.equal(noCapability.outcome, "controlled_failure");
  assert.equal(noCapability.processIntegrity, true);
  assert.equal(noCapability.terminalReason, "no_capability");
  assert.equal(noCapability.recovery, "reroute_or_add_capability");

  for (const trajectory of report.trajectories.filter((entry) => entry.outcome === "completed")) {
    assert.equal(trajectory.multiStakeholder, true);
    assert.ok(trajectory.stakeholders.length >= 4);
    assert.ok(trajectory.packetKinds.includes("handoff"));
    assert.ok(trajectory.packetKinds.includes("verification"));
    assert.ok(trajectory.packetKinds.includes("result"));
    assert.equal(trajectory.resultCompleted, true);
  }
});

test("false completion is an uncontrolled kernel failure even when both replays agree", () => {
  const caseInput = generateRecursiveKernelCases({ count: 20, seed: 260904 })
    .find((entry) => entry.family === "baseline_success");
  assert.ok(caseInput);

  const primary = runUniversalTask(caseInput.input);
  const replay = runUniversalTask(caseInput.input);
  primary.packets = primary.packets.filter((packet) => packet.kind !== "verification");
  replay.packets = replay.packets.filter((packet) => packet.kind !== "verification");

  const trajectory = evaluateUniversalProcessTrajectory(caseInput, primary, replay);
  assert.equal(primary.status, "completed");
  assert.equal(trajectory.outcome, "uncontrolled_failure");
  assert.equal(trajectory.processIntegrity, false);
});

test("nondeterministic replay is an uncontrolled failure, never an acceptable flaky success", () => {
  const caseInput = generateRecursiveKernelCases({ count: 20, seed: 260905 })
    .find((entry) => entry.family === "baseline_success");
  assert.ok(caseInput);

  const primary = runUniversalTask(caseInput.input);
  const replay = runUniversalTask(caseInput.input);
  assert.ok(replay.packets.length > 0);
  replay.packets[replay.packets.length - 1].summary += " nondeterministic mutation";

  const trajectory = evaluateUniversalProcessTrajectory(caseInput, primary, replay);
  assert.equal(trajectory.deterministic, false);
  assert.equal(trajectory.outcome, "uncontrolled_failure");
  assert.equal(trajectory.processIntegrity, false);
});

test("trajectory results recursively update bounded attack curriculum and repair priorities", () => {
  const initial = createInitialKernelRecursiveState();
  const report = runRecursiveKernelLab({
    count: 100,
    seed: 260906,
    state: initial,
    now: "2026-09-02T15:30:00.000Z",
  });

  assert.equal(report.nextState.generation, 1);
  assert.equal(report.nextState.totalCases, 100);
  assert.equal(report.nextState.lastRunAt, "2026-09-02T15:30:00.000Z");

  for (const weight of Object.values(report.nextState.attackWeights)) {
    assert.ok(weight >= 0.25 && weight <= 8);
  }
  for (const weight of Object.values(report.nextState.repairWeights)) {
    assert.ok(weight >= 0.25 && weight <= 8);
  }

  const next = runRecursiveKernelLab({
    count: 100,
    seed: 260907,
    state: report.nextState,
    now: "2026-09-02T16:00:00.000Z",
  });
  assert.equal(next.nextState.generation, 2);
  assert.equal(next.nextState.totalCases, 200);
});
