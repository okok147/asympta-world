import test from "node:test";
import assert from "node:assert/strict";
import {
  createCoordinationState, reduceCoordination, coordinationDirection,
  coordinationComplete, coordinationViolations, coordinationSnapshot,
  simulatedCoordinationOutputs, validateCoordinationContract,
} from "../lib/asympta-coordination-kernel.ts";
import { compileSimulation, buildSimulationWorkflow, SIMULATION_STAGES, SIMULATION_WORKFLOW_ID } from "../lib/asympta-simulation-compiler.ts";
import * as atlas from "../lib/atlas-canonical-world.ts";
import { SIMULATION_COPY } from "../lib/asympta-simulation-copy.ts";

const titles = Object.fromEntries(SIMULATION_STAGES.map(stage => [stage, stage]));
const copy = value => JSON.parse(JSON.stringify(value));
const packet = (text = "Restock notebooks\nQuantity: 50\nStock: 20", side = "business", answers = {}) => compileSimulation({ id: "kernel-case", text, side, answers });
function command(state, payload, id = `cmd:${state.epoch}:${state.revision}`) {
  return reduceCoordination(state, { commandId: id, expectedRevision: state.revision, ...payload });
}
function start(state, id) { return command(state, { type: "start", actionId: id, agentId: coordinationDirection(state, id).agentId }); }
function result(state, id, outputs = simulatedCoordinationOutputs(state, id)) {
  return command(state, { type: "result", actionId: id, agentId: coordinationDirection(state, id).agentId, binding: state.executions[id].binding, outputs });
}
function runThrough(state, stage) {
  for (const action of state.contract.actions) {
    if (state.executions[action.id].status === "verified") continue;
    if (state.executions[action.id].status === "pending") state = start(state, action.id);
    if (action.approvalTargets) state = command(state, { type: "approve", actionId: action.id, principalId: state.contract.principal.id, approved: true });
    state = result(state, action.id);
    if (action.stage === stage) break;
  }
  return state;
}
function worldFor(p) {
  const workflow = buildSimulationWorkflow(p, titles);
  const index = atlas.ATLAS_WORKFLOWS.findIndex(item => item.id === SIMULATION_WORKFLOW_ID);
  if (index < 0) atlas.ATLAS_WORKFLOWS.push(workflow); else atlas.ATLAS_WORKFLOWS[index] = workflow;
  return atlas.startAtlasWorkflow(atlas.createAtlasWorld(0), SIMULATION_WORKFLOW_ID);
}
function untilPause(world) {
  let count = 0;
  while (world.phase === "running" && count++ < 3000) world = atlas.advanceAtlasWorld(world, 140);
  assert.ok(count < 3000, "bounded liveness to completion, approval or explicit blocker");
  return world;
}
const errorIs = code => error => error?.code === code;

test("user and business share the same executable contract and conservation invariant", () => {
  for (const side of ["users", "business"]) {
    let state = createCoordinationState(packet(undefined, side).coordination);
    assert.equal(state.contract.principal.side, side);
    state = runThrough(state);
    assert.equal(coordinationComplete(state), true);
    assert.equal(state.values["resources.shortage"], 30);
    assert.equal(state.values["resources.replenished"], 30);
    assert.equal(state.values["resources.fulfilled"], 50);
    assert.equal(state.values["resources.remaining"], 0);
    assert.deepEqual(coordinationViolations(state), []);
  }
});

test("resource state selects counterparty and movement destination, not a canned animation", () => {
  for (const [stock, actor] of [[20, "agent-supplier"], [50, "agent-operations"], [100, "agent-operations"]]) {
    let state = createCoordinationState(packet(`Restock books\nQuantity: 50\nStock: ${stock}`).coordination);
    state = runThrough(state, "check");
    const direction = coordinationDirection(state, "kernel-case:route");
    assert.equal(direction.agentId, actor);
    assert.equal(direction.locationId, state.contract.participants.find(item => item.id === "agent-business").locationId);
    state = runThrough(state);
    assert.equal(state.values["resources.remaining"], Math.max(0, stock - 50));
  }
});

