"use client";

import { Minus, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type DetailLevel = "overview" | "balanced" | "full";
type PerceptionLevel = "near" | "mid" | "far" | "hidden";

function cameraScale(transform: string) {
  const match = transform.match(/scale\(\s*([\d.]+)\s*\)/);
  return match ? Math.max(0.46, Math.min(1.35, Number(match[1]) || 0.84)) : 0.84;
}

function detailLevel(scale: number): DetailLevel {
  if (scale >= 1.02) return "full";
  if (scale >= 0.7) return "balanced";
  return "overview";
}

function thresholds(detail: DetailLevel) {
  if (detail === "full") return { near: 300, mid: 650, far: 1050 };
  if (detail === "balanced") return { near: 210, mid: 445, far: 760 };
  return { near: 135, mid: 300, far: 560 };
}

function sampleVisible(index: number, level: PerceptionLevel, detail: DetailLevel) {
  if (level === "near") return true;
  if (level === "mid") return detail === "overview" ? index % 2 === 0 : true;
  if (level === "far") {
    if (detail === "full") return index % 2 === 0;
    if (detail === "balanced") return index % 3 === 0;
    return index % 5 === 0;
  }
  return false;
}

function perceptionFor(
  rect: DOMRect,
  viewRect: DOMRect,
  focusX: number,
  focusY: number,
  detail: DetailLevel,
  index: number,
): PerceptionLevel {
  const margin = detail === "full" ? 130 : detail === "balanced" ? 90 : 55;
  const inExpandedView =
    rect.right >= viewRect.left - margin &&
    rect.left <= viewRect.right + margin &&
    rect.bottom >= viewRect.top - margin &&
    rect.top <= viewRect.bottom + margin;
  if (!inExpandedView) return "hidden";

  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const distance = Math.hypot(x - focusX, y - focusY);
  const limit = thresholds(detail);
  let level: PerceptionLevel =
    distance <= limit.near
      ? "near"
      : distance <= limit.mid
        ? "mid"
        : distance <= limit.far
          ? "far"
          : "hidden";

  if (!sampleVisible(index, level, detail)) level = "hidden";
  return level;
}

export function AsymptaPerceptionSystem() {
  const [viewport, setViewport] = useState<HTMLElement | null>(null);
  const [scale, setScale] = useState(0.84);

  useEffect(() => {
    const sync = () => {
      const nextViewport = document.querySelector<HTMLElement>(".world-viewport");
      const plane = document.querySelector<HTMLElement>(".world-plane");
      if (nextViewport && nextViewport !== viewport) setViewport(nextViewport);
      if (!nextViewport || !plane) return;

      const nextScale = cameraScale(plane.style.transform);
      const detail = detailLevel(nextScale);
      if (Math.abs(nextScale - scale) > 0.008) setScale(nextScale);
      plane.dataset.cityDetail = detail;

      const viewRect = nextViewport.getBoundingClientRect();
      const userAgent = document.querySelector<HTMLElement>(".mission-user-agent");
      const userRect = userAgent?.getBoundingClientRect();
      const focusX = userRect ? userRect.left + userRect.width / 2 : viewRect.left + viewRect.width / 2;
      const focusY = userRect ? userRect.top + userRect.height / 2 : viewRect.top + viewRect.height / 2;

      document.querySelectorAll<HTMLElement>(".city-agent").forEach((node, index) => {
        node.dataset.perception = perceptionFor(
          node.getBoundingClientRect(),
          viewRect,
          focusX,
          focusY,
          detail,
          index,
        );
      });

      document
        .querySelectorAll<HTMLElement>(".world-agent:not(.mission-user-agent)")
        .forEach((node, index) => {
          node.dataset.perception = perceptionFor(
            node.getBoundingClientRect(),
            viewRect,
            focusX,
            focusY,
            detail,
            index,
          );
        });

      document.querySelectorAll<HTMLElement>(".latent-business").forEach((node, index) => {
        const level = perceptionFor(
          node.getBoundingClientRect(),
          viewRect,
          focusX,
          focusY,
          detail,
          index,
        );
        node.dataset.perception = level === "hidden" ? "far" : level;
      });
    };

    const initial = window.setTimeout(sync, 0);
    const timer = window.setInterval(sync, 180);
    window.addEventListener("resize", sync);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
      window.removeEventListener("resize", sync);
    };
  }, [scale, viewport]);

  const zoom = (direction: "in" | "out") => {
    const node = document.querySelector<HTMLElement>(".world-viewport");
    if (!node) return;
    const rect = node.getBoundingClientRect();
    node.dispatchEvent(
      new WheelEvent("wheel", {
        bubbles: true,
        cancelable: true,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
        deltaY: direction === "in" ? -260 : 260,
        deltaMode: 0,
      }),
    );
  };

  if (!viewport) return null;

  return createPortal(
    <>
      <style>{`
        .city-agent,
        .world-agent:not(.mission-user-agent),
        .latent-business {
          transition:
            opacity 260ms ease,
            filter 260ms ease !important;
        }

        .city-agent .city-agent-body {
          transition:
            transform 260ms ease,
            opacity 260ms ease,
            box-shadow 260ms ease !important;
          transform-origin: center;
        }

        .city-agent[data-perception="near"] { opacity: .96; }
        .city-agent[data-perception="near"] .city-agent-body {
          transform: scale(1.28);
          opacity: 1;
        }
        .city-agent[data-perception="mid"] { opacity: .55; }
        .city-agent[data-perception="mid"] .city-agent-body {
          transform: scale(.9);
          opacity: .86;
        }
        .city-agent[data-perception="far"] { opacity: .2; }
        .city-agent[data-perception="far"] .city-agent-body {
          transform: scale(.62);
          opacity: .64;
          box-shadow: none !important;
        }
        .city-agent[data-perception="hidden"] {
          opacity: 0 !important;
          visibility: hidden;
        }

        .world-agent:not(.mission-user-agent)[data-perception="near"] { opacity: 1 !important; }
        .world-agent:not(.mission-user-agent)[data-perception="mid"] { opacity: .58 !important; }
        .world-agent:not(.mission-user-agent)[data-perception="far"] { opacity: .2 !important; }
        .world-agent:not(.mission-user-agent)[data-perception="hidden"] {
          opacity: 0 !important;
          visibility: hidden !important;
        }

        .mission-user-agent {
          opacity: 1 !important;
          visibility: visible !important;
          z-index: 42 !important;
        }

        .latent-business[data-perception="near"] { opacity: .82 !important; }
        .latent-business[data-perception="mid"] { opacity: .48 !important; }
        .latent-business[data-perception="far"] { opacity: .22 !important; }
        .latent-business[data-perception="far"] span { opacity: .48; }

        .world-plane[data-city-detail="overview"] .city-agent-thought,
        .world-plane[data-city-detail="overview"] .business-thought {
          display: none !important;
        }
        .world-plane[data-city-detail="balanced"] .city-agent:not([data-perception="near"]) .city-agent-thought {
          display: none !important;
        }
        .world-plane[data-city-detail="full"] .city-agent[data-perception="mid"] .city-agent-thought {
          opacity: .62;
          transform: scale(.88);
          transform-origin: left bottom;
        }

        .asympta-zoom-control {
          position: absolute;
          z-index: 94;
          left: max(12px, env(safe-area-inset-left));
          top: max(14px, env(safe-area-inset-top));
          bottom: auto;
          display: inline-flex;
          align-items: center;
          gap: 2px;
          padding: 3px;
          border: 1px solid rgba(117, 126, 119, .12);
          border-radius: 999px;
          background: rgba(248,247,241,.62);
          box-shadow: 0 6px 20px rgba(54,63,58,.055);
          backdrop-filter: blur(12px);
          opacity: .46;
          transition: opacity 180ms ease, background 180ms ease;
          pointer-events: auto;
        }
        .asympta-zoom-control:hover,
        .asympta-zoom-control:focus-within {
          opacity: 1;
          background: rgba(248,247,241,.9);
        }
        .asympta-zoom-control button {
          display: grid;
          place-items: center;
          width: 30px;
          height: 30px;
          padding: 0;
          border: 0;
          border-radius: 50%;
          background: transparent;
          color: #69736c;
          cursor: pointer;
        }
        .asympta-zoom-control button:hover,
        .asympta-zoom-control button:focus-visible {
          background: rgba(106, 119, 110, .08);
          outline: none;
        }
        .asympta-zoom-control button svg { width: 13px; height: 13px; stroke-width: 1.8; }
        .asympta-zoom-control span {
          min-width: 38px;
          color: #7a827d;
          font-family: var(--pixel-font);
          font-size: .32rem;
          letter-spacing: .035em;
          text-align: center;
          user-select: none;
        }

        @media (max-width: 620px) {
          .asympta-zoom-control {
            left: max(9px, env(safe-area-inset-left));
            top: max(10px, env(safe-area-inset-top));
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .city-agent,
          .city-agent .city-agent-body,
          .world-agent:not(.mission-user-agent),
          .latent-business,
          .asympta-zoom-control {
            transition: none !important;
          }
        }
      `}</style>

      <div
        className="asympta-zoom-control"
        aria-label="World zoom and perception"
        onPointerDown={(event) => event.stopPropagation()}
        onWheel={(event) => event.stopPropagation()}
      >
        <button type="button" aria-label="Zoom out" onClick={() => zoom("out")}>
          <Minus aria-hidden="true" />
        </button>
        <span>{Math.round(scale * 100)}%</span>
        <button type="button" aria-label="Zoom in" onClick={() => zoom("in")}>
          <Plus aria-hidden="true" />
        </button>
      </div>
    </>,
    viewport,
  );
}
