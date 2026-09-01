export type AsymptaWorkflowTaskContract = {
  id: string;
  agentId: string;
  locationId: string;
  dependsOn: readonly string[];
  workMs: number;
  requiresApproval?: boolean;
  approvalLabel?: string;
  actionType?: string;
};

export type AsymptaWorkflowDefinitionContract = {
  id: string;
  name?: string;
  tasks: readonly AsymptaWorkflowTaskContract[];
};

export type AsymptaWorkflowContractIssueCode =
  | "missing_workflow_id"
  | "invalid_workflow_id"
  | "empty_workflow"
  | "invalid_task_id"
  | "duplicate_task_id"
  | "invalid_dependency_id"
  | "unknown_dependency"
  | "self_dependency"
  | "dependency_cycle"
  | "invalid_work_duration"
  | "unknown_agent"
  | "unknown_location"
  | "incomplete_approval_contract";

export type AsymptaWorkflowContractIssue = {
  code: AsymptaWorkflowContractIssueCode;
  message: string;
  taskId?: string;
  dependencyId?: string;
};

export type AsymptaWorkflowContractValidation = {
  valid: boolean;
  issues: AsymptaWorkflowContractIssue[];
  roots: string[];
  terminalTasks: string[];
  topologicalOrder: string[];
};

export type AsymptaWorkflowContractOptions = {
  agentIds?: ReadonlySet<string> | readonly string[];
  locationIds?: ReadonlySet<string> | readonly string[];
};

function allowedSet(value: ReadonlySet<string> | readonly string[] | undefined) {
  return value instanceof Set ? value : value ? new Set(value) : null;
}

function canonicalId(value: unknown) {
  return typeof value === "string" && value.length > 0 && value === value.trim();
}