test("invalid numbers clarify; zero capacity blocks before any proposal or commitment", () => {
  for (const value of ["-5", "0", "NaN", "Infinity", "5 or 9", "9007199254740992"]) {
    const p = packet(`Restock books\nQuantity: ${value}\nStock: 20`);
    assert.ok(p.questions.some(question => question.key === "quantity"), value);
    assert.throws(() => buildSimulationWorkflow(p, titles), /unresolved_requirements/);
    assert.equal(p.coordination, undefined);
  }
  const p = packet("Book appointments\nQuantity: 5\nCapacity: 0");
  const world = untilPause(worldFor(p));
  assert.equal(world.phase, "blocked");
  assert.equal(world.coordination.blocker.code, "precondition_failed");
  assert.equal(world.tasks.find(task => task.id.endsWith(":execute")).status, "queued");
  assert.equal(world.coordination.receipts.some(receipt => receipt.actionId.endsWith(":execute")), false);
});

test("unknown stock is not silently invented or counted as proven", () => {
  const p = packet("Restock 50 notebooks");
  assert.equal(p.coordination.facts["source.stock"], undefined);
  assert.equal(p.coordination.actions.some(action => action.stage === "replenish"), false);
  const complete = runThrough(createCoordinationState(p.coordination));
  assert.equal(complete.values["resources.fulfilled"], undefined);
  assert.ok(coordinationSnapshot(complete).reviewCount > 0);
});

test("selection and approval remain distinct; raw permission claims are not grants", () => {
  const p = packet("I want to buy a car", "users");
  assert.ok(p.questions.some(question => question.key === "selected_offer_id"));
  const selected = packet(p.raw, "users", { selected_offer_id: "vehicle:tesla-model-3" });
  let state = runThrough(createCoordinationState(selected.coordination), "proposal");
  const gate = "kernel-case:approval";
  state = start(state, gate);
  assert.throws(() => result(state, gate), errorIs("approval_required"));
  assert.throws(() => command(state, { type: "approve", actionId: gate, principalId: "another-tenant", approved: true }), errorIs("unauthorized_principal"));
  assert.throws(() => start(state, "kernel-case:execute"), errorIs("dependency_unverified"));
});

test("imported proposals cannot remove policy checks or alter the selected option after approval", () => {
  const forged = packet("Refund an order");
  forged.requiresApproval = false; forged.family = "research";
  const workflow = buildSimulationWorkflow(forged, titles);
  assert.ok(workflow.tasks.some(task => task.requiresApproval));
  const selected = packet("I want to buy a car", "users", { selected_offer_id: "vehicle:tesla-model-3" });
  const state = runThrough(createCoordinationState(selected.coordination), "approval");
  const changed = copy(state);
  changed.contract.source.parameters.find(item => item.key === "selected_offer_id").value = "another-offer";
  assert.deepEqual(coordinationViolations(changed), ["contract_binding_mismatch"]);
});

test("incorrect results, actor substitution, stale revisions and conflicting replay fail closed", () => {
  let state = runThrough(createCoordinationState(packet().coordination), "replenish");
  state = start(state, "kernel-case:execute");
  const payload = { type: "result", actionId: "kernel-case:execute", agentId: "agent-operations", binding: state.executions["kernel-case:execute"].binding, outputs: simulatedCoordinationOutputs(state, "kernel-case:execute") };
  assert.throws(() => command(state, { ...payload, outputs: { ...payload.outputs, "resources.fulfilled": 999 } }), errorIs("postcondition_failed"));
  assert.throws(() => command(state, { ...payload, agentId: "agent-user" }), errorIs("unauthorized_agent"));
  assert.throws(() => command(state, { ...payload, expectedRevision: state.revision - 1 }), errorIs("stale_revision"));
  const done = command(state, payload, "exactly-once");
  assert.equal(command(done, payload, "exactly-once"), done);
  assert.equal(done.receipts.length, state.receipts.length + 1);
  assert.throws(() => command(done, { ...payload, binding: "changed" }, "exactly-once"), errorIs("idempotency_conflict"));
  assert.deepEqual(coordinationViolations(state), [], "failed commands never mutate input state");
});

