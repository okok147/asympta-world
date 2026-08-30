import { useEffect, useMemo, useRef, useState } from "react";
import { WORLD_HEIGHT, WORLD_WIDTH, entityCenter } from "./engine/catalog.js";
import { useAgentWorld } from "./hooks/useAgentWorld.js";

const copy = {
  en: {
    world: "Asympta World",
    subtitle: "Intent becomes coordinated, verifiable action",
    conversation: "Conversation",
    ask: "What do you want to accomplish?",
    placeholder: "Tell your agent what you want to do…",
    send: "Run intent",
    cancel: "Cancel",
    reset: "Reset world",
    plan: "Plan",
    actions: "Actions",
    state: "State",
    idle: "Ready",
    planning: "Planning",
    validating: "Validating",
    executing: "Executing",
    repairing: "Repairing",
    completed: "Completed",
    cancelled: "Cancelled",
    blocked: "Blocked",
    queued: "Queued",
    rejected: "Rejected",
    failed_validation: "State rejected",
    verified: "Verified",
    source: "Planner",
    revision: "World revision",
    entities: "Entities",
    agents: "Agents",
    orders: "Orders",
    evidence: "Evidence",
    estimate: "est. remaining",
    simulation: "Simulation only",
    noPlan: "A plan appears here after you describe an intent.",
    noActions: "Every proposed and validated action will appear here.",
    noState: "World state changes are recorded after validation.",
    inspect: "Inspecting live world",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    fit: "Fit world",
    language: "中文",
    modelUnavailable: "Local safety planner",
  },
  zh: {
    world: "Asympta World",
    subtitle: "讓意圖成為協調且可驗證的行動",
    conversation: "對話",
    ask: "你想完成甚麼？",
    placeholder: "告訴你的代理，你想做甚麼……",
    send: "執行意圖",
    cancel: "取消",
    reset: "重設世界",
    plan: "計畫",
    actions: "行動",
    state: "狀態",
    idle: "已就緒",
    planning: "建立計畫",
    validating: "正在驗證",
    executing: "正在執行",
    repairing: "正在修正",
    completed: "已完成",
    cancelled: "已取消",
    blocked: "已阻擋",
    queued: "等待中",
    rejected: "已拒絕",
    failed_validation: "狀態被拒絕",
    verified: "已驗證",
    source: "規劃器",
    revision: "世界版本",
    entities: "實體",
    agents: "代理",
    orders: "訂單",
    evidence: "證據",
    estimate: "預計尚餘",
    simulation: "僅限模擬",
    noPlan: "說出意圖後，計畫會在這裡出現。",
    noActions: "所有提出及通過驗證的行動都會在這裡顯示。",
    noState: "只有通過驗證後，世界狀態才會更新。",
    inspect: "即時世界狀態",
    zoomIn: "放大",
    zoomOut: "縮小",
    fit: "顯示全世界",
    language: "EN",
    modelUnavailable: "本地安全規劃器",
  },
};

const activeStatuses = new Set(["planning", "validating", "executing", "repairing"]);

