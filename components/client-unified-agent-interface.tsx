"use client";

import { useEffect, useState } from "react";

import { UnifiedAgentInterfaceRuntime } from "@/components/unified-agent-interface-runtime";

export function ClientUnifiedAgentInterface() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  if (!mounted) return null;

  return (
    <>
      <style>{`
        .agent-task-control > .agent-task-button { order:1; }
        .agent-task-control > .agent-live-status { order:2; }
        .agent-task-control > .agent-task-panel { order:3; }
      `}</style>
      <UnifiedAgentInterfaceRuntime />
    </>
  );
}
