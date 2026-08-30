import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceIntentWorld,
  createIntentWorld,
  renderIntentWorldToText,
  resolveIntentApproval,
  startIntentWorld,
  validateIntentWorldState,
} from "../lib/intent-world/engine.ts";
import { buildDeterministicIntentPlan } from "../lib/intent-world/fallback.ts";
import { validateIntentPlan, validatePlannerResult } from "../lib/intent-world/validation.ts";

const fallbackProvenance = {
  provider: "deterministic-fallback",
  model: "openai/gpt-oss-120b:free",
  fallbackReason: "test",
};

test("request-specific fallback creates a validated dynamic task graph without preset workflows", () => {
  const result = buildDeterministicIntentPlan("Research three viable ways to launch a small service and verify the recommendation.");
  assert.equal(result.ready, true);
  assert.ok(result.plan.tasks.length >= 7);
  assert.equal(validateIntentPlan(result.plan).ok, true);
  const serialized = JSON.stringify(result.plan);
  assert.doesNotMatch(serialized, /custom-order|dinner-network|launch-stock|service-recovery/);
  assert.ok(result.plan.tasks.some((task) => task.agentId === "agent-quality"));
  assert.ok(result.plan.tasks.some((task) => task.agentId === "agent-support"));
});

test("plan validator rejects unknown capabilities and cyclic dependencies", () => {
  const result = buildDeterministicIntentPlan("Analyse an idea and provide a verified conclusion.");
  assert.equal(result.ready, true);

  const unknownAgent = structuredClone(result.plan);
  unknownAgent.tasks[0].agentId = "agent-invented";
  const unknownValidation = validateIntentPlan(unknownAgent);
  assert.equal(unknownValidation.ok, false);
  assert.match(unknownValidation.error, /unknown agent/i);

  const cyclic = structuredClone(result.plan);
  cyclic.tasks[0].dependsOn = [cyclic.tasks.at(-1).id];
  const cycleValidation = validateIntentPlan(cyclic);
  assert.equal(cycleValidation.ok, false);
  assert.match(cycleValidation.error, /acyclic/i);
});

test("consequential actions are forced behind human approval", () => {
  const result = buildDeterministicIntentPlan("Buy and deliver a suitable item within the simulated world.");
  assert.equal(result.ready, true);
  const orderTask = result.plan.tasks.find((task) => task.actionType === "place_order");
  assert.ok(orderTask);
  assert.equal(orderTask.requiresApproval, true);

  const tampered = structuredClone(result.plan);
  const rawOrder = tampered.tasks.find((task) => task.actionType === "place_order");
  rawOrder.requiresApproval = false;
  rawOrder.consequence = "";
  const validated = validateIntentPlan(tampered);
  assert.equal(validated.ok, true);
  const normalizedOrder = validated.value.tasks.find((task) => task.actionType === "place_order");
  assert.equal(normalizedOrder.requiresApproval, true);
  assert.ok(normalizedOrder.consequence.length > 0);
});

test("deterministic engine completes a validated dynamic plan after explicit approvals", () => {
  const result = buildDeterministicIntentPlan("Buy a paper-like screen protector and coordinate simulated fulfilment.");
  assert.equal(result.ready, true);
  let world = startIntentWorld(createIntentWorld(), "Buy a paper-like screen protector", result.plan, fallbackProvenance);

  for (let step = 0; step < 2_400 && world.phase !== "completed"; step += 1) {
    const pending = world.approvals.find((approval) => approval.status === "pending");
    if (pending) world = resolveIntentApproval(world, pending.id, true);
    world = advanceIntentWorld(world, 250);
  }

  assert.equal(world.phase, "completed");
  assert.ok(world.tasks.every((task) => task.status === "completed"));
  assert.deepEqual(validateIntentWorldState(world), []);
  assert.ok(world.events.some((event) => event.kind === "approval" && /granted/i.test(event.title)));
  assert.ok(world.events.some((event) => event.kind === "completion"));
});

test("declining a consequential action blocks it and its downstream state", () => {
  const result = buildDeterministicIntentPlan("Order dinner and coordinate a simulated delivery.");
  assert.equal(result.ready, true);
  let world = startIntentWorld(createIntentWorld(), "Order dinner", result.plan, fallbackProvenance);

  for (let step = 0; step < 1_200 && !world.approvals.some((approval) => approval.status === "pending"); step += 1) {
    world = advanceIntentWorld(world, 250);
  }
  const pending = world.approvals.find((approval) => approval.status === "pending");
  assert.ok(pending);
  world = resolveIntentApproval(world, pending.id, false);
  world = advanceIntentWorld(world, 250);

  assert.equal(world.phase, "blocked");
  const blockedTask = world.tasks.find((task) => task.id === pending.taskId);
  assert.equal(blockedTask.status, "blocked");
  assert.ok(world.tasks.some((task) => task.dependsOn.includes(blockedTask.id) && task.status === "blocked"));
  assert.ok(world.events.some((event) => /No consequential action occurred/i.test(event.detail)));
  assert.deepEqual(validateIntentWorldState(world), []);
});

test("planner clarification and accessible text rendering remain bounded and inspectable", () => {
  const clarification = validatePlannerResult({
    ready: false,
    assistantMessage: "I need one constraint before execution.",
    questions: ["What is the maximum budget?"],
    plan: null,
  });
  assert.equal(clarification.ok, true);
  assert.equal(clarification.value.ready, false);

  const result = buildDeterministicIntentPlan("Research a concise answer and verify it.");
  assert.equal(result.ready, true);
  const world = startIntentWorld(createIntentWorld(), "Research a concise answer", result.plan, fallbackProvenance);
  const text = renderIntentWorldToText(world);
  assert.match(text, /Asympta World/);
  assert.match(text, /Tasks:/);
  assert.match(text, /Disclosure:/);
  assert.match(text, /simulated/i);
});
