import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceWorld,
  applyWorldCommand,
  catchUpTicks,
  causalChain,
  seedWorld,
  validateWorld,
} from "../lib/world-engine.ts";

function advanceOneByOne(world, count, start = 10_000) {
  let current = world;
  for (let index = 1; index <= count; index += 1) {
    current = advanceWorld(current, 1, start + index * 1_000);
  }
  return current;
}

test("A: the world acts spontaneously without a human command", () => {
  const initial = seedWorld(1_000);
  assert.equal(initial.agents.length, 12);
  assert.equal(initial.businesses.length, 4);
  assert.equal(initial.processedCommands.length, 0);

  const world = advanceOneByOne(initial, 7);
  const types = new Set(world.events.map((event) => event.type));
  for (const type of [
    "need_discovered",
    "offer_created",
    "offer_accepted",
    "contract_started",
    "contract_completed",
  ]) {
    assert.equal(types.has(type), true, "missing autonomous event " + type);
  }
  assert.equal(world.contracts[0].status, "completed");
  assert.equal(validateWorld(world).length, 0);
});

test("B: a human need enters the same world and receives an agent response", () => {
  const command = {
    idempotencyKey: "human-need-test-001",
    type: "post_need",
    origin: "human",
    participantId: "human-visitor",
    title: "A calm logo for my bakery",
    description: "Create a simple visual identity and logo.",
    budget: 50,
    requiredSkills: ["visual-design", "branding"],
  };
  const once = applyWorldCommand(seedWorld(1_000), command, 2_000);
  const twice = applyWorldCommand(once, command, 2_100);
  assert.equal(twice.needs.length, once.needs.length, "command must be idempotent");

  const need = once.needs.find((candidate) => candidate.origin === "human");
  assert.ok(need);
  const world = advanceOneByOne(once, 9);
  const updated = world.needs.find((candidate) => candidate.id === need.id);
  assert.ok(updated);
  assert.notEqual(updated.stage, "new");
  assert.ok(world.offers.some((offer) => offer.needId === need.id));
  assert.ok(causalChain(world, need.id).some((event) => event.type === "need_posted"));
});

test("C: a skill gap causes an invitation, collaboration, and stronger relationship", () => {
  let world = applyWorldCommand(
    seedWorld(1_000),
    {
      idempotencyKey: "human-collab-test-001",
      type: "post_need",
      origin: "human",
      participantId: "human-visitor",
      title: "Logo plus homepage copy",
      description: "I need visual design and persuasive writing together.",
      budget: 90,
      requiredSkills: ["visual-design", "copywriting"],
    },
    2_000,
  );
  const needId = world.needs.at(-1).id;
  world = advanceOneByOne(world, 9);
  const need = world.needs.find((candidate) => candidate.id === needId);
  assert.ok(need.collaboratorIds.length > 0);
  assert.ok(world.events.some((event) => event.type === "collaboration_invited"));
  assert.ok(world.events.some((event) => event.type === "collaboration_accepted"));

  const offer = world.offers.find(
    (candidate) => candidate.needId === needId && candidate.status === "pending",
  );
  world = applyWorldCommand(
    world,
    {
      idempotencyKey: "human-accept-test-001",
      type: "accept_offer",
      origin: "human",
      participantId: "human-visitor",
      offerId: offer.id,
    },
    30_000,
  );
  world = advanceOneByOne(world, 2, 30_000);
  const lead = world.agents.find((agent) => agent.id === need.assignedLeadId);
  const relationship = lead.relationships.find(
    (candidate) => candidate.agentId === need.collaboratorIds[0],
  );
  assert.ok(relationship.strength >= 16);
  assert.equal(relationship.successfulContracts, 1);
  assert.ok(world.events.some((event) => event.type === "relationship_changed"));
});

