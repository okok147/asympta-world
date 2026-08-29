import { ATLAS_AGENTS, ATLAS_WORKFLOWS } from "./atlas-simulation.ts";

export const ASYMPTA_WEBMCP_CORE_TOOL_NAMES = [
  "asympta_observe_living_city",
  "asympta_list_workflows",
  "asympta_follow_agent",
  "asympta_request_workflow",
  "asympta_request_external_action",
] as const;

export const ASYMPTA_WEBMCP_AUXILIARY_TOOL_NAMES = [
  "asympta_describe_capabilities",
  "asympta_inspect_agent",
  "asympta_get_pending_approval",
] as const;

export const ASYMPTA_WEBMCP_TOOL_NAMES = [
  ...ASYMPTA_WEBMCP_CORE_TOOL_NAMES,
  ...ASYMPTA_WEBMCP_AUXILIARY_TOOL_NAMES,
] as const;

export type AsymptaWebMcpToolName = (typeof ASYMPTA_WEBMCP_TOOL_NAMES)[number];

export type BrowserWebMcpToolDescriptor = {
  name?: unknown;
  description?: unknown;
  inputSchema?: unknown;
};

function parseInputSchema(value: unknown): Record<string, unknown> | null {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : null;
    } catch {
      return null;
    }
  }
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export const ASYMPTA_WEBMCP_MANIFEST = {
  product: "Asympta World",
  api: "document.modelContext",
  integration: "imperative WebMCP",
  disclosure: "All commerce, payment, shipment, supplier and city activity in this challenge build is simulated.",
  safety: {
    consequentialRequestsRequireHumanApproval: true,
    workflowStartsRequestedByWebMcpRequireHumanApproval: true,
    approvalResolutionExposedAsWebMcpTool: false,
    deviceGeolocationUsedByWebMcpSurface: false,
  },
  workflows: ATLAS_WORKFLOWS.map((workflow) => ({
    id: workflow.id,
    name: workflow.name,
    summary: workflow.summary,
  })),
  agents: ATLAS_AGENTS.map((agent) => ({
    id: agent.id,
    name: agent.name,
    side: agent.side,
    role: agent.role,
    organisation: agent.organisation,
  })),
  tools: ASYMPTA_WEBMCP_TOOL_NAMES.map((name) => ({ name })),
} as const;

export function validateAsymptaWebMcpTools(tools: readonly BrowserWebMcpToolDescriptor[]) {
  const names = tools
    .map((tool) => typeof tool.name === "string" ? tool.name : "")
    .filter(Boolean);
  const counts = new Map<string, number>();
  names.forEach((name) => counts.set(name, (counts.get(name) ?? 0) + 1));

  const missing = ASYMPTA_WEBMCP_TOOL_NAMES.filter((name) => !counts.has(name));
  const duplicateNames = ASYMPTA_WEBMCP_TOOL_NAMES.filter((name) => (counts.get(name) ?? 0) > 1);
  const invalidSchemas = ASYMPTA_WEBMCP_TOOL_NAMES.filter((name) => {
    const descriptor = tools.find((tool) => tool.name === name);
    if (!descriptor) return false;
    const schema = parseInputSchema(descriptor.inputSchema);
    return !schema || schema.type !== "object";
  });

  return {
    ok: missing.length === 0 && duplicateNames.length === 0 && invalidSchemas.length === 0,
    expectedCount: ASYMPTA_WEBMCP_TOOL_NAMES.length,
    discoveredExpectedCount: ASYMPTA_WEBMCP_TOOL_NAMES.length - missing.length,
    missing,
    duplicateNames,
    invalidSchemas,
  };
}
