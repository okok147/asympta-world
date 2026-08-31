import { AsymptaAgentCardLocale } from "@/components/asympta-agent-card-locale";
import { AsymptaBlockActivity } from "@/components/asympta-block-activity";
import { AsymptaCalmDefaults } from "@/components/asympta-calm-defaults";
import { AsymptaCuteAgentVisibility } from "@/components/asympta-cute-agent-visibility";
import { AsymptaEscalationGuard } from "@/components/asympta-escalation-guard";
import { AsymptaEstimatedProgress } from "@/components/asympta-estimated-progress";
import { AsymptaGlobalLocale } from "@/components/asympta-global-locale";
import { AsymptaGlobalWorld } from "@/components/asympta-global-world";
import { AsymptaIntentComposer } from "@/components/asympta-intent-composer";
import { AsymptaJobMode } from "@/components/asympta-job-mode";
import { AsymptaMarketplaceIntentBridge } from "@/components/asympta-marketplace-intent-bridge";
import { AsymptaMarketplaceIntentRouter } from "@/components/asympta-marketplace-intent-router";
import { AsymptaPaperMapTone } from "@/components/asympta-paper-map-tone";
import { AsymptaProcessCameraFollow } from "@/components/asympta-process-camera-follow";
import { AsymptaSafeSchedule } from "@/components/asympta-safe-schedule";
import { AsymptaTaskCelebration } from "@/components/asympta-task-celebration";
import { AsymptaUltraCalm } from "@/components/asympta-ultra-calm";
import { AsymptaUserPreferences } from "@/components/asympta-user-preferences";
import { AsymptaWebMcpTools } from "@/components/asympta-webmcp-tools";
import { AsymptaWorldLive60Hz } from "@/components/asympta-world-live-60hz";

export default function HomePage() {
  return (
    <>
      <AsymptaWorldLive60Hz />
      <AsymptaCuteAgentVisibility />
      <AsymptaGlobalWorld />
      <AsymptaMarketplaceIntentRouter />
      <AsymptaIntentComposer />
      <AsymptaMarketplaceIntentBridge />
      <AsymptaUserPreferences />
      <AsymptaEscalationGuard />
      <AsymptaJobMode />
      <AsymptaWebMcpTools />
      <AsymptaPaperMapTone />
      <AsymptaBlockActivity />
      <AsymptaSafeSchedule />
      <AsymptaEstimatedProgress />
      <AsymptaProcessCameraFollow />
      <AsymptaTaskCelebration />
      <AsymptaCalmDefaults />
      <AsymptaUltraCalm />
      <AsymptaAgentCardLocale />
      <AsymptaGlobalLocale />
    </>
  );
}
