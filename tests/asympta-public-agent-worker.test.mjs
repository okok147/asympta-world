import assert from "node:assert/strict";
import { register } from "node:module";
import test from "node:test";

register("../cloudflare/intent-agent/test-loader.mjs", import.meta.url);

const {
  DailyGlobalBudget,
  createIntentAgent,
} = await import("../cloudflare/intent-agent/src/index.ts");
import {
  ASYMPTA_PUBLIC_AGENT_API_PATH,
  ASYMPTA_PUBLIC_AGENT_TURNSTILE_ACTION,
} from "../lib/asympta-public-agent-contract.ts";

const ORIGIN = "https://okok147.github.io";
const API_URL = `https://agent.example${ASYMPTA_PUBLIC_AGENT_API_PATH}`;
const TEST_OPENROUTER_KEY = "test-openrouter-key-never-return";
const TEST_TURNSTILE_SECRET = "test-turnstile-secret-never-return";

function validBody(overrides = {}) {
  return {
    intent: "What is today's weather in Hong Kong?",
    locale: "en-HK",
    timezone: "Asia/Hong_Kong",
    turnstileToken: "turnstile-token-123",
    clientId: "client-test-123",
    ...overrides,
  };
}

function intentRequest(body = validBody(), options = {}) {
  const headers = new Headers({
    "Content-Type": "application/json",
    "Origin": ORIGIN,
    "CF-Connecting-IP": "203.0.113.10",
    ...options.headers,
  });
  return new Request(options.url ?? API_URL, {
    method: options.method ?? "POST",
    headers,
    body: options.method === "GET" ? undefined : JSON.stringify(body),
  });
}

function turnstileSuccess(overrides = {}) {
  return Response.json({
    success: true,
    hostname: "okok147.github.io",
    action: ASYMPTA_PUBLIC_AGENT_TURNSTILE_ACTION,
    ...overrides,
  });
}

function openRouterMessage(content, overrides = {}) {
  return Response.json({
    choices: [{ message: { content: JSON.stringify(content), ...overrides } }],
  });
}

function openRouterTextMessage(content, overrides = {}) {
  return Response.json({
    choices: [{ message: { content, ...overrides } }],
  });
}

function goal(kind, overrides = {}) {
  const common = {
    title: "Check today's weather",
    summary: "Retrieve today's current conditions and forecast for Hong Kong.",
    kind,
    missingFields: [],
    requiresConfirmation: false,
    risk: "none",
    weatherLocation: null,
    researchQuery: null,
    actionDescription: null,
    actionConsequence: null,
  };
  return { ...common, ...overrides };
}

function budgetBinding(allowed = true) {
  const calls = [];
  return {
    calls,
    binding: {
      idFromName(name) {
        assert.equal(name, "global");
        return "global-id";
      },
      get(id) {
        assert.equal(id, "global-id");
        return {
          async fetch(input, init) {
            calls.push({ input: String(input), init, body: JSON.parse(init.body) });
            return Response.json(
              { allowed, remaining: allowed ? 499 : 0, limit: 500 },
              { status: allowed ? 200 : 429 },
            );
          },
        };
      },
    },
  };
}

function baseEnv(overrides = {}) {
  const budget = budgetBinding(true);
  return {
    env: {
      OPENROUTER_API_KEY: TEST_OPENROUTER_KEY,
      TURNSTILE_SECRET_KEY: TEST_TURNSTILE_SECRET,
      INTENT_RATE_LIMIT: { async limit() { return { success: true }; } },
      GLOBAL_DAILY_BUDGET: budget.binding,
      DAILY_GLOBAL_BUDGET: "500",
      ENVIRONMENT: "production",
      ...overrides,
    },
    budget,
  };
}

function deterministicAgent(fetcher) {
  return createIntentAgent({
    fetch: fetcher,
    now: () => new Date("2026-08-30T05:00:00.000Z"),
    randomUUID: () => "11111111-2222-4333-8444-555555555555",
  });
}

async function responseJson(response) {
  const text = await response.text();
  return { text, body: JSON.parse(text) };
}

