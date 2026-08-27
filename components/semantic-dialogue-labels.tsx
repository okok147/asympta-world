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

      .need-composer > input {
        opacity: 0.94 !important;
        border: 1px solid rgba(94, 119, 184, 0.34) !important;
        background: rgba(250, 249, 244, 0.92) !important;
        color: #353d48 !important;
        box-shadow:
          0 0 0 3px rgba(112, 137, 205, 0.07),
          0 4px 18px rgba(54, 63, 58, 0.08) !important;
      }

      .need-composer > input::placeholder {
        color: rgba(72, 82, 98, 0.68) !important;
        opacity: 1 !important;
      }

      .need-composer:focus-within > input {
        opacity: 1 !important;
        border-color: rgba(111, 89, 171, 0.48) !important;
        background: rgba(252, 251, 247, 0.98) !important;
        box-shadow:
          0 0 0 4px rgba(126, 104, 183, 0.10),
          0 5px 20px rgba(89, 75, 145, 0.12) !important;
      }

      .need-composer > button {
        opacity: 0.96 !important;
        background: rgba(112, 137, 205, 0.26) !important;
        color: #4963a0 !important;
        border: 1px solid rgba(94, 119, 184, 0.34) !important;
        box-shadow:
          0 0 0 4px rgba(112, 137, 205, 0.10),
          0 4px 18px rgba(73, 99, 160, 0.18) !important;
        animation: asympta-conversation-cta-pulse 1.35s ease-in-out infinite !important;
        transform-origin: center;
      }

      .need-composer > button:hover,
      .need-composer > button:focus-visible,
      .need-composer:focus-within > button {
        opacity: 1 !important;
        background: rgba(126, 104, 183, 0.30) !important;
        color: #594b91 !important;
        border-color: rgba(111, 89, 171, 0.48) !important;
        box-shadow:
          0 0 0 5px rgba(126, 104, 183, 0.13),
          0 5px 22px rgba(89, 75, 145, 0.22) !important;
      }

      @keyframes asympta-conversation-cta-pulse {
        0%, 100% {
          background: rgba(112, 137, 205, 0.24);
          color: #4963a0;
          box-shadow:
            0 0 0 3px rgba(112, 137, 205, 0.08),
            0 4px 16px rgba(73, 99, 160, 0.14);
          transform: scale(1);
        }
        50% {
          background: rgba(137, 110, 192, 0.34);
          color: #58498f;
          box-shadow:
            0 0 0 7px rgba(137, 110, 192, 0.15),
            0 6px 24px rgba(88, 73, 143, 0.24);
          transform: scale(1.07);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .need-composer > button {
          animation: none !important;
          opacity: 1 !important;
          background: rgba(112, 137, 205, 0.30) !important;
          box-shadow:
            0 0 0 5px rgba(112, 137, 205, 0.12),
            0 4px 18px rgba(73, 99, 160, 0.18) !important;
        }
      }
    `}</style>
  );
}
