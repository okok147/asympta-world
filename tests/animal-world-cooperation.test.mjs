import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  createAtlasWorld,
  projectWorldCooperationToAnimals,
  startAtlasWorkflow,
} from "../lib/atlas-animal-cooperation.ts";
import { startAtlasDemoWorkflow } from "../lib/atlas-canonical-demo.ts";

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

test("idle information panels auto collapse without hiding approval checkpoints", () => {
  const source = readFileSync(new URL("../components/asympta-card-collapse.tsx", import.meta.url), "utf8");
  assert.match(source, /PANEL_AUTO_COLLAPSE_MS = 8_000/);
  assert.match(source, /scheduleExpanded && now - lastScheduleInteractionAt >= PANEL_AUTO_COLLAPSE_MS/);
  assert.match(source, /menuIsOpen\(\) && now - lastMenuInteractionAt >= PANEL_AUTO_COLLAPSE_MS/);
  assert.match(source, /setMenuOpen\(false\)/);
  assert.doesNotMatch(source, /atlas-approval/);
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
