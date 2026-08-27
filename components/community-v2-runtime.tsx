"use client";

import { HeartHandshake, MapPin, Package, Sparkles, Users, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  COMMUNITY_ACTIONS,
  COMMUNITY_KINDS,
  chooseCommunityAction,
  chooseCommunityPlace,
  communityNeedLabel,
  communityPhaseDuration,
  executeCommunityAction,
  listCommunityActions,
  nextCommunityNeed,
  restoreCommunityCapacity,
  searchCommunityPlaces,
  seedCommunityState,
  type CommunityActionId,
  type CommunityAgent,
  type CommunityPhase,
  type CommunityPlace,
  type CommunityPlaceKind,
  type CommunityState,
  type CommunityTransaction,
} from "@/lib/community-layer";

type CommunityTool = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: Record<string, unknown>) => Promise<string>;
};

type Inspector = { placeId: string; x: number; y: number };
type Feedback = { label: string; until: number };
type Perception = "near" | "mid" | "far" | "hidden";

const COMMUNITY_KEY = "asympta-community-v2";
const COMMUNITY_AGENT_COUNT = 60;
const BEHAVIOR_BATCH = 4;
const BEHAVIOR_TICK_MS = 1200;
const WORLD_WIDTH = 1200;
const WORLD_HEIGHT = 760;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function delay(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function saveCommunity(state: CommunityState) {
  try {
    localStorage.setItem(COMMUNITY_KEY, JSON.stringify(state));
  } catch {
    // Memory-only fallback is enough for a static Pages demo.
  }
}

function loadCommunity() {
  try {
    const raw = localStorage.getItem(COMMUNITY_KEY);
    if (!raw) return seedCommunityState(Date.now(), COMMUNITY_AGENT_COUNT);
    const parsed = JSON.parse(raw) as CommunityState;
    if (
      parsed.version !== 2 ||
      parsed.places?.length !== 10 ||
      parsed.agents?.length !== COMMUNITY_AGENT_COUNT
    ) {
      return seedCommunityState(Date.now(), COMMUNITY_AGENT_COUNT);
    }
    return {
      ...parsed,
      userUnlimitedCredits: true,
      userInventory: parsed.userInventory ?? {},
      userBookings: parsed.userBookings ?? {},
      notices: Array.isArray(parsed.notices) ? parsed.notices : [],
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
    };
  } catch {
    return seedCommunityState(Date.now(), COMMUNITY_AGENT_COUNT);
  }
}

function snapshot(state: CommunityState): CommunityState {
  return {
    ...state,
    userInventory: { ...state.userInventory },
    userBookings: { ...state.userBookings },
    places: state.places.map((place) => ({
      ...place,
      offerings: place.offerings.map((offering) => ({ ...offering })),
    })),
    agents: state.agents.map((agent) => ({
      ...agent,
      inventory: { ...agent.inventory },
      preferences: [...agent.preferences],
      memory: agent.memory.map((entry) => ({ ...entry })),
    })),
    notices: state.notices.map((notice) => ({ ...notice })),
    transactions: state.transactions.map((transaction) => ({ ...transaction })),
  };
}

function phaseLabel(phase: CommunityPhase) {
  if (phase === "observe") return "觀察附近選項";
  if (phase === "evaluate") return "評估距離與選擇";
  if (phase === "travel") return "前往地點";
  if (phase === "inquire") return "詢問細節";
  if (phase === "decide") return "考慮是否執行";
  if (phase === "act") return "執行行動";
  if (phase === "reflect") return "回顧結果";
  return "日常生活";
}

function actionLabel(action: CommunityActionId) {
  const labels: Record<CommunityActionId, string> = {
    inspect_programs: "查看活動",
    reserve_item: "預留資源",
    borrow_item: "借用物品",
    return_item: "歸還物品",
    attend_event: "參加活動",
    volunteer: "參與義工",
    donate_resource: "捐出資源",
    request_help: "尋求協助",
    post_notice: "張貼公告",
    book_service: "預約服務",
    purchase_item: "購買物品",
  };
  return labels[action];
}

function lineValue(seed: number, salt: number) {
  const value = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function placeLinePaths(seed: number) {
  const a = 8 + lineValue(seed, 1) * 6;
  const b = 42 - lineValue(seed, 2) * 6;
  const mid = 21 + lineValue(seed, 3) * 8;
  return [
    `M ${a} 30 Q ${mid} 6 ${b} 30`,
    `M ${a + 3} 30 L ${b - 3} 30`,
    `M ${mid - 8} 30 L ${mid - 8} 18 L ${mid + 8} 18 L ${mid + 8} 30`,
  ];
}

function phaseTone(phase: CommunityPhase) {
  if (phase === "travel") return "moving";
  if (phase === "inquire" || phase === "decide") return "talking";
  if (phase === "act") return "working";
  if (phase === "reflect") return "done";
  return "planning";
}

function emitUserProcess(label: string, detail: string, progress: number, tone = "planning") {
  window.dispatchEvent(
    new CustomEvent("asympta:user-task-process", {
      detail: { label, detail, progress, tone },
    }),
  );
}

function exposeUserMotion(place: CommunityPlace, action: CommunityActionId) {
  window.dispatchEvent(
    new CustomEvent("asympta:agent-motion-target", {
      detail: { agentName: "Your Agent", x: place.x, y: place.y, durationMs: 7200 },
    }),
  );
  window.dispatchEvent(
    new CustomEvent("asympta:agent-behavior", {
      detail: {
        actorName: "Your Agent",
        kind: action === "purchase_item" || action === "book_service" ? "deal" : "workflow",
        message: actionLabel(action),
        symbols: action === "volunteer" ? ["work", "status"] : action === "request_help" ? ["question", "talk"] : ["target", "work"],
        durationMs: 7200,
      },
    }),
  );
}

function chooseOfferingId(place: CommunityPlace, action: CommunityActionId) {
  const available = place.offerings.filter((item) => item.available > 0);
  const match = available.find((item) => {
    if (action === "purchase_item") return item.type === "product";
    if (action === "borrow_item" || action === "return_item") return item.type === "loan";
    if (action === "attend_event") return item.type === "event";
    if (action === "book_service") return item.type === "service";
    if (action === "reserve_item") return item.type === "space" || item.type === "event" || item.type === "loan";
    return true;
  });
  return (match ?? available[0])?.id;
}

function thresholds(detail: string) {
  if (detail === "full") return { near: 310, mid: 650, far: 1040 };
  if (detail === "balanced") return { near: 220, mid: 460, far: 760 };
  return { near: 140, mid: 300, far: 560 };
}

function perceptionFor(rect: DOMRect, view: DOMRect, focusX: number, focusY: number, detail: string, index: number): Perception {
  const margin = detail === "full" ? 130 : detail === "balanced" ? 90 : 55;
  if (
    rect.right < view.left - margin || rect.left > view.right + margin ||
    rect.bottom < view.top - margin || rect.top > view.bottom + margin
  ) return "hidden";
  const distance = Math.hypot(rect.left + rect.width / 2 - focusX, rect.top + rect.height / 2 - focusY);
  const limit = thresholds(detail);
  let result: Perception = distance <= limit.near ? "near" : distance <= limit.mid ? "mid" : distance <= limit.far ? "far" : "hidden";
  if (result === "mid" && detail === "overview" && index % 2 !== 0) result = "hidden";
  if (result === "far") {
    const divisor = detail === "full" ? 2 : detail === "balanced" ? 3 : 5;
    if (index % divisor !== 0) result = "hidden";
  }
  return result;
}

export function CommunityV2Runtime() {
  const stateRef = useRef<CommunityState>(seedCommunityState(0, COMMUNITY_AGENT_COUNT));
  const agentNodesRef = useRef<Map<string, HTMLSpanElement>>(new Map());
  const cursorRef = useRef(0);
  const [state, setState] = useState<CommunityState | null>(null);
  const [worldPlane, setWorldPlane] = useState<HTMLElement | null>(null);
  const [viewport, setViewport] = useState<HTMLElement | null>(null);
  const [menuHost, setMenuHost] = useState<HTMLElement | null>(null);
  const [inspector, setInspector] = useState<Inspector | null>(null);
  const [feedback, setFeedback] = useState<Record<string, Feedback>>({});
  const [userFeedback, setUserFeedback] = useState<Feedback | null>(null);

  const commit = useCallback((next: CommunityState) => {
    stateRef.current = next;
    saveCommunity(next);
    setState(snapshot(next));
  }, []);

  useEffect(() => {
    const initialize = window.setTimeout(() => {
      const loaded = loadCommunity();
      stateRef.current = loaded;
      setState(snapshot(loaded));
      setWorldPlane(document.querySelector<HTMLElement>(".world-plane"));
      setViewport(document.querySelector<HTMLElement>(".world-viewport"));
      setMenuHost(document.querySelector<HTMLElement>(".agent-task-panel"));
    }, 0);
    const scan = window.setInterval(() => {
      const nextMenu = document.querySelector<HTMLElement>(".agent-task-panel");
      setMenuHost((current) => current === nextMenu ? current : nextMenu);
    }, 800);
    return () => {
      window.clearTimeout(initialize);
      window.clearInterval(scan);
    };
  }, []);

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const animate = (time: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (time - last) / 1000));
      last = time;
      for (const agent of stateRef.current.agents) {
        const node = agentNodesRef.current.get(agent.id);
        if (!node) continue;
        if (agent.phase === "travel") {
          const dx = agent.targetX - agent.x;
          const dy = agent.targetY - agent.y;
          const distance = Math.hypot(dx, dy);
          if (distance > 1.2) {
            const step = Math.min(distance, agent.speed * dt);
            agent.x = clamp(agent.x + dx / distance * step, 40, WORLD_WIDTH - 40);
            agent.y = clamp(agent.y + dy / distance * step, 40, WORLD_HEIGHT - 40);
          }
        }
        node.style.transform = `translate3d(${agent.x.toFixed(2)}px,${agent.y.toFixed(2)}px,0)`;
      }
      frame = window.requestAnimationFrame(animate);
    };
    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const executeResident = useCallback((agentId: string, now: number) => {
    const current = stateRef.current;
    const agent = current.agents.find((candidate) => candidate.id === agentId);
    if (!agent || !agent.targetPlaceId || !agent.plannedAction) return;
    const result = executeCommunityAction(current, {
      placeId: agent.targetPlaceId,
      action: agent.plannedAction,
      agentId: agent.id,
      offeringId: agent.plannedOfferingId,
      quantity: agent.plannedAction === "donate_resource" ? 1 : undefined,
      note: agent.plannedAction === "request_help" ? agent.role + " is asking the community for help." : undefined,
    }, now);
    stateRef.current = result.state;
    const updated = stateRef.current.agents.find((candidate) => candidate.id === agentId);
    if (!updated) return;
    updated.phase = "reflect";
    updated.phaseUntil = now + communityPhaseDuration(updated, "reflect");
    updated.lastResult = result.summary;
    updated.thought = result.ok ? result.actorDelta ?? "完成行動" : "重新評估";
    if (result.ok) {
      updated.need = nextCommunityNeed(updated, stateRef.current.transactions.length + updated.id.length);
      const transaction = stateRef.current.transactions[0];
      if (transaction?.agentId === updated.id) {
        setFeedback((currentFeedback) => ({
          ...currentFeedback,
          [transaction.placeId]: { label: transaction.placeDelta, until: now + 5200 },
        }));
      }
    }
    commit(stateRef.current);
  }, [commit]);

  const advanceAgent = useCallback((agent: CommunityAgent, now: number) => {
    if (now < agent.phaseUntil) {
      if (agent.phase === "travel" && agent.targetPlaceId) {
        const target = stateRef.current.places.find((candidate) => candidate.id === agent.targetPlaceId);
        if (target && Math.hypot(agent.x - target.x, agent.y - target.y) <= 22) {
          agent.phase = "inquire";
          agent.phaseUntil = now + communityPhaseDuration(agent, "inquire");
          agent.thought = "詢問 · " + target.name;
        }
      }
      return;
    }

    if (agent.phase === "rest") {
      agent.phase = "observe";
      agent.phaseUntil = now + communityPhaseDuration(agent, "observe");
      agent.thought = communityNeedLabel(agent.need);
      return;
    }

    if (agent.phase === "observe") {
      const target = chooseCommunityPlace(stateRef.current.places, agent, agent.need);
      if (!target) {
        agent.phase = "rest";
        agent.phaseUntil = now + communityPhaseDuration(agent, "rest");
        agent.thought = "沒有合適選項";
        return;
      }
      agent.targetPlaceId = target.id;
      agent.plannedAction = chooseCommunityAction(agent, target);
      agent.plannedOfferingId = chooseOfferingId(target, agent.plannedAction);
      agent.phase = "evaluate";
      agent.phaseUntil = now + communityPhaseDuration(agent, "evaluate");
      agent.thought = "評估 · " + target.name;
      return;
    }

    if (agent.phase === "evaluate") {
      const target = stateRef.current.places.find((candidate) => candidate.id === agent.targetPlaceId);
      if (!target) {
        agent.phase = "rest";
        agent.phaseUntil = now + communityPhaseDuration(agent, "rest");
        return;
      }
      agent.targetX = target.x + ((agent.id.charCodeAt(agent.id.length - 1) % 5) - 2) * 10;
      agent.targetY = target.y + ((agent.id.length % 5) - 2) * 8;
      agent.phase = "travel";
      agent.phaseUntil = now + 60000;
      agent.thought = "前往 · " + target.name;
      return;
    }

    if (agent.phase === "travel") {
      agent.phase = "inquire";
      agent.phaseUntil = now + communityPhaseDuration(agent, "inquire");
      agent.thought = "詢問細節";
      return;
    }

    if (agent.phase === "inquire") {
      agent.phase = "decide";
      agent.phaseUntil = now + communityPhaseDuration(agent, "decide");
      agent.thought = agent.plannedAction ? "考慮 · " + actionLabel(agent.plannedAction) : "考慮選項";
      return;
    }

    if (agent.phase === "decide") {
      agent.phase = "act";
      agent.phaseUntil = now + communityPhaseDuration(agent, "act");
      agent.thought = agent.plannedAction ? actionLabel(agent.plannedAction) : "執行行動";
      return;
    }

    if (agent.phase === "act") {
      executeResident(agent.id, now);
      return;
    }

    if (agent.phase === "reflect") {
      agent.phase = "rest";
      agent.phaseUntil = now + communityPhaseDuration(agent, "rest");
      agent.targetPlaceId = undefined;
      agent.plannedAction = undefined;
      agent.plannedOfferingId = undefined;
      agent.thought = "完成 · 慢慢再想下一件事";
    }
  }, [executeResident]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      const current = stateRef.current;
      const start = cursorRef.current;
      for (let offset = 0; offset < BEHAVIOR_BATCH; offset += 1) {
        const agent = current.agents[(start + offset) % current.agents.length];
        advanceAgent(agent, now);
      }
      cursorRef.current = (start + BEHAVIOR_BATCH) % current.agents.length;
      current.worldTime = now;
      setState(snapshot(current));
    }, BEHAVIOR_TICK_MS);
    return () => window.clearInterval(timer);
  }, [advanceAgent]);

  useEffect(() => {
    const supply = window.setInterval(() => commit(restoreCommunityCapacity(stateRef.current, Date.now())), 48000);
    const cleanup = window.setInterval(() => {
      const now = Date.now();
      setFeedback((current) => Object.fromEntries(Object.entries(current).filter(([, item]) => item.until >= now)));
      setUserFeedback((current) => current && current.until >= now ? current : null);
    }, 1000);
    return () => {
      window.clearInterval(supply);
      window.clearInterval(cleanup);
    };
  }, [commit]);

  useEffect(() => {
    const syncPerception = () => {
      const currentViewport = document.querySelector<HTMLElement>(".world-viewport");
      const plane = document.querySelector<HTMLElement>(".world-plane");
      if (!currentViewport || !plane) return;
      const view = currentViewport.getBoundingClientRect();
      const user = document.querySelector<HTMLElement>(".mission-user-agent")?.getBoundingClientRect();
      const focusX = user ? user.left + user.width / 2 : view.left + view.width / 2;
      const focusY = user ? user.top + user.height / 2 : view.top + view.height / 2;
      const detail = plane.dataset.cityDetail ?? "balanced";
      document.querySelectorAll<HTMLElement>(".community-agent").forEach((node, index) => {
        node.dataset.perception = perceptionFor(node.getBoundingClientRect(), view, focusX, focusY, detail, index);
      });
      document.querySelectorAll<HTMLElement>(".community-place").forEach((node, index) => {
        const result = perceptionFor(node.getBoundingClientRect(), view, focusX, focusY, detail, index);
        node.dataset.perception = result === "hidden" ? "far" : result;
      });
    };
    const timer = window.setInterval(syncPerception, 260);
    return () => window.clearInterval(timer);
  }, []);

  const executeUserAction = useCallback(async (
    place: CommunityPlace,
    action: CommunityActionId,
    offeringId?: string,
    note?: string,
  ) => {
    emitUserProcess("觀察社區", place.name + " · 先看目前資源與活動", 8, "planning");
    await delay(1600);
    emitUserProcess("評估選項", actionLabel(action) + " · 考慮距離、容量與結果", 22, "planning");
    await delay(2200);
    exposeUserMotion(place, action);
    emitUserProcess("前往地點", "Your Agent 正在前往 " + place.name, 40, "moving");
    await delay(3600);
    emitUserProcess("詢問細節", place.name + " · 確認 availability / program / rules", 58, "talking");
    await delay(1800);
    emitUserProcess("作出決定", actionLabel(action), 72, "talking");
    await delay(1800);
    const result = executeCommunityAction(stateRef.current, {
      placeId: place.id,
      action,
      agentId: "your-agent",
      offeringId,
      note,
    }, Date.now());
    commit(result.state);
    const transaction = result.state.transactions[0];
    if (result.ok && transaction?.agentId === "your-agent") {
      setFeedback((current) => ({
        ...current,
        [transaction.placeId]: { label: transaction.placeDelta, until: Date.now() + 5200 },
      }));
      setUserFeedback({ label: transaction.actorDelta, until: Date.now() + 5200 });
    }
    emitUserProcess(
      result.ok ? "完成並反思" : "重新評估",
      result.summary,
      result.ok ? 100 : 78,
      result.ok ? "done" : "blocked",
    );
    return result;
  }, [commit]);

  useEffect(() => {
    const controller = new AbortController();
    const tools: CommunityTool[] = [
      {
        name: "community_search_places",
        title: "Search the living community",
        description: "Search public, cultural, care, mobility and everyday community places by need, offering or action.",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", maxLength: 120 },
            kind: { type: "string", enum: COMMUNITY_KINDS },
          },
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: async (input) => JSON.stringify({
          ok: true,
          places: searchCommunityPlaces(
            stateRef.current,
            typeof input.query === "string" ? input.query : "",
            COMMUNITY_KINDS.includes(input.kind as CommunityPlaceKind) ? input.kind as CommunityPlaceKind : undefined,
          ),
        }),
      },
      {
        name: "community_inspect_place",
        title: "Inspect a community place",
        description: "Read offerings, capacity, reputation, resources and available community actions.",
        inputSchema: { type: "object", properties: { placeId: { type: "string" } }, required: ["placeId"], additionalProperties: false },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute: async (input) => {
          const place = stateRef.current.places.find((candidate) => candidate.id === String(input.placeId));
          return JSON.stringify(place ? {
            ok: true,
            place,
            actions: listCommunityActions(place),
            notices: stateRef.current.notices.filter((notice) => notice.placeId === place.id).slice(0, 6),
          } : { ok: false, error: "Place not found." });
        },
      },
      {
        name: "community_observe_agents",
        title: "Observe community residents",
        description: "Observe slow resident decision phases, needs, roles and destinations without mutating the community.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute: async () => JSON.stringify({
          ok: true,
          pacing: "observe → evaluate → travel → inquire → decide → act → reflect",
          agents: stateRef.current.agents.map((agent) => ({
            id: agent.id, name: agent.name, role: agent.role, need: agent.need,
            phase: agent.phase, thought: agent.thought, targetPlaceId: agent.targetPlaceId,
          })),
        }),
      },
      {
        name: "community_inspect_agent",
        title: "Inspect one community resident",
        description: "Inspect one resident's traits, inventory, memory, current reasoning phase and planned action.",
        inputSchema: { type: "object", properties: { agentId: { type: "string" } }, required: ["agentId"], additionalProperties: false },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute: async (input) => {
          const agent = stateRef.current.agents.find((candidate) => candidate.id === String(input.agentId));
          return JSON.stringify(agent ? { ok: true, agent } : { ok: false, error: "Agent not found." });
        },
      },
      {
        name: "community_list_actions",
        title: "List actions at a community place",
        description: "List reserve, borrow, return, attend, volunteer, donate, help, notice, service and purchase actions available at a place.",
        inputSchema: { type: "object", properties: { placeId: { type: "string" } }, required: ["placeId"], additionalProperties: false },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute: async (input) => {
          const place = stateRef.current.places.find((candidate) => candidate.id === String(input.placeId));
          return JSON.stringify(place ? { ok: true, actions: listCommunityActions(place) } : { ok: false, error: "Place not found." });
        },
      },
      {
        name: "community_execute_action",
        title: "Execute a paced community action",
        description: "Execute a real community action with deliberate observe/evaluate/travel/inquire/decide/act/reflect pacing. agentId='your-agent' uses the current user agent.",
        inputSchema: {
          type: "object",
          properties: {
            placeId: { type: "string" },
            action: { type: "string", enum: COMMUNITY_ACTIONS },
            agentId: { type: "string" },
            offeringId: { type: "string" },
            quantity: { type: "number", minimum: 1, maximum: 4 },
            note: { type: "string", maxLength: 180 },
          },
          required: ["placeId", "action"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: true },
        execute: async (input) => {
          const place = stateRef.current.places.find((candidate) => candidate.id === String(input.placeId));
          if (!place) return JSON.stringify({ ok: false, error: "Place not found." });
          const action = COMMUNITY_ACTIONS.includes(input.action as CommunityActionId)
            ? input.action as CommunityActionId
            : "inspect_programs";
          const isUser = !input.agentId || input.agentId === "your-agent";
          const result = isUser
            ? await executeUserAction(
                place,
                action,
                typeof input.offeringId === "string" ? input.offeringId : undefined,
                typeof input.note === "string" ? input.note : undefined,
              )
            : executeCommunityAction(stateRef.current, {
                placeId: place.id,
                action,
                agentId: String(input.agentId),
                offeringId: typeof input.offeringId === "string" ? input.offeringId : undefined,
                quantity: typeof input.quantity === "number" ? input.quantity : undefined,
                note: typeof input.note === "string" ? input.note : undefined,
              }, Date.now());
          if (!isUser) commit(result.state);
          return JSON.stringify({
            ok: result.ok,
            summary: result.summary,
            actorDelta: result.actorDelta,
            placeDelta: result.placeDelta,
            userAssets: {
              unlimitedCredits: result.state.userUnlimitedCredits,
              resources: result.state.userResources,
              communityScore: result.state.userCommunityScore,
              inventory: result.state.userInventory,
              bookings: result.state.userBookings,
            },
          });
        },
      },
      {
        name: "community_post_notice",
        title: "Post a community notice",
        description: "Post a visible local notice through the same community state used by residents.",
        inputSchema: {
          type: "object",
          properties: { placeId: { type: "string" }, text: { type: "string", minLength: 2, maxLength: 180 } },
          required: ["placeId", "text"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: true },
        execute: async (input) => {
          const place = stateRef.current.places.find((candidate) => candidate.id === String(input.placeId));
          if (!place) return JSON.stringify({ ok: false, error: "Place not found." });
          const result = await executeUserAction(place, "post_notice", undefined, String(input.text));
          return JSON.stringify({ ok: result.ok, summary: result.summary });
        },
      },
      {
        name: "community_request_help",
        title: "Ask the local community for help",
        description: "Create a help request at a community place and let the resident simulation observe it.",
        inputSchema: {
          type: "object",
          properties: { placeId: { type: "string" }, request: { type: "string", minLength: 2, maxLength: 180 } },
          required: ["placeId", "request"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: true },
        execute: async (input) => {
          const place = stateRef.current.places.find((candidate) => candidate.id === String(input.placeId));
          if (!place) return JSON.stringify({ ok: false, error: "Place not found." });
          const result = await executeUserAction(place, "request_help", undefined, String(input.request));
          return JSON.stringify({ ok: result.ok, summary: result.summary });
        },
      },
    ];

    const fallback = window as unknown as {
      __ASYMPTA_COMMUNITY_WEBMCP__?: {
        tools: CommunityTool[];
        invoke: (name: string, input?: Record<string, unknown>) => Promise<unknown>;
      };
    };
    fallback.__ASYMPTA_COMMUNITY_WEBMCP__ = {
      tools,
      invoke: async (name, input = {}) => {
        const tool = tools.find((candidate) => candidate.name === name);
        if (!tool) throw new Error("Unknown community WebMCP tool: " + name);
        return JSON.parse(await tool.execute(input)) as unknown;
      },
    };

    const modelContext = (document as unknown as {
      modelContext?: { registerTool: (tool: CommunityTool, options?: { signal?: AbortSignal }) => Promise<void> | void };
    }).modelContext;
    if (modelContext?.registerTool) {
      tools.forEach((tool) => {
        void Promise.resolve(modelContext.registerTool(tool, { signal: controller.signal })).catch(() => undefined);
      });
    }
    return () => {
      controller.abort();
      delete fallback.__ASYMPTA_COMMUNITY_WEBMCP__;
    };
  }, [commit, executeUserAction]);

  const selected = useMemo(
    () => inspector && state ? state.places.find((place) => place.id === inspector.placeId) : undefined,
    [inspector, state],
  );
  const visibleCommunityInventory = useMemo(() => {
    if (!state) return [];
    const names = new Map(state.places.flatMap((place) => place.offerings.map((offering) => [offering.id, offering.name] as const)));
    return [
      ...Object.entries(state.userInventory).map(([id, quantity]) => ({ id: "item:" + id, label: names.get(id) ?? id, quantity })),
      ...Object.entries(state.userBookings).map(([id, quantity]) => ({ id: "booking:" + id, label: names.get(id) ?? id, quantity })),
    ].filter((item) => item.quantity > 0).slice(0, 6);
  }, [state]);

  if (!state || !worldPlane || !viewport) return null;

  const openPlace = (place: CommunityPlace, clientX: number, clientY: number) => {
    const rect = viewport.getBoundingClientRect();
    setInspector({
      placeId: place.id,
      x: clamp(clientX - rect.left + 12, 12, Math.max(12, rect.width - 304)),
      y: clamp(clientY - rect.top + 12, 12, Math.max(12, rect.height - 410)),
    });
  };

  return (
    <>
      <style>{`
        .community-layer { position:absolute; inset:0; z-index:6; pointer-events:none; }
        .community-place { position:absolute; z-index:8; width:90px; height:64px; transform:translate(-50%,-50%); border:0; background:transparent; color:#788179; opacity:.44; pointer-events:auto; cursor:pointer; }
        .community-place:hover,.community-place:focus-visible { opacity:.88; outline:none; }
        .community-place svg { position:absolute; left:22px; top:3px; width:46px; height:34px; overflow:visible; }
        .community-place svg path { fill:none; stroke:currentColor; stroke-width:.8; stroke-linecap:round; opacity:.64; }
        .community-place-name { position:absolute; left:0; right:0; bottom:4px; overflow:hidden; color:#6f7971; font-family:var(--pixel-font); font-size:.34rem; text-align:center; text-overflow:ellipsis; white-space:nowrap; }
        .community-place-delta { position:absolute; left:50%; bottom:52px; width:max-content; max-width:118px; padding:4px 6px; transform:translateX(-50%); border:1px solid rgba(112,126,116,.16); border-radius:8px; background:rgba(248,247,241,.94); color:#56645c; font-family:var(--pixel-font); font-size:.3rem; pointer-events:none; }
        .community-agent { position:absolute; left:0; top:0; z-index:10; width:10px; height:10px; pointer-events:none; will-change:transform; }
        .community-agent-body { position:absolute; inset:1px; border:1px solid rgba(83,96,87,.46); border-radius:50%; background:rgba(116,133,120,.45); }
        .community-agent[data-phase="observe"] .community-agent-body,.community-agent[data-phase="evaluate"] .community-agent-body { background:rgba(115,129,156,.48); }
        .community-agent[data-phase="inquire"] .community-agent-body,.community-agent[data-phase="decide"] .community-agent-body { background:rgba(139,119,153,.46); }
        .community-agent[data-phase="act"] .community-agent-body { background:rgba(164,132,96,.48); }
        .community-agent[data-phase="reflect"] .community-agent-body { background:rgba(103,143,117,.46); }
        .community-agent-thought { position:absolute; left:8px; bottom:10px; width:max-content; max-width:106px; padding:3px 5px; border:1px solid rgba(119,129,121,.16); border-radius:8px; background:rgba(248,247,241,.91); color:#68716b; font-family:var(--pixel-font); font-size:.29rem; font-weight:700; white-space:nowrap; backdrop-filter:blur(8px); }
        .community-user-delta { position:absolute; left:24px; bottom:calc(100% + 78px); z-index:76; width:max-content; padding:4px 6px; border:1px solid rgba(104,136,116,.18); border-radius:8px; background:rgba(248,247,241,.95); color:#52635a; font-family:var(--pixel-font); font-size:.31rem; pointer-events:none; }
        .community-place[data-perception="near"] { opacity:.78; }
        .community-place[data-perception="mid"] { opacity:.44; }
        .community-place[data-perception="far"] { opacity:.18; }
        .community-agent[data-perception="near"] { opacity:.94; }
        .community-agent[data-perception="mid"] { opacity:.48; }
        .community-agent[data-perception="far"] { opacity:.16; }
        .community-agent[data-perception="hidden"] { opacity:0; visibility:hidden; }
        .world-plane[data-city-detail="overview"] .community-agent-thought { display:none; }
        .world-plane[data-city-detail="balanced"] .community-agent:not([data-perception="near"]) .community-agent-thought { display:none; }
        .community-inspector { position:absolute; z-index:98; width:min(296px,calc(100vw - 24px)); max-height:min(410px,calc(100svh - 24px)); overflow:auto; padding:12px; border:1px solid rgba(112,126,116,.18); border-radius:16px; background:rgba(248,247,241,.96); box-shadow:0 14px 42px rgba(54,63,58,.11); color:#404942; backdrop-filter:blur(18px); }
        .community-inspector header { display:flex; justify-content:space-between; gap:10px; }
        .community-inspector header span { display:grid; gap:2px; min-width:0; }
        .community-inspector header small,.community-inspector-label { color:#868e88; font-family:var(--pixel-font); font-size:.33rem; letter-spacing:.05em; text-transform:uppercase; }
        .community-inspector header strong { font-size:.7rem; }
        .community-close { display:grid; place-items:center; width:28px; height:28px; border:0; border-radius:50%; background:rgba(90,103,94,.06); color:#69736d; cursor:pointer; }
        .community-close svg { width:13px; height:13px; }
        .community-stats,.community-actions { display:flex; flex-wrap:wrap; gap:5px; }
        .community-stats { margin:9px 0; }
        .community-stat { display:inline-flex; align-items:center; gap:4px; padding:5px 6px; border-radius:9px; background:rgba(103,117,107,.055); color:#69736c; font-size:.41rem; }
        .community-stat svg { width:11px; height:11px; }
        .community-offerings { display:grid; gap:5px; margin-top:7px; }
        .community-offering { display:grid; grid-template-columns:1fr auto; gap:7px; align-items:center; min-height:26px; padding:5px 6px; border-radius:8px; background:rgba(255,255,255,.2); font-size:.44rem; }
        .community-offering small { color:#79817b; font-family:var(--pixel-font); font-size:.3rem; }
        .community-actions { margin-top:7px; }
        .community-action { padding:6px 7px; border:1px solid rgba(112,121,114,.14); border-radius:8px; background:rgba(255,255,255,.27); color:#68726b; font-family:var(--pixel-font); font-size:.29rem; cursor:pointer; }
        .community-action:hover { border-color:rgba(118,139,181,.28); background:rgba(118,139,181,.07); color:#526b9c; }
        .community-menu-section { display:grid; gap:6px; margin-top:10px; padding-top:9px; border-top:1px solid rgba(112,120,114,.11); }
        .community-menu-title { display:flex; align-items:center; gap:5px; color:#858b86; font-family:var(--pixel-font); font-size:.34rem; letter-spacing:.06em; text-transform:uppercase; }
        .community-menu-title svg { width:11px; height:11px; }
        .community-menu-row { display:flex; flex-wrap:wrap; gap:5px; }
        .community-menu-pill { display:inline-flex; align-items:center; gap:4px; max-width:126px; padding:5px 6px; border-radius:9px; background:rgba(104,119,108,.055); color:#606a63; font-size:.39rem; }
        .community-menu-pill b { font-family:var(--pixel-font); font-size:.31rem; }
        @media(max-width:620px){.community-inspector{left:12px!important;right:12px;bottom:68px;top:auto!important;width:auto;max-height:52svh}.community-place-name{font-size:.31rem}}
        @media(prefers-reduced-motion:reduce){.community-place,.community-agent{transition:none!important}}
      `}</style>

      {createPortal(
        <div className="community-layer" aria-label="Living local community layer">
          {state.places.map((place) => (
            <button
              type="button"
              className="community-place"
              key={place.id}
              style={{ left: place.x, top: place.y }}
              aria-label={place.name + ", " + place.kind}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => openPlace(place, event.clientX, event.clientY)}
            >
              <svg viewBox="0 0 50 36" aria-hidden="true">
                {placeLinePaths(place.seed).map((path, index) => <path d={path} key={index} />)}
              </svg>
              <span className="community-place-name">{place.name}</span>
              {feedback[place.id] ? <span className="community-place-delta">{feedback[place.id].label}</span> : null}
            </button>
          ))}
          {state.agents.map((agent, index) => (
            <span
              className="community-agent"
              data-phase={agent.phase}
              data-avatar={agent.avatar}
              key={agent.id}
              ref={(node) => {
                if (node) agentNodesRef.current.set(agent.id, node);
                else agentNodesRef.current.delete(agent.id);
              }}
              aria-label={agent.name + ", " + agent.role + ", " + phaseLabel(agent.phase)}
            >
              <i className="community-agent-body" aria-hidden="true" />
              {agent.thought && index % 4 === 0 && agent.phase !== "rest" ? (
                <span className="community-agent-thought">{agent.thought}</span>
              ) : null}
            </span>
          ))}
        </div>,
        worldPlane,
        "community-v2-layer",
      )}

      {selected && inspector ? createPortal(
        <section
          className="community-inspector"
          style={{ left: inspector.x, top: inspector.y }}
          aria-label={selected.name + " community information"}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <header>
            <span>
              <small>{selected.kind}</small>
              <strong>{selected.name}</strong>
            </span>
            <button type="button" className="community-close" aria-label="Close community place" onClick={() => setInspector(null)}><X aria-hidden="true" /></button>
          </header>
          <div className="community-stats">
            <span className="community-stat"><Users aria-hidden="true" />rep {Math.round(selected.reputation)}</span>
            <span className="community-stat"><Package aria-hidden="true" />resources {selected.resources}</span>
            <span className="community-stat"><Sparkles aria-hidden="true" />{selected.offerings.reduce((sum, item) => sum + item.available, 0)} available</span>
          </div>
          <span className="community-inspector-label">Offerings</span>
          <div className="community-offerings">
            {selected.offerings.map((offering) => (
              <div className="community-offering" key={offering.id}>
                <span>{offering.name}</span>
                <small>{offering.available}/{offering.capacity}{offering.price ? " · ₡" + String(offering.price) : " · free"}</small>
              </div>
            ))}
          </div>
          <span className="community-inspector-label" style={{ marginTop: 9 }}>WebMCP actions</span>
          <div className="community-actions">
            {listCommunityActions(selected).map(({ action, label }) => (
              <button
                type="button"
                className="community-action"
                key={action}
                onClick={() => void executeUserAction(selected, action, chooseOfferingId(selected, action), action === "request_help" ? "I need some local help." : action === "post_notice" ? "Hello community." : undefined)}
              >{label}</button>
            ))}
          </div>
        </section>,
        viewport,
        "community-inspector",
      ) : null}

      {userFeedback && document.querySelector<HTMLElement>(".mission-user-agent")
        ? createPortal(
            <span className="community-user-delta">{userFeedback.label}</span>,
            document.querySelector<HTMLElement>(".mission-user-agent") as HTMLElement,
            "community-user-feedback",
          )
        : null}

      {menuHost ? createPortal(
        <section className="community-menu-section" aria-label="Community resources and activity">
          <span className="community-menu-title"><HeartHandshake aria-hidden="true" />Community</span>
          <div className="community-menu-row">
            <span className="community-menu-pill"><Users aria-hidden="true" />60 residents</span>
            <span className="community-menu-pill"><MapPin aria-hidden="true" />10 places</span>
            <span className="community-menu-pill">score <b>{state.userCommunityScore}</b></span>
            <span className="community-menu-pill">resources <b>{state.userResources}</b></span>
          </div>
          <div className="community-menu-row">
            {visibleCommunityInventory.length ? visibleCommunityInventory.map((item) => (
              <span className="community-menu-pill" key={item.id}><span>{item.label}</span><b>×{item.quantity}</b></span>
            )) : <span className="community-menu-pill">No community items yet</span>}
          </div>
        </section>,
        menuHost,
        "community-menu-section",
      ) : null}
    </>
  );
}
