"use client";

import { useEffect } from "react";

import { ATLAS_AGENTS } from "@/lib/atlas-simulation";
import {
  getBrowserAgentMessageState,
  listBrowserStructuredMessages,
  submitBrowserStructuredMessage,
  syncBrowserWorkflowMessages,
  type MessageParticipantKind,
  type StructuredMessageKind,
} from "@/lib/agent-message-state";
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

function messageWorldContext(foreground: Record<string, unknown> | null) {
  const runtime = foreground ? asRecord(foreground.runtime) : null;
  return {
    workflow: typeof foreground?.workflow === "string" ? foreground.workflow : null,
    worldRevision: typeof runtime?.revision === "number" ? runtime.revision : null,
  };
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

function syncVisibleWorkflowMessages() {
  const foreground = readForegroundSnapshot();
  if (!foreground) return;
  const messages = recordArray(foreground.messages).map((message) => ({
    id: `${String(message.from ?? "")}|${String(message.to ?? "")}|${String(message.text ?? "")}`,
    from: message.from,
    to: message.to,
    text: message.text,
  }));
  if (messages.length) syncBrowserWorkflowMessages(messages, messageWorldContext(foreground));
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
    const mutating = { readOnlyHint: false, untrustedContentHint: true };
    const participantKinds: MessageParticipantKind[] = ["human", "agent", "business", "organization", "system"];
    const messageKinds: StructuredMessageKind[] = ["request", "offer", "question", "answer", "update", "confirmation", "warning", "handoff", "plain"];
    const tools: WebMcpTool[] = [
      {
        name: "asympta_describe_capabilities",
        title: "Describe Asympta World capabilities",
        description: "Describe the WebMCP tool surface, workflows, agents, communication bridge, simulation disclosure and human-approval safety boundary.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: readOnly,
        execute: async () => {
          syncVisibleWorkflowMessages();
          const foreground = readForegroundSnapshot();
          return JSON.stringify({
            ok: true,
            manifest: ASYMPTA_WEBMCP_MANIFEST,
            communicationState: {
              revision: getBrowserAgentMessageState().revision,
              messageCount: getBrowserAgentMessageState().messages.length,
            },
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
          syncVisibleWorkflowMessages();
          const foreground = readForegroundSnapshot();
          if (!foreground) return JSON.stringify({ ok: false, error: "Living world state is not mounted." });
          const agent = recordArray(foreground.agents).find((item) => item.id === agentId);
          if (!agent) return JSON.stringify({ ok: false, error: "Agent is not present in the foreground world." });
          const tasks = recordArray(foreground.tasks)
            .filter((item) => item.agentId === agentId)
            .map(withoutSyntheticCoordinates);
          const messages = listBrowserStructuredMessages({ participantId: agentId, limit: 20 });
          return JSON.stringify({ ok: true, agent: withoutSyntheticCoordinates(agent), tasks, messages });
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
      {
        name: "asympta_send_agent_message",
        title: "Send a message into Asympta World",
        description: "Send a human-readable message with optional machine-readable semantics. Only body is required; ordinary people do not need agent IDs, schemas or workflow knowledge. The default route is human → personal intent agent.",
        inputSchema: {
          type: "object",
          properties: {
            body: { type: "string", minLength: 1, maxLength: 800, description: "Plain-language message such as 'I need dinner around 7pm'." },
            fromId: { type: "string", minLength: 1, maxLength: 100, description: "Optional participant ID. Defaults to human." },
            toId: { type: "string", minLength: 1, maxLength: 100, description: "Optional recipient. Defaults to agent-user, the personal intent agent." },
            fromKind: { type: "string", enum: participantKinds },
            toKind: { type: "string", enum: participantKinds },
            kind: { type: "string", enum: messageKinds },
            subject: { type: "string", maxLength: 180 },
            threadId: { type: "string", maxLength: 180 },
            replyToId: { type: "string", maxLength: 180 },
            intent: { type: "string", maxLength: 120 },
            action: { type: "string", maxLength: 120 },
            entities: { type: "array", items: { type: "string", maxLength: 120 }, maxItems: 16 },
            data: { type: "object", additionalProperties: true },
          },
          required: ["body"],
          additionalProperties: false,
        },
        annotations: mutating,
        execute: async (input) => {
          const body = String(input.body ?? "").trim();
          if (!body) return JSON.stringify({ ok: false, error: "Message body is required." });
          syncVisibleWorkflowMessages();
          const foreground = readForegroundSnapshot();
          try {
            const message = submitBrowserStructuredMessage({
              body,
              fromId: typeof input.fromId === "string" ? input.fromId : undefined,
              toId: typeof input.toId === "string" ? input.toId : undefined,
              fromKind: participantKinds.includes(input.fromKind as MessageParticipantKind) ? input.fromKind as MessageParticipantKind : undefined,
              toKind: participantKinds.includes(input.toKind as MessageParticipantKind) ? input.toKind as MessageParticipantKind : undefined,
              kind: messageKinds.includes(input.kind as StructuredMessageKind) ? input.kind as StructuredMessageKind : undefined,
              subject: typeof input.subject === "string" ? input.subject : undefined,
              threadId: typeof input.threadId === "string" ? input.threadId : undefined,
              replyToId: typeof input.replyToId === "string" ? input.replyToId : undefined,
              source: "webmcp",
              intent: typeof input.intent === "string" ? input.intent : undefined,
              action: typeof input.action === "string" ? input.action : undefined,
              entities: Array.isArray(input.entities) ? input.entities.map(String) : undefined,
              data: input.data && typeof input.data === "object" && !Array.isArray(input.data) ? input.data as Record<string, unknown> : undefined,
            }, messageWorldContext(foreground));
            return JSON.stringify({
              ok: true,
              message,
              lowestBarrierRoute: message.from.kind === "human" && message.to.id === "agent-user",
              note: "Message is persisted in Asympta's structured communication state. Sending a message does not bypass approval for consequential world actions.",
            });
          } catch (error) {
            return JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) });
          }
        },
      },
      {
        name: "asympta_list_agent_messages",
        title: "List structured Asympta messages",
        description: "Read the persistent structured communication state. Filter by participant or thread; each record keeps a human-readable body and optional machine-readable semantics.",
        inputSchema: {
          type: "object",
          properties: {
            participantId: { type: "string", maxLength: 100 },
            threadId: { type: "string", maxLength: 180 },
            limit: { type: "integer", minimum: 1, maximum: 100 },
          },
          additionalProperties: false,
        },
        annotations: readOnly,
        execute: async (input) => {
          syncVisibleWorkflowMessages();
          const messages = listBrowserStructuredMessages({
            participantId: typeof input.participantId === "string" ? input.participantId : undefined,
            threadId: typeof input.threadId === "string" ? input.threadId : undefined,
            limit: typeof input.limit === "number" ? input.limit : 30,
          });
          const state = getBrowserAgentMessageState();
          return JSON.stringify({ ok: true, revision: state.revision, messages });
        },
      },
    ];

    const syncTimer = window.setInterval(syncVisibleWorkflowMessages, 700);
    syncVisibleWorkflowMessages();

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
    return () => {
      window.clearInterval(syncTimer);
      controller.abort();
    };
  }, []);

  return null;
}
