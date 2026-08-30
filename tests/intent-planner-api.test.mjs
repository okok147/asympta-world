import assert from "node:assert/strict";
import test from "node:test";

import { OPTIONS, POST } from "../app/api/asympta/plan/route.ts";

test("planner API keeps credentials server-side and returns a validated fallback when the secret is absent", async () => {
  const previous = process.env.OPENROUTER_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  try {
    const request = new Request("http://localhost/api/asympta/plan", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
      },
      body: JSON.stringify({
        intent: "Research a robust answer and verify the result.",
        conversation: [{ role: "user", content: "Research a robust answer and verify the result." }],
      }),
    });
    const response = await POST(request);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.ok, true);
    assert.equal(body.provenance.provider, "deterministic-fallback");
    assert.equal(body.provenance.model, "openai/gpt-oss-120b:free");
    assert.equal(body.result.ready, true);
    assert.ok(body.result.plan.tasks.length >= 3);
    assert.doesNotMatch(JSON.stringify(body), /Bearer\s|sk-or-v1-/i);
    assert.equal(response.headers.get("access-control-allow-origin"), "http://localhost:3000");
  } finally {
    if (previous === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = previous;
  }
});

test("planner API validates input and exposes a safe CORS preflight", async () => {
  const invalid = await POST(new Request("http://localhost/api/asympta/plan", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ intent: "x" }),
  }));
  assert.equal(invalid.status, 400);

  const preflight = await OPTIONS(new Request("http://localhost/api/asympta/plan", {
    method: "OPTIONS",
    headers: { origin: "https://okok147.github.io" },
  }));
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("access-control-allow-origin"), "https://okok147.github.io");
  assert.match(preflight.headers.get("access-control-allow-methods") ?? "", /POST/);
});
