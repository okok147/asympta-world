"use client";

import { useEffect } from "react";

export function AsymptaAdaptiveOptionMetadata() {
  useEffect(() => {
    const sync = () => {
      const shell = document.querySelector<HTMLElement>("[data-asympta-adaptive-schema]");
      if (!shell) return;
      const firstField = shell.querySelector<HTMLElement>("[data-field]");
      const key = firstField?.dataset.field;
      if (key) shell.dataset.field = key;
      else delete shell.dataset.field;
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-field"] });
    return () => observer.disconnect();
  }, []);

  return null;
}
