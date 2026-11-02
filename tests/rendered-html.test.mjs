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

test("server renders only blank paper and six representative dots", async () => {
  const { response, html } = await renderRoot();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const surface = html.match(/<main\b[^>]*class="paper-world"[^>]*>[\s\S]*?<\/main>/)?.[0];
  assert.ok(surface, "the paper is the only app surface");
  assert.match(surface, /role="img"/);
  assert.match(surface, /aria-label="[^"]*moving dots[^"]*"/);
  assert.equal([...surface.matchAll(/class="paper-world__dot paper-world__dot--\d"/g)].length, 6);

  assert.doesNotMatch(surface, /<(?:button|input|nav|header|footer|canvas|svg|form|a)\b/i);
  assert.equal(surface.replace(/<!--.*?-->/gs, "").replace(/<[^>]*>/g, "").trim(), "");
  assert.doesNotMatch(surface, /data-map-app|asympta-intent-composer|atlas-console|agent-card|menu/i);
});