test("health and preflight expose CORS only to the exact allowlist", async () => {
  const agent = deterministicAgent(async () => { throw new Error("unexpected fetch"); });

  const health = await agent.fetch(new Request("https://agent.example/health", {
    headers: { Origin: ORIGIN },
  }), {});
  assert.equal(health.status, 200);
  assert.equal(health.headers.get("Access-Control-Allow-Origin"), ORIGIN);

  const preflight = await agent.fetch(new Request(API_URL, {
    method: "OPTIONS",
    headers: { Origin: "http://localhost:5173" },
  }), { ENVIRONMENT: "development" });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("Access-Control-Allow-Origin"), "http://localhost:5173");

  const productionLocal = await agent.fetch(new Request(API_URL, {
    method: "OPTIONS",
    headers: { Origin: "http://localhost:5173" },
  }), {});
  assert.equal(productionLocal.status, 403);

  const noOrigin = await agent.fetch(new Request(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(validBody()),
  }), {});
  const noOriginBody = await noOrigin.json();
  assert.equal(noOrigin.status, 403);
  assert.equal(noOriginBody.error.code, "invalid_origin");

  const rejected = await agent.fetch(new Request("https://agent.example/health", {
    headers: { Origin: "https://okok147.github.io.evil.example" },
  }), {});
  const rejectedBody = await rejected.json();
  assert.equal(rejected.status, 403);
  assert.equal(rejected.headers.get("Access-Control-Allow-Origin"), null);
  assert.equal(rejectedBody.error.code, "invalid_origin");
});

test("method, content type, body size, and intent length are bounded before upstream work", async () => {
  let fetchCalls = 0;
  const agent = deterministicAgent(async () => { fetchCalls += 1; throw new Error("unexpected fetch"); });

  const methodResponse = await agent.fetch(new Request(API_URL, {
    method: "GET",
    headers: { Origin: ORIGIN },
  }), {});
  assert.equal(methodResponse.status, 405);
  assert.equal(methodResponse.headers.get("Allow"), "POST, OPTIONS");

  const contentTypeResponse = await agent.fetch(new Request(API_URL, {
    method: "POST",
    headers: { Origin: ORIGIN, "Content-Type": "text/plain" },
    body: "not json",
  }), {});
  assert.equal(contentTypeResponse.status, 415);

  const oversizedResponse = await agent.fetch(new Request(API_URL, {
    method: "POST",
    headers: { Origin: ORIGIN, "Content-Type": "application/json" },
    body: "x".repeat(16 * 1024 + 1),
  }), {});
  assert.equal(oversizedResponse.status, 413);

  const longIntentResponse = await agent.fetch(intentRequest(validBody({ intent: "x".repeat(601) })), {});
  const longIntentBody = await longIntentResponse.json();
  assert.equal(longIntentResponse.status, 400);
  assert.equal(longIntentBody.error.code, "invalid_request");
  assert.equal(fetchCalls, 0);
});

test("missing secrets fail closed without exposing names, values, intent, or making an upstream call", async () => {
  let fetchCalls = 0;
  const secretIntent = "private intent that must not appear in errors";
  const agent = deterministicAgent(async () => { fetchCalls += 1; throw new Error("unexpected fetch"); });
  const { env } = baseEnv({ OPENROUTER_API_KEY: undefined });

  const response = await agent.fetch(intentRequest(validBody({ intent: secretIntent })), env);
  const { text, body } = await responseJson(response);
  assert.equal(response.status, 503);
  assert.equal(body.error.code, "missing_configuration");
  assert.doesNotMatch(text, /OPENROUTER|TURNSTILE|private intent|test-openrouter|test-turnstile/i);
  assert.equal(fetchCalls, 0);
});

