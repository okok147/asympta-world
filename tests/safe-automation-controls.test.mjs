import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
const automation = await readFile(new URL("../components/asympta-schedule-automation-controls.tsx", import.meta.url), "utf8");
const cardLocale = await readFile(new URL("../components/asympta-agent-card-locale.tsx", import.meta.url), "utf8");
const estimatedProgress = await readFile(new URL("../components/asympta-estimated-progress.tsx", import.meta.url), "utf8");
const processFollow = await readFile(new URL("../components/asympta-process-camera-follow.tsx", import.meta.url), "utf8");
const cardCollapse = await readFile(new URL("../components/asympta-card-collapse.tsx", import.meta.url), "utf8");
const resourceLedger = await readFile(new URL("../components/asympta-resource-ledger.tsx", import.meta.url), "utf8");
const workflowGuide = await readFile(new URL("../components/asympta-workflow-guide.tsx", import.meta.url), "utf8");
const collapseCss = await readFile(new URL("../app/asympta-card-collapse.css", import.meta.url), "utf8");
const resourceCss = await readFile(new URL("../app/asympta-resource-ledger.css", import.meta.url), "utf8");
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

test("workflow tiles remain native cross-browser buttons while also enabling process camera lock", () => {
  assert.match(page, /AsymptaProcessCameraFollow/);
  assert.match(processFollow, /closest\("\.atlas-workflow"\)/);
  assert.match(processFollow, /asymptaProcessCameraLock = "on"/);
  assert.match(processFollow, /document\.addEventListener\("click", enableFromWorkflowClick\)/);
  assert.match(processFollow, /window\.setTimeout\(followCurrentAgent, 0\)/);
  assert.doesNotMatch(processFollow, /preventDefault\(\)|stopPropagation\(\)|addEventListener\("click", enableFromWorkflowClick, true\)/);
  assert.match(processFollow, /FOLLOW_REFRESH_MS = 450/);
  assert.match(processFollow, /ACTIVE_STATUSES = \["working", "moving", "waiting_approval"\]/);
  assert.match(processFollow, /activeMap\.on\("dragstart", disableProcessLock\)/);
  assert.match(processFollow, /clickAgent\(nextAgentId\)/);
  assert.doesNotMatch(processFollow, /startWorkflow|advanceAtlasWorld|requestAnimationFrame|MutationObserver|JSON\.parse\(JSON\.stringify/);
});

test("mobile schedule and main menu are mutually adaptive while agent card auto-collapses", () => {
  assert.match(page, /AsymptaCardCollapse/);
  assert.match(cardCollapse, /AGENT_AUTO_COLLAPSE_MS = 5_500/);
  assert.match(cardCollapse, /MOBILE_MAX_WIDTH = 700/);
  assert.match(cardCollapse, /applySchedule\(!isMobile\(\)\)/);
  assert.match(cardCollapse, /if \(isMobile\(\) && expanded && menuIsOpen\(\)\)/);
  assert.match(cardCollapse, /setMenuOpen\(false\)/);
  assert.match(cardCollapse, /asymptaMobileDock = "below-menu"/);
  assert.match(cardCollapse, /asymptaMobileDock = "bottom"/);
  assert.match(cardCollapse, /visualViewport\?\.addEventListener\("resize"/);
  assert.match(cardCollapse, /orientationchange/);
  assert.match(collapseCss, /data-asympta-mobile-dock="below-menu"/);
  assert.match(collapseCss, /data-asympta-mobile-dock="bottom"/);
  assert.match(collapseCss, /data-asympta-mobile-panels="schedule-bottom"/);
  assert.match(collapseCss, /atlas-safe-schedule\.is-collapsed \.atlas-safe-schedule__tasks/);
  assert.match(collapseCss, /atlas-safe-schedule\.is-collapsed \.atlas-safe-automation/);
  assert.match(collapseCss, /atlas-agent-card\.is-collapsed \.atlas-agent-status/);
  assert.doesNotMatch(cardCollapse, /requestAnimationFrame|MutationObserver|advanceAtlasWorld|JSON\.parse\(JSON\.stringify/);
});

test("top-left resource ledger counts task and action effects without becoming simulation state", () => {
  assert.match(page, /AsymptaResourceLedger/);
  assert.match(layout, /asympta-resource-ledger\.css/);
  assert.match(resourceLedger, /REFRESH_MS = 500/);
  assert.match(resourceLedger, /"budget" \| "materials" \| "inventory" \| "capacity" \| "compute" \| "delivery" \| "trust"/);
  assert.match(resourceLedger, /taskFraction/);
  assert.match(resourceLedger, /task\.actionType === "reserve_capacity"/);
  assert.match(resourceLedger, /task\.actionType === "authorize_payment"/);
  assert.match(resourceLedger, /task\.actionType === "release_shipment"/);
  assert.match(resourceLedger, /task\.actionType === "send_customer_update"/);
  assert.match(resourceLedger, /SIDE_COMPUTE/);
  assert.match(resourceLedger, /算力/);
  assert.match(resourceLedger, /資金/);
  assert.match(resourceCss, /atlas-resource-ledger/);
  assert.match(resourceCss, /data-resource="compute"/);
  assert.doesNotMatch(resourceLedger, /requestAnimationFrame|MutationObserver|advanceAtlasWorld|startAtlas|resolveAtlas|JSON\.parse\(JSON\.stringify/);
});

test("default menu opens with a localized workflow-selection hint", () => {
  assert.match(page, /AsymptaWorkflowGuide/);
  assert.match(workflowGuide, /\.atlas-console/);
  assert.match(workflowGuide, /\.atlas-menu-identity/);
  assert.match(workflowGuide, /identity\.click\(\)/);
  assert.match(workflowGuide, /點選任一流程開始/);
  assert.match(workflowGuide, /ワークフローを選ぶと開始/);
  assert.match(collapseCss, /atlas-workflow-guide/);
});

test("map starts two zoom levels closer and favicon refresh bypasses the browser HTTP cache", () => {
  assert.match(layout, /requestedZoom \+ 2/);
  assert.match(layout, /favicon-asympta-cat-20260829\.svg/);
  assert.match(layout, /faviconDataUrl/);
  assert.match(layout, /data:image\/svg\+xml/);
  assert.match(layout, /ASYMPTA_FAVICON_REFRESH/);
  assert.match(layout, /querySelectorAll\('link\[rel~="icon"\]'\)/);
  assert.match(layout, /shortcut icon/);
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
