export function AsymptaUltraCalm() {
  return (
    <style>{`
      :root {
        --panel: rgba(248,246,239,.30);
        --panel-strong: rgba(249,247,241,.52);
        --line: rgba(67,63,56,.045);
        --line-strong: rgba(67,63,56,.075);
        --shadow: none;
      }

      /* Keep content readable while the container itself almost disappears. */
      .atlas-console {
        background: rgba(248,246,239,.30) !important;
        border-color: rgba(67,63,56,.045) !important;
        box-shadow: none !important;
      }
      .atlas-console.is-collapsed { background: rgba(248,246,239,.16) !important; }
      .atlas-menu-panel { background: transparent !important; }

      .atlas-safe-schedule {
        background: rgba(248,246,239,.28) !important;
        border-color: rgba(67,63,56,.04) !important;
        box-shadow: none !important;
      }
      .atlas-safe-schedule.is-collapsed { background: rgba(248,246,239,.15) !important; }

      .atlas-agent-card {
        background: rgba(248,246,239,.30) !important;
        border-color: rgba(67,63,56,.04) !important;
        box-shadow: none !important;
      }
      .atlas-agent-card.is-collapsed { background: rgba(248,246,239,.15) !important; }

      .atlas-language-menu {
        background: rgba(249,247,241,.56) !important;
        border-color: rgba(67,63,56,.055) !important;
        box-shadow: none !important;
      }
      .atlas-json-grid section,
      .atlas-webmcp-tool-list > button,
      .atlas-webmcp-action-row button,
      .atlas-resource-chip,
      .atlas-workflow,
      .atlas-tool-actions button,
      .asympta-job-panel,
      .asympta-job-auto,
      .asympta-job-actions button {
        box-shadow: none !important;
      }

      .atlas-workflow.is-active,
      .atlas-quick-icon.is-active,
      .atlas-tool-actions button.is-active {
        background: rgba(255,255,255,.14) !important;
      }

      .animal-map-marker__dialogue {
        background: rgba(249,247,241,.72) !important;
        border-color: rgba(67,63,56,.055) !important;
      }

      .map-control--locate {
        background: rgba(249,247,241,.22) !important;
        border-color: rgba(67,63,56,.035) !important;
        box-shadow: none !important;
      }

      /* Human-decision surfaces are deliberately excluded from ultra-transparency. */
      .atlas-approval {
        background: rgba(249,247,241,.94) !important;
        border-color: rgba(67,63,56,.10) !important;
      }
      .asympta-escalation-notice {
        background: rgba(249,247,241,.76) !important;
        box-shadow: none !important;
      }

      /* Real-time economics reuse existing rows instead of creating another dashboard. */
      .asympta-workflow-cost {
        min-width: 0;
        display: inline-flex;
        align-items: baseline;
        gap: 2px;
        margin-left: auto;
        color: var(--ink-faint);
        font-size: 6.2px;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }
      .asympta-workflow-cost strong { color: var(--ink-soft); font-size: 6.6px; font-weight: 700; }
      .asympta-workflow-cost small { color: var(--ink-faint); font-size: 5.8px; }
      .asympta-task-cost { color: #8a746f; font: inherit; font-variant-numeric: tabular-nums; }

      @media (hover:hover) and (pointer:fine) {
        .atlas-console:hover,
        .atlas-console:focus-within,
        .atlas-safe-schedule:hover,
        .atlas-safe-schedule:focus-within,
        .atlas-agent-card:hover,
        .atlas-agent-card:focus-within {
          background: rgba(248,246,239,.52) !important;
          border-color: rgba(67,63,56,.065) !important;
        }
      }

      @media (max-width:700px) {
        .atlas-console { background: rgba(248,246,239,.25) !important; }
        .atlas-console.is-collapsed,
        .atlas-safe-schedule.is-collapsed,
        .atlas-agent-card.is-collapsed { background: rgba(248,246,239,.13) !important; }
        .asympta-workflow-cost small { display: none; }
      }
    `}</style>
  );
}
