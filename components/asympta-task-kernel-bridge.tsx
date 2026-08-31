"use client";

import { useEffect } from "react";

import { readAdaptiveActivityIntent } from "@/lib/asympta-adaptive-activity-bridge";
import { missingFieldsFromAdaptiveActivityData } from "@/lib/asympta-adaptive-interaction";
import { getBrowserAsymptaTaskKernel } from "@/lib/asympta-browser-task-kernel";

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

export function AsymptaTaskKernelBridge() {
  useEffect(() => {
    const kernel = getBrowserAsymptaTaskKernel();
    const bridge = kernel.bridge();
    window.__ASYMPTA_TASK_KERNEL__ = bridge;

    const onActivity = (event: Event) => {
      const detail = (event as CustomEvent<ActivityDetail>).detail;
      const status = detail?.event?.status ?? detail?.activity?.status ?? "";
      if (status !== "waiting_input") return;
      const missingFields = missingFieldsFromAdaptiveActivityData(detail?.event?.data);
      const rootIntent = readAdaptiveActivityIntent(detail?.activity);
      if (!rootIntent || !missingFields.length) return;

      const task = kernel.createFromClarification({
        activityId: detail?.activity?.id ?? null,
        rootIntent,
        locale: localeFromActivity(detail?.activity),
        title: rootIntent,
        summary: detail?.event?.summary ?? rootIntent,
        missingFields,
        mode: "simulated",
      });

      if (detail.event) {
        const data = detail.event.data && typeof detail.event.data === "object" && !Array.isArray(detail.event.data)
          ? detail.event.data as Record<string, unknown>
          : {};
        data.taskId = task.taskId;
        data.taskRevision = task.revision;
        data.missingFields = task.requirements
          .filter((requirement) => requirement.status === "unknown")
          .map((requirement) => requirement.raw);
        detail.event.data = data;
      }
    };

    window.addEventListener("asympta:activity", onActivity, { capture: true });
    return () => {
      window.removeEventListener("asympta:activity", onActivity, { capture: true });
      if (window.__ASYMPTA_TASK_KERNEL__ === bridge) delete window.__ASYMPTA_TASK_KERNEL__;
    };
  }, []);

  return null;
}
