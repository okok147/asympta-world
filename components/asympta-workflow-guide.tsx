"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Locale = "en" | "zh-Hant" | "ja";

const COPY: Record<Locale, string> = {
  en: "Choose a workflow",
  "zh-Hant": "選擇工作流",
  ja: "ワークフローを選択",
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
    const sync = () => {
      if (document.hidden) return;
      const workflows = document.querySelector<HTMLElement>(".atlas-workflows");
      setTarget((current) => current === workflows ? current : workflows);
      const nextLocale = locale();
      setLanguage((current) => current === nextLocale ? current : nextLocale);
    };

    const kickoff = window.setTimeout(sync, 0);
    const timer = window.setInterval(sync, 500);
    return () => {
      window.clearTimeout(kickoff);
      window.clearInterval(timer);
    };
  }, []);

  if (!target) return null;
  return createPortal(
    <p className="atlas-workflow-guide" aria-live="polite">{COPY[language]}</p>,
    target,
  );
}
