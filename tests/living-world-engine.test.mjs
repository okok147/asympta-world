import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceLivingWorld,
  chooseResult,
  createLivingWorld,
  exchangeAgentInformation,
  locationContextForCoordinates,
  resetLivingWorld,
  resolveApproval,
  startHumanNeed,
  startScenario,
  worldSnapshot,
} from "../lib/living-world/engine.ts";

test("a human need creates a bounded useful team and a real task graph", () => {
  const initial = createLivingWorld(42, 1_000);
  const world = startHumanNeed(initial, "I don't know what to eat tonight.");

  assert.equal(world.scenarioId, "dinner");
  assert.equal(world.need?.status, "understanding");
  assert.equal(world.agents.length, 5);
  assert.equal(world.tasks.length, 7);
  assert.deepEqual(
    world.tasks.find((task) => task.id === "synthesise")?.dependencies,
    ["discover", "preference", "logistics"],
  );
  assert.equal(world.agents.some((agent) => agent.profile.species === "Fox"), true);
  assert.equal(world.agents.some((agent) => agent.profile.species === "Turtle"), true);
});

test("task dependencies, agent movement, tools and convergence run through state", () => {
  let world = startScenario(createLivingWorld(7, 10_000), "dinner");
  world = advanceLivingWorld(world, 34_000);

  assert.equal(world.phase, "ready");
  assert.equal(world.need?.status, "ready");
  assert.equal(world.tasks.every((task) => task.status === "done"), true);
  assert.equal(world.toolRuns.length, 4);
  assert.equal(world.toolRuns.every((run) => run.status === "succeeded"), true);
  assert.equal(world.toolRuns.every((run) => run.mode === "simulated"), true);
  assert.equal(
    world.tasks.find((task) => task.id === "discover").startedAt >=
      world.tasks.find((task) => task.id === "context").completedAt,
    true,
  );
  assert.equal(
    world.tasks.find((task) => task.id === "synthesise").startedAt >=
      world.tasks.find((task) => task.id === "logistics").completedAt,
    true,
  );
  assert.equal(world.events.some((event) => event.type === "agent_message"), true);
  assert.equal(world.events.some((event) => event.type === "tool_result"), true);
  assert.equal(world.result?.title.en, "Thai Basil House");
});

test("consequential actions stop at a human approval gate", () => {
  let world = advanceLivingWorld(
    startScenario(createLivingWorld(99, 2_000), "email"),
    35_000,
  );
  world = chooseResult(world, "send-email");

  assert.equal(world.phase, "waiting_for_human");
  assert.equal(world.need?.status, "waiting_for_human");
  assert.equal(world.approval.status, "pending");

  world = resolveApproval(world, true);
  assert.equal(world.phase, "completed");
  assert.equal(world.need?.status, "completed");
  assert.equal(world.approval.status, "approved");
  assert.equal(
    world.events.some(
      (event) =>
        event.type === "action_completed" &&
        event.title.en.includes("nothing was sent"),
    ),
    true,
  );
});

test("declining approval returns the user to the result without side effects", () => {
  let world = advanceLivingWorld(
    startScenario(createLivingWorld(100, 3_000), "shopping"),
    35_000,
  );
  world = chooseResult(world, "buy-monitor");
  world = resolveApproval(world, false);

  assert.equal(world.phase, "ready");
  assert.equal(world.need?.status, "ready");
  assert.equal(world.approval.status, "declined");
});

test("safe choices complete the need and create a brief celebration", () => {
  let world = advanceLivingWorld(
    startScenario(createLivingWorld(101, 4_000), "work"),
    35_000,
  );
  world = chooseResult(world, "open-brief");

  assert.equal(world.phase, "completed");
  assert.equal(world.need?.status, "completed");
  assert.equal(typeof world.celebrationUntil, "number");
});

test("demo reset preserves the privacy-aware local world", () => {
  const location = locationContextForCoordinates(22.3027, 114.1772, "device", 5_000);
  const initial = createLivingWorld(102, 5_000, location);
  const active = advanceLivingWorld(startScenario(initial, "dinner"), 9_000);
  const reset = resetLivingWorld(active);

  assert.equal(reset.phase, "idle");
  assert.equal(reset.location.cellId, location.cellId);
  assert.equal(reset.location.source, "device");
  assert.equal(reset.agents.length, 0);
});

test("seeded scenarios are reproducible", () => {
  const first = advanceLivingWorld(
    startScenario(createLivingWorld(2026, 8_000), "dinner"),
    12_000,
  );
  const second = advanceLivingWorld(
    startScenario(createLivingWorld(2026, 8_000), "dinner"),
    12_000,
  );
  assert.deepEqual(worldSnapshot(first, "en"), worldSnapshot(second, "en"));
});

test("explicit agent information exchange is visible in the same event system", () => {
  const active = startScenario(createLivingWorld(103, 6_000), "dinner");
  const next = exchangeAgentInformation(
    active,
    "dinner-discovery",
    "dinner-conductor",
    "Two nearby options remain",
  );
  assert.equal(next.messages.at(-1)?.text.en, "Two nearby options remain");
  assert.equal(next.events[0]?.type, "agent_message");
});

test("free text is classified into the supported scenario families", () => {
  const initial = createLivingWorld(104, 7_000);
  assert.equal(startHumanNeed(initial, "Compare a monitor for me").scenarioId, "shopping");
  assert.equal(startHumanNeed(initial, "Reply to my important email").scenarioId, "email");
  assert.equal(startHumanNeed(initial, "Prepare tomorrow's meeting").scenarioId, "work");
  assert.equal(startHumanNeed(initial, "Find dinner nearby").scenarioId, "dinner");
});
