"use client";

import { useEffect, useState } from "react";

const PREFS_KEY = "asympta-user-preferences-v1";
const WHEEL_ZOOM_COEFFICIENT = 0.0012;
const MIN_RATIO = 0.82;
const MAX_RATIO = 1.22;

type PinchState = {
  active: boolean;
  suppressPan: boolean;
  lastDistance: number;
};

function distance(touches: TouchList) {
  if (touches.length < 2) return 0;
  const first = touches[0];
  const second = touches[1];
  return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
}

function midpoint(touches: TouchList) {
  const first = touches[0];
  const second = touches[1];
  return {
    x: (first.clientX + second.clientX) / 2,
    y: (first.clientY + second.clientY) / 2,
  };
}

function cameraNumbers(transform: string) {
  const match = transform.match(/translate\(\s*(-?[\d.]+)px\s*,\s*(-?[\d.]+)px\s*\)\s*scale\(\s*([\d.]+)\s*\)/);
  return match
    ? { x: Number(match[1]) || 0, y: Number(match[2]) || 0, scale: Number(match[3]) || 0.77 }
    : { x: 0, y: 0, scale: 0.77 };
}

function persistCameraPreference() {
  window.requestAnimationFrame(() => {
    const plane = document.querySelector<HTMLElement>(".world-plane");
    if (!plane) return;
    const camera = cameraNumbers(plane.style.transform);
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      const parsed = raw ? JSON.parse(raw) as Record<string, unknown> : {};
      localStorage.setItem(PREFS_KEY, JSON.stringify({
        ...parsed,
        version: 1,
        cameraX: camera.x,
        cameraY: camera.y,
        cameraScale: camera.scale,
        cameraFollow: parsed.cameraFollow ?? true,
      }));
    } catch {
      // The live gesture still works when storage is unavailable.
    }
  });
}

export function MobilePinchZoomRuntime() {
  const [viewport, setViewport] = useState<HTMLElement | null>(null);

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
    if (!viewport) return;

    const state: PinchState = { active: false, suppressPan: false, lastDistance: 0 };

    const beginPinch = (event: TouchEvent) => {
      if (event.touches.length < 2) return;
      const nextDistance = distance(event.touches);
      if (!Number.isFinite(nextDistance) || nextDistance <= 0) return;
      state.active = true;
      state.suppressPan = true;
      state.lastDistance = nextDistance;
      viewport.dataset.mobilePinching = "true";
      event.preventDefault();
    };

    const movePinch = (event: TouchEvent) => {
      if (event.touches.length < 2) return;
      if (!state.active) beginPinch(event);
      if (!state.active) return;

      event.preventDefault();
      event.stopPropagation();

      const nextDistance = distance(event.touches);
      if (!Number.isFinite(nextDistance) || nextDistance <= 0 || state.lastDistance <= 0) return;
      const rawRatio = nextDistance / state.lastDistance;
      state.lastDistance = nextDistance;
      if (Math.abs(rawRatio - 1) < 0.002) return;

      const ratio = Math.max(MIN_RATIO, Math.min(MAX_RATIO, rawRatio));
      const center = midpoint(event.touches);
      const deltaY = -Math.log(ratio) / WHEEL_ZOOM_COEFFICIENT;

      viewport.dispatchEvent(new WheelEvent("wheel", {
        bubbles: true,
        cancelable: true,
        clientX: center.x,
        clientY: center.y,
        deltaY,
        deltaMode: 0,
      }));
    };

    const endPinch = (event: TouchEvent) => {
      if (!state.suppressPan) return;
      if (event.touches.length >= 2) {
        state.active = true;
        state.lastDistance = distance(event.touches);
        return;
      }

      state.active = false;
      state.lastDistance = 0;
      persistCameraPreference();
      if (event.touches.length === 0) {
        state.suppressPan = false;
        delete viewport.dataset.mobilePinching;
      }
    };

    const cancelPinch = () => {
      state.active = false;
      state.suppressPan = false;
      state.lastDistance = 0;
      delete viewport.dataset.mobilePinching;
      persistCameraPreference();
    };

    const blockTouchPanDuringPinch = (event: PointerEvent) => {
      if (!state.suppressPan || event.pointerType !== "touch") return;
      event.preventDefault();
      event.stopPropagation();
    };

    const preventNativeGesture = (event: Event) => {
      if (state.suppressPan) event.preventDefault();
    };

    viewport.addEventListener("touchstart", beginPinch, { passive: false });
    viewport.addEventListener("touchmove", movePinch, { passive: false });
    viewport.addEventListener("touchend", endPinch, { passive: false });
    viewport.addEventListener("touchcancel", cancelPinch, { passive: false });
    viewport.addEventListener("pointermove", blockTouchPanDuringPinch, { capture: true });
    viewport.addEventListener("gesturestart", preventNativeGesture, { passive: false });
    viewport.addEventListener("gesturechange", preventNativeGesture, { passive: false });

    return () => {
      viewport.removeEventListener("touchstart", beginPinch);
      viewport.removeEventListener("touchmove", movePinch);
      viewport.removeEventListener("touchend", endPinch);
      viewport.removeEventListener("touchcancel", cancelPinch);
      viewport.removeEventListener("pointermove", blockTouchPanDuringPinch, { capture: true });
      viewport.removeEventListener("gesturestart", preventNativeGesture);
      viewport.removeEventListener("gesturechange", preventNativeGesture);
      delete viewport.dataset.mobilePinching;
    };
  }, [viewport]);

  return <style>{`
    .world-viewport {
      touch-action:none;
      overscroll-behavior:contain;
      -webkit-user-select:none;
      -webkit-touch-callout:none;
    }
    .world-viewport[data-mobile-pinching="true"] {
      cursor:zoom-in;
    }
  `}</style>;
}
