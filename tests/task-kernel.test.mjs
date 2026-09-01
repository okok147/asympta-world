import "./task-kernel-core.test.mjs";

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  answerTaskRequirement,
  approveAsymptaTask,
  createAsymptaTask,
  migrateAsymptaTaskState,
  nextTaskRequirement,
  taskToAdaptiveInteractionSchema,
} from "../lib/asympta-managed-task-kernel.ts";
import {
  compileRequirementContract,
  requirementSemantic,
} from "../lib/asympta-requirement-contracts.ts";

function answerValue(requirement) {
  const semantic = requirementSemantic(requirement.semantic || requirement.key || requirement.raw);
  const values = {
    purpose: ["personal_use", "Personal use"],
    budget: ["flexible_budget", "Flexible budget"],
    quantity: [1, "1"],
    acquisition_channel: ["best_available_channel", "Best available channel"],
    fulfilment: ["delivery", "Delivery"],
    deadline: ["flexible", "Flexible timing"],
    screen_size: ["55-inch", "55″"],
    brand: ["agent_choice", "Let Asympta choose"],
    delivery_location: ["saved_home", "Usual address"],
    property_location: ["best_available_area", "Best available area"],
    property_type: ["apartment", "Apartment"],
    bedrooms: [2, "2 bedrooms"],
    financing: ["mortgage", "Mortgage"],
    event_intent: ["personalized_discovery", "Recommend from my preferences"],
    movie_preference: ["personalized_recommendation", "Recommend from my preferences"],
    cinema_area: ["nearby", "Near my current location"],
    showtime: ["tonight_after_7", "Tonight after 7"],
  };
  return values[semantic] ?? ["agent_choice", "Let Asympta decide"];
}

function answerOne(task, requirement, commandId) {
  const [value, label] = answerValue(requirement);
  return answerTaskRequirement(task, {
    commandId,
    taskId: task.taskId,
    requirementId: requirement.id,
    expectedRevision: task.revision,
    value,
    label,
    actorId: "human",
  });
}

function answerAll(task, prefix) {
  let current = task;
  let index = 0;
  while (nextTaskRequirement(current)) {
    current = answerOne(current, nextTaskRequirement(current), `${prefix}:${index}`);
    index += 1;
    assert.ok(index < 24, "requirement progression must remain bounded");
  }
  return current;
}

function approve(task, commandId) {
  const approval = task.approvals.find((candidate) => candidate.status === "pending");
  assert.ok(approval, "a high-impact task must expose a typed pending approval");
  return approveAsymptaTask(task, {
    commandId,
    taskId: task.taskId,
    approvalId: approval.id,
    expectedRevision: task.revision,
    approved: true,
    actorId: "human",
  });
}

test("unknown purchases are expanded by one generic data contract instead of item-specific code", () => {
  const cases = [
    "buy me an airplane",
    "purchase an industrial robot",
    "purchase a delivery van",
    "buy a server rack",
    "purchase a commercial oven",
    "buy a laboratory microscope",
    "purchase a forklift",
    "buy a solar battery system",
    "purchase a printing press",
    "buy a yacht",
    "purchase a warehouse crane",
  ];

  for (const [index, rootIntent] of cases.entries()) {
    const task = createAsymptaTask({
      activityId: `generic-purchase-${index}`,
      rootIntent,
      locale: "en",
      missingFields: [],
      mode: "simulated",
      confirmationRequired: true,
      risk: "high",
    });
    const contract = Reflect.get(task, "requirementContract");
    assert.equal(contract?.id, "commerce.purchase.generic.v1", rootIntent);
    assert.deepEqual(contract?.requiredSemantics, [
      "purpose",
      "budget",
      "quantity",
      "acquisition_channel",
      "fulfilment",
      "deadline",
    ]);
    assert.equal(task.phase, "awaiting_human", rootIntent);
    assert.equal(task.result, null, rootIntent);
    assert.equal(task.outcome, null, rootIntent);
    assert.ok(task.requirements.length >= 6, rootIntent);
  }
});

test("residential property purchase uses a dedicated contract before consequential execution", () => {
  const task = createAsymptaTask({
    activityId: "house-contract-regression",
    rootIntent: "buy a house",
    locale: "en",
    missingFields: [],
    mode: "simulated",
    confirmationRequired: true,
    risk: "high",
  });
  const contract = Reflect.get(task, "requirementContract");
  assert.equal(contract?.id, "real-estate.residential-purchase.v1");
  assert.equal(contract?.completionMode, "simulated_execution");
  assert.deepEqual(contract?.requiredSemantics, [
    "property_location",
    "budget",
    "property_type",
    "bedrooms",
    "financing",
  ]);
  assert.equal(task.phase, "awaiting_human");
  assert.deepEqual(task.requirements.map((requirement) => requirementSemantic(requirement.raw)), [
    "property_location",
    "budget",
    "property_type",
    "bedrooms",
    "financing",
  ]);
  assert.equal(task.result, null);
  assert.equal(task.outcome, null);
});

