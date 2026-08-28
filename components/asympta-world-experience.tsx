"use client";

import {
  Check,
  ChevronRight,
  Globe2,
  Languages,
  MapPin,
  Minus,
  Plus,
  RotateCcw,
  Route,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from "react";

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

const PIXEL_MAP_WIDTH = 256;
const PIXEL_MAP_HEIGHT = 144;

const PIXEL_MAJOR_ROADS: Point[][] = [
  [{ x: -4, y: 10 }, { x: 12, y: 21 }, { x: 26, y: 14 }, { x: 41, y: 25 }, { x: 58, y: 39 }, { x: 76, y: 44 }, { x: 104, y: 33 }],
  [{ x: -5, y: 57 }, { x: 17, y: 50 }, { x: 31, y: 61 }, { x: 49, y: 54 }, { x: 67, y: 43 }, { x: 84, y: 41 }, { x: 105, y: 48 }],
  [{ x: 8, y: -4 }, { x: 15, y: 15 }, { x: 22, y: 31 }, { x: 29, y: 48 }, { x: 31, y: 71 }, { x: 40, y: 104 }],
  [{ x: 53, y: -5 }, { x: 49, y: 14 }, { x: 55, y: 26 }, { x: 61, y: 39 }, { x: 69, y: 53 }, { x: 77, y: 72 }, { x: 82, y: 103 }],
  [{ x: 96, y: -4 }, { x: 85, y: 18 }, { x: 82, y: 38 }, { x: 76, y: 53 }, { x: 66, y: 76 }, { x: 56, y: 104 }],
  [{ x: -8, y: 86 }, { x: 19, y: 81 }, { x: 39, y: 84 }, { x: 55, y: 79 }, { x: 82, y: 69 }, { x: 108, y: 77 }],
];

const PIXEL_EXPRESS_ROADS: Point[][] = [
  [{ x: -4, y: 31 }, { x: 18, y: 20 }, { x: 35, y: 33 }, { x: 52, y: 31 }, { x: 81, y: 20 }, { x: 104, y: 28 }],
  [{ x: 14, y: -5 }, { x: 20, y: 19 }, { x: 31, y: 35 }, { x: 44, y: 52 }, { x: 62, y: 79 }, { x: 72, y: 105 }],
  [{ x: -6, y: 75 }, { x: 18, y: 63 }, { x: 37, y: 70 }, { x: 55, y: 69 }, { x: 84, y: 60 }, { x: 108, y: 68 }],
];

const PIXEL_PURPLE_ROUTES: Point[][] = [
  [{ x: -8, y: 18 }, { x: 11, y: 23 }, { x: 20, y: 16 }, { x: 30, y: 25 }, { x: 39, y: 39 }, { x: 55, y: 49 }, { x: 74, y: 58 }, { x: 108, y: 44 }],
  [{ x: -4, y: 64 }, { x: 16, y: 60 }, { x: 29, y: 68 }, { x: 47, y: 63 }, { x: 63, y: 69 }, { x: 79, y: 83 }, { x: 104, y: 91 }],
];

const PIXEL_CYAN_ROUTES: Point[][] = [
  [{ x: 58, y: -4 }, { x: 58, y: 18 }, { x: 55, y: 35 }, { x: 57, y: 50 }, { x: 63, y: 68 }, { x: 71, y: 88 }, { x: 76, y: 104 }],
  [{ x: 101, y: 26 }, { x: 87, y: 32 }, { x: 78, y: 46 }, { x: 76, y: 64 }, { x: 84, y: 78 }, { x: 93, y: 92 }],
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

function PixelCityCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    const sx = (x: number) => Math.round((x / 100) * PIXEL_MAP_WIDTH);
    const sy = (y: number) => Math.round((y / 100) * PIXEL_MAP_HEIGHT);
    const drawRoad = (points: Point[], colour: string, width: number) => {
      ctx.beginPath();
      points.forEach((point, index) => {
        const x = sx(point.x); const y = sy(point.y);
        if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = colour; ctx.lineWidth = width; ctx.lineCap = "butt"; ctx.lineJoin = "miter"; ctx.stroke();
    };

    ctx.fillStyle = "#f7f6f1"; ctx.fillRect(0, 0, PIXEL_MAP_WIDTH, PIXEL_MAP_HEIGHT);
    for (let i = 0; i < 860; i += 1) {
      const x = (i * 47 + Math.floor(i / 9) * 11) % PIXEL_MAP_WIDTH;
      const y = (i * 83 + Math.floor(i / 7) * 13) % PIXEL_MAP_HEIGHT;
      ctx.fillStyle = i % 5 === 0 ? "#eeece4" : "#f2f0e9";
      ctx.fillRect(x, y, 1, 1);
    }
    const palette: Record<string, string> = { yellow: "#efc946", orange: "#df9345", red: "#c94258", cyan: "#3ca7b9", olive: "#919a43" };
    COLOR_BLOCKS.forEach((block) => {
      ctx.fillStyle = palette[block.c] ?? "#d5d2c8";
      ctx.fillRect(sx(block.x), sy(block.y), Math.max(2, sx(block.w) - sx(0)), Math.max(2, sy(block.h) - sy(0)));
    });

    for (let i = 0; i < 29; i += 1) {
      const x = 2 + i * 3.55;
      drawRoad([{ x, y: -3 }, { x: x + ((i % 5) - 2) * 1.4, y: 28 }, { x: x - ((i % 4) - 1.5) * 1.2, y: 59 }, { x: x + ((i % 7) - 3) * .8, y: 103 }], "rgba(71,72,72,.30)", 1);
    }
    for (let i = 0; i < 22; i += 1) {
      const y = 2 + i * 4.65;
      drawRoad([{ x: -3, y }, { x: 31, y: y + ((i % 5) - 2) * 1.2 }, { x: 66, y: y - ((i % 4) - 1.5) }, { x: 103, y: y + ((i % 7) - 3) * .65 }], "rgba(71,72,72,.27)", 1);
    }
    for (let i = 0; i < 13; i += 1) {
      const startY = -18 + i * 9;
      drawRoad([{ x: -4, y: startY }, { x: 34, y: startY + 27 }, { x: 69, y: startY + 43 }, { x: 104, y: startY + 64 }], "rgba(71,72,72,.20)", 1);
    }
    PIXEL_PURPLE_ROUTES.forEach((road) => drawRoad(road, "#69558a", 5));
    PIXEL_CYAN_ROUTES.forEach((road) => drawRoad(road, "#1596ad", 3));
    PIXEL_EXPRESS_ROADS.forEach((road) => drawRoad(road, "#211d23", 4));
    PIXEL_MAJOR_ROADS.forEach((road) => drawRoad(road, "#2b282c", 2));
  }, []);
  return <canvas ref={canvasRef} className="aw-pixel-city-map" width={PIXEL_MAP_WIDTH} height={PIXEL_MAP_HEIGHT} aria-hidden="true" />;
}

function snapPoint(point: Point): Point {
  const xStep = 100 / PIXEL_MAP_WIDTH; const yStep = 100 / PIXEL_MAP_HEIGHT;
  return { x: Math.round(point.x / xStep) * xStep, y: Math.round(point.y / yStep) * yStep };
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
  const cityRef = useRef<HTMLElement>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const [camera, setCamera] = useState({ scale: 1, x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const clampScale = (value: number) => Math.min(4, Math.max(.85, value));
  const zoomTo = (nextScale: number, clientX?: number, clientY?: number) => {
    const rect = cityRef.current?.getBoundingClientRect();
    setCamera((previous) => {
      const scale = clampScale(nextScale);
      if (!rect || clientX === undefined || clientY === undefined || previous.scale === 0) return { ...previous, scale };
      const px = clientX - rect.left - rect.width / 2; const py = clientY - rect.top - rect.height / 2;
      const ratio = scale / previous.scale;
      const limitX = rect.width * Math.max(.4, scale - .55); const limitY = rect.height * Math.max(.4, scale - .55);
      return { scale, x: Math.max(-limitX, Math.min(limitX, px - (px - previous.x) * ratio)), y: Math.max(-limitY, Math.min(limitY, py - (py - previous.y) * ratio)) };
    });
  };
  const handleWheel = (event: ReactWheelEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest("button, input")) return;
    event.preventDefault(); zoomTo(camera.scale * (event.deltaY < 0 ? 1.14 : .88), event.clientX, event.clientY);
  };
  const handlePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest("button, input")) return;
    event.currentTarget.setPointerCapture(event.pointerId); dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }; setPanning(true);
  };
  const handlePointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current; if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.x; const dy = event.clientY - drag.y; dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    const rect = cityRef.current?.getBoundingClientRect();
    setCamera((previous) => { const limitX = (rect?.width ?? 800) * Math.max(.4, previous.scale - .55); const limitY = (rect?.height ?? 600) * Math.max(.4, previous.scale - .55); return { ...previous, x: Math.max(-limitX, Math.min(limitX, previous.x + dx)), y: Math.max(-limitY, Math.min(limitY, previous.y + dy)) }; });
  };
  const handlePointerEnd = (event: ReactPointerEvent<HTMLElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null; setPanning(false);
  };
  return (
    <section ref={cityRef} className={`aw-city${panning ? " is-panning" : ""}`} data-phase={world.phase} data-scenario={world.scenarioId ?? "idle"} onClick={() => onSelectAgent(undefined)} onWheel={handleWheel} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerEnd} onPointerCancel={handlePointerEnd}>
      <div className="aw-city__camera" style={{ transform: `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.scale})` }}>
        <PixelCityCanvas />
        <div className="aw-city__micro-label aw-city__micro-label--north">NORTH DISTRICT</div><div className="aw-city__micro-label aw-city__micro-label--centre">CENTRAL EXCHANGE</div><div className="aw-city__micro-label aw-city__micro-label--harbour">HARBOUR SIDE</div>
        {LANDMARKS.map((place) => { const point = snapPoint({ x: place.x, y: place.y }); return <div key={place.id} className={`aw-place${activeZones.has(place.zone) ? " is-active" : ""}`} style={{ left: `${point.x}%`, top: `${point.y}%` }}><span className="aw-place__dot" /><span className="aw-place__label"><strong>{locale === "en" ? place.en : place.zh}</strong><small>{locale === "en" ? place.metaEn : place.metaZh}</small></span>{place.id === "shop" ? <span className="aw-place__owner"><i />{tr(locale, "owner", "店主")}</span> : null}</div>; })}
        <svg className="aw-city__movement" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {world.agents.filter((agent) => agent.status === "moving" || agent.status === "returning" || agent.status === "sharing").map((agent) => { const from = snapPoint(agent.position); const to = snapPoint(agent.target); return <path key={agent.id} className="aw-city__travel-line" d={orthogonalPath(from, to, agent.id)} />; })}
          {world.messages.slice(-6).map((message) => { const rawFrom = world.agents.find((agent) => agent.id === message.fromId)?.position ?? WORLD_ZONES.human.point; const rawTo = world.agents.find((agent) => agent.id === message.toId)?.position ?? (message.toId === "human" ? WORLD_ZONES.human.point : WORLD_ZONES.convergence.point); const from = snapPoint(rawFrom); const to = snapPoint(rawTo); return <path key={message.id} className={`aw-city__signal aw-city__signal--${message.type}`} d={orthogonalPath(from, to, message.id)} />; })}
        </svg>
        {world.agents.map((agent) => { const active = ["moving", "working", "sharing", "returning"].includes(agent.status); const currentTask = world.tasks.find((task) => task.id === agent.taskId); const point = snapPoint(agent.position); return <button key={agent.id} type="button" className={`aw-agent aw-agent--${agent.status}${selectedAgentId === agent.id ? " is-selected" : ""}`} style={{ left: `${point.x}%`, top: `${point.y}%`, "--agent-color": agent.profile.art.primary } as CSSProperties} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onSelectAgent(selectedAgentId === agent.id ? undefined : agent.id); }} aria-label={`${agent.profile.name} · ${agent.profile.role[locale]}`}><span className="aw-agent__shadow" /><span className="aw-agent__figure"><i /><b /></span><span className="aw-agent__tag"><strong>{agent.profile.name}</strong><small>{agent.profile.role[locale]}</small></span>{active ? <span className="aw-agent__thought">{currentTask?.thought[locale] ?? agent.thought[locale]}</span> : null}</button>; })}
        {world.messages.slice(-4).map((message, index) => { const rawFrom = world.agents.find((agent) => agent.id === message.fromId)?.position ?? WORLD_ZONES.human.point; const rawTo = world.agents.find((agent) => agent.id === message.toId)?.position ?? (message.toId === "human" ? WORLD_ZONES.human.point : WORLD_ZONES.convergence.point); const from = snapPoint(rawFrom); const to = snapPoint(rawTo); const point = snapPoint({ x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 + (index - 1.5) * 2.7 }); return <span key={message.id} className="aw-message" style={{ left: `${point.x}%`, top: `${point.y}%` }}>{message.text[locale]}</span>; })}
      </div>
      <div className="aw-map-zoom" aria-label={tr(locale, "Map zoom", "地圖縮放")}>
        <button type="button" aria-label={tr(locale, "Zoom in", "放大")} onPointerDown={(event) => event.stopPropagation()} onClick={() => zoomTo(camera.scale * 1.25)}><Plus size={15} /></button>
        <span>{Math.round(camera.scale * 100)}%</span>
        <button type="button" aria-label={tr(locale, "Zoom out", "縮小")} onPointerDown={(event) => event.stopPropagation()} onClick={() => zoomTo(camera.scale / 1.25)}><Minus size={15} /></button>
        <button type="button" aria-label={tr(locale, "Reset map view", "重設地圖視角")} onPointerDown={(event) => event.stopPropagation()} onClick={() => setCamera({ scale: 1, x: 0, y: 0 })}><RotateCcw size={13} /></button>
      </div>
      {!world.need ? <div className="aw-city__intro"><span>{tr(locale, "PIXEL CITY · CITY-SCALE LIVING WORLD", "像素城市 · 生活世界")}</span><h1>{tr(locale, "Ask once. Watch the city coordinate.", "只需提出一次，觀看整座像素城市開始協調。")}</h1><p>{tr(locale, "Business-side agents receive, clarify, source, make, inspect and deliver through the same map. Every road, district, place and moving agent lives on the same literal pixel grid. Scroll or use + / − to zoom; drag the map to explore.", "每條道路、街區、地點與移動中的 Agent 都在同一個真正的像素網格上。可滾輪或使用 + / − 縮放，並拖曳探索城市。")}</p><button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); runtime.runScenario("order"); }}>{tr(locale, "Run the city order", "運行城市訂單")}<ChevronRight size={14} /></button></div> : null}
      {scenario?.journey ? <ol className="aw-city-journey" aria-label={tr(locale, "Order journey", "訂單流程")}>{scenario.journey.map((stage, index) => { const status = taskStageStatus(world.tasks, stage.taskIds); return <li key={stage.id} className={`aw-city-journey__item aw-city-journey__item--${status}`}><span>{status === "done" ? <Check size={9} /> : index + 1}</span><strong>{stage.shortLabel[locale]}</strong></li>; })}</ol> : null}
    </section>
  );
}

