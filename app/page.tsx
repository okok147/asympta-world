import { AsymptaAgentCardLocale } from "@/components/asympta-agent-card-locale";
import { AsymptaBlockActivity } from "@/components/asympta-block-activity";
import { AsymptaEstimatedProgress } from "@/components/asympta-estimated-progress";
import { AsymptaGlobalLocale } from "@/components/asympta-global-locale";
import { AsymptaPaperMapTone } from "@/components/asympta-paper-map-tone";
import { AsymptaProcessCameraFollow } from "@/components/asympta-process-camera-follow";
import { AsymptaSafeSchedule } from "@/components/asympta-safe-schedule";
import { AsymptaScheduleAutomationControls } from "@/components/asympta-schedule-automation-controls";
import { AsymptaTaskCelebration } from "@/components/asympta-task-celebration";
import { AsymptaWorldLive60Hz } from "@/components/asympta-world-live-60hz";

export default function HomePage() {
  return (
    <>
      <AsymptaWorldLive60Hz />
      <AsymptaPaperMapTone />
      <AsymptaBlockActivity />
      <AsymptaSafeSchedule />
      <AsymptaScheduleAutomationControls />
      <AsymptaEstimatedProgress />
      <AsymptaProcessCameraFollow />
      <AsymptaTaskCelebration />
      <AsymptaAgentCardLocale />
      <AsymptaGlobalLocale />
    </>
  );
}
