import { AsymptaBlockActivity } from "@/components/asympta-block-activity";
import { AsymptaSafeSchedule } from "@/components/asympta-safe-schedule";
import { AsymptaWorldLive60Hz } from "@/components/asympta-world-live-60hz";

export default function HomePage() {
  return (
    <>
      <AsymptaWorldLive60Hz />
      <AsymptaBlockActivity />
      <AsymptaSafeSchedule />
    </>
  );
}