export function AsymptaWorldExperience() {
  const runtime = useLivingWorld();
  const { world, locale } = runtime;
  const [input, setInput] = useState(""); const [languageOpen, setLanguageOpen] = useState(false); const [selectedAgentId, setSelectedAgentId] = useState<string>(); const [traceOpen, setTraceOpen] = useState(false); const inputRef = useRef<HTMLInputElement>(null);
  const runScenario = runtime.runScenario;
  useEffect(() => { const demo = new URLSearchParams(window.location.search).get("demo"); if (demo === "order") runScenario("order"); }, [runScenario]);
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
    {world.result ? <section className="aw-result-card"><span>{world.result.eyebrow[locale]}</span><h2>{world.result.title[locale]}</h2><p>{world.result.subtitle[locale]}</p><div>{world.result.facts.slice(0, 3).map((fact) => <span key={fact.label.en}><small>{fact.label[locale]}</small><strong>{fact.value[locale]}</strong></span>)}</div><footer><button type="button" onClick={() => runtime.choose(world.result!.primaryAction.id)}>{world.result.primaryAction.label[locale]}</button><button type="button" onClick={() => runtime.choose(world.result!.secondaryAction.id)}>{world.result.secondaryAction.label[locale]}</button></footer></section> : null}
    {world.approval.status === "pending" && approvalTitle ? <div className="aw-approval-backdrop"><section className="aw-approval-card" role="dialog" aria-modal="true"><span><ShieldCheck size={17} /></span><small>{tr(locale, "HUMAN CHECKPOINT", "人的批准關卡")}</small><h2>{approvalTitle}</h2><p>{tr(locale, "The city stops here. Nothing consequential moves until you approve it.", "城市在這裡停下。任何重要行動都要在你批准後才會繼續。")}</p><div><button type="button" onClick={() => runtime.approve(false)}>{tr(locale, "Hold", "暫停")}</button><button type="button" onClick={() => runtime.approve(true)}>{tr(locale, "Approve", "批准")}</button></div></section></div> : null}
    <div className="aw-safety-note"><ShieldCheck size={11} />{tr(locale, "Simulation · no real order, payment, message or shipment occurs", "模擬模式 · 不會真的下單、付款、傳訊息或出貨")}</div>
  </main>;
}

export { SCENARIO_ORDER };
