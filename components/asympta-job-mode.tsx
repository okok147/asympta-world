"use client";

import { BriefcaseBusiness, Square } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { animalSvgMarkup } from "@/components/asympta-animal-art";
import {
  dominantEconomyCost,
  jobAccruedExpense,
  jobProjectedEconomy,
  jobStageCostPlan,
} from "@/lib/asympta-economy";
import { ATLAS_LOCATIONS, type StakeholderSide } from "@/lib/atlas-simulation";
import {
  DEFAULT_JOB_PROFILE,
  buildJobStages,
  normalizeJobProfile,
  rankJobOpportunities,
  type JobProfile,
  type JobStage,
  type RankedJobOpportunity,
} from "@/lib/asympta-job-mode";
import {
  readAsymptaUserPreferences,
  subscribeAsymptaUserPreferences,
  writeAsymptaUserPreferences,
} from "@/lib/asympta-user-preferences";

type Locale = "en" | "zh-Hant" | "ja";
type MarkerLike = {
  setLngLat(coordinates: [number, number]): MarkerLike;
  addTo(map: unknown): MarkerLike;
  getElement(): HTMLElement;
  remove(): void;
};
type MapLibreLike = { Marker: new (options: { element: HTMLElement; anchor?: "center" }) => MarkerLike };
type PortalTargets = { workflows: HTMLElement | null; panel: HTMLElement | null };
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
  spent: number;
  messages: JobMessage[];
};

const PROFILE_KEY = "asympta-world.job-profile.v1";
const BALANCE_KEY = "asympta-world.job-balance.v1";
const TICK_MS = 90;
const UI_REFRESH_MS = 180;
const AUTO_POLL_MS = 700;
const AUTO_NEXT_JOB_DELAY_MS = 2_200;

const SIDE_COLORS: Record<string, string> = {
  user: "#4B7FA6", market: "#8B7A91", quality: "#847A69", business: "#A97963",
  finance: "#756D86", operations: "#877A58", support: "#64827D",
};

const CATEGORY_COPY: Record<Locale, Record<string, string>> = {
  en: { agent: "agent time", compute: "compute", travel: "travel", materials: "tools/materials", logistics: "logistics", platform: "fees", holding: "reservation", rework: "rework" },
  "zh-Hant": { agent: "代理時間", compute: "運算", travel: "交通", materials: "工具／物料", logistics: "物流", platform: "平台費", holding: "預留", rework: "返工" },
  ja: { agent: "エージェント", compute: "計算", travel: "移動", materials: "道具・資材", logistics: "物流", platform: "手数料", holding: "予約", rework: "手戻り" },
};

const COPY: Record<Locale, Record<string, string>> = {
  en: {
    job: "Job", auto: "Auto", on: "On", off: "Off", title: "Job Mode", profile: "Work profile", skills: "Skills",
    skillsHint: "AI, LLM, JavaScript, IT support…", info: "Information", infoHint: "Experience, strengths, constraints, preferred work…",
    availability: "Availability", flexible: "Flexible", evenings: "Evenings", weekends: "Weekends", fullTime: "Full-time",
    minReward: "Minimum reward", start: "Start now", stop: "Stop", best: "Best opportunity", match: "match", difficulty: "difficulty",
    current: "Current", balance: "Balance", gross: "Gross", cost: "Cost", net: "Net", estCost: "est. cost", costDriver: "cost driver",
    stored: "Saved in this browser.", synthetic: "Synthetic demo only — no real employer is contacted or offer accepted.",
    completed: "Deal completed", human: "Human", agent: "Agent",
  },
  "zh-Hant": {
    job: "工作", auto: "自動", on: "開", off: "關", title: "Job Mode", profile: "工作資料", skills: "技能",
    skillsHint: "AI、LLM、JavaScript、IT Support…", info: "資料", infoHint: "經驗、強項、限制、偏好工作…",
    availability: "可工作時間", flexible: "彈性", evenings: "晚上", weekends: "週末", fullTime: "全職",
    minReward: "最低報酬", start: "立即開始", stop: "停止", best: "最佳機會", match: "匹配", difficulty: "難度",
    current: "目前", balance: "餘額", gross: "收入", cost: "成本", net: "淨額", estCost: "預估成本", costDriver: "主要成本",
    stored: "資料會保存在此瀏覽器。", synthetic: "純模擬示範：不會聯絡真實僱主或接受真實 Offer。",
    completed: "交易完成", human: "人類", agent: "代理",
  },
  ja: {
    job: "仕事", auto: "自動", on: "オン", off: "オフ", title: "Job Mode", profile: "仕事プロフィール", skills: "スキル",
    skillsHint: "AI、LLM、JavaScript、IT Support…", info: "情報", infoHint: "経験、強み、制約、希望する仕事…",
    availability: "稼働時間", flexible: "柔軟", evenings: "夜", weekends: "週末", fullTime: "フルタイム",
    minReward: "最低報酬", start: "今すぐ開始", stop: "停止", best: "最適な機会", match: "適合", difficulty: "難易度",
    current: "現在", balance: "残高", gross: "収入", cost: "費用", net: "純額", estCost: "予想費用", costDriver: "主な費用",
    stored: "このブラウザに保存されます。", synthetic: "合成デモのみ。実在の雇用主への連絡や実際のオファー承諾は行いません。",
    completed: "取引完了", human: "人", agent: "エージェント",
  },
};

