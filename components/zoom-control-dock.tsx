export function ZoomControlDock() {
  return (
    <style>{`
      .asympta-zoom-control {
        left: 0 !important;
        right: auto !important;
        top: 50% !important;
        bottom: auto !important;
        z-index: 68 !important;
        flex-direction: column !important;
        gap: 0 !important;
        padding: 2px !important;
        transform: translate(-31px, -50%) !important;
        opacity: .18;
        box-shadow: 0 5px 18px rgba(54, 63, 58, .05) !important;
        transition:
          transform 180ms ease,
          opacity 180ms ease,
          background 180ms ease !important;
      }

      .asympta-zoom-control:hover,
      .asympta-zoom-control:focus-within {
        transform: translate(8px, -50%) !important;
        opacity: .96;
        background: rgba(248, 247, 241, .92) !important;
      }

      .asympta-zoom-control span {
        min-width: 28px !important;
        padding: 3px 0;
        writing-mode: vertical-rl;
        text-orientation: mixed;
      }

      @media (hover: none), (pointer: coarse) {
        .asympta-zoom-control {
          top: max(76px, calc(env(safe-area-inset-top) + 62px)) !important;
          transform: translate(-25px, 0) !important;
          opacity: .34;
        }

        .asympta-zoom-control:focus-within,
        .asympta-zoom-control:active {
          transform: translate(7px, 0) !important;
          opacity: .96;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .asympta-zoom-control {
          transition: none !important;
        }
      }
    `}</style>
  );
}
