import type { ReactNode } from "react";

import { BusinessWorldRuntime } from "@/components/business-world-runtime";

export default function WorldTemplate({ children }: { children: ReactNode }) {
  return (
    <>
      <BusinessWorldRuntime />
      {children}
    </>
  );
}
