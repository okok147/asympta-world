import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

test("registers ten focused WebMCP tools through the imperative API", async () => {
  const source = await readFile(path.join(root, "app/page.tsx"), "utf8");
  for (const tool of [
    "observe_world",
    "inspect_agent",
    "inspect_business",
    "inspect_need",
    "post_need",
    "create_offer",
    "send_message",
    "create_business",
    "join_business",
    "accept_offer",
  ]) {
    assert.match(source, new RegExp('name: "' + tool + '"'));
  }
  assert.match(source, /document\.modelContext\?\.registerTool/);
  assert.match(source, /window\.__ASYMPTA_WEBMCP__/);
  assert.match(source, /10\s+tools registered/);
});

test("routes human and WebMCP mutations through one canonical command path", async () => {
  const source = await readFile(path.join(root, "app/page.tsx"), "utf8");
  assert.match(source, /const runCommand = useCallback/);
  assert.match(source, /runCommandRef\.current\?\.\(command\)/);
  assert.match(source, /applyWorldCommand\(worldRef\.current, command/);
  assert.match(source, /method: "POST"/);
  assert.match(source, /const postHumanNeed = async/);
  assert.match(source, /invokeMutation\("post_need"/);
  assert.doesNotMatch(source, /Run Live Demo|Play demo|Start simulation/i);
});

test("uses D1 as the shared authority and a transparent local mirror fallback", async () => {
  const [store, route, hosting] = await Promise.all([
    readFile(path.join(root, "db/world-store.ts"), "utf8"),
    readFile(path.join(root, "app/api/world/route.ts"), "utf8"),
    readFile(path.join(root, ".openai/hosting.json"), "utf8"),
  ]);
  assert.match(store, /world_snapshots/);
  assert.match(store, /world_events/);
  assert.match(store, /catchUpTicks/);
  assert.match(store, /AND version = \?/);
  assert.match(route, /executeWorldCommand/);
  assert.equal(JSON.parse(hosting).d1, "DB");
});

test("ships a user-owned mission society with persistent encounters and WebMCP controls", async () => {
  const [mission, motion, template] = await Promise.all([
    readFile(path.join(root, "components/mission-society-runtime.tsx"), "utf8"),
    readFile(path.join(root, "components/continuous-agent-motion.tsx"), "utf8"),
    readFile(path.join(root, "app/template.tsx"), "utf8"),
  ]);

  for (const phase of ["approach", "greet", "discuss", "deal", "close", "depart"]) {
    assert.match(mission, new RegExp('"' + phase + '"'));
  }
  for (const tool of [
    "submit_user_goal",
    "observe_user_missions",
    "inspect_encounter",
    "nudge_mission_strategy",
  ]) {
    assert.match(mission, new RegExp('name: "' + tool + '"'));
  }
  assert.match(mission, /minDurationMs: 8200/);
  assert.match(mission, /document\.addEventListener\("submit", onSubmit, true\)/);
  assert.match(mission, /mission-user-agent/);
  assert.match(mission, /__ASYMPTA_MISSION_WEBMCP__/);
  assert.match(motion, /requestAnimationFrame\(animate\)/);
  assert.match(motion, /SOCIAL_DISTANCE/);
  assert.match(motion, /business-thought-icons/);
  assert.match(motion, /partnerSymbols/);
  assert.doesNotMatch(motion, /<strong>\{thought\.text\}<\/strong>/);
  assert.match(template, /<MissionSocietyRuntime \/>/);
});

test("defaults to a minimal agent-only canvas with icon and color status", async () => {
  const [presentation, bridge, template] = await Promise.all([
    readFile(path.join(root, "components/minimal-world-presentation.tsx"), "utf8"),
    readFile(path.join(root, "components/agent-status-color-bridge.tsx"), "utf8"),
    readFile(path.join(root, "app/template.tsx"), "utf8"),
  ]);

  for (const hidden of [
    "business-zone",
    "relationship-layer",
    "need-context",
    "live-event",
    "event-ribbon",
    "business-flow-panel",
    "mission-panel",
    "plane-grid",
  ]) {
    assert.match(presentation, new RegExp("\\." + hidden));
  }
  assert.match(presentation, /\.world-agent \.agent-label/);
  assert.match(presentation, /\.business-thought-icons svg/);
  assert.match(presentation, /\.need-composer:focus-within/);
  assert.match(bridge, /MutationObserver/);
  assert.match(bridge, /agent-state-/);
  assert.match(bridge, /business-thought--/);
  assert.match(template, /<MinimalWorldPresentation \/>/);
  assert.match(template, /<AgentStatusColorBridge \/>/);
});

test("gives only the user mission agent a persistent colored aura", async () => {
  const [aura, template] = await Promise.all([
    readFile(path.join(root, "components/user-agent-aura.tsx"), "utf8"),
    readFile(path.join(root, "app/template.tsx"), "utf8"),
  ]);

  assert.match(aura, /\.mission-user-agent::before/);
  assert.match(aura, /\.mission-user-agent::after/);
  assert.match(aura, /rgba\(121, 149, 214/);
  assert.match(aura, /is-world-encountering::before/);
  assert.match(aura, /agent-state-deal::before/);
  assert.match(aura, /agent-state-workflow::before/);
  assert.match(aura, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(aura, /\.world-agent::before/);
  assert.match(template, /<UserAgentAura \/>/);
});

test("ships an elegant user-agent control menu with progress, resources, follow camera, animal forms and concise dialogue", async () => {
  const [menu, template] = await Promise.all([
    readFile(path.join(root, "components/agent-task-menu.tsx"), "utf8"),
    readFile(path.join(root, "app/template.tsx"), "utf8"),
  ]);

  assert.match(menu, /agent-task-button/);
  assert.match(menu, /conic-gradient/);
  assert.match(menu, /Current mission/);
  assert.match(menu, /Resources/);
  assert.match(menu, /Camera follow/);
  assert.match(menu, /cameraFollow: true/);
  assert.match(menu, /asympta-user-preferences-v1/);
  assert.match(menu, /requestAnimationFrame\(animate\)/);
  assert.match(menu, /data-user-avatar/);
  for (const animal of ["cat", "fox", "rabbit", "bear"]) {
    assert.match(menu, new RegExp('"' + animal + '"'));
  }
  assert.match(template, /<AgentTaskMenu \/>/);
});

test("keeps Your Agent present before any mission and applies Asympta-style zoom perception falloff", async () => {
  const [presence, perception, template] = await Promise.all([
    readFile(path.join(root, "components/persistent-user-agent-presence.tsx"), "utf8"),
    readFile(path.join(root, "components/asympta-perception-system.tsx"), "utf8"),
    readFile(path.join(root, "app/template.tsx"), "utf8"),
  ]);

  assert.match(presence, /Your Agent/);
  assert.match(presence, /mission-user-agent/);
  assert.match(presence, /data-presence-fallback/);
  assert.match(presence, /mission-user-agent:not\(\[data-presence-fallback\]\)/);

  assert.match(perception, /DetailLevel = "overview" \| "balanced" \| "full"/);
  assert.match(perception, /PerceptionLevel = "near" \| "mid" \| "far" \| "hidden"/);
  assert.match(perception, /data-perception/);
  assert.match(perception, /data-city-detail/);
  assert.match(perception, /city-agent-thought/);
  assert.match(perception, /world-agent:not\(\.mission-user-agent\)/);
  assert.match(perception, /asympta-zoom-control/);
  assert.match(perception, /new WheelEvent\("wheel"/);
  assert.match(perception, /Zoom out/);
  assert.match(perception, /Zoom in/);

  assert.match(template, /<PersistentUserAgentPresence \/>/);
  assert.match(template, /<AsymptaPerceptionSystem \/>/);
});

test("includes responsive, safe-area, pixel-art, and reduced-motion rules", async () => {
  const css = await readFile(path.join(root, "app/globals.css"), "utf8");
  assert.match(css, /@media \(max-width: 900px\)/);
  assert.match(css, /@media \(max-width: 620px\)/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /image-rendering: pixelated/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test("ships the original pixel participant raster atlas", async () => {
  const info = await stat(path.join(root, "public/assets/agent-sprites.png"));
  assert.equal(info.isFile(), true);
  assert.ok(info.size > 10_000, "agent-sprites.png should be a real image asset");
});
