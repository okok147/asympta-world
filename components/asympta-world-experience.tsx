"use client";

import {
  Check,
  ChevronRight,
  Globe2,
  Languages,
  MapPin,
  Route,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactElement } from "react";

import { useLivingWorld } from "@/components/living-world/use-living-world";
import { SCENARIO_ORDER, scenarioFor } from "@/lib/living-world/scenarios";
import {
  WORLD_ZONES,
  type AgentTask,
  type Locale,
  type Point,
  type ScenarioId,
  type WorldZoneId,
} from "@/lib/living-world/types";

const tr = (locale: Locale, en: string, zh: string) => (locale === "en" ? en : zh);

const COMMANDS: Array<{ id: ScenarioId | "reset"; slash: string; en: string; zh: string }> = [
  { id: "order", slash: "/order", en: "Run a city order", zh: "運行城市訂單" },
  { id: "dinner", slash: "/dinner", en: "Dinner coordination", zh: "晚餐協調" },
  { id: "work", slash: "/work", en: "Work briefing", zh: "工作簡報" },
  { id: "shopping", slash: "/shopping", en: "Product comparison", zh: "產品比較" },
  { id: "email", slash: "/email", en: "Email handling", zh: "電郵處理" },
  { id: "reset", slash: "/reset", en: "Clear the city", zh: "清除城市流程" },
];

const LANDMARKS: Array<{
  id: string;
  zone: WorldZoneId;
  x: number;
  y: number;
  en: string;
  zh: string;
  metaEn: string;
  metaZh: string;
}> = [
  { id: "home", zone: "human", x: 12, y: 70, en: "Home", zh: "所在地", metaEn: "human intention", metaZh: "人的意圖" },
  { id: "care", zone: "context", x: 24, y: 25, en: "Mori Care", zh: "Mori 售後", metaEn: "support / outer world", metaZh: "售後 / 外部世界" },
  { id: "qa", zone: "research", x: 43, y: 22, en: "Mori QA", zh: "Mori 品質", metaEn: "quality control", metaZh: "品質檢查" },
  { id: "supplier", zone: "market", x: 70, y: 29, en: "North Mill", zh: "North Mill", metaEn: "supplier", metaZh: "供應商" },
  { id: "shop", zone: "communication", x: 34, y: 45, en: "Mori Paper Co.", zh: "Mori Paper Co.", metaEn: "store · owner + business agents", metaZh: "商店 · 店主 + 商戶 Agent" },
  { id: "warehouse", zone: "planning", x: 44, y: 68, en: "Mori Warehouse", zh: "Mori 倉庫", metaEn: "stock + fulfilment", metaZh: "庫存 + 履約" },
  { id: "workshop", zone: "planning", x: 51.5, y: 73.5, en: "Mori Workshop", zh: "Mori 工場", metaEn: "production", metaZh: "生產" },
  { id: "finance", zone: "convergence", x: 58, y: 49, en: "Mori Finance", zh: "Mori 財務", metaEn: "approval + settlement", metaZh: "批准 + 結算" },
  { id: "carrier", zone: "external", x: 87, y: 59, en: "Harbour Courier", zh: "Harbour Courier", metaEn: "carrier + delivery", metaZh: "承運 + 派送" },
];

const MAJOR_ROADS = [
  "M -4 10 C 16 22, 27 13, 40 24 S 71 45, 104 33",
  "M -5 57 C 18 50, 31 61, 48 54 S 71 39, 105 48",
  "M 8 -4 C 16 16, 22 31, 29 48 S 31 72, 40 104",
  "M 53 -5 C 48 15, 55 26, 61 39 S 76 65, 82 103",
  "M 96 -4 C 83 18, 82 38, 76 53 S 64 76, 56 104",
  "M -8 86 C 21 81, 39 84, 55 79 S 82 69, 108 77",
];

const EXPRESS_ROADS = [
  "M -4 31 C 19 20, 34 33, 51 31 S 82 20, 104 28",
  "M 14 -5 C 20 19, 31 35, 44 52 S 62 79, 72 105",
  "M -6 75 C 18 63, 37 70, 55 69 S 84 60, 108 68",
];

