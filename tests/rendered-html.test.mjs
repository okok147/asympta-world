import assert from "node:assert/strict";
import test from "node:test";

async function renderRoot() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
  return { response, html: await response.text() };
}

test("server render exposes the collapsed smooth paper living-city menu", async () => {
  const { response, html } = await renderRoot();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  assert.match(html, /data-map-app="true"/);
  assert.match(html, /data-map-style="paper-illustrated-animal-living-city-demo"/);
  assert.match(html, /data-render-mode="imperative-map-loop"/);
  assert.match(html, /illustrated animal stakeholder agents/);
  assert.match(html, /Coordination menu/);
  assert.match(html, /is-collapsed/);
  assert.match(html, /Custom Order Network/);
  assert.match(html, /WebMCP actions/);
  assert.match(html, /Camera follow/);
  assert.match(html, /English/);
  assert.match(html, /繁體中文/);
  assert.match(html, /日本語/);
  assert.match(html, /Order/);
  assert.match(html, /Dinner/);
  assert.match(html, /Launch/);
  assert.match(html, /Recovery/);
  assert.match(html, /Restart/);
  assert.match(html, /Zoom in/);
  assert.match(html, /Zoom out/);
  assert.match(html, /Recenter map/);
  assert.match(html, /asympta-animal-svg/);
  assert.doesNotMatch(html, /🐱|🐰|🐹|🐶|🦊|🐻|🐯|🐼|🐮|🦝|🐨|🐵|🦉|🐧|🐦/u);
  assert.doesNotMatch(html, /Interactive pixel city map/);
  assert.doesNotMatch(html, /tokyo-vector/);
});

test("legacy demo chrome stays absent", async () => {
  const { html } = await renderRoot();
  assert.doesNotMatch(html, /Run the city order/);
  assert.doesNotMatch(html, /Tell the city/);
  assert.doesNotMatch(html, /Mori Paper Co\./);
  assert.doesNotMatch(html, /North Mill/);
});
