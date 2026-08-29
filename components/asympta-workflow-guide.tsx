"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Locale = "en" | "zh-Hant" | "ja";

const COPY: Record<Locale, string> = {
  en: "Choose a workflow to run it and follow the active agent",
  "zh-Hant": "點選任一流程開始，鏡頭會跟隨目前執行中的角色",
  ja: "ワークフローを選ぶと開始し、実行中のエージェントを追従します",
};

function locale(): Locale {
  const value = document.documentElement.lang.toLowerCase();
  if (value.startsWith("zh")) return "zh-Hant";
  if (value.startsWith("ja")) return "ja";
  return "en";
}

export function AsymptaWorkflowGuide() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [language, setLanguage] = useState<Locale>("en");

  useEffect(() => {
    let opened = false;
    const sync = () => {
      if (document.hidden) return;
      const workflows = document.querySelector<HTMLElement>(".atlas-workflows");
      setTarget((current) => current === workflows ? current : workflows);
      const nextLocale = locale();
      setLanguage((current) => current === nextLocale ? current : nextLocale);

      if (!opened) {
        const consoleCard = document.querySelector<HTMLElement>(".atlas-console");
        const identity = consoleCard?.querySelector<HTMLButtonElement>(".atlas-menu-identity");
        if (consoleCard && identity) {
          opened = true;
          if (consoleCard.classList.contains("is-collapsed")) identity.click();
          document.documentElement.dataset.asymptaDefaultMenu = "expanded";
        }
      }
    };

    sync();
    const timer = window.setInterval(sync, 500);
    return () => window.clearInterval(timer);
  }, []);

  if (!target) return null;
  return createPortal(
    <p className="atlas-workflow-guide" aria-live="polite">{COPY[language]}</p>,
    target,
  );
}