test("Turnstile is verified server-side and an action or hostname mismatch stops before budget and model", async () => {
  const calls = [];
  const agent = deterministicAgent(async (input, init) => {
    calls.push({ url: String(input), init });
    return turnstileSuccess({ action: "wrong_action" });
  });
  const { env, budget } = baseEnv();

  const response = await agent.fetch(intentRequest(), env);
  const { text, body } = await responseJson(response);
  assert.equal(response.status, 403);
  assert.equal(body.error.code, "turnstile_failed");
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /turnstile\/v0\/siteverify$/);
  const siteverifyBody = JSON.parse(calls[0].init.body);
  assert.equal(siteverifyBody.secret, TEST_TURNSTILE_SECRET);
  assert.equal(siteverifyBody.response, "turnstile-token-123");
  assert.equal(budget.calls.length, 0);
  assert.doesNotMatch(text, /test-openrouter|test-turnstile/i);
});

test("action intent returns a confirmation-only proposal and never executes a side effect", async () => {
  const calls = [];
  const agent = deterministicAgent(async (input, init = {}) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.includes("turnstile")) return turnstileSuccess();
    if (url.includes("openrouter")) {
      const requestBody = JSON.parse(init.body);
      assert.equal(requestBody.model, "test/provider:free");
      assert.equal(requestBody.tools, undefined);
      assert.equal(requestBody.temperature, undefined);
      return openRouterMessage(goal("action", {
        title: "Prepare a restaurant booking",
        summary: "Propose booking a table after the person confirms the consequence.",
        requiresConfirmation: true,
        risk: "medium",
        actionDescription: "Book a table for two at the selected restaurant.",
        actionConsequence: "The restaurant may hold a reservation and apply its cancellation policy.",
      }));
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
  const { env } = baseEnv({ OPENROUTER_MODEL: "test/provider:free" });

  const response = await agent.fetch(intentRequest(validBody({ intent: "Book dinner for two tonight" })), env);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.goal.kind, "action");
  assert.equal(body.goal.status, "awaiting_confirmation");
  assert.equal(body.goal.requiresConfirmation, true);
  assert.equal(body.result, null);
  assert.equal(body.action.description, "Book a table for two at the selected restaurant.");
  assert.equal(body.provenance.model, "test/provider:free");
  assert.equal(body.provenance.simulated, true);
  assert.deepEqual(calls.map((call) => new URL(call.url).hostname), [
    "challenges.cloudflare.com",
    "openrouter.ai",
  ]);
});

test("an incomplete movie clarification is repaired into a safe resumable task instead of HTTP 502", async () => {
  const calls = [];
  const agent = deterministicAgent(async (input) => {
    const url = new URL(String(input));
    calls.push(url.hostname);
    if (url.hostname === "challenges.cloudflare.com") return turnstileSuccess();
    if (url.hostname === "openrouter.ai") {
      return openRouterMessage(goal("clarification", {
        title: "安排電影行程",
        summary: "還需要確認資料。",
        missingFields: [],
        requiresConfirmation: true,
        risk: "medium",
        actionDescription: "Book a movie ticket immediately.",
        actionConsequence: "A ticket purchase could be created.",
      }));
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
  const { env } = baseEnv();

  const response = await agent.fetch(intentRequest(validBody({
    intent: "Help me arrange a cinema outing near Central",
    locale: "zh-Hant",
  })), env);
  const { text, body } = await responseJson(response);

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.goal.kind, "clarification");
  assert.equal(body.goal.status, "needs_clarification");
  assert.equal(body.goal.requiresConfirmation, false);
  assert.equal(body.goal.risk, "none");
  assert.deepEqual(body.goal.missingFields, ["想看的電影", "戲院地區", "場次時間", "門票數量"]);
  assert.equal(body.action, null);
  assert.equal(body.result, null);
  assert.doesNotMatch(text, /Book a movie ticket immediately|ticket purchase could be created/);
  assert.deepEqual(calls, ["challenges.cloudflare.com", "openrouter.ai"]);
});

test("the bare movie case deterministically asks for choices without relying on the model", async () => {
  const calls = [];
  const agent = deterministicAgent(async (input) => {
    const url = new URL(String(input));
    calls.push(url.hostname);
    if (url.hostname === "challenges.cloudflare.com") return turnstileSuccess();
    throw new Error(`unexpected fetch: ${url}`);
  });
  const { env } = baseEnv();

  const response = await agent.fetch(intentRequest(validBody({ intent: "Go to watch movie" })), env);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.goal.status, "needs_clarification");
  assert.equal(body.goal.title, "Arrange a movie outing");
  assert.deepEqual(body.goal.missingFields, [
    "movie preference",
    "cinema area",
    "showtime preference",
    "ticket quantity",
  ]);
  assert.equal(body.provenance.provider, "asympta");
  assert.equal(body.provenance.model, null);
  assert.deepEqual(calls, ["challenges.cloudflare.com"]);
});

test("malformed classifier output safely falls back to movie clarification", async () => {
  const agent = deterministicAgent(async (input) => {
    const url = new URL(String(input));
    if (url.hostname === "challenges.cloudflare.com") return turnstileSuccess();
    if (url.hostname === "openrouter.ai") return openRouterTextMessage("not valid JSON");
    throw new Error(`unexpected fetch: ${url}`);
  });
  const { env } = baseEnv();

  const response = await agent.fetch(intentRequest(validBody({ intent: "Arrange a cinema outing near Central" })), env);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.goal.status, "needs_clarification");
  assert.equal(body.goal.title, "Arrange a movie outing");
  assert.deepEqual(body.goal.missingFields, [
    "movie preference",
    "cinema area",
    "showtime preference",
    "ticket quantity",
  ]);
});

