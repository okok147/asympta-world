import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

test("renders Your Agent with the same compact animal-body language as other agents", async () => {
  const [runtime, animal, mission, template, boundary] = await Promise.all([
    readFile(path.join(root, "components/unified-agent-interface-runtime.tsx"), "utf8"),
    readFile(path.join(root, "components/animal-avatar-runtime.tsx"), "utf8"),
    readFile(path.join(root, "components/mission-society-runtime.tsx"), "utf8"),
    readFile(path.join(root, "app/template.tsx"), "utf8"),
    readFile(path.join(root, "components/client-unified-agent-interface.tsx"), "utf8"),
  ]);
  assert.match(runtime, /mission-user-agent \.mission-pixel-person \{ display:none!important; \}/);
  assert.match(runtime, /shared-agent-animal-body/);
  assert.match(runtime, /data-animal-family="long-ear"/);
  assert.match(runtime, /data-animal-family="bird"/);
  assert.match(runtime, /data-animal-family="aquatic"/);
  assert.match(runtime, /width:9px/);
  assert.match(animal, /--animal-body/);
  assert.match(animal, /--animal-accent/);
  assert.match(animal, /--animal-dark/);
  assert.match(mission, /mission-pixel-person/);
  assert.match(template, /<ClientUnifiedAgentInterface \/>/);
  assert.match(boundary, /requestAnimationFrame/);
  assert.match(boundary, /mounted \? <UnifiedAgentInterfaceRuntime \/> : null/);
});

test("keeps a live agent status in the menu bar and updates from real agent events", async () => {
  const runtime = await readFile(path.join(root, "components/unified-agent-interface-runtime.tsx"), "utf8");
  assert.match(runtime, /agent-live-status/);
  assert.match(runtime, /asympta:user-task-process/);
  assert.match(runtime, /asympta:agent-behavior/);
  assert.match(runtime, /asympta:agent-motion-target/);
  assert.match(runtime, /statusFromMission/);
  assert.match(runtime, /is-world-walking/);
  assert.match(runtime, /is-world-encountering/);
  assert.match(runtime, /asympta-user-live-status-v1/);
  assert.match(runtime, /aria-live="polite"/);
});

test("adds an expandable place directory directly below the zoom control", async () => {
  const runtime = await readFile(path.join(root, "components/unified-agent-interface-runtime.tsx"), "utf8");
  assert.match(runtime, /places-directory-control/);
  assert.match(runtime, /top:max\(58px/);
  assert.match(runtime, /Places · \{places\.length\}/);
  assert.match(runtime, /Search places \/ services/);
  for (const mode of ["distance", "point", "availability", "name", "type"]) {
    assert.match(runtime, new RegExp('value="' + mode + '"'));
  }
  for (const key of [
    "asympta-latent-city-v1",
    "asympta-community-v2",
    "asympta-community-store-founder-v1",
    "asympta-shopping-route-v1",
  ]) {
    assert.match(runtime, new RegExp(key));
  }
  assert.match(runtime, /Asympta Point/);
  assert.match(runtime, /routePoint\(/);
  assert.match(runtime, /availability/);
  assert.match(runtime, /minPrice/);
});

test("place directory can navigate Your Agent through the spatial router", async () => {
  const runtime = await readFile(path.join(root, "components/unified-agent-interface-runtime.tsx"), "utf8");
  assert.match(runtime, /__ASYMPTA_SPATIAL_ROUTER__/);
  assert.match(runtime, /router\.visitDestination/);
  assert.match(runtime, /className="place-go"/);
  assert.match(runtime, /Navigation aria-hidden/);
  assert.match(runtime, /GOING/);
});
