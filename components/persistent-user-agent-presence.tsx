"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const HOME_X = 1085;
const HOME_Y = 665;

export function PersistentUserAgentPresence() {
  const [worldPlane, setWorldPlane] = useState<HTMLElement | null>(null);
  const [needsFallback, setNeedsFallback] = useState(false);

  useEffect(() => {
    const sync = () => {
      const plane = document.querySelector<HTMLElement>(".world-plane");
      if (plane !== worldPlane) setWorldPlane(plane);
      const missionOwned = document.querySelector<HTMLElement>(
        ".mission-user-agent:not([data-presence-fallback])",
      );
      setNeedsFallback(!missionOwned);
    };

    const start = window.setTimeout(sync, 0);
    const timer = window.setInterval(sync, 420);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(timer);
    };
  }, [worldPlane]);

  if (!worldPlane || !needsFallback) return null;

  return createPortal(
    <button
      type="button"
      className="world-agent world-agent--human mission-user-agent persistent-user-agent"
      data-presence-fallback="true"
      style={{ left: HOME_X, top: HOME_Y }}
      aria-label="Your Agent, ready"
      title="Your Agent"
    >
      <span className="agent-portrait mission-agent-portrait">
        <span className="mission-pixel-person" aria-hidden="true" />
        <i aria-hidden="true" />
      </span>
      <span className="agent-label">
        <strong>Your Agent</strong>
        <small>Mission runner</small>
      </span>
    </button>,
    worldPlane,
    "persistent-user-agent-presence",
  );
}
