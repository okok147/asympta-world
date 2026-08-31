import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  answerTaskRequirement,
  applyAsymptaAgentPatch,
  approveAsymptaTask,
  AsymptaTaskKernelError,
  createAsymptaTask,
  nextTaskRequirement,
  taskToAdaptiveInteractionSchema,
} from "../lib/asympta-task-kernel.ts";

function answer(task, requirement, value, label, commandId) {
  return answerTaskRequirement(task, {
    commandId,
    taskId: task.taskId,
    requirementId: requirement.id,
    expectedRevision: task.revision,
    value,
    label,
    actorId: "human",
    now: "2026-08-31T10:30:00.000Z",
  });
}

test("Task Kernel repairs broad television language into stable atomic requirements", () => {
  const task = createAsymptaTask({
    activityId: "activity-tv-kernel-1",
    rootIntent: "Buy a television with a premium budget",
    locale: "zh-Hant",
    missingFields: ["尚需確認其他必要規格以提供合適建議。"],
    mode: "simulated",
    now: "2026-08-31T10:30:00.000Z",
  });

  assert.equal(task.version, "asympta.task/0.3");
  assert.equal(task.revision, 1);
  assert.equal(task.phase, "awaiting_human");
  assert.deepEqual(task.requirements.map((requirement) => requirement.key), [
    "screen_size",
    "brand",
    "delivery_location",
  ]);
  assert.equal(nextTaskRequirement(task)?.key, "screen_size");
  assert.equal(task.rootIntent.raw, "Buy a television with a premium budget");
});

test("typed answerRequirement advances revisions without reinterpreting natural language", () => {
  let task = createAsymptaTask({
    activityId: "activity-tv-kernel-2",
    rootIntent: "Buy a television",
    locale: "zh-Hant",
    missingFields: ["screen size", "brand preference", "delivery location"],
    mode: "simulated",
    now: "2026-08-31T10:31:00.000Z",
  });
  const rootIntent = task.rootIntent.raw;

  task = answer(task, nextTaskRequirement(task), "55-inch", "55″", "answer-size");
  assert.equal(task.revision, 2);
  assert.equal(nextTaskRequirement(task)?.key, "brand");
  assert.equal(task.rootIntent.raw, rootIntent);
  assert.equal(task.requirements[0].lockedBy, "human");

  task = answer(task, nextTaskRequirement(task), "sony", "Sony", "answer-brand");
  assert.equal(nextTaskRequirement(task)?.key, "delivery_location");

  task = answer(task, nextTaskRequirement(task), "saved_home", "常用住址", "answer-delivery");
  assert.equal(task.phase, "completed");
  assert.equal(task.result?.completed, true);
  assert.equal(task.result?.simulated, true);
  assert.equal(task.rootIntent.raw, rootIntent);
  assert.ok(task.assignments.some((assignment) => assignment.agentId === "intent-interpreter"));
  assert.ok(task.assignments.some((assignment) => assignment.agentId === "commerce-electronics-specialist"));
  assert.ok(task.assignments.some((assignment) => assignment.agentId === "retailer-search-agent"));
  assert.ok(task.assignments.some((assignment) => assignment.agentId === "logistics-agent"));
  assert.ok(task.assignments.some((assignment) => assignment.agentId === "independent-verifier"));
  assert.ok(task.assignments.length <= task.limits.maxAssignments);
  assert.ok(task.assignments.every((assignment) => assignment.depth <= task.limits.maxDelegationDepth));
  assert.ok(task.events.some((event) => event.kind === "task_completed"));
});