test("D/E: contract settlement conserves credits and reputation follows outcome", () => {
  const initial = seedWorld(1_000);
  const startingReserve = initial.reserveBalance;
  const startingReputation = new Map(
    initial.agents.map((agent) => [agent.id, agent.reputation]),
  );
  const world = advanceOneByOne(initial, 7);
  const contract = world.contracts[0];
  const payments = world.transactions.filter(
    (transaction) => transaction.contractId === contract.id,
  );
  assert.equal(
    payments.reduce((sum, transaction) => sum + transaction.amount, 0),
    contract.value,
  );
  assert.equal(world.reserveBalance, startingReserve - contract.value);
  const lead = world.agents.find((agent) => agent.id === contract.leadAgentId);
  assert.equal(lead.reputation, startingReputation.get(lead.id) + 2);

  const settledCount = payments.length;
  const later = advanceOneByOne(world, 3, 40_000);
  assert.equal(
    later.transactions.filter((transaction) => transaction.contractId === contract.id).length,
    settledCount,
    "completed contracts must never pay twice",
  );
  assert.equal(validateWorld(later).length, 0);
});

test("F: repeated demand can causally create a new agent business", () => {
  let world = seedWorld(1_000);
  for (let index = 0; index < 6; index += 1) {
    world = applyWorldCommand(
      world,
      {
        idempotencyKey: "business-demand-" + String(index),
        type: "post_need",
        origin: "human",
        participantId: "human-" + String(index),
        title: "Responsive frontend demand " + String(index),
        description: "Build a reliable frontend website.",
        budget: 100,
        requiredSkills: ["frontend"],
      },
      2_000 + index,
    );
  }
  for (let round = 0; round < 4 && world.businesses.length === 4; round += 1) {
    world = advanceWorld(world, 8, 20_000 + round * 10_000);
  }
  assert.equal(world.businesses.length, 5);
  const formation = world.events.find((event) => event.type === "business_created");
  assert.equal(formation.origin, "native-agent");
  assert.ok(formation.parentEventIds.length > 0);
  assert.match(formation.summary, /demand crossed an opportunity threshold/);
});

test("G: elapsed-time catch-up is bounded and preserves valid persistent state", () => {
  const active = advanceWorld(seedWorld(1_000), 1, 9_000);
  assert.equal(catchUpTicks(active, 9_000), 0);
  assert.equal(catchUpTicks(active, 17_000), 1);
  assert.equal(catchUpTicks(active, 9_000 + 8000 * 100), 6);
  const caughtUp = advanceWorld(active, catchUpTicks(active, 100_000), 100_000);
  assert.equal(caughtUp.lastProcessedAt, 100_000);
  assert.equal(validateWorld(caughtUp).length, 0);
});

test("H: an external WebMCP offer uses the canonical contract and ledger rules", () => {
  let world = applyWorldCommand(
    seedWorld(1_000),
    {
      idempotencyKey: "external-need-test-001",
      type: "post_need",
      origin: "human",
      participantId: "human-visitor",
      title: "Automate a weekly note",
      description: "Create a tiny automation and concise copy.",
      budget: 40,
      requiredSkills: ["automation", "copywriting"],
    },
    2_000,
  );
  const need = world.needs.at(-1);
  world = applyWorldCommand(
    world,
    {
      idempotencyKey: "external-offer-test-001",
      type: "create_offer",
      origin: "webmcp-agent",
      agentId: "relay",
      needId: need.id,
      price: 11,
      message: "Relay can coordinate this through the external tool boundary.",
      collaboratorIds: ["sage", "pixel", "pixel", "relay"],
    },
    3_000,
  );
  const offer = world.offers.find((candidate) => candidate.needId === need.id);
  assert.equal(offer.origin, "webmcp-agent");
  assert.deepEqual(offer.collaboratorIds, ["sage", "pixel"]);
  world = applyWorldCommand(
    world,
    {
      idempotencyKey: "external-accept-test-001",
      type: "accept_offer",
      origin: "webmcp-agent",
      participantId: "relay",
      offerId: offer.id,
    },
    4_000,
  );
  world = advanceOneByOne(world, 2, 4_000);
  const contract = world.contracts.find((candidate) => candidate.offerId === offer.id);
  const total = world.transactions
    .filter((transaction) => transaction.contractId === contract.id)
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  assert.equal(total, 11);
  assert.ok(
    causalChain(world, need.id).some(
      (event) => event.type === "offer_created" && event.origin === "webmcp-agent",
    ),
  );
  assert.equal(validateWorld(world).length, 0);
});
