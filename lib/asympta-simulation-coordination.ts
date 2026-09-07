import { ATLAS_AGENTS } from "./atlas-simulation.ts";
import { validateCoordinationContract, type CoordinationContract, type KernelAction, type KernelExpression, type KernelPredicate, type KernelValue } from "./asympta-coordination-kernel.ts";
import type { SimulationPacket, SimulationStage } from "./asympta-simulation-compiler.ts";

const fact = (key: string): KernelExpression => ({ fact: key });
const eq = (key: string, value: KernelExpression): KernelPredicate => ({ left: fact(key), op: "eq", right: value });
const gte = (left: KernelExpression, right: KernelExpression): KernelPredicate => ({ left, op: "gte", right });
const calc = (op: "add" | "subtract" | "max", a: KernelExpression, b: KernelExpression): KernelExpression => ({ op, args: [a, b] });
const CAPABILITIES: Record<string, string[]> = {
  "agent-user": ["intake", "return"], "agent-customer": ["negotiate"],
  "agent-business": ["intake", "return", "negotiate", "perform"],
  "agent-supplier": ["negotiate", "source", "perform"],
  "agent-operations": ["inspect", "negotiate", "source", "perform"],
  "agent-market": ["negotiate", "perform"], "agent-logistics": ["negotiate", "perform"],
  "agent-support": ["negotiate", "perform"], "agent-finance": ["review"], "agent-quality": ["verify"],
};