const COLOR_BLOCKS = [
  { x: 4, y: 8, w: 7, h: 5, c: "yellow" }, { x: 18, y: 17, w: 6, h: 4, c: "cyan" },
  { x: 29, y: 8, w: 8, h: 7, c: "olive" }, { x: 39, y: 14, w: 4, h: 5, c: "red" },
  { x: 55, y: 6, w: 10, h: 6, c: "yellow" }, { x: 76, y: 11, w: 7, h: 5, c: "orange" },
  { x: 88, y: 17, w: 5, h: 8, c: "olive" }, { x: 9, y: 36, w: 6, h: 7, c: "orange" },
  { x: 25, y: 34, w: 4, h: 4, c: "red" }, { x: 48, y: 34, w: 5, h: 8, c: "cyan" },
  { x: 64, y: 38, w: 8, h: 5, c: "yellow" }, { x: 82, y: 36, w: 5, h: 5, c: "red" },
  { x: 4, y: 62, w: 8, h: 5, c: "olive" }, { x: 20, y: 57, w: 5, h: 7, c: "cyan" },
  { x: 34, y: 62, w: 7, h: 5, c: "yellow" }, { x: 59, y: 62, w: 5, h: 5, c: "red" },
  { x: 73, y: 69, w: 7, h: 7, c: "orange" }, { x: 89, y: 72, w: 6, h: 5, c: "cyan" },
  { x: 12, y: 85, w: 9, h: 6, c: "yellow" }, { x: 38, y: 86, w: 5, h: 5, c: "olive" },
  { x: 56, y: 88, w: 9, h: 5, c: "orange" }, { x: 82, y: 87, w: 8, h: 6, c: "red" },
];