test("the exact airplane case gathers facts, pauses only for risk confirmation, then executes and verifies", () => {
  let task = createAsymptaTask({
    activityId: "airplane-exact-regression",
    rootIntent: "buy me an airplane",
    locale: "en",
    missingFields: [],
    mode: "simulated",
    confirmationRequired: true,
    risk: "high",
  });

  assert.equal(task.phase, "awaiting_human");
  assert.equal(task.liveness.state, "awaiting_input");
  assert.equal(task.result, null);
  task = answerAll(task, "airplane-answer");

  assert.equal(task.phase, "awaiting_approval");
  assert.equal(task.liveness.state, "awaiting_approval");
  assert.equal(task.result, null);
  assert.equal(task.outcome, null);
  assert.ok(task.plan);

  task = approve(task, "airplane-approve");
  assert.equal(task.phase, "completed");
  assert.equal(task.liveness.state, "completed");
  assert.equal(task.outcome?.status, "completed");
  assert.equal(task.outcome?.kind, "simulated_action");
  assert.equal(task.result?.verification.status, "verified");
  assert.ok(task.evidence.some((evidence) => evidence.kind === "receipt" && evidence.verified));
  assert.ok(task.assignments.some((assignment) => assignment.agentId === "transaction-coordinator"));
  assert.ok(task.assignments.some((assignment) => assignment.agentId === "independent-verifier"));
  assert.doesNotMatch(task.result?.summary ?? "", /specialist agent mesh completed/i);
});

test("television contract preserves useful automatic options and the same typed continuation", () => {
  let task = createAsymptaTask({
    activityId: "managed-tv-options",
    rootIntent: "Buy a premium television",
    locale: "zh-Hant",
    missingFields: ["尚需確認其他必要規格以提供合適建議。"],
    mode: "simulated",
  });

  const contract = Reflect.get(task, "requirementContract");
  assert.equal(contract?.id, "commerce.consumer-electronics.purchase.v1");
  assert.equal(nextTaskRequirement(task)?.key, "screen_size");
  const schema = taskToAdaptiveInteractionSchema(task);
  assert.ok(schema.nextField?.options.some((option) => option.label === "55″"));

  task = answerOne(task, nextTaskRequirement(task), "managed-tv-size");
  assert.equal(nextTaskRequirement(task)?.key, "brand");
  task = answerOne(task, nextTaskRequirement(task), "managed-tv-brand");
  assert.equal(nextTaskRequirement(task)?.key, "delivery_location");
  task = answerOne(task, nextTaskRequirement(task), "managed-tv-delivery");
  assert.equal(task.phase, "awaiting_approval");
  task = approve(task, "managed-tv-approve");
  assert.equal(task.phase, "completed");
  assert.equal(task.outcome?.status, "completed");
});

test("the exact movie case asks atomic choices and completes the same simulated task", () => {
  let task = createAsymptaTask({
    activityId: "movie-outing-regression",
    rootIntent: "Go to watch movie",
    locale: "en",
    missingFields: [],
    mode: "simulated",
  });

  assert.equal(Reflect.get(task, "requirementContract")?.id, "events.cinema-discovery.v1");
  assert.equal(task.domain, "events.cinema");
  assert.equal(task.actionFamily, "discover");
  assert.equal(task.phase, "awaiting_human");
  assert.deepEqual(task.requirements.map((requirement) => requirement.key), [
    "movie_preference",
    "cinema_area",
    "showtime",
    "quantity",
  ]);

  task = answerAll(task, "movie-answer");

  assert.equal(task.phase, "completed");
  assert.equal(task.liveness.state, "completed");
  assert.equal(task.completion.requiresApproval, false);
  assert.equal(task.outcome?.status, "completed");
  assert.equal(task.outcome?.simulated, true);
  assert.equal(task.result?.verification.status, "verified");
  assert.ok(task.assignments.some((assignment) => assignment.agentId === "cinema-planning-specialist"));
  assert.ok(task.assignments.some((assignment) => assignment.agentId === "cinema-showtime-agent"));
  assert.equal(task.approvals.length, 0);
});

