import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createAtlasDemoWorld,
  prepareAtlasDemoWorkflowReset,
} from "../lib/atlas-demo.ts";

const boundary = await readFile(new URL("../components/asympta-workflow-runtime-boundary.tsx", import.meta.url), "utf8");
const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const celebration = await readFile(new URL("../components/asympta-task-celebration.tsx", import.meta.url), "utf8");

test("verified completion is captured before scoped workflow runtimes remount", () => {
  assert.match(boundary, /subscribeAsymptaCompletionReceipts/);
  assert.match(boundary, /queueMicrotask\(\(\) =>/);
  assert.match(boundary, /prepareAtlasDemoWorkflowReset\(\)/);
  assert.match(boundary, /setGeneration\(\(value\) => value \+ 1\)/);
  assert.match(boundary, /<Fragment key=\{generation\}>\{children\}<\/Fragment>/);
  assert.match(boundary, /ASYMPTA_WORKFLOW_RUNTIME_RESET_EVENT/);
});

test("completion reset consumes exactly one clean idle demo world", () => {
  const initial = createAtlasDemoWorld(1_000);
  assert.equal(initial.phase, "running", "initial page demo should retain visible foreground activity");

  prepareAtlasDemoWorkflowReset();
  const reset = createAtlasDemoWorld(2_000);
  assert.equal(reset.phase, "idle");
  assert.equal(reset.tasks.length, 0);
  assert.equal(reset.approvals.length, 0);

  const laterFreshMount = createAtlasDemoWorld(3_000);
  assert.equal(laterFreshMount.phase, "running", "the idle reset is one-shot, not a permanent demo mode change");
});

test("runtime state resets without moving persistent coordinator, preferences, or celebration", () => {
  const coreOpen = page.indexOf("<AsymptaWorkflowRuntimeBoundary prepareWorldReset emitResetSignal>");
  const coreClose = page.indexOf("</AsymptaWorkflowRuntimeBoundary>", coreOpen);
  assert.ok(coreOpen >= 0 && coreClose > coreOpen, "core workflow reset scope should exist");

  const core = page.slice(coreOpen, coreClose);
  assert.match(core, /<AsymptaWorldLive60Hz \/>/);
  assert.match(core, /<AsymptaTaskKernelBridge \/>/);
  assert.match(core, /<AsymptaIntentComposer \/>/);
  assert.match(core, /<AsymptaMarketplaceIntentBridge \/>/);
  assert.doesNotMatch(core, /<AsymptaCompletionCoordinator \/>/);
  assert.doesNotMatch(core, /<AsymptaUserPreferences \/>/);
  assert.doesNotMatch(core, /<AsymptaTaskCelebration \/>/);

  const coordinator = page.indexOf("<AsymptaCompletionCoordinator />", coreClose);
  const preferences = page.indexOf("<AsymptaUserPreferences />", coordinator);
  const secondaryOpen = page.indexOf("<AsymptaWorkflowRuntimeBoundary>", preferences);
  const secondaryClose = page.indexOf("</AsymptaWorkflowRuntimeBoundary>", secondaryOpen);
  const taskCelebration = page.indexOf("<AsymptaTaskCelebration />", secondaryClose);

  assert.ok(coordinator > coreClose);
  assert.ok(preferences > coordinator);
  assert.ok(secondaryOpen > preferences && secondaryClose > secondaryOpen);
  assert.ok(taskCelebration > secondaryClose);
  assert.match(page.slice(secondaryOpen, secondaryClose), /<AsymptaSafeSchedule \/>/);
});

test("the completion card remains independently mounted and clears only when a new workflow starts", () => {
  assert.match(celebration, /subscribeAsymptaCompletionReceipts/);
  assert.match(celebration, /createScreenCelebration\(receipt\)/);
  assert.match(celebration, /subscribeAsymptaWorkflowStarts/);
  assert.match(celebration, /removeScreenCelebration\(activeOverlay\)/);
});
