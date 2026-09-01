"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

import {
  ASYMPTA_WEBMCP_AUXILIARY_TOOL_NAMES,
  ASYMPTA_WEBMCP_CORE_TOOL_NAMES,
  ASYMPTA_WEBMCP_GLOBAL_TOOL_NAMES,
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

const GROUPS: Array<{
  id: string;
  title: string;
  description: string;
  owner: string;
  tools: readonly AsymptaWebMcpToolName[];
}> = [
  {
    id: "core",
    title: "Core world tools",
    description: "Living-city observation, workflow control and consequential action requests.",
    owner: "AsymptaWorldLive60Hz",
    tools: ASYMPTA_WEBMCP_CORE_TOOL_NAMES,
  },
  {
    id: "auxiliary",
    title: "Coordination tools",
    description: "Capabilities, request state, agent inspection and structured communication.",
    owner: "AsymptaWebMcpTools",
    tools: ASYMPTA_WEBMCP_AUXILIARY_TOOL_NAMES,
  },
  {
    id: "global",
    title: "Global world tools",
    description: "World-scale supply-network observation.",
    owner: "AsymptaGlobalWorld",
    tools: ASYMPTA_WEBMCP_GLOBAL_TOOL_NAMES,
  },
];

const rootStyle: CSSProperties = {
  marginTop: 10,
  borderTop: "1px solid rgba(86, 82, 72, 0.1)",
  color: "#47443d",
  fontFamily: "inherit",
};

const summaryStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  minHeight: 46,
  padding: "9px 2px 7px",
  cursor: "pointer",
  listStyle: "none",
  userSelect: "none",
};

const countStyle: CSSProperties = {
  flexShrink: 0,
  border: "1px solid rgba(83, 96, 111, 0.15)",
  borderRadius: 999,
  padding: "4px 7px",
  background: "rgba(255, 255, 255, 0.48)",
  fontSize: 9,
  fontWeight: 760,
  letterSpacing: "0.045em",
  color: "#626a72",
};

function modeStyle(mode: "READ" | "WRITE"): CSSProperties {
  return {
    flexShrink: 0,
    borderRadius: 999,
    padding: "3px 6px",
    background: mode === "READ" ? "rgba(86, 112, 128, 0.09)" : "rgba(145, 105, 76, 0.1)",
    color: mode === "READ" ? "#596d78" : "#80634d",
    fontSize: 8.5,
    fontWeight: 800,
    letterSpacing: "0.065em",
  };
}

function ToolNode({ name }: { name: AsymptaWebMcpToolName }) {
  const mode = ASYMPTA_WEBMCP_TOOL_MODES[name];
  return (
    <details style={{ borderTop: "1px solid rgba(86, 82, 72, 0.065)" }}>
      <summary
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "7px 3px",
          cursor: "pointer",
          listStyle: "none",
        }}
      >
        <span style={{ minWidth: 0, fontSize: 10.5, lineHeight: 1.35, color: "#504d46" }}>{TOOL_COPY[name]}</span>
        <span style={modeStyle(mode)}>{mode}</span>
      </summary>
      <div style={{ padding: "0 3px 8px 13px" }}>
        <code
          style={{
            display: "block",
            overflowWrap: "anywhere",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            fontSize: 8.8,
            lineHeight: 1.45,
            color: "#706c64",
          }}
        >
          {name}
        </code>
        <small style={{ display: "block", marginTop: 3, fontSize: 9, lineHeight: 1.4, color: "#858078" }}>
          document.modelContext.registerTool · {mode === "READ" ? "readOnlyHint: true" : "readOnlyHint: false"}
        </small>
      </div>
    </details>
  );
}

function ToolGroup({ group }: { group: (typeof GROUPS)[number] }) {
  return (
    <details style={{ marginTop: 6, border: "1px solid rgba(86, 82, 72, 0.1)", borderRadius: 10, background: "rgba(255,255,255,0.3)", overflow: "hidden" }}>
      <summary style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 9px", cursor: "pointer", listStyle: "none" }}>
        <span style={{ minWidth: 0 }}>
          <strong style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: "#4d4a43" }}>{group.title}</strong>
          <small style={{ display: "block", marginTop: 2, fontSize: 8.8, color: "#858078" }}>{group.owner}</small>
        </span>
        <span style={countStyle}>{group.tools.length}</span>
      </summary>
      <div style={{ padding: "0 8px 7px" }}>
        <p style={{ margin: "1px 3px 6px", fontSize: 9, lineHeight: 1.4, color: "#777269" }}>{group.description}</p>
        {group.tools.map((name) => <ToolNode key={name} name={name} />)}
      </div>
    </details>
  );
}

function WebMcpStructure() {
  const readCount = ASYMPTA_WEBMCP_TOOL_NAMES.filter((name) => ASYMPTA_WEBMCP_TOOL_MODES[name] === "READ").length;
  const writeCount = ASYMPTA_WEBMCP_TOOL_NAMES.length - readCount;

  return (
    <section aria-label="WebMCP tool structure" style={rootStyle}>
      <details>
        <summary style={summaryStyle}>
          <span style={{ minWidth: 0 }}>
            <strong style={{ display: "block", fontSize: 11.5, fontWeight: 720, letterSpacing: "-0.01em" }}>
              WebMCP structure · {ASYMPTA_WEBMCP_TOOL_NAMES.length} tools
            </strong>
            <small style={{ display: "block", marginTop: 2, fontSize: 9.5, color: "#777268" }}>
              Click to inspect the actual browser-agent surface
            </small>
          </span>
          <span style={countStyle}>{readCount} READ · {writeCount} WRITE</span>
        </summary>

        <div style={{ maxHeight: "38vh", overflowY: "auto", overscrollBehavior: "contain", padding: "0 1px 7px" }}>
          <div style={{ margin: "1px 1px 7px", padding: "8px 9px", borderRadius: 9, background: "rgba(86, 112, 128, 0.055)", fontSize: 9, lineHeight: 1.45, color: "#6f6a62" }}>
            <strong style={{ display: "block", fontSize: 9.5, color: "#56524b" }}>Browser agent</strong>
            <span>↓ document.modelContext</span><br />
            <span>↓ registerTool(...)</span><br />
            <span>↓ Core · Coordination · Global</span>
          </div>
          {GROUPS.map((group) => <ToolGroup key={group.id} group={group} />)}
          <p style={{ margin: "8px 3px 1px", fontSize: 8.8, lineHeight: 1.4, color: "#858078" }}>
            Consequential WRITE tools remain bounded by Asympta state and explicit human approval.
          </p>
        </div>
      </details>
    </section>
  );
}

export function AsymptaWebMcpToolSurface() {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const locate = () => {
      const next = document.querySelector<HTMLElement>(".atlas-menu-panel");
      setTarget((current) => current === next ? current : next);
    };

    locate();
    const observer = new MutationObserver(locate);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return target ? createPortal(<WebMcpStructure />, target) : null;
}
