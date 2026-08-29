import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceAtlasWorld,
  atlasSnapshot,
  createAtlasWorld,
  scheduledTaskRows,
  startAtlasWorkflow,
  taskScheduleForAgent,
} from "../lib/atlas-simulation-runtime.ts";

test("Explore Mode opportunistically pauses and resumes a primary task", () => {
  let world = startAtlasWorkflow(createAtlasWorld(Date.now()), "custom-order");
  assert.equal(world.scheduler?.exploreMode, true);

  let sawOpportunity = false;
  let sawObstacle = false;
  let sawResumedPrimary = false;

  for (let step = 0; step < 220; step += 1) {
    world = advanceAtlasWorld(world, 100);
    sawOpportunity ||= (world.scheduler?.opportunitiesCreated ?? 0) > 0;
    sawObstacle ||= (world.scheduler?.obstaclesCreated ?? 0) > 0;
    sawResumedPrimary ||= world.events.some((event) => event.title === "Primary task resumed");
    if (sawOpportunity && sawObstacle && sawResumedPrimary) break;
  }

  assert.equal(sawOpportunity, true, "at least one bounded opportunity should be discovered in the demo runtime");
  assert.equal(sawObstacle, true, "the live scheduler should surface at least one timing obstacle");
  assert.equal(sawResumedPrimary, true, "agent should return to the primary task after the opportunity finishes");
  assert.ok(world.tasks.some((task) => task.runtime?.taskKind === "opportunity" && task.status === "done"));
});

test("every scheduled task exposes a recalculated ETA and health", () => {
  let world = startAtlasWorkflow(createAtlasWorld(Date.now()), "dinner-network");
  for (let step = 0; step < 20; step += 1) world = advanceAtlasWorld(world, 100);

  const rows = scheduledTaskRows(world, 20);
  assert.ok(rows.length >= 8);
  assert.ok(rows.every((row) => typeof row.health === "string" && row.health.length > 0));
  assert.ok(rows.some((row) => typeof row.etaAt === "number" || row.status === "waiting_approval"));

  const activeAgent = world.agents.find((agent) => agent.status !== "idle");
  assert.ok(activeAgent);
  const schedule = taskScheduleForAgent(world, activeAgent.id);
  assert.ok(schedule);
  assert.match(schedule.eta, /^(\d+s|—)$/);
});

test("WebMCP snapshot carries scheduler, ETA, obstacle and opportunity state", () => {
  let world = startAtlasWorkflow(createAtlasWorld(Date.now()), "custom-order");
  for (let step = 0; step < 120; step += 1) world = advanceAtlasWorld(world, 100);

  const snapshot = atlasSnapshot(world);
  assert.equal(snapshot.exploreMode, true);
  assert.equal(snapshot.scheduler.exploreMode, true);
  assert.ok(snapshot.scheduler.opportunitiesCreated >= 1);
  assert.ok(snapshot.scheduler.obstaclesCreated >= 1);
  assert.ok(snapshot.tasks.some((task) => "etaSeconds" in task));
  assert.ok(snapshot.tasks.some((task) => task.taskKind === "opportunity"));
});
