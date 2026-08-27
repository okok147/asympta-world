import type { ReactNode } from "react";

import { BusinessWorkflowRuntime } from "@/components/business-workflow-runtime";
import { ContinuousAgentMotion } from "@/components/continuous-agent-motion";
import { MissionSocietyRuntime } from "@/components/mission-society-runtime";

export default function WorldTemplate({ children }: { children: ReactNode }) {
  return (
    <>
      <ContinuousAgentMotion />
      <BusinessWorkflowRuntime />
      <MissionSocietyRuntime />
      {children}
    </>
  );
}
