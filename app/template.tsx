import type { ReactNode } from "react";

import { AgentStatusColorBridge } from "@/components/agent-status-color-bridge";
import { BusinessWorkflowRuntime } from "@/components/business-workflow-runtime";
import { ContinuousAgentMotion } from "@/components/continuous-agent-motion";
import { MinimalWorldPresentation } from "@/components/minimal-world-presentation";
import { MissionSocietyRuntime } from "@/components/mission-society-runtime";
import { UserAgentAura } from "@/components/user-agent-aura";

export default function WorldTemplate({ children }: { children: ReactNode }) {
  return (
    <>
      <MinimalWorldPresentation />
      <UserAgentAura />
      <AgentStatusColorBridge />
      <ContinuousAgentMotion />
      <BusinessWorkflowRuntime />
      <MissionSocietyRuntime />
      {children}
    </>
  );
}
