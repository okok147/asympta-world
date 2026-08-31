"use client";

import { useEffect } from "react";

import { readAdaptiveActivityIntent } from "@/lib/asympta-adaptive-activity-bridge";
import { missingFieldsFromAdaptiveActivityData } from "@/lib/asympta-adaptive-interaction";
import { getBrowserAsymptaTaskKernel } from "@/lib/asympta-browser-task-kernel";
import type { AsymptaTaskRisk } from "@/lib/asympta-task-kernel-types";

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

function writeTaskMetadata(detail: ActivityDetail, task: ReturnType<ReturnType<typeof getBrowserAsymptaTaskKernel>["getTask"]>) {
  if (!task || !detail.event) return;
  const data = dataRecord(detail.event.data);
  data.taskId = task.taskId;
  data.taskRevision = task.revision;
  data.taskPhase = task.phase;
  data.taskLiveness = task.liveness.state;
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
  useEffect(() => {
    const kernel = getBrowserAsymptaTaskKernel();
    const bridge = kernel.bridge();
    window.__ASYMPTA_TASK_KERNEL__ = bridge;

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
    return () => {
      window.removeEventListener("asympta:activity", onActivity, { capture: true });
      if (window.__ASYMPTA_TASK_KERNEL__ === bridge) delete window.__ASYMPTA_TASK_KERNEL__;
    };
  }, []);

  return null;
}
