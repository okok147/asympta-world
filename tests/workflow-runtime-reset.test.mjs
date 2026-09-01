import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const boundary = await readFile(new URL("../components/asympta-workflow-runtime-boundary.tsx", import.meta.url), "utf8");
const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const celebration = await readFile(new URL("../components/asympta-task-celebration.tsx", import.meta.url), "utf8");

test("verified completion is captured before the workflow runtime remounts", () => {
  assert.match(boundary, /subscribeAsymptaCompletionReceipts/);
  assert.match(boundary, /queueMicrotask\(\(\) =>/);
  assert.match(boundary, /setGeneration\(\(value\) => value \+ 1\)/);
  assert.match(boundary, /<Fragment key=\{generation\}>\{children\}<\/Fragment>/);
  assert.match(boundary, /ASYMPTA_WORKFLOW_RUNTIME_RESET_EVENT/);
});

test("runtime state resets without unmounting the completion coordinator or celebration card", () => {
  const open = page.indexOf("<AsymptaWorkflowRuntimeBoundary>");
  const close = page.indexOf("</AsymptaWorkflowRuntimeBoundary>");
  assert.ok(open >= 0 && close > open, "runtime boundary should wrap the task runtime");

  const runtime = page.slice(open, close);
  const persistent = page.slice(close);

  assert.match(runtime, /<AsymptaWorldLive60Hz \/>/);
  assert.match(runtime, /<AsymptaTaskKernelBridge \/>/);
  assert.match(runtime, /<AsymptaIntentComposer \/>/);
  assert.match(runtime, /<AsymptaMarketplaceIntentBridge \/>/);
  assert.match(runtime, /<AsymptaSafeSchedule \/>/);
  assert.doesNotMatch(runtime, /<AsymptaCompletionCoordinator \/>/);
  assert.doesNotMatch(runtime, /<AsymptaTaskCelebration \/>/);
  assert.doesNotMatch(runtime, /<AsymptaUserPreferences \/>/);

  assert.match(persistent, /<AsymptaCompletionCoordinator \/>/);
  assert.match(persistent, /<AsymptaUserPreferences \/>/);
  assert.match(persistent, /<AsymptaTaskCelebration \/>/);
});

test("the completion card remains independently mounted and clears only when a new workflow starts", () => {
  assert.match(celebration, /subscribeAsymptaCompletionReceipts/);
  assert.match(celebration, /createScreenCelebration\(receipt\)/);
  assert.match(celebration, /subscribeAsymptaWorkflowStarts/);
  assert.match(celebration, /removeScreenCelebration\(activeOverlay\)/);
});
