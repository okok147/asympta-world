import {
  advanceAsymptaTask,
  answerTaskRequirement,
  approveAsymptaTask,
  cancelAsymptaTask,
  createAsymptaTask,
  migrateAsymptaTaskState,
  taskToAdaptiveInteractionSchema,
} from "./asympta-managed-task-kernel.ts";
import type { AdaptiveInteractionSchema } from "./asympta-adaptive-interaction.ts";
import {
  activeTaskWorldTask,
  taskWorldCompletionSummary,
  taskWorldProgressPhase,
  taskWorldSnapshotBelongsToTask,
  type TaskWorldWorkflowSnapshot,
} from "./asympta-task-world-workflow.ts";
import type {
  AnswerRequirementCommand,
  ApproveTaskCommand,
  AsymptaTaskKernelEventDetail,
  AsymptaTaskKernelUpdateReason,
  AsymptaTaskState,
  CancelTaskCommand,
  CreateAsymptaTaskInput,
} from "./asympta-task-kernel-types.ts";
import type { AtlasWorkflowDefinition } from "./atlas-simulation.ts";

export const ASYMPTA_TASK_KERNEL_EVENT = "asympta:task-kernel" as const;
const STORAGE_KEY = "asympta.task-kernel.v2";
const LEGACY_STORAGE_KEY = "asympta.task-kernel.v1";
const MAX_PERSISTED_TASKS = 8;

type TaskListener = (detail: AsymptaTaskKernelEventDetail) => void;

function cloneTask(task: AsymptaTaskState): AsymptaTaskState {
  if (typeof structuredClone === "function") return structuredClone(task);
  return JSON.parse(JSON.stringify(task)) as AsymptaTaskState;
}

function terminal(task: AsymptaTaskState) {
  return task.phase === "completed" || task.phase === "cancelled";
}

function taskChanged(left: AsymptaTaskState, right: AsymptaTaskState) {
  return left.revision !== right.revision
    || left.phase !== right.phase
    || left.liveness.state !== right.liveness.state
    || left.liveness.nextAttemptAt !== right.liveness.nextAttemptAt;
}

function worldWorkflowActive(task: AsymptaTaskState) {
  return Boolean(task.worldWorkflow && task.worldWorkflow.status !== "completed");
}

function appendWorldEvent(
  task: AsymptaTaskState,
  kind: "phase_changed" | "outcome_recorded" | "task_completed",
  actorId: string,
  summary: string,
  data?: Record<string, unknown>,
) {
  task.events.push({
    id: `${task.taskId}:event:${task.events.length + 1}`,
    taskId: task.taskId,
    revision: task.revision,
    kind,
    actorId,
    summary,
    ...(data ? { data } : {}),
    at: task.updatedAt,
  });
}

export type AsymptaTaskKernelBrowserBridge = {
  createFromClarification: (input: CreateAsymptaTaskInput) => AsymptaTaskState;
  answerRequirement: (command: AnswerRequirementCommand) => AsymptaTaskState;
  approve: (command: ApproveTaskCommand) => AsymptaTaskState;
  cancel: (command: CancelTaskCommand) => AsymptaTaskState;
  resume: (taskId: string) => AsymptaTaskState | null;
  getTask: (taskId: string) => AsymptaTaskState | null;
  getTaskByActivity: (activityId: string) => AsymptaTaskState | null;
  activeTask: () => AsymptaTaskState | null;
  schema: (taskId: string) => AdaptiveInteractionSchema | null;
};

declare global {
  interface Window {
    __ASYMPTA_TASK_KERNEL__?: AsymptaTaskKernelBrowserBridge;
  }
}

export class BrowserAsymptaTaskKernel {
  private readonly tasks = new Map<string, AsymptaTaskState>();
  private readonly activityIndex = new Map<string, string>();
  private readonly listeners = new Set<TaskListener>();
  private readonly resumeTimers = new Map<string, number>();
  private activeTaskId: string | null = null;

