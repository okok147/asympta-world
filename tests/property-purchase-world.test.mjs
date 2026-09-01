import assert from "node:assert/strict";
import test from "node:test";

import { BrowserAsymptaTaskKernel } from "../lib/asympta-browser-task-kernel.ts";
import { compileRequirementContract } from "../lib/asympta-requirement-contracts.ts";
import {
  TASK_WORLD_WORKFLOW_ID,
  upsertTaskWorldWorkflow,
} from "../lib/asympta-task-world-workflow.ts";

test("residential property purchase gets a dedicated executable requirement contract", () => {
  const compiled = compileRequirementContract({
    rootIntent: "Buy a house",
    missingFields: [],
  });

  assert.equal(compiled.snapshot.id, "real-estate.residential-purchase.v1");
  assert.equal(compiled.snapshot.completionMode, "simulated_execution");
  assert.deepEqual(compiled.snapshot.requiredSemantics, [
    "property_location",
    "budget",
    "property_type",
    "bedrooms",
    "financing",
  ]);
  assert.deepEqual(compiled.missingFields, [
    "property location",
    "budget",
    "property type",
    "bedrooms",
    "financing preference",
  ]);
});

test("approved simulated house purchase enters visible world and finishes with a simulated receipt", () => {
  const kernel = new BrowserAsymptaTaskKernel();
  let task = kernel.createFromClarification({
    activityId: "property-purchase-test",
    rootIntent: "Buy a house",
    locale: "en",
    missingFields: [],
    mode: "simulated",
    risk: "high",
    confirmationRequired: true,
  });

  const answerBySemantic = {
    property_location: ["shibuya", "Shibuya"],
    budget: [8000000, "HK$8,000,000"],
    property_type: ["apartment", "Apartment"],
    bedrooms: [2, "2 bedrooms"],
    financing: ["mortgage", "Mortgage"],
  };

  for (const requirement of task.requirements) {
    const [value, label] = answerBySemantic[requirement.key]
      ?? answerBySemantic[requirement.semantic]
      ?? ["confirmed", "Confirmed"];
    task = kernel.answerRequirement({
      commandId: `answer-${requirement.id}`,
      taskId: task.taskId,
      requirementId: requirement.id,
      expectedRevision: task.revision,
      value,
      label,
      actorId: "human",
    });
  }

  for (let attempt = 0; attempt < 4 && task.phase !== "awaiting_approval"; attempt += 1) {
    task = kernel.resume(task.taskId) ?? task;
  }
  assert.equal(task.phase, "awaiting_approval");
  const approval = task.approvals.find((candidate) => candidate.status === "pending");
  assert.ok(approval);

  task = kernel.approve({
    commandId: "approve-property-purchase",
    taskId: task.taskId,
    approvalId: approval.id,
    expectedRevision: task.revision,
    approved: true,
    actorId: "human",
  });
  assert.equal(task.phase, "coordinating");
  assert.equal(task.approvals.find((candidate) => candidate.id === approval.id)?.status, "approved");

  const workflow = upsertTaskWorldWorkflow(task);
  const runId = "property-world-run";
  task = kernel.beginWorldWorkflow(task.taskId, workflow, runId) ?? task;
  assert.equal(task.worldWorkflow?.status, "queued");
  assert.equal(task.worldWorkflow?.runId, runId);

  const snapshot = {
    phase: "completed",
    workflowId: String(TASK_WORLD_WORKFLOW_ID),
    workflow: workflow.name,
    tasks: workflow.tasks.map((item) => ({
      id: item.id,
      title: item.title,
      agentId: item.agentId,
      locationId: item.locationId,
      status: "done",
      progress: 1,
      dependencies: [...item.dependsOn],
    })),
  };

  task = kernel.completeWorldWorkflow(task.taskId, snapshot) ?? task;
  assert.equal(task.phase, "completed");
  assert.equal(task.result?.completed, true);
  assert.equal(task.result?.simulated, true);
  assert.equal(task.result?.verification.status, "verified");
  assert.equal(task.result?.verification.criteria.receiptRecorded, true);
  assert.ok(task.evidence.some((evidence) => evidence.kind === "receipt" && evidence.simulated));
  assert.equal(task.outcome?.simulated, true);
});
