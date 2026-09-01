"use client";

import { useEffect, useRef } from "react";

import { readAdaptiveActivityIntent } from "@/lib/asympta-adaptive-activity-bridge";
import { missingFieldsFromAdaptiveActivityData } from "@/lib/asympta-adaptive-interaction";
import {
  ASYMPTA_TASK_KERNEL_EVENT,
  getBrowserAsymptaTaskKernel,
} from "@/lib/asympta-browser-task-kernel";
import {
  normalizeTaskWorldWorkflowSnapshot,
  TASK_WORLD_WORKFLOW_ID,
  taskUsesVisibleWorldWorkflow,
  taskWorldSnapshotBelongsToTask,
  taskWorldWorkflowRunId,
  upsertTaskWorldWorkflow,
} from "@/lib/asympta-task-world-workflow";
import type { AsymptaTaskRisk } from "@/lib/asympta-task-kernel-types";
import type { AsymptaTaskKernelEventDetail, AsymptaTaskState } from "@/lib/asympta-task-kernel-types";
import type { WorkflowId } from "@/lib/atlas-simulation";

type ActivityDetail = {
  activity?: {
    id?: string;
    intent?: unknown;
    status?: string;
  };
  event?: {
    status?: string;
    summary?: string;
    data?: unknown;
  };
};

type DemoBridge = {
  snapshot: () => unknown;
  startWorkflow: (workflowId: WorkflowId) => unknown;
};

type ActiveWorldRun = {
  taskId: string;
  runId: string;
  started: boolean;
};

function localeFromActivity(activity: ActivityDetail["activity"]) {
  if (activity?.intent && typeof activity.intent === "object" && !Array.isArray(activity.intent)) {
    const locale = Reflect.get(activity.intent, "locale");
    if (typeof locale === "string") return locale;
  }
  return document.documentElement.lang || "en";
}

function dataRecord(data: unknown) {
  return data && typeof data === "object" && !Array.isArray(data)
    ? data as Record<string, unknown>
    : {};
}

function riskFromData(data: Record<string, unknown>, consequential: boolean): AsymptaTaskRisk {
  const value = data.risk;
  if (value === "none" || value === "low" || value === "medium" || value === "high" || value === "critical") return value;
  return consequential ? "high" : "low";
}

function approvedSimulatedTaskCanUseWorld(task: AsymptaTaskState) {
  return task.mode === "simulated"
    && !["completed", "cancelled"].includes(task.phase)
    && task.worldWorkflow?.status !== "blocked"
    && task.requirements.every((requirement) => requirement.status !== "unknown")
    && (!task.completion.requiresApproval || task.approvals.some((approval) => approval.status === "approved"));
}

function writeTaskMetadata(detail: ActivityDetail, task: ReturnType<ReturnType<typeof getBrowserAsymptaTaskKernel>["getTask"]>) {
  if (!task || !detail.event) return;
  const data = dataRecord(detail.event.data);
  data.taskId = task.taskId;
  data.taskRevision = task.revision;
  data.taskPhase = task.phase;
  data.taskLiveness = task.liveness.state;
  if (task.worldWorkflow) {
    data.workflowId = task.worldWorkflow.workflowId;
    data.workflowRunId = task.worldWorkflow.runId;
    data.workflowStatus = task.worldWorkflow.status;
    data.workflowStage = task.worldWorkflow.activeTaskTitle;
    data.businessJourneyProof = task.worldWorkflow.businessJourneyProof;
  }
  data.missingFields = task.requirements
    .filter((requirement) => requirement.status === "unknown")
    .map((requirement) => requirement.raw);
  if (task.phase === "awaiting_approval") {
    const approval = task.approvals.find((candidate) => candidate.status === "pending");
    data.confirmationRequired = true;
    if (approval) {
      data.approvalId = approval.id;
      data.consequence = approval.consequence;
    }
  }
  detail.event.data = data;
}

