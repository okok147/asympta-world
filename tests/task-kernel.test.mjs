import "./task-kernel-core.test.mjs";

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  answerTaskRequirement,
  createAsymptaTask,
  nextTaskRequirement,
} from "../lib/asympta-managed-task-kernel.ts";

function answer(task, requirement, value, label, commandId) {
  return answerTaskRequirement(task, {
    commandId,
    taskId: task.taskId,
    requirementId: requirement.id,
    expectedRevision: task.revision,
    value,
    label,
    actorId: "human",
    now: "2026-08-31T11:58:00.000Z",
  });
}

test("empty upstream fields for an unseen purchase compile a requirement contract instead of auto-completing", () => {
  const task = createAsymptaTask({
    activityId: "activity-unseen-purchase-airplane",
    rootIntent: "buy me an airplane",
    locale: "zh-Hant",
    missingFields: [],
    mode: "simulated",
    now: "2026-08-31T11:57:00.000Z",
  });

  assert.equal(task.phase, "awaiting_human");
  assert.equal(task.result, null);
  assert.equal(task.assignments.length, 0);
  assert.deepEqual(task.requirements.map((requirement) => requirement.key), [
    "purpose",
    "budget",
    "quantity",
    "purchase_location",
    "fulfilment",
    "deadline",
  ]);
  const contract = Reflect.get(task, "requirementContract");
  assert.equal(contract?.id, "commerce.purchase.generic.v1");
  assert.deepEqual(contract?.requiredSemantics, [
    "purpose",
    "budget",
    "quantity",
    "acquisition_channel",
    "fulfilment",
    "deadline",
  ]);
  assert.equal(nextTaskRequirement(task)?.key, "purpose");
});

test("unseen purchase types share one action-family contract rather than item-specific hard coding", async () => {
  const build = (rootIntent) => createAsymptaTask({
    rootIntent,
    locale: "en",
    missingFields: [],
    mode: "simulated",
  });
  const airplane = build("buy me an airplane");
  const industrialRobot = build("buy me an industrial robot");

  assert.deepEqual(
    airplane.requirements.map((requirement) => requirement.key),
    industrialRobot.requirements.map((requirement) => requirement.key),
  );
  assert.equal(Reflect.get(airplane, "requirementContract")?.id, "commerce.purchase.generic.v1");
  assert.equal(Reflect.get(industrialRobot, "requirementContract")?.id, "commerce.purchase.generic.v1");
  const source = await readFile(new URL("../lib/asympta-requirement-contracts.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /airplane|aircraft|industrial robot/iu);
});

test("a generic purchase finishes only as a verified simulated procurement proposal", () => {
  let task = createAsymptaTask({
    activityId: "activity-generic-procurement",
    rootIntent: "buy me an airplane",
    locale: "en",
    missingFields: [],
    mode: "simulated",
    now: "2026-08-31T11:57:00.000Z",
  });

  const answers = {
    purpose: ["personal travel", "Personal travel"],
    budget: ["compare_first", "Compare first"],
    quantity: [1, "1"],
    purchase_location: ["either", "Either is fine"],
    fulfilment: ["agent_choice", "Let Asympta choose"],
    deadline: ["flexible", "Flexible"],
  };

  let index = 0;
  while (nextTaskRequirement(task)) {
    const requirement = nextTaskRequirement(task);
    const [value, label] = answers[requirement.key];
    task = answer(task, requirement, value, label, `generic-answer-${index}`);
    index += 1;
  }

  assert.equal(task.phase, "completed");
  assert.equal(task.result?.completed, true);
  assert.equal(task.result?.simulated, true);
  assert.match(task.result?.summary ?? "", /simulated procurement brief/i);
  assert.doesNotMatch(task.result?.summary ?? "", /specialist agent mesh completed/i);
  assert.equal(task.result?.verification.criteria.requirementContractSatisfied, true);
  assert.equal(task.result?.verification.criteria.substantiveProposalPresent, true);
  assert.equal(task.result?.verification.criteria.realSideEffectNotClaimed, true);
  assert.equal(task.plan?.proposal.executionBoundary, "simulated_proposal_only");
  const proposalEvidence = task.evidence.find((evidence) => evidence.source === "requirement-contract-gate");
  assert.ok(proposalEvidence);
  assert.equal(proposalEvidence.simulated, true);
  assert.equal(proposalEvidence.value.realSideEffectClaimed, false);
  assert.equal(proposalEvidence.value.realVendorClaimed, false);
  assert.equal(proposalEvidence.value.realInventoryClaimed, false);
});

test("the browser Task Kernel is wired to the managed contract gate and migrates old session data", async () => {
  const source = await readFile(new URL("../lib/asympta-browser-task-kernel.ts", import.meta.url), "utf8");
  assert.match(source, /from "\.\/asympta-managed-task-kernel\.ts"/);
  assert.match(source, /asympta\.task-kernel\.v2/);
});