function browserBridge() {
  return window as unknown as { maplibregl?: MapLibreLike; __ASYMPTA_MAP__?: unknown };
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
    return Number.isFinite(value) ? Math.round(value) : 0;
  } catch {
    return 0;
  }
}

function writeProfile(profile: JobProfile) {
  try { window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); } catch {}
}

function writeBalance(balance: number) {
  try { window.localStorage.setItem(BALANCE_KEY, String(Math.round(balance))); } catch {}
}

function money(value: number) {
  const rounded = Math.round(value);
  const sign = rounded < 0 ? "−" : "";
  return `${sign}¥${Math.abs(rounded).toLocaleString("en-US")}`;
}

function signedMoney(value: number) {
  const rounded = Math.round(value);
  return `${rounded >= 0 ? "+" : "−"}¥${Math.abs(rounded).toLocaleString("en-US")}`;
}

function interpolateLocation(fromId: string, toId: string, progress: number): [number, number] {
  const from = ATLAS_LOCATIONS[fromId] ?? ATLAS_LOCATIONS.shibuya;
  const to = ATLAS_LOCATIONS[toId] ?? ATLAS_LOCATIONS.shibuya;
  const t = Math.max(0, Math.min(1, progress));
  const smooth = t * t * (3 - 2 * t);
  return [from.point.lon + (to.point.lon - from.point.lon) * smooth, from.point.lat + (to.point.lat - from.point.lat) * smooth];
}

function stageMessage(stage: JobStage, opportunity: RankedJobOpportunity, reward: number) {
  if (stage.id === "scout") return `Market agent selected ${opportunity.title}.`;
  if (stage.id === "enquiry") return `Scope, deadline and acceptance criteria clarified with ${opportunity.client}.`;
  if (stage.id === "terms") return `Finance checked difficulty ${opportunity.difficulty}/5 against reward and execution cost.`;
  if (stage.id === "negotiate") return `Deal converged to ¥${reward.toLocaleString("en-US")}.`;
  if (stage.id === "offer") return "Personal agent took the highest-utility synthetic offer.";
  if (stage.id === "prepare") return "Agents prepared context, tools and only the necessary human work remains.";
  if (stage.id === "human") return "Human work finished; agents resumed verification and delivery.";
  if (stage.id === "review") return "Quality verification passed.";
  if (stage.id === "handoff") return "Final simulated client handoff completed.";
  if (stage.id === "settle") return "Deal settled after platform and transaction costs.";
  return `${stage.title} complete.`;
}

function createMarkerElement(stage: JobStage) {
  const element = document.createElement("div");
  element.className = "animal-map-marker animal-map-marker--foreground asympta-job-marker is-selected has-dialogue";
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
  status.textContent = "Job";
  element.appendChild(status);
  return element;
}

function newRuntime(profile: JobProfile, messageId: number): JobRuntime {
  const best = rankJobOpportunities(profile)[0];
  const built = buildJobStages(profile, best);
  return {
    active: true,
    completed: false,
    opportunity: built.opportunity,
    stages: built.stages,
    stageIndex: 0,
    stageStartedAt: performance.now(),
    stageProgress: 0,
    originLocationId: "shibuya",
    earned: 0,
    spent: 0,
    messages: [{ id: messageId, text: `Personal agent started from ${built.profile.skills.length || "general"} skill signals.` }],
  };
}

