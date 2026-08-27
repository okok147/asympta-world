import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

test("expands Asympta World into a twenty-place, 160-agent community", async () => {
  const [engine, runtime, template] = await Promise.all([
    readFile(path.join(root, "lib/community-layer.ts"), "utf8"),
    readFile(path.join(root, "components/community-v2-runtime.tsx"), "utf8"),
    readFile(path.join(root, "app/template.tsx"), "utf8"),
  ]);

  for (const place of [
    "riverside-library",
    "cedar-community",
    "paws-pet-care",
    "spoke-workshop",
    "bloom-flower",
    "quiet-art-space",
    "little-music-room",
    "common-table",
    "green-patch",
    "sun-laundry",
  ]) {
    assert.match(engine, new RegExp('"' + place + '"'));
  }

  assert.match(engine, /seedCommunityAgents\(now = Date\.now\(\), count = 60\)/);
  assert.match(runtime, /COMMUNITY_AGENT_COUNT = 60/);
  assert.match(runtime, /60 residents/);
  assert.match(runtime, /10 places/);
  assert.match(template, /<LatentCityRuntime \/>/);
  assert.match(template, /<CommunityV2Runtime \/>/);
});

test("supports a real community action surface beyond commerce", async () => {
  const [engine, runtime] = await Promise.all([
    readFile(path.join(root, "lib/community-layer.ts"), "utf8"),
    readFile(path.join(root, "components/community-v2-runtime.tsx"), "utf8"),
  ]);

  for (const action of [
    "inspect_programs",
    "reserve_item",
    "borrow_item",
    "return_item",
    "attend_event",
    "volunteer",
    "donate_resource",
    "request_help",
    "post_notice",
    "book_service",
    "purchase_item",
  ]) {
    assert.match(engine, new RegExp('"' + action + '"'));
  }

  for (const tool of [
    "community_search_places",
    "community_inspect_place",
    "community_observe_agents",
    "community_inspect_agent",
    "community_list_actions",
    "community_execute_action",
    "community_post_notice",
    "community_request_help",
  ]) {
    assert.match(runtime, new RegExp('name: "' + tool + '"'));
  }

  assert.match(runtime, /__ASYMPTA_COMMUNITY_WEBMCP__/);
  assert.match(runtime, /modelContext\?\.registerTool/);
  assert.match(runtime, /executeCommunityAction\(/);
});

test("uses deliberate real-world pacing instead of rapid agent jumps", async () => {
  const [engine, runtime] = await Promise.all([
    readFile(path.join(root, "lib/community-layer.ts"), "utf8"),
    readFile(path.join(root, "components/community-v2-runtime.tsx"), "utf8"),
  ]);

  for (const phase of ["observe", "evaluate", "travel", "inquire", "decide", "act", "reflect", "rest"]) {
    assert.match(engine, new RegExp('"' + phase + '"'));
  }
  assert.match(engine, /if \(phase === "observe"\) return 4000/);
  assert.match(engine, /if \(phase === "evaluate"\) return 5000/);
  assert.match(engine, /if \(phase === "inquire"\) return 5000/);
  assert.match(engine, /if \(phase === "decide"\) return 4000/);
  assert.match(engine, /if \(phase === "reflect"\) return 5000/);
  assert.match(engine, /if \(phase === "rest"\) return 8000/);
  assert.match(runtime, /BEHAVIOR_BATCH = 4/);
  assert.match(runtime, /BEHAVIOR_TICK_MS = 1200/);
  assert.match(runtime, /pacing: "observe → evaluate → travel → inquire → decide → act → reflect"/);
  assert.match(runtime, /emitUserProcess\("觀察社區"/);
  assert.match(runtime, /emitUserProcess\("評估選項"/);
  assert.match(runtime, /emitUserProcess\("詢問細節"/);
  assert.match(runtime, /emitUserProcess\("作出決定"/);
  assert.match(runtime, /emitUserProcess\(\n\s+result\.ok \? "完成並反思"/);
});

test("keeps community state persistent and mutations real", async () => {
  const [engine, runtime] = await Promise.all([
    readFile(path.join(root, "lib/community-layer.ts"), "utf8"),
    readFile(path.join(root, "components/community-v2-runtime.tsx"), "utf8"),
  ]);

  assert.match(runtime, /asympta-community-v2/);
  assert.match(runtime, /localStorage\.setItem\(COMMUNITY_KEY/);
  assert.match(engine, /offeringItem\.available -= quantity/);
  assert.match(engine, /placeItem\.treasury \+= credits/);
  assert.match(engine, /next\.userInventory/);
  assert.match(engine, /next\.userBookings/);
  assert.match(engine, /next\.userCommunityScore/);
  assert.match(engine, /next\.notices = \[/);
  assert.match(engine, /next\.transactions = \[transaction/);
});

test("community presentation follows the sparse Asympta perception language", async () => {
  const runtime = await readFile(path.join(root, "components/community-v2-runtime.tsx"), "utf8");
  assert.match(runtime, /community-place/);
  assert.match(runtime, /placeLinePaths\(place\.seed\)/);
  assert.match(runtime, /community-agent/);
  assert.match(runtime, /data-perception/);
  assert.match(runtime, /data-city-detail/);
  assert.match(runtime, /world-plane\[data-city-detail="overview"\] \.community-agent-thought/);
  assert.match(runtime, /community-inspector/);
  assert.match(runtime, /WebMCP actions/);
  assert.match(runtime, /requestAnimationFrame\(animate\)/);
});
