"use client";

import {
  Activity,
  ArrowRight,
  BellRing,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  ChevronDown,
  Compass,
  Crosshair,
  Eye,
  Languages,
  LocateFixed,
  Mail,
  MapPin,
  Menu,
  MessageCircleMore,
  Monitor,
  MousePointer2,
  Play,
  Radio,
  RefreshCw,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Soup,
  WandSparkles,
  Waypoints,
  Wrench,
  X,
} from "lucide-react";
import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { AgentPortrait } from "@/components/living-world/agent-portrait";
import { useLivingWorld } from "@/components/living-world/use-living-world";
import { WorldStage } from "@/components/living-world/world-stage";
import { SCENARIO_ORDER, scenarioFor } from "@/lib/living-world/scenarios";
import type {
  LivingWorldState,
  Locale,
  ScenarioId,
  WorldEvent,
} from "@/lib/living-world/types";

type CommandId =
  | "dinner"
  | "work"
  | "shopping"
  | "email"
  | "watch"
  | "location"
  | "services"
  | "context"
  | "progress"
  | "follow"
  | "english"
  | "traditional"
  | "reset";

type Command = {
  id: CommandId;
  slash: string;
  label: Record<Locale, string>;
  detail: Record<Locale, string>;
  icon: typeof Soup;
};

const COMMANDS: Command[] = [
  { id: "dinner", slash: "/dinner", label: { en: "Find dinner", "zh-Hant": "尋找晚餐" }, detail: { en: "Nearby options, preference and travel", "zh-Hant": "附近選擇、偏好及路程" }, icon: Soup },
  { id: "work", slash: "/work", label: { en: "Prepare a meeting", "zh-Hant": "準備會議" }, detail: { en: "Calendar, research and briefing", "zh-Hant": "日曆、研究及簡報" }, icon: BriefcaseBusiness },
  { id: "shopping", slash: "/shopping", label: { en: "Compare a product", "zh-Hant": "比較產品" }, detail: { en: "Requirements, products and price", "zh-Hant": "需求、產品及價格" }, icon: Monitor },
  { id: "email", slash: "/email", label: { en: "Handle an email", "zh-Hant": "處理電郵" }, detail: { en: "Context, draft and approval", "zh-Hant": "情境、草稿及批准" }, icon: Mail },
  { id: "watch", slash: "/watch", label: { en: "Watch the dinner demo", "zh-Hant": "觀看晚餐示範" }, detail: { en: "Runs the same live event engine", "zh-Hant": "使用同一個即時事件引擎" }, icon: Play },
  { id: "location", slash: "/location", label: { en: "Use my area", "zh-Hant": "使用我的區域" }, detail: { en: "Follow device area; coordinates stay hidden", "zh-Hant": "跟隨裝置區域；不顯示座標" }, icon: LocateFixed },
  { id: "services", slash: "/services", label: { en: "Open WebMCP", "zh-Hant": "開啟 WebMCP" }, detail: { en: "Inspect and invoke available world tools", "zh-Hant": "檢視及呼叫可用世界工具" }, icon: WandSparkles },
  { id: "context", slash: "/context", label: { en: "Show context", "zh-Hant": "顯示情境" }, detail: { en: "See what agents are allowed to use", "zh-Hant": "查看 Agent 可使用的資料" }, icon: Eye },
  { id: "progress", slash: "/progress", label: { en: "Show progress", "zh-Hant": "顯示進度" }, detail: { en: "See the current task graph", "zh-Hant": "查看目前任務圖" }, icon: Waypoints },
  { id: "follow", slash: "/follow", label: { en: "Toggle camera follow", "zh-Hant": "切換相機跟隨" }, detail: { en: "Keep active work in focus", "zh-Hant": "保持聚焦目前工作" }, icon: Crosshair },
  { id: "english", slash: "/english", label: { en: "Use English", "zh-Hant": "使用英文" }, detail: { en: "Set the interface to English", "zh-Hant": "把介面設定為英文" }, icon: Languages },
  { id: "traditional", slash: "/繁中", label: { en: "Use Traditional Chinese", "zh-Hant": "使用繁體中文" }, detail: { en: "Set the interface to 繁中", "zh-Hant": "把介面設定為繁中" }, icon: Languages },
  { id: "reset", slash: "/reset", label: { en: "Restart the world", "zh-Hant": "重新開始世界" }, detail: { en: "Keep your area, clear the current need", "zh-Hant": "保留所在地，清除目前需要" }, icon: RefreshCw },
];

