import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
const calmCss = await readFile(new URL("../app/asympta-calm-ui.css", import.meta.url), "utf8");
const calmDefaults = await readFile(new URL("../components/asympta-calm-defaults.tsx", import.meta.url), "utf8");
const cardCollapse = await readFile(new URL("../components/asympta-card-collapse.tsx", import.meta.url), "utf8");
const workflowGuide = await readFile(new URL("../components/asympta-workflow-guide.tsx", import.meta.url), "utf8");
const jobMode = await readFile(new URL("../components/asympta-job-mode.tsx", import.meta.url), "utf8");
const preferences = await readFile(new URL("../lib/asympta-user-preferences.ts", import.meta.url), "utf8");

test("the map stays the primary surface instead of opening dashboards by default", () => {
  assert.match(page, /AsymptaCalmDefaults/);
  assert.match(layout, /asympta-calm-ui\.css/);
  assert.match(calmDefaults, /header\.click\(\)/);
  assert.match(calmDefaults, /asymptaExpanded === "true"/);
  assert.match(cardCollapse, /let scheduleExpanded = false/);
  assert.match(cardCollapse, /applySchedule\(false\)/);
  assert.doesNotMatch(cardCollapse, /applySchedule\(!isMobile\(\)\)/);
  assert.doesNotMatch(workflowGuide, /if \(consoleCard\.classList\.contains\("is-collapsed"\)\)/);
});

test("only one detailed information surface can own the map at a time", () => {
  assert.match(cardCollapse, /if \(expanded && menuIsOpen\(\)\)/);
  assert.match(cardCollapse, /if \(menuIsOpen\(\) && scheduleExpanded\) applySchedule\(false\)/);
  assert.match(cardCollapse, /if \(menuIsOpen\(\)\) applySchedule\(false\)/);
});

test("default visual hierarchy hides duplicate telemetry and ambient chatter", () => {
  assert.match(calmCss, /atlas-status-stack > \.atlas-tool-state \{ display: none; \}/);
  assert.match(calmCss, /atlas-resource-ledger \{ display: none; \}/);
  assert.match(calmCss, /:has\(\.atlas-webmcp-inspector\) \.atlas-resource-ledger/);
  assert.match(calmCss, /atlas-safe-resources \{ display: none !important; \}/);
  assert.match(calmCss, /animal-map-marker--ambient \.animal-map-marker__dialogue/);
  assert.match(calmCss, /animal-map-marker--foreground:not\(\.is-selected\)/);
  assert.match(calmCss, /map-zoom \{ display: none !important; \}/);
});

test("workflow picker remains compact even with automatic Job Mode", () => {
  assert.match(calmCss, /grid-template-columns: repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(calmCss, /atlas-workflow > span:last-child \{ display: none; \}/);
  assert.match(calmCss, /asympta-job-mode__tile > span:last-child/);
});

test("Job Mode is automatic by default, persistent, and can be switched off", () => {
  assert.match(preferences, /autoJobMode: boolean/);
  assert.match(preferences, /autoJobMode: true/);
  assert.match(jobMode, /AUTO_POLL_MS = 700/);
  assert.match(jobMode, /AUTO_NEXT_JOB_DELAY_MS = 2_200/);
  assert.match(jobMode, /writeAsymptaUserPreferences\(\{ autoJobMode: enabled \}\)/);
  assert.match(jobMode, /aria-pressed=\{autoJobMode\}/);
  assert.match(jobMode, /setAuto\(false\)/);
});
