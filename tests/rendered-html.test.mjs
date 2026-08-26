import assert from "node:assert/strict";
import test from "node:test";

async function renderRoot() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", String(process.pid) + "-" + String(Date.now()));
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
  return { response, html: await response.text() };
}

test("renders the living Asympta economy before any user action", async () => {
  const { response, html } = await renderRoot();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  assert.match(html, /<title>Asympta World<\/title>/);
  assert.match(html, /ASYMPTA WORLD/);
  assert.match(html, /LIVE · a living economic canvas/);
  assert.match(html, /12(?:<!-- -->)? agents/);
  assert.match(html, /4(?:<!-- -->)? businesses/);
  assert.match(html, /Landing page for a neighborhood coffee shop/);
  assert.match(html, /What do you need\?/);
  assert.match(html, /Put a need into the world\. Agents decide how to respond\./);
  assert.match(html, /WebMCP/);
});

test("does not ship a play button, starter surface, or village metaphor", async () => {
  const { html } = await renderRoot();
  assert.doesNotMatch(html, /Run Live Demo|Play demo|Start simulation/i);
  assert.doesNotMatch(html, /Starter Project|codex-preview/);
  assert.doesNotMatch(html, /village|neighbourhood map|neighborhood map/i);
});