function tr(locale: Locale, en: string, zh: string) {
  return locale === "en" ? en : zh;
}

function ScenarioIcon({ id, size = 16 }: { id: ScenarioId; size?: number }) {
  const icons = { dinner: Soup, work: BriefcaseBusiness, shopping: Monitor, email: Mail };
  const Icon = icons[id];
  return <Icon size={size}/>;
}

function eventIcon(event: WorldEvent) {
  if (event.type === "tool_requested" || event.type === "tool_result") return Wrench;
  if (event.type === "agent_message") return MessageCircleMore;
  if (event.type.includes("approval")) return ShieldCheck;
  if (event.type.includes("completed") || event.type === "result_candidate") return CheckCircle2;
  if (event.type.includes("moving") || event.type.includes("assigned")) return Waypoints;
  return Activity;
}

function relativeTime(world: LivingWorldState, event: WorldEvent, locale: Locale) {
  const seconds = Math.max(0, Math.round((world.now - event.createdAt) / 1_000));
  if (seconds < 4) return locale === "en" ? "now" : "剛剛";
  if (seconds < 60) return locale === "en" ? `${seconds}s` : `${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  return locale === "en" ? `${minutes}m` : `${minutes} 分鐘`;
}

function ContextCard({ world, locale }: { world: LivingWorldState; locale: Locale }) {
  const scenario = world.scenarioId ? scenarioFor(world.scenarioId) : scenarioFor("dinner");
  return (
    <section className="context-card" aria-labelledby="context-title">
      <header>
        <span className="panel-kicker"><Eye size={12}/>{tr(locale, "CONTEXT USED", "使用的情境")}</span>
        <span className={`source-badge source-badge--${world.location.source}`}>
          {world.location.source === "device" ? tr(locale, "DEVICE AREA", "裝置區域") : tr(locale, "DEMO", "示範")}
        </span>
      </header>
      <h2 id="context-title">{world.need ? scenario.label[locale] : tr(locale, "Tonight", "今晚")}</h2>
      <dl>
        <div>
          <dt>{tr(locale, "Area", "區域")}</dt>
          <dd>{world.location.worldName[locale]}</dd>
        </div>
        {scenario.context.map((item) => (
          <div key={item.label.en}>
            <dt>{item.label[locale]}</dt>
            <dd>
              {item.value[locale]}
              {item.simulated ? <small>{tr(locale, "demo", "示範")}</small> : null}
            </dd>
          </div>
        ))}
      </dl>
      <p>
        <ShieldCheck size={13}/>
        {tr(
          locale,
          "Only grouped location is kept in the world. Exact coordinates are not displayed.",
          "世界只保留分組後的所在地；不會顯示精確座標。",
        )}
      </p>
    </section>
  );
}

function ProgressCard({ world, locale }: { world: LivingWorldState; locale: Locale }) {
  const done = world.tasks.filter((task) => task.status === "done").length;
  const scenario = world.scenarioId ? scenarioFor(world.scenarioId) : undefined;
  return (
    <section className="progress-card" aria-labelledby="progress-title">
      <header>
        <span className="panel-kicker"><Waypoints size={12}/>{tr(locale, "CURRENT NEED", "目前需要")}</span>
        {world.need ? <span className="progress-count">{done}/{world.tasks.length}</span> : null}
      </header>
      <h2 id="progress-title">{world.need?.text ?? tr(locale, "Nothing queued", "目前沒有需要")}</h2>
      {!world.need ? (
        <p className="empty-panel-copy">{tr(locale, "Start below. Only useful agents will appear.", "從下方開始；只有有用的 Agent 才會出現。")}</p>
      ) : (
        <div className="task-list">
          {world.tasks.map((task) => {
            const agent = world.agents.find((candidate) => candidate.id === task.agentId);
            return (
              <div className={`task-row task-row--${task.status}`} key={task.id}>
                <span className="task-state">
                  {task.status === "done" ? <Check size={12}/> : task.status === "working" ? <Radio size={11}/> : <span/>}
                </span>
                <span className="task-copy">
                  <strong>{task.title[locale]}</strong>
                  <small>{agent?.profile.name} · {task.status === "queued" ? tr(locale, "waiting", "等待") : task.status === "moving" ? tr(locale, "moving", "前往中") : task.status === "working" ? tr(locale, "working", "工作中") : tr(locale, "shared", "已分享")}</small>
                </span>
                <span className="task-progress" aria-label={`${Math.round(task.progress * 100)}%`}>
                  <i style={{ width: `${Math.round(task.progress * 100)}%` }}/>
                </span>
              </div>
            );
          })}
        </div>
      )}
      {scenario && world.need ? (
        <footer>
          <span>{scenario.agents.length} {tr(locale, "agents", "個 Agent")}</span>
          <i/>
          <span>{scenario.services.length} {tr(locale, "services", "項服務")}</span>
        </footer>
      ) : null}
    </section>
  );
}

function ResultCard({
  world,
  locale,
  onChoose,
}: {
  world: LivingWorldState;
  locale: Locale;
  onChoose: (actionId: string) => void;
}) {
  const result = world.result;
  if (!result) return null;
  const completed = world.phase === "completed";
  return (
    <section className={`result-card${completed ? " is-completed" : ""}`} aria-labelledby="result-title">
      <header>
        <span className="panel-kicker"><Sparkles size={12}/>{result.eyebrow[locale].toUpperCase()}</span>
        <span className="source-badge source-badge--simulated">{tr(locale, "SIMULATED", "模擬")}</span>
      </header>
      <h2 id="result-title">{result.title[locale]}</h2>
      <p className="result-subtitle">{result.subtitle[locale]}</p>
      <div className="result-facts">
        {result.facts.map((fact) => (
          <span key={fact.label.en}><small>{fact.label[locale]}</small><strong>{fact.value[locale]}</strong></span>
        ))}
      </div>
      <div className="why-block">
        <strong>{tr(locale, "Why this", "為何選擇這個")}</strong>
        <ul>
          {result.reasons.map((reason) => <li key={reason.en}><Check size={12}/>{reason[locale]}</li>)}
        </ul>
      </div>
      <div className="resource-row">
        {result.resources.map((resource) => (
          <span key={resource.label.en}><small>{resource.label[locale]}</small><b>{resource.value[locale]}</b></span>
        ))}
      </div>
      {completed ? (
        <div className="result-completed"><CheckCircle2 size={17}/><span><strong>{tr(locale, "Choice captured", "已記錄選擇")}</strong><small>{tr(locale, "Your agents are ready for the next need.", "你的 Agent 已準備處理下一個需要。")}</small></span></div>
      ) : (
        <div className="result-actions">
          <button type="button" className="secondary-action" onClick={() => onChoose(result.secondaryAction.id)}>
            <ShieldCheck size={15}/>{result.secondaryAction.label[locale]}
          </button>
          <button type="button" className="primary-action" onClick={() => onChoose(result.primaryAction.id)}>
            {result.primaryAction.label[locale]}<ArrowRight size={15}/>
          </button>
        </div>
      )}
      <p className="result-disclosure"><ShieldCheck size={12}/>{result.disclosure[locale]}</p>
    </section>
  );
}

function AgentDetail({
  world,
  locale,
  agentId,
  onClose,
}: {
  world: LivingWorldState;
  locale: Locale;
  agentId?: string;
  onClose: () => void;
}) {
  const agent = world.agents.find((candidate) => candidate.id === agentId);
  if (!agent) return null;
  const task = world.tasks.find((candidate) => candidate.agentId === agent.id && candidate.status !== "done") ?? world.tasks.findLast((candidate) => candidate.agentId === agent.id && candidate.status === "done");
  return (
    <section className="agent-detail-card" aria-label={`${agent.profile.name} details`}>
      <button type="button" onClick={onClose} aria-label={tr(locale, "Close agent details", "關閉 Agent 詳情")}><X size={14}/></button>
      <AgentPortrait profile={agent.profile} size="large" active={agent.status === "working"}/>
      <span>
        <small>{agent.profile.species} · {agent.profile.art.style.replaceAll("-", " ")}</small>
        <h3>{agent.profile.name}</h3>
        <strong>{agent.profile.role[locale]}</strong>
        <p>{agent.profile.competence[locale]}</p>
        {task ? <em><Radio size={10}/>{agent.thought[locale]}</em> : null}
      </span>
    </section>
  );
}

function ActivityFeed({
  world,
  locale,
  expanded,
  onToggle,
}: {
  world: LivingWorldState;
  locale: Locale;
  expanded: boolean;
  onToggle: () => void;
}) {
  const events = world.events.filter((event) => !["task_created"].includes(event.type)).slice(0, expanded ? 9 : 3);
  return (
    <section className={`activity-feed${expanded ? " is-expanded" : ""}`} aria-label={tr(locale, "World activity", "世界動態")}>
      <button type="button" className="activity-feed__toggle" onClick={onToggle} aria-expanded={expanded}>
        <span><Activity size={13}/>{tr(locale, "World activity", "世界動態")}</span>
        <ChevronDown size={14}/>
      </button>
      {events.length ? (
        <ol>
          {events.map((event) => {
            const Icon = eventIcon(event);
            return (
              <li key={event.id}>
                <Icon size={12}/>
                <span><strong>{event.title[locale]}</strong>{expanded && event.detail ? <small>{event.detail[locale]}</small> : null}</span>
                <time>{relativeTime(world, event, locale)}</time>
              </li>
            );
          })}
        </ol>
      ) : <p>{tr(locale, "Activity appears when your need enters the world.", "你的需要進入世界後，動態會在這裡出現。")}</p>}
    </section>
  );
}

function WebMcpPanel({
  locale,
  state,
  world,
  onClose,
  onFocusComposer,
}: {
  locale: Locale;
  state: "registering" | "native" | "ready";
  world: LivingWorldState;
  onClose: () => void;
  onFocusComposer: () => void;
}) {
  const [running, setRunning] = useState<string>();
  const [response, setResponse] = useState<{ title: string; summary: string }>();

  async function invoke(name: string, input: Record<string, unknown> = {}) {
    setRunning(name);
    try {
      const value = await window.__ASYMPTA_WORLD__?.invoke(name, input);
      const serialized = JSON.stringify(value, null, 2);
      setResponse({
        title: name.replace("asympta_", "").replaceAll("_", " "),
        summary: serialized.length > 520 ? `${serialized.slice(0, 520)}…` : serialized,
      });
    } catch (error) {
      setResponse({ title: tr(locale, "Tool unavailable", "工具不可用"), summary: error instanceof Error ? error.message : String(error) });
    } finally {
      setRunning(undefined);
    }
  }

  const agents = world.agents;
  const canExchange = agents.length >= 2;
  return (
    <div className="sheet-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="product-sheet webmcp-sheet" role="dialog" aria-modal="true" aria-labelledby="webmcp-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="sheet-header">
          <span className="webmcp-mark"><WandSparkles size={18}/></span>
          <span><small>WEBMCP</small><h2 id="webmcp-title">{tr(locale, "Ask the world to act", "讓世界採取行動")}</h2></span>
          <button type="button" className="icon-button" onClick={onClose} aria-label={tr(locale, "Close WebMCP", "關閉 WebMCP")}><X size={18}/></button>
        </header>
        <p className="sheet-intro">{tr(locale, "These are the same structured tools exposed to browser agents. Read actions run immediately; consequential actions still need you.", "這些是同樣提供給瀏覽器 Agent 的結構化工具。唯讀行動可立即執行；重要行動仍需要你批准。")}</p>
        <div className={`native-status native-status--${state}`}>
          <span><i/>{state === "native" ? tr(locale, "Native WebMCP registered", "已註冊原生 WebMCP") : state === "registering" ? tr(locale, "Checking browser support", "正在檢查瀏覽器支援") : tr(locale, "WebMCP-ready in-app bridge", "WebMCP 就緒的應用內接頭")}</span>
          <small>{state === "native" ? "LIVE BRIDGE" : "COMPATIBLE FALLBACK"}</small>
        </div>
        <div className="webmcp-actions">
          <button type="button" onClick={() => void invoke("asympta_observe_coordination")} disabled={Boolean(running)}>
            <Eye size={17}/><span><strong>{tr(locale, "Observe coordination", "觀察協調")}</strong><small>{tr(locale, "Need · agents · task graph", "需要 · Agent · 任務圖")}</small></span><b>READ</b>
          </button>
          <button type="button" onClick={() => void invoke("asympta_list_local_services")} disabled={Boolean(running)}>
            <Compass size={17}/><span><strong>{tr(locale, "List local services", "列出本地服務")}</strong><small>{tr(locale, "Every service discloses its mode", "每項服務都會說明模式")}</small></span><b>READ</b>
          </button>
          <button type="button" onClick={() => {
            if (!canExchange) return;
            const from = agents.find((agent) => agent.profile.role.en !== "Coordinator") ?? agents[1];
            const to = agents.find((agent) => agent.profile.role.en === "Coordinator") ?? agents[0];
            void invoke("asympta_exchange_information", { fromAgentId: from.id, toAgentId: to.id, message: tr(locale, "User-requested context check", "用戶要求核實情境") });
          }} disabled={!canExchange || Boolean(running)}>
            <MessageCircleMore size={17}/><span><strong>{tr(locale, "Exchange information", "交換資訊")}</strong><small>{canExchange ? tr(locale, "Visible in the same world", "在同一世界中可見") : tr(locale, "Start a need first", "先開始一項需要")}</small></span><b>WRITE</b>
          </button>
          <button type="button" onClick={() => { onClose(); onFocusComposer(); }}>
            <MousePointer2 size={17}/><span><strong>{tr(locale, "Submit a human need", "提交人的需要")}</strong><small>{tr(locale, "Type naturally or use /", "自然輸入或使用 /")}</small></span><b>WRITE</b>
          </button>
        </div>
        {response ? <div className="webmcp-response" role="status"><span><CheckCircle2 size={15}/><strong>{response.title}</strong></span><pre>{response.summary}</pre></div> : null}
        <footer className="sheet-note"><ShieldCheck size={13}/>{tr(locale, "No external service is represented as live unless a real connector is present.", "除非已連接真實服務，否則不會把任何外部服務標示為即時。")}</footer>
      </section>
    </div>
  );
}

function SettingsMenu({
  locale,
  follow,
  onLocale,
  onFollow,
  onLocation,
  onReset,
  onClose,
  onFocusComposer,
}: {
  locale: Locale;
  follow: boolean;
  onLocale: (locale: Locale) => void;
  onFollow: (value: boolean) => void;
  onLocation: () => void;
  onReset: () => void;
  onClose: () => void;
  onFocusComposer: () => void;
}) {
  return (
    <div className="menu-popover" role="dialog" aria-label={tr(locale, "Settings menu", "設定選單")}>
      <header><span><Settings2 size={14}/>{tr(locale, "World settings", "世界設定")}</span><button type="button" onClick={onClose} aria-label={tr(locale, "Close menu", "關閉選單")}><X size={16}/></button></header>
      <button type="button" className="slash-reminder" onClick={() => { onClose(); onFocusComposer(); }}><span className="slash-key">/</span><span><strong>{tr(locale, "Every action is in conversation", "所有行動都在對話欄")}</strong><small>{tr(locale, "Type / to choose quickly", "輸入 / 快速選擇")}</small></span><ArrowRight size={15}/></button>
      <div className="setting-group">
        <span>{tr(locale, "LANGUAGE", "語言")}</span>
        <div className="segment-control">
          <button type="button" className={locale === "en" ? "is-active" : ""} onClick={() => onLocale("en")}>English</button>
          <button type="button" className={locale === "zh-Hant" ? "is-active" : ""} onClick={() => onLocale("zh-Hant")}>繁中</button>
        </div>
      </div>
      <button type="button" className="setting-row" onClick={() => onFollow(!follow)}><span><Crosshair size={16}/><span><strong>{tr(locale, "Camera follow", "相機跟隨")}</strong><small>{tr(locale, "Keep active agents in focus", "保持聚焦活躍 Agent")}</small></span></span><i role="switch" aria-checked={follow} className={follow ? "is-on" : ""}/></button>
      <button type="button" className="setting-row" onClick={onLocation}><span><LocateFixed size={16}/><span><strong>{tr(locale, "Follow my area", "跟隨我的區域")}</strong><small>{tr(locale, "Privacy-aware location groups", "私隱友善的定位分組")}</small></span></span><ArrowRight size={14}/></button>
      <button type="button" className="setting-row setting-row--danger" onClick={onReset}><span><RefreshCw size={16}/><span><strong>{tr(locale, "Restart demo", "重新開始示範")}</strong><small>{tr(locale, "Clear the need, keep your area", "清除需要，保留所在地")}</small></span></span><ArrowRight size={14}/></button>
    </div>
  );
}

function ApprovalDialog({
  world,
  locale,
  onResolve,
}: {
  world: LivingWorldState;
  locale: Locale;
  onResolve: (approved: boolean) => void;
}) {
  const action = world.result && [world.result.primaryAction, world.result.secondaryAction].find((candidate) => candidate.id === world.approval.actionId);
  if (world.approval.status !== "pending" || !action) return null;
  return (
    <div className="approval-backdrop">
      <section className="approval-dialog" role="alertdialog" aria-modal="true" aria-labelledby="approval-title" aria-describedby="approval-description">
        <span className="approval-icon"><BellRing size={21}/></span>
        <span className="panel-kicker">{tr(locale, "NEEDS YOU", "需要你")}</span>
        <h2 id="approval-title">{action.label[locale]}?</h2>
        <p id="approval-description">{tr(locale, "Agents can prepare this action, but only you can authorize it. This demo has no live external connector, so approving records the handoff without sending, booking or buying anything.", "Agent 可以準備這項行動，但只有你可以授權。目前示範未連接真實外部服務，因此批准只會記錄交接，不會發送、預訂或購買任何東西。")}</p>
        <div className="approval-boundary"><span><Check size={13}/>{tr(locale, "Research complete", "研究已完成")}</span><span><Check size={13}/>{tr(locale, "Options checked", "選擇已核實")}</span><span className="needs-human"><ShieldCheck size={13}/>{tr(locale, "External action held", "外部行動已暫停")}</span></div>
        <div className="approval-actions"><button type="button" className="secondary-action" onClick={() => onResolve(false)}>{tr(locale, "Keep on hold", "繼續暫停")}</button><button type="button" className="primary-action" onClick={() => onResolve(true)}><ShieldCheck size={15}/>{tr(locale, "Approve demo handoff", "批准示範交接")}</button></div>
      </section>
    </div>
  );
}

export function LivingWorldApp() {
  const runtime = useLivingWorld();
  const { world, locale } = runtime;
  const [input, setInput] = useState("");
  const [commandIndex, setCommandIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [webMcpOpen, setWebMcpOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string>();
  const inputRef = useRef<HTMLInputElement>(null);
  const resultWasVisibleRef = useRef(false);

  useEffect(() => {
    const visible = Boolean(world.result);
    let frame = 0;
    if (visible && !resultWasVisibleRef.current) {
      frame = window.requestAnimationFrame(() => {
        setProgressOpen(true);
        setContextOpen(false);
      });
    }
    resultWasVisibleRef.current = visible;
    return () => window.cancelAnimationFrame(frame);
  }, [world.result]);

  const commandQuery = input.startsWith("/") ? input.slice(1).toLowerCase() : "";
  const commandOpen = input.startsWith("/");
  const filteredCommands = useMemo(
    () => COMMANDS.filter((command) => !commandQuery || `${command.slash} ${command.label.en} ${command.label["zh-Hant"]}`.toLowerCase().includes(commandQuery)),
    [commandQuery],
  );

  function focusComposer() {
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      if (!inputRef.current?.value) {
        setCommandIndex(0);
        setInput("/");
      }
    });
  }

  function closeMobileSheets() {
    setContextOpen(false);
    setProgressOpen(false);
  }

  function executeCommand(id: CommandId) {
    setInput("");
    closeMobileSheets();
    if (id === "dinner" || id === "work" || id === "shopping" || id === "email") runtime.runScenario(id);
    if (id === "watch") runtime.runScenario("dinner");
    if (id === "location") runtime.requestLocation();
    if (id === "services") setWebMcpOpen(true);
    if (id === "context") setContextOpen(true);
    if (id === "progress") setProgressOpen(true);
    if (id === "follow") runtime.setCameraFollow(!runtime.cameraFollow);
    if (id === "english") runtime.setLocale("en");
    if (id === "traditional") runtime.setLocale("zh-Hant");
    if (id === "reset") runtime.reset();
  }

  function submit(event?: FormEvent) {
    event?.preventDefault();
    const value = input.trim();
    if (!value) return;
    if (value.startsWith("/")) {
      const exact = COMMANDS.find((command) => command.slash.toLowerCase() === value.toLowerCase()) ?? filteredCommands[commandIndex];
      if (exact) executeCommand(exact.id);
      return;
    }
    runtime.submitNeed(value);
    setInput("");
    closeMobileSheets();
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!commandOpen) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCommandIndex((index) => Math.min(filteredCommands.length - 1, index + 1));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setCommandIndex((index) => Math.max(0, index - 1));
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setInput("");
    }
  }

  const nativeLabel = runtime.webMcpState === "native" ? "WEBMCP LIVE" : "WEBMCP";
  const scenario = world.scenarioId ? scenarioFor(world.scenarioId) : undefined;

  return (
    <main className="asympta-app">
      <header className="app-header">
        <div className="app-brand">
          <span className="brand-symbol" aria-hidden="true"><i/><i/><i/><i/><i/></span>
          <span><strong>ASYMPTA WORLD</strong><small>{tr(locale, "Humans live. Agents coordinate.", "人生活，Agent 協調世界。")}</small></span>
        </div>
        <button type="button" className="header-location" onClick={runtime.requestLocation}>
          <MapPin size={14}/><span><strong>{world.location.worldName[locale]}</strong><small>{runtime.locationState === "following" ? tr(locale, "Following your device area", "正在跟隨裝置區域") : tr(locale, "Poetic local world", "詩意所在地世界")}</small></span><i data-following={runtime.locationState === "following"}/>
        </button>
        <div className="header-actions">
          <button type="button" className={`follow-button${runtime.cameraFollow ? " is-on" : ""}`} onClick={() => runtime.setCameraFollow(!runtime.cameraFollow)} aria-pressed={runtime.cameraFollow}><Crosshair size={14}/><span>{tr(locale, "Follow", "跟隨")}</span><i/></button>
          <button type="button" className={`webmcp-button${runtime.webMcpState === "native" ? " is-native" : ""}`} onClick={() => setWebMcpOpen(true)}><WandSparkles size={15}/><span>{nativeLabel}</span></button>
          <div className="menu-anchor">
            <button type="button" className="menu-button" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen} aria-label={tr(locale, "Open menu", "開啟選單")}><Menu size={20}/><span>{tr(locale, "Menu", "選單")}</span></button>
            {menuOpen ? <SettingsMenu locale={locale} follow={runtime.cameraFollow} onLocale={runtime.setLocale} onFollow={runtime.setCameraFollow} onLocation={() => { setMenuOpen(false); runtime.requestLocation(); }} onReset={() => { setMenuOpen(false); runtime.reset(); }} onClose={() => setMenuOpen(false)} onFocusComposer={focusComposer}/> : null}
          </div>
        </div>
      </header>

      <div className="product-thesis" role="note">
        <span><i/>{tr(locale, "Your agents coordinate tasks, information and services around what you need.", "你的 Agent 圍繞你的需要，協調任務、資訊與服務。")}</span>
      </div>

      <section className="world-layout">
        <WorldStage world={world} locale={locale} cameraFollow={runtime.cameraFollow} selectedAgentId={selectedAgentId} onSelectAgent={setSelectedAgentId}/>
        <aside className="desktop-context-rail"><ContextCard world={world} locale={locale}/></aside>
        <aside className="desktop-outcome-rail">
          {world.result ? <ResultCard world={world} locale={locale} onChoose={runtime.choose}/> : <ProgressCard world={world} locale={locale}/>}
        </aside>
        <ActivityFeed world={world} locale={locale} expanded={activityOpen} onToggle={() => setActivityOpen((open) => !open)}/>
        <AgentDetail world={world} locale={locale} agentId={selectedAgentId} onClose={() => setSelectedAgentId(undefined)}/>
      </section>

      <div className="mobile-panel-tabs">
        <button type="button" onClick={() => { setContextOpen((open) => !open); setProgressOpen(false); }} aria-expanded={contextOpen}><Eye size={14}/>{tr(locale, "Context", "情境")}</button>
        <button type="button" onClick={() => { setProgressOpen((open) => !open); setContextOpen(false); }} aria-expanded={progressOpen}><Waypoints size={14}/>{world.result ? tr(locale, "Result", "結果") : tr(locale, "Progress", "進度")}{world.tasks.length ? <b>{world.tasks.filter((task) => task.status === "done").length}/{world.tasks.length}</b> : null}</button>
      </div>

      {contextOpen ? <div className="mobile-product-panel"><button type="button" className="panel-close" onClick={() => setContextOpen(false)} aria-label={tr(locale, "Close context", "關閉情境")}><X size={16}/></button><ContextCard world={world} locale={locale}/></div> : null}
      {progressOpen ? <div className="mobile-product-panel"><button type="button" className="panel-close" onClick={() => setProgressOpen(false)} aria-label={tr(locale, "Close progress", "關閉進度")}><X size={16}/></button>{world.result ? <ResultCard world={world} locale={locale} onChoose={runtime.choose}/> : <ProgressCard world={world} locale={locale}/>}</div> : null}

      <section className={`conversation-dock${commandOpen ? " has-commands" : ""}`} aria-label={tr(locale, "Conversation", "對話")}>
        {!world.need ? (
          <div className="scenario-quick-row">
            <span>{tr(locale, "Try a need", "試試一項需要")}</span>
            {SCENARIO_ORDER.map((id) => {
              const item = scenarioFor(id);
              return <button type="button" key={id} data-scenario={id} onClick={() => runtime.runScenario(id)}><ScenarioIcon id={id}/>{item.label[locale]}</button>;
            })}
            <button type="button" className="watch-demo" onClick={() => runtime.runScenario("dinner")}><Play size={14}/>{tr(locale, "Watch demo", "觀看示範")}</button>
          </div>
        ) : (
          <div className="active-need-line">
            <span><ScenarioIcon id={world.need.scenarioId}/><strong>{scenario?.label[locale]}</strong><small>{world.phase.replaceAll("_", " ")}</small></span>
            <button type="button" onClick={runtime.reset}><RefreshCw size={13}/>{tr(locale, "Restart", "重設")}</button>
          </div>
        )}

        {commandOpen ? (
          <div className="command-palette" role="listbox" aria-label={tr(locale, "Available actions", "可用行動")}>
            <header><span className="slash-key">/</span><span><strong>{tr(locale, "Choose an action", "選擇行動")}</strong><small>{tr(locale, "↑↓ navigate · Enter select · Esc close", "↑↓ 瀏覽 · Enter 選擇 · Esc 關閉")}</small></span></header>
            <div className="command-list">
              {filteredCommands.map((command, index) => {
                const Icon = command.icon;
                return <button type="button" role="option" aria-selected={index === commandIndex} className={index === commandIndex ? "is-selected" : ""} key={command.id} onMouseEnter={() => setCommandIndex(index)} onClick={() => executeCommand(command.id)}><span className="command-icon"><Icon size={17}/></span><span><strong>{command.label[locale]}</strong><small>{command.detail[locale]}</small></span><kbd>{command.slash}</kbd></button>;
              })}
              {!filteredCommands.length ? <p>{tr(locale, "No matching action. Keep typing your need naturally.", "沒有相符行動；你可以繼續自然輸入需要。")}</p> : null}
            </div>
          </div>
        ) : null}

        <form className="conversation-form" onSubmit={submit}>
          <button type="button" className="composer-webmcp" onClick={() => setWebMcpOpen(true)} aria-label={tr(locale, "Open WebMCP actions", "開啟 WebMCP 行動")}><WandSparkles size={18}/><span>WebMCP</span></button>
          <label>
            <span className="sr-only">{tr(locale, "What do you need?", "你需要甚麼？")}</span>
            <input id="need-composer" ref={inputRef} value={input} onChange={(event) => { setInput(event.target.value); setCommandIndex(0); }} onKeyDown={onInputKeyDown} placeholder={tr(locale, "Type / for actions, or tell us what you need…", "輸入 / 選擇行動，或告訴我們你的需要…")} autoComplete="off" enterKeyHint="send"/>
          </label>
          <button type="submit" className="send-button" disabled={!input.trim()} aria-label={tr(locale, "Send need", "送出需要")}><Send size={18}/><span>{tr(locale, "Send", "送出")}</span></button>
        </form>
        <div className="conversation-footnote"><span><ShieldCheck size={11}/>{tr(locale, "Approval before booking, buying or sending", "預訂、購買或發送前必須批准")}</span><span><Radio size={10}/>{runtime.webMcpState === "native" ? tr(locale, "Native tools registered", "已註冊原生工具") : tr(locale, "Challenge-ready tool bridge", "挑戰就緒工具接頭")}</span></div>
      </section>

      {webMcpOpen ? <WebMcpPanel locale={locale} state={runtime.webMcpState} world={world} onClose={() => setWebMcpOpen(false)} onFocusComposer={focusComposer}/> : null}
      <ApprovalDialog world={world} locale={locale} onResolve={runtime.approve}/>
    </main>
  );
}