test("pre-commit corrections invalidate grants and stale results, then choose a fresh route", () => {
  let state = runThrough(createCoordinationState(packet().coordination), "approval");
  const oldGate = state.receipts.find(receipt => receipt.actionId.endsWith(":approval"));
  assert.ok(Object.keys(state.grants).length);
  state = command(state, { type: "correct", principalId: state.contract.principal.id, changes: { "source.stock": 100 } });
  assert.equal(state.epoch, 1);
  assert.equal(state.receipts.length, 0);
  assert.equal(Object.keys(state.grants).length, 0);
  state = runThrough(state, "check");
  assert.equal(coordinationDirection(state, "kernel-case:route").agentId, "agent-operations");
  assert.throws(() => command(state, { type: "result", actionId: oldGate.actionId, agentId: oldGate.agentId, binding: oldGate.binding, outputs: oldGate.outputs }), errorIs("dependency_unverified"));
  state = runThrough(state);
  assert.equal(state.values["resources.remaining"], 50);
  assert.throws(() => command(state, { type: "correct", principalId: state.contract.principal.id, changes: { "source.stock": 0 } }), errorIs("compensation_required"));
});

test("forged receipts, projection completion and restored corruption cannot publish success", () => {
  const state = runThrough(createCoordinationState(packet().coordination));
  for (const corrupt of [
    s => { s.receipts.pop(); },
    s => { s.receipts[0].mode = "live"; },
    s => { s.values["resources.fulfilled"] = 500; },
    s => { s.contract.facts["source.quantity"] = 500; },
    s => { s.values["invented.fact"] = true; },
    s => { s.executions["kernel-case:execute"].agentId = "agent-user"; },
  ]) { const candidate = copy(state); corrupt(candidate); assert.equal(coordinationComplete(candidate), false); assert.ok(coordinationViolations(candidate).length); }
  let world = worldFor(packet());
  for (const task of world.tasks) task.status = "done";
  world = atlas.advanceAtlasWorld(world, 140);
  assert.equal(world.phase, "blocked");
  assert.equal(atlas.restoreAtlasWorld(atlas.serializeAtlasWorld(world)), null);
});

test("canonical approval does not execute an unrelated legacy runtime side effect", () => {
  let world = untilPause(worldFor(packet()));
  const history = world.runtime.history.length;
  const approval = world.approvals.find(item => item.status === "pending");
  world = atlas.resolveAtlasApproval(world, approval.id, true);
  assert.equal(world.runtime.history.length, history);
  world = untilPause(world);
  assert.equal(world.phase, "completed");
  assert.equal(atlas.atlasSnapshot(world).coordination.status, "verified_simulation");
  assert.deepEqual(world.runtime.orders, []);
});

test("canonical correction resumes the same task without reusing pending approval IDs", () => {
  let world = untilPause(worldFor(packet("Book appointments\nQuantity: 5\nCapacity: 0")));
  world = atlas.correctAtlasCoordination(world, { "source.capacity": 10 }, "principal:business", "fix-capacity");
  world = untilPause(world);
  assert.equal(world.phase, "waiting_approval");
  assert.equal(world.coordination.epoch, 1);
  const pending = world.approvals.find(item => item.status === "pending");
  world = atlas.resolveAtlasApproval(world, pending.id, true);
  world = untilPause(world);
  assert.equal(world.phase, "completed");
});

test("cycles, duplicate effects, unknown destinations and unscoped approvals are rejected", () => {
  for (const mutate of [
    c => { c.actions[0].dependsOn = [c.actions.at(-1).id]; },
    c => { c.actions[1].effects = copy(c.actions[0].effects); },
    c => { c.actions[0].destinationId = "unregistered"; },
    c => { c.actions.find(action => action.stage === "approval").approvalTargets = []; },
  ]) { const c = copy(packet().coordination); mutate(c); assert.throws(() => validateCoordinationContract(c)); }
});

test("public snapshots omit private source data; new UI strings follow all three locales", () => {
  const p = packet("Restock notebooks\nQuantity: 50\nStock: 20\nLocation: SECRET_ADDRESS_739\nConstraints: SECRET_CONDITION_739");
  const observed = JSON.stringify(atlas.atlasSnapshot(worldFor(p)));
  assert.ok(!observed.includes("SECRET_ADDRESS_739"));
  assert.ok(!observed.includes("SECRET_CONDITION_739"));
  for (const key of ["replenish", "kernelEvidence", "kernelReview", "kernelConstraint", "kernelBlocked"]) {
    assert.equal(SIMULATION_COPY[key].length, 3);
    assert.ok(SIMULATION_COPY[key].every(value => typeof value === "string" && value.length));
    assert.notEqual(SIMULATION_COPY[key][0], SIMULATION_COPY[key][1]);
  }
});

