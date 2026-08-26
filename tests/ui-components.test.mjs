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
