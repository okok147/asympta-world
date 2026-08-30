export function AsymptaUltraCalm() {
  return (
    <style>{`
      :root {
        --panel: rgba(248,246,239,.88);
        --panel-strong: rgba(249,247,241,.90);
        --line: rgba(67,63,56,.055);
        --line-strong: rgba(67,63,56,.085);
        --shadow: none;
      }

      /* Keep the two primary top canvases readable at roughly 88% opacity. */
      .atlas-console {
        background: rgba(248,246,239,.88) !important;
        border-color: rgba(67,63,56,.055) !important;
        box-shadow: none !important;
      }
      .atlas-console.is-collapsed { background: rgba(248,246,239,.84) !important; }
      .atlas-menu-panel { background: transparent !important; }

      .atlas-safe-schedule {
        background: rgba(248,246,239,.88) !important;
        border-color: rgba(67,63,56,.055) !important;
        box-shadow: none !important;
      }
      .atlas-safe-schedule.is-collapsed { background: rgba(248,246,239,.84) !important; }

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
        background: rgba(255,255,255,.28) !important;
      }

      .animal-map-marker__dialogue {
        background: rgba(249,247,241,.82) !important;
        border-color: rgba(67,63,56,.065) !important;
      }

      .map-control--locate {
        background: rgba(249,247,241,.42) !important;
        border-color: rgba(67,63,56,.045) !important;
        box-shadow: none !important;
      }

      /* Human-decision surfaces are deliberately excluded from transparency. */
      .atlas-approval {
        background: rgba(249,247,241,.94) !important;
        border-color: rgba(67,63,56,.10) !important;
      }
      .asympta-escalation-notice {
        background: rgba(249,247,241,.82) !important;
        box-shadow: none !important;
      }

      /* Real-time economics decorate existing React-owned nodes with data attributes.
         Pseudo-elements avoid cross-root DOM ownership and cannot break hydration. */
      .atlas-safe-schedule__summary[data-asympta-workflow-cost]::after {
        content: attr(data-asympta-workflow-cost);
        min-width: 0;
        margin-left: auto;
        color: var(--ink-faint);
        font-size: 6.2px;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }
      .atlas-safe-task__progress[data-asympta-task-cost]::after {
        content: " · " attr(data-asympta-task-cost);
        color: #8a746f;
        font: inherit;
        font-variant-numeric: tabular-nums;
      }

      @media (hover:hover) and (pointer:fine) {
        .atlas-console:hover,
        .atlas-console:focus-within,
        .atlas-safe-schedule:hover,
        .atlas-safe-schedule:focus-within {
          background: rgba(248,246,239,.94) !important;
          border-color: rgba(67,63,56,.075) !important;
        }
        .atlas-agent-card:hover,
        .atlas-agent-card:focus-within {
          background: rgba(248,246,239,.52) !important;
          border-color: rgba(67,63,56,.065) !important;
        }
      }

      @media (max-width:700px) {
        .atlas-console,
        .atlas-safe-schedule { background: rgba(248,246,239,.88) !important; }
        .atlas-console.is-collapsed,
        .atlas-safe-schedule.is-collapsed { background: rgba(248,246,239,.84) !important; }
        .atlas-agent-card.is-collapsed { background: rgba(248,246,239,.13) !important; }
        .atlas-safe-schedule__summary[data-asympta-workflow-cost]::after {
          max-width: 92px;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      }
    `}</style>
  );
}
