import test from "node:test";
import assert from "node:assert/strict";
import { createInitialWorld } from "../src/engine/catalog.js";
import { applyAction, beginTask } from "../src/engine/reducer.js";
import { validateAction, validatePlan, validateWorldInvariants, verifyTransition } from "../src/engine/validation.js";

function commit(world, action) {
  const pre = validateAction(action, world);
  assert.equal(pre.ok, true, `precondition failed: ${pre.errors.join("; ")}`);
  const candidate = applyAction(world, action);
  const post = verifyTransition(action, world, candidate.state, candidate.event);
  assert.equal(post.ok, true, `postcondition failed: ${JSON.stringify(post.evidence)}`);
  const invariants = validateWorldInvariants(candidate.state);
  assert.equal(invariants.ok, true, invariants.errors.join("; "));
  assert.equal(candidate.state.revision, world.revision + 1);
  return candidate.state;
}

test("initial world satisfies global invariants", () => {
  const world = createInitialWorld();
  const result = validateWorldInvariants(world);
  assert.equal(result.ok, true);
  assert.equal(world.revision, 0);
  assert.ok(world.entities.home);
  assert.ok(world.agents["personal-agent"]);
});

test("candidate transitions do not mutate the previous state", () => {
  const world = createInitialWorld();
  const before = JSON.stringify(world);
  const action = {
    type: "send_message",
    params: {
      fromAgentId: "personal-agent",
      toEntityId: "market",
      intent: "Check whether food is available",
    },
  };
  const candidate = applyAction(world, action);
  assert.equal(JSON.stringify(world), before);
  assert.equal(candidate.state.messages.length, 1);
  assert.equal(world.messages.length, 0);
});

test("a simulated order completes only through validated lifecycle states", () => {
  let world = beginTask(createInitialWorld(), "Please buy some food and deliver it home", "task-food").state;
  const actions = [
    {
      type: "inspect_entity",
      params: { entityId: "market" },
    },
    {
      type: "send_message",
      params: {
        fromAgentId: "personal-agent",
        toEntityId: "market",
        intent: "Check food availability",
      },
    },
    {
      type: "request_quote",
      params: {
        buyerAgentId: "personal-agent",
        sellerEntityId: "market",
        item: "food",
        quantity: 1,
        currency: "HKD",
      },
    },
    {
      type: "reserve_resource",
      params: {
        ownerEntityId: "market",
        item: "food",
        quantity: 1,
        reservationRef: "reserve-food",
      },
    },
    {
      type: "create_order",
      params: {
        orderRef: "order-food",
        buyerAgentId: "personal-agent",
        sellerEntityId: "market",
        item: "food",
        quantity: 1,
        destinationEntityId: "home",
      },
    },
    {
      type: "prepare_order",
      params: { orderRef: "order-food", byEntityId: "market" },
    },
    {
      type: "handoff_order",
      params: { orderRef: "order-food", courierAgentId: "courier-agent" },
    },
    {
      type: "deliver_order",
      params: { orderRef: "order-food", destinationEntityId: "home" },
    },
    {
      type: "verify_condition",
      params: { subjectRef: "order-food", condition: "order_delivered" },
    },
    {
      type: "complete_task",
      params: { summary: "Food delivery was simulated and verified." },
    },
  ];

  for (const action of actions) world = commit(world, action);

  assert.equal(world.orders["order-food"].status, "delivered");
  assert.equal(world.tasks["task-food"].status, "completed");
  assert.equal(world.activeTaskId, null);
  assert.equal(world.evidence.at(-1).passed, true);
  assert.equal(world.revision, actions.length);
});

test("delivery is rejected before courier handoff", () => {
  let world = beginTask(createInitialWorld(), "Deliver food", "task-reject").state;
  world = commit(world, {
    type: "create_order",
    params: {
      orderRef: "order-reject",
      buyerAgentId: "personal-agent",
      sellerEntityId: "market",
      item: "food",
      quantity: 1,
      destinationEntityId: "home",
    },
  });
  const validation = validateAction(
    {
      type: "deliver_order",
      params: { orderRef: "order-reject", destinationEntityId: "home" },
    },
    world,
  );
  assert.equal(validation.ok, false);
  assert.match(validation.errors.join(" "), /in transit/i);
});

test("unknown model actions and malformed plans fail schema validation", () => {
  const result = validatePlan({
    objective: "Do something unsafe",
    steps: [
      {
        id: "bad-step",
        title: "Bypass runtime",
        action: { type: "execute_shell", params: { command: "rm -rf /" } },
      },
    ],
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /unsupported action/i);
});

test("new service entities must be discovered before they can be contacted", () => {
  let world = beginTask(createInitialWorld(), "Find a translation service", "task-discovery").state;
  const premature = validateAction(
    {
      type: "send_message",
      params: {
        fromAgentId: "personal-agent",
        toEntityId: "translation-service",
        intent: "Translate a document",
      },
    },
    world,
  );
  assert.equal(premature.ok, false);

  world = commit(world, {
    type: "discover_entity",
    params: {
      entityRef: "translation-service",
      name: "Translation Service",
      entityType: "service",
      capability: "translation",
    },
  });

  const afterDiscovery = validateAction(
    {
      type: "send_message",
      params: {
        fromAgentId: "personal-agent",
        toEntityId: "translation-service",
        intent: "Translate a document",
      },
    },
    world,
  );
  assert.equal(afterDiscovery.ok, true);
});
