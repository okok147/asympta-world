"use client";

import { useEffect } from "react";

function setNativeInputValue(input: HTMLInputElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  descriptor?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function clearScenarioInput() {
  const input = document.querySelector<HTMLInputElement>('.need-composer input[aria-label="What do you need?"]');
  if (!input || input.value === "") return;
  setNativeInputValue(input, "");
}

export function ScenarioInputCleanupRuntime() {
  useEffect(() => {
    const onProcess = (event: Event) => {
      const detail = (event as CustomEvent<{ label?: string; progress?: number }>).detail;
      if (!detail?.label) return;
      const scenarioEnded = detail.label === "Scenario 完成" || detail.label === "Scenario 暫停";
      if (!scenarioEnded) return;
      window.requestAnimationFrame(clearScenarioInput);
    };

    window.addEventListener("asympta:user-task-process", onProcess);
    return () => window.removeEventListener("asympta:user-task-process", onProcess);
  }, []);

  return null;
}