/** Domain adapter, not the kernel: language/roles propose a typed goal/action graph. */
export function compileSimulationCoordination(packet: SimulationPacket): CoordinationContract {
  if (packet.questions.length) throw new Error("unresolved_requirements");
  const facts: Record<string, KernelValue> = {};
  for (const key of ["quantity", "stock", "capacity"]) {
    const input = packet.facts.find(item => item.key === key);
    if (!input) continue;
    if (typeof input.numericValue !== "number" || !Number.isFinite(input.numericValue) || input.numericValue < 0 || (key === "quantity" && input.numericValue === 0)) throw new Error("invalid_numeric_fact");
    facts[`source.${key}`] = input.numericValue;
  }
  const quantifiedSupply = packet.family === "supply" && Object.hasOwn(facts, "source.quantity") && Object.hasOwn(facts, "source.stock");
  const initiator = packet.side === "users" ? "agent-user" : "agent-business";
  const partner = packet.side === "business" && packet.facts.some(item => item.key === "capability") ? "agent-customer"
    : packet.family === "supply" ? "agent-supplier"
    : packet.family === "research" ? "agent-market"
    : packet.family === "delivery" ? "agent-logistics"
    : packet.family === "change" ? "agent-support"
    : packet.family === "service" || packet.family === "coordinate" ? "agent-operations"
    : packet.side === "business" && packet.family === "purchase" ? "agent-supplier" : "agent-business";
  const executor = packet.family === "supply" || packet.family === "service" || partner === "agent-customer" ? "agent-operations" : partner;
  const id = (stage: SimulationStage) => `${packet.id}:${stage}`;
  const actions: KernelAction[] = [];
  const add = (stage: SimulationStage, capability: string, agentId: string, effects: Record<string, KernelExpression>, preconditions: KernelPredicate[] = []) => {
    const action: KernelAction = {
      id: id(stage), stage, capability, dependsOn: actions.length ? [actions.at(-1)!.id] : [], candidates: [{ agentId }],
      preconditions, effects, postconditions: Object.entries(effects).map(([key, expression]) => eq(key, expression)),
    };
    actions.push(action); return action;
  };
  add("intake", "intake", initiator, { "brief.accepted": true });
  const checks: KernelPredicate[] = [eq("brief.accepted", true)];
  for (const key of Object.keys(facts)) checks.push({ left: fact(key), op: key === "source.quantity" ? "gt" : "gte", right: 0 });
  if (["booking", "service"].includes(packet.family) && Object.hasOwn(facts, "source.capacity") && Object.hasOwn(facts, "source.quantity")) checks.push(gte(fact("source.capacity"), fact("source.quantity")));
  const checkAction = add("check", "inspect", "agent-operations", { "resources.checked": true, ...(quantifiedSupply ? { "resources.shortage": calc("max", 0, calc("subtract", fact("source.quantity"), fact("source.stock"))) } : {}) }, checks);
  checkAction.destinationId = executor;
  const candidates = quantifiedSupply ? [
    { agentId: "agent-supplier", when: [{ left: fact("resources.shortage"), op: "gt" as const, right: 0 }] },
    { agentId: "agent-operations", when: [eq("resources.shortage", 0)] },
  ] : [{ agentId: partner }];
  const route = add("route", "negotiate", partner, { "counterparty.reached": true }, [eq("resources.checked", true)]);
  route.candidates = candidates; route.destinationId = initiator;
  const proposal = add("proposal", "negotiate", partner, { "proposal.prepared": true }, [eq("counterparty.reached", true)]);
  proposal.candidates = candidates; proposal.destinationId = initiator;
  if (packet.requiresApproval || quantifiedSupply) {
    const approval = add("approval", "review", "agent-finance", { "plan.reviewed": true }, [eq("proposal.prepared", true)]);
    approval.destinationId = initiator;
    approval.approvalTargets = [...(quantifiedSupply ? [id("replenish")] : []), id("execute")];
  }
  if (quantifiedSupply) {
    const source = add("replenish", "source", "agent-supplier", { "resources.replenished": fact("resources.shortage") }, [eq("plan.reviewed", true)]);
    source.candidates = candidates; source.requiresApproval = true;
  }
  const execute = add("execute", "perform", executor, {
    "execution.recorded": true,
    ...(quantifiedSupply ? {
      "resources.available": calc("add", fact("source.stock"), fact("resources.replenished")),
      "resources.fulfilled": fact("source.quantity"),
      "resources.remaining": calc("subtract", calc("add", fact("source.stock"), fact("resources.replenished")), fact("source.quantity")),
    } : {}),
  }, [eq(packet.requiresApproval || quantifiedSupply ? "plan.reviewed" : "proposal.prepared", true)]);
  execute.destinationId = initiator;
  execute.requiresApproval = packet.requiresApproval || quantifiedSupply;
  if (quantifiedSupply) execute.postconditions.push(gte(fact("resources.available"), fact("resources.fulfilled")), gte(fact("resources.remaining"), 0));
  add("verify", "verify", "agent-quality", { "verification.passed": true }, [eq("execution.recorded", true), ...(quantifiedSupply ? [eq("resources.fulfilled", fact("source.quantity")), eq("resources.remaining", calc("subtract", fact("resources.available"), fact("resources.fulfilled")))] : [])]);
  add("return", "return", initiator, { "result.returned": true }, [eq("verification.passed", true)]);
  return validateCoordinationContract({
    schemaVersion: "asympta.coordination/1", id: packet.id, principal: { id: `principal:${packet.side}`, side: packet.side }, mode: "simulated", facts,
    source: { text: packet.raw, parameters: packet.facts.map(item => ({ key: item.key, value: item.key === "selected_offer_id" ? item.evidence : item.value })) },
    participants: ATLAS_AGENTS.filter(agent => CAPABILITIES[agent.id]).map(agent => ({ id: agent.id, locationId: agent.homeLocationId, capabilities: CAPABILITIES[agent.id] })),
    actions, goals: [eq("verification.passed", true), eq("result.returned", true), ...(quantifiedSupply ? [eq("resources.fulfilled", fact("source.quantity")), gte(fact("resources.remaining"), 0)] : [])],
    // Natural-language semantics, prices, deadlines and real availability are NOT proven by a trace.
    reviewFields: ["uncompiled_source_semantics", ...new Set(packet.facts.filter(item => !["quantity", "stock", "capacity", "selected_offer_id"].includes(item.key)).map(item => item.key))],
  });
}
