export function UserAgentAura() {
  return (
    <style>{`
      .mission-user-agent {
        isolation: isolate;
      }

      .mission-user-agent::before,
      .mission-user-agent::after {
        content: "";
        position: absolute;
        pointer-events: none;
        border-radius: 999px;
      }

      .mission-user-agent::before {
        z-index: -2;
        inset: -12px;
        background:
          radial-gradient(
            circle,
            rgba(121, 149, 214, 0.28) 0%,
            rgba(121, 149, 214, 0.18) 36%,
            rgba(121, 149, 214, 0.09) 58%,
            rgba(121, 149, 214, 0) 78%
          );
        filter: blur(9px);
        opacity: 0.86;
        transform: scale(0.99);
        animation: asympta-user-agent-aura 3.2s ease-in-out infinite;
      }

      .mission-user-agent::after {
        z-index: -1;
        inset: -4px;
        border: 1px solid rgba(121, 149, 214, 0.28);
        box-shadow:
          0 0 9px rgba(121, 149, 214, 0.20),
          0 0 20px rgba(121, 149, 214, 0.13);
        opacity: 0.9;
        transition:
          opacity 220ms ease,
          box-shadow 220ms ease,
          transform 220ms ease;
      }

      .mission-user-agent.is-world-encountering::before {
        opacity: 1;
        transform: scale(1.06);
      }

      .mission-user-agent.is-world-encountering::after {
        opacity: 1;
        transform: scale(1.04);
        border-color: rgba(121, 149, 214, 0.42);
        box-shadow:
          0 0 13px rgba(121, 149, 214, 0.28),
          0 0 29px rgba(121, 149, 214, 0.18);
      }

      .mission-user-agent.agent-state-deal::before {
        background:
          radial-gradient(
            circle,
            rgba(189, 147, 105, 0.26) 0%,
            rgba(121, 149, 214, 0.16) 46%,
            rgba(121, 149, 214, 0) 78%
          );
      }

      .mission-user-agent.agent-state-workflow::before {
        background:
          radial-gradient(
            circle,
            rgba(116, 153, 129, 0.24) 0%,
            rgba(121, 149, 214, 0.16) 46%,
            rgba(121, 149, 214, 0) 78%
          );
      }

      @keyframes asympta-user-agent-aura {
        0%, 100% {
          opacity: 0.82;
          transform: scale(0.98);
        }
        50% {
          opacity: 1;
          transform: scale(1.035);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .mission-user-agent::before {
          animation: none;
          transform: none;
        }
      }
    `}</style>
  );
}
