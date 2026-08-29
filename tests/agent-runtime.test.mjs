import assert from "node:assert/strict";
import test from "node:test";

import { createAtlasDemoWorld, startAtlasDemoWorkflow } from "../lib/atlas-demo.ts";
import { ATLAS_AGENTS, createAtlasWorld } from "../lib/atlas-simulation.ts";
import {
  AGENT_PROFILES,
  buildAgentContext,
  createAgentRuntime,
  createAiAgentProvider,
  decisionSchemaForContext,
} from "../lib/agent-runtime/index.ts";

test("every visible atlas agent has an AI-ready profile", () => {
  for (const agent of ATLAS_AGENTS) {
    const profile = AGENT_PROFILES[agent.id];
    assert.ok(profile, `missing profile for ${agent.id}`);
    assert.equal(profile.role, agent.role);
    assert.ok(profile.goals.length >= 2);
    assert.ok(profile.instructions.length >= 2);
  }
});

test("agent context is bounded and does not expose map coordinates", () => {
  const world = createAtlasDemoWorld(1_000);
  const context = buildAgentContext(world, "agent-supplier");
  const serialized = JSON.stringify(context);
  assert.equal(context.version, 1);
  assert.equal(context.simulationMode, true);
  assert.ok(context.recentMessages.length <= AGENT_PROFILES["agent-supplier"].context.maxMessages);
  assert.doesNotMatch(serialized, /"position"|"target"|"lon"|"lat"/);
});

test("demo defaults to a deterministic provider and requires no AI API", async () => {
  const runtime = createAgentRuntime();
  const result = await runtime.runTurn(createAtlasDemoWorld(2_000), "agent-business");
  assert.equal(runtime.mode, "deterministic");
  assert.equal(result.providerKind, "deterministic");
  assert.equal(result.fallbackUsed, false);
  assert.equal(result.decision.action, "wait");
});

test("a future AI provider can be injected without changing the engine", async () => {
  let observedRequest = null;
  const provider = createAiAgentProvider({
    id: "test-ai",
    model: "future-model",
    infer: async (request) => {
      observedRequest = request;
      return {
        action: "send_message",
        targetAgentId: "agent-business",
        message: "Supplier capacity needs confirmation before commitment.",
      };
    },
  });
  const runtime = createAgentRuntime({ provider });
  const result = await runtime.runTurn(createAtlasDemoWorld(3_000), "agent-supplier");
  assert.equal(result.providerId, "test-ai");
  assert.equal(result.providerKind, "ai");
  assert.equal(result.providerModel, "future-model");
  assert.equal(result.fallbackUsed, false);
  assert.equal(result.decision.action, "send_message");
  assert.ok(observedRequest.responseSchema);
  assert.ok(observedRequest.systemInstructions.some((instruction) => instruction.includes("human approval")));
});

test("invalid or overpowered AI output degrades to a safe deterministic wait", async () => {
  const provider = createAiAgentProvider({
    infer: async () => ({ action: "approve_payment", approved: true }),
  });
  const result = await createAgentRuntime({ provider }).runTurn(createAtlasDemoWorld(4_000), "agent-finance");
  assert.equal(result.fallbackUsed, true);
  assert.equal(result.decision.action, "wait");
  assert.match(result.validationError, /not allowed/i);
});

test("decision schema exposes only the current agent capability boundary", () => {
  const world = startAtlasDemoWorkflow(createAtlasWorld(5_000), "custom-order");
  const supplierSchema = JSON.stringify(decisionSchemaForContext(buildAgentContext(world, "agent-supplier")));
  const marketSchema = JSON.stringify(decisionSchemaForContext(buildAgentContext(world, "agent-market")));
  assert.match(supplierSchema, /reserve_capacity/);
  assert.doesNotMatch(marketSchema, /reserve_capacity/);
  assert.doesNotMatch(supplierSchema, /approve|decline|mutate_world/);
});
