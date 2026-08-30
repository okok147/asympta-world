import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  ASYMPTA_WEBMCP_AUXILIARY_TOOL_NAMES,
  ASYMPTA_WEBMCP_CORE_TOOL_NAMES,
  ASYMPTA_WEBMCP_GLOBAL_TOOL_NAMES,
  ASYMPTA_WEBMCP_MANIFEST,
  ASYMPTA_WEBMCP_TOOL_MODES,
  ASYMPTA_WEBMCP_TOOL_NAMES,
  validateAsymptaWebMcpTools,
} from "../lib/asympta-webmcp-contract.ts";

test("WebMCP manifest exposes one unique challenge tool surface", () => {
  assert.equal(ASYMPTA_WEBMCP_CORE_TOOL_NAMES.length, 5);
  assert.equal(ASYMPTA_WEBMCP_AUXILIARY_TOOL_NAMES.length, 7);
  assert.equal(ASYMPTA_WEBMCP_GLOBAL_TOOL_NAMES.length, 1);
  assert.equal(ASYMPTA_WEBMCP_TOOL_NAMES.length, 13);
  assert.equal(new Set(ASYMPTA_WEBMCP_TOOL_NAMES).size, ASYMPTA_WEBMCP_TOOL_NAMES.length);
  assert.ok(ASYMPTA_WEBMCP_TOOL_NAMES.includes("asympta_submit_request"));
  assert.ok(ASYMPTA_WEBMCP_TOOL_NAMES.includes("asympta_read_request"));
  assert.ok(ASYMPTA_WEBMCP_TOOL_NAMES.includes("asympta_send_agent_message"));
  assert.ok(ASYMPTA_WEBMCP_TOOL_NAMES.includes("asympta_list_agent_messages"));
  assert.ok(ASYMPTA_WEBMCP_TOOL_NAMES.includes("asympta_observe_global_supply_network"));
  assert.equal(ASYMPTA_WEBMCP_TOOL_MODES.asympta_submit_request, "WRITE");
  assert.equal(ASYMPTA_WEBMCP_TOOL_MODES.asympta_read_request, "READ");
  assert.equal(ASYMPTA_WEBMCP_TOOL_MODES.asympta_follow_agent, "WRITE");
});

test("WebMCP manifest preserves the human approval boundary", () => {
  assert.equal(ASYMPTA_WEBMCP_MANIFEST.api, "document.modelContext");
  assert.equal(ASYMPTA_WEBMCP_MANIFEST.workflows.length, 4);
  assert.equal(ASYMPTA_WEBMCP_MANIFEST.agents.length, 10);
  assert.equal(ASYMPTA_WEBMCP_MANIFEST.safety.consequentialRequestsRequireHumanApproval, true);
  assert.equal(ASYMPTA_WEBMCP_MANIFEST.safety.workflowStartsRequestedByWebMcpRequireHumanApproval, true);
  assert.equal(ASYMPTA_WEBMCP_MANIFEST.safety.approvalResolutionExposedAsWebMcpTool, false);
  assert.match(ASYMPTA_WEBMCP_MANIFEST.participationBridge.principle, /Natural language for people/);
  assert.ok(!ASYMPTA_WEBMCP_TOOL_NAMES.some((name) => /approve|resolve_approval|decline/.test(name)));
});

test("WebMCP browser audit accepts complete Chrome getTools-style descriptors", () => {
  const browserTools = ASYMPTA_WEBMCP_TOOL_NAMES.map((name) => ({
    name,
    description: `${name} test descriptor`,
    inputSchema: JSON.stringify({ type: "object", properties: {}, additionalProperties: false }),
    annotations: { readOnlyHint: ASYMPTA_WEBMCP_TOOL_MODES[name] === "READ" },
  }));
  const result = validateAsymptaWebMcpTools(browserTools);
  assert.equal(result.ok, true);
  assert.deepEqual(result.missing, []);
  assert.deepEqual(result.duplicateNames, []);
  assert.deepEqual(result.unexpected, []);
  assert.deepEqual(result.invalidSchemas, []);
  assert.deepEqual(result.invalidAccessHints, []);
});

