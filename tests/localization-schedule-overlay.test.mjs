import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  localizeAtlasSnapshot,
  localizeDynamicText,
  localizeTask,
  normalizeAtlasLocale,
} from "../lib/atlas-i18n.ts";

const overlay = await readFile(new URL("../components/asympta-runtime-overlay.tsx", import.meta.url), "utf8");
const client = await readFile(new URL("../lib/atlas-simulation-client.ts", import.meta.url), "utf8");
const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/asympta-scheduler-overlay.css", import.meta.url), "utf8");
const tsconfig = await readFile(new URL("../tsconfig.json", import.meta.url), "utf8");

test("locale context covers dynamic task, obstacle and scheduler values", () => {
  assert.equal(normalizeAtlasLocale("zh-Hant-HK"), "zh-Hant");
  assert.equal(normalizeAtlasLocale("ja-JP"), "ja");
  assert.equal(localizeTask("co-supply", "zh-Hant", "Check supplier capacity").title, "檢查供應商產能");
  assert.match(localizeDynamicText("Obstacle → supplier reply pending (+2s)", "zh-Hant"), /障礙.*等待供應商回覆/);

  const localized = localizeAtlasSnapshot({
    phase: "running",
    workflow: "Custom Order Network",
    tasks: [{ id: "co-supply", title: "Check supplier capacity", agentId: "agent-supplier", status: "working", progress: 0.7, scheduleHealth: "obstacle", etaSeconds: 4, obstacle: "supplier reply pending" }],
    agents: [{ id: "agent-supplier", name: "Sora", side: "supplier", role: "Supplier agent", status: "working", taskId: "co-supply" }],
    pendingApprovals: [],
    messages: [],
    recentEvents: [],
    scheduler: { exploreMode: true, active: [{ id: "co-supply", title: "Check supplier capacity", agentId: "agent-supplier", status: "working", health: "obstacle", eta: "4s", obstacle: "supplier reply pending" }] },
  }, "zh-Hant");

  assert.equal(localized.workflow, "客製訂單協作");
  assert.equal(localized.tasks[0].title, "檢查供應商產能");
  assert.equal(localized.tasks[0].obstacle, "等待供應商回覆");
  assert.equal(localized.agents[0].role, "供應商代理");
  assert.equal(localized.scheduler.active[0].healthLabel, "有障礙");
});

test("renderer is connected to the localized scheduler client runtime", () => {
  const config = JSON.parse(tsconfig);
  assert.deepEqual(config.compilerOptions.paths["@/lib/atlas-simulation"], ["./lib/atlas-simulation-client.ts"]);
  assert.match(client, /advanceAtlasWorld\(current/);
  assert.match(client, /setExplorePreference/);
  assert.match(client, /localizeAtlasSnapshot/);
  assert.match(client, /__ASYMPTA_EXPLORE_MODE__/);
});

test("Explore Mode is visible bottom-left and schedule is visible top-right without replacing the map", () => {
  assert.match(page, /AsymptaWorldLive60Hz/);
  assert.match(page, /AsymptaRuntimeOverlay/);
  assert.match(overlay, /atlas-explore-float/);
  assert.match(overlay, /atlas-schedule-float/);
  assert.match(overlay, /window\.__ASYMPTA_DEMO__\?\.advance\(0\)/);
  assert.match(overlay, /scheduler\?\.exploreMode/);
  assert.match(overlay, /scheduler\?\.active/);
  assert.match(css, /\.atlas-schedule-float[\s\S]*right:/);
  assert.match(css, /\.atlas-explore-float[\s\S]*left:/);
  assert.match(css, /data-menu-open="true"/);
  assert.match(css, /data-agent-card="true"/);
  assert.match(css, /data-approval="true"/);
});

test("language change propagates into existing UI, agent context, WebMCP JSON and map labels", () => {
  assert.match(overlay, /document\.documentElement\.lang/);
  assert.match(overlay, /animal-map-marker__dialogue/);
  assert.match(overlay, /animal-map-marker__status-text/);
  assert.match(overlay, /atlas-agent-card/);
  assert.match(overlay, /atlas-approval/);
  assert.match(overlay, /atlas-webmcp-tool-list/);
  assert.match(overlay, /atlas-json-grid pre/);
  assert.match(overlay, /permissionLabel/);
  assert.match(layout, /setLayoutProperty\(layer\.id, "text-field", expression\)/);
  assert.match(layout, /MutationObserver/);
  assert.match(layout, /name:zh/);
  assert.match(layout, /name:ja/);
});
