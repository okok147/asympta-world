"use client";

import { useEffect } from "react";

const STATE_CLASSES = [
  "agent-state-energy",
  "agent-state-food",
  "agent-state-skill",
  "agent-state-enquiry",
  "agent-state-deal",
  "agent-state-resource",
  "agent-state-workflow",
  "agent-state-status",
];

function dialogueState(node: HTMLElement) {
  const bubble = node.querySelector<HTMLElement>(".business-thought");
  if (!bubble) return "status";
  for (const kind of [
    "energy",
    "food",
    "skill",
    "enquiry",
    "deal",
    "resource",
    "workflow",
    "status",
  ]) {
    if (bubble.classList.contains("business-thought--" + kind)) return kind;
  }
  return "status";
}

function syncAgent(node: HTMLElement) {
  const desired = "agent-state-" + dialogueState(node);
  const current = STATE_CLASSES.find((className) => node.classList.contains(className));
  if (current === desired) return;
  for (const className of STATE_CLASSES) node.classList.remove(className);
  node.classList.add(desired);
}

function syncAllAgents() {
  document.querySelectorAll<HTMLElement>(".world-agent").forEach(syncAgent);
}

export function AgentStatusColorBridge() {
  useEffect(() => {
    let observer: MutationObserver | undefined;
    const initialize = window.setTimeout(() => {
      syncAllAgents();
      const root = document.querySelector<HTMLElement>(".world-plane") ?? document.body;
      observer = new MutationObserver(() => syncAllAgents());
      observer.observe(root, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["class"],
      });
    }, 0);

    return () => {
      window.clearTimeout(initialize);
      observer?.disconnect();
    };
  }, []);

  return null;
}
