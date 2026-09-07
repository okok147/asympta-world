/** Shared deterministic contract kernel. Transport/LLM text is never authority.
 * This release executes SIMULATIONS ONLY; receipts are not real-world proof.
 */
export type KernelValue = string | number | boolean;
export type KernelExpression = KernelValue | { fact: string } | { op: "add" | "subtract" | "max"; args: KernelExpression[] };
export type KernelPredicate = { left: KernelExpression; op: "eq" | "gte" | "lte" | "gt"; right: KernelExpression };
export type KernelParticipant = { id: string; capabilities: string[]; locationId: string };
export type KernelAction = {
  id: string; stage: string; capability: string; dependsOn: string[]; destinationId?: string;
  candidates: Array<{ agentId: string; when?: KernelPredicate[] }>;
  preconditions: KernelPredicate[]; postconditions: KernelPredicate[];
  effects: Record<string, KernelExpression>;
  requiresApproval?: boolean; approvalTargets?: string[];
};
export type CoordinationContract = {
  schemaVersion: "asympta.coordination/1"; id: string;
  principal: { id: string; side: "users" | "business" };
  source?: { text: string; parameters: Array<{ key: string; value: string }> };
  mode: "simulated"; facts: Record<string, KernelValue>;
  participants: KernelParticipant[]; actions: KernelAction[];
  goals: KernelPredicate[]; reviewFields: string[];
};
export type KernelReceipt = {
  id: string; actionId: string; agentId: string; adapter: "asympta-simulator/1";
  mode: "simulated"; epoch: number; binding: string;
  causes: string[]; outputs: Record<string, KernelValue>;
};
export type CoordinationState = {
  contract: CoordinationContract; contractBinding: string; revision: number; epoch: number; corrections: number;
  values: Record<string, KernelValue>;
  executions: Record<string, { status: "pending" | "running" | "verified"; agentId?: string; binding?: string; receiptId?: string }>;
  grants: Record<string, { principalId: string; binding: string }>;
  receipts: KernelReceipt[];
  events: Array<{ revision: number; type: string; actionId?: string; code?: string }>;
  commands: Record<string, string>;
  blocker?: { code: string; actionId?: string };
};
type CommandBase = { commandId: string; expectedRevision: number };
export type KernelCommand = CommandBase & (
  | { type: "start"; actionId: string; agentId: string }
  | { type: "approve"; actionId: string; principalId: string; approved: boolean }
  | { type: "result"; actionId: string; agentId: string; binding: string; outputs: Record<string, KernelValue> }
  | { type: "correct"; principalId: string; changes: Record<string, KernelValue> }
);
export class CoordinationError extends Error {
  code: string;
  constructor(code: string) { super(code); this.name = "CoordinationError"; this.code = code; }
}
const fail = (code: string): never => { throw new CoordinationError(code); };
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const safeId = (id: string) => typeof id === "string" && /^[a-zA-Z0-9_.:-]{1,160}$/.test(id) && !["__proto__", "constructor", "prototype"].includes(id);
const scalar = (value: unknown): value is KernelValue => typeof value === "boolean" || (typeof value === "string" && value.length <= 2000) || (typeof value === "number" && Number.isFinite(value));
/** Canonical equality, NOT a cryptographic signature or a browser security boundary. */
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(",")}}`;
  return JSON.stringify(value);
}
export function evaluateKernelExpression(expression: KernelExpression, values: Record<string, KernelValue>, depth = 0): KernelValue {
  if (depth > 12) return fail("expression_too_deep");
  if (scalar(expression)) return expression;
  if (!expression || typeof expression !== "object" || Array.isArray(expression)) return fail("invalid_expression");
  if ("fact" in expression) {
    if (!safeId(expression.fact) || !Object.hasOwn(values, expression.fact)) return fail("missing_fact");
    return values[expression.fact];
  }
  if (!["add", "subtract", "max"].includes(expression.op) || !Array.isArray(expression.args) || expression.args.length !== 2) return fail("invalid_expression");
  const args = expression.args.map(item => evaluateKernelExpression(item, values, depth + 1));
  if (!args.every(value => typeof value === "number" && Number.isFinite(value))) return fail("non_numeric_expression");
  const [a, b] = args as number[];
  const result = expression.op === "add" ? a + b : expression.op === "subtract" ? a - b : Math.max(a, b);
  return Number.isFinite(result) ? result : fail("non_finite_result");
}
export function checkKernelPredicates(predicates: KernelPredicate[], values: Record<string, KernelValue>): boolean {
  return predicates.every(predicate => {
    const left = evaluateKernelExpression(predicate.left, values);
    const right = evaluateKernelExpression(predicate.right, values);
    if (predicate.op === "eq") return left === right;
    if (typeof left !== "number" || typeof right !== "number") return false;
    if (predicate.op === "gt") return left > right;
    if (predicate.op === "gte") return left >= right;
    if (predicate.op === "lte") return left <= right;
    return fail("invalid_predicate");
  });
}
export function validateCoordinationContract(contract: CoordinationContract) {
  if (contract.schemaVersion !== "asympta.coordination/1" || contract.mode !== "simulated" || !safeId(contract.id) || !safeId(contract.principal.id) || !["users", "business"].includes(contract.principal.side)) fail("invalid_contract");
  if (contract.source && (typeof contract.source.text !== "string" || contract.source.text.length > 12000 || !Array.isArray(contract.source.parameters) || contract.source.parameters.length > 128 || contract.source.parameters.some(item => !safeId(item.key) || typeof item.value !== "string" || item.value.length > 12000))) fail("invalid_source");
  if (!contract.actions.length || contract.actions.length > 64 || !contract.participants.length || contract.participants.length > 32 || Object.keys(contract.facts).length > 128 || !contract.goals.length) fail("invalid_contract_size");
  for (const [key, value] of Object.entries(contract.facts)) if (!safeId(key) || !scalar(value)) fail("invalid_fact");
  const actors = new Map(contract.participants.map(actor => [actor.id, actor]));
  const actions = new Map(contract.actions.map(action => [action.id, action]));
  if (actors.size !== contract.participants.length || actions.size !== contract.actions.length) fail("duplicate_identity");
  for (const actor of actors.values()) if (!safeId(actor.id) || !safeId(actor.locationId) || !actor.capabilities.length || actor.capabilities.some(capability => !safeId(capability))) fail("invalid_participant");
  const produced = new Set(Object.keys(contract.facts));
  for (const action of contract.actions) {
    if (!safeId(action.id) || !safeId(action.stage) || !safeId(action.capability) || !action.candidates.length || !Object.keys(action.effects).length || !action.postconditions.length) fail("invalid_action");
    if (new Set(action.dependsOn).size !== action.dependsOn.length || action.dependsOn.some(id => id === action.id || !actions.has(id))) fail("invalid_dependency");
    if (action.destinationId && !actors.has(action.destinationId)) fail("invalid_destination");
    if (action.candidates.some(candidate => !actors.get(candidate.agentId)?.capabilities.includes(action.capability))) fail("missing_capability");
    for (const key of Object.keys(action.effects)) {
      if (!safeId(key) || produced.has(key)) fail("conflicting_effect");
      produced.add(key);
    }
    for (const target of action.approvalTargets ?? []) if (target === action.id || !actions.get(target)?.requiresApproval) fail("invalid_approval_scope");
  }
  const visited = new Set<string>(); const visiting = new Set<string>();
  const visit = (id: string) => {
    if (visiting.has(id)) fail("dependency_cycle");
    if (visited.has(id)) return;
    visiting.add(id); for (const dependency of actions.get(id)!.dependsOn) visit(dependency);
    visiting.delete(id); visited.add(id);
  };
  for (const id of actions.keys()) visit(id);
  const ancestors = (id: string): Set<string> => {
    const found = new Set<string>();
    const collect = (current: string) => { for (const parent of actions.get(current)!.dependsOn) if (!found.has(parent)) { found.add(parent); collect(parent); } };
    collect(id); return found;
  };
  for (const action of contract.actions) if (action.requiresApproval && !contract.actions.some(gate => gate.approvalTargets?.includes(action.id) && ancestors(action.id).has(gate.id))) fail("missing_approval_gate");
  return contract;
}
export function createCoordinationState(contract: CoordinationContract): CoordinationState {
  validateCoordinationContract(contract);
  return {
    contract: copy(contract), contractBinding: stable(contract), revision: 0, epoch: 0, corrections: 0, values: copy(contract.facts),
    executions: Object.fromEntries(contract.actions.map(action => [action.id, { status: "pending" as const }])),
    grants: {}, receipts: [], events: [], commands: {},
  };
}
function actionFor(state: CoordinationState, id: string) {
  return state.contract.actions.find(action => action.id === id) ?? fail("unknown_action");
}
// The host keeps the contract immutable between corrections. Store its exact
// canonical representation once, rather than duplicating it in every receipt.
function planBinding(state: CoordinationState) { return `${state.contract.id}:epoch:${state.epoch}`; }
function bindingFor(state: CoordinationState, action: KernelAction) {
  return stable({ plan: planBinding(state), actionId: action.id, causes: action.dependsOn.map(id => state.executions[id]?.receiptId) });
}
export function coordinationDirection(state: CoordinationState, actionId: string) {
  const action = actionFor(state, actionId);
  const candidate = action.candidates.find(item => checkKernelPredicates(item.when ?? [], state.values));
  const participant = state.contract.participants.find(actor => actor.id === candidate?.agentId && actor.capabilities.includes(action.capability));
  if (!participant) return fail("missing_capability");
  return { agentId: participant.id, locationId: (state.contract.participants.find(actor => actor.id === action.destinationId) ?? participant).locationId, capability: action.capability, dependsOn: [...action.dependsOn] };
}
function grantValid(state: CoordinationState, actionId: string) {
  const grant = state.grants[actionId];
  return grant?.principalId === state.contract.principal.id && grant.binding === planBinding(state);
}
function dependenciesVerified(state: CoordinationState, action: KernelAction) {
  return action.dependsOn.every(id => state.executions[id]?.status === "verified" && state.receipts.some(receipt => receipt.id === state.executions[id].receiptId && receipt.actionId === id && receipt.epoch === state.epoch));
}
export function reduceCoordination(state: CoordinationState, command: KernelCommand): CoordinationState {
  if (!safeId(command.commandId)) return fail("invalid_command_id");
  const { expectedRevision: _revision, ...identity } = command;
  void _revision;
  const signature = stable(identity);
  if (Object.hasOwn(state.commands, command.commandId)) {
    if (state.commands[command.commandId] !== signature) return fail("idempotency_conflict");
    return state;
  }
  if (command.expectedRevision !== state.revision) return fail("stale_revision");
  if (Object.keys(state.commands).length >= 1024) return fail("command_budget_exceeded");
  const violation = coordinationViolations(state)[0];
  if (violation) return fail(violation);
  const next = copy(state);
  let actionId: string | undefined;
  if (command.type === "correct") {
    if (command.principalId !== state.contract.principal.id) return fail("unauthorized_principal");
    if (state.corrections >= 16) return fail("correction_budget_exceeded");
    if (state.contract.actions.some(action => action.requiresApproval && state.executions[action.id]?.status === "verified")) return fail("compensation_required");
    if (!Object.keys(command.changes).length) return fail("empty_correction");
    for (const [key, value] of Object.entries(command.changes)) {
      if (!Object.hasOwn(next.contract.facts, key) || !scalar(value) || typeof value !== typeof next.contract.facts[key]) return fail("invalid_correction");
      next.contract.facts[key] = value;
    }
    next.contractBinding = stable(next.contract);
    next.epoch++; next.corrections++;
    next.values = copy(next.contract.facts);
    next.executions = Object.fromEntries(next.contract.actions.map(action => [action.id, { status: "pending" as const }]));
    next.grants = {}; next.receipts = []; delete next.blocker;
  } else {
    actionId = command.actionId;
    const action = actionFor(next, actionId);
    const execution = next.executions[actionId];
    if (next.blocker) return fail("workflow_blocked");
    if (command.type === "approve") {
      if (command.principalId !== next.contract.principal.id) return fail("unauthorized_principal");
      if (!action.approvalTargets?.length || execution.status !== "running" || !dependenciesVerified(next, action)) return fail("approval_not_ready");
      if (!command.approved) next.blocker = { code: "approval_declined", actionId };
      else for (const target of action.approvalTargets) next.grants[target] = { principalId: command.principalId, binding: planBinding(next) };
    } else {
      const direction = coordinationDirection(next, actionId);
      if (direction.agentId !== command.agentId) return fail("unauthorized_agent");
      if (!dependenciesVerified(next, action)) return fail("dependency_unverified");
      if (!checkKernelPredicates(action.preconditions, next.values)) return fail("precondition_failed");
      if (action.requiresApproval && !grantValid(next, actionId)) return fail("approval_required");
      if (command.type === "start") {
        if (execution.status !== "pending") return fail("action_already_started");
        execution.status = "running"; execution.agentId = command.agentId; execution.binding = bindingFor(next, action);
      } else {
        if (execution.status !== "running" || execution.binding !== command.binding || command.binding !== bindingFor(next, action)) return fail("stale_result");
        if (action.approvalTargets?.some(target => !grantValid(next, target))) return fail("approval_required");
        const keys = Object.keys(command.outputs).sort();
        if (stable(keys) !== stable(Object.keys(action.effects).sort()) || Object.values(command.outputs).some(value => !scalar(value))) return fail("invalid_result_shape");
        const values = { ...next.values, ...command.outputs };
        if (!checkKernelPredicates(action.postconditions, values)) return fail("postcondition_failed");
        const receipt: KernelReceipt = {
          id: `${next.contract.id}:receipt:${next.epoch}:${next.revision + 1}`, actionId, agentId: command.agentId,
          adapter: "asympta-simulator/1", mode: "simulated", epoch: next.epoch, binding: command.binding,
          causes: action.dependsOn.map(id => next.executions[id].receiptId!), outputs: copy(command.outputs),
        };
        next.values = values; next.receipts.push(receipt);
        execution.status = "verified"; execution.receiptId = receipt.id;
      }
    }
  }
  next.revision++;
  next.commands[command.commandId] = signature;
  next.events.push({ revision: next.revision, type: command.type, ...(actionId ? { actionId } : {}) });
  return next;
}
/** Trusted local simulator adapter. It produces proposals; the reducer checks them. */
export function simulatedCoordinationOutputs(state: CoordinationState, actionId: string) {
  return Object.fromEntries(Object.entries(actionFor(state, actionId).effects).map(([key, expression]) => [key, evaluateKernelExpression(expression, state.values)]));
}
export function coordinationViolations(state: CoordinationState): string[] {
  try {
    validateCoordinationContract(state.contract);
    if (state.contractBinding !== stable(state.contract)) return ["contract_binding_mismatch"];
    if (Object.entries(state.contract.facts).some(([key, value]) => state.values[key] !== value)) return ["source_fact_mismatch"];
    const verified = Object.values(state.executions).filter(item => item.status === "verified");
    if (state.receipts.length !== verified.length || new Set(state.receipts.map(item => item.id)).size !== state.receipts.length || new Set(state.receipts.map(item => item.actionId)).size !== state.receipts.length) return ["orphan_receipt"];
    const allowedFacts = new Set([...Object.keys(state.contract.facts), ...state.receipts.flatMap(receipt => Object.keys(receipt.outputs))]);
    if (Object.keys(state.values).some(key => !allowedFacts.has(key))) return ["orphan_fact"];
    if (Object.keys(state.executions).length !== state.contract.actions.length) return ["invalid_execution"];
    for (const action of state.contract.actions) {
      const execution = state.executions[action.id];
      if (!execution) return ["missing_execution"];
      if (!["pending", "running", "verified"].includes(execution.status)) return ["invalid_execution"];
      if (execution.status !== "pending" && (coordinationDirection(state, action.id).agentId !== execution.agentId || execution.binding !== bindingFor(state, action))) return ["invalid_actor_binding"];
      if (execution.status === "running" && (!dependenciesVerified(state, action) || !checkKernelPredicates(action.preconditions, state.values) || (action.requiresApproval && !grantValid(state, action.id)))) return ["invalid_running_action"];
      if (execution.status === "verified") {
        const receipt = state.receipts.find(item => item.id === execution.receiptId);
        if (!receipt || receipt.actionId !== action.id || receipt.epoch !== state.epoch || receipt.mode !== "simulated" || receipt.adapter !== "asympta-simulator/1" || receipt.agentId !== execution.agentId || receipt.binding !== bindingFor(state, action)) return ["invalid_receipt"];
        if (stable(receipt.causes) !== stable(action.dependsOn.map(id => state.executions[id].receiptId)) || stable(Object.keys(receipt.outputs).sort()) !== stable(Object.keys(action.effects).sort()) || !dependenciesVerified(state, action) || !checkKernelPredicates(action.preconditions, state.values) || !checkKernelPredicates(action.postconditions, state.values)) return ["invalid_evidence_chain"];
        if (Object.entries(receipt.outputs).some(([key, value]) => !scalar(value) || state.values[key] !== value)) return ["result_fact_mismatch"];
        if (action.approvalTargets?.some(target => !grantValid(state, target))) return ["approval_required"];
        if (action.requiresApproval && !grantValid(state, action.id)) return ["approval_required"];
      }
    }
    return [];
  } catch (error) { return [error instanceof CoordinationError ? error.code : "invalid_kernel_state"]; }
}
export function coordinationComplete(state: CoordinationState) {
  return !state.blocker && !coordinationViolations(state).length && state.contract.actions.every(action => state.executions[action.id].status === "verified") && checkKernelPredicates(state.contract.goals, state.values);
}
export function coordinationSnapshot(state: CoordinationState) {
  const violations = coordinationViolations(state);
  const complete = !violations.length && coordinationComplete(state);
  return {
    schemaVersion: state.contract.schemaVersion, id: state.contract.id, side: state.contract.principal.side,
    mode: "simulated" as const, revision: state.revision, epoch: state.epoch,
    status: state.blocker || violations.length ? "blocked" : complete ? "verified_simulation" : "coordinating",
    blocker: state.blocker?.code ?? violations[0] ?? null,
    evidenceCount: state.receipts.length, verifiedActions: Object.values(state.executions).filter(item => item.status === "verified").length,
    totalActions: state.contract.actions.length, reviewCount: state.contract.reviewFields.length,
    // Source text, addresses, budgets and receipt payloads are intentionally omitted.
    actions: state.contract.actions.map(action => ({ id: action.id, stage: action.stage, capability: action.capability, status: state.executions[action.id]?.status, dependsOn: action.dependsOn })),
  };
}