test("WebMCP browser audit fails closed when an access hint is missing", () => {
  const browserTools = ASYMPTA_WEBMCP_TOOL_NAMES.map((name) => ({
    name,
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: ASYMPTA_WEBMCP_TOOL_MODES[name] === "READ" },
  }));
  delete browserTools.find((tool) => tool.name === "asympta_submit_request").annotations;

  const result = validateAsymptaWebMcpTools(browserTools);
  assert.equal(result.ok, false);
  assert.deepEqual(result.invalidAccessHints, ["asympta_submit_request"]);
});

test("WebMCP browser audit rejects unexpected tools and incorrect read/write hints", () => {
  const browserTools = ASYMPTA_WEBMCP_TOOL_NAMES.map((name) => ({
    name,
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: ASYMPTA_WEBMCP_TOOL_MODES[name] === "READ" },
  }));
  browserTools.find((tool) => tool.name === "asympta_follow_agent").annotations.readOnlyHint = true;
  browserTools.push({
    name: "unexpected_browser_tool",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
  });

  const result = validateAsymptaWebMcpTools(browserTools);
  assert.equal(result.ok, false);
  assert.deepEqual(result.unexpected, ["unexpected_browser_tool"]);
  assert.deepEqual(result.invalidAccessHints, ["asympta_follow_agent"]);
});

test("browser integration uses the direct WebMCP imperative API and abort lifecycle", () => {
  const source = readFileSync(new URL("../components/asympta-webmcp-tools.tsx", import.meta.url), "utf8");
  assert.match(source, /document\.modelContext\.registerTool\(/);
  assert.match(source, /AbortController/);
  assert.match(source, /controller\.abort\(\)/);
  for (const name of ASYMPTA_WEBMCP_AUXILIARY_TOOL_NAMES) assert.ok(source.includes(name));
});

test("mounted components register every catalogued WebMCP tool", () => {
  const worldSource = readFileSync(new URL("../components/asympta-world-live-60hz.tsx", import.meta.url), "utf8");
  const auxiliarySource = readFileSync(new URL("../components/asympta-webmcp-tools.tsx", import.meta.url), "utf8");
  const globalSource = readFileSync(new URL("../components/asympta-global-world.tsx", import.meta.url), "utf8");
  for (const name of ASYMPTA_WEBMCP_CORE_TOOL_NAMES) assert.ok(worldSource.includes(name), `missing core source registration: ${name}`);
  for (const name of ASYMPTA_WEBMCP_AUXILIARY_TOOL_NAMES) assert.ok(auxiliarySource.includes(name), `missing auxiliary source registration: ${name}`);
  for (const name of ASYMPTA_WEBMCP_GLOBAL_TOOL_NAMES) assert.ok(globalSource.includes(name), `missing global source registration: ${name}`);
});

test("read-only WebMCP handlers do not synchronously mirror messages into localStorage", () => {
  const source = readFileSync(new URL("../components/asympta-webmcp-tools.tsx", import.meta.url), "utf8");
  const describe = source.slice(source.indexOf('name: "asympta_describe_capabilities"'), source.indexOf('name: "asympta_inspect_agent"'));
  const inspect = source.slice(source.indexOf('name: "asympta_inspect_agent"'), source.indexOf('name: "asympta_get_pending_approval"'));
  const list = source.slice(source.indexOf('name: "asympta_list_agent_messages"'), source.indexOf("const syncTimer"));
  assert.doesNotMatch(describe, /syncVisibleWorkflowMessages\(\)/);
  assert.doesNotMatch(inspect, /syncVisibleWorkflowMessages\(\)/);
  assert.doesNotMatch(list, /syncVisibleWorkflowMessages\(\)/);
});
