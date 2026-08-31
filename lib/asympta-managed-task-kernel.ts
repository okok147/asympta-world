import {
  answerTaskRequirement as answerCoreTaskRequirement,
  approveAsymptaTask as approveCoreAsymptaTask,
  cancelAsymptaTask as cancelCoreAsymptaTask,
  createAsymptaTask as createCoreAsymptaTask,
  isAsymptaTaskState,
  nextTaskRequirement,
  taskToAdaptiveInteractionSchema,
} from "./asympta-task-kernel.ts";
import {
  compileRequirementContract,
  missingContractSemantics,
  requirementFacts,
  type AsymptaRequirementContractSnapshot,
} from "./asympta-requirement-contracts.ts";
import type {
  AnswerRequirementCommand,
  ApproveTaskCommand,
  AsymptaTaskEvidence,
  AsymptaTaskEvent,
  AsymptaTaskPlan,
  AsymptaTaskState,
  CancelTaskCommand,
  CreateAsymptaTaskInput,
} from "./asympta-task-kernel-types.ts";

export { isAsymptaTaskState, nextTaskRequirement, taskToAdaptiveInteractionSchema };

type ManagedTaskState = AsymptaTaskState & {
  requirementContract?: AsymptaRequirementContractSnapshot;
};

type ManagedCopy = {
  planSummary: string;
  proposalEvidence: string;
  resultSummary: string;
  verificationDetails: string;
  blockedSummary: string;
};

const COPY: Record<"en" | "zh-Hant" | "ja", Record<"procurement" | "coordination", ManagedCopy>> = {
  en: {
    procurement: {
      planSummary: "Build a simulated procurement brief from confirmed requirements, compare safe acquisition routes, and verify the boundary before any real commitment.",
      proposalEvidence: "Created a bounded simulated procurement proposal from confirmed requirements without inventing vendors, prices, inventory, payment, or delivery.",
      resultSummary: "A verified simulated procurement brief and coordination plan were completed. No real purchase, payment, supplier availability, or delivery was claimed.",
      verificationDetails: "The requirement contract, confirmed facts, simulated procurement proposal, bounded assignments, and no-side-effect boundary were verified.",
      blockedSummary: "The procurement requirement contract was incomplete, so Asympta stopped instead of claiming that the purchase was completed.",
    },
    coordination: {
      planSummary: "Build a bounded coordination brief from confirmed requirements, discover a compatible capability, and verify the boundary before any real action.",
      proposalEvidence: "Created a bounded simulated coordination proposal without claiming that an external service or real-world action was available.",
      resultSummary: "A verified simulated coordination brief was completed. No real external action or service availability was claimed.",
      verificationDetails: "The requirement contract, confirmed facts, simulated coordination proposal, bounded assignments, and no-side-effect boundary were verified.",
      blockedSummary: "The coordination requirement contract was incomplete, so Asympta stopped instead of claiming that the task was completed.",
    },
  },
  "zh-Hant": {
    procurement: {
      planSummary: "根據已確認要求建立模擬採購需求，比較安全的取得路徑，並在任何真實承諾前驗證邊界。",
      proposalEvidence: "已按確認資料建立受限的模擬採購方案；沒有虛構供應商、價格、庫存、付款或交付。",
      resultSummary: "已完成並驗證模擬採購需求與協調方案；沒有聲稱已真實購買、付款、取得供應商庫存或安排交付。",
      verificationDetails: "已驗證要求合約、確認資料、模擬採購方案、受限代理分工及不產生真實副作用的邊界。",
      blockedSummary: "採購要求合約仍不完整，因此 Asympta 已停止，而沒有聲稱已完成購買。",
    },
    coordination: {
      planSummary: "根據已確認要求建立受限協調需求，尋找相容能力，並在任何真實行動前驗證邊界。",
      proposalEvidence: "已建立受限的模擬協調方案；沒有聲稱外部服務或真實世界行動已可使用。",
      resultSummary: "已完成並驗證模擬協調需求；沒有聲稱已執行任何真實外部行動或已有可用服務。",
      verificationDetails: "已驗證要求合約、確認資料、模擬協調方案、受限代理分工及不產生真實副作用的邊界。",
      blockedSummary: "協調要求合約仍不完整，因此 Asympta 已停止，而沒有聲稱任務已完成。",
    },
  },
  ja: {
    procurement: {
      planSummary: "確認済み要件から模擬調達ブリーフを作成し、安全な取得経路を比較して、実際の確約前に境界を検証します。",
      proposalEvidence: "確認済み要件から制限付きの模擬調達案を作成しました。業者、価格、在庫、支払い、配送は捏造していません。",
      resultSummary: "検証済みの模擬調達ブリーフと連携計画を作成しました。実際の購入、支払い、在庫、配送は実行・主張していません。",
      verificationDetails: "要件契約、確認済み情報、模擬調達案、制限付き担当、および実世界へ影響しない境界を検証しました。",
      blockedSummary: "調達要件契約が不完全なため、購入完了を主張せずに停止しました。",
    },
    coordination: {
      planSummary: "確認済み要件から制限付き連携ブリーフを作成し、対応可能な能力を探して、実行前に境界を検証します。",
      proposalEvidence: "外部サービスや実世界での実行可能性を主張せず、制限付きの模擬連携案を作成しました。",
      resultSummary: "検証済みの模擬連携ブリーフを作成しました。実際の外部操作やサービス提供は実行・主張していません。",
      verificationDetails: "要件契約、確認済み情報、模擬連携案、制限付き担当、および実世界へ影響しない境界を検証しました。",
      blockedSummary: "連携要件契約が不完全なため、タスク完了を主張せずに停止しました。",
    },
  },
};

