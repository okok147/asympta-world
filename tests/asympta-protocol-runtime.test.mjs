import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createAsymptaActivity } from "../lib/asympta-activity.ts";
import { buildMcpArguments, runAsymptaIntent } from "../lib/asympta-protocol-runtime.ts";
import { callMcpTool, listMcpTools } from "../lib/protocols/mcp-client.ts";
import { resolveA2AAgentCard, sendA2AMessage } from "../lib/protocols/a2a-client.ts";

function jsonResponse(value, init = {}) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
}

test("Asympta IR keeps the original human intention as the durable activity root", () => {
  const activity = createAsymptaActivity({ intent: "I want some food delivered within two hours.", locale: "en", now: 100 });
  assert.equal(activity.version, "asympta-ir/0.1");
  assert.equal(activity.intent.raw, "I want some food delivered within two hours.");
  assert.equal(activity.principal.kind, "human");
  assert.equal(activity.status, "interpreting");
});

test("MCP client uses the 2026-07-28 stateless request surface rather than a fake or initialize session", async () => {
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push({ url: String(url), init, body: JSON.parse(String(init.body)) });
    return jsonResponse({ jsonrpc: "2.0", id: "1", result: { tools: [{ name: "search_food", description: "Find food", inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } }] } });
  };

  const tools = await listMcpTools({ url: "https://tools.example/mcp" }, { fetcher });
  assert.equal(tools[0].name, "search_food");
  assert.equal(calls[0].body.method, "tools/list");
  assert.notEqual(calls[0].body.method, "initialize");
  assert.equal(calls[0].init.headers["MCP-Protocol-Version"], "2026-07-28");
  assert.equal(calls[0].init.headers["Mcp-Method"], "tools/list");
  assert.equal(calls[0].body.params._meta["io.modelcontextprotocol/clientInfo"].name, "asympta-world");
});

test("MCP tool execution is an actual tools/call with routable method and tool headers", async () => {
  let call;
  const fetcher = async (url, init) => {
    call = { url: String(url), init, body: JSON.parse(String(init.body)) };
    return jsonResponse({ jsonrpc: "2.0", id: "2", result: { content: [{ type: "text", text: "available" }], isError: false } });
  };

  await callMcpTool({ url: "https://tools.example/mcp" }, "inventory_check", { query: "rice" }, { fetcher });
  assert.equal(call.body.method, "tools/call");
  assert.equal(call.body.params.name, "inventory_check");
  assert.equal(call.init.headers["Mcp-Method"], "tools/call");
  assert.equal(call.init.headers["Mcp-Name"], "inventory_check");
});

test("A2A client discovers the public Agent Card and sends a v1 SendMessage request", async () => {
  const calls = [];
  const fetcher = async (url, init = {}) => {
    calls.push({ url: String(url), init, body: init.body ? JSON.parse(String(init.body)) : null });
    if ((init.method ?? "GET") === "GET") {
      return jsonResponse({
        name: "Neighbourhood Grocer",
        supportedInterfaces: [{ url: "https://grocer.example/a2a", protocolBinding: "JSONRPC", protocolVersion: "1.0" }],
        skills: [{ name: "Grocery fulfilment", description: "Find and deliver groceries" }],
      });
    }
    return jsonResponse({ jsonrpc: "2.0", id: "3", result: { task: { id: "task-1", status: { state: "TASK_STATE_COMPLETED" } } } });
  };

  const peer = { url: "https://grocer.example" };
  const card = await resolveA2AAgentCard(peer, { fetcher });
  const result = await sendA2AMessage(peer, "I want some food.", { card, fetcher });
  assert.equal(calls[0].url, "https://grocer.example/.well-known/agent-card.json");
  assert.equal(calls[1].url, "https://grocer.example/a2a");
  assert.equal(calls[1].body.method, "SendMessage");
  assert.equal(calls[1].body.params.message.role, "ROLE_USER");
  assert.equal(result.result.id, "task-1");
});

test("runtime delegates a natural-language intention through a real A2A transport and verifies terminal task state", async () => {
  const methods = [];
  const fetcher = async (url, init = {}) => {
    if ((init.method ?? "GET") === "GET") {
      return jsonResponse({
        name: "Food Agent",
        description: "Grocery and meal fulfilment",
        supportedInterfaces: [{ url: "https://food.example/a2a", protocolBinding: "JSONRPC", protocolVersion: "1.0" }],
        skills: [{ name: "Food delivery", description: "Buy groceries and arrange delivery" }],
      });
    }
    const body = JSON.parse(String(init.body));
    methods.push(body.method);
    return jsonResponse({ jsonrpc: "2.0", id: body.id, result: { task: { id: "food-1", status: { state: "TASK_STATE_COMPLETED" }, artifacts: [{ artifactId: "receipt-1" }] } } });
  };

  const activity = await runAsymptaIntent("Please get some food delivered to my home.", { a2a: [{ url: "https://food.example" }], mcp: [] }, { fetcher });
  assert.equal(activity.status, "completed");
  assert.equal(activity.outcome?.verification, "task-completed");
  assert.equal(methods[0], "SendMessage");
  assert.ok(activity.evidence.some((item) => item.protocol === "a2a" && item.kind === "agent-card"));
});