test("weather intent uses bounded Open-Meteo geocoding and forecast data", async () => {
  const calls = [];
  const agent = deterministicAgent(async (input, init = {}) => {
    const url = new URL(String(input));
    calls.push({ url, init });
    if (url.hostname === "challenges.cloudflare.com") return turnstileSuccess();
    if (url.hostname === "openrouter.ai") {
      const requestBody = JSON.parse(init.body);
      assert.equal(requestBody.model, "minimax/minimax-m3:free");
      assert.equal(requestBody.provider, undefined);
      assert.equal(requestBody.response_format, undefined);
      assert.match(requestBody.messages[0].content, /must match this schema exactly/);
      assert.equal(requestBody.temperature, undefined);
      return openRouterMessage(goal("weather", { weatherLocation: "Hong Kong" }));
    }
    if (url.hostname === "geocoding-api.open-meteo.com") {
      assert.equal(url.searchParams.get("name"), "Hong Kong");
      assert.equal(url.searchParams.get("count"), "1");
      return Response.json({
        results: [{
          name: "Hong Kong",
          country: "China",
          latitude: 22.2783,
          longitude: 114.1747,
          timezone: "Asia/Hong_Kong",
        }],
      });
    }
    if (url.hostname === "api.open-meteo.com") {
      assert.equal(url.searchParams.get("forecast_days"), "1");
      assert.equal(url.searchParams.get("timezone"), "Asia/Hong_Kong");
      return Response.json({
        current: {
          temperature_2m: 30.2,
          apparent_temperature: 35.1,
          relative_humidity_2m: 74,
          weather_code: 61,
          wind_speed_10m: 12.4,
        },
        daily: {
          weather_code: [61],
          temperature_2m_max: [32.0],
          temperature_2m_min: [27.1],
          precipitation_probability_max: [70],
        },
      });
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
  const { env, budget } = baseEnv();

  const response = await agent.fetch(intentRequest(validBody({ timezone: "Europe/London" })), env);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.goal.kind, "weather");
  assert.equal(body.goal.status, "completed");
  assert.match(body.result.answer, /Hong Kong, China.*30\.2°C.*70%/);
  assert.equal(body.result.checkedAt, "2026-08-30T05:00:00.000Z");
  assert.deepEqual(body.result.sources.map((source) => source.provider), ["open-meteo", "open-meteo"]);
  assert.equal(body.result.verification.status, "verified");
  assert.deepEqual(body.provenance.tools, ["open-meteo:geocoding", "open-meteo:forecast"]);
  assert.equal(budget.calls.length, 1);
  assert.deepEqual(budget.calls[0].body, { day: "2026-08-30", limit: 500 });
  assert.equal(calls.length, 4);
});

test("research uses two independent bounded searches and a third no-tool cross-check", async () => {
  const openRouterBodies = [];
  const agent = deterministicAgent(async (input, init = {}) => {
    const url = new URL(String(input));
    if (url.hostname === "challenges.cloudflare.com") return turnstileSuccess();
    if (url.hostname === "openrouter.ai") {
      const requestBody = JSON.parse(init.body);
      openRouterBodies.push(requestBody);
      const system = requestBody.messages[0].content;
      if (system.includes("Convert one public user's")) {
        return openRouterMessage(goal("research", {
          title: "Research a current standard",
          summary: "Find the current official information and cite direct sources.",
          researchQuery: "Current ECMAScript language specification edition",
          risk: "low",
        }));
      }
      if (system.includes("research agent A")) {
        return openRouterTextMessage("Agent A reports that ECMA-262 is the maintained language specification.", {
          annotations: [{
            type: "url_citation",
            url_citation: {
              title: "ECMA-262",
              url: "https://tc39.es/ecma262/",
              content: "Official specification",
              start_index: 0,
              end_index: 7,
            },
          }],
        });
      }
      if (system.includes("research agent B")) {
        return openRouterTextMessage("Agent B independently corroborates that ECMA-262 is maintained online.");
      }
      if (system.includes("no-tool synthesis and cross-check agent")) {
        return openRouterTextMessage("Both independent reports agree that ECMA-262 is the maintained ECMAScript language specification.");
      }
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
  const { env } = baseEnv();

  const response = await agent.fetch(intentRequest(validBody({ intent: "What is the current ECMAScript specification?" })), env);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.goal.kind, "research");
  assert.equal(body.result.sources.length, 1);
  assert.equal(body.result.sources[0].url, "https://tc39.es/ecma262/");
  assert.equal(body.result.sources[0].provider, "openrouter-web-search");
  assert.equal(body.result.answer, "Both independent reports agree that ECMA-262 is the maintained ECMAScript language specification.");
  assert.equal(body.result.verification.status, "partially_verified");
  assert.deepEqual(body.provenance.tools, [
    "openrouter:web_search:agent-a",
    "openrouter:web_search:agent-b",
  ]);

  assert.equal(openRouterBodies.length, 4);
  assert.equal(openRouterBodies[0].tools, undefined);
  const researchBodies = openRouterBodies.filter((requestBody) => Array.isArray(requestBody.tools));
  assert.equal(researchBodies.length, 2);
  assert.deepEqual(
    researchBodies.map((requestBody) => requestBody.messages[0].content.match(/research agent ([AB])/)?.[1]).sort(),
    ["A", "B"],
  );
  for (const researchBody of researchBodies) {
    assert.equal(researchBody.tool_choice, "required");
    assert.equal(researchBody.max_tool_calls, 1);
    assert.equal(researchBody.tools.length, 1);
    assert.deepEqual(researchBody.tools[0], {
      type: "openrouter:web_search",
      parameters: {
        engine: "parallel",
        mode: "basic",
        max_results: 4,
        max_uses: 1,
        max_total_results: 4,
        max_characters: 1800,
      },
    });
    assert.equal(researchBody.temperature, undefined);
    assert.equal(researchBody.provider, undefined);
    assert.equal(researchBody.response_format, undefined);
    assert.doesNotMatch(researchBody.messages[0].content, /must match this schema exactly/);
    assert.equal(researchBody.max_tokens, 900);
  }

  const synthesisBody = openRouterBodies.find((requestBody) => requestBody.messages[0].content.includes("no-tool synthesis"));
  assert.ok(synthesisBody);
  assert.equal(synthesisBody.tools, undefined);
  assert.equal(synthesisBody.tool_choice, undefined);
  assert.equal(synthesisBody.max_tool_calls, undefined);
  assert.equal(synthesisBody.provider, undefined);
  assert.equal(synthesisBody.response_format, undefined);
  assert.doesNotMatch(synthesisBody.messages[0].content, /must match this schema exactly/);
  assert.match(synthesisBody.messages[0].content, /consensus.*conflict/i);
  assert.match(synthesisBody.messages[1].content, /Agent A reports/);
  assert.match(synthesisBody.messages[1].content, /Agent B independently corroborates/);
  assert.equal(synthesisBody.max_tokens, 1_200);
});

test("research succeeds without citations, never promotes model-authored URLs, and exposes conflicts to synthesis", async () => {
  const invalidAnnotations = [
    {
      type: "not_a_citation",
      url_citation: { title: "Wrong type", url: "https://example.com/looks-valid" },
    },
    {
      type: "url_citation",
      url_citation: { title: "Credentials", url: "https://user:password@example.com/private" },
    },
    {
      type: "url_citation",
      url_citation: { title: "Plain HTTP", url: "http://example.com/insecure" },
    },
  ];
  const openRouterBodies = [];
  const agent = deterministicAgent(async (input, init = {}) => {
    const url = new URL(String(input));
    if (url.hostname === "challenges.cloudflare.com") return turnstileSuccess();
    if (url.hostname === "openrouter.ai") {
      const requestBody = JSON.parse(init.body);
      openRouterBodies.push(requestBody);
      const system = requestBody.messages[0].content;
      if (system.includes("Convert one public user's")) {
        return openRouterMessage(goal("research", {
          title: "Research a current standard",
          summary: "Find the current official information and cite direct sources.",
          researchQuery: "Current ECMAScript language specification edition",
          risk: "low",
        }));
      }
      if (system.includes("research agent A")) {
        return openRouterTextMessage(
          "Agent A says edition 15 at https://invented.invalid, but that URL is only model text.",
          { annotations: invalidAnnotations },
        );
      }
      if (system.includes("research agent B")) {
        return openRouterTextMessage("Agent B says edition 16 and explicitly disagrees with Agent A.");
      }
      if (system.includes("no-tool synthesis and cross-check agent")) {
        assert.match(system, /material conflict/i);
        const synthesisInput = JSON.parse(requestBody.messages[1].content);
        assert.match(synthesisInput.reports[0].answer, /edition 15/);
        assert.match(synthesisInput.reports[1].answer, /edition 16/);
        assert.deepEqual(synthesisInput.reports.map((report) => report.annotatedSourceCount), [0, 0]);
        return openRouterTextMessage("The two reports conflict on the edition number, so the current edition remains uncertain.");
      }
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
  const { env } = baseEnv();

  const response = await agent.fetch(intentRequest(validBody({ intent: "Research the current ECMAScript specification" })), env);
  const { text, body } = await responseJson(response);
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.deepEqual(body.result.sources, []);
  assert.equal(body.result.verification.status, "not_verified");
  assert.match(body.result.verification.details, /two independent research agents/i);
  assert.match(body.result.verification.details, /no verifiable source links/i);
  assert.match(body.result.answer, /conflict.*uncertain/i);
  assert.equal(openRouterBodies.length, 4);
  assert.equal(openRouterBodies.filter((requestBody) => requestBody.response_format !== undefined).length, 0);
  assert.doesNotMatch(text, /invented\.invalid|user:password/);
});

test("research merges, normalizes, deduplicates, and bounds formal URL citation annotations from both agents", async () => {
  const openRouterBodies = [];
  const agent = deterministicAgent(async (input, init = {}) => {
    const url = new URL(String(input));
    if (url.hostname === "challenges.cloudflare.com") return turnstileSuccess();
    if (url.hostname === "openrouter.ai") {
      const requestBody = JSON.parse(init.body);
      openRouterBodies.push(requestBody);
      const system = requestBody.messages[0].content;
      if (system.includes("Convert one public user's")) {
        return openRouterMessage(goal("research", {
          title: "Research a current standard",
          summary: "Find the current official information and cite direct sources.",
          researchQuery: "Current ECMAScript language specification edition",
          risk: "low",
        }));
      }
      if (system.includes("research agent A")) {
        return openRouterTextMessage("Agent A found the maintained specification; https://model-only.invalid is not a citation.", {
          annotations: [
            { type: "url_citation", url_citation: { title: "ECMA-262 section", url: "https://tc39.es/ecma262/#sec-intro" } },
            { type: "not_a_citation", url_citation: { title: "Wrong type", url: "https://wrong-type.invalid/" } },
          ],
        });
      }
      if (system.includes("research agent B")) {
        return openRouterTextMessage("Agent B independently found the same specification publisher.", {
          annotations: [
            { type: "url_citation", url_citation: { title: "Duplicate", url: "https://tc39.es/ecma262/#sec-scope" } },
            { type: "url_citation", url_citation: { title: "", url: "https://www.ecma-international.org/publications-and-standards/standards/ecma-262/" } },
          ],
        });
      }
      if (system.includes("no-tool synthesis and cross-check agent")) {
        return openRouterTextMessage("Both reports agree that the current specification is maintained online.");
      }
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
  const { env } = baseEnv();

  const response = await agent.fetch(intentRequest(validBody({ intent: "Research the current ECMAScript specification" })), env);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(openRouterBodies.length, 4);
  assert.equal(body.result.verification.status, "partially_verified");
  assert.deepEqual(body.result.sources.map(({ title, url }) => ({ title, url })), [
    { title: "ECMA-262 section", url: "https://tc39.es/ecma262/" },
    {
      title: "www.ecma-international.org",
      url: "https://www.ecma-international.org/publications-and-standards/standards/ecma-262/",
    },
  ]);
  assert.equal(body.result.sources.some((source) => /model-only|wrong-type/.test(source.url)), false);
});

test("rate and daily global limits fail closed before OpenRouter", async () => {
  let rateFetchCalls = 0;
  const rateAgent = deterministicAgent(async () => { rateFetchCalls += 1; throw new Error("unexpected fetch"); });
  const { env: rateEnv } = baseEnv({
    INTENT_RATE_LIMIT: { async limit() { return { success: false }; } },
  });
  const rateResponse = await rateAgent.fetch(intentRequest(), rateEnv);
  assert.equal(rateResponse.status, 429);
  assert.equal((await rateResponse.json()).error.code, "rate_limited");
  assert.equal(rateFetchCalls, 0);

  let budgetFetchCalls = 0;
  const budgetAgent = deterministicAgent(async (input) => {
    budgetFetchCalls += 1;
    assert.match(String(input), /turnstile/);
    return turnstileSuccess();
  });
  const deniedBudget = budgetBinding(false);
  const { env: budgetEnv } = baseEnv({ GLOBAL_DAILY_BUDGET: deniedBudget.binding });
  const budgetResponse = await budgetAgent.fetch(intentRequest(), budgetEnv);
  assert.equal(budgetResponse.status, 429);
  assert.equal((await budgetResponse.json()).error.code, "budget_exhausted");
  assert.equal(budgetFetchCalls, 1);
  assert.equal(deniedBudget.calls.length, 1);
});

test("DailyGlobalBudget enforces an exact UTC-day count and resets on a new day", async () => {
  let stored;
  let queue = Promise.resolve();
  const storage = {
    async transaction(closure) {
      let release;
      const previous = queue;
      queue = new Promise((resolve) => { release = resolve; });
      await previous;
      try {
        return await closure({
          async get(key) {
            assert.equal(key, "daily-global-budget");
            return stored;
          },
          async put(key, value) {
            assert.equal(key, "daily-global-budget");
            stored = structuredClone(value);
          },
        });
      } finally {
        release();
      }
    },
  };
  const budget = new DailyGlobalBudget({ storage });
  const consume = (day) => budget.fetch(new Request("https://budget.internal/consume", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ day, limit: 2 }),
  }));

  const concurrent = await Promise.all([consume("2026-08-30"), consume("2026-08-30"), consume("2026-08-30")]);
  assert.deepEqual(concurrent.map((response) => response.status).sort(), [200, 200, 429]);
  assert.deepEqual(stored, { day: "2026-08-30", count: 2 });

  const nextDay = await consume("2026-08-31");
  assert.equal(nextDay.status, 200);
  assert.deepEqual(stored, { day: "2026-08-31", count: 1 });
});
