import type {
  AsymptaAgentPatch,
  AsymptaTaskAssignment,
  AsymptaTaskEvidence,
  AsymptaTaskPlan,
  AsymptaTaskState,
} from "./asympta-task-kernel-types.ts";

const TV_PATTERN = /(?:\btv\b|\btelevision\b|smart\s*tv|電視機?|电视机?|テレビ)/iu;
const EVENT_PATTERN = /(?:concert|show|performance|ticket|演唱會|演唱会|音樂會|音乐会|門票|门票|公演|チケット)/iu;
const WRITE_PATTERN = /(?:buy|purchase|order|book|reserve|send|submit|publish|delete|cancel|pay|transfer|購買|购买|訂購|订购|預訂|预订|付款|提交|購入|注文|予約|支払)/iu;

function nowIso(value?: string | number | Date) {
  return new Date(value ?? Date.now()).toISOString();
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
  if (EVENT_PATTERN.test(text)) return "event-discovery-specialist";
  return "general-domain-specialist";
}

export function taskIsWriteAction(task: AsymptaTaskState) {
  return WRITE_PATTERN.test(`${task.actionFamily} ${task.rootIntent.raw}`);
}

export function initialAgentAssignments(task: AsymptaTaskState, at = nowIso()): AsymptaTaskAssignment[] {
  const scope = task.requirements.map((requirement) => requirement.id);
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
      id: `${task.taskId}:assignment:${specialistAgentId(task)}`,
      agentId: specialistAgentId(task),
      role: "specialist",
      capability: TV_PATTERN.test(task.rootIntent.raw)
        ? "commerce.consumer_electronics.plan"
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
  if (capability === "task.verify") return "independent-verifier";
  if (capability === "execution.coordinate") return "transaction-coordinator";
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
          summary: `Interpreted ${task.rootIntent.raw} into ${task.requirements.length} atomic requirement${task.requirements.length === 1 ? "" : "s"}.`,
          simulated: task.mode !== "live",
          verified: true,
          value: {
            domain: task.domain,
            actionFamily: task.actionFamily,
            resolvedRequirementIds: resolved.map((requirement) => requirement.id),
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
    .filter((requirement) => ["delivery_location", "fulfilment", "destination"].includes(requirement.key) || /delivery|送貨|送货|配送/u.test(requirement.semantic))
    .map((requirement) => requirement.id);
  const plan = {
    id: `${task.taskId}:plan:television`,
    summary: "Compare suitable televisions from confirmed requirements, then prepare fulfilment and independent verification.",
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
        id: `${task.taskId}:plan-step:verify`,
        title: "Verify constraints and completion criteria",
        ownerAgentId: "independent-verifier",
        capability: "task.verify",
        status: "queued",
      },
    ],
    proposal: {
      category: "television",
      confirmedConstraints: facts,
      purchasingBoundary: task.mode === "live" ? "approval_required_before_write" : "simulated_only",
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
  const facts = requirementFacts(task);
  const plan = {
    id: `${task.taskId}:plan:event`,
    summary: "Discover matching performances first, then present bounded choices before any purchase step.",
    steps: [
      {
        id: `${task.taskId}:plan-step:performances`,
        title: "Search matching performances",
        ownerAgentId: "performance-search-agent",
        capability: "events.performance_search",
        status: "queued",
      },
      {
        id: `${task.taskId}:plan-step:verify`,
        title: "Verify the selected performance and purchase boundary",
        ownerAgentId: "independent-verifier",
        capability: "task.verify",
        status: "queued",
      },
    ],
    proposal: {
      category: "event_ticket",
      confirmedConstraints: facts,
      purchasingBoundary: task.mode === "live" ? "approval_required_before_write" : "simulated_only",
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

function generalPlan(task: AsymptaTaskState, assignment: AsymptaTaskAssignment): AsymptaAgentPatch {
  const plan = {
    id: `${task.taskId}:plan:general`,
    summary: "Use confirmed requirements to discover a compatible capability, coordinate it, then verify completion.",
    steps: [
      {
        id: `${task.taskId}:plan-step:coordinate`,
        title: "Coordinate the best matching capability",
        ownerAgentId: "general-capability-agent",
        capability: "execution.coordinate",
        status: "queued",
      },
      {
        id: `${task.taskId}:plan-step:verify`,
        title: "Verify the result against every requirement",
        ownerAgentId: "independent-verifier",
        capability: "task.verify",
        status: "queued",
      },
    ],
    proposal: {
      domain: task.domain,
      actionFamily: task.actionFamily,
      confirmedConstraints: requirementFacts(task),
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
        capability: "execution.coordinate",
        role: "coordinator",
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
          verified: false,
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
          summary: "Prepared a simulated fulfilment route without exposing an address or creating a real shipment.",
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
          verified: false,
          value: { intent: task.rootIntent.raw, confirmedConstraints: requirementFacts(task) },
        }, task, "performances"),
      },
      { op: "complete_assignment" },
    ],
  };
}

function coordinatorPatch(task: AsymptaTaskState, assignment: AsymptaTaskAssignment): AsymptaAgentPatch {
  return {
    taskId: task.taskId,
    baseRevision: task.revision,
    assignmentId: assignment.id,
    agentId: assignment.agentId,
    operations: [
      { op: "set_phase", phase: "coordinating", summary: "The coordinator is joining specialist outputs into one bounded proposal." },
      {
        op: "add_evidence",
        evidence: safeEvidence({
          source: assignment.agentId,
          kind: "tool_result",
          summary: "Joined the confirmed facts and delegated outputs into the canonical task state.",
          simulated: task.mode !== "live",
          verified: true,
          value: { assignmentCount: task.assignments.length, evidenceCount: task.evidence.length },
        }, task, "coordination"),
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
  const criteria = {
    requirementsResolved: unresolved.length === 0,
    humanFactsPreserved,
    assignmentsBounded,
    planPresent,
    delegatedWorkComplete,
  };
  const verified = Object.values(criteria).every(Boolean);

  if (!verified) {
    return {
      taskId: task.taskId,
      baseRevision: task.revision,
      assignmentId: assignment.id,
      agentId: assignment.agentId,
      operations: [
        {
          op: "fail",
          code: "verification_failed",
          message: `Task verification failed: ${Object.entries(criteria).filter(([, ok]) => !ok).map(([key]) => key).join(", ")}.`,
        },
      ],
    };
  }

  if (task.mode === "live" && taskIsWriteAction(task)) {
    const approved = task.approvals.some((approval) => approval.status === "approved");
    if (!approved) {
      return {
        taskId: task.taskId,
        baseRevision: task.revision,
        assignmentId: assignment.id,
        agentId: assignment.agentId,
        operations: [
          {
            op: "request_approval",
            approval: {
              id: `${task.taskId}:approval:live-write`,
              kind: "live_write",
              status: "pending",
              prompt: "Approve the connected external action?",
              consequence: "Approval may create an external commitment. No action has been executed yet.",
              requestedAt: nowIso(),
            },
          },
          { op: "complete_assignment" },
        ],
      };
    }
  }

  const details = task.mode === "live"
    ? "All requirements and approval boundaries were verified. A connected executor is still required for a real side effect."
    : "All required facts, bounded assignments and simulated coordination evidence were verified.";
  return {
    taskId: task.taskId,
    baseRevision: task.revision,
    assignmentId: assignment.id,
    agentId: assignment.agentId,
    operations: [
      { op: "set_phase", phase: "verifying", summary: "The independent verifier is checking the terminal state." },
      {
        op: "add_evidence",
        evidence: safeEvidence({
          source: assignment.agentId,
          kind: "verification",
          summary: details,
          simulated: task.mode !== "live",
          verified: true,
          value: { criteria },
        }, task, "verification"),
      },
      {
        op: "set_result",
        result: {
          completed: task.mode !== "live",
          simulated: task.mode !== "live",
          summary: task.mode === "live"
            ? "The task is fully specified and verified, but no real external action was executed."
            : "The specialist agent mesh completed and verified the task inside the simulated Asympta world.",
          value: {
            plan: task.plan,
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
    case "general-domain-specialist":
      return generalPlan(task, assignment);
    case "retailer-search-agent":
      return retailerPatch(task, assignment);
    case "logistics-agent":
      return logisticsPatch(task, assignment);
    case "performance-search-agent":
      return performancePatch(task, assignment);
    case "transaction-coordinator":
    case "general-capability-agent":
      return coordinatorPatch(task, assignment);
    case "independent-verifier":
      return verifierPatch(task, assignment);
    default:
      return {
        taskId: task.taskId,
        baseRevision: task.revision,
        assignmentId: assignment.id,
        agentId: assignment.agentId,
        operations: [
          { op: "fail", code: "unknown_agent", message: `No logical agent is registered for ${assignment.agentId}.` },
        ],
      };
  }
}