test("runtime can discover and execute a real MCP tool when no A2A agent is available", async () => {
  const methods = [];
  const fetcher = async (url, init) => {
    const body = JSON.parse(String(init.body));
    methods.push(body.method);
    if (body.method === "tools/list") {
      return jsonResponse({ jsonrpc: "2.0", id: body.id, result: { tools: [{ name: "food_search", title: "Food search", description: "Search food and groceries", inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] }, annotations: { readOnlyHint: true } }] } });
    }
    return jsonResponse({ jsonrpc: "2.0", id: body.id, result: { content: [{ type: "text", text: "found" }], isError: false } });
  };

  const activity = await runAsymptaIntent("Find food near me", { a2a: [], mcp: [{ url: "https://tools.example/mcp" }] }, {
    fetcher,
    trustedMcpEndpoints: ["https://tools.example/mcp"],
  });
  assert.equal(activity.status, "completed");
  assert.deepEqual(methods, ["tools/list", "tools/call"]);
  assert.equal(activity.outcome?.verification, "tool-result");
});

test("runtime never calls an MCP tool unless it is explicitly read-only", async () => {
  for (const annotations of [undefined, { readOnlyHint: false }]) {
    const methods = [];
    const fetcher = async (url, init) => {
      const body = JSON.parse(String(init.body));
      methods.push(body.method);
      return jsonResponse({
        jsonrpc: "2.0",
        id: body.id,
        result: {
          tools: [{
            name: "reserve_inventory",
            description: "Reserve inventory for an order",
            inputSchema: { type: "object", properties: { request: { type: "string" } }, required: ["request"] },
            ...(annotations ? { annotations } : {}),
          }],
        },
      });
    };

    const activity = await runAsymptaIntent("Reserve inventory for my order", {
      a2a: [],
      mcp: [{ url: "https://tools.example/mcp" }],
    }, {
      fetcher,
      trustedMcpEndpoints: ["https://tools.example/mcp"],
    });
    assert.equal(activity.status, "waiting_input");
    assert.deepEqual(methods, ["tools/list"]);
    assert.equal(activity.events.at(-1)?.data?.reason, "tool_not_explicitly_read_only");
    assert.equal(activity.events.at(-1)?.data?.toolCallMade, false);
  }
});

test("runtime never calls an explicitly read-only MCP tool from an untrusted endpoint", async () => {
  const methods = [];
  const fetcher = async (url, init) => {
    const body = JSON.parse(String(init.body));
    methods.push(body.method);
    return jsonResponse({
      jsonrpc: "2.0",
      id: body.id,
      result: {
        tools: [{
          name: "weather_lookup",
          description: "Read current weather information",
          inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
          annotations: { readOnlyHint: true },
        }],
      },
    });
  };

  const activity = await runAsymptaIntent("Check the weather", {
    a2a: [],
    mcp: [{ url: "https://untrusted.example/mcp" }],
  }, {
    fetcher,
    trustedMcpEndpoints: ["https://tools.example/mcp"],
  });
  assert.equal(activity.status, "waiting_input");
  assert.deepEqual(methods, ["tools/list"]);
  assert.equal(activity.events.at(-1)?.data?.reason, "untrusted_mcp_endpoint");
  assert.equal(activity.events.at(-1)?.data?.toolCallMade, false);
});

test("MCP arguments are conservative: Asympta asks rather than inventing consequential required fields", () => {
  const simple = buildMcpArguments("find dinner", { name: "search", inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } });
  assert.deepEqual(simple, { arguments: { query: "find dinner" }, missing: [] });

  const consequential = buildMcpArguments("pay for dinner", { name: "pay", inputSchema: { type: "object", properties: { amount: { type: "number" }, currency: { type: "string" } }, required: ["amount", "currency"] } });
  assert.deepEqual(consequential.arguments, {});
  assert.deepEqual(consequential.missing, ["amount", "currency"]);
});

test("consumer surface is intent-first and hides preset workflow / protocol dashboard chrome", () => {
  const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../app/asympta-intent.css", import.meta.url), "utf8");
  const composer = readFileSync(new URL("../components/asympta-intent-composer.tsx", import.meta.url), "utf8");
  assert.match(page, /AsymptaIntentComposer/);
  assert.doesNotMatch(page, /AsymptaWorkflowGuide/);
  assert.match(css, /\.atlas-menu-panel \.atlas-workflows/);
  assert.match(css, /\.atlas-menu-panel \.atlas-webmcp-inspector/);
  assert.match(composer, /Tell Asympta what you want to happen/);
  assert.match(composer, /__ASYMPTA_PROTOCOLS__/);
});
