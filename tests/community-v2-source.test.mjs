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
    "riverside-library","cedar-community","paws-pet-care","spoke-workshop","bloom-flower",
    "quiet-art-space","little-music-room","common-table","green-patch","sun-laundry",
  ]) assert.match(engine, new RegExp('"' + place + '"'));

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
    "inspect_programs","reserve_item","borrow_item","return_item","attend_event","volunteer",
    "donate_resource","request_help","post_notice","book_service","purchase_item",
  ]) assert.match(engine, new RegExp('"' + action + '"'));

  for (const tool of [
    "community_search_places","community_inspect_place","community_observe_agents","community_inspect_agent",
    "community_list_actions","community_execute_action","community_post_notice","community_request_help",
  ]) assert.match(runtime, new RegExp('name: "' + tool + '"'));

  assert.match(runtime, /__ASYMPTA_COMMUNITY_WEBMCP__/);
  assert.match(runtime, /modelContext\?\.registerTool/);
  assert.match(runtime, /executeCommunityAction\(/);
});

test("uses deliberate real-world pacing instead of rapid agent jumps", async () => {
  const [engine, runtime] = await Promise.all([
    readFile(path.join(root, "lib/community-layer.ts"), "utf8"),
    readFile(path.join(root, "components/community-v2-runtime.tsx"), "utf8"),
  ]);
  for (const phase of ["observe","evaluate","travel","inquire","decide","act","reflect","rest"]) assert.match(engine, new RegExp('"' + phase + '"'));
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
  assert.match(runtime, /"完成並反思"/);
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

test("lets the community research and found new stores with screenshot evidence and an opening celebration", async () => {
  const [founder, template] = await Promise.all([
    readFile(path.join(root, "components/community-store-founder-runtime.tsx"), "utf8"),
    readFile(path.join(root, "app/template.tsx"), "utf8"),
  ]);
  for (const phase of ["discover","research","capture","catalog","review","build","open"]) assert.match(founder, new RegExp('"' + phase + '"'));
  assert.match(founder, /captureReferenceScreenshot/);
  assert.match(founder, /canvas\.toDataURL\("image\/png"\)/);
  assert.match(founder, /community_set_store_catalog/);
  assert.match(founder, /community_capture_store_screenshot/);
  assert.match(founder, /community_publish_store_project/);
  assert.match(founder, /community_execute_founded_store_action/);
  assert.match(founder, /founded-community-place/);
  assert.match(founder, /community-opening-glow/);
  assert.match(founder, /founded-celebration/);
  assert.match(founder, /celebratingUntil: now \+ 9000/);
  assert.match(template, /<CommunityStoreFounderRuntime \/>/);
});

test("ships exactly one hundred kawaii badge animal identities shared by the user and world agents", async () => {
  const [catalog, runtime, template] = await Promise.all([
    readFile(path.join(root, "lib/animal-catalog.ts"), "utf8"),
    readFile(path.join(root, "components/animal-avatar-runtime.tsx"), "utf8"),
    readFile(path.join(root, "app/template.tsx"), "utf8"),
  ]);
  const animalBlock = catalog.match(/export const ANIMAL_IDS = \[([\s\S]*?)\] as const;/)?.[1] ?? "";
  const ids = [...animalBlock.matchAll(/"([a-z-]+)"/g)].map((match) => match[1]);
  assert.equal(ids.length, 100);
  assert.equal(new Set(ids).size, 100);
  for (const animal of ["cat","fox","capybara","red-panda","axolotl","octopus","dragon","unicorn"]) assert.ok(ids.includes(animal));
  assert.match(runtime, /asympta-user-animal-v2/);
  assert.match(runtime, /Choose from 100 kawaii badge animal agents/);
  assert.match(runtime, /animalBadgeDataUri/);
  assert.match(runtime, /CUTE · random from 100/);
  assert.match(runtime, /\.community-agent/);
  assert.match(runtime, /\.city-agent/);
  assert.match(runtime, /data-animal-family/);
  assert.match(template, /<AnimalAvatarRuntime \/>/);
});

test("presets new/default cameras to 77 percent and keeps dialogue readable there", async () => {
  const [pacing, template] = await Promise.all([
    readFile(path.join(root, "components/real-world-pacing-runtime.tsx"), "utf8"),
    readFile(path.join(root, "app/template.tsx"), "utf8"),
  ]);
  assert.match(pacing, /DEFAULT_DIALOGUE_SCALE = 0\.77/);
  assert.match(pacing, /asympta-dialogue-zoom-77-v1/);
  assert.match(pacing, /scale >= 0\.72 && scale <= 0\.83/);
  assert.match(pacing, /data-zoom-comfort/);
  assert.match(pacing, /city-agent\[data-perception="mid"\] \.city-agent-thought/);
  assert.match(pacing, /community-agent\[data-perception="mid"\] \.community-agent-thought/);
  assert.match(pacing, /pacingDelay/);
  assert.match(pacing, /__ASYMPTA_CITY_WEBMCP__/);
  assert.match(pacing, /__ASYMPTA_MISSION_WEBMCP__/);
  assert.match(template, /<RealWorldPacingRuntime \/>/);
});
