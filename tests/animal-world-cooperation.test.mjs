import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  advanceAtlasWorld,
  atlasSimulationSpeed,
  createAtlasWorld,
  projectWorldCooperationToAnimals,
  resolveAtlasApproval,
  setAtlasSimulationSpeed,
  startAtlasWorkflow,
} from "../lib/atlas-animal-cooperation.ts";
import { startAtlasDemoWorkflow } from "../lib/atlas-canonical-demo.ts";

const simulationSpeedSource = readFileSync(new URL("../components/asympta-simulation-speed.tsx", import.meta.url), "utf8");

function balances(world) {
  return Object.fromEntries(world.runtime.accounts.map((account) => [account.ownerId, account.balance]));
}

function completeWorkflow(workflowId, speed = 5, seed = 9000) {
  let world = setAtlasSimulationSpeed(createAtlasWorld(10_000, seed), speed);
  world = startAtlasWorkflow(world, workflowId);
  const initialTaskIds = world.tasks.map((task) => task.id);

  for (let step = 0; step < 20_000; step += 1) {
    world = advanceAtlasWorld(world, 120);
    let approval = world.approvals.find((item) => item.status === "pending");
    while (approval) {
      world = resolveAtlasApproval(world, approval.id, true);
      approval = world.approvals.find((item) => item.status === "pending");
    }
    if (world.phase === "completed") break;
  }

  return { world, initialTaskIds };
}

test("canonical world events become visible cooperation messages between animal agents", () => {
  let world = createAtlasWorld(1_000, 1234);
  world = startAtlasWorkflow(world, "custom-order");

  const cooperation = world.messages.filter((message) => message.id.startsWith("runtime-cooperation:"));
  assert.ok(cooperation.length >= 1);
  assert.ok(cooperation.some((message) => message.fromAgentId === "agent-business" && message.toAgentId === "agent-customer"));
  assert.ok(cooperation.some((message) => /coordinating the world/i.test(message.text)));
});

test("cooperation projection is idempotent and does not spam repeated bubbles", () => {
  let world = startAtlasWorkflow(createAtlasWorld(2_000, 1234), "custom-order");
  const once = projectWorldCooperationToAnimals(world);
  const twice = projectWorldCooperationToAnimals(once);

  const onceIds = once.messages.filter((message) => message.id.startsWith("runtime-cooperation:")).map((message) => message.id);
  const twiceIds = twice.messages.filter((message) => message.id.startsWith("runtime-cooperation:")).map((message) => message.id);
  assert.deepEqual(twiceIds, onceIds);
});

test("local workflow switching preserves the existing fund ledger", () => {
  let world = createAtlasWorld(3_000, 4321);
  world.runtime.accounts.find((account) => account.ownerId === "agent-customer").balance = 137_531;
  world.runtime.accounts.find((account) => account.ownerId === "agent-business").balance = 84_219;

  world = startAtlasDemoWorkflow(world, "custom-order");
  assert.equal(world.runtime.accounts.find((account) => account.ownerId === "agent-customer")?.balance, 137_531);
  assert.equal(world.runtime.accounts.find((account) => account.ownerId === "agent-business")?.balance, 84_219);

  world = startAtlasDemoWorkflow(world, "dinner-network");
  assert.equal(world.runtime.accounts.find((account) => account.ownerId === "agent-customer")?.balance, 137_531);
  assert.equal(world.runtime.accounts.find((account) => account.ownerId === "agent-business")?.balance, 84_219);

  world = startAtlasDemoWorkflow(world, "launch-stock");
  assert.equal(world.runtime.accounts.find((account) => account.ownerId === "agent-customer")?.balance, 137_531);
  assert.equal(world.runtime.accounts.find((account) => account.ownerId === "agent-business")?.balance, 84_219);
});

