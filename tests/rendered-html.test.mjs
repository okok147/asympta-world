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

test("server render exposes the intention-first validated world shell", async () => {
  const { response, html } = await renderRoot();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  assert.match(html, /data-map-app="true"/);
  assert.match(html, /paper-illustrated-animal-intention-world/);
  assert.match(html, /validated-state-machine-raf-60hz/);
  assert.match(html, /illustrated animal stakeholder agents/);
  assert.match(html, /What should the world take care of\?/);
  assert.match(html, /There are no preset workflows/);
  assert.match(html, /GPT-OSS 120B/);
  assert.match(html, /free-only/);
  assert.match(html, /Validated state/);
  assert.match(html, /Execution plan/);
  assert.match(html, /Conversation/);
  assert.match(html, /Simulation only/);
  assert.match(html, /human approval boundaries/);
  assert.doesNotMatch(html, /Custom Order Network/);
  assert.doesNotMatch(html, /Dinner Coordination/);
  assert.doesNotMatch(html, /Launch Stock Orchestration/);
  assert.doesNotMatch(html, /Service Recovery Network/);
  assert.doesNotMatch(html, /Choose a workflow/);
  assert.doesNotMatch(html, /🐱|🐰|🐹|🐶|🦊|🐻|🐯|🐼|🐮|🦝|🐨|🐵|🦉|🐧|🐦/u);
});

test("legacy preset demo chrome stays absent", async () => {
  const { html } = await renderRoot();
  assert.doesNotMatch(html, /Run the city order/);
  assert.doesNotMatch(html, /Tell the city/);
  assert.doesNotMatch(html, /WebMCP inspector/);
});
