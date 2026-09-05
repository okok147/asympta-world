"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowUpRight, Braces, Check, ChevronDown, ChevronUp, Circle, CornerDownRight, PencilLine, Play, Plus, Radio, Sparkles } from "lucide-react";
import { useAsymptaGlobalLocale } from "./asympta-feature-locale";
import { ATLAS_WORKFLOWS } from "@/lib/atlas-simulation";
import { buildSimulationWorkflow, compileSimulation, SIMULATION_LIMIT, SIMULATION_STAGES, SIMULATION_WORKFLOW_ID, type SimulationPacket, type SimulationSide, type SimulationStage } from "@/lib/asympta-simulation-compiler";
import { SIMULATION_EXAMPLES, simulationText, type SimulationCopyKey } from "@/lib/asympta-simulation-copy";

type Draft = { text: string; answers: Record<string, string> };
type Snapshot = { workflowId: string; phase: string; tasks: Array<{ id: string; title: string; status: string; agentId: string }>; approvals: Array<{ id: string; status: string; taskId: string }> };
type ActiveSimulation = { packet: SimulationPacket; snapshot: Snapshot | null };
const KEY = "asympta:simulation-drafts:v1";
const EMPTY_DRAFTS: Record<SimulationSide, Draft> = { users: { text: "", answers: {} }, business: { text: "", answers: {} } };

function snapshot(): Snapshot | null {
  const value = window.__ASYMPTA_DEMO__?.snapshot() as { foreground?: Snapshot } | undefined;
  const world = value?.foreground as (Snapshot & { pendingApprovals?: Snapshot["approvals"] }) | undefined;
  return world ? { workflowId: world.workflowId, phase: world.phase, tasks: world.tasks, approvals: (world.pendingApprovals ?? []).map(approval => ({ ...approval, status: "pending" })) } : null;
}
function id() { return `sim-${crypto.randomUUID()}`; }
function safeDraft(value: unknown): Draft {
  if (!value || typeof value !== "object") return { text: "", answers: {} };
  const entry = value as Partial<Draft>;
  const answers = entry.answers && typeof entry.answers === "object" && !Array.isArray(entry.answers) ? Object.fromEntries(Object.entries(entry.answers).filter(([, v]) => typeof v === "string").map(([k, v]) => [k, v.slice(0, 2000)])) : {};
  return { text: typeof entry.text === "string" ? entry.text.slice(0, SIMULATION_LIMIT) : "", answers };
}