export function AsymptaTaskKernelBridge() {
  const activeWorldRunRef = useRef<ActiveWorldRun | null>(null);

  useEffect(() => {
    const kernel = getBrowserAsymptaTaskKernel();
    const bridge = kernel.bridge();
    window.__ASYMPTA_TASK_KERNEL__ = bridge;

    const demoBridge = () => (window as Window & { __ASYMPTA_DEMO__?: DemoBridge }).__ASYMPTA_DEMO__;

    const ensureWorldRun = (task: AsymptaTaskState) => {
      // Read-only / non-consequential tasks use the existing predicate. Approved
      // simulated consequential tasks also enter the SAME visible world after
      // the human boundary, so purchases (including property) cannot disappear
      // into an invisible executor after approval.
      if (!taskUsesVisibleWorldWorkflow(task) && !approvedSimulatedTaskCanUseWorld(task)) return;
      if (task.worldWorkflow?.status === "completed") return;
      const runId = task.worldWorkflow?.runId ?? taskWorldWorkflowRunId(task);
      const existing = activeWorldRunRef.current;
      if (existing?.taskId === task.taskId && existing.runId === runId) return;

      const workflow = upsertTaskWorldWorkflow(task);
      activeWorldRunRef.current = { taskId: task.taskId, runId, started: false };
      kernel.beginWorldWorkflow(task.taskId, workflow, runId);
    };

    const syncWorldRun = () => {
      const run = activeWorldRunRef.current;
      if (!run) return;
      const task = kernel.getTask(run.taskId);
      if (!task || task.phase === "completed" || task.phase === "cancelled") {
        activeWorldRunRef.current = null;
        return;
      }
      const demo = demoBridge();
      if (!demo) return;

      if (!run.started) {
        upsertTaskWorldWorkflow(task);
        const started = normalizeTaskWorldWorkflowSnapshot(demo.startWorkflow(TASK_WORLD_WORKFLOW_ID));
        run.started = true;
        if (started && taskWorldSnapshotBelongsToTask(started, task)) {
          kernel.observeWorldWorkflow(task.taskId, started);
        }
      }

      const latestTask = kernel.getTask(run.taskId);
      if (!latestTask) return;
      const snapshot = normalizeTaskWorldWorkflowSnapshot(demo.snapshot());
      if (!snapshot || !taskWorldSnapshotBelongsToTask(snapshot, latestTask)) {
        run.started = false;
        return;
      }
      if (snapshot.phase === "completed") {
        kernel.completeWorldWorkflow(latestTask.taskId, snapshot);
        activeWorldRunRef.current = null;
        return;
      }
      kernel.observeWorldWorkflow(latestTask.taskId, snapshot);
    };

    const onKernel = (event: Event) => {
      const detail = (event as CustomEvent<AsymptaTaskKernelEventDetail>).detail;
      if (!detail?.task) return;
      ensureWorldRun(detail.task);
      syncWorldRun();
    };

    const onActivity = (event: Event) => {
      const detail = (event as CustomEvent<ActivityDetail>).detail;
      const activityId = detail?.activity?.id ?? "";
      const rootIntent = readAdaptiveActivityIntent(detail?.activity);
      if (!activityId || !rootIntent) return;

      const existing = kernel.getTaskByActivity(activityId);
      if (existing) {
        writeTaskMetadata(detail, existing);
        return;
      }

      const data = dataRecord(detail?.event?.data);
      const status = detail?.event?.status ?? detail?.activity?.status ?? "";
      const missingFields = missingFieldsFromAdaptiveActivityData(data);
      const confirmationRequired = data.confirmationRequired === true
        || typeof data.consequence === "string"
        || typeof data.approvalId === "string";
      const clarificationRequired = status === "waiting_input" && missingFields.length > 0;

      // Action proposals used to bypass the Task Kernel when they had no missing
      // fields. Claim both structured clarification and consequential action events,
      // so the same revisioned task owns planning, confirmation, execution and proof.
      if (!confirmationRequired && !clarificationRequired) return;

      const task = kernel.createFromClarification({
        activityId,
        rootIntent,
        locale: localeFromActivity(detail?.activity),
        title: rootIntent,
        summary: detail?.event?.summary ?? rootIntent,
        missingFields,
        mode: data.taskMode === "live" ? "live" : "simulated",
        risk: riskFromData(data, confirmationRequired),
        confirmationRequired,
      });
      writeTaskMetadata(detail, task);
    };

    window.addEventListener("asympta:activity", onActivity, { capture: true });
    window.addEventListener(ASYMPTA_TASK_KERNEL_EVENT, onKernel);
    const active = kernel.activeTask();
    if (active) ensureWorldRun(active);
    queueMicrotask(syncWorldRun);
    const worldSyncTimer = window.setInterval(syncWorldRun, 240);
    return () => {
      window.clearInterval(worldSyncTimer);
      window.removeEventListener("asympta:activity", onActivity, { capture: true });
      window.removeEventListener(ASYMPTA_TASK_KERNEL_EVENT, onKernel);
      if (window.__ASYMPTA_TASK_KERNEL__ === bridge) delete window.__ASYMPTA_TASK_KERNEL__;
    };
  }, []);

  return null;
}
