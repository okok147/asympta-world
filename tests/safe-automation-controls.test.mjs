import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const automation = await readFile(new URL("../components/asympta-schedule-automation-controls.tsx", import.meta.url), "utf8");
const cardLocale = await readFile(new URL("../components/asympta-agent-card-locale.tsx", import.meta.url), "utf8");
const estimatedProgress = await readFile(new URL("../components/asympta-estimated-progress.tsx", import.meta.url), "utf8");
const processFollow = await readFile(new URL("../components/asympta-process-camera-follow.tsx", import.meta.url), "utf8");
const celebration = await readFile(new URL("../components/asympta-task-celebration.tsx", import.meta.url), "utf8");
const celebrationCss = await readFile(new URL("../app/asympta-task-celebration.css", import.meta.url), "utf8");
const progressMath = await readFile(new URL("../lib/atlas-display-progress.ts", import.meta.url), "utf8");
const automationCss = await readFile(new URL("../app/asympta-schedule-automation.css", import.meta.url), "utf8");
const progressCss = await readFile(new URL("../app/asympta-estimated-progress.css", import.meta.url), "utf8");

test("auto explore and auto approve live inside the schedule card without high-frequency work", () => {
  assert.match(page, /AsymptaScheduleAutomationControls/);
  assert.match(automation, /createPortal/);
  assert.match(automation, /\.atlas-safe-schedule/);
  assert.match(automation, /CONTROL_REFRESH_MS = 700/);
  assert.match(automation, /EXPLORE_HANDOFF_DELAY_MS = 1_600/);
  assert.match(automation, /const \[autoExplore, setAutoExplore\] = useState\(true\)/);
  assert.match(automation, /const \[autoApprove, setAutoApprove\] = useState\(false\)/);
  assert.match(automation, /api\.approve\(approval\.id, true\)/);
  assert.match(automation, /foreground\.phase !== "completed"/);
  assert.match(automation, /api\.startWorkflow\(nextWorkflow\(foreground\.workflow\)\)/);
  assert.match(automationCss, /atlas-safe-automation/);
  assert.doesNotMatch(automation, /requestAnimationFrame|MutationObserver|advanceAtlasWorld|JSON\.parse\(JSON\.stringify/);
});

test("workflow tiles only enable process camera lock and do not reach the original workflow starter", () => {
  assert.match(page, /AsymptaProcessCameraFollow/);
  assert.match(processFollow, /closest\("\.atlas-workflow"\)/);
  assert.match(processFollow, /event\.preventDefault\(\)/);
  assert.match(processFollow, /event\.stopPropagation\(\)/);
  assert.match(processFollow, /asymptaProcessCameraLock = "on"/);
  assert.match(processFollow, /FOLLOW_REFRESH_MS = 450/);
  assert.match(processFollow, /ACTIVE_STATUSES = \["working", "moving", "waiting_approval"\]/);
  assert.match(processFollow, /activeMap\.on\("dragstart", disableProcessLock\)/);
  assert.match(processFollow, /clickAgent\(nextAgentId\)/);
  assert.doesNotMatch(processFollow, /startWorkflow|advanceAtlasWorld|requestAnimationFrame|MutationObserver|JSON\.parse\(JSON\.stringify/);
});

test("bottom-left agent card localization stays display-only and language-aware", () => {
  assert.match(page, /AsymptaAgentCardLocale/);
  assert.match(cardLocale, /document\.documentElement\.lang/);
  assert.match(cardLocale, /data\.asymptaLocalized|dataset\.asymptaLocalized/);
  assert.match(cardLocale, /個人需求代理/);
  assert.match(cardLocale, /個人意図エージェント/);
  assert.match(cardLocale, /TASKS/);
  assert.doesNotMatch(cardLocale, /requestAnimationFrame|MutationObserver|advanceAtlasWorld|JSON\.parse\(JSON\.stringify/);
});

test("status percentage uses the actual moving origin plus work time without changing engine progress", () => {
  assert.match(page, /AsymptaEstimatedProgress/);
  assert.match(progressMath, /TRAVEL_DEGREES_PER_MS = 0\.0000028/);
  assert.match(progressMath, /currentTaskTravelDistance/);
  assert.match(progressMath, /actualTravelOriginDistance/);
  assert.match(progressMath, /measuredOriginDistance/);
  assert.match(progressMath, /remainingDistance/);
  assert.match(progressMath, /completedMs \/ totalMs/);
  assert.match(progressMath, /context\.task\.workMs/);
  assert.match(estimatedProgress, /travelOriginDistanceRef/);
  assert.match(estimatedProgress, /previousStatusRef/);
  assert.match(estimatedProgress, /task\.status === "moving" && previousStatus !== "moving"/);
  assert.match(estimatedProgress, /currentTaskTravelDistance/);
  assert.match(estimatedProgress, /travelOriginDistanceRef\.current\.get\(task\.id\)/);
  assert.match(estimatedProgress, /asymptaEstimatedProgress/);
  assert.match(estimatedProgress, /asymptaEstimatedStatus/);
  assert.match(progressCss, /data-asympta-estimated-progress/);
  assert.match(progressCss, /data-asympta-estimated-status/);
  assert.doesNotMatch(estimatedProgress, /requestAnimationFrame|MutationObserver|advanceAtlasWorld|JSON\.parse\(JSON\.stringify/);
});

test("completed tasks trigger one bounded celebration burst without touching the animation loop", () => {
  assert.match(page, /AsymptaTaskCelebration/);
  assert.match(celebration, /CELEBRATION_SYNC_MS = 280/);
  assert.match(celebration, /CELEBRATION_LIFETIME_MS = 1_150/);
  assert.match(celebration, /task\.status === "done" && previous && previous !== "done"/);
  assert.match(celebration, /\.asympta-task-celebration/);
  assert.match(celebration, /window\.setTimeout\(\(\) => burst\.remove\(\), CELEBRATION_LIFETIME_MS\)/);
  assert.match(celebrationCss, /asympta-celebration-ring/);
  assert.match(celebrationCss, /asympta-celebration-particle/);
  assert.match(celebrationCss, /prefers-reduced-motion/);
  assert.doesNotMatch(celebration, /requestAnimationFrame|MutationObserver|advanceAtlasWorld|JSON\.parse\(JSON\.stringify/);
});