export function AsymptaJobMode() {
  const [targets, setTargets] = useState<PortalTargets>({ workflows: null, panel: null });
  const [locale, setLocale] = useState<Locale>("en");
  const [panelOpen, setPanelOpen] = useState(false);
  const [profile, setProfile] = useState<JobProfile>(DEFAULT_JOB_PROFILE);
  const [balance, setBalance] = useState(0);
  const [runtime, setRuntime] = useState<JobRuntime | null>(null);
  const [autoJobMode, setAutoJobMode] = useState(true);

  const runtimeRef = useRef<JobRuntime | null>(null);
  const profileRef = useRef<JobProfile>(DEFAULT_JOB_PROFILE);
  const autoRef = useRef(true);
  const profileReadyRef = useRef(false);
  const balanceRef = useRef(0);
  const markerRef = useRef<MarkerLike | null>(null);
  const markerStageRef = useRef("");
  const lastUiAtRef = useRef(0);
  const messageIdRef = useRef(0);
  const completedAtRef = useRef(0);

  const ranked = useMemo(() => rankJobOpportunities(profile), [profile]);
  const copy = COPY[locale];

  useEffect(() => {
    const hydrate = window.setTimeout(() => {
      const savedProfile = readProfile();
      const savedBalance = readBalance();
      const savedAuto = readAsymptaUserPreferences().autoJobMode;
      profileRef.current = savedProfile;
      balanceRef.current = savedBalance;
      autoRef.current = savedAuto;
      profileReadyRef.current = true;
      setProfile(savedProfile);
      setBalance(savedBalance);
      setAutoJobMode(savedAuto);
    }, 0);

    const unsubscribe = subscribeAsymptaUserPreferences((preferences) => {
      autoRef.current = preferences.autoJobMode;
      setAutoJobMode((value) => value === preferences.autoJobMode ? value : preferences.autoJobMode);
    });

    return () => {
      window.clearTimeout(hydrate);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const sync = () => {
      const workflows = document.querySelector<HTMLElement>(".atlas-workflows");
      const panel = document.querySelector<HTMLElement>(".atlas-menu-panel");
      setTargets((value) => value.workflows === workflows && value.panel === panel ? value : { workflows, panel });
      const nextLocale = currentLocale();
      setLocale((value) => value === nextLocale ? value : nextLocale);
    };
    const kickoff = window.setTimeout(sync, 0);
    const timer = window.setInterval(sync, 500);
    return () => {
      window.clearTimeout(kickoff);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    profileRef.current = profile;
    writeProfile(profile);
  }, [profile]);

  useEffect(() => {
    const map = document.querySelector<HTMLElement>(".map-app");
    if (!map) return;
    if (runtime?.active || runtime?.completed) map.dataset.asymptaJobMode = "on";
    else delete map.dataset.asymptaJobMode;
    return () => { delete map.dataset.asymptaJobMode; };
  }, [runtime?.active, runtime?.completed]);

  const removeMarker = () => {
    markerRef.current?.remove();
    markerRef.current = null;
    markerStageRef.current = "";
  };

  const launch = () => {
    const next = newRuntime(profileRef.current, ++messageIdRef.current);
    removeMarker();
    completedAtRef.current = 0;
    runtimeRef.current = next;
    setRuntime(next);
  };

  const setAuto = (enabled: boolean) => {
    autoRef.current = enabled;
    setAutoJobMode(enabled);
    writeAsymptaUserPreferences({ autoJobMode: enabled });
  };

  const stopJob = () => {
    setAuto(false);
    const current = runtimeRef.current;
    const next = current ? { ...current, active: false, completed: false } : null;
    runtimeRef.current = next;
    setRuntime(next);
    removeMarker();
  };

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!profileReadyRef.current || !autoRef.current || document.hidden) return;
      const current = runtimeRef.current;
      const readyForNext = !current || (!current.active && current.completed && completedAtRef.current > 0 && performance.now() - completedAtRef.current >= AUTO_NEXT_JOB_DELAY_MS);
      if (!readyForNext) return;
      const next = newRuntime(profileRef.current, ++messageIdRef.current);
      completedAtRef.current = 0;
      runtimeRef.current = next;
      setRuntime(next);
    }, AUTO_POLL_MS);
    return () => window.clearInterval(timer);
  }, []);

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
      const bridge = browserBridge();

      if (bridge.maplibregl && bridge.__ASYMPTA_MAP__) {
        if (markerRef.current && markerStageRef.current !== stage.id) removeMarker();
        if (!markerRef.current) {
          markerRef.current = new bridge.maplibregl.Marker({ element: createMarkerElement(stage), anchor: "center" })
            .setLngLat(coordinates)
            .addTo(bridge.__ASYMPTA_MAP__);
          markerStageRef.current = stage.id;
        }

        const marker = markerRef.current;
        marker?.setLngLat(coordinates);
        const element = marker?.getElement();
        if (element) {
          element.dataset.status = travelProgress < 1 ? "moving" : "working";
          element.classList.toggle("is-moving", travelProgress < 1);
          element.classList.toggle("is-working", travelProgress >= 1);
          const dialogue = element.querySelector<HTMLElement>(".animal-map-marker__dialogue");
          const status = element.querySelector<HTMLElement>(".animal-map-marker__status-text");
          if (dialogue) dialogue.textContent = stage.title;
          if (status) status.textContent = `${stage.humanRequired ? "human" : "agent"} · ${Math.round(progress * 100)}%`;
        }
      }

      let targetEarned = current.earned;
      if (stage.humanRequired) {
        targetEarned = Math.min(current.opportunity.negotiatedReward, Math.round(current.opportunity.negotiatedReward * progress));
      }
      const targetExpense = jobAccruedExpense(current.stages, current.opportunity, current.stageIndex, progress).total;
      const incomeDelta = Math.max(0, targetEarned - current.earned);
      const expenseDelta = Math.max(0, targetExpense - current.spent);
      if (incomeDelta > 0 || expenseDelta > 0) {
        const delta = incomeDelta - expenseDelta;
        balanceRef.current += delta;
        writeBalance(balanceRef.current);
      }

      let next: JobRuntime = {
        ...current,
        stageProgress: progress,
        earned: targetEarned,
        spent: targetExpense,
      };

      if (progress >= 1) {
        const messages = [...current.messages, {
          id: ++messageIdRef.current,
          text: stageMessage(stage, current.opportunity, current.opportunity.negotiatedReward),
        }].slice(-3);

        if (current.stageIndex >= current.stages.length - 1) {
          next = { ...next, active: false, completed: true, stageProgress: 1, messages };
          completedAtRef.current = now;
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
  const previewStages = runtime?.stages ?? buildJobStages(profile, opportunity).stages;
  const projectedEconomy = jobProjectedEconomy(previewStages, opportunity);
  const accruedEconomy = runtime
    ? jobAccruedExpense(runtime.stages, runtime.opportunity, runtime.stageIndex, runtime.stageProgress)
    : { total: 0, breakdown: projectedEconomy.breakdown };
  const stageCost = activeStage ? jobStageCostPlan(activeStage, opportunity) : null;
  const currentStageCost = stageCost ? Math.min(stageCost.total, Math.round(stageCost.total * (runtime?.stageProgress ?? 0))) : 0;
  const [dominantCategory, dominantCost] = dominantEconomyCost(accruedEconomy.breakdown);
  const latestMessage = runtime?.messages.at(-1)?.text ?? "";
  const gross = runtime?.earned ?? 0;
  const cost = runtime?.spent ?? 0;
  const net = gross - cost;

  const style = (
    <style>{`
      .asympta-job-mode__tile{position:relative}.asympta-job-mode__tile.is-active::after{content:"";position:absolute;right:7px;top:7px;width:4px;height:4px;border-radius:50%;background:#718271}.asympta-job-panel{display:grid;gap:7px;margin-top:5px;padding:7px 1px 1px;border-top:1px solid rgba(67,63,56,.05);color:#514d46}.asympta-job-panel__head{display:flex;align-items:center;justify-content:space-between;gap:8px}.asympta-job-panel__head strong{font-size:10px}.asympta-job-auto{min-height:27px;display:inline-flex;align-items:center;gap:6px;padding:0 8px;border:1px solid rgba(67,63,56,.07);border-radius:999px;background:transparent;color:#777168;font-size:7px;font-weight:750;cursor:pointer}.asympta-job-auto i{width:6px;height:6px;border-radius:50%;background:#aaa49b}.asympta-job-auto.is-on i{background:#718271}.asympta-job-profile{display:grid;grid-template-columns:1fr 1fr;gap:6px}.asympta-job-field{min-width:0;display:grid;gap:3px}.asympta-job-field--wide{grid-column:1/-1}.asympta-job-field span{color:#837c73;font-size:7px;font-weight:700}.asympta-job-field input,.asympta-job-field textarea,.asympta-job-field select{width:100%;min-width:0;border:1px solid rgba(67,63,56,.08);border-radius:8px;background:rgba(255,255,255,.12);color:#514d46;font:8px/1.35 system-ui,sans-serif;outline:none}.asympta-job-field input,.asympta-job-field select{height:31px;padding:0 8px}.asympta-job-field textarea{min-height:44px;padding:7px 8px;resize:vertical}.asympta-job-field input:focus,.asympta-job-field textarea:focus,.asympta-job-field select:focus{border-color:rgba(75,127,166,.28)}.asympta-job-opportunity{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;padding:6px 0}.asympta-job-opportunity strong,.asympta-job-opportunity small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.asympta-job-opportunity strong{font-size:9px}.asympta-job-opportunity small{margin-top:2px;color:#8a8379;font-size:6.4px}.asympta-job-opportunity b{font-size:9px;color:#627063}.asympta-job-live{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:end;padding-top:6px;border-top:1px solid rgba(67,63,56,.05)}.asympta-job-live small,.asympta-job-live strong{display:block}.asympta-job-live small{color:#8a8379;font-size:6.3px}.asympta-job-live strong{margin-top:2px;font-size:9px}.asympta-job-progress{height:2px;margin-top:5px;border-radius:999px;background:rgba(67,63,56,.055);overflow:hidden}.asympta-job-progress i{display:block;height:100%;background:#718271}.asympta-job-finance{display:grid;grid-template-columns:auto auto;gap:2px 8px;text-align:right;font-variant-numeric:tabular-nums}.asympta-job-finance span{color:#8a8379;font-size:5.8px}.asympta-job-finance b{font-size:7px;font-weight:680}.asympta-job-finance .is-cost{color:#8a6d68}.asympta-job-finance .is-net{color:#5f7464}.asympta-job-latest{margin:0;color:#777168;font-size:6.7px;line-height:1.35}.asympta-job-cost-driver{color:#938b82;font-size:6px}.asympta-job-actions{display:flex;gap:6px}.asympta-job-actions button{min-height:30px;display:inline-flex;align-items:center;justify-content:center;gap:5px;padding:0 9px;border:1px solid rgba(67,63,56,.07);border-radius:8px;background:transparent;color:#69635c;font-size:7.5px;font-weight:750;cursor:pointer}.asympta-job-actions button:first-child{border-color:rgba(75,127,166,.13);color:#4f718c}.asympta-job-disclosure{color:#9a9288;font-size:5.8px;line-height:1.3}.map-app[data-asympta-job-mode="on"] .animal-map-marker--foreground:not(.asympta-job-marker){opacity:.45}.asympta-job-marker{z-index:9}@media(max-width:700px){.asympta-job-profile{grid-template-columns:1fr}.asympta-job-field--wide{grid-column:auto}.asympta-job-live{grid-template-columns:1fr auto}}@media(prefers-reduced-motion:reduce){.asympta-job-marker *{transition:none!important}}
    `}</style>
  );

  const tile = targets.workflows ? createPortal(
    <button type="button" className={`atlas-workflow asympta-job-mode__tile${runtime?.active || runtime?.completed ? " is-active" : ""}`} onClick={() => setPanelOpen((value) => !value)}>
      <span className="atlas-workflow__icon"><BriefcaseBusiness size={16} strokeWidth={1.6} /></span>
      <strong>{copy.job}</strong><span>{copy.auto} {autoJobMode ? copy.on : copy.off}</span>
    </button>,
    targets.workflows,
  ) : null;

  const panel = targets.panel && panelOpen ? createPortal(
    <section className="asympta-job-panel" aria-label={copy.title}>
      <div className="asympta-job-panel__head">
        <strong>{copy.title}</strong>
        <button type="button" className={`asympta-job-auto${autoJobMode ? " is-on" : ""}`} aria-pressed={autoJobMode} onClick={() => setAuto(!autoJobMode)}><i />{copy.auto} · {autoJobMode ? copy.on : copy.off}</button>
      </div>

      {!runtime?.active && !runtime?.completed ? (
        <div className="asympta-job-profile">
          <label className="asympta-job-field asympta-job-field--wide"><span>{copy.skills}</span><input value={profile.skills.join(", ")} placeholder={copy.skillsHint} onChange={(event) => setProfile((value) => normalizeJobProfile({ ...value, skills: event.target.value.split(",") }))} /></label>
          <label className="asympta-job-field asympta-job-field--wide"><span>{copy.info}</span><textarea value={profile.summary} placeholder={copy.infoHint} onChange={(event) => setProfile((value) => normalizeJobProfile({ ...value, summary: event.target.value }))} /></label>
          <label className="asympta-job-field"><span>{copy.availability}</span><select value={profile.availability} onChange={(event) => setProfile((value) => normalizeJobProfile({ ...value, availability: event.target.value as JobProfile["availability"] }))}><option value="flexible">{copy.flexible}</option><option value="evenings">{copy.evenings}</option><option value="weekends">{copy.weekends}</option><option value="full-time">{copy.fullTime}</option></select></label>
          <label className="asympta-job-field"><span>{copy.minReward} · JPY</span><input type="number" min="0" max="100000" step="100" value={profile.minReward} onChange={(event) => setProfile((value) => normalizeJobProfile({ ...value, minReward: Number(event.target.value) }))} /></label>
        </div>
      ) : null}

      <div className="asympta-job-opportunity"><div><small>{copy.best}</small><strong>{opportunity.title}</strong><small>{opportunity.client} · {Math.round(opportunity.match * 100)}% {copy.match} · {copy.difficulty} {opportunity.difficulty}/5 · {copy.estCost} {money(projectedEconomy.total)}</small></div><b>¥{opportunity.negotiatedReward.toLocaleString("en-US")}</b></div>

      {runtime ? (
        <>
          <div className="asympta-job-live">
            <section>
              {activeStage ? <><small>{copy.current} · {activeStage.humanRequired ? copy.human : copy.agent}</small><strong>{activeStage.title}</strong><small>{copy.cost} {money(currentStageCost)} / {money(stageCost?.total ?? 0)}</small><div className="asympta-job-progress"><i style={{ width: `${Math.round(runtime.stageProgress * 100)}%` }} /></div></> : <><small>{copy.current}</small><strong>{copy.completed}</strong></>}
            </section>
            <section className="asympta-job-finance" aria-label={`${copy.gross}, ${copy.cost}, ${copy.net}, ${copy.balance}`}>
              <span>{copy.balance}</span><b>{money(balance)}</b>
              <span>{copy.gross}</span><b>{signedMoney(gross)}</b>
              <span>{copy.cost}</span><b className="is-cost">−¥{cost.toLocaleString("en-US")}</b>
              <span>{copy.net}</span><b className="is-net">{signedMoney(net)}</b>
            </section>
          </div>
          {dominantCost > 0 ? <div className="asympta-job-cost-driver">{copy.costDriver}: {CATEGORY_COPY[locale][dominantCategory] ?? dominantCategory} · {money(dominantCost)}</div> : null}
          {latestMessage ? <p className="asympta-job-latest">{latestMessage}</p> : null}
        </>
      ) : null}

      <div className="asympta-job-actions">
        {!runtime?.active ? <button type="button" onClick={launch}><BriefcaseBusiness size={12} />{copy.start}</button> : null}
        {runtime?.active ? <button type="button" onClick={stopJob}><Square size={11} />{copy.stop}</button> : null}
      </div>
      <div className="asympta-job-disclosure">{copy.stored} {copy.synthetic}</div>
    </section>,
    targets.panel,
  ) : null;

  return <>{style}{tile}{panel}</>;
}