test("live high-impact actions remain active after approval until a connected outcome exists", () => {
  let task = createAsymptaTask({
    activityId: "live-industrial-equipment",
    rootIntent: "purchase an industrial robot",
    locale: "en",
    missingFields: [],
    mode: "live",
    confirmationRequired: true,
    risk: "high",
  });
  task = answerAll(task, "live-robot-answer");
  assert.equal(task.phase, "awaiting_approval");
  task = approve(task, "live-robot-approve");

  assert.notEqual(task.phase, "blocked");
  assert.notEqual(task.phase, "failed");
  assert.equal(task.phase, "coordinating");
  assert.equal(task.result, null);
  assert.equal(task.outcome?.status, "waiting_external");
  assert.equal(task.liveness.state, "waiting_external");
  assert.equal(task.liveness.obstacle?.recoverable, true);
  assert.ok(task.liveness.nextAttemptAt);
});

test("legacy false-completed airplane state is reopened and receives the generic requirement contract", () => {
  const legacy = {
    version: "asympta.task/0.3",
    taskId: "legacy-airplane-task",
    activityId: "legacy-airplane-activity",
    revision: 9,
    rootIntent: { raw: "buy me an airplane", locale: "en" },
    domain: "commerce",
    actionFamily: "purchase",
    mode: "simulated",
    risk: "high",
    phase: "completed",
    title: "buy me an airplane",
    summary: "buy me an airplane",
    requirements: [],
    assignments: [],
    approvals: [],
    evidence: [{
      id: "legacy-planning-evidence",
      source: "old-verifier",
      kind: "verification",
      summary: "Planning was complete.",
      simulated: true,
      verified: true,
      createdAt: "2026-08-31T10:00:00.000Z",
    }],
    events: [],
    processedCommandIds: [],
    limits: { maxAssignments: 12, maxDelegationDepth: 3, maxParallelAgents: 3, maxAgentSteps: 24 },
    plan: null,
    result: {
      completed: true,
      simulated: true,
      summary: "The specialist agent mesh completed and verified the task inside the simulated Asympta world.",
      verification: { status: "verified", criteria: {}, details: "Planning was complete." },
      completedAt: "2026-08-31T10:00:00.000Z",
    },
    failure: null,
    createdAt: "2026-08-31T09:59:00.000Z",
    updatedAt: "2026-08-31T10:00:00.000Z",
  };

  const migrated = migrateAsymptaTaskState(legacy);
  assert.ok(migrated);
  assert.equal(migrated.version, "asympta.task/0.4");
  assert.equal(Reflect.get(migrated, "requirementContract")?.id, "commerce.purchase.generic.v1");
  assert.equal(migrated.phase, "awaiting_human");
  assert.equal(migrated.result, null);
  assert.equal(migrated.outcome, null);
  assert.ok(migrated.requirements.length >= 6);
  assert.equal(migrated.liveness.obstacle?.recoverable, true);
});

test("contract selection is driven by action family, not a hard-coded airplane branch", async () => {
  const airplane = compileRequirementContract({
    rootIntent: "buy me an airplane",
    actionFamily: "purchase",
    missingFields: [],
  });
  const robot = compileRequirementContract({
    rootIntent: "purchase an industrial robot",
    actionFamily: "purchase",
    missingFields: [],
  });
  assert.equal(airplane.snapshot.id, robot.snapshot.id);
  assert.deepEqual(airplane.snapshot.requiredSemantics, robot.snapshot.requiredSemantics);

  const implementationPaths = [
    "../lib/asympta-managed-task-kernel.ts",
    "../lib/asympta-task-kernel.ts",
    "../lib/asympta-agent-mesh.ts",
    "../lib/asympta-task-policy.ts",
    "../lib/asympta-requirement-contracts.ts",
  ];
  const implementation = (await Promise.all(implementationPaths.map((path) => readFile(new URL(path, import.meta.url), "utf8")))).join("\n");
  assert.doesNotMatch(implementation, /airplane|aircraft|aeroplane/i);
});

test("browser kernel uses managed contracts, migration and automatic recoverable resume", async () => {
  const source = await readFile(new URL("../lib/asympta-browser-task-kernel.ts", import.meta.url), "utf8");
  assert.match(source, /from "\.\/asympta-managed-task-kernel\.ts"/);
  assert.match(source, /migrateAsymptaTaskState\(candidate\)/);
  assert.match(source, /scheduleResume\(task/);
  assert.match(source, /this\.resume\(task\.taskId\)/);
  assert.doesNotMatch(source, /phase === "blocked"|phase === "failed"/);
});

test("high-risk UI sends a typed approval command and resumes the same task", async () => {
  const source = await readFile(new URL("../components/asympta-adaptive-interaction.tsx", import.meta.url), "utf8");
  assert.match(source, /bridge\.approve\(\{/);
  assert.match(source, /approvalId: approval\.id/);
  assert.match(source, /expectedRevision: task\.revision/);
  assert.match(source, /Confirm and continue|確認並繼續/);
  assert.doesNotMatch(source, /mergeAdaptiveClarifications/);
  assert.doesNotMatch(source, /runIntent\(intention\)/);
});
