import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceAtlasWorld,
  atlasSnapshot,
  createAtlasWorld,
  startAtlasWorkflow,
} from "../lib/atlas-simulation.ts";
import { BrowserAsymptaTaskKernel } from "../lib/asympta-browser-task-kernel.ts";
import {
  normalizeTaskWorldWorkflowSnapshot,
  TASK_WORLD_WORKFLOW_ID,
  taskWorldWorkflowRunId,
  upsertTaskWorldWorkflow,
} from "../lib/asympta-task-world-workflow.ts";

function installBrowserStub() {
  const values = new Map();
  globalThis.window = {
    sessionStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: (key) => values.delete(key),
    },
    setTimeout,
    clearTimeout,
    dispatchEvent: () => true,
  };
  if (typeof globalThis.CustomEvent !== "function") {
    globalThis.CustomEvent = class CustomEvent {
      constructor(type, options = {}) {
        this.type = type;
        this.detail = options.detail;
      }
    };
  }
}

test("Watch a movie continues through the visible agent workflow after option selection", () => {
  installBrowserStub();
  const kernel = new BrowserAsymptaTaskKernel();
  let task = kernel.createFromClarification({
    activityId: "activity-watch-movie",
    rootIntent: "Watch a movie",
    locale: "en",
    title: "Watch a movie",
    summary: "Choose the movie preference needed to continue.",
    missingFields: ["movie genre"],
    mode: "simulated",
    risk: "low",
  });

  assert.equal(task.phase, "awaiting_human");
  const answers = {
    movie_preference: ["animation", "Animation"],
    cinema_area: ["nearby", "Near my current location"],
    showtime: ["tonight_after_7", "Tonight after 7"],
    quantity: [2, "2"],
  };
  const answeredKeys = [];
  while (task.requirements.some((candidate) => candidate.status === "unknown")) {
    const requirement = task.requirements.find((candidate) => candidate.status === "unknown");
    assert.ok(requirement);
    const answer = answers[requirement.key];
    assert.ok(answer, `missing fixture answer for ${requirement.key}`);
    task = kernel.answerRequirement({
      commandId: `answer-watch-movie-${requirement.key}`,
      taskId: task.taskId,
      requirementId: requirement.id,
      expectedRevision: task.revision,
      value: answer[0],
      label: answer[1],
      actorId: "human",
    });
    answeredKeys.push(requirement.key);
  }

  assert.equal(task.phase, "planning");
  assert.equal(task.result, null, "selecting the last option must not complete the task");
  assert.deepEqual(answeredKeys, ["movie_preference", "cinema_area", "showtime", "quantity"]);
  assert.equal(task.requirements[0].displayValue, "Animation");

  const workflow = upsertTaskWorldWorkflow(task);
  assert.equal(workflow.id, TASK_WORLD_WORKFLOW_ID);
  assert.match(workflow.name, /movie/i);
  assert.equal(workflow.tasks.length, 4);
  assert.deepEqual(workflow.tasks.map((item) => item.agentId), [
    "agent-user",
    "agent-market",
    "agent-operations",
    "agent-quality",
  ]);

  const runId = taskWorldWorkflowRunId(task);
  task = kernel.beginWorldWorkflow(task.taskId, workflow, runId);
  assert.equal(task.phase, "coordinating");
  assert.equal(task.worldWorkflow?.status, "queued");
  assert.equal(kernel.resume(task.taskId)?.revision, task.revision, "the logical kernel must wait for the visible world");

  let world = startAtlasWorkflow(createAtlasWorld(Date.parse("2026-09-01T12:00:00.000Z")), TASK_WORLD_WORKFLOW_ID);
  let snapshot = normalizeTaskWorldWorkflowSnapshot(atlasSnapshot(world));
  assert.ok(snapshot);
  task = kernel.observeWorldWorkflow(task.taskId, snapshot);
  assert.notEqual(task.phase, "completed");
  assert.equal(task.result, null);

  for (let index = 0; index < 200 && world.phase !== "completed"; index += 1) {
    world = advanceAtlasWorld(world, 140);
  }
  assert.equal(world.phase, "completed");
  snapshot = normalizeTaskWorldWorkflowSnapshot(atlasSnapshot(world));
  assert.ok(snapshot);
  assert.ok(snapshot.tasks.every((item) => item.status === "done"));

  task = kernel.completeWorldWorkflow(task.taskId, snapshot);
  assert.equal(task.phase, "completed");
  assert.equal(task.result?.verification.status, "verified");
  assert.equal(task.outcome?.provider, "atlas-world");
  assert.equal(task.worldWorkflow?.completedTaskCount, 4);
  assert.ok(task.evidence.some((item) => item.source === "atlas-world" && item.verified));
  assert.equal(task.rootIntent.raw, "Watch a movie");
});
