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

test("server renders an interactive geographical map shell, location opt-in, and no fantasy background", async () => {
  const { response, html } = await renderRoot();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const surface = html.match(/<main\b[^>]*class="asympta-map-world"[^>]*>[\s\S]*?<\/main>/)?.[0];
  assert.ok(surface, "the real-world map is the only main surface");
  assert.match(surface, /id="asympta-real-map"/);
  assert.match(surface, /role="region"/);
  assert.match(surface, /Show my location on the map/);
  assert.match(surface, /Opening the map/);
  assert.match(surface, /Illustrated companions/);
  assert.doesNotMatch(surface, /data-your-location="true"|data-map-app|atlas-console|animal-map-marker/);
  assert.doesNotMatch(surface, /<img\b|<nav\b|<header\b|<footer\b/i);
  assert.doesNotMatch(html, /AsymptaThreeWorldEffects|AsymptaTaskKernelBridge|map-paper-grain/);
});
