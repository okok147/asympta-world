"use client";

import { ArrowRight, MapPin, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type PendingTerritory = {
  label: string;
  cellId: string;
  places: string;
};

const BYPASS_ATTRIBUTE = "data-territory-confirmed-once";

function markerInfo(marker: HTMLElement): PendingTerritory {
  const label = marker.querySelector("strong")?.textContent?.trim() || "Territory";
  const cellText = marker.querySelector("small")?.textContent?.trim() || "";
  const cellId = cellText.split(" · ")[0] || "unknown cell";
  const places = marker.querySelector("em")?.textContent?.trim() || "No place information yet";
  return { label, cellId, places };
}

export function TerritoryConfirmationRuntime() {
  const markerRef = useRef<HTMLButtonElement | null>(null);
  const [viewport, setViewport] = useState<HTMLElement | null>(null);
  const [pending, setPending] = useState<PendingTerritory | null>(null);

  useEffect(() => {
    const sync = () => {
      const next = document.querySelector<HTMLElement>(".world-viewport");
      setViewport((current) => current === next ? current : next);
    };
    const first = window.setTimeout(sync, 0);
    const timer = window.setInterval(sync, 500);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const intercept = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const marker = target?.closest<HTMLButtonElement>(".territory-marker");
      if (!marker || marker.classList.contains("is-active") || marker.disabled) return;

      if (marker.hasAttribute(BYPASS_ATTRIBUTE)) {
        marker.removeAttribute(BYPASS_ATTRIBUTE);
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      markerRef.current = marker;
      setPending(markerInfo(marker));
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      markerRef.current = null;
      setPending(null);
    };

    document.addEventListener("click", intercept, true);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("click", intercept, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const cancel = () => {
    markerRef.current = null;
    setPending(null);
  };

  const confirm = () => {
    const marker = markerRef.current;
    markerRef.current = null;
    setPending(null);
    if (!marker || !marker.isConnected || marker.disabled) return;
    marker.setAttribute(BYPASS_ATTRIBUTE, "true");
    marker.click();
  };

  if (!viewport || !pending) return null;

  return createPortal(
    <>
      <style>{`
        .territory-confirm-card {
          position:absolute;
          z-index:174;
          left:50%;
          bottom:max(76px,calc(env(safe-area-inset-bottom) + 68px));
          display:grid;
          gap:7px;
          width:min(316px,calc(100vw - 24px));
          padding:10px;
          transform:translateX(-50%);
          border:1px solid rgba(112,126,116,.17);
          border-radius:15px;
          background:rgba(248,247,241,.96);
          box-shadow:0 14px 38px rgba(48,60,52,.11);
          color:#4c5750;
          backdrop-filter:blur(18px);
          pointer-events:auto;
        }
        .territory-confirm-head { display:flex;align-items:flex-start;gap:8px; }
        .territory-confirm-icon { display:grid;place-items:center;width:25px;height:25px;flex:0 0 25px;border-radius:50%;background:rgba(118,139,181,.08);color:#637aa8; }
        .territory-confirm-icon svg { width:12px;height:12px; }
        .territory-confirm-copy { display:grid;gap:2px;min-width:0;flex:1; }
        .territory-confirm-copy strong { font-size:.55rem; }
        .territory-confirm-copy small { overflow:hidden;color:#7e8781;font-family:var(--pixel-font);font-size:.28rem;text-overflow:ellipsis;white-space:nowrap; }
        .territory-confirm-close { display:grid;place-items:center;width:24px;height:24px;padding:0;border:0;border-radius:50%;background:rgba(90,103,94,.05);color:#7b847e;cursor:pointer; }
        .territory-confirm-close svg { width:11px;height:11px; }
        .territory-confirm-question { margin:0;color:#68726c;font-size:.42rem;line-height:1.35; }
        .territory-confirm-actions { display:grid;grid-template-columns:1fr 1fr;gap:6px; }
        .territory-confirm-actions button { min-height:31px;border-radius:9px;font-family:var(--pixel-font);font-size:.3rem;cursor:pointer; }
        .territory-stay { border:1px solid rgba(112,122,114,.12);background:rgba(255,255,255,.2);color:#707a73; }
        .territory-go { display:flex;align-items:center;justify-content:center;gap:5px;border:1px solid rgba(118,139,181,.19);background:rgba(118,139,181,.08);color:#59709d; }
        .territory-go svg { width:11px;height:11px; }
        @media(max-width:620px){.territory-confirm-card{bottom:max(82px,calc(env(safe-area-inset-bottom) + 74px));width:min(292px,calc(100vw - 18px));}}
        @media(prefers-reduced-motion:reduce){.territory-confirm-card{animation:none!important}}
      `}</style>
      <section className="territory-confirm-card" role="dialog" aria-modal="true" aria-label={`Confirm travel to ${pending.label}`}>
        <div className="territory-confirm-head">
          <i className="territory-confirm-icon"><MapPin aria-hidden="true" /></i>
          <span className="territory-confirm-copy"><strong>{pending.label}</strong><small>{pending.cellId} · {pending.places}</small></span>
          <button type="button" className="territory-confirm-close" aria-label="Cancel territory travel" onClick={cancel}><X aria-hidden="true" /></button>
        </div>
        <p className="territory-confirm-question">Your Agent will cross the territory border and continue normal activity there. Go to this territory?</p>
        <div className="territory-confirm-actions">
          <button type="button" className="territory-stay" onClick={cancel}>STAY</button>
          <button type="button" className="territory-go" onClick={confirm}>GO <ArrowRight aria-hidden="true" /></button>
        </div>
      </section>
    </>,
    viewport,
  );
}