// A deliberately different domain proves that the reducer is not tied to
// the purchase/stock vocabulary of the demonstration adapter.
function tinyContract(amount, side) {
  return {
    schemaVersion: "asympta.coordination/1", id: "heat-sample", principal: { id: `principal:${side}`, side }, mode: "simulated", facts: { requested: amount }, reviewFields: [],
    participants: [{ id: "operator", locationId: "lab", capabilities: ["prepare", "heat"] }, { id: "reviewer", locationId: "desk", capabilities: ["approve"] }],
    actions: [
      { id: "prepare", stage: "prepare", capability: "prepare", dependsOn: [], candidates: [{ agentId: "operator" }], preconditions: [], effects: { prepared: true }, postconditions: [{ left: { fact: "prepared" }, op: "eq", right: true }] },
      { id: "review", stage: "review", capability: "approve", dependsOn: ["prepare"], candidates: [{ agentId: "reviewer" }], preconditions: [], effects: { reviewed: true }, postconditions: [{ left: { fact: "reviewed" }, op: "eq", right: true }], approvalTargets: ["heat"] },
      { id: "heat", stage: "heat", capability: "heat", dependsOn: ["review"], candidates: [{ agentId: "operator" }], preconditions: [], effects: { heated: { fact: "requested" } }, postconditions: [{ left: { fact: "heated" }, op: "eq", right: { fact: "requested" } }], requiresApproval: true },
    ], goals: [{ left: { fact: "heated" }, op: "eq", right: { fact: "requested" } }],
  };
}

test("100,000 seeded bounded checks: 20,000 valid/replay cases and 80,000 rejected attacks", () => {
  const fixtures = Array.from({ length: 128 }, (_, i) => {
    const initial = createCoordinationState(tinyContract(i + 1, i % 2 ? "users" : "business"));
    let gate = result(start(initial, "prepare"), "prepare"); gate = start(gate, "review");
    let ready = command(gate, { type: "approve", actionId: "review", principalId: gate.contract.principal.id, approved: true });
    ready = result(ready, "review"); ready = start(ready, "heat");
    const payload = { type: "result", actionId: "heat", agentId: "operator", binding: ready.executions.heat.binding, outputs: { heated: i + 1 } };
    const completed = command(ready, payload, "repeat");
    return { initial, gate, ready, payload, completed };
  });
  let seed = 20260907; let allowed = 0; let rejected = 0;
  for (let i = 0; i < 100000; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const { initial, gate, ready, payload, completed } = fixtures[seed % fixtures.length];
    switch (i % 10) {
      case 0: assert.equal(coordinationComplete(command(ready, payload, "accept")), true); allowed++; break;
      case 1: assert.equal(command(completed, payload, "repeat"), completed); allowed++; break;
      case 2: assert.throws(() => command(ready, { ...payload, outputs: { heated: -1 } }), errorIs("postcondition_failed")); rejected++; break;
      case 3: assert.throws(() => command(ready, { ...payload, agentId: "reviewer" }), errorIs("unauthorized_agent")); rejected++; break;
      case 4: assert.throws(() => command(ready, { ...payload, outputs: {} }), errorIs("invalid_result_shape")); rejected++; break;
      case 5: assert.throws(() => command(ready, { ...payload, binding: "stale" }), errorIs("stale_result")); rejected++; break;
      case 6: assert.throws(() => command(ready, { ...payload, expectedRevision: ready.revision - 1 }), errorIs("stale_revision")); rejected++; break;
      case 7: assert.throws(() => start(initial, "heat"), errorIs("dependency_unverified")); rejected++; break;
      case 8: assert.throws(() => result(gate, "review"), errorIs("approval_required")); rejected++; break;
      case 9: assert.throws(() => command(completed, { ...payload, binding: "different" }, "repeat"), errorIs("idempotency_conflict")); rejected++; break;
    }
  }
  assert.equal(allowed, 20000); assert.equal(rejected, 80000);
});
