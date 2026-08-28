import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { SCENARIOS, SCENARIO_ORDER } from "../lib/living-world/scenarios.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFile(path.join(root, relative), "utf8");

test("four focused scenarios use distinct animals, art directions and explicit service modes", () => {
  assert.deepEqual(SCENARIO_ORDER, ["dinner", "work", "shopping", "email"]);
  const scenarios = Object.values(SCENARIOS);
  const agents = scenarios.flatMap((scenario) => scenario.agents);
  assert.equal(agents.length, 17);
  assert.equal(new Set(agents.map((agent) => agent.species)).size, 17);
  assert.equal(new Set(agents.map((agent) => agent.art.style)).size, 17);
  assert.equal(new Set(agents.map((agent) => agent.id)).size, 17);
  scenarios.forEach((scenario) => {
    assert.ok(scenario.tasks.length >= 6);
    assert.ok(scenario.services.length >= 3);
    assert.ok(scenario.services.every((service) => ["live", "demo", "simulated"].includes(service.mode)));
    assert.equal(scenario.result.secondaryAction.consequential, true);
    assert.match(scenario.result.disclosure.en, /simulated/i);
  });
});

test("English is the default and Traditional Chinese remains a first-class menu choice", async () => {
  const [layout, app, runtime] = await Promise.all([
    read("app/layout.tsx"),
    read("components/living-world/living-world-app.tsx"),
    read("components/living-world/use-living-world.ts"),
  ]);
  assert.match(layout, /<html lang="en"/);
  assert.match(runtime, /return "en"/);
  assert.match(runtime, /asympta-world-locale-v1/);
  assert.match(app, />English</);
  assert.match(app, />繁中</);
  assert.match(app, /\/繁中/);
});

test("conversation is the primary action surface with a complete slash command system", async () => {
  const app = await read("components/living-world/living-world-app.tsx");
  for (const command of [
    "/dinner", "/work", "/shopping", "/email", "/watch", "/location",
    "/services", "/context", "/progress", "/follow", "/english", "/繁中", "/reset",
  ]) {
    assert.ok(app.includes(command), `missing ${command}`);
  }
  assert.match(app, /id="need-composer"/);
  assert.match(app, /role="listbox"/);
  assert.match(app, /ArrowDown/);
  assert.match(app, /Enter select/);
  assert.match(app, /Open WebMCP actions/);
});

test("WebMCP tools are imperative, schema-driven, bounded and human-gated", async () => {
  const runtime = await read("components/living-world/use-living-world.ts");
  const names = [
    "asympta_observe_coordination", "asympta_list_local_services", "asympta_submit_need",
    "asympta_exchange_information", "asympta_request_action",
  ];
  names.forEach((name) => assert.ok(runtime.includes(`name: "${name}"`)));
  assert.match(runtime, /document\.modelContext\?\.registerTool/);
  assert.match(runtime, /readOnlyHint: true/);
  assert.match(runtime, /untrustedContentHint: true/);
  assert.match(runtime, /maxLength: 320/);
  assert.match(runtime, /maxLength: 180/);
  assert.match(runtime, /Both agent IDs must belong to the active team/);
  assert.match(runtime, /No result is ready yet/);
  assert.match(runtime, /validActionIds/);
});

test("Three.js, vGPU and p5.js have separate performance-bounded responsibilities", async () => {
  const [stage, three, vgpu, p5, performanceGate, packageJson] = await Promise.all([
    read("components/living-world/world-stage.tsx"),
    read("components/living-world/three-world-canvas.tsx"),
    read("components/living-world/vgpu-world-field.tsx"),
    read("components/living-world/p5-atmosphere-canvas.tsx"),
    read("lib/living-world/visual-performance.ts"),
    read("package.json"),
  ]);
  assert.match(stage, /<VgpuWorldField/);
  assert.match(stage, /<ThreeWorldCanvas/);
  assert.match(stage, /<P5AtmosphereCanvas/);
  assert.match(three, /import\("three"\)/);
  assert.match(three, /powerPreference: "low-power"/);
  assert.match(three, /allowsVisualEnhancement/);
  assert.match(three, /scheduleIdleTask/);
  assert.match(three, /data-visual-engine="three\.js"/);
  assert.match(vgpu, /import\("vgpu"\)/);
  assert.match(vgpu, /powerPreference: "low-power"/);
  assert.match(vgpu, /\{ fps: 12 \}/);
  assert.match(vgpu, /dpr: 1/);
  assert.match(vgpu, /minWidth: 960/);
  assert.match(vgpu, /minMemory: 4/);
  assert.match(vgpu, /requireWebGpu: true/);
  assert.match(vgpu, /visibilitychange/);
  assert.match(vgpu, /data-visual-engine="vgpu"/);
  assert.match(p5, /import\("p5"\)/);
  assert.match(p5, /allowsVisualEnhancement/);
  assert.match(p5, /scheduleIdleTask/);
  assert.match(p5, /data-visual-engine="p5\.js"/);
  assert.match(p5, /dataset\.vgpuWorld !== "active"/);
  assert.match(p5, /current\.messages/);
  assert.match(p5, /celebrationUntil/);
  assert.match(performanceGate, /prefers-reduced-motion: reduce/);
  assert.match(performanceGate, /connection\?\.saveData/);
  assert.match(performanceGate, /deviceMemory >= minMemory/);
  assert.match(performanceGate, /requestIdleCallback/);
  assert.match(packageJson, /"three":/);
  assert.match(packageJson, /"p5":/);
  assert.match(packageJson, /"vgpu":/);
});

test("location is continuously grouped without rendering exact coordinates", async () => {
  const [runtime, geography, stage] = await Promise.all([
    read("components/living-world/use-living-world.ts"),
    read("lib/poetic-geography.ts"),
    read("components/living-world/world-stage.tsx"),
  ]);
  assert.match(runtime, /watchPosition/);
  assert.match(runtime, /enableHighAccuracy: false/);
  assert.match(runtime, /locationContextForCoordinates/);
  assert.match(geography, /LOCAL_AREA_GROUP_SIDE = 5/);
  assert.match(geography, /poeticAreaForCell/);
  assert.doesNotMatch(stage, /latitude|longitude|coords\./i);
});

test("the responsive shell preserves safe areas, focus and reduced motion", async () => {
  const css = await read("app/globals.css");
  for (const marker of [
    "@media (max-width: 1260px)", "@media (max-width: 1080px)",
    "@media (max-width: 760px)", "@media (max-width: 430px)",
    "@media (max-height: 500px)",
    "@media (prefers-reduced-motion: reduce)", "env(safe-area-inset-top)",
    "env(safe-area-inset-bottom)", "button:focus-visible", ".command-list",
  ]) {
    assert.ok(css.includes(marker), `missing responsive rule: ${marker}`);
  }
  assert.match(css, /body\s*\{[\s\S]*?overflow:\s*hidden/);
  assert.match(css, /\.conversation-dock/);
  assert.match(css, /\.conversation-dock\.has-commands/);
});

test("only the rebuilt product surface is mounted", async () => {
  const [page, template] = await Promise.all([read("app/page.tsx"), read("app/template.tsx")]);
  assert.match(page, /LivingWorldApp/);
  assert.doesNotMatch(page, /Runtime|Overlay|Simulation/);
  assert.match(template, /return children/);
});
