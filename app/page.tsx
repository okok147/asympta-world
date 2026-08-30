import { AsymptaAgentCardLocale } from "@/components/asympta-agent-card-locale";
import { AsymptaBlockActivity } from "@/components/asympta-block-activity";
import { AsymptaCalmDefaults } from "@/components/asympta-calm-defaults";
import { AsymptaCardCollapse } from "@/components/asympta-card-collapse";
import { AsymptaEscalationGuard } from "@/components/asympta-escalation-guard";
import { AsymptaEstimatedProgress } from "@/components/asympta-estimated-progress";
import { AsymptaGlobalLocale } from "@/components/asympta-global-locale";
import { AsymptaGlobalWorld } from "@/components/asympta-global-world";
import { AsymptaJobMode } from "@/components/asympta-job-mode";
import { AsymptaPaperMapTone } from "@/components/asympta-paper-map-tone";
import { AsymptaProcessCameraFollow } from "@/components/asympta-process-camera-follow";
import { AsymptaResourceLedger } from "@/components/asympta-resource-ledger";
import { AsymptaSafeSchedule } from "@/components/asympta-safe-schedule";
import { AsymptaScheduleAutomationControls } from "@/components/asympta-schedule-automation-controls";
import { AsymptaScheduleTotalTime } from "@/components/asympta-schedule-total-time";
import { AsymptaTaskCelebration } from "@/components/asympta-task-celebration";
import { AsymptaUltraCalm } from "@/components/asympta-ultra-calm";
import { AsymptaUserPreferences } from "@/components/asympta-user-preferences";
import { AsymptaWebMcpTools } from "@/components/asympta-webmcp-tools";
import { AsymptaWorkflowEconomy } from "@/components/asympta-workflow-economy";
import { AsymptaWorkflowGuide } from "@/components/asympta-workflow-guide";
import { AsymptaWorldLive60Hz } from "@/components/asympta-world-live-60hz";

export default function HomePage() {
  return (
    <>
      <AsymptaWorldLive60Hz />
      <AsymptaGlobalWorld />
      <AsymptaUserPreferences />
      <AsymptaEscalationGuard />
      <AsymptaJobMode />
      <AsymptaWebMcpTools />
      <AsymptaPaperMapTone />
      <AsymptaBlockActivity />
      <AsymptaSafeSchedule />
      <AsymptaWorkflowEconomy />
      <AsymptaScheduleTotalTime />
      <AsymptaScheduleAutomationControls />
      <AsymptaResourceLedger />
      <AsymptaEstimatedProgress />
      <AsymptaProcessCameraFollow />
      <AsymptaTaskCelebration />
      <AsymptaCardCollapse />
      <AsymptaCalmDefaults />
      <AsymptaUltraCalm />
      <AsymptaWorkflowGuide />
      <AsymptaAgentCardLocale />
      <AsymptaGlobalLocale />
    </>
  );
}