  constructor() {
    this.restore();
    if (typeof window !== "undefined") {
      queueMicrotask(() => {
        for (const task of this.tasks.values()) this.scheduleResume(task);
      });
    }
  }

  private restore() {
    if (typeof window === "undefined") return;
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY)
        ?? window.sessionStorage.getItem(LEGACY_STORAGE_KEY)
        ?? "null";
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return;
      const record = parsed as { activeTaskId?: unknown; tasks?: unknown };
      const tasks = Array.isArray(record.tasks) ? record.tasks : [];
      for (const candidate of tasks) {
        const task = migrateAsymptaTaskState(candidate);
        if (!task) continue;
        this.tasks.set(task.taskId, task);
        if (task.activityId) this.activityIndex.set(task.activityId, task.taskId);
      }
      if (typeof record.activeTaskId === "string" && this.tasks.has(record.activeTaskId)) {
        this.activeTaskId = record.activeTaskId;
      }
      window.sessionStorage.removeItem(LEGACY_STORAGE_KEY);
      this.persist();
    } catch {
      window.sessionStorage.removeItem(STORAGE_KEY);
      window.sessionStorage.removeItem(LEGACY_STORAGE_KEY);
    }
  }

  private persist() {
    if (typeof window === "undefined") return;
    const tasks = [...this.tasks.values()]
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, MAX_PERSISTED_TASKS)
      .map(cloneTask);
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      activeTaskId: this.activeTaskId,
      tasks,
    }));
  }

  private notify(reason: AsymptaTaskKernelUpdateReason, task: AsymptaTaskState, previous: AsymptaTaskState | null) {
    const detail: AsymptaTaskKernelEventDetail = {
      reason,
      task: cloneTask(task),
      previous: previous ? cloneTask(previous) : null,
    };
    for (const listener of this.listeners) listener(detail);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent<AsymptaTaskKernelEventDetail>(ASYMPTA_TASK_KERNEL_EVENT, { detail }));
    }
  }

  private clearResume(taskId: string) {
    if (typeof window === "undefined") return;
    const timer = this.resumeTimers.get(taskId);
    if (timer !== undefined) window.clearTimeout(timer);
    this.resumeTimers.delete(taskId);
  }

  private scheduleResume(task: AsymptaTaskState) {
    if (typeof window === "undefined") return;
    const current = this.tasks.get(task.taskId) ?? task;
    this.clearResume(current.taskId);
    if (terminal(current) || current.phase === "awaiting_human" || current.phase === "awaiting_approval" || worldWorkflowActive(current)) return;
    const requestedAt = current.liveness.nextAttemptAt
      ? new Date(current.liveness.nextAttemptAt).getTime()
      : Date.now();
    const delay = Math.min(30_000, Math.max(10, requestedAt - Date.now()));
    const timer = window.setTimeout(() => {
      this.resumeTimers.delete(task.taskId);
      this.resume(task.taskId);
    }, delay);
    this.resumeTimers.set(current.taskId, timer);
  }

  private commit(reason: AsymptaTaskKernelUpdateReason, task: AsymptaTaskState, previous: AsymptaTaskState | null) {
    const snapshot = cloneTask(task);
    this.tasks.set(snapshot.taskId, snapshot);
    if (snapshot.activityId) this.activityIndex.set(snapshot.activityId, snapshot.taskId);
    this.activeTaskId = snapshot.taskId;
    this.persist();
    this.notify(reason, snapshot, previous);
    this.scheduleResume(snapshot);
    return cloneTask(snapshot);
  }

  createFromClarification(input: CreateAsymptaTaskInput) {
    const activityId = input.activityId?.trim() || null;
    if (activityId) {
      const existingId = this.activityIndex.get(activityId);
      const existing = existingId ? this.tasks.get(existingId) : null;
      if (existing && existing.rootIntent.raw === input.rootIntent.trim()) {
        this.activeTaskId = existing.taskId;
        this.scheduleResume(existing);
        return cloneTask(existing);
      }
    }
    const task = createAsymptaTask(input);
    return this.commit("created", task, null);
  }

  answerRequirement(command: AnswerRequirementCommand) {
    const current = this.tasks.get(command.taskId);
    if (!current) throw new Error(`Task ${command.taskId} was not found.`);
    // Browser tasks pause at planning so the visible Atlas world can own the
    // execution. Server-side callers retain the core's automatic continuation.
    const next = answerTaskRequirement(current, { ...command, deferCoordination: true });
    if (next === current) return cloneTask(current);
    const committed = this.commit("answered", next, current);
    return this.getTask(command.taskId) ?? committed;
  }

  approve(command: ApproveTaskCommand) {
    const current = this.tasks.get(command.taskId);
    if (!current) throw new Error(`Task ${command.taskId} was not found.`);
    const next = approveAsymptaTask(current, command);
    if (next === current) return cloneTask(current);
    return this.commit("approval", next, current);
  }

  cancel(command: CancelTaskCommand) {
    const current = this.tasks.get(command.taskId);
    if (!current) throw new Error(`Task ${command.taskId} was not found.`);
    const next = cancelAsymptaTask(current, command);
    if (next === current) return cloneTask(current);
    return this.commit("cancelled", next, current);
  }

  beginWorldWorkflow(taskId: string, workflow: AtlasWorkflowDefinition, runId: string) {
    const current = this.tasks.get(taskId);
    if (!current || terminal(current)) return current ? cloneTask(current) : null;
    if (current.requirements.some((requirement) => requirement.status === "unknown")) return cloneTask(current);
    if (current.completion.requiresApproval || current.completion.requiresReceipt) return cloneTask(current);
    if (current.worldWorkflow?.runId === runId && worldWorkflowActive(current)) return cloneTask(current);

    const next = cloneTask(current);
    next.revision += 1;
    next.updatedAt = new Date().toISOString();
    next.phase = "coordinating";
    next.liveness.state = "waiting_external";
    next.liveness.lastProgressRevision = next.revision;
    next.liveness.lastProgressAt = next.updatedAt;
    delete next.liveness.nextAttemptAt;
    delete next.liveness.obstacle;
    const agentIds = [...new Set(workflow.tasks.map((task) => task.agentId))];
    next.worldWorkflow = {
      driver: "atlas_world",
      workflowId: String(workflow.id),
      runId,
      name: workflow.name,
      status: "queued",
      activeTaskId: null,
      activeTaskTitle: null,
      activeAgentId: null,
      completedTaskCount: 0,
      totalTaskCount: workflow.tasks.length,
      agentIds,
      startedAt: next.updatedAt,
      updatedAt: next.updatedAt,
    };
    next.plan = {
      id: `${next.taskId}:plan:atlas-world`,
      summary: workflow.summary,
      steps: workflow.tasks.map((task) => ({
        id: task.id,
        title: task.title,
        ownerAgentId: task.agentId,
        capability: `atlas.world.${task.id.split("-").at(-1) ?? "coordinate"}`,
        status: "queued",
      })),
      proposal: {
        workflowId: String(workflow.id),
        runId,
        confirmedRequirementIds: next.requirements
          .filter((requirement) => requirement.status !== "unknown")
          .map((requirement) => requirement.id),
      },
      createdBy: "atlas-world-coordinator",
      createdAt: next.updatedAt,
    };
    appendWorldEvent(next, "phase_changed", "agent-operations", workflow.summary, {
      phase: next.phase,
      workflowId: String(workflow.id),
      runId,
    });
    return this.commit("agent_progress", next, current);
  }

  observeWorldWorkflow(taskId: string, snapshot: TaskWorldWorkflowSnapshot) {
    const current = this.tasks.get(taskId);
    if (!current?.worldWorkflow || terminal(current) || !taskWorldSnapshotBelongsToTask(snapshot, current)) {
      return current ? cloneTask(current) : null;
    }
    if (snapshot.phase === "completed") return this.completeWorldWorkflow(taskId, snapshot);

    const active = activeTaskWorldTask(snapshot);
    const completedTaskCount = snapshot.tasks.filter((task) => task.status === "done").length;
    const status = snapshot.phase.startsWith("block")
      ? "blocked"
      : snapshot.phase === "waiting_approval"
        ? "waiting_approval"
        : "running";
    const unchanged = current.worldWorkflow.status === status
      && current.worldWorkflow.activeTaskId === (active?.id ?? null)
      && current.worldWorkflow.completedTaskCount === completedTaskCount;
    if (unchanged) return cloneTask(current);

    const next = cloneTask(current);
    next.revision += 1;
    next.updatedAt = new Date().toISOString();
    next.phase = taskWorldProgressPhase(snapshot);
    next.worldWorkflow = {
      ...current.worldWorkflow,
      status,
      activeTaskId: active?.id ?? null,
      activeTaskTitle: active?.title ?? null,
      activeAgentId: active?.agentId ?? null,
      completedTaskCount,
      updatedAt: next.updatedAt,
    };
    if (next.plan) {
      next.plan.steps = next.plan.steps.map((step) => {
        const observed = snapshot.tasks.find((task) => task.id === step.id);
        return {
          ...step,
          status: observed?.status === "done"
            ? "completed"
            : observed?.status === "blocked"
              ? "blocked"
              : "queued",
        };
      });
    }
    next.liveness.state = "waiting_external";
    next.liveness.lastProgressRevision = next.revision;
    next.liveness.lastProgressAt = next.updatedAt;
    delete next.liveness.nextAttemptAt;
    if (status === "blocked") {
      next.liveness.obstacle = {
        code: "atlas_world_blocked",
        message: "The visible agent workflow is blocked and remains recoverable.",
        recoverable: true,
        at: next.updatedAt,
      };
    } else {
      delete next.liveness.obstacle;
    }
    const summary = active?.title ?? "The visible agent workflow is continuing.";
    appendWorldEvent(next, "phase_changed", active?.agentId ?? "agent-operations", summary, {
      phase: next.phase,
      workflowId: next.worldWorkflow.workflowId,
      activeTaskId: active?.id ?? null,
      completedTaskCount,
      totalTaskCount: next.worldWorkflow.totalTaskCount,
    });
    return this.commit("agent_progress", next, current);
  }

  completeWorldWorkflow(taskId: string, snapshot: TaskWorldWorkflowSnapshot) {
    const current = this.tasks.get(taskId);
    if (!current?.worldWorkflow || terminal(current) || !taskWorldSnapshotBelongsToTask(snapshot, current)) {
      return current ? cloneTask(current) : null;
    }
    const worldWorkflow = current.worldWorkflow;
    const allTasksDone = snapshot.phase === "completed"
      && snapshot.tasks.length === worldWorkflow.totalTaskCount
      && snapshot.tasks.every((task) => task.status === "done");
    if (!allTasksDone || current.completion.requiresApproval || current.completion.requiresReceipt) return cloneTask(current);

    const next = cloneTask(current);
    next.revision += 1;
    next.updatedAt = new Date().toISOString();
    const summary = taskWorldCompletionSummary(next);
    const evidenceId = `${next.taskId}:evidence:atlas-world:${next.evidence.length + 1}`;
    const outcomeId = `${next.taskId}:outcome:atlas-world`;
    next.evidence.push({
      id: evidenceId,
      source: "atlas-world",
      kind: "verification",
      summary,
      simulated: true,
      verified: true,
      value: {
        simulated: true,
        workflowId: worldWorkflow.workflowId,
        runId: worldWorkflow.runId,
        tasks: snapshot.tasks.map((task) => ({ id: task.id, agentId: task.agentId, status: task.status })),
      },
      createdAt: next.updatedAt,
    });
    next.worldWorkflow = {
      ...worldWorkflow,
      status: "completed",
      activeTaskId: null,
      activeTaskTitle: null,
      activeAgentId: null,
      completedTaskCount: snapshot.tasks.length,
      updatedAt: next.updatedAt,
      completedAt: next.updatedAt,
    };
    if (next.plan) {
      next.plan.steps = next.plan.steps.map((step) => ({ ...step, status: "completed" }));
    }
    next.outcome = {
      id: outcomeId,
      kind: next.completion.outcomeKind,
      status: "completed",
      simulated: true,
      provider: "atlas-world",
      summary,
      value: {
        simulated: true,
        workflowId: worldWorkflow.workflowId,
        runId: worldWorkflow.runId,
        verificationEvidenceId: evidenceId,
      },
      createdAt: next.updatedAt,
      updatedAt: next.updatedAt,
    };
    next.result = {
      completed: true,
      simulated: true,
      summary,
      value: next.outcome.value,
      verification: {
        status: "verified",
        criteria: {
          requirementsResolved: next.requirements.every((requirement) => requirement.status !== "unknown"),
          visibleWorkflowCompleted: true,
          everyWorkflowTaskDone: true,
        },
        details: "The visible Atlas workflow completed every task after the required information was confirmed.",
      },
      completedAt: next.updatedAt,
    };
    next.phase = "completed";
    next.failure = null;
    next.liveness.state = "completed";
    next.liveness.lastProgressRevision = next.revision;
    next.liveness.lastProgressAt = next.updatedAt;
    delete next.liveness.nextAttemptAt;
    delete next.liveness.obstacle;
    appendWorldEvent(next, "outcome_recorded", "agent-quality", summary, {
      outcomeId,
      workflowId: worldWorkflow.workflowId,
      simulated: true,
    });
    appendWorldEvent(next, "task_completed", "agent-quality", summary, {
      outcomeId,
      evidenceId,
      workflowId: worldWorkflow.workflowId,
      simulated: true,
    });
    return this.commit("resumed", next, current);
  }

  resume(taskId: string) {
    const current = this.tasks.get(taskId);
    if (!current || terminal(current) || current.phase === "awaiting_human" || current.phase === "awaiting_approval") {
      return current ? cloneTask(current) : null;
    }
    if (worldWorkflowActive(current)) return cloneTask(current);
    const next = advanceAsymptaTask(current);
    if (!taskChanged(current, next)) {
      this.scheduleResume(current);
      return cloneTask(current);
    }
    return this.commit("resumed", next, current);
  }

  getTask(taskId: string) {
    const task = this.tasks.get(taskId);
    return task ? cloneTask(task) : null;
  }

  getTaskByActivity(activityId: string) {
    const taskId = this.activityIndex.get(activityId);
    return taskId ? this.getTask(taskId) : null;
  }

  activeTask() {
    return this.activeTaskId ? this.getTask(this.activeTaskId) : null;
  }

  schema(taskId: string) {
    const task = this.tasks.get(taskId);
    return task ? taskToAdaptiveInteractionSchema(task) : null;
  }

  subscribe(listener: TaskListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  bridge(): AsymptaTaskKernelBrowserBridge {
    return {
      createFromClarification: (input) => this.createFromClarification(input),
      answerRequirement: (command) => this.answerRequirement(command),
      approve: (command) => this.approve(command),
      cancel: (command) => this.cancel(command),
      resume: (taskId) => this.resume(taskId),
      getTask: (taskId) => this.getTask(taskId),
      getTaskByActivity: (activityId) => this.getTaskByActivity(activityId),
      activeTask: () => this.activeTask(),
      schema: (taskId) => this.schema(taskId),
    };
  }
}

let browserKernel: BrowserAsymptaTaskKernel | null = null;

export function getBrowserAsymptaTaskKernel() {
  if (!browserKernel) browserKernel = new BrowserAsymptaTaskKernel();
  return browserKernel;
}