function Icon({ name, size = 18 }) {
  const paths = {
    send: "M4 4l16 8-16 8 3-7 8-1-8-1z",
    stop: "M6 6h12v12H6z",
    reset: "M20 11a8 8 0 1 1-2.3-5.7L20 3v8h-8l3-3a5 5 0 1 0 2 3z",
    plan: "M6 4h12v4H6zm0 6h12v4H6zm0 6h8v4H6z",
    action: "M13 2L4 14h7l-1 8 9-13h-7z",
    state: "M12 3l9 5-9 5-9-5zm-9 9 9 5 9-5m-18 5 9 5 9-5",
    plus: "M12 5v14M5 12h14",
    minus: "M5 12h14",
    fit: "M8 3H3v5m13-5h5v5M8 21H3v-5m13 5h5v-5",
    check: "M5 12l4 4L19 6",
    warning: "M12 3l10 18H2zm0 6v5m0 4h.01",
    chat: "M4 4h16v12H8l-4 4z",
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[name] || paths.action} fill={name === "send" || name === "stop" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StatusPill({ status, t }) {
  return (
    <div className={`status-pill status-${status}`}>
      <span className="status-dot" />
      <span>{t[status] || status}</span>
    </div>
  );
}

function TopBar({ language, setLanguage, status, progress, model, reset }) {
  const t = copy[language];
  return (
    <header className="topbar">
      <div className="brand-lockup">
        <img className="brand-mark" src="/asympta-cat.svg" alt="" />
        <div>
          <div className="brand-title">{t.world}</div>
          <div className="brand-subtitle">{t.subtitle}</div>
        </div>
      </div>
      <div className="run-summary">
        <StatusPill status={status} t={t} />
        {activeStatuses.has(status) && progress.total > 0 ? (
          <div className="top-progress" aria-label={`${progress.percent}%`}>
            <span style={{ width: `${progress.percent}%` }} />
          </div>
        ) : null}
        <div className="model-route" title={model.note || ""}>
          <span className="model-light" />
          <span>{model.model === "—" ? "GPT-OSS · free only" : model.model}</span>
        </div>
      </div>
      <div className="top-actions">
        <span className="simulation-badge">{t.simulation}</span>
        <button className="quiet-button" onClick={() => setLanguage(language === "en" ? "zh" : "en")}>
          {t.language}
        </button>
        <button className="icon-button" onClick={reset} title={t.reset} aria-label={t.reset}>
          <Icon name="reset" />
        </button>
      </div>
    </header>
  );
}

function ConversationPanel({ language, messages, status, progress, error, runIntent, cancel }) {
  const t = copy[language];
  const [draft, setDraft] = useState("");
  const scrollRef = useRef(null);
  const running = activeStatuses.has(status);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  const submit = () => {
    const value = draft.trim();
    if (!value || running) return;
    setDraft("");
    runIntent(value);
  };

  return (
    <aside className="conversation-panel panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">01</span>
          <h2>{t.conversation}</h2>
        </div>
        <StatusPill status={status} t={t} />
      </div>

      <div className="message-list" ref={scrollRef}>
        {messages.map((message) => (
          <article key={message.id} className={`message message-${message.role}`}>
            <div className="message-avatar">
              {message.role === "assistant" ? <img src="/asympta-cat.svg" alt="" /> : <span>YOU</span>}
            </div>
            <div className="message-body">
              <div className="message-role">{message.role === "assistant" ? "ASYMPTA" : language === "zh" ? "你" : "YOU"}</div>
              <p>{language === "zh" ? message.textZh || message.text : message.text}</p>
              {message.meta ? (
                <div className="message-proof">
                  <Icon name="check" size={14} />
                  rev {message.meta.revision} · {message.meta.verifiedActions} verified actions
                </div>
              ) : null}
            </div>
          </article>
        ))}

        {running ? (
          <article className="message message-assistant message-live">
            <div className="message-avatar"><img src="/asympta-cat.svg" alt="" /></div>
            <div className="message-body">
              <div className="message-role">ASYMPTA</div>
              <div className="thinking-line">
                <span>{t[status]}</span>
                <span className="thinking-dots"><i /><i /><i /></span>
              </div>
              {progress.total > 0 ? (
                <div className="inline-progress">
                  <span style={{ width: `${progress.percent}%` }} />
                  <b>{progress.percent}%</b>
                </div>
              ) : null}
              {progress.remainingSeconds !== null ? (
                <small>{progress.remainingSeconds}s {t.estimate}</small>
              ) : null}
            </div>
          </article>
        ) : null}
      </div>

      {error ? (
        <div className="error-banner"><Icon name="warning" size={16} /><span>{error}</span></div>
      ) : null}

      <div className="composer-wrap">
        <label htmlFor="intent">{t.ask}</label>
        <div className={`composer ${running ? "composer-disabled" : ""}`}>
          <textarea
            id="intent"
            value={draft}
            disabled={running}
            placeholder={t.placeholder}
            rows={3}
            maxLength={1200}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
          />
          {running ? (
            <button className="send-button cancel-button" onClick={cancel} aria-label={t.cancel} title={t.cancel}>
              <Icon name="stop" />
            </button>
          ) : (
            <button className="send-button" onClick={submit} disabled={!draft.trim()} aria-label={t.send} title={t.send}>
              <Icon name="send" />
            </button>
          )}
        </div>
        <div className="composer-foot">
          <span>Enter · {t.send}</span>
          <span>{draft.length}/1200</span>
        </div>
      </div>
    </aside>
  );
}

const roadPairs = [
  ["home", "market"],
  ["market", "warehouse"],
  ["warehouse", "farm"],
  ["courier-hub", "market"],
  ["home", "community"],
  ["community", "workshop"],
  ["market", "workshop"],
];

function Building({ entity, language, active }) {
  const name = language === "zh" ? entity.nameZh || entity.name : entity.name;
  return (
    <div
      className={`building building-${entity.hue || "mint"} ${entity.discovered ? "building-discovered" : ""} ${active ? "building-active" : ""}`}
      style={{ left: entity.x, top: entity.y, width: entity.width, height: entity.height }}
    >
      <div className="building-roof">
        <span /><span /><span />
      </div>
      <div className="building-face">
        <div className="building-sign">{name}</div>
        <div className="building-kind">{String(entity.kind).replaceAll("_", " ")}</div>
        <div className="windows"><i /><i /><i /></div>
      </div>
      {active ? <div className="activity-ring" /> : null}
    </div>
  );
}

function Agent({ agent, language, active }) {
  return (
    <div
      className={`world-agent ${active ? "world-agent-active" : ""}`}
      style={{ left: agent.x, top: agent.y, "--agent-color": agent.color, "--agent-accent": agent.accent }}
    >
      <div className="agent-status-label">
        <b>{agent.name}</b>
        <span>{language === "zh" ? agent.roleZh || agent.role : agent.role}</span>
      </div>
      <div className="agent-sprite">
        <i className="agent-ear ear-left" /><i className="agent-ear ear-right" />
        <i className="agent-eye eye-left" /><i className="agent-eye eye-right" />
        <i className="agent-core" />
      </div>
      <div className="agent-shadow" />
    </div>
  );
}

function WorldMap({ language, world, status }) {
  const t = copy[language];
  const viewportRef = useRef(null);
  const pointerRef = useRef(null);
  const [view, setView] = useState({ x: 40, y: 35, scale: 0.63 });
  const latestEvent = world.events.at(-1);

  const fitWorld = () => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    const scale = Math.min((rect.width - 70) / WORLD_WIDTH, (rect.height - 70) / WORLD_HEIGHT, 0.86);
    setView({
      scale,
      x: (rect.width - WORLD_WIDTH * scale) / 2,
      y: (rect.height - WORLD_HEIGHT * scale) / 2,
    });
  };

  useEffect(() => {
    fitWorld();
    const observer = new ResizeObserver(() => fitWorld());
    if (viewportRef.current) observer.observe(viewportRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!latestEvent?.entityId || !activeStatuses.has(status)) return;
    const entity = world.entities[latestEvent.entityId];
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!entity || !rect) return;
    const center = entityCenter(entity);
    setView((current) => ({
      ...current,
      x: rect.width / 2 - center.x * current.scale,
      y: rect.height / 2 - center.y * current.scale,
    }));
  }, [latestEvent?.id, latestEvent?.entityId, status, world.entities]);

  const activeEntityId = latestEvent?.entityId;
  const activeActorId = latestEvent?.actorId;

  const roads = useMemo(
    () =>
      roadPairs
        .map(([fromId, toId]) => {
          const from = world.entities[fromId];
          const to = world.entities[toId];
          if (!from || !to) return null;
          const a = entityCenter(from);
          const b = entityCenter(to);
          const midX = (a.x + b.x) / 2;
          return { id: `${fromId}-${toId}`, path: `M${a.x},${a.y} C${midX},${a.y} ${midX},${b.y} ${b.x},${b.y}` };
        })
        .filter(Boolean),
    [world.entities],
  );

  const zoomAtCenter = (amount) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    setView((current) => {
      const nextScale = Math.max(0.28, Math.min(1.8, current.scale * amount));
      const worldX = (rect.width / 2 - current.x) / current.scale;
      const worldY = (rect.height / 2 - current.y) / current.scale;
      return {
        scale: nextScale,
        x: rect.width / 2 - worldX * nextScale,
        y: rect.height / 2 - worldY * nextScale,
      };
    });
  };

  return (
    <section className="world-panel">
      <div className="world-label">
        <span className="eyebrow">02</span>
        <div><strong>{t.world}</strong><small>{t.inspect}</small></div>
      </div>
      <div
        className="world-viewport"
        ref={viewportRef}
        onWheel={(event) => {
          event.preventDefault();
          const rect = viewportRef.current.getBoundingClientRect();
          const cursorX = event.clientX - rect.left;
          const cursorY = event.clientY - rect.top;
          setView((current) => {
            const nextScale = Math.max(0.28, Math.min(1.8, current.scale * (event.deltaY > 0 ? 0.9 : 1.1)));
            const worldX = (cursorX - current.x) / current.scale;
            const worldY = (cursorY - current.y) / current.scale;
            return { scale: nextScale, x: cursorX - worldX * nextScale, y: cursorY - worldY * nextScale };
          });
        }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          pointerRef.current = { x: event.clientX, y: event.clientY, view };
        }}
        onPointerMove={(event) => {
          if (!pointerRef.current) return;
          const start = pointerRef.current;
          setView({ ...start.view, x: start.view.x + event.clientX - start.x, y: start.view.y + event.clientY - start.y });
        }}
        onPointerUp={() => { pointerRef.current = null; }}
        onPointerCancel={() => { pointerRef.current = null; }}
      >
        <div className="world-surface" style={{ transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})` }}>
          <div className="terrain-layer" />
          <svg className="road-layer" width={WORLD_WIDTH} height={WORLD_HEIGHT} viewBox={`0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}`}>
            {roads.map((road) => (
              <g key={road.id}>
                <path className="road-edge" d={road.path} />
                <path className="road" d={road.path} />
                <path className="road-dash" d={road.path} />
              </g>
            ))}
          </svg>
          <div className="water water-one" /><div className="water water-two" />
          <div className="tree-cluster trees-one"><i /><i /><i /><i /></div>
          <div className="tree-cluster trees-two"><i /><i /><i /></div>
          <div className="tree-cluster trees-three"><i /><i /><i /><i /><i /></div>
          {Object.values(world.entities).map((entity) => (
            <Building key={entity.id} entity={entity} language={language} active={entity.id === activeEntityId} />
          ))}
          {Object.values(world.agents).map((agent) => (
            <Agent key={agent.id} agent={agent} language={language} active={agent.id === activeActorId} />
          ))}
          {latestEvent ? (
            <div className="event-toast-world" style={activeEntityId && world.entities[activeEntityId] ? { left: world.entities[activeEntityId].x + world.entities[activeEntityId].width / 2, top: world.entities[activeEntityId].y - 32 } : { left: 820, top: 80 }}>
              <span>{latestEvent.type}</span>
              <strong>{latestEvent.title}</strong>
            </div>
          ) : null}
        </div>
        <div className="map-grid-overlay" />
      </div>
      <div className="map-controls">
        <button onClick={() => zoomAtCenter(1.18)} title={t.zoomIn} aria-label={t.zoomIn}><Icon name="plus" /></button>
        <button onClick={() => zoomAtCenter(0.84)} title={t.zoomOut} aria-label={t.zoomOut}><Icon name="minus" /></button>
        <button onClick={fitWorld} title={t.fit} aria-label={t.fit}><Icon name="fit" /></button>
        <span>{Math.round(view.scale * 100)}%</span>
      </div>
      <div className="world-revision">REV {String(world.revision).padStart(3, "0")}</div>
    </section>
  );
}

function PlanView({ plan, ledger, language }) {
  const t = copy[language];
  if (!plan) return <EmptyState icon="plan" text={t.noPlan} />;
  return (
    <div className="plan-view">
      <div className="plan-objective">
        <small>{language === "zh" ? "目標" : "OBJECTIVE"}</small>
        <p>{plan.objective}</p>
      </div>
      <div className="step-list">
        {plan.steps.map((item, index) => {
          const execution = ledger[index];
          const status = execution?.status || "queued";
          return (
            <div className={`plan-step plan-step-${status}`} key={`${item.id}-${index}`}>
              <div className="step-index">{String(index + 1).padStart(2, "0")}</div>
              <div className="step-copy">
                <strong>{item.title}</strong>
                <span>{item.action.type.replaceAll("_", " ")}</span>
              </div>
              <div className="step-state">{status === "verified" ? <Icon name="check" size={15} /> : <i />}</div>
            </div>
          );
        })}
      </div>
      {plan.assumptions?.length ? (
        <div className="assumptions">
          <small>{language === "zh" ? "邊界與假設" : "BOUNDARIES & ASSUMPTIONS"}</small>
          {plan.assumptions.map((item, index) => <p key={index}>{item}</p>)}
        </div>
      ) : null}
    </div>
  );
}

function ActionView({ ledger, language }) {
  const t = copy[language];
  if (!ledger.length) return <EmptyState icon="action" text={t.noActions} />;
  return (
    <div className="action-ledger">
      {ledger.map((entry, index) => (
        <article className={`ledger-entry ledger-${entry.status}`} key={`${entry.id}-${index}`}>
          <header>
            <span className="ledger-code">A{String(index + 1).padStart(2, "0")}</span>
            <strong>{entry.actionType.replaceAll("_", " ")}</strong>
            <em>{t[entry.status] || entry.status}</em>
          </header>
          {entry.validation ? (
            <div className="validation-row">
              <span>{entry.validation.ok ? "PRECONDITION PASS" : "PRECONDITION FAIL"}</span>
              {entry.validation.errors?.map((error, errorIndex) => <p key={errorIndex}>{error}</p>)}
            </div>
          ) : null}
          {entry.evidence?.length ? (
            <div className="evidence-mini">
              {entry.evidence.map((evidence, evidenceIndex) => (
                <span key={evidenceIndex} className={evidence.passed ? "evidence-pass" : "evidence-fail"}>
                  {evidence.passed ? "✓" : "×"} {evidence.name}
                </span>
              ))}
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function StateView({ world, language }) {
  const t = copy[language];
  const orders = Object.values(world.orders);
  const recentEvidence = world.evidence.slice(-8).reverse();
  const facts = [
    [t.revision, world.revision],
    [t.entities, Object.keys(world.entities).length],
    [t.agents, Object.keys(world.agents).length],
    [t.orders, orders.length],
    [t.evidence, world.evidence.length],
  ];
  return (
    <div className="state-view">
      <div className="fact-grid">
        {facts.map(([label, value]) => <div className="fact" key={label}><strong>{value}</strong><span>{label}</span></div>)}
      </div>
      <div className="state-section">
        <small>{language === "zh" ? "訂單狀態" : "ORDER STATE"}</small>
        {orders.length ? orders.map((order) => (
          <div className="state-row" key={order.id}>
            <div><strong>{order.id}</strong><span>{order.quantity} × {order.item}</span></div>
            <em>{order.status.replaceAll("_", " ")}</em>
          </div>
        )) : <p className="muted">{t.noState}</p>}
      </div>
      <div className="state-section">
        <small>{language === "zh" ? "最新驗證證據" : "LATEST EVIDENCE"}</small>
        {recentEvidence.length ? recentEvidence.map((evidence) => (
          <div className="state-row evidence-row" key={evidence.id}>
            <Icon name={evidence.passed ? "check" : "warning"} size={14} />
            <div><strong>{evidence.condition || evidence.kind}</strong><span>{evidence.statement}</span></div>
          </div>
        )) : <p className="muted">{t.noState}</p>}
      </div>
    </div>
  );
}

function EmptyState({ icon, text }) {
  return <div className="empty-state"><Icon name={icon} size={28} /><p>{text}</p></div>;
}

function Inspector({ language, plan, ledger, world }) {
  const t = copy[language];
  const [tab, setTab] = useState("plan");
  return (
    <aside className="inspector panel">
      <div className="inspector-tabs">
        {[
          ["plan", "plan", t.plan],
          ["actions", "action", t.actions],
          ["state", "state", t.state],
        ].map(([id, icon, label]) => (
          <button className={tab === id ? "active" : ""} onClick={() => setTab(id)} key={id}>
            <Icon name={icon} size={16} /><span>{label}</span>
          </button>
        ))}
      </div>
      <div className="inspector-content">
        {tab === "plan" ? <PlanView plan={plan} ledger={ledger} language={language} /> : null}
        {tab === "actions" ? <ActionView ledger={ledger} language={language} /> : null}
        {tab === "state" ? <StateView world={world} language={language} /> : null}
      </div>
    </aside>
  );
}

export default function App() {
  const [language, setLanguageState] = useState(() => localStorage.getItem("asympta-world-language") || "en");
  const setLanguage = (next) => {
    localStorage.setItem("asympta-world-language", next);
    setLanguageState(next);
  };
  const agentWorld = useAgentWorld(language);

  return (
    <div className="app-shell">
      <TopBar
        language={language}
        setLanguage={setLanguage}
        status={agentWorld.status}
        progress={agentWorld.progress}
        model={agentWorld.model}
        reset={agentWorld.reset}
      />
      <main className="workspace">
        <ConversationPanel
          language={language}
          messages={agentWorld.messages}
          status={agentWorld.status}
          progress={agentWorld.progress}
          error={agentWorld.error}
          runIntent={agentWorld.runIntent}
          cancel={agentWorld.cancel}
        />
        <WorldMap language={language} world={agentWorld.world} status={agentWorld.status} />
        <Inspector language={language} plan={agentWorld.plan} ledger={agentWorld.ledger} world={agentWorld.world} />
      </main>
    </div>
  );
}
