"use client";

import { useEffect, useState } from "react";

import { UnifiedAgentInterfaceRuntime } from "@/components/unified-agent-interface-runtime";

export function ClientUnifiedAgentInterface() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return mounted ? <UnifiedAgentInterfaceRuntime /> : null;
}
