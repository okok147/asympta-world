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

test("shows real task stages above Your Agent and persists a unified inventory", async () => {
  const [runtime, template] = await Promise.all([
    readFile(path.join(root, "components/user-task-process-runtime.tsx"), "utf8"),
    readFile(path.join(root, "app/template.tsx"), "utf8"),
  ]);

  for (const stage of [
    "開始任務",
    "尋找協作者",
    "前往協作",
    "討論方案",
    "確認合作",
    "執行任務",
    "任務完成",
    "完成互動",
  ]) {
    assert.match(runtime, new RegExp(stage));
  }
  assert.match(runtime, /asympta-user-inventory-v1/);
  assert.match(runtime, /asympta-user-task-updates-v1/);
  assert.match(runtime, /syncInventory/);
  assert.match(runtime, /externalInventory/);
  assert.match(runtime, /externalServices/);
  assert.match(runtime, /missionOutputLabel/);
  assert.match(runtime, /user-task-process-chip/);
  assert.match(runtime, /bottom: calc\(100% \+ 46px\)/);
  assert.match(runtime, /∞ credits/);
  assert.match(runtime, /user-inventory-section/);
  assert.match(runtime, /user-process-history/);
  assert.match(template, /<UserTaskProcessRuntime \/>/);
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
