"use client";

import type { CSSProperties } from "react";

import {
  ASYMPTA_WEBMCP_TOOL_MODES,
  ASYMPTA_WEBMCP_TOOL_NAMES,
  type AsymptaWebMcpToolName,
} from "@/lib/asympta-webmcp-contract";

const TOOL_COPY: Record<AsymptaWebMcpToolName, string> = {
  asympta_observe_living_city: "Observe living city",
  asympta_list_workflows: "List coordination workflows",
  asympta_follow_agent: "Follow an active agent",
  asympta_request_workflow: "Request a workflow",
  asympta_request_external_action: "Request a consequential action",
  asympta_describe_capabilities: "Describe Asympta capabilities",
  asympta_inspect_agent: "Inspect an agent",
  asympta_get_pending_approval: "Read pending human approval",
  asympta_submit_request: "Submit a request for review",
  asympta_read_request: "Read one request",
  asympta_send_agent_message: "Send a structured message",
  asympta_list_agent_messages: "List structured messages",
  asympta_observe_global_supply_network: "Observe global supply network",
};

const shellStyle: CSSProperties = {
  position: "fixed",
  right: "max(14px, env(safe-area-inset-right))",
  bottom: "max(14px, env(safe-area-inset-bottom))",
  zIndex: 44,
  width: "min(330px, calc(100vw - 28px))",
  border: "1px solid rgba(86, 82, 72, 0.16)",
  borderRadius: 18,
  background: "rgba(246, 244, 236, 0.94)",
  boxShadow: "0 14px 40px rgba(70, 64, 52, 0.14)",
  color: "#47443d",
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
  overflow: "hidden",
  fontFamily: "inherit",
};

const summaryStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  minHeight: 54,
  padding: "10px 13px 10px 15px",
  cursor: "pointer",
  listStyle: "none",
  userSelect: "none",
};

const countStyle: CSSProperties = {
  flexShrink: 0,
  border: "1px solid rgba(83, 96, 111, 0.15)",
  borderRadius: 999,
  padding: "5px 8px",
  background: "rgba(255, 255, 255, 0.54)",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.05em",
  color: "#626a72",
};

const listStyle: CSSProperties = {
  maxHeight: "46vh",
  overflowY: "auto",
  overscrollBehavior: "contain",
  padding: "0 10px 11px",
  borderTop: "1px solid rgba(86, 82, 72, 0.1)",
};

function modeStyle(mode: "READ" | "WRITE"): CSSProperties {
  return {
    flexShrink: 0,
    borderRadius: 999,
    padding: "4px 7px",
    background: mode === "READ" ? "rgba(86, 112, 128, 0.09)" : "rgba(145, 105, 76, 0.1)",
    color: mode === "READ" ? "#596d78" : "#80634d",
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: "0.07em",
  };
}

function ToolRow({ name }: { name: AsymptaWebMcpToolName }) {
  const mode = ASYMPTA_WEBMCP_TOOL_MODES[name];
  return (
    <li
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "9px 7px",
        borderBottom: "1px solid rgba(86, 82, 72, 0.075)",
      }}
    >
      <span style={{ minWidth: 0, flex: 1 }}>
        <strong style={{ display: "block", fontSize: 12, fontWeight: 650, lineHeight: 1.35, color: "#46433d" }}>
          {TOOL_COPY[name]}
        </strong>
        <code
          style={{
            display: "block",
            marginTop: 3,
            overflowWrap: "anywhere",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            fontSize: 9.5,
            lineHeight: 1.35,
            color: "#7b776d",
          }}
        >
          {name}
        </code>
      </span>
      <span style={modeStyle(mode)}>{mode}</span>
    </li>
  );
}

export function AsymptaWebMcpToolSurface() {
  const readCount = ASYMPTA_WEBMCP_TOOL_NAMES.filter((name) => ASYMPTA_WEBMCP_TOOL_MODES[name] === "READ").length;
  const writeCount = ASYMPTA_WEBMCP_TOOL_NAMES.length - readCount;

  return (
    <aside aria-label="WebMCP tool surface" style={shellStyle}>
      <details>
        <summary style={summaryStyle}>
          <span style={{ minWidth: 0 }}>
            <strong style={{ display: "block", fontSize: 12.5, fontWeight: 720, letterSpacing: "-0.01em" }}>
              WebMCP · {ASYMPTA_WEBMCP_TOOL_NAMES.length} tools
            </strong>
            <small style={{ display: "block", marginTop: 2, fontSize: 10.5, color: "#777268" }}>
              Expand browser-agent capabilities
            </small>
          </span>
          <span style={countStyle}>{readCount} READ · {writeCount} WRITE</span>
        </summary>

        <div style={listStyle}>
          <p style={{ margin: "10px 7px 4px", fontSize: 10.5, lineHeight: 1.45, color: "#716d64" }}>
            All registered WebMCP capabilities remain bounded by Asympta state and human approval for consequential actions.
          </p>
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {ASYMPTA_WEBMCP_TOOL_NAMES.map((name) => <ToolRow key={name} name={name} />)}
          </ul>
        </div>
      </details>
    </aside>
  );
}