export function validateAsymptaWorkflowContract(
  workflow: AsymptaWorkflowDefinitionContract,
  options: AsymptaWorkflowContractOptions = {},
): AsymptaWorkflowContractValidation {
  const issues: AsymptaWorkflowContractIssue[] = [];
  const tasks = Array.isArray(workflow?.tasks) ? workflow.tasks : [];
  const agentIds = allowedSet(options.agentIds);
  const locationIds = allowedSet(options.locationIds);
  const workflowId = typeof workflow?.id === "string" ? workflow.id : "";

  if (!workflowId.trim()) {
    issues.push({ code: "missing_workflow_id", message: "A workflow requires a stable id." });
  } else if (!canonicalId(workflowId)) {
    issues.push({
      code: "invalid_workflow_id",
      message: "A workflow id must already be canonical and cannot contain surrounding whitespace.",
    });
  }
  if (!tasks.length) {
    issues.push({ code: "empty_workflow", message: "A workflow requires at least one task." });
  }

  const taskById = new Map<string, AsymptaWorkflowTaskContract>();
  for (const task of tasks) {
    const id = typeof task?.id === "string" ? task.id : "";
    if (!canonicalId(id)) {
      issues.push({
        code: "invalid_task_id",
        ...(id ? { taskId: id } : {}),
        message: id
          ? `Task id ${JSON.stringify(id)} is not canonical; surrounding whitespace is not allowed.`
          : "Every workflow task requires a stable id.",
      });
      if (!id) continue;
    }
    if (taskById.has(id)) {
      issues.push({ code: "duplicate_task_id", taskId: id, message: `Task id ${id} is duplicated.` });
      continue;
    }

    // Keep the exact runtime id. Validation never trims or silently normalizes a
    // graph because Atlas compares ids byte-for-byte when resolving dependencies.
    taskById.set(id, task);

    if (!Number.isFinite(task.workMs) || task.workMs <= 0) {
      issues.push({
        code: "invalid_work_duration",
        taskId: id,
        message: `Task ${id} requires a finite positive work duration.`,
      });
    }
    if (agentIds && !agentIds.has(task.agentId)) {
      issues.push({ code: "unknown_agent", taskId: id, message: `Task ${id} references unknown agent ${task.agentId}.` });
    }
    if (locationIds && !locationIds.has(task.locationId)) {
      issues.push({ code: "unknown_location", taskId: id, message: `Task ${id} references unknown location ${task.locationId}.` });
    }
    if (task.requiresApproval && (!task.approvalLabel?.trim() || !task.actionType?.trim())) {
      issues.push({
        code: "incomplete_approval_contract",
        taskId: id,
        message: `Consequential task ${id} requires an approval label and action type.`,
      });
    }
  }

  const dependents = new Map<string, string[]>();
  const indegree = new Map<string, number>();
  for (const id of taskById.keys()) {
    dependents.set(id, []);
    indegree.set(id, 0);
  }

  for (const [id, task] of taskById) {
    const uniqueDependencies = new Set<unknown>(Array.isArray(task.dependsOn) ? task.dependsOn : []);
    for (const dependency of uniqueDependencies) {
      const dependencyId = typeof dependency === "string" ? dependency : "";
      if (!canonicalId(dependencyId)) {
        issues.push({
          code: "invalid_dependency_id",
          taskId: id,
          ...(dependencyId ? { dependencyId } : {}),
          message: dependencyId
            ? `Task ${id} has noncanonical dependency id ${JSON.stringify(dependencyId)}.`
            : `Task ${id} has an empty or invalid dependency id.`,
        });
        continue;
      }
      if (dependencyId === id) {
        issues.push({
          code: "self_dependency",
          taskId: id,
          dependencyId,
          message: `Task ${id} cannot depend on itself.`,
        });
        continue;
      }
      if (!taskById.has(dependencyId)) {
        issues.push({
          code: "unknown_dependency",
          taskId: id,
          dependencyId,
          message: `Task ${id} depends on missing task ${dependencyId}.`,
        });
        continue;
      }
      indegree.set(id, (indegree.get(id) ?? 0) + 1);
      dependents.get(dependencyId)?.push(id);
    }
  }

  const roots = [...indegree.entries()].filter(([, count]) => count === 0).map(([id]) => id);
  const queue = [...roots];
  const topologicalOrder: string[] = [];
  while (queue.length) {
    const id = queue.shift();
    if (!id) continue;
    topologicalOrder.push(id);
    for (const dependentId of dependents.get(id) ?? []) {
      const next = (indegree.get(dependentId) ?? 0) - 1;
      indegree.set(dependentId, next);
      if (next === 0) queue.push(dependentId);
    }
  }

  if (topologicalOrder.length !== taskById.size) {
    const cycleTasks = [...taskById.keys()].filter((id) => !topologicalOrder.includes(id));
    issues.push({
      code: "dependency_cycle",
      message: `Workflow dependency graph contains a cycle involving: ${cycleTasks.join(", ")}.`,
    });
  }

  const terminalTasks = [...taskById.keys()].filter((id) => (dependents.get(id)?.length ?? 0) === 0);
  return {
    valid: issues.length === 0,
    issues,
    roots,
    terminalTasks,
    topologicalOrder,
  };
}

export function assertAsymptaWorkflowContract<T extends AsymptaWorkflowDefinitionContract>(
  workflow: T,
  options: AsymptaWorkflowContractOptions = {},
): T {
  const validation = validateAsymptaWorkflowContract(workflow, options);
  if (!validation.valid) {
    throw new Error(`Invalid Asympta workflow ${workflow.id || "<unknown>"}: ${validation.issues.map((issue) => issue.message).join(" ")}`);
  }
  return workflow;
}

export type AsymptaRuntimeTaskSnapshot = {
  id: string;
  status: string;
  dependsOn?: readonly string[];
  dependencies?: readonly string[];
};

export type AsymptaRuntimeApprovalSnapshot = {
  status?: string;
  taskId?: string | null;
};

export type AsymptaRuntimeWorkflowSnapshot = {
  phase?: string;
  tasks?: readonly AsymptaRuntimeTaskSnapshot[];
  approvals?: readonly AsymptaRuntimeApprovalSnapshot[];
  pendingApprovals?: readonly AsymptaRuntimeApprovalSnapshot[];
};

