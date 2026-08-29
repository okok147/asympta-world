"use client";

import { useEffect } from "react";

import { ATLAS_AGENTS } from "@/lib/atlas-simulation";
import {
  ASYMPTA_WEBMCP_MANIFEST,
  validateAsymptaWebMcpTools,
  type BrowserWebMcpToolDescriptor,
} from "@/lib/asympta-webmcp-contract";

type WebMcpTool = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: Record<string, unknown>) => Promise<string>;
};

type DemoBridge = {
  snapshot: () => unknown;
};

type WebMcpDebugWindow = Window & {
  __ASYMPTA_DEMO__?: DemoBridge;
  __ASYMPTA_WEBMCP_AUDIT__?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function recordArray(value: unknown) {
  return Array.isArray(value)
    ? value.map(asRecord).filter((item): item is Record<string, unknown> => item !== null)
    : [];
}

function readForegroundSnapshot() {
  const bridge = (window as WebMcpDebugWindow).__ASYMPTA_DEMO__;
  const root = bridge ? asRecord(bridge.snapshot()) : null;
  return root ? asRecord(root.foreground) : null;
}

function withoutSyntheticCoordinates(record: Record<string, unknown>) {
  const result = { ...record };
  delete result.lon;
  delete result.lat;
  return result;
}

function registerNativeTool(tool: WebMcpTool, signal: AbortSignal) {
  if (!document.modelContext) throw new Error("WebMCP browser API unavailable.");
  return document.modelContext.registerTool(tool, { signal });
}

async function getNativeTools(): Promise<BrowserWebMcpToolDescriptor[] | null> {
  const modelContext = document.modelContext as unknown as { getTools?: () => unknown | Promise<unknown> } | undefined;
  if (!modelContext?.getTools) return null;
  const value = await Promise.resolve(modelContext.getTools());
  return Array.isArray(value) ? value as BrowserWebMcpToolDescriptor[] : null;
}

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));
}

export function AsymptaWebMcpTools() {
  useEffect(() => {
    const controller = new AbortController();
    const root = document.documentElement;
    const debugWindow = window as WebMcpDebugWindow;

    if (!document.modelContext) {
      root.dataset.webmcpQualification = "unavailable";
      return () => controller.abort();
    }

    const agentIds = ATLAS_AGENTS.map((agent) => agent.id);
    const readOnly = { readOnlyHint: true, untrustedContentHint: false };
    const tools: WebMcpTool[] = [
      {
        name: "asympta_describe_capabilities",
        title: "Describe Asympta World capabilities",
        description: "Describe the WebMCP tool surface, workflows, agents, simulation disclosure and human-approval safety boundary.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: readOnly,
        execute: async () => {
          const foreground = readForegroundSnapshot();
          return JSON.stringify({
            ok: true,
            manifest: ASYMPTA_WEBMCP_MANIFEST,
            live: foreground ? {
              phase: foreground.phase ?? null,
              workflow: foreground.workflow ?? null,
              pendingApprovalCount: recordArray(foreground.pendingApprovals).length,
            } : null,
          });
        },
      },
      {
        name: "asympta_inspect_agent",
        title: "Inspect an Asympta agent",
        description: "Read one foreground stakeholder agent and its current tasks without exposing synthetic map coordinates.",
        inputSchema: {
          type: "object",
          properties: { agentId: { type: "string", enum: agentIds } },
          required: ["agentId"],
          additionalProperties: false,
        },
        annotations: readOnly,
        execute: async (input) => {
          const agentId = String(input.agentId ?? "");
          if (!agentIds.includes(agentId)) return JSON.stringify({ ok: false, error: "Unknown agent." });
          const foreground = readForegroundSnapshot();
          if (!foreground) return JSON.stringify({ ok: false, error: "Living world state is not mounted." });
          const agent = recordArray(foreground.agents).find((item) => item.id === agentId);
          if (!agent) return JSON.stringify({ ok: false, error: "Agent is not present in the foreground world." });
          const tasks = recordArray(foreground.tasks)
            .filter((item) => item.agentId === agentId)
            .map(withoutSyntheticCoordinates);
          return JSON.stringify({ ok: true, agent: withoutSyntheticCoordinates(agent), tasks });
        },
      },
      {
        name: "asympta_get_pending_approval",
        title: "Get pending human approval",
        description: "Read the current human approval request, if any. This tool cannot approve or decline it.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: readOnly,
        execute: async () => {
          const foreground = readForegroundSnapshot();
          if (!foreground) return JSON.stringify({ ok: false, error: "Living world state is not mounted." });
          const pending = recordArray(foreground.pendingApprovals)[0] ?? null;
          return JSON.stringify({ ok: true, pendingApproval: pending });
        },
      },
    ];

    const registerAndAudit = async () => {
      try {
        for (const tool of tools) {
          await Promise.resolve(registerNativeTool(tool, controller.signal));
        }

        let audit: ReturnType<typeof validateAsymptaWebMcpTools> | null = null;
        for (let attempt = 0; attempt < 8 && !controller.signal.aborted; attempt += 1) {
          const registered = await getNativeTools();
          if (!registered) break;
          audit = validateAsymptaWebMcpTools(registered);
          if (audit.ok) break;
          await delay(60);
        }

        if (controller.signal.aborted) return;
        debugWindow.__ASYMPTA_WEBMCP_AUDIT__ = audit ?? {
          ok: true,
          note: "Auxiliary WebMCP tools registered; this browser does not expose getTools() for an in-page audit.",
        };
        root.dataset.webmcpQualification = audit ? (audit.ok ? "ready" : "partial") : "registered";
      } catch (error) {
        if (controller.signal.aborted) return;
        debugWindow.__ASYMPTA_WEBMCP_AUDIT__ = {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        };
        root.dataset.webmcpQualification = "error";
      }
    };

    void registerAndAudit();
    return () => controller.abort();
  }, []);

  return null;
}