test("schedule and main menu stay user controlled while the agent card may auto collapse", () => {
  const source = readFileSync(new URL("../components/asympta-card-collapse.tsx", import.meta.url), "utf8");
  assert.match(source, /AGENT_AUTO_COLLAPSE_MS = 5_500/);
  assert.match(source, /atlas-safe-schedule__header/);
  assert.match(source, /applySchedule\(!scheduleExpanded\)/);
  assert.doesNotMatch(source, /PANEL_AUTO_COLLAPSE_MS/);
  assert.doesNotMatch(source, /lastScheduleInteractionAt/);
  assert.doesNotMatch(source, /lastMenuInteractionAt/);
  assert.doesNotMatch(source, /scheduleExpanded && .*performance\.now\(\).*applySchedule\(false\)/);
  assert.doesNotMatch(source, /menuIsOpen\(\) && .*performance\.now\(\).*setMenuOpen\(false\)/);
  assert.doesNotMatch(source, /atlas-approval/);
});

test("blocked persisted worlds are preserved except the proven approved-marketplace migration", () => {
  const source = readFileSync(new URL("../lib/atlas-canonical-demo.ts", import.meta.url), "utf8");
  assert.match(source, /if \(persisted && persisted\.workflowId\) return repairApprovedMarketplaceCheckpoint\(persisted\)/);
  assert.match(source, /task\.approvalStatus === "approved"/);
  assert.match(source, /current\.workflowId !== \("marketplace-intent" as WorkflowId\)/);
  assert.match(source, /current\.phase !== "blocked"/);
  assert.doesNotMatch(source, /persisted\.phase !== ["']blocked["']/);
});

test("simulation speed supports every 1x through 5x world-time multiplier", () => {
  for (const speed of [1, 2, 3, 4, 5]) {
    let world = setAtlasSimulationSpeed(createAtlasWorld(50_000 + speed, 5100 + speed), speed);
    world = startAtlasWorkflow(world, "custom-order");
    const before = world.now;
    world = advanceAtlasWorld(world, 120);
    assert.equal(atlasSimulationSpeed(world), speed);
    assert.equal(world.now - before, 120 * speed);
  }
});

test("browser agent speed defaults to 2x while keeping the full 1x through 5x control", () => {
  assert.match(simulationSpeedSource, /const DEFAULT_SPEED: SimulationSpeed = 2/);
  assert.match(simulationSpeedSource, /const SPEEDS: SimulationSpeed\[\] = \[1, 2, 3, 4, 5\]/);
  assert.match(simulationSpeedSource, /return DEFAULT_SPEED/);
  assert.match(simulationSpeedSource, /useState<SimulationSpeed>\(DEFAULT_SPEED\)/);
  assert.match(simulationSpeedSource, /useRef<SimulationSpeed>\(DEFAULT_SPEED\)/);
  assert.match(simulationSpeedSource, /api\.advance\(elapsed \* \(multiplier - 1\)\)/);
});

test("all four local workflows run successfully to completion without replay", () => {
  const workflows = ["custom-order", "dinner-network", "launch-stock", "service-recovery"];
  workflows.forEach((workflowId, index) => {
    const { world, initialTaskIds } = completeWorkflow(workflowId, 5, 9200 + index);
    assert.equal(world.workflowId, workflowId, `${workflowId} must remain the same workflow`);
    assert.equal(world.phase, "completed", `${workflowId} must reach completed`);
    assert.ok(initialTaskIds.every((id) => world.tasks.find((task) => task.id === id)?.status === "done"), `${workflowId} must finish every original task`);
    assert.equal(new Set(world.tasks.map((task) => task.id)).size, world.tasks.length, `${workflowId} must not replay duplicate tasks`);
    assert.ok(world.runtime.orders.at(-1), `${workflowId} must retain a runtime order`);
  });
});

test("Dinner repairs its missing reservation through a higher agent and resumes the same dispatch", () => {
  const { world } = completeWorkflow("dinner-network", 5, 7777);
  const escalation = world.tasks.find((task) => task.id === "escalation-dn-dispatch");
  assert.ok(escalation, "Dinner should expose a real higher-agent escalation task");
  assert.equal(escalation.status, "done");
  assert.equal(world.tasks.find((task) => task.id === "dn-dispatch")?.status, "done");
  assert.equal(world.phase, "completed");
  assert.ok(world.runtime.reservations.some((reservation) => reservation.status === "consumed"));
  assert.ok(world.runtime.history.some((event) => event.type === "escalation_requested" && event.intentId === "task:dn-dispatch"));
  assert.ok(world.runtime.history.some((event) => event.type === "escalation_resolved" && event.intentId === "task:dn-dispatch"));
  assert.ok(world.runtime.information.some((info) => info.subject === "task:dn-dispatch:shipment-recovery"));
});

test("service recovery visibly gets stuck, escalates to a higher agent, solves it, and continues", () => {
  let world = setAtlasSimulationSpeed(createAtlasWorld(10_000, 8080), 5);
  world = startAtlasWorkflow(world, "service-recovery");
  let sawOriginalStuck = false;
  let sawHigherAgentTask = false;
  let sawResolved = false;
  let stuckBalances = null;
  let resolvedBalances = null;

  for (let step = 0; step < 20_000; step += 1) {
    world = advanceAtlasWorld(world, 120);

    const supplierTask = world.tasks.find((task) => task.id === "sr-supplier");
    const escalationTask = world.tasks.find((task) => task.id === "escalation-sr-supplier");
    if (supplierTask?.status === "blocked") {
      sawOriginalStuck = true;
      stuckBalances ??= balances(world);
      assert.ok((supplierTask.progress ?? 0) >= 0.42, "stuck task should preserve meaningful prior progress");
    }
    if (escalationTask && ["moving", "working", "done"].includes(escalationTask.status)) {
      sawHigherAgentTask = true;
      assert.equal(escalationTask.agentId, "agent-business");
    }

    if (world.runtime.history.some((event) => event.type === "escalation_resolved" && event.intentId === "task:sr-supplier")) {
      if (!sawResolved) resolvedBalances = balances(world);
      sawResolved = true;
    }

    let approval = world.approvals.find((item) => item.status === "pending");
    while (approval) {
      world = resolveAtlasApproval(world, approval.id, true);
      approval = world.approvals.find((item) => item.status === "pending");
    }

    if (world.phase === "completed") break;
    if (world.phase === "blocked" && sawResolved) {
      assert.fail("workflow became blocked again after the higher-agent escalation resolved");
    }
  }

  assert.equal(sawOriginalStuck, true);
  assert.equal(sawHigherAgentTask, true);
  assert.equal(sawResolved, true);
  assert.ok(stuckBalances && resolvedBalances);
  assert.deepEqual(resolvedBalances, stuckBalances, "escalation must not reset or mutate funds while solving the planning blockage");
  assert.equal(world.workflowId, "service-recovery");
  assert.equal(world.tasks.find((task) => task.id === "sr-supplier")?.status, "done");
  assert.equal(world.tasks.find((task) => task.id === "escalation-sr-supplier")?.status, "done");
  assert.equal(world.phase, "completed");
  assert.ok(world.runtime.information.some((info) => info.subject === "recovery-escalation"));
  assert.ok(world.runtime.history.some((event) => event.type === "escalation_requested"));
  assert.ok(world.runtime.history.some((event) => event.type === "escalation_resolved"));
  assert.ok(world.messages.some((message) => /higher-level path|escalating/i.test(message.text)) || world.runtime.history.some((event) => /higher agent|higher-level/i.test(`${event.title} ${event.detail}`)));
});

test("product still renders cute moving animals, dialogue bubbles and cooperation lines", () => {
  const source = readFileSync(new URL("../components/asympta-world-live-60hz.tsx", import.meta.url), "utf8");
  assert.match(source, /AnimalPortrait/);
  assert.match(source, /animalSvgMarkup/);
  assert.match(source, /cityLifeSnapshot/);
  assert.match(source, /animal-map-marker--foreground/);
  assert.match(source, /animal-map-marker--ambient/);
  assert.match(source, /animal-map-marker__dialogue/);
  assert.match(source, /atlas-messages/);
  assert.match(source, /messageGeoJson/);
  assert.match(source, /requestAnimationFrame/);
});

test("product alias uses the animal cooperation projection instead of bypassing it", () => {
  const tsconfig = readFileSync(new URL("../tsconfig.json", import.meta.url), "utf8");
  assert.match(tsconfig, /atlas-animal-cooperation\.ts/);
});