export type AsymptaWorkflowLivenessState =
  | "idle"
  | "progressing"
  | "ready"
  | "awaiting_approval"
  | "completed"
  | "blocked"
  | "stalled"
  | "invalid";

export type AsymptaWorkflowLiveness = {
  state: AsymptaWorkflowLivenessState;
  activeTaskIds: string[];
  readyTaskIds: string[];
  pendingApprovalTaskIds: string[];
  reason: string;
};

function dependenciesOf(task: AsymptaRuntimeTaskSnapshot) {
  return task.dependsOn ?? task.dependencies ?? [];
}

export function inspectAsymptaWorkflowLiveness(snapshot: AsymptaRuntimeWorkflowSnapshot): AsymptaWorkflowLiveness {
  const tasks = Array.isArray(snapshot.tasks) ? snapshot.tasks : [];
  if (!tasks.length) {
    return {
      state: snapshot.phase === "idle" || !snapshot.phase ? "idle" : "invalid",
      activeTaskIds: [],
      readyTaskIds: [],
      pendingApprovalTaskIds: [],
      reason: snapshot.phase === "idle" || !snapshot.phase ? "No workflow is active." : "An active workflow has no tasks.",
    };
  }

  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const approvals = snapshot.pendingApprovals ?? snapshot.approvals ?? [];
  const pendingApprovalTaskIds = approvals
    .filter((approval) => approval.status === undefined || approval.status === "pending")
    .map((approval) => approval.taskId)
    .filter((taskId): taskId is string => typeof taskId === "string" && taskId.length > 0);
  const activeTaskIds = tasks.filter((task) => ["moving", "working"].includes(task.status)).map((task) => task.id);
  const readyTaskIds = tasks.filter((task) => (
    task.status === "queued"
    && dependenciesOf(task).every((id) => taskById.get(id)?.status === "done")
  )).map((task) => task.id);
  const waitingTaskIds = tasks.filter((task) => task.status === "waiting_approval").map((task) => task.id);
  const allDone = tasks.every((task) => task.status === "done");

  if (snapshot.phase === "completed" || allDone) {
    return {
      state: allDone ? "completed" : "invalid",
      activeTaskIds,
      readyTaskIds,
      pendingApprovalTaskIds,
      reason: allDone ? "Every workflow task is complete." : "The workflow claims completion while tasks remain unfinished.",
    };
  }
  if (snapshot.phase === "blocked" || tasks.some((task) => task.status === "blocked")) {
    return {
      state: "blocked",
      activeTaskIds,
      readyTaskIds,
      pendingApprovalTaskIds,
      reason: "A user decision explicitly stopped this workflow attempt.",
    };
  }
  if (waitingTaskIds.length || pendingApprovalTaskIds.length || snapshot.phase === "waiting_approval") {
    const owned = waitingTaskIds.every((id) => pendingApprovalTaskIds.includes(id));
    return {
      state: owned && pendingApprovalTaskIds.length ? "awaiting_approval" : "invalid",
      activeTaskIds,
      readyTaskIds,
      pendingApprovalTaskIds,
      reason: owned && pendingApprovalTaskIds.length
        ? "The only pause is an explicit human approval checkpoint."
        : "A waiting task is missing its matching approval record.",
    };
  }
  if (activeTaskIds.length) {
    return {
      state: "progressing",
      activeTaskIds,
      readyTaskIds,
      pendingApprovalTaskIds,
      reason: "At least one agent is actively moving or working.",
    };
  }
  if (readyTaskIds.length) {
    return {
      state: "ready",
      activeTaskIds,
      readyTaskIds,
      pendingApprovalTaskIds,
      reason: "Tasks are dependency-ready and should be scheduled on the next engine tick.",
    };
  }
  return {
    state: "stalled",
    activeTaskIds,
    readyTaskIds,
    pendingApprovalTaskIds,
    reason: "No task is active, ready, complete, blocked or waiting for a valid approval.",
  };
}
