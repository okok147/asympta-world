"use client";

import { BriefcaseBusiness, ChevronDown, ChevronUp, RotateCcw, Square } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { AnimalPortrait, animalSvgMarkup } from "@/components/asympta-animal-art";
import {
  ATLAS_LOCATIONS,
  type StakeholderSide,
} from "@/lib/atlas-simulation";
import {
  DEFAULT_JOB_PROFILE,
  buildJobStages,
  normalizeJobProfile,
  rankJobOpportunities,
  type JobProfile,
  type JobStage,
  type RankedJobOpportunity,
} from "@/lib/asympta-job-mode";

type Locale = "en" | "zh-Hant" | "ja";
type MarkerLike = {
  setLngLat(coordinates: [number, number]): MarkerLike;
  addTo(map: unknown): MarkerLike;
  getElement(): HTMLElement;
  remove(): void;
};
type MapLibreLike = { Marker: new (options: { element: HTMLElement; anchor?: "center" }) => MarkerLike };
type PortalTargets = { workflows: HTMLElement | null; panel: HTMLElement | null; map: HTMLElement | null };
type JobMessage = { id: number; text: string };
type JobRuntime = {
  active: boolean;
  completed: boolean;
  opportunity: RankedJobOpportunity;
  stages: JobStage[];
  stageIndex: number;
  stageStartedAt: number;
  stageProgress: number;
  originLocationId: string;
  earned: number;
  messages: JobMessage[];
};

const PROFILE_KEY = "asympta-world.job-profile.v1";
const BALANCE_KEY = "asympta-world.job-balance.v1";
const TICK_MS = 90;
const UI_REFRESH_MS = 180;

const SIDE_COLORS: Record<string, string> = {
  user: "#4B7FA6", market: "#A06D93", quality: "#8B7559", business: "#C56F4A",
  finance: "#806B9C", operations: "#9B7A45", support: "#4E8E89",
};

const COPY: Record<Locale, Record<string, string>> = {
  en: {
    job: "Job", earn: "Earn", title: "Job Mode", profile: "Your work profile", skills: "Skills", skillsHint: "AI, LLM, JavaScript, IT support…",
    info: "Information", infoHint: "Experience, strengths, constraints, preferred work…", availability: "Availability", flexible: "Flexible", evenings: "Evenings",
    weekends: "Weekends", fullTime: "Full-time", minReward: "Minimum reward", start: "Start Job Mode", restart: "Restart Job Mode", stop: "Stop",
    market: "Opportunity market", match: "match", difficulty: "difficulty", selected: "Selected offer", likelihood: "human completion likelihood",
    current: "Current step", balance: "Balance", earned: "earned this job", stored: "Profile and demo balance stay in this browser.", synthetic: "Synthetic demo only — no real employer is contacted and no real offer is accepted.",
    completed: "Deal completed", human: "Human step", agent: "Agent step",
  },
  "zh-Hant": {
    job: "工作", earn: "賺取", title: "Job Mode", profile: "你的工作資料", skills: "技能", skillsHint: "AI、LLM、JavaScript、IT Support…",
    info: "個人資料", infoHint: "經驗、強項、限制、偏好工作…", availability: "可工作時間", flexible: "彈性", evenings: "晚上",
    weekends: "週末", fullTime: "全職", minReward: "最低報酬", start: "啟動 Job Mode", restart: "重新開始 Job Mode", stop: "停止",
    market: "機會市場", match: "匹配", difficulty: "難度", selected: "已選 Offer", likelihood: "人類完成機率",
    current: "目前步驟", balance: "餘額", earned: "本次已賺取", stored: "工作資料與示範餘額會保留在此瀏覽器。", synthetic: "純模擬示範：不會聯絡真實僱主，也不會接受真實 Offer。",
    completed: "交易已完成", human: "人類步驟", agent: "代理步驟",
  },
  ja: {
    job: "仕事", earn: "収益", title: "Job Mode", profile: "仕事プロフィール", skills: "スキル", skillsHint: "AI、LLM、JavaScript、IT Support…",
    info: "情報", infoHint: "経験、強み、制約、希望する仕事…", availability: "稼働可能時間", flexible: "柔軟", evenings: "夜",
    weekends: "週末", fullTime: "フルタイム", minReward: "最低報酬", start: "Job Mode を開始", restart: "Job Mode を再開", stop: "停止",
    market: "機会マーケット", match: "適合", difficulty: "難易度", selected: "選択したオファー", likelihood: "人の完了見込み",
    current: "現在のステップ", balance: "残高", earned: "今回の収益", stored: "プロフィールとデモ残高はこのブラウザに保存されます。", synthetic: "合成デモのみ。実在の雇用主への連絡や実際のオファー承諾は行いません。",
    completed: "取引完了", human: "人のステップ", agent: "エージェント",
  },
};

