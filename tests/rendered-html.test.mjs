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

test("server render exposes the real map visualizer surface", async () => {
  const { response, html } = await renderRoot();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  assert.match(html, /data-map-app="true"/);
  assert.match(html, /data-map-style="real-map-visualizer"/);
  assert.match(html, /Interactive real-world map visualizer/);
  assert.match(html, /Visualizer filters/);
  assert.match(html, /Zoom in/);
  assert.match(html, /Zoom out/);
  assert.match(html, /Recenter map/);
  assert.doesNotMatch(html, /Interactive pixel city map/);
  assert.doesNotMatch(html, /tokyo-vector/);
});

test("old agent demo chrome remains absent from the rendered page", async () => {
  const { html } = await renderRoot();
  assert.doesNotMatch(html, /WebMCP/);
  assert.doesNotMatch(html, /Run the city order/);
  assert.doesNotMatch(html, /Tell the city/);
  assert.doesNotMatch(html, /Mori Paper Co\./);
  assert.doesNotMatch(html, /North Mill/);
  assert.doesNotMatch(html, /HUMAN CHECKPOINT/);
});