function cloneTask(task: AsymptaTaskState): ManagedTaskState {
  if (typeof structuredClone === "function") return structuredClone(task) as ManagedTaskState;
  return JSON.parse(JSON.stringify(task)) as ManagedTaskState;
}

function normalizedLocale(task: AsymptaTaskState) {
  const value = task.rootIntent.locale.toLowerCase();
  if (value.startsWith("zh")) return "zh-Hant" as const;
  if (value.startsWith("ja")) return "ja" as const;
  return "en" as const;
}

function eventId(task: AsymptaTaskState, revision: number, suffix: string) {
  return `${task.taskId}:event:${revision}:${suffix}`;
}

function readContract(task: AsymptaTaskState): AsymptaRequirementContractSnapshot | null {
  const candidate = Reflect.get(task, "requirementContract");
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
  const id = Reflect.get(candidate, "id");
  const version = Reflect.get(candidate, "version");
  const requiredSemantics = Reflect.get(candidate, "requiredSemantics");
  if (typeof id !== "string" || version !== "asympta.requirement-contract/0.1" || !Array.isArray(requiredSemantics)) return null;
  return candidate as AsymptaRequirementContractSnapshot;
}

function attachContract(
  task: AsymptaTaskState,
  snapshot: AsymptaRequirementContractSnapshot,
): ManagedTaskState {
  const next = cloneTask(task);
  next.requirementContract = snapshot;
  next.events = next.events.map((event) => event.kind === "requirements_compiled"
    ? {
        ...event,
        data: {
          ...(event.data ?? {}),
          requirementContractId: snapshot.id,
          requirementContractVersion: snapshot.version,
          requiredSemantics: snapshot.requiredSemantics,
          synthesizedFields: snapshot.synthesizedFields,
        },
      }
    : event);
  return next;
}

function ensureContract(task: AsymptaTaskState) {
  const existing = readContract(task);
  if (existing) return { task: cloneTask(task), snapshot: existing };
  const compiled = compileRequirementContract({
    rootIntent: task.rootIntent.raw,
    domain: task.domain,
    actionFamily: task.actionFamily,
    missingFields: task.requirements.map((requirement) => requirement.raw),
  });
  return { task: attachContract(task, compiled.snapshot), snapshot: compiled.snapshot };
}

function removePrematureCompletionEvents(events: AsymptaTaskEvent[]) {
  return events.filter((event) => event.kind !== "task_completed");
}

