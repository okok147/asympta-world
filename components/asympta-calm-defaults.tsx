"use client";

import { useEffect } from "react";

const SYNC_MS = 240;

export function AsymptaCalmDefaults() {
  useEffect(() => {
    document.documentElement.dataset.asymptaCalmUi = "true";
    let scheduleCompacted = false;

    const sync = () => {
      if (document.hidden) return;

      const menu = document.querySelector<HTMLElement>(".atlas-console");
      if (menu?.classList.contains("is-collapsed")) {
        const webMcpToggle = menu.querySelector<HTMLButtonElement>(".atlas-tool-actions button:first-child[aria-expanded='true']");
        webMcpToggle?.click();
      }

      if (scheduleCompacted) return;
      const schedule = document.querySelector<HTMLElement>(".atlas-safe-schedule");
      const header = schedule?.querySelector<HTMLElement>(".atlas-safe-schedule__header[data-asympta-collapse-toggle='schedule']");
      if (!schedule || !header) return;

      if (schedule.dataset.asymptaExpanded === "true") header.click();
      scheduleCompacted = true;
    };

    sync();
    const timer = window.setInterval(sync, SYNC_MS);
    return () => {
      window.clearInterval(timer);
      delete document.documentElement.dataset.asymptaCalmUi;
    };
  }, []);

  return null;
}