function phaseLabel(locale: Locale, phase: string) {
  const labels: Record<string, [string, string]> = {
    idle: ["City idle", "城市待命"], understanding: ["Reading the intention", "理解意圖"],
    coordinating: ["Agents moving across the city", "Agent 正在城市中移動"], converging: ["Handoffs converging", "交接正在匯合"],
    reporting: ["Returning to you", "正在回到你身邊"], ready: ["Outcome ready", "結果已準備"],
    waiting_for_human: ["Waiting for your approval", "等待你的批准"], completed: ["Complete", "已完成"],
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

function streetGrid() {
  const lines: ReactElement[] = [];
  for (let i = 0; i < 35; i += 1) {
    const x = 1.5 + i * 2.95;
    const bend = ((i % 5) - 2) * 1.2;
    lines.push(<path key={`v-${i}`} d={`M ${x} -2 C ${x + bend} 24, ${x - bend * 0.7} 53, ${x + bend * 0.4} 102`} />);
  }
  for (let i = 0; i < 27; i += 1) {
    const y = 1.2 + i * 3.9;
    const bend = ((i % 7) - 3) * 0.75;
    lines.push(<path key={`h-${i}`} d={`M -2 ${y} C 24 ${y + bend}, 58 ${y - bend * 0.8}, 102 ${y + bend * 0.35}`} />);
  }
  for (let i = 0; i < 18; i += 1) {
    const startY = -12 + i * 6.8;
    lines.push(<path key={`d-${i}`} d={`M -8 ${startY} L ${28 + (i % 4) * 3} ${startY + 23} L 108 ${startY + 48}`} />);
  }
  return lines;
}

function CityMapBackdrop() {
  return (
    <svg className="aw-city-map" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <rect width="100" height="100" className="aw-city-map__paper" />
      <g className="aw-city-map__blocks">
        {COLOR_BLOCKS.map((block, index) => <rect key={index} x={block.x} y={block.y} width={block.w} height={block.h} rx="0.5" className={`aw-city-map__block aw-city-map__block--${block.c}`} />)}
      </g>
      <g className="aw-city-map__streets">{streetGrid()}</g>
      <g className="aw-city-map__district-lines">
        <path d="M 3 17 L 21 5 L 43 17 L 38 38 L 18 42 Z" /><path d="M 45 5 L 66 2 L 76 22 L 62 39 L 42 33 Z" />
        <path d="M 74 25 L 96 17 L 102 41 L 86 56 L 68 45 Z" /><path d="M 4 48 L 25 41 L 39 58 L 31 78 L 7 74 Z" />
        <path d="M 38 45 L 63 39 L 74 58 L 61 79 L 39 73 Z" /><path d="M 69 58 L 93 50 L 103 72 L 91 93 L 68 84 Z" />
      </g>
      <g className="aw-city-map__express">{EXPRESS_ROADS.map((path) => <path key={path} d={path} />)}</g>
      <g className="aw-city-map__river"><path d="M -8 18 C 12 23, 18 15, 30 24 S 42 44, 54 49 S 74 58, 108 44" /></g>
      <g className="aw-city-map__major">{MAJOR_ROADS.map((path) => <path key={path} d={path} />)}</g>
    </svg>
  );
}

function orthogonalPath(from: Point, to: Point, id: string) {
  const horizontalFirst = [...id].reduce((total, char) => total + char.charCodeAt(0), 0) % 2 === 0;
  return horizontalFirst ? `M ${from.x} ${from.y} L ${to.x} ${from.y} L ${to.x} ${to.y}` : `M ${from.x} ${from.y} L ${from.x} ${to.y} L ${to.x} ${to.y}`;
}

function WorldSceneInner({ runtime, locale, selectedAgentId, onSelectAgent }: {
  runtime: ReturnType<typeof useLivingWorld>; locale: Locale; selectedAgentId?: string; onSelectAgent: (id?: string) => void;
}) {
  const { world } = runtime;
  const scenario = world.scenarioId ? scenarioFor(world.scenarioId) : undefined;
  const activeZones = useMemo(() => new Set(world.tasks.filter((task) => task.status === "moving" || task.status === "working").map((task) => task.zone)), [world.tasks]);
  return (
    <section className="aw-city" data-phase={world.phase} data-scenario={world.scenarioId ?? "idle"} onClick={() => onSelectAgent(undefined)}>
      <CityMapBackdrop />
      <div className="aw-city__micro-label aw-city__micro-label--north">NORTH DISTRICT</div><div className="aw-city__micro-label aw-city__micro-label--centre">CENTRAL EXCHANGE</div><div className="aw-city__micro-label aw-city__micro-label--harbour">HARBOUR SIDE</div>
      {LANDMARKS.map((place) => <div key={place.id} className={`aw-place${activeZones.has(place.zone) ? " is-active" : ""}`} style={{ left: `${place.x}%`, top: `${place.y}%` }}><span className="aw-place__dot" /><span className="aw-place__label"><strong>{locale === "en" ? place.en : place.zh}</strong><small>{locale === "en" ? place.metaEn : place.metaZh}</small></span>{place.id === "shop" ? <span className="aw-place__owner"><i />{tr(locale, "owner", "店主")}</span> : null}</div>)}
      <svg className="aw-city__movement" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {world.agents.filter((agent) => agent.status === "moving" || agent.status === "returning" || agent.status === "sharing").map((agent) => <path key={agent.id} className="aw-city__travel-line" d={orthogonalPath(agent.position, agent.target, agent.id)} />)}
        {world.messages.slice(-6).map((message) => { const from = world.agents.find((agent) => agent.id === message.fromId)?.position ?? WORLD_ZONES.human.point; const to = world.agents.find((agent) => agent.id === message.toId)?.position ?? (message.toId === "human" ? WORLD_ZONES.human.point : WORLD_ZONES.convergence.point); const mx = (from.x + to.x) / 2; return <path key={message.id} className={`aw-city__signal aw-city__signal--${message.type}`} d={`M ${from.x} ${from.y} Q ${mx} ${Math.min(from.y, to.y) - 8} ${to.x} ${to.y}`} />; })}
      </svg>
      {world.agents.map((agent) => { const active = ["moving", "working", "sharing", "returning"].includes(agent.status); const currentTask = world.tasks.find((task) => task.id === agent.taskId); return <button key={agent.id} type="button" className={`aw-agent aw-agent--${agent.status}${selectedAgentId === agent.id ? " is-selected" : ""}`} style={{ left: `${agent.position.x}%`, top: `${agent.position.y}%`, "--agent-color": agent.profile.art.primary } as CSSProperties} onClick={(event) => { event.stopPropagation(); onSelectAgent(selectedAgentId === agent.id ? undefined : agent.id); }} aria-label={`${agent.profile.name} · ${agent.profile.role[locale]}`}><span className="aw-agent__shadow" /><span className="aw-agent__figure"><i /><b /></span><span className="aw-agent__tag"><strong>{agent.profile.name}</strong><small>{agent.profile.role[locale]}</small></span>{active ? <span className="aw-agent__thought">{currentTask?.thought[locale] ?? agent.thought[locale]}</span> : null}</button>; })}
      {world.messages.slice(-4).map((message, index) => { const from = world.agents.find((agent) => agent.id === message.fromId)?.position ?? WORLD_ZONES.human.point; const to = world.agents.find((agent) => agent.id === message.toId)?.position ?? (message.toId === "human" ? WORLD_ZONES.human.point : WORLD_ZONES.convergence.point); return <span key={message.id} className="aw-message" style={{ left: `${(from.x + to.x) / 2}%`, top: `${(from.y + to.y) / 2 + (index - 1.5) * 2.7}%` }}>{message.text[locale]}</span>; })}
      {!world.need ? <div className="aw-city__intro"><span>{tr(locale, "CITY-SCALE LIVING WORLD", "城市尺度的生活世界")}</span><h1>{tr(locale, "Ask once. Watch the city coordinate.", "只需提出一次，觀看整座城市開始協調。")}</h1><p>{tr(locale, "Your agent walks to a place in the world model. Business-side agents receive, clarify, source, make, inspect and deliver through the same map.", "你的 Agent 會在世界模型中走到實際位置；商戶側 Agent 會在同一張地圖上接單、釐清、採購、生產、檢查與派送。")}</p><button type="button" onClick={(event) => { event.stopPropagation(); runtime.runScenario("order"); }}>{tr(locale, "Run the city order", "運行城市訂單")}<ChevronRight size={14} /></button></div> : null}
      {scenario?.journey ? <ol className="aw-city-journey" aria-label={tr(locale, "Order journey", "訂單流程")}>{scenario.journey.map((stage, index) => { const status = taskStageStatus(world.tasks, stage.taskIds); return <li key={stage.id} className={`aw-city-journey__item aw-city-journey__item--${status}`}><span>{status === "done" ? <Check size={9} /> : index + 1}</span><strong>{stage.shortLabel[locale]}</strong></li>; })}</ol> : null}
    </section>
  );
}

export function AsymptaWorldExperience() {
  const runtime = useLivingWorld();
  const { world, locale } = runtime;
  const [input, setInput] = useState(""); const [languageOpen, setLanguageOpen] = useState(false); const [selectedAgentId, setSelectedAgentId] = useState<string>(); const [traceOpen, setTraceOpen] = useState(false); const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { const demo = new URLSearchParams(window.location.search).get("demo"); if (demo === "order") runtime.runScenario("order"); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  const selectedAgent = world.agents.find((agent) => agent.id === selectedAgentId);
  const currentTask = selectedAgent ? world.tasks.find((task) => task.agentId === selectedAgent.id && (task.status === "moving" || task.status === "working")) : undefined;
  const commandOpen = input.startsWith("/"); const commandQuery = input.slice(1).toLowerCase(); const filteredCommands = COMMANDS.filter((command) => !commandQuery || `${command.slash} ${command.en} ${command.zh}`.toLowerCase().includes(commandQuery));
  function executeCommand(id: ScenarioId | "reset") { setInput(""); if (id === "reset") runtime.reset(); else runtime.runScenario(id); }
  function submit(event: FormEvent) { event.preventDefault(); const value = input.trim(); if (!value) return; if (value.startsWith("/")) { const match = COMMANDS.find((command) => command.slash.toLowerCase() === value.toLowerCase()) ?? filteredCommands[0]; if (match) executeCommand(match.id); return; } runtime.submitNeed(value); setInput(""); }
  const pendingTask = world.approval.kind === "task" && world.approval.taskId ? world.tasks.find((task) => task.id === world.approval.taskId) : undefined;
  const pendingResultAction = world.approval.kind !== "task" && world.result ? [world.result.primaryAction, world.result.secondaryAction].find((action) => action.id === world.approval.actionId) : undefined;
  const approvalTitle = pendingTask?.approvalLabel?.[locale] ?? pendingTask?.title[locale] ?? pendingResultAction?.label[locale]; const latestEvent = world.events[0];
  return <main className="aw-shell">
    <header className="aw-header"><button type="button" className="aw-brand" onClick={runtime.reset}><span className="aw-brand__mark" aria-hidden="true"><i /><i /><i /></span><span><strong>ASYMPTA WORLD</strong><small>{tr(locale, "city-scale coordination", "城市尺度協調")}</small></span></button><button type="button" className="aw-location" onClick={runtime.requestLocation}><MapPin size={12} /><span>{world.location.worldName[locale]}</span></button><div className="aw-header__status"><i className={world.phase !== "idle" ? "is-live" : ""} />{phaseLabel(locale, world.phase)}</div><div className="aw-header__actions"><button type="button" className="aw-trace-toggle" onClick={() => setTraceOpen((open) => !open)}><Globe2 size={13} />WebMCP</button><div className="aw-language-anchor"><button type="button" className="aw-icon-button aw-icon-button--language" onClick={() => setLanguageOpen((open) => !open)} aria-expanded={languageOpen} aria-label={tr(locale, "Language", "語言")}><Languages size={16} /></button>{languageOpen ? <div className="aw-language-menu"><button type="button" className={locale === "en" ? "is-active" : ""} onClick={() => { runtime.setLocale("en"); setLanguageOpen(false); }}>English</button><button type="button" className={locale === "zh-Hant" ? "is-active" : ""} onClick={() => { runtime.setLocale("zh-Hant"); setLanguageOpen(false); }}>繁體中文</button></div> : null}</div></div></header>
    <WorldSceneInner runtime={runtime} locale={locale} selectedAgentId={selectedAgentId} onSelectAgent={setSelectedAgentId} />
    {selectedAgent ? <aside className="aw-agent-card"><button type="button" className="aw-agent-card__close" onClick={() => setSelectedAgentId(undefined)}><X size={14} /></button><span className="aw-agent-card__eyebrow">{selectedAgent.profile.organisation?.[locale] ?? tr(locale, "Independent", "獨立")}</span><h2>{selectedAgent.profile.name}</h2><p>{selectedAgent.profile.role[locale]}</p><dl><div><dt>{tr(locale, "Status", "狀態")}</dt><dd>{selectedAgent.status}</dd></div><div><dt>{tr(locale, "Now", "現在")}</dt><dd>{currentTask?.title[locale] ?? selectedAgent.thought[locale]}</dd></div><div><dt>{tr(locale, "Side", "一方")}</dt><dd>{selectedAgent.profile.side ?? "personal"}</dd></div></dl>{selectedAgent.lastOutput ? <div className="aw-agent-card__output"><span>{tr(locale, "Last handoff", "最近交接")}</span>{selectedAgent.lastOutput[locale]}</div> : null}</aside> : null}
    {latestEvent && world.need ? <div className="aw-world-signal"><span><i />{tr(locale, "LIVE", "即時")}</span><strong>{latestEvent.title[locale]}</strong>{latestEvent.detail ? <small>{latestEvent.detail[locale]}</small> : null}</div> : null}
    {traceOpen ? <aside className="aw-trace-panel"><header><span><Globe2 size={13} />WebMCP trace</span><button type="button" onClick={() => setTraceOpen(false)}><X size={14} /></button></header><p>Same event state powers UI + WebMCP.</p><div className="aw-trace-panel__facts"><span>{world.agents.length} agents</span><span>{world.tasks.filter((task) => task.status === "done").length}/{world.tasks.length} tasks</span><span>{world.messages.length} live exchanges</span></div><pre>{JSON.stringify({ phase: world.phase, scenario: world.scenarioId, approval: world.approval.status, active: world.tasks.filter((task) => task.status === "moving" || task.status === "working").map((task) => task.id) }, null, 2)}</pre></aside> : null}
    <form className="aw-composer" onSubmit={submit}><Route size={14} /><input ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} placeholder={tr(locale, "Tell the city what you need… or type /order", "告訴城市你的需要… 或輸入 /order")} /><button type="submit" aria-label={tr(locale, "Send", "發送")}><Send size={14} /></button>{commandOpen ? <div className="aw-command-menu">{filteredCommands.map((command) => <button type="button" key={command.slash} onClick={() => executeCommand(command.id)}><code>{command.slash}</code><span>{locale === "en" ? command.en : command.zh}</span></button>)}</div> : null}</form>
    {world.result ? <section className="aw-result-card"><span>{world.result.eyebrow[locale]}</span><h2>{world.result.title[locale]}</h2><p>{world.result.subtitle[locale]}</p><div>{world.result.facts.slice(0, 3).map((fact) => <span key={fact.label.en}><small>{fact.label[locale]}</small><strong>{fact.value[locale]}</strong></span>)}</div><footer><button type="button" onClick={() => runtime.chooseAction(world.result!.primaryAction.id)}>{world.result.primaryAction.label[locale]}</button><button type="button" onClick={() => runtime.chooseAction(world.result!.secondaryAction.id)}>{world.result.secondaryAction.label[locale]}</button></footer></section> : null}
    {world.approval.status === "pending" && approvalTitle ? <div className="aw-approval-backdrop"><section className="aw-approval-card" role="dialog" aria-modal="true"><span><ShieldCheck size={17} /></span><small>{tr(locale, "HUMAN CHECKPOINT", "人的批准關卡")}</small><h2>{approvalTitle}</h2><p>{tr(locale, "The city stops here. Nothing consequential moves until you approve it.", "城市在這裡停下。任何重要行動都要在你批准後才會繼續。")}</p><div><button type="button" onClick={() => runtime.resolveApproval(false)}>{tr(locale, "Hold", "暫停")}</button><button type="button" onClick={() => runtime.resolveApproval(true)}>{tr(locale, "Approve", "批准")}</button></div></section></div> : null}
    <div className="aw-safety-note"><ShieldCheck size={11} />{tr(locale, "Simulation · no real order, payment, message or shipment occurs", "模擬模式 · 不會真的下單、付款、傳訊息或出貨")}</div>
  </main>;
}

export { SCENARIO_ORDER };
