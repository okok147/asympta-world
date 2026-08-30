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
    cityPlan: null,
    provenance: { provider: "asympta", model: null, tools: ["weather"], simulated: false },
  };
}

function fakeTurnstileContainer() {
  const children = [];
  const container = {
    ownerDocument: {
      createElement: () => {
        const mount = {
          className: "",
          remove: () => {
            const index = children.indexOf(mount);
            if (index >= 0) children.splice(index, 1);
          },
        };
        return mount;
      },
    },
    appendChild: (mount) => {
      children.push(mount);
      return mount;
    },
  };
  return { container, children };
}

test("browser surface only knows the public gateway and never embeds an upstream credential or endpoint", () => {
  const browserSurface = `${client}\n${composer}`;
  assert.match(client, /NEXT_PUBLIC_ASYMPTA_AGENT_API_URL/);
  assert.match(client, /NEXT_PUBLIC_ASYMPTA_TURNSTILE_SITE_KEY/);
  assert.doesNotMatch(browserSurface, /OPENROUTER_API_KEY|https:\/\/openrouter\.ai|sk-or-v1-|authorization/i);
  assert.match(client, /credentials: "omit"/);
  assert.match(client, /referrerPolicy: "no-referrer"/);
});

test("Turnstile uses explicit non-interactive execution with bounded automatic retry", () => {
  assert.match(client, /turnstile\/v0\/api\.js\?render=explicit/);
  assert.match(client, /execution: "execute"/);
  assert.match(client, /appearance: "interaction-only"/);
  assert.match(client, /retry: "auto"/);
  assert.match(client, /"retry-interval": TURNSTILE_RETRY_INTERVAL_MS/);
  assert.match(client, /"error-callback": \(\) => false/);
  assert.doesNotMatch(client, /"error-callback": \(\) => fail/);
  assert.match(client, /api\.execute\(widgetId\)/);
  assert.match(client, /api\.remove\(widgetId\)/);
  assert.match(client, /api\.render\(mount/);
  assert.match(client, /mount\.remove\(\)/);
  assert.doesNotMatch(client, /input\.container\.replaceChildren/);
  assert.match(client, /TURNSTILE_SCRIPT_TIMEOUT_MS/);
  assert.match(client, /TURNSTILE_TIMEOUT_MS = 30_000/);
  assert.match(composer, /await requestTurnstileToken/);
  assert.match(composer, /turnstileToken: turnstile\.token/);
  assert.match(composer, /turnstile\.release\(\)/);
  assert.match(composer, /requestError\.retryable/);
  assert.match(composer, /onClick=\{\(\) => void submit\(\)\}/);
});

test("a transient Turnstile error stays mounted for auto retry and each submit gets a fresh token", async () => {
  const originalWindow = globalThis.window;
  const executions = [];
  const removals = [];
  const errorCallbackResults = [];
  const retryConfigurations = [];
  let renderCount = 0;
  globalThis.window = {
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    turnstile: {
      render: (_container, options) => {
        renderCount += 1;
        const currentRender = renderCount;
        const widgetId = `widget-${currentRender}`;
        retryConfigurations.push([options.retry, options["retry-interval"]]);
        queueMicrotask(() => {
          if (currentRender === 1) {
            errorCallbackResults.push(options["error-callback"]("network-error"));
          }
          queueMicrotask(() => options.callback(`token-${currentRender}`));
        });
        return widgetId;
      },
      execute: (widgetId) => executions.push(widgetId),
      remove: (widgetId) => removals.push(widgetId),
    },
  };
  const { container, children } = fakeTurnstileContainer();

  try {
    const first = await requestTurnstileToken({ container, siteKey: "public-site-key" });
    assert.equal(first.token, "token-1");
    assert.deepEqual(executions, ["widget-1"]);
    assert.deepEqual(errorCallbackResults, [false]);
    assert.deepEqual(retryConfigurations, [["auto", 8_000]]);
    assert.deepEqual(removals, []);
    assert.equal(children.length, 1);
    first.release();
    assert.deepEqual(removals, ["widget-1"]);
    assert.equal(children.length, 0);

    const second = await requestTurnstileToken({ container, siteKey: "public-site-key" });
    assert.equal(second.token, "token-2");
    assert.deepEqual(executions, ["widget-1", "widget-2"]);
    assert.deepEqual(retryConfigurations, [["auto", 8_000], ["auto", 8_000]]);
    second.release();
    assert.deepEqual(removals, ["widget-1", "widget-2"]);
    assert.equal(children.length, 0);
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

test("releasing an older Turnstile lease cannot remove a newer request's widget", async () => {
  const originalWindow = globalThis.window;
  const callbacks = [];
  const renderedMounts = [];
  const removals = [];
  let markFirstRendered;
  let markSecondRendered;
  const firstRendered = new Promise((resolve) => { markFirstRendered = resolve; });
  const secondRendered = new Promise((resolve) => { markSecondRendered = resolve; });
  globalThis.window = {
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    turnstile: {
      render: (mount, options) => {
        renderedMounts.push(mount);
        callbacks.push(options.callback);
        if (renderedMounts.length === 1) markFirstRendered();
        else markSecondRendered();
        return `widget-${renderedMounts.length}`;
      },
      execute: () => {},
      remove: (widgetId) => removals.push(widgetId),
    },
  };
  const { container, children } = fakeTurnstileContainer();

  try {
    const firstPending = requestTurnstileToken({ container, siteKey: "public-site-key" });
    await firstRendered;
    callbacks[0]("token-1");
    const first = await firstPending;

    const secondPending = requestTurnstileToken({ container, siteKey: "public-site-key" });
    await secondRendered;
    assert.equal(children.length, 2);
    callbacks[1]("token-2");
    const second = await secondPending;

    first.release();
    assert.deepEqual(removals, ["widget-1"]);
    assert.equal(children.length, 1);
    assert.equal(children[0], renderedMounts[1]);

    second.release();
    assert.deepEqual(removals, ["widget-1", "widget-2"]);
    assert.equal(children.length, 0);
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

test("aborting a pending Turnstile attempt fails closed and removes its widget", async () => {
  const originalWindow = globalThis.window;
  const removals = [];
  let markExecuted;
  const executed = new Promise((resolve) => { markExecuted = resolve; });
  globalThis.window = {
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    turnstile: {
      render: () => "widget-abort",
      execute: () => markExecuted(),
      remove: (widgetId) => removals.push(widgetId),
    },
  };
  const controller = new AbortController();
  const { container } = fakeTurnstileContainer();

  try {
    const pending = requestTurnstileToken({ container, siteKey: "public-site-key", signal: controller.signal });
    await executed;
    controller.abort();
    await assert.rejects(pending, (error) => error instanceof DOMException && error.name === "AbortError");
    assert.deepEqual(removals, ["widget-abort"]);
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

test("the 30-second Turnstile cap fails closed after automatic retries do not recover", async () => {
  const originalWindow = globalThis.window;
  const removals = [];
  globalThis.window = {
    setTimeout: (callback, delay) => {
      if (delay === 30_000) queueMicrotask(callback);
      return 1;
    },
    clearTimeout: () => {},
    turnstile: {
      render: () => "widget-timeout",
      execute: () => {},
      remove: (widgetId) => removals.push(widgetId),
    },
  };
  const { container } = fakeTurnstileContainer();

  try {
    await assert.rejects(
      requestTurnstileToken({ container, siteKey: "public-site-key" }),
      (error) => error instanceof PublicAgentClientError
        && error.code === "turnstile_failed"
        && error.retryable,
    );
    assert.deepEqual(removals, ["widget-timeout"]);
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

test("the information journey follows real request stages and returns before showing a result", () => {
  assert.match(composer, /beginInformationJourney\(current, tripId\)/);
  assert.match(composer, /gatherInformationJourney\(current, tripId\)/);
  assert.match(composer, /returnInformationJourney\(current, tripId/);
  assert.match(composer, /await waitForJourneyMotion\(controller\.signal, 680\)/);
  assert.match(composer, /finishInformationJourney\(current, tripId, "delivered"\)/);
  assert.match(composer, /finishInformationJourney\(current, tripId, "waiting"\)/);
  assert.ok(
    composer.indexOf("await waitForJourneyMotion(controller.signal, 680)")
      < composer.indexOf("setPublicResult(response)"),
  );
  assert.match(composer, /InformationJourneyTicket journey=\{journey\}/);
  assert.match(composer, /abortRef\.current === controller && !controller\.signal\.aborted/);
  assert.ok((composer.match(/assertCurrentRun\(\)/g) ?? []).length >= 4);
  assert.match(composer, /if \(isCurrentRun\(\)\) publishActivity\(next, event\)/);
  assert.match(composer, /current\.tripId === activeTripId \? EMPTY_INFORMATION_JOURNEY : current/);
  assert.match(css, /@keyframes asympta-information-outbound/);
  assert.match(css, /@keyframes asympta-information-return/);
  assert.match(css, /prefers-reduced-motion: reduce/);
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

test("browser validates city plans again and only dispatches the latest non-aborted response", async () => {
  const safe = validInformationResponse();
  safe.goal.kind = "research";
  safe.goal.risk = "none";
  safe.cityPlan = {
    access: "READ",
    operation: "inspect_agent",
    targetAgentId: "agent-business",
    workflowId: null,
    actionType: null,
    message: null,
    reason: "Inspect the business agent in the local simulation.",
  };
  safe.provenance.simulated = true;
  safe.provenance.tools = ["asympta:atlas-city-plan"];
  const parsed = await runPublicAgentIntent({
    intent: "Inspect the merchant agent",
    locale: "en",
    timezone: "UTC",
    turnstileToken: "single-use-browser-token",
    clientId: "18e8ae4f-f4b7-46a0-b307-377f9bb1a69a",
    cityContext: null,
  }, {
    endpoint: "https://agent.example/v1/intent",
    fetcher: async () => new Response(JSON.stringify(safe), { status: 200 }),
  });
  assert.equal(parsed.cityPlan.operation, "inspect_agent");

  const unsafe = structuredClone(safe);
  unsafe.cityPlan.extra = "not allowed";
  await assert.rejects(
    runPublicAgentIntent({
      intent: "Inspect the merchant agent",
      locale: "en",
      timezone: "UTC",
      turnstileToken: "single-use-browser-token",
      clientId: "18e8ae4f-f4b7-46a0-b307-377f9bb1a69a",
    }, {
      endpoint: "https://agent.example/v1/intent",
      fetcher: async () => new Response(JSON.stringify(unsafe), { status: 200 }),
    }),
    (error) => error instanceof PublicAgentClientError && error.code === "invalid_upstream_response",
  );

  assert.match(composer, /cityContext: buildPublicAgentCityContextFromWindow\(\)/);
  assert.match(composer, /dispatchPublicAgentCityPlan/);
  const dispatchIndex = composer.indexOf("dispatchPublicAgentCityPlan(");
  assert.ok(dispatchIndex > 0);
  assert.ok(composer.lastIndexOf("assertCurrentRun();", dispatchIndex) < dispatchIndex);
  assert.match(composer, /controller\.signal/);
  assert.match(composer, /response\.cityPlan\?\.access/);
});
