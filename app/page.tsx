import { AsymptaAgentCardLocale } from "@/components/asympta-agent-card-locale";
import { AsymptaBlockActivity } from "@/components/asympta-block-activity";
import { AsymptaPaperMapTone } from "@/components/asympta-paper-map-tone";
import { AsymptaSafeSchedule } from "@/components/asympta-safe-schedule";
import { AsymptaWorldLive60Hz } from "@/components/asympta-world-live-60hz";

export default function HomePage() {
  return (
    <>
      <AsymptaWorldLive60Hz />
      <AsymptaPaperMapTone />
      <AsymptaBlockActivity />
      <AsymptaSafeSchedule />
      <AsymptaAgentCardLocale />
    </>
  );
}
