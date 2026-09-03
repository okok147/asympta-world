import assert from "node:assert/strict";
import test from "node:test";

import { createAtlasDemoWorld, startAtlasDemoWorkflow } from "../lib/atlas-demo.ts";
import {
  ATLAS_AGENTS,
  advanceAtlasWorld,
  createAtlasWorld,
  requestWebMcpAction,
  startAtlasWorkflow,
} from "../lib/atlas-simulation.ts";
import {
  AGENT_PROFILES,
  buildAgentContext,
  createAgentEventCursor,
  createAgentRuntime,
  createAiAgentProvider,
  decisionSchemaForContext,
  subscribedEventsForAgent,
} from "../lib/agent-runtime/index.ts";

test("every visible atlas agent has an AI-ready event subscription profile", () => {
  for (const agent of ATLAS_AGENTS) {
    const profile = AGENT_PROFILES[agent.id];
    assert.ok(profile, `missing profile for ${agent.id}`);
    assert.equal(profile.role, agent.role);
    assert.ok(profile.goals.length >= 2);
    assert.ok(profile.instructions.length >= 2);
    assert.ok(profile.subscriptions.kinds.includes("task"));
    assert.ok(profile.subscriptions.kinds.includes("message"));
  }
});

test("agent context is bounded, event-triggered and does not expose map coordinates", () => {
  const world = createAtlasDemoWorld(1_000);
  const context = buildAgentContext(world, "agent-supplier");
  const serialized = JSON.stringify(context);
  assert.equal(context.version, 1);
  assert.equal(context.simulationMode, true);
  assert.deepEqual(context.triggerEvents, []);
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

test("subscriptions route dependency completion only to agents whose next work is related", () => {
  let world = startAtlasWorkflow(createAtlasWorld(6_000), "custom-order");
  const cursor = createAgentEventCursor();

  assert.ok(subscribedEventsForAgent(world, "agent-user", cursor).length > 0);
  assert.equal(subscribedEventsForAgent(world, "agent-supplier", cursor).length, 0);

  for (let index = 0; index < 24; index += 1) world = advanceAtlasWorld(world, 140);

  const supplierEvents = subscribedEventsForAgent(world, "agent-supplier", cursor);
  const financeEvents = subscribedEventsForAgent(world, "agent-finance", cursor);
  assert.ok(supplierEvents.some((event) => event.targetAgentIds.includes("agent-supplier")));
  assert.ok(supplierEvents.some((event) => event.taskId === "co-intent" || event.taskId === "co-supply"));
  assert.equal(financeEvents.length, 0);
});

test("event dispatch is idempotent for the same per-agent cursor", async () => {
  const provider = createAiAgentProvider({
    id: "event-test-ai",
    infer: async () => ({ action: "wait", reason: "Observed committed event." }),
  });
  const runtime = createAgentRuntime({ provider });
  const world = startAtlasWorkflow(createAtlasWorld(7_000), "custom-order");

  const first = await runtime.dispatchEvents(world, createAgentEventCursor());
  assert.equal(first.deliveries.length, 1);
  assert.equal(first.deliveries[0].agentId, "agent-user");
  assert.ok(first.deliveries[0].turn.context.triggerEvents.length > 0);

  const duplicate = await runtime.dispatchEvents(world, first.cursor);
  assert.equal(duplicate.deliveries.length, 0);
});

test("committed proposal events cascade to the next subscribed agent turn", async () => {
  let world = startAtlasWorkflow(createAtlasWorld(8_000), "custom-order");
  for (let index = 0; index < 24; index += 1) world = advanceAtlasWorld(world, 140);

  const provider = createAiAgentProvider({
    id: "cascade-test-ai",
    infer: async ({ context }) => {
      if (context.agent.id === "agent-supplier" && context.triggerEvents.some((event) => event.kind === "approval")) {
        return { action: "wait", reason: "Human approval is now pending." };
      }
      if (context.agent.id === "agent-supplier" && context.triggerEvents.some((event) => event.kind === "task")) {
        return {
          action: "request_tool",
          tool: "reserve_capacity",
          arguments: {},
          reason: "Supplier-side dependency event requires a bounded reservation request.",
        };
      }
      return { action: "wait", reason: "No subscribed action is required." };
    },
  });
  const runtime = createAgentRuntime({ provider });
  const result = await runtime.runEventDrivenCycle(world, {
    maxRounds: 4,
    commit: ({ world: current, delivery }) => {
      const decision = delivery.turn.decision;
      if (decision.action !== "request_tool") return current;
      return requestWebMcpAction(current, decision.tool, delivery.agentId, decision.reason);
    },
  });

  assert.ok(result.rounds >= 2);
  assert.ok(result.world.approvals.some((approval) => approval.status === "pending" && approval.actionType === "reserve_capacity"));
  assert.ok(result.deliveries.some((delivery) =>
    delivery.agentId === "agent-supplier"
    && delivery.turn.context.triggerEvents.some((event) => event.kind === "approval"),
  ));
});
