export function MinimalWorldPresentation() {
  return (
    <style>{`
      .economy-header,
      .world-aggregate,
      .header-status,
      .business-zone,
      .relationship-layer,
      .need-context,
      .live-event,
      .world-tools,
      .event-ribbon,
      .debug-panel,
      .business-flow-panel,
      .mission-panel,
      .plane-grid,
      .canvas-grain {
        display: none !important;
      }

      .economy-app {
        min-height: 0 !important;
        background: #f3f1e9 !important;
      }

      .world-shell {
        height: 100svh !important;
        min-height: 100svh !important;
      }

      .world-viewport {
        background: #f3f1e9 !important;
      }

      .world-agent {
        display: grid !important;
        place-items: center !important;
        width: 54px !important;
        height: 54px !important;
        padding: 2px !important;
        gap: 0 !important;
        border: 0 !important;
        border-radius: 50% !important;
        background: transparent !important;
        box-shadow: none !important;
      }

      .world-agent:hover,
      .world-agent:focus-visible,
      .world-agent.is-active,
      .world-agent.is-world-encountering {
        border: 0 !important;
        background: transparent !important;
        box-shadow: none !important;
        outline: none !important;
      }

      .world-agent .agent-label,
      .world-agent .agent-intent {
        display: none !important;
      }

      .world-agent .agent-portrait {
        width: 46px !important;
        height: 46px !important;
        border: 2px solid #aeb5af !important;
        border-radius: 50% !important;
        background: #ebece6 !important;
        box-shadow: 0 0 0 3px rgba(88, 96, 90, 0.045) !important;
        transition:
          border-color 220ms ease,
          background 220ms ease,
          box-shadow 220ms ease,
          transform 220ms ease !important;
      }

      .world-agent .agent-portrait > i {
        display: none !important;
      }

      .world-agent.is-world-walking .agent-portrait {
        border-color: #7d929d !important;
        background: #e6ecee !important;
      }

      .world-agent.is-world-paused .agent-portrait {
        border-color: #a8aea9 !important;
        background: #edede8 !important;
      }

      .world-agent.is-world-encountering .agent-portrait {
        transform: scale(1.04);
      }

      .world-agent.agent-state-energy .agent-portrait {
        border-color: #b49259 !important;
        background: #f0eadf !important;
        box-shadow: 0 0 0 3px rgba(180, 146, 89, 0.08) !important;
      }

      .world-agent.agent-state-food .agent-portrait {
        border-color: #829a73 !important;
        background: #e8ede3 !important;
        box-shadow: 0 0 0 3px rgba(130, 154, 115, 0.08) !important;
      }

      .world-agent.agent-state-skill .agent-portrait {
        border-color: #71879d !important;
        background: #e5eaf0 !important;
        box-shadow: 0 0 0 3px rgba(113, 135, 157, 0.08) !important;
      }

      .world-agent.agent-state-enquiry .agent-portrait {
        border-color: #857b9b !important;
        background: #ebe8ef !important;
        box-shadow: 0 0 0 3px rgba(133, 123, 155, 0.08) !important;
      }

      .world-agent.agent-state-deal .agent-portrait {
        border-color: #aa7c5d !important;
        background: #efe5dd !important;
        box-shadow: 0 0 0 3px rgba(170, 124, 93, 0.08) !important;
      }

      .world-agent.agent-state-resource .agent-portrait {
        border-color: #728f89 !important;
        background: #e4ecea !important;
        box-shadow: 0 0 0 3px rgba(114, 143, 137, 0.08) !important;
      }

      .world-agent.agent-state-workflow .agent-portrait {
        border-color: #6f8875 !important;
        background: #e5ebe5 !important;
        box-shadow: 0 0 0 3px rgba(111, 136, 117, 0.08) !important;
      }

      .world-agent.agent-state-status .agent-portrait {
        border-color: #979e98 !important;
        background: #ebebe7 !important;
      }

      .mission-user-agent .agent-portrait {
        border-color: #9a8062 !important;
        background: #efe9df !important;
        box-shadow: 0 0 0 3px rgba(154, 128, 98, 0.09) !important;
      }

      .business-thought {
        left: 27px !important;
        bottom: calc(100% + 8px) !important;
        min-width: 30px !important;
        min-height: 28px !important;
        padding: 5px 6px !important;
        border-width: 1px !important;
        border-left-width: 2px !important;
        border-radius: 12px !important;
        background: rgba(248, 247, 241, 0.94) !important;
        box-shadow: none !important;
        backdrop-filter: blur(8px);
      }

      .business-thought::before {
        left: 8px !important;
        bottom: -6px !important;
        width: 5px !important;
        height: 5px !important;
      }

      .business-thought::after {
        display: none !important;
      }

      .business-thought-icons {
        gap: 3px !important;
      }

      .business-thought-icons svg {
        width: 12px !important;
        height: 12px !important;
        stroke-width: 1.9 !important;
      }

      .need-composer {
        left: 50% !important;
        right: auto !important;
        bottom: max(14px, env(safe-area-inset-bottom)) !important;
        display: flex !important;
        width: min(410px, calc(100% - 28px)) !important;
        min-height: 42px !important;
        padding: 3px !important;
        transform: translateX(-50%) !important;
        gap: 4px !important;
        border: 0 !important;
        border-radius: 24px !important;
        background: transparent !important;
        box-shadow: none !important;
        backdrop-filter: none !important;
      }

      .need-composer .composer-provenance,
      .need-composer .budget-input,
      .need-composer .composer-hint {
        display: none !important;
      }

      .need-composer > input {
        min-width: 0 !important;
        height: 40px !important;
        border: 1px solid rgba(120, 127, 121, 0.16) !important;
        border-radius: 20px !important;
        background: rgba(248, 247, 241, 0.56) !important;
        color: #3b423d !important;
        opacity: 0.42;
        box-shadow: none !important;
        backdrop-filter: blur(10px);
        transition:
          opacity 180ms ease,
          border-color 180ms ease,
          background 180ms ease !important;
      }

      .need-composer:focus-within > input {
        opacity: 0.94;
        border-color: rgba(107, 124, 111, 0.38) !important;
        background: rgba(250, 249, 244, 0.92) !important;
      }

      .need-composer > button {
        width: 40px !important;
        height: 40px !important;
        flex: 0 0 40px !important;
        border: 0 !important;
        border-radius: 50% !important;
        background: rgba(91, 106, 95, 0.12) !important;
        color: #66726a !important;
        opacity: 0.28;
        box-shadow: none !important;
        transition: opacity 180ms ease, background 180ms ease !important;
      }

      .need-composer:focus-within > button {
        opacity: 0.86;
        background: rgba(91, 106, 95, 0.18) !important;
      }

      .error-note {
        display: none !important;
      }

      @media (max-width: 620px) {
        .world-agent {
          width: 50px !important;
          height: 50px !important;
        }

        .world-agent .agent-portrait {
          width: 43px !important;
          height: 43px !important;
        }

        .business-thought {
          left: 24px !important;
        }
      }
    `}</style>
  );
}
