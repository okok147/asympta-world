import { AsymptaAgentCardLocale } from "@/components/asympta-agent-card-locale";
import { AsymptaBlockActivity } from "@/components/asympta-block-activity";
import { AsymptaCardCollapse } from "@/components/asympta-card-collapse";
import { AsymptaEstimatedProgress } from "@/components/asympta-estimated-progress";
import { AsymptaGlobalLocale } from "@/components/asympta-global-locale";
import { AsymptaPaperMapTone } from "@/components/asympta-paper-map-tone";
import { AsymptaProcessCameraFollow } from "@/components/asympta-process-camera-follow";
import { AsymptaResourceLedger } from "@/components/asympta-resource-ledger";
import { AsymptaSafeSchedule } from "@/components/asympta-safe-schedule";
import { AsymptaScheduleAutomationControls } from "@/components/asympta-schedule-automation-controls";
import { AsymptaScheduleTotalTime } from "@/components/asympta-schedule-total-time";
import { AsymptaTaskCelebration } from "@/components/asympta-task-celebration";
import { AsymptaWebMcpTools } from "@/components/asympta-webmcp-tools";
import { AsymptaWorkflowGuide } from "@/components/asympta-workflow-guide";
import { AsymptaWorldLive60Hz } from "@/components/asympta-world-live-60hz";

export default function HomePage() {
  return (
    <>
      <AsymptaWorldLive60Hz />
      <AsymptaWebMcpTools />
      <AsymptaPaperMapTone />
      <AsymptaBlockActivity />
      <AsymptaSafeSchedule />
      <AsymptaScheduleTotalTime />
      <AsymptaScheduleAutomationControls />
      <AsymptaResourceLedger />
      <AsymptaEstimatedProgress />
      <AsymptaProcessCameraFollow />
      <AsymptaTaskCelebration />
      <AsymptaCardCollapse />
      <AsymptaWorkflowGuide />
      <AsymptaAgentCardLocale />
      <AsymptaGlobalLocale />
    </>
  );
}
