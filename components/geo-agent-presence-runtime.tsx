"use client";

/**
 * Demo-stage invariant: changing geo cells must never make the world feel empty.
 * Real place/business data can remain cell-specific, but the native autonomous
 * population stays visible so the economy still feels alive everywhere.
 */
export function GeoAgentPresenceRuntime() {
  return (
    <style>{`
      html[data-earth-world="true"] .world-agent:not(.mission-user-agent) {
        display: grid !important;
      }

      html[data-earth-world="true"][data-starter-district="away"]
        .world-agent:not(.mission-user-agent) {
        visibility: visible !important;
        opacity: .74 !important;
        pointer-events: auto !important;
      }

      html[data-earth-world="true"][data-starter-district="away"]
        .world-agent:not(.mission-user-agent).is-active {
        opacity: .94 !important;
      }

      @media (max-width: 620px) {
        html[data-earth-world="true"][data-starter-district="away"]
          .world-agent:not(.mission-user-agent) {
          opacity: .7 !important;
        }
      }
    `}</style>
  );
}
