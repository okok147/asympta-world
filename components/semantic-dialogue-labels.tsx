export function SemanticDialogueLabels() {
  return (
    <style>{`
      .business-thought--food .business-thought-icons::after { content: "尋找食物" !important; }
      .business-thought--deal .business-thought-icons::after { content: "接受交易" !important; }
      .business-thought--skill .business-thought-icons::after { content: "交換技能" !important; }
      .business-thought--enquiry .business-thought-icons::after { content: "尋找協助" !important; }
      .business-thought--resource .business-thought-icons::after { content: "交易資源" !important; }
      .business-thought--workflow .business-thought-icons::after { content: "執行任務" !important; }
      .business-thought--energy .business-thought-icons::after { content: "補充能量" !important; }
      .business-thought--status .business-thought-icons::after { content: "觀察中" !important; }

      /* The conversation field is the primary WebMCP action surface. */
      .need-composer {
        width: min(620px, calc(100% - 32px)) !important;
        min-height: 66px !important;
        padding: 4px !important;
        gap: 7px !important;
        border-radius: 34px !important;
      }

      .need-composer > input {
        height: 58px !important;
        min-height: 58px !important;
        padding: 0 19px !important;
        border-radius: 29px !important;
        opacity: 0.97 !important;
        border: 1.5px solid rgba(94, 119, 184, 0.42) !important;
        background: rgba(252, 251, 247, 0.97) !important;
        color: #303946 !important;
        font-size: 0.9rem !important;
        font-weight: 520 !important;
        letter-spacing: 0.002em !important;
        box-shadow:
          0 0 0 4px rgba(112, 137, 205, 0.08),
          0 8px 28px rgba(54, 63, 58, 0.12) !important;
      }

      .need-composer > input::placeholder {
        color: rgba(64, 75, 93, 0.72) !important;
        opacity: 1 !important;
        font-weight: 500 !important;
      }

      .need-composer:focus-within > input {
        opacity: 1 !important;
        border-color: rgba(111, 89, 171, 0.58) !important;
        background: rgba(255, 254, 250, 1) !important;
        box-shadow:
          0 0 0 5px rgba(126, 104, 183, 0.12),
          0 9px 30px rgba(89, 75, 145, 0.15) !important;
      }

      .need-composer > button {
        width: 58px !important;
        height: 58px !important;
        flex: 0 0 58px !important;
        opacity: 0.98 !important;
        background: rgba(112, 137, 205, 0.28) !important;
        color: #4963a0 !important;
        border: 1px solid rgba(94, 119, 184, 0.38) !important;
        box-shadow:
          0 0 0 4px rgba(112, 137, 205, 0.10),
          0 5px 20px rgba(73, 99, 160, 0.19) !important;
        animation: asympta-conversation-cta-pulse 1.35s ease-in-out infinite !important;
        transform-origin: center;
      }

      .need-composer > button svg {
        width: 20px !important;
        height: 20px !important;
      }

      .need-composer > button:hover,
      .need-composer > button:focus-visible,
      .need-composer:focus-within > button {
        opacity: 1 !important;
        background: rgba(126, 104, 183, 0.32) !important;
        color: #594b91 !important;
        border-color: rgba(111, 89, 171, 0.52) !important;
        box-shadow:
          0 0 0 6px rgba(126, 104, 183, 0.14),
          0 6px 24px rgba(89, 75, 145, 0.23) !important;
      }

      /* Keep the WebMCP scenario picker attached cleanly to the larger field. */
      .webmcp-scenario-picker,
      .webmcp-scenario-running {
        right: 65px !important;
        bottom: 72px !important;
      }

      .webmcp-scenario-picker {
        max-height: min(382px, 52svh) !important;
        border-color: rgba(111, 122, 113, 0.22) !important;
        box-shadow: 0 18px 52px rgba(48, 58, 52, 0.14) !important;
      }

      .webmcp-scenario-option {
        min-height: 58px !important;
        padding: 9px 10px !important;
      }

      .webmcp-scenario-copy strong {
        font-size: 0.62rem !important;
      }

      .webmcp-scenario-copy small {
        font-size: 0.46rem !important;
      }

      /* Territory Atlas is the one canonical map icon. Places stays available
         as a text action without competing map glyphs. */
      .places-directory-button > svg:first-child,
      .earth-bar > button:nth-of-type(2) > svg,
      .territory-atlas-head > svg,
      .territory-atlas-detail header > svg {
        display: none !important;
      }

      .territory-atlas-button {
        opacity: 0.96 !important;
      }

      @keyframes asympta-conversation-cta-pulse {
        0%, 100% {
          background: rgba(112, 137, 205, 0.26);
          color: #4963a0;
          box-shadow:
            0 0 0 3px rgba(112, 137, 205, 0.08),
            0 5px 18px rgba(73, 99, 160, 0.15);
          transform: scale(1);
        }
        50% {
          background: rgba(137, 110, 192, 0.36);
          color: #58498f;
          box-shadow:
            0 0 0 8px rgba(137, 110, 192, 0.15),
            0 7px 26px rgba(88, 73, 143, 0.24);
          transform: scale(1.06);
        }
      }

      @media (max-width: 620px) {
        .need-composer {
          width: calc(100% - 18px) !important;
          min-height: 62px !important;
          bottom: max(9px, env(safe-area-inset-bottom)) !important;
        }

        .need-composer > input {
          height: 54px !important;
          min-height: 54px !important;
          padding: 0 16px !important;
          font-size: 0.82rem !important;
        }

        .need-composer > button {
          width: 54px !important;
          height: 54px !important;
          flex-basis: 54px !important;
        }

        .webmcp-scenario-picker,
        .webmcp-scenario-running {
          right: 0 !important;
          bottom: 68px !important;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .need-composer > button {
          animation: none !important;
          opacity: 1 !important;
          background: rgba(112, 137, 205, 0.32) !important;
          box-shadow:
            0 0 0 5px rgba(112, 137, 205, 0.12),
            0 5px 20px rgba(73, 99, 160, 0.18) !important;
        }
      }
    `}</style>
  );
}
