import type { ReactNode } from "react";

import { AgentStatusColorBridge } from "@/components/agent-status-color-bridge";
import { AgentTaskMenu } from "@/components/agent-task-menu";
import { BusinessWorkflowRuntime } from "@/components/business-workflow-runtime";
import { ContinuousAgentMotion } from "@/components/continuous-agent-motion";
import { LatentCityRuntime } from "@/components/latent-city-runtime";
import { MinimalWorldPresentation } from "@/components/minimal-world-presentation";
import { MissionSocietyRuntime } from "@/components/mission-society-runtime";
import { SemanticDialogueLabels } from "@/components/semantic-dialogue-labels";
import { UserAgentAura } from "@/components/user-agent-aura";

export default function WorldTemplate({ children }: { children: ReactNode }) {
  return (
    <>
      <MinimalWorldPresentation />
      <LatentCityRuntime />
      <UserAgentAura />
      <AgentStatusColorBridge />
      <ContinuousAgentMotion />
      <BusinessWorkflowRuntime />
      <MissionSocietyRuntime />
      <AgentTaskMenu />
      <SemanticDialogueLabels />
      {children}
    </>
  );
}