function blockInvalidCompletion(
  task: ManagedTaskState,
  snapshot: AsymptaRequirementContractSnapshot,
  missingSemantics: string[],
) {
  const next = cloneTask(task);
  const revision = next.revision + 1;
  const at = new Date().toISOString();
  const copy = COPY[normalizedLocale(next)][snapshot.proposalKind === "procurement" ? "procurement" : "coordination"];
  const missing = missingSemantics.length ? missingSemantics : snapshot.requiredSemantics;
  next.revision = revision;
  next.phase = "blocked";
  next.failure = {
    code: "requirement_contract_incomplete",
    message: copy.blockedSummary,
  };
  next.result = {
    completed: false,
    simulated: next.mode !== "live",
    summary: copy.blockedSummary,
    value: {
      requirementContract: snapshot,
      missingSemantics: missing,
    },
    verification: {
      status: "not_verified",
      criteria: {
        requirementSetPresent: next.requirements.length > 0,
        requirementContractSatisfied: false,
        realSideEffectNotClaimed: true,
      },
      details: copy.blockedSummary,
    },
    completedAt: at,
  };
  next.events = [
    ...removePrematureCompletionEvents(next.events),
    {
      id: eventId(next, revision, "contract-blocked"),
      taskId: next.taskId,
      revision,
      kind: "task_failed",
      actorId: "requirement-contract-gate",
      summary: copy.blockedSummary,
      data: {
        requirementContractId: snapshot.id,
        missingSemantics: missing,
      },
      at,
    },
  ];
  next.updatedAt = at;
  return next;
}

function proposalRoutes(kind: AsymptaRequirementContractSnapshot["proposalKind"]) {
  if (kind === "procurement") {
    return [
      { id: "request_for_quote", status: "simulated", realAvailabilityClaimed: false },
      { id: "qualified_supplier_search", status: "simulated", realAvailabilityClaimed: false },
      { id: "broker_or_marketplace_search", status: "simulated", realAvailabilityClaimed: false },
    ];
  }
  return [
    { id: "capability_discovery", status: "simulated", realAvailabilityClaimed: false },
    { id: "service_or_agent_matching", status: "simulated", realAvailabilityClaimed: false },
    { id: "bounded_handoff", status: "simulated", realAvailabilityClaimed: false },
  ];
}

function simulatedProposalPlan(
  task: AsymptaTaskState,
  snapshot: AsymptaRequirementContractSnapshot,
  at: string,
): AsymptaTaskPlan {
  const procurement = snapshot.proposalKind === "procurement";
  const copy = COPY[normalizedLocale(task)][procurement ? "procurement" : "coordination"];
  return {
    id: `${task.taskId}:plan:${procurement ? "generic-procurement" : "generic-coordination"}`,
    summary: copy.planSummary,
    steps: [
      {
        id: `${task.taskId}:plan-step:contract`,
        title: "Resolve the requirement contract",
        ownerAgentId: "intent-interpreter",
        capability: "requirements.resolve",
        status: "completed",
      },
      {
        id: `${task.taskId}:plan-step:capability`,
        title: procurement ? "Prepare simulated acquisition routes" : "Prepare simulated capability routes",
        ownerAgentId: "general-capability-agent",
        capability: procurement ? "procurement.propose" : "capability.discover",
        status: "completed",
      },
      {
        id: `${task.taskId}:plan-step:verify`,
        title: "Verify the proposal and no-side-effect boundary",
        ownerAgentId: "independent-verifier",
        capability: "task.verify",
        status: "completed",
      },
    ],
    proposal: {
      requirementContract: snapshot,
      intent: task.rootIntent.raw,
      confirmedRequirements: requirementFacts(task),
      routes: proposalRoutes(snapshot.proposalKind),
      executionBoundary: "simulated_proposal_only",
    },
    createdBy: "requirement-contract-gate",
    createdAt: at,
  };
}

