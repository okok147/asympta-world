import {
  answerTaskRequirement,
  approveAsymptaTask,
  cancelAsymptaTask,
  createAsymptaTask,
  isAsymptaTaskState,
  taskToAdaptiveInteractionSchema,
} from "./asympta-task-kernel.ts";
import type { AdaptiveInteractionSchema } from "./asympta-adaptive-interaction.ts";
import type {
  AnswerRequirementCommand,
  ApproveTaskCommand,
  AsymptaTaskKernelEventDetail,
  AsymptaTaskKernelUpdateReason,
  AsymptaTaskState,
  CancelTaskCommand,
  CreateAsymptaTaskInput,
} from "./asympta-task-kernel-types.ts";

export const ASYMPTA_TASK_KERNEL_EVENT = "asympta:task-kernel" as const;
const STORAGE_KEY = "asympta.task-kernel.v1";
const MAX_PERSISTED_TASKS = 8;

type TaskListener = (detail: AsymptaTaskKernelEventDetail) => void;

function cloneTask(task: AsymptaTaskState): AsymptaTaskState {
  if (typeof structuredClone === "function") return structuredClone(task);
  return JSON.parse(JSON.stringify(task)) as AsymptaTaskState;
}

function terminal(task: AsymptaTaskState) {
  return ["completed", "cancelled", "blocked", "failed"].includes(task.phase);
}

export type AsymptaTaskKernelBrowserBridge = {
  createFromClarification: (input: CreateAsymptaTaskInput) => AsymptaTaskState;
  answerRequirement: (command: AnswerRequirementCommand) => AsymptaTaskState;
  approve: (command: ApproveTaskCommand) => AsymptaTaskState;
  cancel: (command: CancelTaskCommand) => AsymptaTaskState;
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
  private activeTaskId: string | null = null;

  constructor() {
    this.restore();
  }

  private restore() {
    if (typeof window === "undefined") return;
    try {
      const parsed = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) ?? "null") as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return;
      const record = parsed as { activeTaskId?: unknown; tasks?: unknown };
      const tasks = Array.isArray(record.tasks) ? record.tasks : [];
      for (const candidate of tasks) {
        if (!isAsymptaTaskState(candidate)) continue;
        const task = cloneTask(candidate);
        this.tasks.set(task.taskId, task);
        if (task.activityId) this.activityIndex.set(task.activityId, task.taskId);
      }
      if (typeof record.activeTaskId === "string" && this.tasks.has(record.activeTaskId)) {
        this.activeTaskId = record.activeTaskId;
      }
    } catch {
      window.sessionStorage.removeItem(STORAGE_KEY);
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

  private commit(reason: AsymptaTaskKernelUpdateReason, task: AsymptaTaskState, previous: AsymptaTaskState | null) {
    const snapshot = cloneTask(task);
    this.tasks.set(snapshot.taskId, snapshot);
    if (snapshot.activityId) this.activityIndex.set(snapshot.activityId, snapshot.taskId);
    if (!terminal(snapshot)) this.activeTaskId = snapshot.taskId;
    else if (this.activeTaskId === snapshot.taskId) this.activeTaskId = snapshot.taskId;
    this.persist();
    this.notify(reason, snapshot, previous);
    return cloneTask(snapshot);
  }

  createFromClarification(input: CreateAsymptaTaskInput) {
    const activityId = input.activityId?.trim() || null;
    if (activityId) {
      const existingId = this.activityIndex.get(activityId);
      const existing = existingId ? this.tasks.get(existingId) : null;
      if (existing && existing.rootIntent.raw === input.rootIntent.trim() && !terminal(existing)) {
        this.activeTaskId = existing.taskId;
        return cloneTask(existing);
      }
    }
    const task = createAsymptaTask(input);
    return this.commit("created", task, null);
  }

  answerRequirement(command: AnswerRequirementCommand) {
    const current = this.tasks.get(command.taskId);
    if (!current) throw new Error(`Task ${command.taskId} was not found.`);
    const next = answerTaskRequirement(current, command);
    if (next === current) return cloneTask(current);
    return this.commit("answered", next, current);
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
