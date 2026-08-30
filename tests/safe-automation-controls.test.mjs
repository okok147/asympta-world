import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
const controller = await readFile(new URL("../components/asympta-intent-world.tsx", import.meta.url), "utf8");
const view = await readFile(new URL("../components/asympta-intent-world-view.tsx", import.meta.url), "utf8");
const bridge = await readFile(new URL("../components/asympta-intent-world-bridge.ts", import.meta.url), "utf8");
const intentEngine = await readFile(new URL("../lib/intent-world/engine.ts", import.meta.url), "utf8");
const runtimeCss = await readFile(new URL("../app/asympta-intent-runtime.css", import.meta.url), "utf8");
const automation = await readFile(new URL("../components/asympta-schedule-automation-controls.tsx", import.meta.url), "utf8");
const processFollow = await readFile(new URL("../components/asympta-process-camera-follow.tsx", import.meta.url), "utf8");
const cardCollapse = await readFile(new URL("../components/asympta-card-collapse.tsx", import.meta.url), "utf8");
const resourceLedger = await readFile(new URL("../components/asympta-resource-ledger.tsx", import.meta.url), "utf8");
const workflowGuide = await readFile(new URL("../components/asympta-workflow-guide.tsx", import.meta.url), "utf8");
const celebration = await readFile(new URL("../components/asympta-task-celebration.tsx", import.meta.url), "utf8");
const progressMath = await readFile(new URL("../lib/atlas-display-progress.ts", import.meta.url), "utf8");

test("the product entry point contains no preset workflow or legacy automation mount", () => {
  assert.match(page, /AsymptaIntentWorld/);
  assert.doesNotMatch(page, /AsymptaScheduleAutomationControls/);
  assert.doesNotMatch(page, /AsymptaProcessCameraFollow/);
  assert.doesNotMatch(page, /AsymptaCardCollapse/);
  assert.doesNotMatch(page, /AsymptaResourceLedger/);
  assert.doesNotMatch(page, /AsymptaWorkflowGuide/);
  assert.doesNotMatch(page, /AsymptaEstimatedProgress/);
  assert.doesNotMatch(page, /AsymptaTaskCelebration/);
  assert.match(view, /intent-composer/);
  assert.match(view, /copy\.commandTitle/);
  assert.match(view, /There are no preset workflows|copy\.noPlanBody/);
});

test("persistent language and auto-run preferences are subscribed without mount-effect state writes", () => {
  assert.match(controller, /useSyncExternalStore/);
  assert.match(controller, /readPreferenceSnapshot/);
  assert.match(controller, /subscribePreferenceSnapshot/);
  assert.match(controller, /writeAsymptaUserPreferences\(\{ autoExplore: next \}\)/);
  assert.match(controller, /writeAsymptaUserPreferences\(\{ locale: next \}\)/);
  assert.match(controller, /document\.documentElement\.lang = next/);
  assert.doesNotMatch(controller, /setLocale\(|setAutoRun\(/);
  assert.match(view, /繁體中文/);
  assert.match(view, /日本語/);
});

test("WebMCP may submit and inspect intentions but cannot grant consequential approval", () => {
  assert.match(bridge, /asympta_submit_intent/);
  assert.match(bridge, /asympta_observe_world/);
  assert.match(bridge, /asympta_get_pending_approval/);
  assert.match(bridge, /Consequential approvals remain human-only/);
  assert.doesNotMatch(bridge, /name:\s*"asympta_(?:approve|decline)/);
  assert.match(view, /onApproval\(pendingApproval\.id, false\)/);
  assert.match(view, /onApproval\(pendingApproval\.id, true\)/);
  assert.match(controller, /resolveIntentApproval/);
});

test("progress and completion UI project canonical validated world state", () => {
  assert.match(controller, /intentWorldProgress\(world\)/);
  assert.match(view, /Math\.round\(progress \* 100\)/);
  assert.match(view, /world\.tasks\.map/);
  assert.match(intentEngine, /validateIntentWorldState/);
  assert.match(intentEngine, /commitCandidate/);
  assert.match(intentEngine, /candidate\.revision = previous\.revision \+ 1/);
  assert.match(intentEngine, /task\.progress = Math\.min\(1/);
  assert.match(progressMath, /completedMs \/ totalMs/);
  assert.match(progressMath, /actualTravelOriginDistance/);
});

test("legacy control modules remain bounded compatibility code and stay unmounted", () => {
  assert.match(automation, /CONTROL_REFRESH_MS = 700/);
  assert.match(automation, /EXPLORE_HANDOFF_DELAY_MS = 1_600/);
  assert.doesNotMatch(automation, /requestAnimationFrame|MutationObserver|advanceAtlasWorld|JSON\.parse\(JSON\.stringify/);
  assert.match(processFollow, /FOLLOW_REFRESH_MS = 450/);
  assert.doesNotMatch(processFollow, /startWorkflow|advanceAtlasWorld|requestAnimationFrame|MutationObserver|JSON\.parse\(JSON\.stringify/);
  assert.match(cardCollapse, /AGENT_AUTO_COLLAPSE_MS = 5_500/);
  assert.match(cardCollapse, /MOBILE_MAX_WIDTH = 700/);
  assert.doesNotMatch(cardCollapse, /requestAnimationFrame|MutationObserver|advanceAtlasWorld|JSON\.parse\(JSON\.stringify/);
  assert.match(resourceLedger, /foreground\.runtime/);
  assert.match(resourceLedger, /invariantViolations/);
  assert.doesNotMatch(resourceLedger, /resourceDeltaForTask|taskFraction|SIDE_COMPUTE/);
  assert.match(workflowGuide, /點選任一流程開始/);
  assert.match(celebration, /CELEBRATION_LIFETIME_MS = 1_150/);
});

test("stable cat favicon and reduced-motion support replace legacy runtime patching", () => {
  assert.match(layout, /favicon-asympta-cat-20260829\.svg/);
  assert.match(layout, /shortcut: faviconPath/);
  assert.match(layout, /viewportFit: "cover"/);
  assert.doesNotMatch(layout, /requestedZoom \+ 2|faviconDataUrl|ASYMPTA_FAVICON_REFRESH/);
  assert.match(runtimeCss, /prefers-reduced-motion: reduce/);
  assert.match(runtimeCss, /transition-duration: 0\.001ms/);
});
