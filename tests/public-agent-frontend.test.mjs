import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  getOrCreatePublicAgentClientId,
  isSafePublicAgentSourceUrl,
  PublicAgentClientError,
  requestTurnstileToken,
  runPublicAgentIntent,
} from "../lib/asympta-public-agent-client.ts";

const client = await readFile(new URL("../lib/asympta-public-agent-client.ts", import.meta.url), "utf8");
const composer = await readFile(new URL("../components/asympta-intent-composer.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/asympta-intent.css", import.meta.url), "utf8");

function validInformationResponse() {
  return {
    ok: true,
    activityId: "activity-public-1",
    goal: {
      title: "Check today's weather in Hong Kong",
      summary: "Find current conditions and today's forecast.",
      kind: "weather",
      status: "completed",
      missingFields: [],
      requiresConfirmation: false,
      risk: "none",
    },
    result: {
      answer: "It is warm with a chance of showers.",
      checkedAt: "2026-08-30T03:00:00.000Z",
      sources: [{
        title: "Weather source",
        url: "https://weather.example/today",
        provider: "open-meteo",
        publishedAt: null,
      }],
      verification: { status: "verified", details: "Checked against the weather source." },
    },
    action: null,
    provenance: { provider: "asympta", model: null, tools: ["weather"], simulated: false },
  };
}

test("browser surface only knows the public gateway and never embeds an upstream credential or endpoint", () => {
  const browserSurface = `${client}\n${composer}`;
  assert.match(client, /NEXT_PUBLIC_ASYMPTA_AGENT_API_URL/);
  assert.match(client, /NEXT_PUBLIC_ASYMPTA_TURNSTILE_SITE_KEY/);
  assert.doesNotMatch(browserSurface, /OPENROUTER_API_KEY|https:\/\/openrouter\.ai|sk-or-v1-|authorization/i);
  assert.match(client, /credentials: "omit"/);
  assert.match(client, /referrerPolicy: "no-referrer"/);
});

test("Turnstile uses explicit, interaction-only execution and obtains a token for each public submit", () => {
  assert.match(client, /turnstile\/v0\/api\.js\?render=explicit/);
  assert.match(client, /execution: "execute"/);
  assert.match(client, /appearance: "interaction-only"/);
  assert.match(client, /api\.execute\(widgetId\)/);
  assert.match(client, /api\.remove\(widgetId\)/);
  assert.match(client, /TURNSTILE_SCRIPT_TIMEOUT_MS/);
  assert.match(composer, /await requestTurnstileToken/);
  assert.match(composer, /turnstileToken: turnstile\.token/);
  assert.match(composer, /turnstile\.release\(\)/);
});

test("each Turnstile execution yields a fresh lease that remains mounted through its request", async () => {
  const originalWindow = globalThis.window;
  const executions = [];
  const removals = [];
  let renderCount = 0;
  globalThis.window = {
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    turnstile: {
      render: (_container, options) => {
        renderCount += 1;
        const widgetId = `widget-${renderCount}`;
        queueMicrotask(() => options.callback(`token-${renderCount}`));
        return widgetId;
      },
      execute: (widgetId) => executions.push(widgetId),
      remove: (widgetId) => removals.push(widgetId),
    },
  };
  const container = { replaceChildren: () => {} };

  try {
    const first = await requestTurnstileToken({ container, siteKey: "public-site-key" });
    assert.equal(first.token, "token-1");
    assert.deepEqual(executions, ["widget-1"]);
    assert.deepEqual(removals, []);
    first.release();
    assert.deepEqual(removals, ["widget-1"]);

    const second = await requestTurnstileToken({ container, siteKey: "public-site-key" });
    assert.equal(second.token, "token-2");
    assert.deepEqual(executions, ["widget-1", "widget-2"]);
    second.release();
    assert.deepEqual(removals, ["widget-1", "widget-2"]);
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

test("public request carries only the bounded intent context and uses a persistent opaque UUID", async () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const first = getOrCreatePublicAgentClientId(storage);
  const second = getOrCreatePublicAgentClientId(storage);
  assert.match(first, /^[0-9a-f-]{36}$/i);
  assert.equal(second, first);

  const request = {
    intent: "What is today's weather?",
    locale: "en",
    timezone: "Asia/Hong_Kong",
    turnstileToken: "single-use-browser-token",
    clientId: first,
  };
  let captured;
  const response = await runPublicAgentIntent(request, {
    endpoint: "https://agent.example/v1/intent",
    fetcher: async (url, init) => {
      captured = { url: String(url), init, body: JSON.parse(String(init.body)) };
      return new Response(JSON.stringify(validInformationResponse()), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  assert.equal(response.ok, true);
  assert.deepEqual(captured.body, request);
  assert.equal(captured.init.credentials, "omit");
  assert.equal(captured.init.cache, "no-store");
});

test("an action cannot cross the confirmation boundary even if an upstream response claims completion", async () => {
  const unsafe = validInformationResponse();
  unsafe.goal.kind = "action";
  unsafe.goal.status = "completed";
  unsafe.goal.requiresConfirmation = false;
  unsafe.action = {
    description: "Send a binding order",
    consequence: "This would create a financial commitment.",
  };

  await assert.rejects(
    runPublicAgentIntent({
      intent: "Order the supplies",
      locale: "en",
      timezone: "UTC",
      turnstileToken: "single-use-browser-token",
      clientId: "18e8ae4f-f4b7-46a0-b307-377f9bb1a69a",
    }, {
      endpoint: "https://agent.example/v1/intent",
      fetcher: async () => new Response(JSON.stringify(unsafe), { status: 200 }),
    }),
    (error) => error instanceof PublicAgentClientError
      && error.code === "invalid_upstream_response"
      && error.retryable,
  );
  assert.match(composer, /Nothing has been carried out/);
  assert.doesNotMatch(composer, /executePublicAgentAction|confirmPublicAgentAction/);
  assert.doesNotMatch(composer, /emit\(\s*"executing"/);
});

test("result rendering is compact, source-safe, responsive and accessible", () => {
  assert.equal(isSafePublicAgentSourceUrl("https://example.com/source"), true);
  assert.equal(isSafePublicAgentSourceUrl("http://example.com/source"), false);
  assert.equal(isSafePublicAgentSourceUrl("javascript:alert(1)"), false);
  assert.equal(isSafePublicAgentSourceUrl("data:text/html,unsafe"), false);
  assert.match(composer, /\.slice\(0, 4\)/);
  assert.match(composer, /rel="noopener noreferrer"/);
  assert.match(composer, /aria-live="polite"/);
  assert.match(composer, /maxLength=\{600\}/);
  assert.match(composer, /window\.dispatchEvent\(new CustomEvent\("asympta:activity"/);
  assert.match(composer, /runAsymptaIntent/);
  assert.match(composer, /__ASYMPTA_PROTOCOLS__/);
  assert.match(css, /max-height: min\(36svh, 236px\)/);
  assert.match(css, /max-height: 430px/);
  assert.match(css, /orientation: landscape/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /focus-visible/);
});
