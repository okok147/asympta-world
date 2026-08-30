"use client";

import { useEffect } from "react";

import {
  MODEL,
  compatibilitySnapshot,
  type IntentBridge,
  type LegacyDemoBridge,
  type ModelContext,
  type ModelContextTool,
} from "@/components/asympta-intent-world-support";
import {
  advanceIntentWorld,
  intentWorldSnapshot,
  renderIntentWorldToText,
} from "@/lib/intent-world/engine";
import type { IntentWorldSnapshot, IntentWorldState } from "@/lib/intent-world/types";

type CurrentRef<T> = { current: T };

type IntentWorldBridgeOptions = {
  worldRef: CurrentRef<IntentWorldState>;
  submitIntentRef: CurrentRef<(body: string) => Promise<IntentWorldSnapshot>>;
  resolveApproval: (approvalId: string, approved: boolean) => IntentWorldSnapshot;
  setWorldImmediate: (world: IntentWorldState) => IntentWorldState;
};

export function useIntentWorldBridge({
  worldRef,
  submitIntentRef,
  resolveApproval,
  setWorldImmediate,
}: IntentWorldBridgeOptions) {
  useEffect(() => {
    const intentWindow = window as unknown as {
      __ASYMPTA_INTENT_WORLD__?: IntentBridge;
      __ASYMPTA_DEMO__?: LegacyDemoBridge;
      render_game_to_text?: () => string;
    };
    const bridge: IntentBridge = {
      snapshot: () => intentWorldSnapshot(worldRef.current),
      renderToText: () => renderIntentWorldToText(worldRef.current),
      submitIntent: (body) => submitIntentRef.current(body),
      approve: resolveApproval,
    };
    intentWindow.__ASYMPTA_INTENT_WORLD__ = bridge;
    intentWindow.__ASYMPTA_DEMO__ = {
      snapshot: () => compatibilitySnapshot(worldRef.current),
      advance: (milliseconds) => {
        const next = setWorldImmediate(advanceIntentWorld(worldRef.current, Math.max(0, Math.min(10_000, milliseconds))));
        return compatibilitySnapshot(next);
      },
      approve: (approvalId, approved) => resolveApproval(approvalId, approved),
    };
    intentWindow.render_game_to_text = bridge.renderToText;
    return () => {
      delete intentWindow.__ASYMPTA_INTENT_WORLD__;
      delete intentWindow.__ASYMPTA_DEMO__;
      delete intentWindow.render_game_to_text;
    };
  }, [resolveApproval, setWorldImmediate, submitIntentRef, worldRef]);

  useEffect(() => {
    const root = document.documentElement;
    const modelContext = (document as Document & { modelContext?: ModelContext }).modelContext;
    if (!modelContext) {
      root.dataset.webmcpQualification = "unavailable";
      return undefined;
    }

    const controller = new AbortController();
    const readOnly = { readOnlyHint: true, untrustedContentHint: false };
    const mutating = { readOnlyHint: false, untrustedContentHint: true };
    const tools: ModelContextTool[] = [
      {
        name: "asympta_describe_capabilities",
        title: "Describe Asympta intention world",
        description: "Describe the intention-first planning, deterministic execution, validation, simulation disclosure, and human-approval boundary.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: readOnly,
        execute: async () => JSON.stringify({
          ok: true,
          mode: "intention-first",
          planner: { provider: "OpenRouter", model: MODEL, freeOnly: true },
          execution: "deterministic validated state machine",
          approvalBoundary: "Consequential actions require direct human approval and cannot be approved by WebMCP.",
          simulation: true,
        }),
      },
      {
        name: "asympta_observe_world",
        title: "Observe Asympta World",
        description: "Read the current intention, plan, agents, task states, validation results, approvals, messages, and audit events without exposing secrets.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: readOnly,
        execute: async () => JSON.stringify({ ok: true, world: intentWorldSnapshot(worldRef.current) }),
      },
      {
        name: "asympta_render_world_to_text",
        title: "Render Asympta World to text",
        description: "Return an accessible textual rendering of the same canonical world state shown visually.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: readOnly,
        execute: async () => renderIntentWorldToText(worldRef.current),
      },
      {
        name: "asympta_submit_intent",
        title: "Submit a natural-language intention",
        description: "Submit what the user wants done. This may create clarification questions or a validated simulated task graph. It never grants consequential approval.",
        inputSchema: {
          type: "object",
          properties: { body: { type: "string", minLength: 3, maxLength: 800 } },
          required: ["body"],
          additionalProperties: false,
        },
        annotations: mutating,
        execute: async (input) => {
          const body = typeof input.body === "string" ? input.body.trim() : "";
          if (body.length < 3) return JSON.stringify({ ok: false, error: "A natural-language intention is required." });
          const snapshot = await submitIntentRef.current(body);
          return JSON.stringify({ ok: true, world: snapshot, note: "Consequential approvals remain human-only." });
        },
      },
      {
        name: "asympta_get_pending_approval",
        title: "Get pending human approval",
        description: "Read the current pending approval. This tool cannot approve or decline it.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: readOnly,
        execute: async () => JSON.stringify({
          ok: true,
          pendingApproval: intentWorldSnapshot(worldRef.current).pendingApprovals[0] ?? null,
        }),
      },
    ];

    try {
      for (const tool of tools) modelContext.registerTool(tool, { signal: controller.signal });
      root.dataset.webmcpQualification = "ready";
    } catch {
      root.dataset.webmcpQualification = "failed";
    }
    return () => controller.abort();
  }, [submitIntentRef, worldRef]);
}