function browserWindow() {
  return window as unknown as Window & { maplibregl?: MapLibreLike; __ASYMPTA_MAP__?: unknown };
}

function currentLocale(): Locale {
  const value = document.documentElement.lang.toLowerCase();
  if (value.startsWith("zh")) return "zh-Hant";
  if (value.startsWith("ja")) return "ja";
  return "en";
}

function readProfile() {
  if (typeof window === "undefined") return DEFAULT_JOB_PROFILE;
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    return raw ? normalizeJobProfile(JSON.parse(raw) as Partial<JobProfile>) : DEFAULT_JOB_PROFILE;
  } catch {
    return DEFAULT_JOB_PROFILE;
  }
}

function readBalance() {
  if (typeof window === "undefined") return 0;
  try {
    const value = Number(window.localStorage.getItem(BALANCE_KEY));
    return Number.isFinite(value) && value >= 0 ? Math.round(value) : 0;
  } catch {
    return 0;
  }
}

function writeProfile(profile: JobProfile) {
  try { window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); } catch {}
}

function writeBalance(balance: number) {
  try { window.localStorage.setItem(BALANCE_KEY, String(Math.max(0, Math.round(balance)))); } catch {}
}

function interpolateLocation(fromId: string, toId: string, progress: number): [number, number] {
  const from = ATLAS_LOCATIONS[fromId] ?? ATLAS_LOCATIONS.shibuya;
  const to = ATLAS_LOCATIONS[toId] ?? ATLAS_LOCATIONS.shibuya;
  const t = Math.max(0, Math.min(1, progress));
  const smooth = t * t * (3 - 2 * t);
  return [from.point.lon + (to.point.lon - from.point.lon) * smooth, from.point.lat + (to.point.lat - from.point.lat) * smooth];
}

function stageMessage(stage: JobStage, opportunity: RankedJobOpportunity, reward: number) {
  if (stage.id === "scout") return `Market agent ranked opportunities and selected ${opportunity.title}.`;
  if (stage.id === "enquiry") return `Business agent asked ${opportunity.client} about scope, deadline and acceptance criteria.`;
  if (stage.id === "terms") return `Finance agent checked difficulty ${opportunity.difficulty}/5 against the proposed reward.`;
  if (stage.id === "negotiate") return `Business agent converged the simulated deal to ¥${reward.toLocaleString("en-US")}.`;
  if (stage.id === "offer") return `Personal agent accepted the highest-utility synthetic offer.`;
  if (stage.id === "prepare") return `Operations prepared context, checklist and templates; only necessary human work remains.`;
  if (stage.id === "human") return `Human work finished. Agents can now verify, communicate and close the deal.`;
  if (stage.id === "review") return `Quality agent verified the deliverable against the agreed criteria.`;
  if (stage.id === "handoff") return `Support agent completed the final simulated client communication.`;
  if (stage.id === "settle") return `Finance reconciled the deal and confirmed the live-earned balance.`;
  return `${stage.title} complete.`;
}

function createMarkerElement(stage: JobStage) {
  const element = document.createElement("div");
  element.className = "animal-map-marker animal-map-marker--foreground asympta-job-marker has-dialogue";
  element.dataset.agentId = `job-${stage.agentId}`;
  element.dataset.side = stage.side;
  element.dataset.status = "moving";
  element.style.setProperty("--agent-color", SIDE_COLORS[stage.side] ?? "#4B7FA6");
  element.title = `${stage.title} · Job Mode`;

  const dialogue = document.createElement("span");
  dialogue.className = "animal-map-marker__dialogue";
  dialogue.textContent = stage.title;
  element.appendChild(dialogue);

  const face = document.createElement("span");
  face.className = "animal-map-marker__face";
  face.innerHTML = animalSvgMarkup(`job-${stage.agentId}`, stage.side as StakeholderSide);
  element.appendChild(face);

  const dot = document.createElement("span");
  dot.className = "animal-map-marker__status-dot";
  element.appendChild(dot);

  const status = document.createElement("span");
  status.className = "animal-map-marker__status-text";
  status.textContent = "Job Mode";
  element.appendChild(status);
  return element;
}

