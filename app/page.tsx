import { AsymptaRuntimeOverlay } from "@/components/asympta-runtime-overlay";
import { AsymptaWorldLive60Hz } from "@/components/asympta-world-live-60hz";

export default function HomePage() {
  return (
    <>
      <AsymptaWorldLive60Hz />
      <AsymptaRuntimeOverlay />
    </>
  );
}
