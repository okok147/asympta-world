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

test("server render exposes the paper agent coordination atlas", async () => {
  const { response, html } = await renderRoot();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  assert.match(html, /data-map-app="true"/);
  assert.match(html, /data-map-style="paper-agent-coordination-atlas"/);
  assert.match(html, /Interactive paper map with autonomous stakeholder agent coordination/);
  assert.match(html, /Coordination Atlas/);
  assert.match(html, /Order/);
  assert.match(html, /Dinner/);
  assert.match(html, /Launch/);
  assert.match(html, /Recovery/);
  assert.match(html, /Zoom in/);
  assert.match(html, /Zoom out/);
  assert.match(html, /Recenter map/);
  assert.match(html, /Drawing the street atlas/);
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
