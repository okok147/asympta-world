import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

test("gives the current user unlimited sandbox credits without changing resident wallets", async () => {
  const city = await readFile(path.join(root, "lib/latent-city.ts"), "utf8");
  assert.match(city, /externalUnlimitedCredits: boolean/);
  assert.match(city, /externalUnlimitedCredits: true/);
  assert.match(city, /Number\.POSITIVE_INFINITY/);
  assert.match(city, /if \(!next\.externalUnlimitedCredits\) next\.externalCredits -= credits/);
  assert.match(city, /agent\.wallet -= credits/);
  assert.match(city, /item\.stock -= quantity/);
  assert.match(city, /externalInventory\[item\.id\]/);
  assert.match(city, /externalServices\[item\.id\]/);
});

test("classifies user goals into distinct visible task processes", async () => {
  const runtime = await readFile(
    path.join(root, "components/task-process-runtime.tsx"),
    "utf8",
  );

  for (const kind of [
    "food",
    "delivery",
    "research",
    "design",
    "web",
    "automation",
    "learning",
    "repair",
    "business",
    "generic",
  ]) {
    assert.match(runtime, new RegExp(kind + ": \\{"));
  }

  for (const process of [
    "Reading the food request",
    "Completing delivery",
    "Analyzing the evidence",
    "Creating the design",
    "Building the web experience",
    "Building the automation",
    "Practicing the skill",
    "Diagnosing the issue",
  ]) {
    assert.match(runtime, new RegExp(process));
  }

  assert.match(runtime, /taskKind\(mission\.title \+ " " \+ mission\.description\)/);
  assert.match(runtime, /processLabel/);
  assert.match(runtime, /asympta:task-process/);
  assert.match(runtime, /task-process-bubble/);
  assert.match(runtime, /Task process/);
});

test("updates persistent inventory after each completed task stage and merges city resources", async () => {
  const [runtime, template] = await Promise.all([
    readFile(path.join(root, "components/task-process-runtime.tsx"), "utf8"),
    readFile(path.join(root, "app/template.tsx"), "utf8"),
  ]);

  assert.match(runtime, /asympta-task-inventory-v1/);
  assert.match(runtime, /awardedSubtaskIds/);
  assert.match(runtime, /subtask\.status !== "completed"/);
  assert.match(runtime, /asympta:task-inventory-updated/);
  assert.match(runtime, /externalInventory/);
  assert.match(runtime, /externalServices/);
  assert.match(runtime, /combinedInventory/);
  assert.match(runtime, /Inventory/);
  assert.match(runtime, /Current output/);
  assert.match(runtime, /∞ credits/);
  assert.match(template, /<TaskProcessRuntime \/>/);
  assert.doesNotMatch(template, /<UserTaskProcessRuntime \/>/);
});

test("keeps zoom controls out of the lower conversation and composer region", async () => {
  const perception = await readFile(
    path.join(root, "components/asympta-perception-system.tsx"),
    "utf8",
  );
  assert.match(perception, /top: max\(14px, env\(safe-area-inset-top\)\)/);
  assert.match(perception, /bottom: auto/);
  assert.match(perception, /opacity: \.46/);
  assert.match(perception, /focus-within/);
});
