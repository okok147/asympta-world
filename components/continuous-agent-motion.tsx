"use client";

import {
  Activity,
  Brain,
  Check,
  CircleHelp,
  Coins,
  Handshake,
  Hammer,
  MessageCircle,
  Move,
  Package,
  Search,
  Target,
  Utensils,
  Workflow,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type ThoughtKind =
  | "energy"
  | "food"
  | "skill"
  | "enquiry"
  | "deal"
  | "resource"
  | "status"
  | "workflow";

type IconSymbol =
  | "energy"
  | "food"
  | "skill"
  | "question"
  | "talk"
  | "deal"
  | "payment"
  | "resource"
  | "search"
  | "work"
  | "complete"
  | "target"
  | "status"
  | "workflow"
  | "walk";

type AgentHost = {
  name: string;
  role: string;
  node: HTMLButtonElement;
};

type MotionState = {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  speed: number;
  pauseUntil: number;
  moving: boolean;
};

type BehaviorIntent = {
  targetName?: string;
  targetX?: number;
  targetY?: number;
  expiresAt: number;
  holdUntil: number;
  encounterId?: string;
};

type Thought = {
  kind: ThoughtKind;
  symbols: IconSymbol[];
  accessibleText: string;
  expiresAt: number;
};

type AmbientState = {
  energy: number;
  food: number;
};

type BehaviorDetail = {
  actorName?: string;
  actorRole?: string;
  partnerName?: string;
  partnerRole?: string;
  kind: ThoughtKind;
  message: string;
  partnerMessage?: string;
  symbols?: IconSymbol[];
  partnerSymbols?: IconSymbol[];
  durationMs?: number;
  holdMs?: number;
  encounterId?: string;
};

type MotionTargetDetail = {
  agentName: string;
  x: number;
  y: number;
  durationMs?: number;
};

const WORLD_MIN_X = 68;
const WORLD_MAX_X = 1132;
const WORLD_MIN_Y = 78;
const WORLD_MAX_Y = 688;
const SOCIAL_DISTANCE = 30;

const ROLE_MATCH: Record<string, string[]> = {
  product: ["product strategist"],
  opportunity: ["opportunity generalist"],
  research: ["market researcher"],
  data: ["data analyst"],
  brand: ["brand strategist"],
  visual: ["visual designer"],
  frontend: ["frontend engineer"],
  quality: ["quality engineer"],
  automation: ["automation specialist"],
  operations: ["operations analyst"],
  copy: ["copywriter"],
};

const ICONS: Record<IconSymbol, LucideIcon> = {
  energy: Zap,
  food: Utensils,
  skill: Brain,
  question: CircleHelp,
  talk: MessageCircle,
  deal: Handshake,
  payment: Coins,
  resource: Package,
  search: Search,
  work: Hammer,
  complete: Check,
  target: Target,
  status: Activity,
  workflow: Workflow,
  walk: Move,
};

const DEFAULT_SYMBOLS: Record<ThoughtKind, IconSymbol[]> = {
  energy: ["energy"],
  food: ["food", "question"],
  skill: ["skill"],
  enquiry: ["question", "talk"],
  deal: ["deal", "payment"],
  resource: ["resource"],
  status: ["status"],
  workflow: ["workflow", "work"],
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function scanAgentHosts() {
  const result = new Map<string, AgentHost>();
  document.querySelectorAll<HTMLButtonElement>(".world-agent").forEach((node) => {
    const name = node.querySelector<HTMLElement>(".agent-label strong")?.textContent?.trim();
    const role = node.querySelector<HTMLElement>(".agent-label small")?.textContent?.trim();
    if (name && role) result.set(name, { name, role, node });
  });
  return result;
}

function sameHosts(a: Map<string, AgentHost>, b: Map<string, AgentHost>) {
  if (a.size !== b.size) return false;
  for (const [name, host] of a) {
    if (b.get(name)?.node !== host.node) return false;
  }
  return true;
}

function resolveHost(
  hosts: Map<string, AgentHost>,
  name: string | undefined,
  role: string | undefined,
) {
  if (name && hosts.has(name)) return hosts.get(name);
  if (!role) return undefined;
  const phrases = ROLE_MATCH[role] ?? [role];
  return [...hosts.values()].find((host) =>
    phrases.some((phrase) => host.role.toLowerCase().includes(phrase)),
  );
}

function chooseRoamTarget(state: MotionState) {
  const radius = 72 + Math.random() * 156;
  const angle = Math.random() * Math.PI * 2;
  state.targetX = clamp(
    state.x + Math.cos(angle) * radius,
    WORLD_MIN_X,
    WORLD_MAX_X,
  );
  state.targetY = clamp(
    state.y + Math.sin(angle) * radius,
    WORLD_MIN_Y,
    WORLD_MAX_Y,
  );
  state.speed = 19 + Math.random() * 29;
}

function readPosition(host: AgentHost, motion: Map<string, MotionState>) {
  const state = motion.get(host.name);
  if (state) return { x: state.x, y: state.y };
  return {
    x: Number.parseFloat(host.node.style.left) || host.node.offsetLeft || 500,
    y: Number.parseFloat(host.node.style.top) || host.node.offsetTop || 360,
  };
}

function meetingTargets(
  actor: AgentHost,
  partner: AgentHost,
  motion: Map<string, MotionState>,
) {
  const first = readPosition(actor, motion);
  const second = readPosition(partner, motion);
  const dx = second.x - first.x;
  const dy = second.y - first.y;
  const distance = Math.hypot(dx, dy);
  const ux = distance > 1 ? dx / distance : 1;
  const uy = distance > 1 ? dy / distance : 0;
  const midpointX = (first.x + second.x) / 2;
  const midpointY = (first.y + second.y) / 2;
  return {
    actorX: clamp(midpointX - ux * SOCIAL_DISTANCE, WORLD_MIN_X, WORLD_MAX_X),
    actorY: clamp(midpointY - uy * SOCIAL_DISTANCE, WORLD_MIN_Y, WORLD_MAX_Y),
    partnerX: clamp(midpointX + ux * SOCIAL_DISTANCE, WORLD_MIN_X, WORLD_MAX_X),
    partnerY: clamp(midpointY + uy * SOCIAL_DISTANCE, WORLD_MIN_Y, WORLD_MAX_Y),
  };
}

export function ContinuousAgentMotion() {
  const hostsRef = useRef<Map<string, AgentHost>>(new Map());
  const motionRef = useRef<Map<string, MotionState>>(new Map());
  const behaviorRef = useRef<Record<string, BehaviorIntent>>({});
  const ambientRef = useRef<Record<string, AmbientState>>({});
  const [renderHosts, setRenderHosts] = useState<AgentHost[]>([]);
  const [thoughts, setThoughts] = useState<Record<string, Thought>>({});

  useEffect(() => {
    let scanInterval = 0;
    const initialScan = window.setTimeout(() => {
      const scan = () => {
        const next = scanAgentHosts();
        if (!sameHosts(hostsRef.current, next)) {
          hostsRef.current = next;
          for (const [index, host] of [...next.values()].entries()) {
            if (!ambientRef.current[host.name]) {
              ambientRef.current[host.name] = {
                energy: 58 + ((index * 13) % 37),
                food: 1 + (index % 4),
              };
            }
          }
          setRenderHosts([...next.values()]);
        }
      };
      scan();
      scanInterval = window.setInterval(scan, 850);
    }, 0);

    return () => {
      window.clearTimeout(initialScan);
      if (scanInterval) window.clearInterval(scanInterval);
    };
  }, []);

  useEffect(() => {
    const onBehavior = (event: Event) => {
      const detail = (event as CustomEvent<BehaviorDetail>).detail;
      if (!detail?.message) return;
      const hosts = hostsRef.current;
      const actor = resolveHost(hosts, detail.actorName, detail.actorRole);
      const partner = resolveHost(hosts, detail.partnerName, detail.partnerRole);
      const now = Date.now();
      const duration = clamp(detail.durationMs ?? 6200, 5000, 18000);
      const hold = clamp(detail.holdMs ?? duration - 900, 3200, duration);

      if (actor && partner) {
        const meeting = meetingTargets(actor, partner, motionRef.current);
        behaviorRef.current[actor.name] = {
          targetName: partner.name,
          targetX: meeting.actorX,
          targetY: meeting.actorY,
          expiresAt: now + duration,
          holdUntil: now + hold,
          encounterId: detail.encounterId,
        };
        behaviorRef.current[partner.name] = {
          targetName: actor.name,
          targetX: meeting.partnerX,
          targetY: meeting.partnerY,
          expiresAt: now + duration,
          holdUntil: now + hold,
          encounterId: detail.encounterId,
        };
      } else if (actor) {
        behaviorRef.current[actor.name] = {
          expiresAt: now + duration,
          holdUntil: 0,
          encounterId: detail.encounterId,
        };
      }

      if (actor) {
        setThoughts((current) => ({
          ...current,
          [actor.name]: {
            kind: detail.kind,
            symbols: detail.symbols?.slice(0, 3) ?? DEFAULT_SYMBOLS[detail.kind],
            accessibleText: detail.message,
            expiresAt: now + duration,
          },
          ...(partner
            ? {
                [partner.name]: {
                  kind: detail.kind,
                  symbols:
                    detail.partnerSymbols?.slice(0, 3) ??
                    detail.symbols?.slice(0, 3).reverse() ??
                    DEFAULT_SYMBOLS[detail.kind],
                  accessibleText:
                    detail.partnerMessage ?? "Interacting with " + actor.name,
                  expiresAt: now + duration,
                },
              }
            : {}),
        }));
      }
    };

    const onMotionTarget = (event: Event) => {
      const detail = (event as CustomEvent<MotionTargetDetail>).detail;
      if (!detail?.agentName || !Number.isFinite(detail.x) || !Number.isFinite(detail.y)) {
        return;
      }
      const now = Date.now();
      behaviorRef.current[detail.agentName] = {
        targetX: clamp(detail.x, WORLD_MIN_X, WORLD_MAX_X),
        targetY: clamp(detail.y, WORLD_MIN_Y, WORLD_MAX_Y),
        expiresAt: now + clamp(detail.durationMs ?? 5200, 2000, 12000),
        holdUntil: 0,
      };
    };

    window.addEventListener("asympta:agent-behavior", onBehavior);
    window.addEventListener("asympta:agent-motion-target", onMotionTarget);
    return () => {
      window.removeEventListener("asympta:agent-behavior", onBehavior);
      window.removeEventListener("asympta:agent-motion-target", onMotionTarget);
    };
  }, []);

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const animate = (time: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (time - last) / 1000));
      last = time;
      const now = Date.now();

      hostsRef.current.forEach((host, name) => {
        const node = host.node;
        let state = motionRef.current.get(name);
        if (!state) {
          const x = Number.parseFloat(node.style.left) || node.offsetLeft || 500;
          const y = Number.parseFloat(node.style.top) || node.offsetTop || 360;
          state = {
            x,
            y,
            targetX: x,
            targetY: y,
            speed: 24,
            pauseUntil: now + Math.random() * 1000,
            moving: false,
          };
          chooseRoamTarget(state);
          motionRef.current.set(name, state);
        }

        if (reducedMotion) {
          node.classList.remove("is-world-walking");
          node.classList.add("is-world-paused");
          return;
        }

        const intent = behaviorRef.current[name];
        const intentActive = Boolean(intent && intent.expiresAt >= now);
        if (intentActive && Number.isFinite(intent?.targetX) && Number.isFinite(intent?.targetY)) {
          state.targetX = intent?.targetX ?? state.targetX;
          state.targetY = intent?.targetY ?? state.targetY;
          state.speed = intent?.targetName ? 38 : 31;
          state.pauseUntil = 0;
        }

        const dx = state.targetX - state.x;
        const dy = state.targetY - state.y;
        const distance = Math.hypot(dx, dy);

        if (now < state.pauseUntil) {
          state.moving = false;
        } else if (distance <= 3) {
          if (intentActive && intent?.targetName) {
            state.moving = false;
            state.pauseUntil = Math.min(intent.expiresAt, now + 650);
          } else if (intentActive && intent?.targetX !== undefined) {
            state.moving = false;
            state.pauseUntil = Math.min(intent.expiresAt, now + 520);
          } else if (Math.random() < 0.35) {
            state.pauseUntil = now + 500 + Math.random() * 2700;
            state.moving = false;
          } else {
            chooseRoamTarget(state);
            state.moving = true;
          }
        } else {
          const step = Math.min(distance, state.speed * dt);
          state.x = clamp(
            state.x + (dx / distance) * step,
            WORLD_MIN_X,
            WORLD_MAX_X,
          );
          state.y = clamp(
            state.y + (dy / distance) * step,
            WORLD_MIN_Y,
            WORLD_MAX_Y,
          );
          state.moving = true;
        }

        node.style.left = state.x.toFixed(2) + "px";
        node.style.top = state.y.toFixed(2) + "px";
        node.classList.toggle("is-world-walking", state.moving);
        node.classList.toggle("is-world-paused", !state.moving);
        node.classList.toggle(
          "is-world-encountering",
          Boolean(intentActive && intent?.targetName),
        );
      });

      frame = window.requestAnimationFrame(animate);
    };

    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const ambient = () => {
      const hosts = [...hostsRef.current.values()];
      const now = Date.now();
      const busy = new Set(
        Object.entries(behaviorRef.current)
          .filter(([, intent]) => intent.expiresAt >= now)
          .map(([name]) => name),
      );
      const candidates = hosts.filter(
        (host) => !busy.has(host.name) && !host.node.classList.contains("mission-user-agent"),
      );
      if (candidates.length === 0) return;
      const host = candidates[Math.floor(Math.random() * candidates.length)];
      const state = ambientRef.current[host.name];
      if (!state) return;
      state.energy = clamp(state.energy - (1 + Math.random() * 2.2), 8, 100);

      let thought: Thought;
      if (state.energy < 35 && state.food > 0) {
        state.food -= 1;
        state.energy = clamp(state.energy + 40, 0, 100);
        thought = {
          kind: "energy",
          symbols: ["food", "energy"],
          accessibleText: "Eating to restore energy",
          expiresAt: now + 4000,
        };
      } else if (state.food <= 1 && Math.random() < 0.42) {
        thought = {
          kind: "food",
          symbols: ["food", "question"],
          accessibleText: "Looking for food",
          expiresAt: now + 4200,
        };
      } else if (Math.random() < 0.38) {
        thought = {
          kind: "enquiry",
          symbols: ["question", "search"],
          accessibleText: "Looking for an opportunity or collaborator",
          expiresAt: now + 4100,
        };
      } else {
        thought = {
          kind: "status",
          symbols: ["status", "search"],
          accessibleText: "Watching nearby market activity",
          expiresAt: now + 3900,
        };
      }
      setThoughts((current) => ({ ...current, [host.name]: thought }));
    };

    const timer = window.setInterval(ambient, 3900);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      setThoughts((current) =>
        Object.fromEntries(
          Object.entries(current).filter(([, thought]) => thought.expiresAt >= now),
        ),
      );
      for (const [name, intent] of Object.entries(behaviorRef.current)) {
        if (intent.expiresAt < now) {
          delete behaviorRef.current[name];
          const state = motionRef.current.get(name);
          if (state) {
            state.pauseUntil = 0;
            chooseRoamTarget(state);
          }
        }
      }
    }, 900);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <>
      <style>{`
        .world-agent {
          overflow: visible !important;
          transition:
            background 180ms ease,
            border-color 180ms ease,
            opacity 180ms ease !important;
          will-change: left, top;
        }
        .world-agent.is-world-walking .participant-sprite,
        .world-agent.is-world-walking .mission-pixel-person {
          animation: asympta-world-walk 520ms steps(2, end) infinite !important;
        }
        .world-agent.is-world-encountering {
          z-index: 22;
        }
        .business-thought {
          position: absolute;
          z-index: 48;
          left: 34px;
          bottom: calc(100% + 12px);
          display: grid;
          place-items: center;
          min-width: 42px;
          min-height: 34px;
          padding: 6px 7px;
          border: 1px solid #9ca99f;
          border-left: 3px solid #8e9b91;
          border-radius: 4px;
          background: rgba(250, 249, 243, .97);
          box-shadow: 3px 3px 0 rgba(55, 67, 59, .08);
          color: #4d5650;
          pointer-events: none;
          animation: asympta-business-bubble-in 220ms steps(3, end) both;
        }
        .business-thought::before,
        .business-thought::after {
          content: "";
          position: absolute;
          border: 1px solid #9ca99f;
          border-radius: 50%;
          background: rgba(250, 249, 243, .98);
        }
        .business-thought::before { left: 10px; bottom: -8px; width: 7px; height: 7px; }
        .business-thought::after { left: 4px; bottom: -14px; width: 4px; height: 4px; }
        .business-thought-icons {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
        }
        .business-thought-icons svg {
          width: 13px;
          height: 13px;
          stroke-width: 1.8;
        }
        .business-thought--energy { border-left-color: #ba9b63; }
        .business-thought--food { border-left-color: #8aa477; }
        .business-thought--skill { border-left-color: #718ba8; }
        .business-thought--enquiry { border-left-color: #857ca8; }
        .business-thought--deal { border-left-color: #b18465; }
        .business-thought--resource { border-left-color: #7c9b96; }
        .business-thought--workflow { border-left-color: #6f8f7b; }
        @keyframes asympta-world-walk {
          0% { transform: translateY(0) rotate(-.6deg); }
          50% { transform: translateY(-2px) rotate(.6deg); }
          100% { transform: translateY(0) rotate(-.6deg); }
        }
        @keyframes asympta-business-bubble-in {
          from { opacity: 0; transform: translateY(4px) scale(.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .world-agent.is-world-walking .participant-sprite,
          .world-agent.is-world-walking .mission-pixel-person { animation: none !important; }
          .business-thought { animation: none; }
        }
      `}</style>

      {renderHosts.map((host) => {
        const thought = thoughts[host.name];
        if (!thought) return null;
        return createPortal(
          <span
            className={"business-thought business-thought--" + thought.kind}
            aria-label={thought.accessibleText}
            role="status"
          >
            <span className="business-thought-icons" aria-hidden="true">
              {thought.symbols.map((symbol, index) => {
                const Icon = ICONS[symbol];
                return <Icon key={symbol + "-" + String(index)} />;
              })}
            </span>
          </span>,
          host.node,
          "business-thought-" + host.name,
        );
      })}
    </>
  );
}
