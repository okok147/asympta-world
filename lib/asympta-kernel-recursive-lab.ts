import {
  generateUniversalStressCases,
  generateUniversalUseCases,
  type AsymptaUniversalBenchmarkCase,
} from "./asympta-universal-benchmark.ts";
import {
  runUniversalTask,
  type AsymptaCommunicationPacket,
  type AsymptaUniversalCapability,
  type AsymptaUniversalTaskEnvelope,
  type AsymptaUniversalTaskInput,
} from "./asympta-universal-task-protocol.ts";

export const ASYMPTA_KERNEL_RECURSIVE_LAB_VERSION = "asympta.kernel-recursive-lab/0.1" as const;
export const ASYMPTA_KERNEL_RECURSIVE_STATE_VERSION = "asympta.kernel-recursive-state/0.1" as const;

export const KERNEL_ATTACK_FAMILIES = [
  "baseline_success",
  "controlled_no_capability",
  "controlled_human_input",
  "controlled_approval",
  "multilingual_noise",
  "novel_requirement",
  "step_pressure",
  "fallback_route",
  "reordered_requirements",
  "compound_noise",
] as const;

export type KernelAttackFamily = typeof KERNEL_ATTACK_FAMILIES[number];
export type KernelTrajectoryOutcome = "completed" | "controlled_failure" | "uncontrolled_failure";

export type KernelAttackWeights = Record<KernelAttackFamily, number>;
export type KernelRepairWeights = {
  semantic: number;
  capability: number;
  liveness: number;
  approval: number;
  handoff: number;
  verification: number;
};

export type KernelRecursiveState = {
  version: typeof ASYMPTA_KERNEL_RECURSIVE_STATE_VERSION;
  generation: number;
  totalCases: number;
  attackWeights: KernelAttackWeights;
  repairWeights: KernelRepairWeights;
  uncontrolledFingerprints: string[];
  lastRunAt: string | null;
};

export type KernelRecursiveCase = {
  id: string;
  family: KernelAttackFamily;
  input: AsymptaUniversalTaskInput;
};

export type KernelProcessTrajectory = {
  id: string;
  family: KernelAttackFamily;
  input: {
    domain: string;
    actionFamily: string;
    locale: string;
    mode: string;
    risk: string;
    intent: string;
    requiredFields: string[];
  };
  status: AsymptaUniversalTaskEnvelope["status"];
  outcome: KernelTrajectoryOutcome;
  processIntegrity: boolean;
  deterministic: boolean;
  fingerprint: string;
  terminalReason: string | null;
  terminalOwner: string | null;
  recovery: string | null;
  stakeholders: string[];
  packetKinds: string[];
  steps: number;
  humanInterventions: number;
  resultCompleted: boolean;
  multiStakeholder: boolean;
};

export type KernelRecursiveReport = {
  version: typeof ASYMPTA_KERNEL_RECURSIVE_LAB_VERSION;
  seed: number;
  generation: number;
  total: number;
  completed: number;
  controlledFailures: number;
  uncontrolledFailures: number;
  processIntegrityRate: number;
  deterministicRate: number;
  families: Record<KernelAttackFamily, {
    total: number;
    completed: number;
    controlledFailures: number;
    uncontrolledFailures: number;
  }>;
  newUncontrolledFingerprints: string[];
  trajectories: KernelProcessTrajectory[];
  nextState: KernelRecursiveState;
};

export const DEFAULT_KERNEL_ATTACK_WEIGHTS: KernelAttackWeights = {
  baseline_success: 1,
  controlled_no_capability: 1,
  controlled_human_input: 1,
  controlled_approval: 1,
  multilingual_noise: 1,
  novel_requirement: 1,
  step_pressure: 1,
  fallback_route: 1,
  reordered_requirements: 1,
  compound_noise: 1,
};

export const DEFAULT_KERNEL_REPAIR_WEIGHTS: KernelRepairWeights = {
  semantic: 1,
  capability: 1,
  liveness: 1,
  approval: 1,
  handoff: 1,
  verification: 1,
};

const TERMINAL_STATUSES = new Set<AsymptaUniversalTaskEnvelope["status"]>([
  "completed",
  "needs_human",
  "blocked",
  "failed",
]);

const NON_AGENT_ACTORS = new Set(["human", "profile", "world"]);

