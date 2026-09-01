import {
  taskApprovalCopy,
  taskIsWriteIntent,
} from "./asympta-task-policy.ts";
import type {
  AsymptaAgentPatch,
  AsymptaTaskAssignment,
  AsymptaTaskEvidence,
  AsymptaTaskOutcome,
  AsymptaTaskPlan,
  AsymptaTaskState,
} from "./asympta-task-kernel-types.ts";

const TV_PATTERN = /(?:\btv\b|\btelevision\b|smart\s*tv|電視機?|电视机?|テレビ)/iu;
const EVENT_PATTERN = /(?:concert|show|performance|ticket|演唱會|演唱会|音樂會|音乐会|門票|门票|公演|チケット)/iu;
const CINEMA_PATTERN = /(?:\bmovies?\b|\bfilms?\b|\bcinema\b|movie\s*tickets?|電影|电影|戲院|戏院|影院|映画|映画館)/iu;

function nowIso(value?: string | number | Date) {
  return new Date(value ?? Date.now()).toISOString();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function requirementFacts(task: AsymptaTaskState) {
  return Object.fromEntries(task.requirements
    .filter((requirement) => requirement.status !== "unknown" && requirement.value !== undefined)
    .map((requirement) => [requirement.key, requirement.value]));
}

function safeEvidence(input: Omit<AsymptaTaskEvidence, "id" | "createdAt">, task: AsymptaTaskState, suffix: string) {
  return {
    ...input,
    id: `${task.taskId}:evidence:${suffix}:${task.evidence.length + 1}`,
    createdAt: nowIso(),
  } satisfies AsymptaTaskEvidence;
}

function specialistAgentId(task: AsymptaTaskState) {
  const text = `${task.domain} ${task.actionFamily} ${task.rootIntent.raw}`;
  if (TV_PATTERN.test(text)) return "commerce-electronics-specialist";
  if (CINEMA_PATTERN.test(text)) return "cinema-planning-specialist";
  if (EVENT_PATTERN.test(text)) return "event-discovery-specialist";
  return "general-domain-specialist";
}

export function taskIsWriteAction(task: AsymptaTaskState) {
  return taskIsWriteIntent({ actionFamily: task.actionFamily, intent: task.rootIntent.raw });
}

export function taskHasApprovedApproval(task: AsymptaTaskState) {
  return task.approvals.some((approval) => approval.status === "approved");
}

export function initialAgentAssignments(task: AsymptaTaskState, at = nowIso()): AsymptaTaskAssignment[] {
  const scope = task.requirements.map((requirement) => requirement.id);
  const specialist = specialistAgentId(task);
  return [
    {
      id: `${task.taskId}:assignment:intent-interpreter`,
      agentId: "intent-interpreter",
      role: "interpreter",
      capability: "intent.interpret",
      scopeRequirementIds: scope,
      depth: 0,
      status: "queued",
      createdAt: at,
    },
    {
      id: `${task.taskId}:assignment:${specialist}`,
      agentId: specialist,
      role: "specialist",
      capability: TV_PATTERN.test(task.rootIntent.raw)
        ? "commerce.consumer_electronics.plan"
        : CINEMA_PATTERN.test(`${task.domain} ${task.rootIntent.raw}`)
          ? "cinema.showtime.plan"
        : EVENT_PATTERN.test(task.rootIntent.raw)
          ? "events.discovery.plan"
          : "domain.plan",
      scopeRequirementIds: scope,
      depth: 0,
      status: "queued",
      createdAt: at,
    },
  ];
}

export function agentIdForCapability(capability: string, task: AsymptaTaskState) {
  if (capability === "retail.offer_search") return "retailer-search-agent";
  if (capability === "logistics.delivery_planning") return "logistics-agent";
  if (capability === "events.performance_search") return "performance-search-agent";
  if (capability === "cinema.showtime_search") return "cinema-showtime-agent";
  if (capability === "capability.discover") return "general-capability-agent";
  if (capability === "task.verify") return "independent-verifier";
  if (capability === "execution.perform") return "transaction-coordinator";
  if (capability === "domain.plan") return specialistAgentId(task);
  return "general-capability-agent";
}

export function createDelegatedAssignment(input: {
  task: AsymptaTaskState;
  capability: string;
  role: AsymptaTaskAssignment["role"];
  scopeRequirementIds: string[];
  depth: number;
  at?: string;
}) {
  const agentId = agentIdForCapability(input.capability, input.task);
  const suffix = input.task.assignments.filter((assignment) => assignment.agentId === agentId).length + 1;
  return {
    id: `${input.task.taskId}:assignment:${agentId}:${suffix}`,
    agentId,
    role: input.role,
    capability: input.capability,
    scopeRequirementIds: [...new Set(input.scopeRequirementIds)],
    depth: input.depth,
    status: "queued",
    createdAt: input.at ?? nowIso(),
  } satisfies AsymptaTaskAssignment;
}

function interpreterPatch(task: AsymptaTaskState, assignment: AsymptaTaskAssignment): AsymptaAgentPatch {
  const resolved = task.requirements.filter((requirement) => requirement.status !== "unknown");
  return {
    taskId: task.taskId,
    baseRevision: task.revision,
    assignmentId: assignment.id,
    agentId: assignment.agentId,
    operations: [
      {
        op: "add_evidence",
        evidence: safeEvidence({
          source: assignment.agentId,
          kind: "interpretation",
          summary: `Interpreted the original intention into ${task.requirements.length} atomic requirement${task.requirements.length === 1 ? "" : "s"}.`,
          simulated: task.mode !== "live",
          verified: true,
          value: {
            domain: task.domain,
            actionFamily: task.actionFamily,
            resolvedRequirementIds: resolved.map((requirement) => requirement.id),
            completion: task.completion,
          },
        }, task, "interpretation"),
      },
      { op: "complete_assignment" },
    ],
  };
}

function televisionPlan(task: AsymptaTaskState, assignment: AsymptaTaskAssignment): AsymptaAgentPatch {
  const facts = requirementFacts(task);
  const deliveryRequirements = task.requirements
    .filter((requirement) => ["delivery_location", "fulfilment", "destination"].includes(requirement.key)
      || /delivery|送貨|送货|配送/u.test(requirement.semantic))
    .map((requirement) => requirement.id);
  const plan = {
    id: `${task.taskId}:plan:television`,
    summary: "Compare suitable televisions from confirmed requirements, prepare fulfilment, execute the approved choice and verify the outcome.",
    steps: [
      {
        id: `${task.taskId}:plan-step:offers`,
        title: "Discover matching television offers",
        ownerAgentId: "retailer-search-agent",
        capability: "retail.offer_search",
        status: "queued",
      },
      {
        id: `${task.taskId}:plan-step:delivery`,
        title: "Prepare delivery or pickup route",
        ownerAgentId: "logistics-agent",
        capability: "logistics.delivery_planning",
        status: "queued",
      },
      {
        id: `${task.taskId}:plan-step:execute`,
        title: "Execute after the policy gate",
        ownerAgentId: "transaction-coordinator",
        capability: "execution.perform",
        status: "queued",
      },
      {
        id: `${task.taskId}:plan-step:verify`,
        title: "Verify the recorded outcome",
        ownerAgentId: "independent-verifier",
        capability: "task.verify",
        status: "queued",
      },
    ],
    proposal: {
      category: "television",
      confirmedConstraints: facts,
      completion: task.completion,
    },
    createdBy: assignment.agentId,
    createdAt: nowIso(),
  } satisfies AsymptaTaskPlan;

  const operations: AsymptaAgentPatch["operations"] = [
    { op: "add_plan", plan },
    {
      op: "request_delegation",
      capability: "retail.offer_search",
      role: "researcher",
      scopeRequirementIds: task.requirements.map((requirement) => requirement.id),
    },
  ];
  if (deliveryRequirements.length) {
    operations.push({
      op: "request_delegation",
      capability: "logistics.delivery_planning",
      role: "coordinator",
      scopeRequirementIds: deliveryRequirements,
    });
  }
  operations.push({ op: "complete_assignment" });
  return {
    taskId: task.taskId,
    baseRevision: task.revision,
    assignmentId: assignment.id,
    agentId: assignment.agentId,
    operations,
  };
}

function eventPlan(task: AsymptaTaskState, assignment: AsymptaTaskAssignment): AsymptaAgentPatch {
  const plan = {
    id: `${task.taskId}:plan:event`,
    summary: "Discover matching performances, execute only after the policy gate, then verify a recorded outcome.",
    steps: [
      {
        id: `${task.taskId}:plan-step:performances`,
        title: "Search matching performances",
        ownerAgentId: "performance-search-agent",
        capability: "events.performance_search",
        status: "queued",
      },
      {
        id: `${task.taskId}:plan-step:execute`,
        title: "Execute after the policy gate",
        ownerAgentId: "transaction-coordinator",
        capability: "execution.perform",
        status: "queued",
      },
      {
        id: `${task.taskId}:plan-step:verify`,
        title: "Verify the selected performance and recorded outcome",
        ownerAgentId: "independent-verifier",
        capability: "task.verify",
        status: "queued",
      },
    ],
    proposal: {
      category: "event_ticket",
      confirmedConstraints: requirementFacts(task),
      completion: task.completion,
    },
    createdBy: assignment.agentId,
    createdAt: nowIso(),
  } satisfies AsymptaTaskPlan;
  return {
    taskId: task.taskId,
    baseRevision: task.revision,
    assignmentId: assignment.id,
    agentId: assignment.agentId,
    operations: [
      { op: "add_plan", plan },
      {
        op: "request_delegation",
        capability: "events.performance_search",
        role: "researcher",
        scopeRequirementIds: task.requirements.map((requirement) => requirement.id),
      },
      { op: "complete_assignment" },
    ],
  };
}

function cinemaPlan(task: AsymptaTaskState, assignment: AsymptaTaskAssignment): AsymptaAgentPatch {
  const plan = {
    id: `${task.taskId}:plan:cinema`,
    summary: "Match the confirmed movie, cinema area, showtime and ticket quantity, then verify the simulated outing plan.",
    steps: [
      {
        id: `${task.taskId}:plan-step:showtimes`,
        title: "Find matching simulated cinema showtimes",
        ownerAgentId: "cinema-showtime-agent",
        capability: "cinema.showtime_search",
        status: "queued",
      },
      {
        id: `${task.taskId}:plan-step:execute`,
        title: "Coordinate the selected simulated outing",
        ownerAgentId: "transaction-coordinator",
        capability: "execution.perform",
        status: "queued",
      },
      {
        id: `${task.taskId}:plan-step:verify`,
        title: "Verify the recorded cinema outcome",
        ownerAgentId: "independent-verifier",
        capability: "task.verify",
        status: "queued",
      },
    ],
    proposal: {
      category: "cinema_outing",
      confirmedConstraints: requirementFacts(task),
      completion: task.completion,
    },
    createdBy: assignment.agentId,
    createdAt: nowIso(),
  } satisfies AsymptaTaskPlan;
  return {
    taskId: task.taskId,
    baseRevision: task.revision,
    assignmentId: assignment.id,
    agentId: assignment.agentId,
    operations: [
      { op: "add_plan", plan },
      {
        op: "request_delegation",
        capability: "cinema.showtime_search",
        role: "researcher",
        scopeRequirementIds: task.requirements.map((requirement) => requirement.id),
      },
      { op: "complete_assignment" },
    ],
  };
}

function generalPlan(task: AsymptaTaskState, assignment: AsymptaTaskAssignment): AsymptaAgentPatch {
  const plan = {
    id: `${task.taskId}:plan:general`,
    summary: "Discover a compatible capability, coordinate it, execute through the policy gate and verify a recorded outcome.",
    steps: [
      {
        id: `${task.taskId}:plan-step:discover`,
        title: "Discover the best matching capability",
        ownerAgentId: "general-capability-agent",
        capability: "capability.discover",
        status: "queued",
      },
      {
        id: `${task.taskId}:plan-step:execute`,
        title: "Execute after the policy gate",
        ownerAgentId: "transaction-coordinator",
        capability: "execution.perform",
        status: "queued",
      },
      {
        id: `${task.taskId}:plan-step:verify`,
        title: "Verify the result against the completion contract",
        ownerAgentId: "independent-verifier",
        capability: "task.verify",
        status: "queued",
      },
    ],
    proposal: {
      domain: task.domain,
      actionFamily: task.actionFamily,
      confirmedConstraints: requirementFacts(task),
      completion: task.completion,
    },
    createdBy: assignment.agentId,
    createdAt: nowIso(),
  } satisfies AsymptaTaskPlan;
  return {
    taskId: task.taskId,
    baseRevision: task.revision,
    assignmentId: assignment.id,
    agentId: assignment.agentId,
    operations: [
      { op: "add_plan", plan },
      {
        op: "request_delegation",
        capability: "capability.discover",
        role: "researcher",
        scopeRequirementIds: task.requirements.map((requirement) => requirement.id),
      },
      { op: "complete_assignment" },
    ],
  };
}

function retailerPatch(task: AsymptaTaskState, assignment: AsymptaTaskAssignment): AsymptaAgentPatch {
  const facts = requirementFacts(task);
  const size = facts.screen_size ?? facts.size ?? "agent_choice";
  const brand = facts.brand ?? facts.brand_preference ?? "no_preference";
  const purpose = facts.purpose ?? "general_use";
  const candidates = [
    { id: "simulated-best-match", tier: "best_match", size, brand, purpose },
    { id: "simulated-value-option", tier: "balanced_value", size, brand: "agent_choice", purpose },
    { id: "simulated-premium-option", tier: "premium", size, brand, purpose },
  ];
  return {
    taskId: task.taskId,
    baseRevision: task.revision,
    assignmentId: assignment.id,
    agentId: assignment.agentId,
    operations: [
      { op: "set_phase", phase: "discovering", summary: "Retailer agents are discovering matching offers." },
      {
        op: "add_evidence",
        evidence: safeEvidence({
          source: assignment.agentId,
          kind: "offer_set",
          summary: "Produced a bounded simulated offer set from confirmed television constraints.",
          simulated: true,
          verified: true,
          value: { candidates, constraints: facts },
        }, task, "offers"),
      },
      { op: "complete_assignment" },
    ],
  };
}

function logisticsPatch(task: AsymptaTaskState, assignment: AsymptaTaskAssignment): AsymptaAgentPatch {
  const facts = requirementFacts(task);
  const destination = facts.delivery_location ?? facts.fulfilment ?? facts.destination ?? "saved_home";
  return {
    taskId: task.taskId,
    baseRevision: task.revision,
    assignmentId: assignment.id,
    agentId: assignment.agentId,
    operations: [
      { op: "set_phase", phase: "coordinating", summary: "The logistics agent is preparing fulfilment." },
      {
        op: "add_evidence",
        evidence: safeEvidence({
          source: assignment.agentId,
          kind: "delivery_plan",
          summary: "Prepared a simulated fulfilment route without exposing a private address or creating a real shipment.",
          simulated: true,
          verified: true,
          value: { destination, addressDisclosure: "deferred_until_execution" },
        }, task, "delivery"),
      },
      { op: "complete_assignment" },
    ],
  };
}

function performancePatch(task: AsymptaTaskState, assignment: AsymptaTaskAssignment): AsymptaAgentPatch {
  return {
    taskId: task.taskId,
    baseRevision: task.revision,
    assignmentId: assignment.id,
    agentId: assignment.agentId,
    operations: [
      { op: "set_phase", phase: "discovering", summary: "The event agent is discovering matching performances." },
      {
        op: "add_evidence",
        evidence: safeEvidence({
          source: assignment.agentId,
          kind: "offer_set",
          summary: "Prepared simulated performance choices; no real inventory or ticket availability is claimed.",
          simulated: true,
          verified: true,
          value: { intent: task.rootIntent.raw, confirmedConstraints: requirementFacts(task) },
        }, task, "performances"),
      },
      { op: "complete_assignment" },
    ],
  };
}

function cinemaShowtimePatch(task: AsymptaTaskState, assignment: AsymptaTaskAssignment): AsymptaAgentPatch {
  const constraints = requirementFacts(task);
  const choices = [
    { id: "simulated-cinema-best-fit", fit: "best_match", constraints },
    { id: "simulated-cinema-earlier", fit: "earlier_showtime", constraints },
    { id: "simulated-cinema-nearby", fit: "nearby_cinema", constraints },
  ];
  return {
    taskId: task.taskId,
    baseRevision: task.revision,
    assignmentId: assignment.id,
    agentId: assignment.agentId,
    operations: [
      { op: "set_phase", phase: "discovering", summary: "The cinema agent is matching the confirmed outing preferences." },
      {
        op: "add_evidence",
        evidence: safeEvidence({
          source: assignment.agentId,
          kind: "offer_set",
          summary: "Prepared bounded simulated cinema choices; no real screening or ticket availability is claimed.",
          simulated: true,
          verified: true,
          value: { choices, constraints },
        }, task, "cinema-showtimes"),
      },
      { op: "complete_assignment" },
    ],
  };
}

function capabilityDiscoveryPatch(task: AsymptaTaskState, assignment: AsymptaTaskAssignment): AsymptaAgentPatch {
  return {
    taskId: task.taskId,
    baseRevision: task.revision,
    assignmentId: assignment.id,
    agentId: assignment.agentId,
    operations: [
      { op: "set_phase", phase: "discovering", summary: "The capability agent is finding a compatible bounded route." },
      {
        op: "add_evidence",
        evidence: safeEvidence({
          source: assignment.agentId,
          kind: "tool_result",
          summary: "Discovered a compatible simulated capability route for the requested domain.",
          simulated: true,
          verified: true,
          value: {
            capability: `${task.domain}.${task.actionFamily}`,
            connectedExecutor: false,
            proposalReady: true,
          },
        }, task, "capability"),
      },
      { op: "complete_assignment" },
    ],
  };
}

function executionPatch(task: AsymptaTaskState, assignment: AsymptaTaskAssignment): AsymptaAgentPatch {
  const approved = task.approvals.find((approval) => approval.status === "approved");
  if (task.completion.requiresApproval && !approved) {
    const copy = taskApprovalCopy({ title: task.title, locale: task.rootIntent.locale });
    return {
      taskId: task.taskId,
      baseRevision: task.revision,
      assignmentId: assignment.id,
      agentId: assignment.agentId,
      operations: [
        {
          op: "request_approval",
          approval: {
            id: `${task.taskId}:approval:consequential-action`,
            kind: taskIsWriteAction(task) ? "external_commitment" : "live_write",
            status: "pending",
            prompt: copy.prompt,
            consequence: copy.consequence,
            requestedAt: nowIso(),
          },
        },
        { op: "complete_assignment" },
      ],
    };
  }

  const receiptId = `${task.taskId}:receipt:${task.assignments.filter((candidate) => candidate.agentId === assignment.agentId).length}`;
  if (task.mode === "simulated") {
    const at = nowIso();
    const outcome = {
      id: `${task.taskId}:outcome`,
      kind: task.completion.outcomeKind,
      status: "completed",
      simulated: true,
      provider: "asympta-simulated-world",
      summary: `Completed the approved ${task.actionFamily} inside the simulated Asympta world.`,
      ...(approved ? { approvalId: approved.id } : {}),
      receiptId,
      value: {
        rootIntent: task.rootIntent.raw,
        actionFamily: task.actionFamily,
        confirmedRequirements: requirementFacts(task),
        planId: task.plan?.id ?? null,
      },
      createdAt: at,
      updatedAt: at,
    } satisfies AsymptaTaskOutcome;
    return {
      taskId: task.taskId,
      baseRevision: task.revision,
      assignmentId: assignment.id,
      agentId: assignment.agentId,
      operations: [
        { op: "set_phase", phase: "executing", summary: "The approved action is being executed inside the simulated world." },
        {
          op: "add_evidence",
          evidence: safeEvidence({
            source: assignment.agentId,
            kind: "receipt",
            summary: outcome.summary,
            simulated: true,
            verified: true,
            value: {
              receiptId,
              status: "completed",
              actionFamily: task.actionFamily,
              approvalId: approved?.id ?? null,
            },
          }, task, "receipt"),
        },
        { op: "set_outcome", outcome },
        { op: "complete_assignment" },
      ],
    };
  }

  const connectedExecution = task.evidence.find((evidence) => {
    const value = asRecord(evidence.value);
    return evidence.kind === "tool_result"
      && evidence.verified
      && value?.connectedExecutor === true
      && value.executionCompleted === true;
  });
  if (connectedExecution) {
    const at = nowIso();
    const outcome = {
      id: `${task.taskId}:outcome`,
      kind: "external_action",
      status: "completed",
      simulated: false,
      provider: connectedExecution.source,
      summary: `The connected executor completed the approved ${task.actionFamily}.`,
      ...(approved ? { approvalId: approved.id } : {}),
      receiptId,
      value: connectedExecution.value,
      createdAt: at,
      updatedAt: at,
    } satisfies AsymptaTaskOutcome;
    return {
      taskId: task.taskId,
      baseRevision: task.revision,
      assignmentId: assignment.id,
      agentId: assignment.agentId,
      operations: [
        {
          op: "add_evidence",
          evidence: safeEvidence({
            source: connectedExecution.source,
            kind: "receipt",
            summary: outcome.summary,
            simulated: false,
            verified: true,
            value: { receiptId, connectedEvidenceId: connectedExecution.id },
          }, task, "receipt"),
        },
        { op: "set_outcome", outcome },
        { op: "complete_assignment" },
      ],
    };
  }

  const at = nowIso();
  return {
    taskId: task.taskId,
    baseRevision: task.revision,
    assignmentId: assignment.id,
    agentId: assignment.agentId,
    operations: [
      {
        op: "set_outcome",
        outcome: {
          id: `${task.taskId}:outcome`,
          kind: "external_action",
          status: "waiting_external",
          simulated: false,
          provider: "capability-router",
          summary: "Waiting for a compatible connected executor; the task remains active and will retry.",
          ...(approved ? { approvalId: approved.id } : {}),
          value: { actionFamily: task.actionFamily, rootIntent: task.rootIntent.raw },
          createdAt: task.outcome?.createdAt ?? at,
          updatedAt: at,
        },
      },
      {
        op: "report_obstacle",
        code: "connected_executor_unavailable",
        message: "No compatible connected executor is available yet; keep the task active and retry capability discovery.",
        retryAfterMs: 3_000,
      },
      { op: "complete_assignment" },
    ],
  };
}

function verifierPatch(task: AsymptaTaskState, assignment: AsymptaTaskAssignment): AsymptaAgentPatch {
  const unresolved = task.requirements.filter((requirement) => requirement.required && requirement.status === "unknown");
  const humanFactsPreserved = task.requirements
    .filter((requirement) => requirement.lockedBy === "human")
    .every((requirement) => requirement.status === "confirmed" && requirement.provenance?.source === "human_confirmation");
  const assignmentsBounded = task.assignments.length <= task.limits.maxAssignments
    && task.assignments.every((candidate) => candidate.depth <= task.limits.maxDelegationDepth);
  const planPresent = task.plan !== null;
  const delegatedWorkComplete = task.assignments
    .filter((candidate) => candidate.id !== assignment.id)
    .every((candidate) => ["completed", "cancelled"].includes(candidate.status));
  const approvalSatisfied = !task.completion.requiresApproval || taskHasApprovedApproval(task);
  const outcomeCompleted = task.outcome?.status === "completed";
  const receiptPresent = !task.completion.requiresReceipt || Boolean(
    task.outcome?.receiptId
      && task.evidence.some((evidence) => evidence.kind === "receipt"
        && evidence.verified
        && asRecord(evidence.value)?.receiptId === task.outcome?.receiptId),
  );
  const criteria = {
    requirementsResolved: unresolved.length === 0,
    humanFactsPreserved,
    assignmentsBounded,
    planPresent,
    delegatedWorkComplete,
    approvalSatisfied,
    outcomeCompleted,
    receiptPresent,
  };
  const verified = Object.values(criteria).every(Boolean);

  if (!verified) {
    const missing = Object.entries(criteria).filter(([, ok]) => !ok).map(([key]) => key);
    return {
      taskId: task.taskId,
      baseRevision: task.revision,
      assignmentId: assignment.id,
      agentId: assignment.agentId,
      operations: [
        {
          op: "report_obstacle",
          code: "completion_contract_incomplete",
          message: `The task remains active because its completion contract still needs: ${missing.join(", ")}.`,
          retryAfterMs: task.outcome?.status === "waiting_external" ? 3_000 : 0,
        },
        { op: "complete_assignment" },
      ],
    };
  }

  const details = task.mode === "live"
    ? "The connected outcome, approval boundary, receipt and every required fact were independently verified."
    : "The simulated outcome, approval boundary, receipt and every required fact were independently verified.";
  const resultSummary = task.outcome?.summary ?? `Completed ${task.title}.`;
  return {
    taskId: task.taskId,
    baseRevision: task.revision,
    assignmentId: assignment.id,
    agentId: assignment.agentId,
    operations: [
      { op: "set_phase", phase: "verifying", summary: "The independent verifier is checking the recorded outcome." },
      {
        op: "add_evidence",
        evidence: safeEvidence({
          source: assignment.agentId,
          kind: "verification",
          summary: details,
          simulated: task.mode !== "live",
          verified: true,
          value: { criteria, outcomeId: task.outcome?.id ?? null },
        }, task, "verification"),
      },
      {
        op: "set_result",
        result: {
          completed: true,
          simulated: task.mode !== "live",
          summary: resultSummary,
          value: {
            plan: task.plan,
            outcome: task.outcome,
            confirmedRequirements: requirementFacts(task),
            agentIds: task.assignments.map((candidate) => candidate.agentId),
          },
          verification: {
            status: "verified",
            criteria,
            details,
          },
          completedAt: nowIso(),
        },
      },
      { op: "complete_assignment" },
    ],
  };
}

export function runLogicalAgent(task: AsymptaTaskState, assignment: AsymptaTaskAssignment): AsymptaAgentPatch {
  switch (assignment.agentId) {
    case "intent-interpreter":
      return interpreterPatch(task, assignment);
    case "commerce-electronics-specialist":
      return televisionPlan(task, assignment);
    case "event-discovery-specialist":
      return eventPlan(task, assignment);
    case "cinema-planning-specialist":
      return cinemaPlan(task, assignment);
    case "general-domain-specialist":
      return generalPlan(task, assignment);
    case "retailer-search-agent":
      return retailerPatch(task, assignment);
    case "logistics-agent":
      return logisticsPatch(task, assignment);
    case "performance-search-agent":
      return performancePatch(task, assignment);
    case "cinema-showtime-agent":
      return cinemaShowtimePatch(task, assignment);
    case "general-capability-agent":
      return capabilityDiscoveryPatch(task, assignment);
    case "transaction-coordinator":
      return executionPatch(task, assignment);
    case "independent-verifier":
      return verifierPatch(task, assignment);
    default:
      return {
        taskId: task.taskId,
        baseRevision: task.revision,
        assignmentId: assignment.id,
        agentId: assignment.agentId,
        operations: [
          {
            op: "report_obstacle",
            code: "unknown_agent",
            message: `No logical agent is registered for ${assignment.agentId}; reroute the assignment instead of terminating the task.`,
            retryAfterMs: 0,
          },
          { op: "complete_assignment" },
        ],
      };
  }
}
