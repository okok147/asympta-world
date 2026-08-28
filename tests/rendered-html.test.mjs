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

test("server render exposes the complete English-first product surface", async () => {
  const { response, html } = await renderRoot();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  assert.match(html, /Asympta World · Humans live\. Agents coordinate\./);
  assert.match(html, /Humans live\. Agents coordinate\./);
  assert.match(html, /Nothing queued/);
  assert.match(html, /Type \/ for actions/);
  assert.match(html, /WebMCP/);
  assert.match(html, /data-visual-engine="three\.js"/);
  assert.match(html, /data-visual-engine="p5\.js"/);
});

test("server render includes all fast paths and safety disclosure", async () => {
  const { html } = await renderRoot();
  for (const label of ["Dinner", "Work", "Shopping", "Email", "Watch demo"]) {
    assert.ok(html.includes(label), `missing ${label}`);
  }
  assert.match(html, /Approval before booking, buying or sending/);
  assert.match(html, /Only grouped location is kept/);
  assert.doesNotMatch(html, /22\.3193|114\.1694/);
});

test("the retired overlapping product is absent", async () => {
  const { html } = await renderRoot();
  assert.doesNotMatch(html, /persistent pixel economy|12 agents|Accept offer|Run Live Demo/i);
  assert.doesNotMatch(html, /Starter Project|codex-preview/);
});
