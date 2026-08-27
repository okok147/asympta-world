"use client";

import { LocateFixed, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const EARTH_KEY = "asympta-earth-world-v1";
const LOCATION_REJECTED_KEY = "asympta-location-rejected-v1";

type EarthSnapshot = {
  userLocation?: { lat: number; lng: number };
};

function hasStoredLocation() {
  try {
    const raw = localStorage.getItem(EARTH_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as EarthSnapshot;
    return Boolean(
      parsed.userLocation &&
      Number.isFinite(parsed.userLocation.lat) &&
      Number.isFinite(parsed.userLocation.lng),
    );
  } catch {
    return false;
  }
}

function wasRejected() {
  try {
    return localStorage.getItem(LOCATION_REJECTED_KEY) === "true";
  } catch {
    return false;
  }
}

function setRejected(value: boolean) {
  try {
    if (value) localStorage.setItem(LOCATION_REJECTED_KEY, "true");
    else localStorage.removeItem(LOCATION_REJECTED_KEY);
  } catch {
    // In-memory behavior remains usable when storage is unavailable.
  }
}

function locateButton() {
  return Array.from(document.querySelectorAll<HTMLButtonElement>(".earth-pill")).find(
    (button) => button.textContent?.trim().startsWith("LOCATE"),
  );
}

export function LocationAccessRuntime() {
  const [viewport, setViewport] = useState<HTMLElement | null>(null);
  const [asking, setAsking] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const syncTimerRef = useRef<number | null>(null);
  const verifyTimerRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (syncTimerRef.current !== null) {
      window.clearInterval(syncTimerRef.current);
      syncTimerRef.current = null;
    }
    if (verifyTimerRef.current !== null) {
      window.clearTimeout(verifyTimerRef.current);
      verifyTimerRef.current = null;
    }
  }, []);

  const syncLocationIntoEarth = useCallback(() => {
    if (syncTimerRef.current !== null) window.clearInterval(syncTimerRef.current);
    let attempts = 0;
    syncTimerRef.current = window.setInterval(() => {
      attempts += 1;
      if (hasStoredLocation()) {
        setRejected(false);
        setAsking(false);
        setRequesting(false);
        if (syncTimerRef.current !== null) window.clearInterval(syncTimerRef.current);
        syncTimerRef.current = null;
        return;
      }

      const button = locateButton();
      if (button) {
        button.click();
        if (syncTimerRef.current !== null) window.clearInterval(syncTimerRef.current);
        syncTimerRef.current = null;

        if (verifyTimerRef.current !== null) window.clearTimeout(verifyTimerRef.current);
        verifyTimerRef.current = window.setTimeout(() => {
          setRequesting(false);
          if (!hasStoredLocation() && !wasRejected()) setAsking(true);
        }, 13_500);
        return;
      }

      if (attempts >= 30) {
        if (syncTimerRef.current !== null) window.clearInterval(syncTimerRef.current);
        syncTimerRef.current = null;
        setRequesting(false);
        if (!wasRejected()) setAsking(true);
      }
    }, 220);
  }, []);

  const requestLocation = useCallback(() => {
    if (hasStoredLocation()) {
      setRejected(false);
      setAsking(false);
      return;
    }
    if (!navigator.geolocation) {
      setAsking(false);
      setRequesting(false);
      return;
    }

    setRequesting(true);
    setAsking(false);
    navigator.geolocation.getCurrentPosition(
      () => {
        setRejected(false);
        syncLocationIntoEarth();
      },
      (error) => {
        setRequesting(false);
        if (error.code === error.PERMISSION_DENIED) {
          setRejected(true);
          setAsking(false);
          return;
        }
        if (!wasRejected()) setAsking(true);
      },
      {
        enableHighAccuracy: true,
        timeout: 10_000,
        maximumAge: 60_000,
      },
    );
  }, [syncLocationIntoEarth]);

  const rejectLocation = useCallback(() => {
    clearTimers();
    setRejected(true);
    setRequesting(false);
    setAsking(false);
  }, [clearTimers]);

  useEffect(() => {
    const syncViewport = () => {
      const next = document.querySelector<HTMLElement>(".world-viewport");
      setViewport((current) => (current === next ? current : next));
    };
    const first = window.setTimeout(syncViewport, 0);
    const observer = new MutationObserver(syncViewport);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      window.clearTimeout(first);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => {
      if (hasStoredLocation()) {
        setRejected(false);
        return;
      }
      if (!wasRejected()) requestLocation();
    }, 480);

    const monitor = window.setInterval(() => {
      if (!hasStoredLocation()) return;
      setRejected(false);
      setAsking(false);
      setRequesting(false);
    }, 900);

    return () => {
      window.clearTimeout(initial);
      window.clearInterval(monitor);
      clearTimers();
    };
  }, [clearTimers, requestLocation]);

  if (!viewport || (!asking && !requesting)) return null;

  return createPortal(
    <>
      <style>{`
        .location-access-card {
          position: absolute;
          z-index: 190;
          left: 50%;
          bottom: max(78px, calc(env(safe-area-inset-bottom) + 70px));
          display: grid;
          gap: 8px;
          width: min(318px, calc(100vw - 24px));
          padding: 11px;
          transform: translateX(-50%);
          border: 1px solid rgba(112,126,116,.17);
          border-radius: 16px;
          background: rgba(248,247,241,.97);
          box-shadow: 0 14px 38px rgba(48,60,52,.11);
          color: #4c5750;
          backdrop-filter: blur(18px);
          pointer-events: auto;
        }
        .location-access-head { display:flex; align-items:flex-start; gap:8px; }
        .location-access-icon { display:grid; place-items:center; width:28px; height:28px; flex:0 0 28px; border-radius:50%; background:rgba(118,139,181,.09); color:#637aa8; }
        .location-access-icon svg { width:13px; height:13px; }
        .location-access-copy { display:grid; gap:3px; min-width:0; flex:1; }
        .location-access-copy strong { font-size:.57rem; }
        .location-access-copy small { color:#7e8781; font-size:.38rem; line-height:1.35; }
        .location-access-close { display:grid; place-items:center; width:25px; height:25px; padding:0; border:0; border-radius:50%; background:rgba(90,103,94,.05); color:#7b847e; cursor:pointer; }
        .location-access-close svg { width:11px; height:11px; }
        .location-access-actions { display:grid; grid-template-columns:1fr 1fr; gap:6px; }
        .location-access-actions button { min-height:32px; border-radius:9px; font-family:var(--pixel-font); font-size:.3rem; cursor:pointer; }
        .location-access-later { border:1px solid rgba(112,122,114,.12); background:rgba(255,255,255,.2); color:#707a73; }
        .location-access-enable { display:flex; align-items:center; justify-content:center; gap:5px; border:1px solid rgba(118,139,181,.2); background:rgba(118,139,181,.08); color:#59709d; }
        .location-access-enable svg { width:11px; height:11px; }
        .location-access-wait { color:#7d8780; font-family:var(--pixel-font); font-size:.31rem; text-align:center; }
        @media(max-width:620px){.location-access-card{bottom:max(84px,calc(env(safe-area-inset-bottom) + 76px));width:min(294px,calc(100vw - 18px));}}
      `}</style>
      <section className="location-access-card" role="dialog" aria-label="Location access">
        <div className="location-access-head">
          <i className="location-access-icon"><LocateFixed aria-hidden="true" /></i>
          <span className="location-access-copy">
            <strong>{requesting ? "Finding your local world" : "Enable your local world"}</strong>
            <small>
              {requesting
                ? "Asympta is requesting your device location so the active geo cell matches where you are."
                : "Location is needed to anchor this Earth cell. You can decline and Asympta will stop asking."}
            </small>
          </span>
          {!requesting ? (
            <button type="button" className="location-access-close" aria-label="Close location request" onClick={rejectLocation}><X aria-hidden="true" /></button>
          ) : null}
        </div>
        {requesting ? (
          <span className="location-access-wait">LOCATION REQUEST IN PROGRESS</span>
        ) : (
          <div className="location-access-actions">
            <button type="button" className="location-access-later" onClick={rejectLocation}>NOT NOW</button>
            <button type="button" className="location-access-enable" onClick={requestLocation}><LocateFixed aria-hidden="true" />ENABLE</button>
          </div>
        )}
      </section>
    </>,
    viewport,
    "location-access-card",
  );
}
