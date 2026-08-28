import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceLivingWorld,
  chooseResult,
  createLivingWorld,
  locationContextForCoordinates,
  resolveApproval,
  startHumanNeed,
  startScenario,
  worldSnapshot,
} from "../lib/living-world/engine.ts";

test("order scenario creates a complete multi-party economic graph", () => {
  const world = startScenario(createLivingWorld(20260828, 1_000), "order");
  assert.equal(world.scenarioId, "order");
  assert.equal(world.agents.length, 12);
  assert.equal(world.tasks.length, 21);
  assert.equal(new Set(world.agents.map((agent) => agent.profile.organisation?.en)).size >= 6, true);
  assert.equal(world.tasks.some((task) => task.id === "clarify"), true);
  assert.equal(world.tasks.some((task) => task.id === "supplier-quote"), true);
  assert.equal(world.tasks.some((task) => task.id === "quality-rework"), true);
  assert.equal(world.tasks.find((task) => task.id === "dispatch-approval")?.requiresApproval, true);
});

test("order pauses before simulated payment and dispatch, then resumes through delivery", () => {
  let world = startScenario(createLivingWorld(9, 2_000), "order");
  world = advanceLivingWorld(world, 120_000);
  assert.equal(world.phase, "waiting_for_human");
  assert.equal(world.approval.status, "pending");
  assert.equal(world.approval.kind, "task");
  assert.equal(world.approval.taskId, "dispatch-approval");
  assert.equal(world.tasks.find((task) => task.id === "invoice-prepare")?.status, "done");
  assert.equal(world.tasks.find((task) => task.id === "carrier-handoff")?.status, "queued");
  assert.equal(world.result, undefined);

  world = resolveApproval(world, true);
  assert.equal(world.phase, "coordinating");
  world = advanceLivingWorld(world, 120_000);
  assert.equal(world.phase, "ready");
  assert.equal(world.tasks.every((task) => task.status === "done"), true);
  assert.equal(world.result?.title.en, "12 custom notebooks · delivered");
  assert.equal(world.toolRuns.every((run) => run.mode === "simulated"), true);
});

test("declining the mid-flow handoff keeps the consequential dispatch on hold", () => {
  let world = advanceLivingWorld(startScenario(createLivingWorld(10, 3_000), "order"), 120_000);
  world = resolveApproval(world, false);
  assert.equal(world.phase, "waiting_for_human");
  assert.equal(world.need?.status, "waiting_for_human");
  assert.equal(world.tasks.find((task) => task.id === "dispatch-approval")?.approvalStatus, "declined");
  assert.equal(world.tasks.find((task) => task.id === "carrier-handoff")?.status, "queued");
});

test("final consequential actions remain human-gated and truthfully simulated", () => {
  let world = advanceLivingWorld(startScenario(createLivingWorld(11, 4_000), "email"), 60_000);
  assert.equal(world.phase, "ready");
  world = chooseResult(world, "send-email");
  assert.equal(world.phase, "waiting_for_human");
  assert.equal(world.approval.status, "pending");
  world = resolveApproval(world, true);
  assert.equal(world.phase, "completed");
  assert.equal(world.events.some((event) => event.type === "action_completed" && event.title.en.includes("nothing was sent")), true);
});

test("free text classifies multi-party economic requests into order", () => {
  const initial = createLivingWorld(12, 5_000);
  assert.equal(startHumanNeed(initial, "Coordinate a supplier and warehouse for my custom order").scenarioId, "order");
  assert.equal(startHumanNeed(initial, "Find dinner nearby").scenarioId, "dinner");
});

test("seeded order state is deterministic", () => {
  const first = advanceLivingWorld(startScenario(createLivingWorld(2026, 8_000), "order"), 40_000);
  const second = advanceLivingWorld(startScenario(createLivingWorld(2026, 8_000), "order"), 40_000);
  assert.deepEqual(worldSnapshot(first, "en"), worldSnapshot(second, "en"));
});

test("location output remains grouped and privacy-aware", () => {
  const location = locationContextForCoordinates(22.3027, 114.1772, "device", 5_000);
  const world = createLivingWorld(13, 5_000, location);
  const snapshot = worldSnapshot(world, "en");
  assert.equal(snapshot.location.source, "device");
  assert.equal("latitude" in snapshot.location, false);
  assert.equal("longitude" in snapshot.location, false);
});