export function AsymptaJobMode() {
  const [targets, setTargets] = useState<PortalTargets>({ workflows: null, panel: null, map: null });
  const [locale, setLocale] = useState<Locale>("en");
  const [panelOpen, setPanelOpen] = useState(false);
  const [profile, setProfile] = useState<JobProfile>(DEFAULT_JOB_PROFILE);
  const [balance, setBalance] = useState(0);
  const [runtime, setRuntime] = useState<JobRuntime | null>(null);
  const runtimeRef = useRef<JobRuntime | null>(null);
  const balanceRef = useRef(0);
  const markerRef = useRef<MarkerLike | null>(null);
  const markerStageRef = useRef("");
  const lastUiAtRef = useRef(0);
  const messageIdRef = useRef(0);

  const ranked = useMemo(() => rankJobOpportunities(profile), [profile]);
  const copy = COPY[locale];

  useEffect(() => {
    const hydrate = window.setTimeout(() => {
      const savedProfile = readProfile();
      const savedBalance = readBalance();
      setProfile(savedProfile);
      setBalance(savedBalance);
      balanceRef.current = savedBalance;
    }, 0);
    const sync = () => {
      const workflows = document.querySelector<HTMLElement>(".atlas-workflows");
      const panel = document.querySelector<HTMLElement>(".atlas-menu-panel");
      const map = document.querySelector<HTMLElement>(".map-app");
      setTargets((value) => value.workflows === workflows && value.panel === panel && value.map === map ? value : { workflows, panel, map });
      const nextLocale = currentLocale();
      setLocale((value) => value === nextLocale ? value : nextLocale);
    };
    const kickoff = window.setTimeout(sync, 0);
    const timer = window.setInterval(sync, 500);
    return () => {
      window.clearTimeout(hydrate);
      window.clearTimeout(kickoff);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    writeProfile(profile);
  }, [profile]);

  useEffect(() => {
    const map = targets.map;
    if (!map) return;
    if (runtime?.active || runtime?.completed) map.dataset.asymptaJobMode = "on";
    else delete map.dataset.asymptaJobMode;
    return () => { delete map.dataset.asymptaJobMode; };
  }, [runtime?.active, runtime?.completed, targets.map]);

  const removeMarker = () => {
    markerRef.current?.remove();
    markerRef.current = null;
    markerStageRef.current = "";
  };

  const ensureMarker = (stage: JobStage, coordinates: [number, number]) => {
    const bridge = browserWindow();
    if (!bridge.maplibregl || !bridge.__ASYMPTA_MAP__) return null;
    if (markerRef.current && markerStageRef.current !== stage.id) removeMarker();
    if (!markerRef.current) {
      const element = createMarkerElement(stage);
      markerRef.current = new bridge.maplibregl.Marker({ element, anchor: "center" }).setLngLat(coordinates).addTo(bridge.__ASYMPTA_MAP__);
      markerStageRef.current = stage.id;
    }
    return markerRef.current;
  };

  const stopJob = () => {
    const next = runtimeRef.current ? { ...runtimeRef.current, active: false } : null;
    runtimeRef.current = next;
    setRuntime(next);
    removeMarker();
  };

  const startJob = () => {
    const best = rankJobOpportunities(profile)[0];
    const built = buildJobStages(profile, best);
    const next: JobRuntime = {
      active: true,
      completed: false,
      opportunity: built.opportunity,
      stages: built.stages,
      stageIndex: 0,
      stageStartedAt: performance.now(),
      stageProgress: 0,
      originLocationId: "shibuya",
      earned: 0,
      messages: [{ id: ++messageIdRef.current, text: `Job Mode started. Personal agent received ${built.profile.skills.length || "general"} skill signals.` }],
    };
    removeMarker();
    runtimeRef.current = next;
    setRuntime(next);
    setPanelOpen(true);
  };

  useEffect(() => {
    const tick = () => {
      const current = runtimeRef.current;
      if (!current?.active || document.hidden) return;
      const stage = current.stages[current.stageIndex];
      if (!stage) return;
      const now = performance.now();
      const elapsed = Math.max(0, now - current.stageStartedAt);
      const progress = Math.min(1, elapsed / Math.max(1, stage.durationMs));
      const travelProgress = Math.min(1, progress / 0.42);
      const coordinates = interpolateLocation(current.originLocationId, stage.locationId, travelProgress);
      const marker = ensureMarker(stage, coordinates);
      if (marker) {
        marker.setLngLat(coordinates);
        const element = marker.getElement();
        element.dataset.status = travelProgress < 1 ? "moving" : "working";
        element.classList.toggle("is-moving", travelProgress < 1);
        element.classList.toggle("is-working", travelProgress >= 1);
        const dialogue = element.querySelector<HTMLElement>(".animal-map-marker__dialogue");
        const status = element.querySelector<HTMLElement>(".animal-map-marker__status-text");
        if (dialogue) dialogue.textContent = stage.title;
        if (status) status.textContent = `${stage.humanRequired ? "human" : "agent"} · ${Math.round(progress * 100)}%`;
      }

      let earned = current.earned;
      if (stage.humanRequired) {
        const targetEarned = Math.round(current.opportunity.negotiatedReward * progress);
        if (targetEarned > earned) {
          const delta = targetEarned - earned;
          earned = targetEarned;
          balanceRef.current += delta;
          writeBalance(balanceRef.current);
        }
      }

      let next: JobRuntime = { ...current, stageProgress: progress, earned };
      if (progress >= 1) {
        const messages = [...current.messages, { id: ++messageIdRef.current, text: stageMessage(stage, current.opportunity, current.opportunity.negotiatedReward) }].slice(-6);
        if (current.stageIndex >= current.stages.length - 1) {
          next = { ...next, active: false, completed: true, stageProgress: 1, messages };
          removeMarker();
        } else {
          next = {
            ...next,
            stageIndex: current.stageIndex + 1,
            stageStartedAt: now,
            stageProgress: 0,
            originLocationId: stage.locationId,
            messages,
          };
        }
        runtimeRef.current = next;
        setRuntime(next);
        setBalance(balanceRef.current);
        lastUiAtRef.current = now;
        return;
      }

      runtimeRef.current = next;
      if (now - lastUiAtRef.current >= UI_REFRESH_MS) {
        lastUiAtRef.current = now;
        setRuntime(next);
        setBalance(balanceRef.current);
      }
    };

    const timer = window.setInterval(tick, TICK_MS);
    return () => {
      window.clearInterval(timer);
      removeMarker();
    };
  }, []);

  const activeStage = runtime ? runtime.stages[runtime.stageIndex] : null;
  const opportunity = runtime?.opportunity ?? ranked[0];

  const style = (
    <style>{`
      .asympta-job-mode__tile{position:relative}.asympta-job-mode__tile.is-active::after{content:"";position:absolute;right:6px;top:6px;width:5px;height:5px;border-radius:50%;background:#698b5d}.asympta-job-panel{display:grid;gap:9px;margin-top:8px;padding:9px;border:1px solid rgba(67,63,56,.10);border-radius:13px;background:rgba(250,247,239,.52);color:#514d46}.asympta-job-panel__head{display:flex;align-items:center;justify-content:space-between;gap:8px}.asympta-job-panel__head>div{min-width:0}.asympta-job-panel__head strong{display:block;font-size:10px}.asympta-job-panel__head small{display:block;margin-top:2px;color:#898177;font-size:7px}.asympta-job-panel__head button{width:30px;height:30px;display:grid;place-items:center;border:1px solid rgba(67,63,56,.09);border-radius:8px;background:rgba(255,255,255,.35);color:#6b655e}.asympta-job-profile{display:grid;grid-template-columns:1fr 1fr;gap:6px}.asympta-job-field{min-width:0;display:grid;gap:3px}.asympta-job-field--wide{grid-column:1/-1}.asympta-job-field span{color:#7c756d;font-size:7px;font-weight:700}.asympta-job-field input,.asympta-job-field textarea,.asympta-job-field select{width:100%;min-width:0;box-sizing:border-box;border:1px solid rgba(67,63,56,.11);border-radius:8px;background:rgba(255,255,255,.42);color:#514d46;font:8px/1.35 system-ui,sans-serif;outline:none}.asympta-job-field input,.asympta-job-field select{height:32px;padding:0 8px}.asympta-job-field textarea{min-height:48px;padding:7px 8px;resize:vertical}.asympta-job-field input:focus,.asympta-job-field textarea:focus,.asympta-job-field select:focus{border-color:rgba(75,127,166,.42);box-shadow:0 0 0 2px rgba(75,127,166,.08)}.asympta-job-market{display:grid;gap:5px}.asympta-job-market__title{color:#7c756d;font-size:7px;font-weight:800;letter-spacing:.06em;text-transform:uppercase}.asympta-job-opportunity{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px;align-items:center;padding:6px 7px;border:1px solid rgba(67,63,56,.08);border-radius:9px;background:rgba(255,255,255,.25)}.asympta-job-opportunity strong,.asympta-job-opportunity small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.asympta-job-opportunity strong{font-size:8px}.asympta-job-opportunity small{margin-top:2px;color:#8a8379;font-size:6.5px}.asympta-job-opportunity b{font-size:8px;color:#5b7560}.asympta-job-actions{display:flex;gap:6px}.asympta-job-actions button{min-height:34px;display:inline-flex;align-items:center;justify-content:center;gap:5px;padding:0 10px;border:1px solid rgba(67,63,56,.10);border-radius:9px;background:rgba(255,255,255,.38);color:#625d56;font-size:8px;font-weight:750;cursor:pointer}.asympta-job-actions button:first-child{flex:1;border-color:rgba(75,127,166,.18);background:rgba(75,127,166,.07);color:#426d8d}.asympta-job-live{display:grid;grid-template-columns:1.15fr .85fr;gap:7px}.asympta-job-live>section{min-width:0;padding:7px;border:1px solid rgba(67,63,56,.08);border-radius:9px;background:rgba(255,255,255,.24)}.asympta-job-live small,.asympta-job-live strong{display:block}.asympta-job-live small{color:#8a8379;font-size:6.5px}.asympta-job-live strong{margin-top:3px;font-size:9px}.asympta-job-progress{height:4px;margin-top:6px;border-radius:999px;background:rgba(67,63,56,.08);overflow:hidden}.asympta-job-progress i{display:block;height:100%;background:#698b5d}.asympta-job-messages{display:grid;gap:3px;max-height:74px;overflow:auto}.asympta-job-messages p{margin:0;padding-left:8px;border-left:2px solid rgba(75,127,166,.18);color:#736d65;font-size:6.8px;line-height:1.35}.asympta-job-disclosure{color:#948c81;font-size:6.5px;line-height:1.35}.asympta-job-wallet{position:absolute;z-index:88;top:92px;left:14px;display:flex;align-items:center;gap:8px;padding:7px 9px;border:1px solid rgba(67,63,56,.11);border-radius:12px;background:rgba(249,246,238,.94);box-shadow:0 6px 18px rgba(54,50,42,.06);pointer-events:none}.asympta-job-wallet span,.asympta-job-wallet strong{display:block}.asympta-job-wallet span{color:#8a8379;font-size:6.5px}.asympta-job-wallet strong{font-size:11px;color:#4f6754}.asympta-job-wallet small{color:#8a8379;font-size:6.5px}.map-app[data-asympta-job-mode="on"] .animal-map-marker--foreground:not(.asympta-job-marker){opacity:.34}.asympta-job-marker{z-index:9}.asympta-job-marker .animal-map-marker__dialogue{border-color:rgba(105,139,93,.20)}@media(max-width:700px){.asympta-job-profile{grid-template-columns:1fr}.asympta-job-field--wide{grid-column:auto}.asympta-job-live{grid-template-columns:1fr}.asympta-job-wallet{top:116px;left:10px}}@media(prefers-reduced-motion:reduce){.asympta-job-marker *{transition:none!important}}
    `}</style>
  );

  const tile = targets.workflows ? createPortal(
    <button type="button" className={`atlas-workflow asympta-job-mode__tile${runtime?.active || runtime?.completed ? " is-active" : ""}`} onClick={() => setPanelOpen((value) => !value)}>
      <span className="atlas-workflow__icon"><BriefcaseBusiness size={17} strokeWidth={1.7} /></span>
      <strong>{copy.job}</strong><span>{copy.earn}</span>
    </button>,
    targets.workflows,
  ) : null;

  const panel = targets.panel && panelOpen ? createPortal(
    <section className="asympta-job-panel" aria-label={copy.title}>
      <div className="asympta-job-panel__head">
        <div><strong>{copy.title}</strong><small>{runtime?.completed ? copy.completed : runtime?.active ? opportunity.title : copy.profile}</small></div>
        <button type="button" aria-label={panelOpen ? "Collapse Job Mode" : "Open Job Mode"} onClick={() => setPanelOpen((value) => !value)}>{panelOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button>
      </div>

      {!runtime?.active && !runtime?.completed ? (
        <>
          <div className="asympta-job-profile">
            <label className="asympta-job-field asympta-job-field--wide"><span>{copy.skills}</span><input value={profile.skills.join(", ")} placeholder={copy.skillsHint} onChange={(event) => setProfile((value) => normalizeJobProfile({ ...value, skills: event.target.value.split(",") }))} /></label>
            <label className="asympta-job-field asympta-job-field--wide"><span>{copy.info}</span><textarea value={profile.summary} placeholder={copy.infoHint} onChange={(event) => setProfile((value) => normalizeJobProfile({ ...value, summary: event.target.value }))} /></label>
            <label className="asympta-job-field"><span>{copy.availability}</span><select value={profile.availability} onChange={(event) => setProfile((value) => normalizeJobProfile({ ...value, availability: event.target.value as JobProfile["availability"] }))}><option value="flexible">{copy.flexible}</option><option value="evenings">{copy.evenings}</option><option value="weekends">{copy.weekends}</option><option value="full-time">{copy.fullTime}</option></select></label>
            <label className="asympta-job-field"><span>{copy.minReward} · JPY</span><input type="number" min="0" max="100000" step="100" value={profile.minReward} onChange={(event) => setProfile((value) => normalizeJobProfile({ ...value, minReward: Number(event.target.value) }))} /></label>
          </div>
          <div className="asympta-job-market"><div className="asympta-job-market__title">{copy.market}</div>{ranked.slice(0, 3).map((item) => <div className="asympta-job-opportunity" key={item.id}><div><strong>{item.title}</strong><small>{item.client} · {Math.round(item.match * 100)}% {copy.match} · {copy.difficulty} {item.difficulty}/5</small></div><b>¥{item.negotiatedReward.toLocaleString("en-US")}</b></div>)}</div>
        </>
      ) : null}

      {runtime ? (
        <>
          <div className="asympta-job-opportunity"><div><small>{copy.selected}</small><strong>{runtime.opportunity.title}</strong><small>{Math.round(runtime.opportunity.match * 100)}% {copy.match} · {Math.round(runtime.opportunity.completionLikelihood * 100)}% {copy.likelihood}</small></div><b>¥{runtime.opportunity.negotiatedReward.toLocaleString("en-US")}</b></div>
          <div className="asympta-job-live">
            <section>{activeStage ? <><small>{copy.current} · {activeStage.humanRequired ? copy.human : copy.agent}</small><strong>{activeStage.title}</strong><div className="asympta-job-progress"><i style={{ width: `${Math.round(runtime.stageProgress * 100)}%` }} /></div></> : <><small>{copy.current}</small><strong>{copy.completed}</strong></>}</section>
            <section><small>{copy.balance}</small><strong>¥{balance.toLocaleString("en-US")}</strong><small>+¥{runtime.earned.toLocaleString("en-US")} {copy.earned}</small></section>
          </div>
          <div className="asympta-job-messages">{runtime.messages.slice(-5).map((message) => <p key={message.id}>{message.text}</p>)}</div>
        </>
      ) : null}

      <div className="asympta-job-actions">
        <button type="button" onClick={startJob}>{runtime ? <RotateCcw size={13} /> : <BriefcaseBusiness size={13} />}{runtime ? copy.restart : copy.start}</button>
        {runtime?.active ? <button type="button" onClick={stopJob}><Square size={12} />{copy.stop}</button> : null}
      </div>
      <div className="asympta-job-disclosure">{copy.stored}<br />{copy.synthetic}</div>
    </section>,
    targets.panel,
  ) : null;

  const wallet = targets.map && (runtime?.active || runtime?.completed) ? createPortal(
    <aside className="asympta-job-wallet" aria-live="polite"><BriefcaseBusiness size={16} /><div><span>{copy.balance}</span><strong>¥{balance.toLocaleString("en-US")}</strong></div>{runtime ? <small>+¥{runtime.earned.toLocaleString("en-US")}</small> : null}</aside>,
    targets.map,
  ) : null;

  return <>{style}{tile}{panel}{wallet}</>;
}
