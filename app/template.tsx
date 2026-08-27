import type { ReactNode } from "react";

import { AgentShoppingRouterRuntime } from "@/components/agent-shopping-router-runtime";
import { AgentSpatialInteractionRuntime } from "@/components/agent-spatial-interaction-runtime";
import { AgentStatusColorBridge } from "@/components/agent-status-color-bridge";
import { AgentTaskMenu } from "@/components/agent-task-menu";
import { AnimalAvatarRuntime } from "@/components/animal-avatar-runtime";
import { AsymptaPerceptionSystem } from "@/components/asympta-perception-system";
import { BusinessWorkflowRuntime } from "@/components/business-workflow-runtime";
import { ClientUnifiedAgentInterface } from "@/components/client-unified-agent-interface";
import { CommunityStoreFounderRuntime } from "@/components/community-store-founder-runtime";
import { CommunityV2Runtime } from "@/components/community-v2-runtime";
import { ContinuousAgentMotion } from "@/components/continuous-agent-motion";
import { LatentCityRuntime } from "@/components/latent-city-runtime";
import { MinimalWorldPresentation } from "@/components/minimal-world-presentation";
import { MissionSocietyRuntime } from "@/components/mission-society-runtime";
import { PersistentUserAgentPresence } from "@/components/persistent-user-agent-presence";
import { RealWorldPacingRuntime } from "@/components/real-world-pacing-runtime";
import { SemanticDialogueLabels } from "@/components/semantic-dialogue-labels";
import { TaskProcessRuntime } from "@/components/task-process-runtime";
import { UserAgentAura } from "@/components/user-agent-aura";
import { WebMcpScenarioRuntime } from "@/components/webmcp-scenario-runtime";

export default function WorldTemplate({ children }: { children: ReactNode }) {
  return (
    <>
      <MinimalWorldPresentation />
      <LatentCityRuntime />
      <CommunityV2Runtime />
      <CommunityStoreFounderRuntime />
      <UserAgentAura />
      <AgentStatusColorBridge />
      <ContinuousAgentMotion />
      <BusinessWorkflowRuntime />
      <MissionSocietyRuntime />
      <PersistentUserAgentPresence />
      <AgentTaskMenu />
      <AnimalAvatarRuntime />
      <ClientUnifiedAgentInterface />
      <TaskProcessRuntime />
      <AgentSpatialInteractionRuntime />
      <RealWorldPacingRuntime />
      <AgentShoppingRouterRuntime />
      <WebMcpScenarioRuntime />
      <SemanticDialogueLabels />
      <AsymptaPerceptionSystem />
      {children}
    </>
  );
}
