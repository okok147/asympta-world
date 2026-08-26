import type { ReactNode } from "react";

import { AutonomousAgentOverlay } from "@/components/autonomous-agent-overlay";

export default function WorldTemplate({ children }: { children: ReactNode }) {
  return (
    <>
      <AutonomousAgentOverlay />
      {children}
    </>
  );
}