function finalizeSimulatedProposal(task: ManagedTaskState, snapshot: AsymptaRequirementContractSnapshot) {
  const alreadyManaged = task.evidence.some((evidence) => evidence.source === "requirement-contract-gate");
  if (alreadyManaged) return task;

  const next = cloneTask(task);
  const revision = next.revision + 1;
  const at = new Date().toISOString();
  const procurement = snapshot.proposalKind === "procurement";
  const copy = COPY[normalizedLocale(next)][procurement ? "procurement" : "coordination"];
  const routes = proposalRoutes(snapshot.proposalKind);
  const evidence = {
    id: `${next.taskId}:evidence:requirement-contract:${revision}`,
    source: "requirement-contract-gate",
    kind: procurement ? "offer_set" : "tool_result",
    summary: copy.proposalEvidence,
    simulated: true,
    verified: true,
    value: {
      requirementContract: snapshot,
      intent: next.rootIntent.raw,
      confirmedRequirements: requirementFacts(next),
      routes,
      realVendorClaimed: false,
      realPriceClaimed: false,
      realInventoryClaimed: false,
      realSideEffectClaimed: false,
    },
    createdAt: at,
  } satisfies AsymptaTaskEvidence;

  next.revision = revision;
  next.phase = "completed";
  next.plan = simulatedProposalPlan(next, snapshot, at);
  next.evidence = [...next.evidence, evidence];
  next.failure = null;
  next.result = {
    completed: true,
    simulated: true,
    summary: copy.resultSummary,
    value: {
      requirementContract: snapshot,
      confirmedRequirements: requirementFacts(next),
      simulatedRoutes: routes,
      priorAgentResult: task.result?.value ?? null,
    },
    verification: {
      status: "verified",
      criteria: {
        ...(task.result?.verification.criteria ?? {}),
        requirementSetPresent: next.requirements.length > 0,
        requirementContractSatisfied: true,
        substantiveProposalPresent: true,
        realSideEffectNotClaimed: true,
      },
      details: copy.verificationDetails,
    },
    completedAt: at,
  };
  next.events = [
    ...removePrematureCompletionEvents(next.events),
    {
      id: eventId(next, revision, "contract-completed"),
      taskId: next.taskId,
      revision,
      kind: "task_completed",
      actorId: "requirement-contract-gate",
      summary: copy.resultSummary,
      data: {
        requirementContractId: snapshot.id,
        proposalKind: snapshot.proposalKind,
        simulated: true,
        realSideEffectClaimed: false,
      },
      at,
    },
  ];
  next.updatedAt = at;
  return next;
}

function enforceManagedTerminalState(task: AsymptaTaskState) {
  const managed = ensureContract(task);
  if (managed.task.phase !== "completed" || !managed.task.result?.completed) return managed.task;

  const missingSemantics = missingContractSemantics(managed.task, managed.snapshot);
  if (managed.task.requirements.length === 0 || missingSemantics.length > 0) {
    return blockInvalidCompletion(managed.task, managed.snapshot, missingSemantics);
  }

  if (managed.task.mode === "live") {
    return blockInvalidCompletion(managed.task, managed.snapshot, ["connected_executor_evidence"]);
  }

  if (managed.snapshot.completionMode === "simulated_proposal") {
    return finalizeSimulatedProposal(managed.task, managed.snapshot);
  }

  return managed.task;
}

export function createAsymptaTask(input: CreateAsymptaTaskInput) {
  const compiled = compileRequirementContract(input);
  const task = createCoreAsymptaTask({
    ...input,
    missingFields: compiled.missingFields,
  });
  return enforceManagedTerminalState(attachContract(task, compiled.snapshot));
}

export function answerTaskRequirement(task: AsymptaTaskState, command: AnswerRequirementCommand) {
  const current = ensureContract(task);
  const next = answerCoreTaskRequirement(current.task, command);
  return enforceManagedTerminalState(attachContract(next, current.snapshot));
}

export function approveAsymptaTask(task: AsymptaTaskState, command: ApproveTaskCommand) {
  const current = ensureContract(task);
  const next = approveCoreAsymptaTask(current.task, command);
  return enforceManagedTerminalState(attachContract(next, current.snapshot));
}

export function cancelAsymptaTask(task: AsymptaTaskState, command: CancelTaskCommand) {
  const current = ensureContract(task);
  const next = cancelCoreAsymptaTask(current.task, command);
  return attachContract(next, current.snapshot);
}
