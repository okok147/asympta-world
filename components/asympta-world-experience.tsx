"use client";

import {
  Check,
  ChevronRight,
  CircleDot,
  Globe2,
  Languages,
  MapPin,
  PackageCheck,
  Radio,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Waypoints,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { AgentPortrait } from "@/components/living-world/agent-portrait";
import { P5AtmosphereCanvas } from "@/components/living-world/p5-atmosphere-canvas";
import { ThreeWorldCanvas } from "@/components/living-world/three-world-canvas";
import { useLivingWorld } from "@/components/living-world/use-living-world";
import { VgpuWorldField } from "@/components/living-world/vgpu-world-field";
import { SCENARIO_ORDER, scenarioFor } from "@/lib/living-world/scenarios";
import { WORLD_ZONES, type AgentTask, type Locale, type ScenarioId, type WorldZoneId } from "@/lib/living-world/types";

const tr = (locale: Locale, en: string, zh: string) => (locale === "en" ? en : zh);

const COMMANDS: Array<{ id: ScenarioId | "reset"; slash: string; en: string; zh: string }> = [
  { id: "order", slash: "/order", en: "Complete order flow", zh: "完整訂單流程" },
  { id: "dinner", slash: "/dinner", en: "Dinner coordination", zh: "晚餐協調" },
  { id: "work", slash: "/work", en: "Work briefing", zh: "工作簡報" },
  { id: "shopping", slash: "/shopping", en: "Product comparison", zh: "產品比較" },
  { id: "email", slash: "/email", en: "Email handling", zh: "電郵處理" },
  { id: "reset", slash: "/reset", en: "Clear the current need", zh: "清除目前需要" },
];

const ZONE_ORDER: WorldZoneId[] = ["human", "context", "communication", "research", "market", "planning", "convergence", "external"];

function phaseLabel(locale: Locale, phase: string) {
  const labels: Record<string, [string, string]> = {
    idle: ["Waiting for a need", "等待一項需要"],
    understanding: ["Understanding intention", "理解人的意圖"],
    coordinating: ["World coordinating", "世界正在協調"],
    converging: ["Evidence converging", "證據正在匯合"],
    reporting: ["Returning the outcome", "正在帶回結果"],
    ready: ["Outcome ready", "結果已準備"],
    waiting_for_human: ["Waiting for your judgment", "等待你的判斷"],
    completed: ["Complete", "已完成"],
  };
  const value = labels[phase] ?? labels.idle;
  return locale === "en" ? value[0] : value[1];
}

function taskStageStatus(tasks: AgentTask[], ids: string[]) {
  const stage = ids.map((id) => tasks.find((task) => task.id === id)).filter(Boolean) as AgentTask[];
  if (!stage.length) return "waiting";
  if (stage.every((task) => task.status === "done")) return "done";
  if (stage.some((task) => task.status === "moving" || task.status === "working" || task.approvalStatus === "pending")) return "active";
  if (stage.some((task) => task.status === "done")) return "active";
  return "waiting";
}

function WorldSceneInner({ runtime, locale, selectedAgentId, onSelectAgent }: { runtime: ReturnType<typeof useLivingWorld>; locale: Locale; selectedAgentId?: string; onSelectAgent: (id?: string) => void }) {
  const { world } = runtime;
  const scenario = world.scenarioId ? scenarioFor(world.scenarioId) : undefined;
  const relevantZones = useMemo(() => {
    if (!scenario) return ZONE_ORDER;
    const found = new Set<WorldZoneId>(["human", "convergence"]);
    scenario.tasks.forEach((task) => found.add(task.zone));
    scenario.services.forEach((service) => found.add(service.zone));
    return ZONE_ORDER.filter((zone) => found.has(zone));
  }, [scenario]);

  return (
    <section className="aw-world" data-phase={world.phase} data-scenario={world.scenarioId ?? "idle"} onClick={() => onSelectAgent(undefined)}>
      <div className="aw-world__ambient" aria-hidden="true">
        <VgpuWorldField world={world} />
        <ThreeWorldCanvas world={world} cameraFollow={runtime.cameraFollow} />
        <P5AtmosphereCanvas world={world} />
      </div>
      <div className="aw-world__grid" aria-hidden="true" />
      <svg className="aw-world__routes" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path d="M12 70 C22 59 29 51 34 45 S48 49 58 49 S76 43 87 59" />
        <path d="M24 25 C35 31 40 38 43 22 S62 25 70 29 S81 44 87 59" />
        <path d="M34 45 C42 55 45 64 47 69 S55 59 58 49" />
      </svg>

      {relevantZones.map((zone) => {
        const config = WORLD_ZONES[zone];
        const active = world.tasks.some((task) => task.zone === zone && (task.status === "moving" || task.status === "working"));
        return (
          <div key={zone} className={`aw-zone aw-zone--${zone}${active ? " is-active" : ""}`} style={{ left: `${config.point.x}%`, top: `${config.point.y}%` }}>
            <span className="aw-zone__mark" aria-hidden="true"><i /><i /><i /><i /></span>
            <span><strong>{config.shortLabel[locale]}</strong><small>{config.label[locale]}</small></span>
          </div>
        );
      })}

      <div className="aw-human" style={{ left: `${WORLD_ZONES.human.point.x}%`, top: `${WORLD_ZONES.human.point.y}%` }}>
        <span className="aw-human__figure" aria-hidden="true"><i /><i /><i /></span>
        <span className="aw-human__copy"><strong>{tr(locale, "You", "你")}</strong><small>{tr(locale, "Human intention", "人的意圖")}</small></span>
        {world.need ? <span className="aw-human__need"><b>{tr(locale, "Need", "需要")}</b>{world.need.text}</span> : null}
      </div>

      {scenario?.services.map((service, index) => {
        const point = WORLD_ZONES[service.zone].point;
        const running = world.toolRuns.some((run) => run.toolId === service.id && run.status === "running");
        return (
          <span key={service.id} className={`aw-service${running ? " is-running" : ""}`} style={{ left: `${Math.min(92, point.x + 5 + (index % 2) * 1.8)}%`, top: `${Math.max(8, point.y - 7 + (index % 3) * 4.5)}%` }} title={service.description[locale]}>
            <i /><span>{service.name[locale]}</span><small>{service.mode.toUpperCase()}</small>
          </span>
        );
      })}

      {world.agents.map((agent) => {
        const busy = ["moving", "working", "sharing", "returning"].includes(agent.status);
        return (
          <button
            key={agent.id}
            type="button"
            className={`aw-agent aw-agent--${agent.status}${selectedAgentId === agent.id ? " is-selected" : ""}`}
            style={{ left: `${agent.position.x}%`, top: `${agent.position.y}%` }}
            aria-pressed={selectedAgentId === agent.id}
            onClick={(event) => { event.stopPropagation(); onSelectAgent(selectedAgentId === agent.id ? undefined : agent.id); }}
          >
            {busy ? <span className="aw-agent__thought"><Radio size={9} />{agent.thought[locale]}</span> : null}
            <span className="aw-agent__portrait"><AgentPortrait profile={agent.profile} size="small" active={agent.status === "working"} /></span>
            <span className="aw-agent__name"><strong>{agent.profile.name}</strong><small>{agent.profile.role[locale]}</small></span>
          </button>
        );
      })}

      {world.messages.slice(-4).map((message, index) => {
        const from = world.agents.find((agent) => agent.id === message.fromId)?.position ?? WORLD_ZONES.human.point;
        const to = world.agents.find((agent) => agent.id === message.toId)?.position ?? (message.toId === "human" ? WORLD_ZONES.human.point : WORLD_ZONES.convergence.point);
        return <span key={message.id} className={`aw-message aw-message--${message.type}`} style={{ left: `${(from.x + to.x) / 2}%`, top: `${(from.y + to.y) / 2 + (index - 1.5) * 4}%` }}><CircleDot size={8} />{message.text[locale]}</span>;
      })}

      {!world.need ? (
        <div className="aw-world__empty">
          <span><Sparkles size={16} /></span>
          <strong>{tr(locale, "One intention. Every side moves.", "一個意圖，所有角色開始行動。")}</strong>
          <p>{tr(locale, "Start the order flow to see customer, business, merchandiser, supplier, production, finance and delivery coordinate in one continuous world.", "啟動訂單流程，觀看客戶、商戶、跟單、供應商、生產、財務與派送在同一個連續世界協調。")}</p>
        </div>
      ) : null}
    </section>
  );
}

export function AsymptaWorldExperience() {
  const runtime = useLivingWorld();
  const { world, locale } = runtime;
  const [input, setInput] = useState("");
  const [languageOpen, setLanguageOpen] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string>();
  const [traceOpen, setTraceOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scenario = world.scenarioId ? scenarioFor(world.scenarioId) : undefined;

  useEffect(() => {
    const demo = new URLSearchParams(window.location.search).get("demo");
    if (demo === "order") runtime.runScenario("order");
  // run once for query fast-path
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedAgent = world.agents.find((agent) => agent.id === selectedAgentId);
  const commandOpen = input.startsWith("/");
  const commandQuery = input.slice(1).toLowerCase();
  const filteredCommands = COMMANDS.filter((command) => !commandQuery || `${command.slash} ${command.en} ${command.zh}`.toLowerCase().includes(commandQuery));

  function executeCommand(id: ScenarioId | "reset") {
    setInput("");
    if (id === "reset") runtime.reset();
    else runtime.runScenario(id);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const value = input.trim();
    if (!value) return;
    if (value.startsWith("/")) {
      const match = COMMANDS.find((command) => command.slash.toLowerCase() === value.toLowerCase()) ?? filteredCommands[0];
      if (match) executeCommand(match.id);
      return;
    }
    runtime.submitNeed(value);
    setInput("");
  }

  const pendingTask = world.approval.kind === "task" && world.approval.taskId ? world.tasks.find((task) => task.id === world.approval.taskId) : undefined;
  const pendingResultAction = world.approval.kind !== "task" && world.result ? [world.result.primaryAction, world.result.secondaryAction].find((action) => action.id === world.approval.actionId) : undefined;
  const approvalTitle = pendingTask?.approvalLabel?.[locale] ?? pendingTask?.title[locale] ?? pendingResultAction?.label[locale];

  return (
    <main className="aw-shell">
      <header className="aw-header">
        <div className="aw-brand"><span className="aw-brand__mark" aria-hidden="true"><i /><i /><i /><i /><i /></span><span><strong>ASYMPTA WORLD</strong><small>{tr(locale, "Humans live. Agents coordinate.", "人生活，Agent 協調世界。")}</small></span></div>
        <button type="button" className="aw-location" onClick={runtime.requestLocation}><MapPin size={13} /><span><strong>{world.location.worldName[locale]}</strong><small>{world.location.source === "device" ? tr(locale, "Device area · coordinates hidden", "裝置區域 · 座標隱藏") : tr(locale, "Calm simulated local world", "平靜的模擬所在地世界")}</small></span></button>
        <div className="aw-header__actions">
          <span className={`aw-webmcp${runtime.webMcpState === "native" ? " is-native" : ""}`}><Globe2 size={13} />WebMCP<small>{runtime.webMcpState === "native" ? "NATIVE" : "READY"}</small></span>
          <div className="aw-language-anchor">
            <button type="button" className="aw-icon-button aw-icon-button--language" onClick={() => setLanguageOpen((open) => !open)} aria-expanded={languageOpen} aria-label={tr(locale, "Language", "語言")}><Languages size={17} /></button>
            {languageOpen ? <div className="aw-language-menu"><button type="button" className={locale === "en" ? "is-active" : ""} onClick={() => { runtime.setLocale("en"); setLanguageOpen(false); }}>English</button><button type="button" className={locale === "zh-Hant" ? "is-active" : ""} onClick={() => { runtime.setLocale("zh-Hant"); setLanguageOpen(false); }}>繁體中文</button></div> : null}
          </div>
        </div>
      </header>

      <section className="aw-thesis" aria-label="Product thesis"><span>{tr(locale, "A real-world coordination layer, not another task dashboard.", "一個真實世界協調層，而不是另一個任務儀表板。")}</span><span><ShieldCheck size={12} />{tr(locale, "Consequential actions stop for you", "重要行動會停下來等待你")}</span></section>

      {scenario?.journey ? (
        <ol className="aw-journey" aria-label={tr(locale, "End-to-end economic process", "端對端經濟流程")}>
          {scenario.journey.map((stage, index) => {
            const status = taskStageStatus(world.tasks, stage.taskIds);
            return <li key={stage.id} className={`aw-journey__item aw-journey__item--${status}`}><span>{status === "done" ? <Check size={10} /> : index + 1}</span><strong>{stage.shortLabel[locale]}</strong><small>{stage.organisation[locale]}</small></li>;
          })}
        </ol>
      ) : null}

      <section className="aw-stage-wrap">
        <WorldSceneInner runtime={runtime} locale={locale} selectedAgentId={selectedAgentId} onSelectAgent={setSelectedAgentId} />
        <aside className={`aw-inspector${selectedAgent ? " is-open" : ""}`} aria-hidden={!selectedAgent}>
          {selectedAgent ? <><button type="button" className="aw-inspector__close" onClick={() => setSelectedAgentId(undefined)}><X size={15} /></button><AgentPortrait profile={selectedAgent.profile} size="large" active={selectedAgent.status === "working"} /><small>{selectedAgent.profile.organisation?.[locale] ?? tr(locale, "Asympta world", "Asympta 世界")}</small><h2>{selectedAgent.profile.name}</h2><strong>{selectedAgent.profile.role[locale]}</strong><p>{selectedAgent.profile.competence[locale]}</p><div className="aw-inspector__status"><Radio size={11} />{selectedAgent.thought[locale]}</div></> : null}
        </aside>

        {world.result ? <section className="aw-result"><span className="aw-result__eyebrow"><PackageCheck size={13} />{world.result.eyebrow[locale]}</span><h2>{world.result.title[locale]}</h2><p>{world.result.subtitle[locale]}</p><div className="aw-result__facts">{world.result.facts.map((fact) => <span key={fact.label.en}><small>{fact.label[locale]}</small><strong>{fact.value[locale]}</strong></span>)}</div><div className="aw-result__actions"><button type="button" onClick={() => runtime.choose(world.result!.primaryAction.id)}>{world.result.primaryAction.label[locale]}</button><button type="button" className="is-consequential" onClick={() => runtime.choose(world.result!.secondaryAction.id)}><ShieldCheck size={13} />{world.result.secondaryAction.label[locale]}</button></div><small className="aw-result__disclosure">{world.result.disclosure[locale]}</small></section> : null}

        {scenario && world.need ? <button type="button" className="aw-trace-toggle" onClick={() => setTraceOpen((open) => !open)} aria-expanded={traceOpen}><Waypoints size={13} />{tr(locale, "Process trace", "流程軌跡")}<span>{world.tasks.filter((task) => task.status === "done").length}/{world.tasks.length}</span></button> : null}
        {traceOpen ? <section className="aw-trace"><header><strong>{tr(locale, "Why the world moved", "世界為何移動")}</strong><button type="button" onClick={() => setTraceOpen(false)}><X size={14} /></button></header><ol>{world.events.filter((event) => event.type !== "task_created").slice(0, 10).map((event) => <li key={event.id}><i /><span><strong>{event.title[locale]}</strong>{event.detail ? <small>{event.detail[locale]}</small> : null}</span></li>)}</ol></section> : null}
      </section>

      <section className={`aw-composer${commandOpen ? " has-commands" : ""}`}>
        {!world.need ? <div className="aw-scenarios"><span>{tr(locale, "Start with", "從這裡開始")}</span>{SCENARIO_ORDER.map((id) => { const item = scenarioFor(id); return <button type="button" key={id} className={id === "order" ? "is-featured" : ""} onClick={() => runtime.runScenario(id)}>{id === "order" ? <PackageCheck size={13} /> : <Sparkles size={12} />}{item.label[locale]}</button>; })}</div> : <div className="aw-active-need"><span><i />{phaseLabel(locale, world.phase)}</span><button type="button" onClick={runtime.reset}><RefreshCw size={12} />{tr(locale, "Restart", "重設")}</button></div>}
        {commandOpen ? <div className="aw-command-menu" role="listbox">{filteredCommands.map((command) => <button type="button" key={command.id} onClick={() => executeCommand(command.id)}><span><strong>{locale === "en" ? command.en : command.zh}</strong><small>{command.slash}</small></span><ChevronRight size={14} /></button>)}</div> : null}
        <form onSubmit={submit} className="aw-composer__form"><input ref={inputRef} id="need-composer" value={input} onChange={(event) => setInput(event.target.value)} placeholder={tr(locale, "Type /order or tell Asympta what you need…", "輸入 /order 或告訴 Asympta 你需要甚麼…")} autoComplete="off" /><button type="submit" disabled={!input.trim()}><Send size={17} /><span>{tr(locale, "Send", "送出")}</span></button></form>
        <footer><span><ShieldCheck size={10} />{tr(locale, "Simulated commerce · no real charge or shipment", "模擬商業流程 · 沒有真實扣款或貨運")}</span><span>{tr(locale, "Same event state powers UI + WebMCP", "UI + WebMCP 共用同一事件狀態")}</span></footer>
      </section>

      {world.approval.status === "pending" && approvalTitle ? <div className="aw-approval-backdrop"><section className="aw-approval" role="alertdialog" aria-modal="true"><span className="aw-approval__icon"><ShieldCheck size={20} /></span><small>{tr(locale, "HUMAN JUDGMENT", "人的判斷")}</small><h2>{approvalTitle}</h2><p>{pendingTask ? tr(locale, "The world has prepared the order up to a consequential payment / dispatch boundary. Approving continues only the simulated state; no supplier, payment or carrier action is real.", "世界已把訂單準備至重要的付款／出貨邊界。批准只會繼續模擬狀態；供應商、付款及承運商都不會真的執行。") : tr(locale, "Agents can prepare this action, but only you authorize it. This release has no live external commerce connector.", "Agent 可以準備這項行動，但只有你能授權。目前版本沒有真實外部商業連接。")}</p><div className="aw-approval__actions"><button type="button" onClick={() => runtime.approve(false)}>{tr(locale, "Keep on hold", "繼續暫停")}</button><button type="button" className="is-primary" onClick={() => runtime.approve(true)}><ShieldCheck size={14} />{tr(locale, "Approve simulated handoff", "批准模擬交接")}</button></div></section></div> : null}
    </main>
  );
}

export default AsymptaWorldExperience;
