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

test("server render exposes the city-scale Asympta map surface", async () => {
  const { response, html } = await renderRoot();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  assert.match(html, /ASYMPTA WORLD/);
  assert.match(html, /city-scale coordination/);
  assert.match(html, /CITY-SCALE LIVING WORLD/);
  assert.match(html, /Ask once\. Watch the city coordinate\./);
  assert.match(html, /Run the city order/);
  assert.match(html, /Mori Paper Co\./);
  assert.match(html, /North Mill/);
  assert.match(html, /Harbour Courier/);
  assert.match(html, /WebMCP/);
  assert.match(html, /\/order/);
});

test("server render communicates a simulated multi-party city without pretending commerce is live", async () => {
  const { html } = await renderRoot();
  assert.match(html, /Business-side agents receive, clarify, source, make, inspect and deliver through the same map/i);
  assert.match(html, /Simulation/);
  assert.match(html, /no real order, payment, message or shipment occurs/i);
  assert.doesNotMatch(html, /22\.3193|114\.1694/);
});
