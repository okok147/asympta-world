import { AsymptaActivityEventContract } from "@/components/asympta-activity-event-contract";
import { AsymptaAdaptiveInteraction } from "@/components/asympta-adaptive-interaction";
import { AsymptaAgentCardLocale } from "@/components/asympta-agent-card-locale";
import { AsymptaBlockActivity } from "@/components/asympta-block-activity";
import { AsymptaCalmDefaults } from "@/components/asympta-calm-defaults";
import { AsymptaCameraFollowControl } from "@/components/asympta-camera-follow-control";
import { AsymptaCompleteLocale } from "@/components/asympta-complete-locale";
import { AsymptaCompletionCoordinator } from "@/components/asympta-completion-coordinator";
import { AsymptaCuteAgentVisibility } from "@/components/asympta-cute-agent-visibility";
import { AsymptaEscalationGuard } from "@/components/asympta-escalation-guard";
import { AsymptaEstimatedProgress } from "@/components/asympta-estimated-progress";
import { AsymptaGlobalLocale } from "@/components/asympta-global-locale";
import { AsymptaGlobalWorld } from "@/components/asympta-global-world";
import { AsymptaIntentComposer } from "@/components/asympta-intent-composer";
import { AsymptaJobMode } from "@/components/asympta-job-mode";
import { AsymptaMarketplaceIntentBridge } from "@/components/asympta-marketplace-intent-bridge";
import { AsymptaMarketplaceIntentRouter } from "@/components/asympta-marketplace-intent-router";
import { AsymptaMarketplacePaymentApproval } from "@/components/asympta-marketplace-payment-approval";
import { AsymptaMarketplaceRecovery } from "@/components/asympta-marketplace-recovery";
import { AsymptaPaperMapTone } from "@/components/asympta-paper-map-tone";
import { AsymptaProcessCameraFollow } from "@/components/asympta-process-camera-follow";
import { AsymptaSafeSchedule } from "@/components/asympta-safe-schedule";
import { AsymptaTaskCelebration } from "@/components/asympta-task-celebration";
import { AsymptaTaskKernelBridge } from "@/components/asympta-task-kernel-bridge";
import { AsymptaTaskKernelLocale } from "@/components/asympta-task-kernel-locale";
import { AsymptaThreeWorldEffects } from "@/components/asympta-three-world-effects";
import { AsymptaTopPanelManager } from "@/components/asympta-top-panel-manager";
import { AsymptaUltraCalm } from "@/components/asympta-ultra-calm";
import { AsymptaUniversalBenchmarkBridge } from "@/components/asympta-universal-benchmark";
import { AsymptaUnsafeProposalRecovery } from "@/components/asympta-unsafe-proposal-recovery";
import { AsymptaUserPreferences } from "@/components/asympta-user-preferences";
import { AsymptaWebMcpTools } from "@/components/asympta-webmcp-tools";
import { AsymptaWorkflowContinuation } from "@/components/asympta-workflow-continuation";
import { AsymptaWorldLive60Hz } from "@/components/asympta-world-live-60hz";

export default function HomePage() {
  return (
    <>
      <AsymptaTaskKernelBridge />
      <AsymptaActivityEventContract />
      <AsymptaWorldLive60Hz />
      <AsymptaThreeWorldEffects />
      <AsymptaWorkflowContinuation />
      <AsymptaCameraFollowControl />
      <AsymptaCuteAgentVisibility />
      <AsymptaGlobalWorld />
      <AsymptaMarketplaceIntentRouter />
      <AsymptaIntentComposer />
      <AsymptaAdaptiveInteraction />
      <AsymptaUniversalBenchmarkBridge />
      <AsymptaUnsafeProposalRecovery />
      <AsymptaMarketplaceIntentBridge />
      <AsymptaMarketplacePaymentApproval />
      <AsymptaMarketplaceRecovery />
      <AsymptaCompletionCoordinator />
      <AsymptaUserPreferences />
      <AsymptaEscalationGuard />
      <AsymptaJobMode />
      <AsymptaWebMcpTools />
      <AsymptaPaperMapTone />
      <AsymptaBlockActivity />
      <AsymptaSafeSchedule />
      <AsymptaTopPanelManager />
      <AsymptaEstimatedProgress />
      <AsymptaProcessCameraFollow />
      <AsymptaTaskCelebration />
      <AsymptaCalmDefaults />
      <AsymptaUltraCalm />
      <AsymptaAgentCardLocale />
      <AsymptaGlobalLocale />
      <AsymptaCompleteLocale />
      <AsymptaTaskKernelLocale />
    </>
  );
}
