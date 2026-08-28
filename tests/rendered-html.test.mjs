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

test("server render exposes only the map-first surface", async () => {
  const { response, html } = await renderRoot();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  assert.match(html, /data-map-app="true"/);
  assert.match(html, /Interactive city map/);
  assert.match(html, /Toggle map color layer/);
  assert.match(html, /Zoom in/);
  assert.match(html, /Zoom out/);
  assert.match(html, /Recenter map/);
});

test("old Asympta World demo chrome is absent from the rendered page", async () => {
  const { html } = await renderRoot();
  assert.doesNotMatch(html, /ASYMPTA WORLD/);
  assert.doesNotMatch(html, /WebMCP/);
  assert.doesNotMatch(html, /Run the city order/);
  assert.doesNotMatch(html, /Tell the city/);
  assert.doesNotMatch(html, /Mori Paper Co\./);
  assert.doesNotMatch(html, /North Mill/);
  assert.doesNotMatch(html, /Agent/);
});