test("stale revisions are rejected and command ids are idempotent", () => {
  const initial = createAsymptaTask({
    rootIntent: "Buy a television",
    locale: "en",
    missingFields: ["screen size", "brand preference"],
    mode: "simulated",
  });
  const firstRequirement = nextTaskRequirement(initial);
  const first = answer(initial, firstRequirement, "55-inch", "55″", "idempotent-answer");
  const replay = answerTaskRequirement(first, {
    commandId: "idempotent-answer",
    taskId: first.taskId,
    requirementId: firstRequirement.id,
    expectedRevision: initial.revision,
    value: "55-inch",
    label: "55″",
  });
  assert.equal(replay.revision, first.revision);

  assert.throws(() => answerTaskRequirement(first, {
    commandId: "stale-answer",
    taskId: first.taskId,
    requirementId: nextTaskRequirement(first).id,
    expectedRevision: initial.revision,
    value: "sony",
    label: "Sony",
  }), (error) => error instanceof AsymptaTaskKernelError && error.code === "revision_conflict");
});

test("agent patches cannot overwrite a human-confirmed fact", () => {
  let task = createAsymptaTask({
    rootIntent: "Buy a television",
    locale: "en",
    missingFields: ["screen size"],
    mode: "simulated",
  });
  task = answer(task, nextTaskRequirement(task), "55-inch", "55″", "lock-size");
  const assignment = task.assignments.find((candidate) => candidate.agentId === "commerce-electronics-specialist")
    ?? task.assignments[0];
  const size = task.requirements.find((requirement) => requirement.key === "screen_size");
  const patched = applyAsymptaAgentPatch(task, {
    taskId: task.taskId,
    baseRevision: task.revision,
    assignmentId: assignment.id,
    agentId: assignment.agentId,
    operations: [{
      op: "propose_fact",
      requirementId: size.id,
      value: "75-inch",
      label: "75″",
      confidence: 0.99,
      source: "agent_inference",
    }],
  });

  const preserved = patched.requirements.find((requirement) => requirement.id === size.id);
  assert.equal(preserved.value, "55-inch");
  assert.equal(preserved.displayValue, "55″");
  assert.equal(preserved.lockedBy, "human");
  assert.ok(patched.events.some((event) => /Rejected an agent attempt/.test(event.summary)));
});

test("live writes stop at approval and do not claim an external side effect", () => {
  let task = createAsymptaTask({
    rootIntent: "Buy a television",
    locale: "en",
    missingFields: ["screen size"],
    mode: "live",
  });
  task = answer(task, nextTaskRequirement(task), "55-inch", "55″", "live-size");
  assert.equal(task.phase, "awaiting_approval");
  assert.equal(task.result, null);
  const approval = task.approvals.find((candidate) => candidate.status === "pending");
  assert.ok(approval);

  const afterApproval = approveAsymptaTask(task, {
    commandId: "approve-live",
    taskId: task.taskId,
    approvalId: approval.id,
    expectedRevision: task.revision,
    approved: true,
  });
  assert.equal(afterApproval.phase, "blocked");
  assert.equal(afterApproval.result?.completed, false);
  assert.equal(afterApproval.failure?.code, "connected_executor_required");
});

test("adaptive UI is projected from TaskState requirement ids", () => {
  const task = createAsymptaTask({
    rootIntent: "Buy a television",
    locale: "zh-Hant",
    missingFields: ["screen size", "brand preference"],
    mode: "simulated",
  });
  const schema = taskToAdaptiveInteractionSchema(task);
  assert.equal(schema.interactionId, task.taskId);
  assert.equal(schema.nextField?.id, task.requirements[0].id);
  assert.equal(schema.nextField?.key, "screen_size");
  assert.ok(schema.nextField?.options.some((option) => option.label === "55″"));
});

test("adaptive component contains no natural-language continuation round trip", async () => {
  const source = await readFile(new URL("../components/asympta-adaptive-interaction.tsx", import.meta.url), "utf8");
  assert.match(source, /answerRequirement\(\{/);
  assert.match(source, /expectedRevision: task\.revision/);
  assert.doesNotMatch(source, /mergeAdaptiveClarifications/);
  assert.doesNotMatch(source, /runIntent\(intention\)/);
  assert.doesNotMatch(source, /User-confirmed details:/);
});
