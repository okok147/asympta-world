"use client";

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
  expiresAt: number;
};

type Thought = {
  kind: ThoughtKind;
  text: string;
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
  durationMs?: number;
};

const WORLD_MIN_X = 68;
const WORLD_MAX_X = 1132;
const WORLD_MIN_Y = 78;
const WORLD_MAX_Y = 688;

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
      const duration = clamp(detail.durationMs ?? 5200, 1600, 16000);

      if (actor) {
        behaviorRef.current[actor.name] = {
          targetName: partner?.name,
          expiresAt: now + duration,
        };
        setThoughts((current) => ({
          ...current,
          [actor.name]: {
            kind: detail.kind,
            text: detail.message,
            expiresAt: now + duration,
          },
          ...(partner
            ? {
                [partner.name]: {
                  kind: "status" as const,
                  text:
                    detail.partnerMessage ??
                    "Interacting with " + actor.name,
                  expiresAt: now + Math.max(1600, duration - 700),
                },
              }
            : {}),
        }));
      }
    };

    window.addEventListener("asympta:agent-behavior", onBehavior);
    return () => window.removeEventListener("asympta:agent-behavior", onBehavior);
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
        if (intent && intent.expiresAt >= now && intent.targetName) {
          const peer = motionRef.current.get(intent.targetName);
          if (peer) {
            const offsetAngle = (name.length * 0.89) % (Math.PI * 2);
            state.targetX = clamp(
              peer.x + Math.cos(offsetAngle) * 58,
              WORLD_MIN_X,
              WORLD_MAX_X,
            );
            state.targetY = clamp(
              peer.y + Math.sin(offsetAngle) * 46,
              WORLD_MIN_Y,
              WORLD_MAX_Y,
            );
            state.speed = 36;
            state.pauseUntil = 0;
          }
        }

        const dx = state.targetX - state.x;
        const dy = state.targetY - state.y;
        const distance = Math.hypot(dx, dy);

        if (now < state.pauseUntil) {
          state.moving = false;
        } else if (distance <= 3) {
          if (intent && intent.expiresAt >= now) {
            state.pauseUntil = now + 260 + Math.random() * 650;
            state.moving = false;
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
      const candidates = hosts.filter((host) => !busy.has(host.name));
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
          text: "Ate food · energy " + String(Math.round(state.energy)),
          expiresAt: now + 4000,
        };
      } else if (state.food <= 1 && Math.random() < 0.42) {
        thought = {
          kind: "food",
          text: "Low food stock · looking for a seller",
          expiresAt: now + 4200,
        };
      } else if (Math.random() < 0.38) {
        const messages = [
          "Any work nearby?",
          "Who has spare capacity?",
          "What is in demand?",
          "Need help with a handoff?",
        ];
        thought = {
          kind: "enquiry",
          text: messages[Math.floor(Math.random() * messages.length)],
          expiresAt: now + 4100,
        };
      } else {
        thought = {
          kind: "status",
          text:
            Math.random() < 0.5
              ? "Exploring nearby activity"
              : "Watching market signals",
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
        if (intent.expiresAt < now) delete behaviorRef.current[name];
      }
    }, 1000);
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
        .world-agent.is-world-walking .participant-sprite {
          animation: asympta-world-walk 520ms steps(2, end) infinite !important;
        }
        .business-thought {
          position: absolute;
          z-index: 48;
          left: 34px;
          bottom: calc(100% + 12px);
          display: grid;
          gap: 3px;
          width: max-content;
          min-width: 106px;
          max-width: 182px;
          padding: 7px 8px 8px;
          border: 1px solid #9ca99f;
          border-left: 3px solid #8e9b91;
          border-radius: 4px;
          background: rgba(250, 249, 243, .97);
          box-shadow: 3px 3px 0 rgba(55, 67, 59, .08);
          color: #343a35;
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
        .business-thought small {
          font-family: var(--pixel-font);
          font-size: .34rem;
          font-weight: 800;
          letter-spacing: .08em;
          line-height: 1;
          text-transform: uppercase;
          opacity: .72;
        }
        .business-thought strong {
          font-size: .49rem;
          line-height: 1.3;
          font-weight: 680;
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
        @media (max-width: 720px) {
          .business-thought { min-width: 88px; max-width: 138px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .world-agent.is-world-walking .participant-sprite { animation: none !important; }
          .business-thought { animation: none; }
        }
      `}</style>

      {renderHosts.map((host) => {
        const thought = thoughts[host.name];
        if (!thought) return null;
        return createPortal(
          <span
            className={"business-thought business-thought--" + thought.kind}
            aria-hidden="true"
          >
            <small>{thought.kind}</small>
            <strong>{thought.text}</strong>
          </span>,
          host.node,
          "business-thought-" + host.name,
        );
      })}
    </>
  );
}
