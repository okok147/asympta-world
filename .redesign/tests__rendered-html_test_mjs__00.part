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

test("server render exposes the restored Asympta product surface", async () => {
  const { response, html } = await renderRoot();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  assert.match(html, /ASYMPTA WORLD/);
  assert.match(html, /Humans live\. Agents coordinate\./);
  assert.match(html, /One intention\. Every side moves\./);
  assert.match(html, /Order flow/);
  assert.match(html, /Dinner/);
  assert.match(html, /WebMCP/);
  assert.match(html, /Type \/order/);
});

test("server render communicates the real-world stakeholder model without pretending commerce is live", async () => {
  const { html } = await renderRoot();
  assert.match(html, /customer, business, merchandiser, supplier, production, finance and delivery/i);
  assert.match(html, /Simulated commerce/);
  assert.match(html, /no real charge or shipment/i);
  assert.doesNotMatch(html, /22\.3193|114\.1694/);
});
