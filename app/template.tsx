import type { ReactNode } from "react";

import { AgentStatusColorBridge } from "@/components/agent-status-color-bridge";
import { AgentTaskMenu } from "@/components/agent-task-menu";
import { AsymptaPerceptionSystem } from "@/components/asympta-perception-system";
import { BusinessWorkflowRuntime } from "@/components/business-workflow-runtime";
import { ContinuousAgentMotion } from "@/components/continuous-agent-motion";
import { LatentCityRuntime } from "@/components/latent-city-runtime";
import { MinimalWorldPresentation } from "@/components/minimal-world-presentation";
import { MissionSocietyRuntime } from "@/components/mission-society-runtime";
import { PersistentUserAgentPresence } from "@/components/persistent-user-agent-presence";
import { SemanticDialogueLabels } from "@/components/semantic-dialogue-labels";
import { UserAgentAura } from "@/components/user-agent-aura";
import { UserTaskProcessRuntime } from "@/components/user-task-process-runtime";
import { WebMcpScenarioRuntime } from "@/components/webmcp-scenario-runtime";

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
      <PersistentUserAgentPresence />
      <AgentTaskMenu />
      <UserTaskProcessRuntime />
      <WebMcpScenarioRuntime />
      <SemanticDialogueLabels />
      <AsymptaPerceptionSystem />
      {children}
    </>
  );
}