export function AsymptaSimulationWorkspace({ side }: { side: SimulationSide }) {
  const locale = useAsymptaGlobalLocale();
  const t = (key: SimulationCopyKey) => simulationText(key, locale);
  const index = locale === "zh-Hant" ? 1 : locale === "ja" ? 2 : 0;
  const [open, setOpen] = useState(true);
  const [drafts, setDrafts] = useState(EMPTY_DRAFTS);
  const [packets, setPackets] = useState<Partial<Record<SimulationSide, SimulationPacket>>>({});
  const [active, setActive] = useState<ActiveSimulation | null>(null);
  const [error, setError] = useState<SimulationCopyKey | null>(null);
  const loaded = useRef(false);
  const runLock = useRef(false);
  const lastStartedRef = useRef<string | null>(null);
  const draft = drafts[side];
  const packet = packets[side];
  const running = active && !["completed", "blocked"].includes(active.snapshot?.phase ?? "running");
  const isCurrent = active?.packet.id === packet?.id;
  const world = isCurrent ? active?.snapshot : null;
  const pending = world?.approvals.find(approval => approval.status === "pending" && approval.taskId?.startsWith(`${packet?.id}:`));
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const value = JSON.parse(sessionStorage.getItem(KEY) ?? "null");
        if (value) setDrafts({ users: safeDraft(value.users), business: safeDraft(value.business) });
      } catch { /* Empty local drafts are a valid fallback. */ }
      loaded.current = true;
    });
  }, []);
  useEffect(() => {
    if (!loaded.current) return;
    try { sessionStorage.setItem(KEY, JSON.stringify(drafts)); } catch { /* In-memory editing remains usable. */ }
  }, [drafts]);
  useEffect(() => {
    document.documentElement.dataset.asymptaSimulationEditor = String(open);
    return () => { delete document.documentElement.dataset.asymptaSimulationEditor; };
  }, [open]);
  useEffect(() => {
    const update = () => {
      const next = snapshot();
      setActive(current => {
        if (!current || !next) return current;
        if (next.workflowId && next.workflowId !== SIMULATION_WORKFLOW_ID && current.snapshot?.phase === "running") return { ...current, snapshot: { ...current.snapshot, phase: "blocked" } };
        if (next.workflowId !== SIMULATION_WORKFLOW_ID || !next.tasks.some(task => task.id.startsWith(`${current.packet.id}:`))) return current;
        if (JSON.stringify(current.snapshot) === JSON.stringify(next)) return current;
        return { ...current, snapshot: next };
      });
    };
    window.addEventListener("asympta:world-tick", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.removeEventListener("asympta:world-tick", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  // The shared global language changes the live journey as well as the editor.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("asympta:simulation-locale", { detail: { locale } }));
  }, [locale]);

  const changeDraft = (patch: Partial<Draft>) => {
    setDrafts(current => ({ ...current, [side]: { ...current[side], ...patch } }));
    setError(null);
  };
  const compile = (event?: FormEvent) => {
    event?.preventDefault();
    try {
      const next = compileSimulation({ id: packet && !isCurrent ? packet.id : id(), side, text: draft.text, locale, answers: draft.answers });
      setPackets(current => ({ ...current, [side]: next }));
      setError(null);
    } catch { setError(draft.text.length > SIMULATION_LIMIT ? "tooLong" : "failed"); }
  };
  const start = () => {
    if (!packet || packet.questions.length || running || runLock.current || lastStartedRef.current === packet.id) return;
    runLock.current = true;
    try {
      const bridge = window.__ASYMPTA_DEMO__;
      if (!bridge) throw new Error("world_not_ready");
      const titles = Object.fromEntries(SIMULATION_STAGES.map(stage => [stage, t(stage)])) as Record<SimulationStage, string>;
      const workflow = buildSimulationWorkflow(packet, titles);
      const existing = ATLAS_WORKFLOWS.findIndex(candidate => candidate.id === SIMULATION_WORKFLOW_ID);
      if (existing < 0) ATLAS_WORKFLOWS.push(workflow);
      else ATLAS_WORKFLOWS.splice(existing, 1, workflow);
      bridge.startWorkflow(SIMULATION_WORKFLOW_ID);
      const next = snapshot();
      if (next?.workflowId !== SIMULATION_WORKFLOW_ID) throw new Error("world_start_failed");
      lastStartedRef.current = packet.id;
      setActive({ packet, snapshot: next });
      window.dispatchEvent(new CustomEvent("asympta:simulation-started", { detail: { packetId: packet.id, side, mode: "simulated" } }));
      setError(null);
    } catch { setError("failed"); }
    finally { runLock.current = false; }
  };
  const decide = (approved: boolean) => {
    if (!pending) return;
    window.__ASYMPTA_DEMO__?.approve(pending.id, approved);
    const next = snapshot();
    if (next) setActive(current => current ? { ...current, snapshot: next } : current);
  };
  const edit = () => { setPackets(current => ({ ...current, [side]: undefined })); setError(null); queueMicrotask(() => textRef.current?.focus()); };
  const fresh = () => { changeDraft({ text: "", answers: {} }); edit(); };
  const label = (key: string) => t(key as SimulationCopyKey);

  return <section className={`simulation-studio${open ? " is-open" : ""}`} data-side={side} aria-label={t("open")}>
    <button className="simulation-studio__toggle" type="button" onClick={() => setOpen(value => !value)} aria-expanded={open} aria-controls="simulation-studio-content">
      <span><PencilLine size={17} /> {t("simulate")}</span>
      {open ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
    </button>
    <div id="simulation-studio-content" hidden={!open}>
      <header className="simulation-studio__heading">
        <div className="simulation-studio__eyebrow">ASYMPTA WORLD <span>{t("simulate")}</span></div>
        <h1>{t(side === "users" ? "usersTitle" : "businessTitle")}</h1>
        <p>{t(side === "users" ? "usersHint" : "businessHint")}</p>
      </header>
      {!packet ? <>
        <form className="simulation-studio__compose" onSubmit={compile}>
          <label className="simulation-studio__sr" htmlFor="simulation-input">{t("input")}</label>
          <textarea ref={textRef} id="simulation-input" name="simulation" value={draft.text} maxLength={SIMULATION_LIMIT} onChange={event => changeDraft({ text: event.target.value, answers: {} })} placeholder={t(side === "users" ? "usersPlaceholder" : "businessPlaceholder")} required onKeyDown={event => { if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && !event.nativeEvent.isComposing) { event.preventDefault(); compile(); } }} />
          <div className="simulation-studio__compose-footer"><small>{draft.text.length.toLocaleString()} / 12,000</small><button className="simulation-studio__primary" type="submit" disabled={!draft.text.trim()}>{t("compile")} <ArrowUpRight size={17} /></button></div>
        </form>
        <div className="simulation-studio__examples"><p>{t("examples")}</p><div>{SIMULATION_EXAMPLES.filter(example => example.side === side).map((example, i) => <button type="button" key={i} onClick={() => { changeDraft({ text: example.text[index], answers: {} }); textRef.current?.focus(); }}><CornerDownRight size={14} />{example.title[index]}</button>)}</div></div>
      </> : <div className="simulation-studio__brief">
        <div className="simulation-studio__section-title"><h2>{t("structured")}</h2><button type="button" className="simulation-studio__text-button" onClick={edit}><PencilLine size={14} />{t("edit")}</button></div>
        <blockquote translate="no">{packet.raw}</blockquote>
        <p className="simulation-studio__note">{t("compilerHint")}</p>
        <h3>{t("facts")}</h3>
        {packet.facts.length ? <dl>{packet.facts.map((fact, i) => <div key={`${fact.key}-${i}`}><dt>{label(fact.key)}</dt><dd translate="no">{fact.value}</dd></div>)}</dl> : <p className="simulation-studio__note">{t("noFacts")}</p>}
        {packet.questions.length > 0 && <form className="simulation-studio__questions" onSubmit={compile}><h3>{t("missing")}</h3>{packet.questions.map(question => <label key={question.key}><span>{label(question.key)}</span>{question.options ? <select required value={draft.answers[question.key] ?? ""} onChange={event => changeDraft({ answers: { ...draft.answers, [question.key]: event.target.value } })}><option value="">{t("answer")}</option>{question.options.map(option => <option key={option.value} value={option.value}>{option.label}{option.description?.match(/HK\$[\d,]+/)?.[0] ? ` · ${option.description.match(/HK\$[\d,]+/)?.[0]}` : ""}</option>)}</select> : <input required value={draft.answers[question.key] ?? ""} maxLength={2000} placeholder={t("answer")} onChange={event => changeDraft({ answers: { ...draft.answers, [question.key]: event.target.value } })} />}</label>)}<button type="submit" className="simulation-studio__secondary">{t("apply")}</button></form>}
        <h3>{t("agents")}</h3><div className="simulation-studio__agents">{packet.agents.map(agent => <span key={agent}><Circle size={10} />{label(agent)}</span>)}</div>
        {running && !isCurrent && <p className="simulation-studio__note" role="status">{t("activeOther")}</p>}
        {!isCurrent && <button type="button" className="simulation-studio__primary simulation-studio__start" disabled={packet.questions.length > 0 || Boolean(running)} onClick={start}><Play size={16} />{t("start")}</button>}
        {isCurrent && world && <section className="simulation-studio__journey" aria-label={t("trace")}>
          <h3 aria-live="polite">{t(world.phase === "completed" ? "completed" : world.phase === "waiting_approval" ? "waiting" : world.phase === "blocked" ? "blocked" : "running")}</h3>
          <ol>{world.tasks.map(task => { const stage = task.id.split(":").at(-1) as SimulationStage; return <li key={task.id} data-status={task.status}>{task.status === "done" ? <Check size={15} /> : <Circle size={15} />}<span>{t(stage)}</span></li>; })}</ol>
          {pending && <div className="simulation-studio__approval"><p>{t("approvalNote")}</p><div><button className="simulation-studio__secondary" type="button" onClick={() => decide(false)}>{t("decline")}</button><button className="simulation-studio__primary" type="button" onClick={() => decide(true)}>{t("approve")}</button></div></div>}
          {world.phase === "completed" && <p className="simulation-studio__note">{t("verified")}</p>}
          {["completed", "blocked"].includes(world.phase) && <button type="button" className="simulation-studio__secondary" onClick={fresh}><Plus size={15} />{t("new")}</button>}
        </section>}
        <details className="simulation-studio__packet"><summary><Braces size={16} />{t("packet")}</summary><pre translate="no">{JSON.stringify({ ...packet, runtime: isCurrent ? world : null }, null, 2)}</pre></details>
      </div>}
      {error && <p className="simulation-studio__error" role="alert">{t(error)}</p>}
      <footer className="simulation-studio__footer"><div><Radio size={14} /><span>{t("background")}</span></div><p>{t("backgroundDetail")}</p>{side === "users" && <button type="button" className="simulation-studio__text-button" onClick={() => setOpen(false)}><Sparkles size={14} />{t("legacy")}</button>}</footer>
    </div>
  </section>;
}
