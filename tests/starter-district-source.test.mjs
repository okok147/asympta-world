import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

async function sources() {
  return Promise.all([
    readFile(path.join(root, "components/starter-district-integration.tsx"), "utf8"),
    readFile(path.join(root, "app/template.tsx"), "utf8"),
  ]);
}

test("Earth mode restores the living starter district instead of hiding preset agents and places", async () => {
  const [integration, template] = await sources();
  for (const layer of [
    "latent-city-layer",
    "community-layer",
    "route-market-store",
    "community-founded-place",
    "world-agent:not(.mission-user-agent)",
    "places-directory-control",
  ]) {
    assert.match(integration, new RegExp(layer.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(integration, /display:block!important/);
  assert.match(integration, /display:grid!important/);
  assert.match(integration, /latent-city-streets \{ display:none!important; \}/);
  assert.match(integration, /STARTER DISTRICT/);
  assert.match(template, /<ClientEarthSharedWorld \/>/);
  assert.match(template, /<StarterDistrictIntegration \/>/);
  assert.ok(template.indexOf("<StarterDistrictIntegration />") > template.indexOf("<ClientEarthSharedWorld />"));
});

test("starter district follows the first real geolocation cell and disappears after crossing away", async () => {
  const [integration] = await sources();
  assert.match(integration, /asympta-starter-district-cell-v1/);
  assert.match(integration, /hasRealLocation/);
  assert.match(integration, /activeCell === starterCell \? "active" : "away"/);
  assert.match(integration, /data-starter-district="away"/);
  assert.match(integration, /preview/);
});

test("Your Agent and resident animals use readable full badge scales", async () => {
  const [integration] = await sources();
  assert.match(integration, /\.city-agent,\.community-agent \{ width:30px!important; height:30px!important; \}/);
  assert.match(integration, /\.mission-user-agent \.shared-agent-animal-body \{[\s\S]*width:44px!important; height:44px!important;/);
  assert.match(integration, /agent-portrait\.mission-agent-portrait \{ width:50px!important; height:50px!important;/);
  assert.match(integration, /background-image:var\(--animal-badge-image\)!important/);
  assert.match(integration, /city-agent-body::before,\.city-agent-body::after/);
  assert.match(integration, /display:none!important; content:none!important/);
});

test("mobile controls occupy separate safe zones and large panels retire colliding controls", async () => {
  const [integration] = await sources();
  assert.match(integration, /\.places-directory-control[^}]*top:max\(56px/s);
  assert.match(integration, /\.earth-control[^}]*top:max\(98px/s);
  assert.match(integration, /\.agent-task-control \{ z-index:134!important; \}/);
  assert.match(integration, /\.need-composer \{ z-index:136!important; \}/);
  assert.match(integration, /data-asympta-overlay="places"/);
  assert.match(integration, /data-asympta-overlay="earth"/);
  assert.match(integration, /data-asympta-overlay="discovery"/);
  assert.match(integration, /data-asympta-overlay="agent"/);
  assert.match(integration, /max-height:calc\(100svh - 190px\)/);
  assert.match(integration, /bottom:max\(78px,calc\(env\(safe-area-inset-bottom\) \+ 78px\)\)/);
});

test("starter district uses one Places directory and Earth Places returns when the agent leaves the starter cell", async () => {
  const [integration] = await sources();
  assert.match(integration, /earth-bar>\.earth-pill:nth-child\(2\)/);
  assert.match(integration, /data-starter-district="active"/);
  assert.match(integration, /data-starter-district="away"[^}]*places-directory-control/s);
});
