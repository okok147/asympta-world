import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const automation = await readFile(new URL("../components/asympta-schedule-automation-controls.tsx", import.meta.url), "utf8");
const cardLocale = await readFile(new URL("../components/asympta-agent-card-locale.tsx", import.meta.url), "utf8");
const automationCss = await readFile(new URL("../app/asympta-schedule-automation.css", import.meta.url), "utf8");

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

test("bottom-left agent card localization stays display-only and language-aware", () => {
  assert.match(page, /AsymptaAgentCardLocale/);
  assert.match(cardLocale, /document\.documentElement\.lang/);
  assert.match(cardLocale, /data\.asymptaLocalized|dataset\.asymptaLocalized/);
  assert.match(cardLocale, /個人需求代理/);
  assert.match(cardLocale, /個人意図エージェント/);
  assert.match(cardLocale, /TASKS/);
  assert.doesNotMatch(cardLocale, /requestAnimationFrame|MutationObserver|advanceAtlasWorld|JSON\.parse\(JSON\.stringify/);
});