function clamp(value: number, minimum: number, maximum: number) {
  if (!Number.isFinite(value)) return minimum;
  return Math.max(minimum, Math.min(maximum, value));
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function makeRandom(seed: number) {
  let state = (Math.floor(seed) >>> 0) || 0x6d2b79f5;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function normalizedWeights(input?: Partial<KernelAttackWeights> | null): KernelAttackWeights {
  const next = {} as KernelAttackWeights;
  for (const family of KERNEL_ATTACK_FAMILIES) {
    next[family] = clamp(Number(input?.[family] ?? DEFAULT_KERNEL_ATTACK_WEIGHTS[family]), 0.25, 8);
  }
  return next;
}

function normalizedRepairWeights(input?: Partial<KernelRepairWeights> | null): KernelRepairWeights {
  const keys = Object.keys(DEFAULT_KERNEL_REPAIR_WEIGHTS) as Array<keyof KernelRepairWeights>;
  const next = {} as KernelRepairWeights;
  for (const key of keys) next[key] = clamp(Number(input?.[key] ?? 1), 0.25, 8);
  return next;
}

export function createInitialKernelRecursiveState(): KernelRecursiveState {
  return {
    version: ASYMPTA_KERNEL_RECURSIVE_STATE_VERSION,
    generation: 0,
    totalCases: 0,
    attackWeights: { ...DEFAULT_KERNEL_ATTACK_WEIGHTS },
    repairWeights: { ...DEFAULT_KERNEL_REPAIR_WEIGHTS },
    uncontrolledFingerprints: [],
    lastRunAt: null,
  };
}

export function normalizeKernelRecursiveState(value: unknown): KernelRecursiveState {
  const candidate = value && typeof value === "object" ? value as Partial<KernelRecursiveState> : {};
  return {
    version: ASYMPTA_KERNEL_RECURSIVE_STATE_VERSION,
    generation: Math.max(0, Math.floor(Number(candidate.generation ?? 0))),
    totalCases: Math.max(0, Math.floor(Number(candidate.totalCases ?? 0))),
    attackWeights: normalizedWeights(candidate.attackWeights),
    repairWeights: normalizedRepairWeights(candidate.repairWeights),
    uncontrolledFingerprints: Array.isArray(candidate.uncontrolledFingerprints)
      ? [...new Set(candidate.uncontrolledFingerprints.filter((entry): entry is string => typeof entry === "string" && entry.length > 0))].slice(-256)
      : [],
    lastRunAt: typeof candidate.lastRunAt === "string" ? candidate.lastRunAt : null,
  };
}

function weightedFamily(random: () => number, weights: KernelAttackWeights) {
  const total = KERNEL_ATTACK_FAMILIES.reduce((sum, family) => sum + weights[family], 0);
  let cursor = random() * total;
  for (const family of KERNEL_ATTACK_FAMILIES) {
    cursor -= weights[family];
    if (cursor <= 0) return family;
  }
  return KERNEL_ATTACK_FAMILIES[KERNEL_ATTACK_FAMILIES.length - 1];
}

function customCapability(input: AsymptaUniversalBenchmarkCase, overrides: Partial<AsymptaUniversalCapability> = {}): AsymptaUniversalCapability {
  return {
    id: `recursive-${input.archetypeId}`,
    title: `Recursive ${input.archetypeId} capability`,
    actionFamilies: [input.actionFamily],
    domains: [input.domain],
    tags: [input.actionFamily, input.domain],
    canDiscover: ["*"],
    simulated: false,
    ...overrides,
  };
}

function withId(input: AsymptaUniversalTaskInput, family: KernelAttackFamily, seed: number, index: number) {
  return {
    ...input,
    id: `recursive-${family}-${seed}-${String(index + 1).padStart(5, "0")}`,
  } satisfies AsymptaUniversalTaskInput;
}

function mutateCase(base: AsymptaUniversalBenchmarkCase, family: KernelAttackFamily, seed: number, index: number): AsymptaUniversalTaskInput {
  if (family === "baseline_success") {
    return withId({ ...base, mode: "benchmark", preauthorized: true }, family, seed, index);
  }

  if (family === "controlled_no_capability") {
    return withId({
      ...base,
      mode: "live",
      capabilities: [],
      preauthorized: false,
      requiredFields: [],
      profile: undefined,
      facts: {},
    }, family, seed, index);
  }

  if (family === "controlled_human_input") {
    return withId({
      ...base,
      mode: "live",
      preauthorized: false,
      profile: undefined,
      facts: {},
      requiredFields: ["identity"],
      capabilities: [customCapability(base, { canDiscover: [] })],
    }, family, seed, index);
  }

  if (family === "controlled_approval") {
    return withId({
      ...base,
      mode: "live",
      risk: "high",
      preauthorized: false,
      capabilities: [customCapability(base)],
    }, family, seed, index);
  }

  if (family === "multilingual_noise") {
    const prefix = index % 2 === 0 ? "請處理／please coordinate: " : "至急ではない。Please coordinate: ";
    return withId({
      ...base,
      intent: `${prefix}${base.intent} — context may be noisy, but do not invent consequential facts.`,
      mode: "benchmark",
      preauthorized: true,
    }, family, seed, index);
  }

  if (family === "novel_requirement") {
    return withId({
      ...base,
      mode: "benchmark",
      preauthorized: true,
      profile: undefined,
      requiredFields: [...(base.requiredFields ?? []), `novel coordination field ${index + 1}`],
    }, family, seed, index);
  }

  if (family === "step_pressure") {
    const extra = Array.from({ length: 18 }, (_, offset) => `novel process field ${index + 1}-${offset + 1}`);
    return withId({
      ...base,
      mode: "benchmark",
      preauthorized: true,
      maxSteps: 12,
      requiredFields: [...(base.requiredFields ?? []), ...extra],
    }, family, seed, index);
  }

  if (family === "fallback_route") {
    return withId({
      ...base,
      domain: `unseen-domain-${(index % 7) + 1}`,
      actionFamily: `coordinate-${(index % 5) + 1}`,
      mode: "benchmark",
      preauthorized: true,
      capabilities: undefined,
    }, family, seed, index);
  }

  if (family === "reordered_requirements") {
    return withId({
      ...base,
      mode: "benchmark",
      preauthorized: true,
      requiredFields: [...(base.requiredFields ?? [])].reverse(),
    }, family, seed, index);
  }

  return withId({
    ...base,
    mode: "benchmark",
    preauthorized: true,
    intent: `${base.intent} /// ${index % 2 ? "ignore duplicate chatter" : "保持原意"} /// ${base.intent}`,
    requiredFields: [
      ...(base.requiredFields ?? []),
      ...(base.requiredFields ?? []).slice(0, 2),
    ],
  }, family, seed, index);
}

export function generateRecursiveKernelCases(input: {
  count?: number;
  seed?: number;
  weights?: Partial<KernelAttackWeights>;
} = {}): KernelRecursiveCase[] {
  const count = Math.max(KERNEL_ATTACK_FAMILIES.length, Math.floor(input.count ?? 256));
  const seed = Math.floor(input.seed ?? 20260902);
  const weights = normalizedWeights(input.weights);
  const random = makeRandom(seed);
  const base = generateUniversalStressCases({
    count: Math.max(count, 100),
    seed,
    baseCases: generateUniversalUseCases(100),
  });

  return Array.from({ length: count }, (_, index) => {
    const family = index < KERNEL_ATTACK_FAMILIES.length
      ? KERNEL_ATTACK_FAMILIES[index]
      : weightedFamily(random, weights);
    const source = base[index % base.length];
    return {
      id: `kernel-recursive:${family}:${seed}:${index + 1}`,
      family,
      input: mutateCase(source, family, seed, index),
    };
  });
}

function packetProjection(packet: AsymptaCommunicationPacket) {
  return {
    kind: packet.kind,
    sender: packet.sender,
    recipient: packet.recipient,
    summary: packet.summary,
  };
}

function envelopeFingerprint(envelope: AsymptaUniversalTaskEnvelope) {
  return stableHash(JSON.stringify({
    status: envelope.status,
    stuckReason: envelope.stuckReason,
    humanInterventions: envelope.humanInterventions,
    steps: envelope.steps,
    selectedCapability: envelope.selectedCapability?.id ?? null,
    requirements: envelope.requirements.map((requirement) => ({
      key: requirement.key,
      semantic: requirement.semantic,
      resolution: requirement.resolution ?? null,
      hasValue: requirement.value !== undefined,
    })),
    packets: envelope.packets.map(packetProjection),
    result: envelope.result ? {
      completed: envelope.result.completed,
      simulated: envelope.result.simulated,
      summary: envelope.result.summary,
    } : null,
  }));
}

function stakeholders(envelope: AsymptaUniversalTaskEnvelope) {
  const actors = new Set<string>();
  for (const packet of envelope.packets) {
    if (!NON_AGENT_ACTORS.has(packet.sender)) actors.add(packet.sender);
    if (!NON_AGENT_ACTORS.has(packet.recipient)) actors.add(packet.recipient);
  }
  return [...actors].sort();
}

function terminalRecovery(envelope: AsymptaUniversalTaskEnvelope) {
  if (envelope.status === "needs_human") return "human_input";
  if (envelope.status === "blocked" && envelope.stuckReason === "no_capability") return "reroute_or_add_capability";
  if (envelope.status === "blocked") return "inspect_and_reroute";
  if (envelope.status === "failed" && envelope.stuckReason === "step_limit_exceeded") return "bounded_retry_or_replan";
  if (envelope.status === "failed" && envelope.stuckReason === "state_loop_detected") return "escalate_or_replan";
  if (envelope.status === "failed") return "inspect_retry_or_stop";
  return null;
}

function terminalOwner(envelope: AsymptaUniversalTaskEnvelope) {
  if (envelope.status === "needs_human") return "human";
  const last = envelope.packets[envelope.packets.length - 1];
  if (!last) return null;
  return last.recipient || last.sender || null;
}

export function evaluateUniversalProcessTrajectory(
  caseInput: KernelRecursiveCase,
  primary: AsymptaUniversalTaskEnvelope,
  replay: AsymptaUniversalTaskEnvelope,
): KernelProcessTrajectory {
  const primaryFingerprint = envelopeFingerprint(primary);
  const replayFingerprint = envelopeFingerprint(replay);
  const deterministic = primaryFingerprint === replayFingerprint;
  const packetKinds = primary.packets.map((packet) => packet.kind);
  const terminal = TERMINAL_STATUSES.has(primary.status);
  const hasHandoff = packetKinds.includes("handoff");
  const hasVerification = packetKinds.includes("verification");
  const hasResultPacket = packetKinds.includes("result");
  const resultCompleted = primary.result?.completed === true;
  const processStakeholders = stakeholders(primary);
  const multiStakeholder = processStakeholders.length >= 4;
  const completedValid = primary.status === "completed"
    && resultCompleted
    && hasHandoff
    && hasVerification
    && hasResultPacket
    && multiStakeholder;

  const finalPacket = primary.packets[primary.packets.length - 1];
  const controlledFailure = primary.status !== "completed"
    && terminal
    && typeof primary.stuckReason === "string"
    && primary.stuckReason.length > 0
    && Boolean(finalPacket)
    && (finalPacket.kind === "exception" || finalPacket.kind === "question");

  const processIntegrity = deterministic && (completedValid || controlledFailure);
  const outcome: KernelTrajectoryOutcome = completedValid && deterministic
    ? "completed"
    : controlledFailure && deterministic
      ? "controlled_failure"
      : "uncontrolled_failure";

  return {
    id: caseInput.id,
    family: caseInput.family,
    input: {
      domain: caseInput.input.domain,
      actionFamily: caseInput.input.actionFamily,
      locale: caseInput.input.locale ?? "en",
      mode: caseInput.input.mode ?? "benchmark",
      risk: caseInput.input.risk ?? "low",
      intent: caseInput.input.intent,
      requiredFields: [...(caseInput.input.requiredFields ?? [])],
    },
    status: primary.status,
    outcome,
    processIntegrity,
    deterministic,
    fingerprint: primaryFingerprint,
    terminalReason: primary.stuckReason,
    terminalOwner: primary.status === "completed" ? "human" : terminalOwner(primary),
    recovery: terminalRecovery(primary),
    stakeholders: processStakeholders,
    packetKinds,
    steps: primary.steps,
    humanInterventions: primary.humanInterventions,
    resultCompleted,
    multiStakeholder,
  };
}

function repairArea(trajectory: KernelProcessTrajectory): keyof KernelRepairWeights {
  if (!trajectory.deterministic || trajectory.terminalReason === "state_loop_detected" || trajectory.terminalReason === "step_limit_exceeded") return "liveness";
  if (trajectory.terminalReason === "no_capability") return "capability";
  if (trajectory.status === "completed" && !trajectory.packetKinds.includes("handoff")) return "handoff";
  if (trajectory.status === "completed" && (!trajectory.packetKinds.includes("verification") || !trajectory.resultCompleted)) return "verification";
  if (trajectory.terminalReason === "approval_required") return "approval";
  return "semantic";
}

function trainAttackWeights(previous: KernelAttackWeights, trajectories: KernelProcessTrajectory[]) {
  const next = { ...previous };
  for (const family of KERNEL_ATTACK_FAMILIES) {
    const familyRuns = trajectories.filter((trajectory) => trajectory.family === family);
    if (!familyRuns.length) continue;
    const uncontrolledRate = familyRuns.filter((trajectory) => trajectory.outcome === "uncontrolled_failure").length / familyRuns.length;
    const controlledRate = familyRuns.filter((trajectory) => trajectory.outcome === "controlled_failure").length / familyRuns.length;
    const multiplier = uncontrolledRate > 0
      ? 1 + Math.min(1.5, uncontrolledRate * 2)
      : controlledRate > 0
        ? 1.04
        : 0.96;
    next[family] = clamp(previous[family] * multiplier, 0.25, 8);
  }
  return next;
}

function trainRepairWeights(previous: KernelRepairWeights, trajectories: KernelProcessTrajectory[]) {
  const next = { ...previous };
  const keys = Object.keys(next) as Array<keyof KernelRepairWeights>;
  for (const key of keys) next[key] = clamp(next[key] * 0.995, 0.25, 8);
  for (const trajectory of trajectories) {
    if (trajectory.outcome !== "uncontrolled_failure") continue;
    const area = repairArea(trajectory);
    next[area] = clamp(next[area] * 1.35 + 0.1, 0.25, 8);
  }
  return next;
}

export function runRecursiveKernelLab(input: {
  count?: number;
  seed?: number;
  state?: unknown;
  now?: string | number | Date;
} = {}): KernelRecursiveReport {
  const state = normalizeKernelRecursiveState(input.state);
  const seed = Math.floor(input.seed ?? 20260902 + state.generation);
  const cases = generateRecursiveKernelCases({
    count: input.count ?? 256,
    seed,
    weights: state.attackWeights,
  });
  const trajectories = cases.map((caseInput) => {
    const primary = runUniversalTask(caseInput.input);
    const replay = runUniversalTask(caseInput.input);
    return evaluateUniversalProcessTrajectory(caseInput, primary, replay);
  });

  const families = Object.fromEntries(KERNEL_ATTACK_FAMILIES.map((family) => {
    const entries = trajectories.filter((trajectory) => trajectory.family === family);
    return [family, {
      total: entries.length,
      completed: entries.filter((trajectory) => trajectory.outcome === "completed").length,
      controlledFailures: entries.filter((trajectory) => trajectory.outcome === "controlled_failure").length,
      uncontrolledFailures: entries.filter((trajectory) => trajectory.outcome === "uncontrolled_failure").length,
    }];
  })) as KernelRecursiveReport["families"];

  const completed = trajectories.filter((trajectory) => trajectory.outcome === "completed").length;
  const controlledFailures = trajectories.filter((trajectory) => trajectory.outcome === "controlled_failure").length;
  const uncontrolledFailures = trajectories.length - completed - controlledFailures;
  const deterministicCount = trajectories.filter((trajectory) => trajectory.deterministic).length;
  const fingerprints = trajectories
    .filter((trajectory) => trajectory.outcome === "uncontrolled_failure")
    .map((trajectory) => `${trajectory.family}:${trajectory.fingerprint}:${trajectory.terminalReason ?? trajectory.status}`);
  const previousFingerprints = new Set(state.uncontrolledFingerprints);
  const newUncontrolledFingerprints = [...new Set(fingerprints.filter((fingerprint) => !previousFingerprints.has(fingerprint)))];

  const nextState: KernelRecursiveState = {
    version: ASYMPTA_KERNEL_RECURSIVE_STATE_VERSION,
    generation: state.generation + 1,
    totalCases: state.totalCases + trajectories.length,
    attackWeights: trainAttackWeights(state.attackWeights, trajectories),
    repairWeights: trainRepairWeights(state.repairWeights, trajectories),
    uncontrolledFingerprints: [...new Set([...state.uncontrolledFingerprints, ...fingerprints])].slice(-256),
    lastRunAt: new Date(input.now ?? Date.now()).toISOString(),
  };

  return {
    version: ASYMPTA_KERNEL_RECURSIVE_LAB_VERSION,
    seed,
    generation: nextState.generation,
    total: trajectories.length,
    completed,
    controlledFailures,
    uncontrolledFailures,
    processIntegrityRate: trajectories.length ? (completed + controlledFailures) / trajectories.length : 0,
    deterministicRate: trajectories.length ? deterministicCount / trajectories.length : 0,
    families,
    newUncontrolledFingerprints,
    trajectories,
    nextState,
  };
}
