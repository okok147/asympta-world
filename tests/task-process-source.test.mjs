import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

test("classifies different user goals into visible task-specific process plans", async () => {
  const source = await readFile(
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
    assert.match(source, new RegExp(kind + ": \\{"));
  }

  for (const label of [
    "Reading the food request",
    "Building the web experience",
    "Analyzing the evidence",
    "Building the automation",
    "Diagnosing the issue",
  ]) {
    assert.match(source, new RegExp(label));
  }

  assert.match(source, /asympta:task-process/);
  assert.match(source, /task-process-bubble/);
  assert.match(source, /Task process/);
});

test("persists task outputs and merges them with real city inventory", async () => {
  const source = await readFile(
    path.join(root, "components/task-process-runtime.tsx"),
    "utf8",
  );

  assert.match(source, /asympta-task-inventory-v1/);
  assert.match(source, /awardedSubtaskIds/);
  assert.match(source, /asympta:task-inventory-updated/);
  assert.match(source, /externalInventory/);
  assert.match(source, /externalServices/);
  assert.match(source, /combinedInventory/);
  assert.match(source, /Inventory/);
  assert.match(source, /Current output/);
});

test("gives the current user unlimited demo credits without making resident wallets unlimited", async () => {
  const source = await readFile(path.join(root, "lib/latent-city.ts"), "utf8");

  assert.match(source, /UserCreditMode = "unlimited" \| "metered"/);
  assert.match(source, /userCreditMode: "unlimited"/);
  assert.match(source, /userHasUnlimitedCredits/);
  assert.match(source, /Number\.MAX_SAFE_INTEGER/);
  assert.match(source, /if \(!userHasUnlimitedCredits\) next\.externalCredits -= credits/);
  assert.match(source, /agent\.wallet -= credits/);
});

test("docks the zoom control away from dialogue and mounts all new runtimes", async () => {
  const [dock, template] = await Promise.all([
    readFile(path.join(root, "components/zoom-control-dock.tsx"), "utf8"),
    readFile(path.join(root, "app/template.tsx"), "utf8"),
  ]);

  assert.match(dock, /top: 50% !important/);
  assert.match(dock, /translate\(-31px, -50%\)/);
  assert.match(dock, /opacity: \.18/);
  assert.match(dock, /hover/);
  assert.match(template, /<TaskProcessRuntime \/>/);
  assert.match(template, /<ZoomControlDock \/>/);
});
