import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  createAtlasWorld,
  projectWorldCooperationToAnimals,
  startAtlasWorkflow,
} from "../lib/atlas-animal-cooperation.ts";

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
