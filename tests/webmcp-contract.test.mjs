import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  ASYMPTA_WEBMCP_AUXILIARY_TOOL_NAMES,
  ASYMPTA_WEBMCP_CORE_TOOL_NAMES,
  ASYMPTA_WEBMCP_MANIFEST,
  ASYMPTA_WEBMCP_TOOL_NAMES,
  validateAsymptaWebMcpTools,
} from "../lib/asympta-webmcp-contract.ts";

test("WebMCP manifest exposes one unique challenge tool surface", () => {
  assert.equal(ASYMPTA_WEBMCP_CORE_TOOL_NAMES.length, 5);
  assert.equal(ASYMPTA_WEBMCP_AUXILIARY_TOOL_NAMES.length, 5);
  assert.equal(ASYMPTA_WEBMCP_TOOL_NAMES.length, 10);
  assert.equal(new Set(ASYMPTA_WEBMCP_TOOL_NAMES).size, ASYMPTA_WEBMCP_TOOL_NAMES.length);
  assert.ok(ASYMPTA_WEBMCP_TOOL_NAMES.includes("asympta_send_agent_message"));
  assert.ok(ASYMPTA_WEBMCP_TOOL_NAMES.includes("asympta_list_agent_messages"));
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

test("WebMCP browser audit accepts Chrome getTools-style schemas", () => {
  const browserTools = ASYMPTA_WEBMCP_TOOL_NAMES.map((name) => ({
    name,
    description: `${name} test descriptor`,
    inputSchema: JSON.stringify({ type: "object", properties: {}, additionalProperties: false }),
  }));
  const result = validateAsymptaWebMcpTools(browserTools);
  assert.equal(result.ok, true);
  assert.deepEqual(result.missing, []);
  assert.deepEqual(result.duplicateNames, []);
  assert.deepEqual(result.invalidSchemas, []);
});

test("browser integration uses the direct WebMCP imperative API and abort lifecycle", () => {
  const source = readFileSync(new URL("../components/asympta-webmcp-tools.tsx", import.meta.url), "utf8");
  assert.match(source, /document\.modelContext\.registerTool\(/);
  assert.match(source, /AbortController/);
  assert.match(source, /controller\.abort\(\)/);
  for (const name of ASYMPTA_WEBMCP_AUXILIARY_TOOL_NAMES) assert.ok(source.includes(name));
});

test("mounted world registers all core tools and documentation matches live names", () => {
  const worldSource = readFileSync(new URL("../components/asympta-world-live-60hz.tsx", import.meta.url), "utf8");
  const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
  for (const name of ASYMPTA_WEBMCP_CORE_TOOL_NAMES) assert.ok(worldSource.includes(name), `missing core source registration: ${name}`);
  for (const name of ASYMPTA_WEBMCP_TOOL_NAMES) assert.ok(readme.includes(name), `README missing current tool name: ${name}`);
  for (const stale of ["asympta_observe_coordination", "asympta_list_local_services", "asympta_submit_need", "asympta_exchange_information", "asympta_request_action"]) {
    assert.equal(readme.includes(stale), false, `README still contains stale WebMCP tool ${stale}`);
  }
});
