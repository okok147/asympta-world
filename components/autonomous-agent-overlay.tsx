"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type ThoughtKind =
  | "energy"
  | "food"
  | "skill"
  | "enquiry"
  | "deal"
  | "resource"
  | "status";

type VisualThought = {
  kind: ThoughtKind;
  text: string;
  createdAt: number;
  expiresAt: number;
};

type SharedVisualAgent = {
  id: string;
  name: string;
  role: string;
  status: string;
  x: number;
  y: number;
  energy?: number;
  food?: number;
  resources?: number;
  thought?: VisualThought;
};

type SharedSnapshot = {
  worldTime: number;
  agents: SharedVisualAgent[];
};

type LocalEconomyAgent = {
  balance: number;
  energy: number;
  food: number;
  resources: number;
  skillProgress: number;
};

type Bubble = {
  kind: ThoughtKind;
  text: string;
  createdAt: number;
};

const LOCAL_STATE_KEY = "asympta-world-living-overlay-v1";
const MIN_X = 70;
const MAX_X = 1130;
const MIN_Y = 80;
const MAX_Y = 690;

function apiUrl() {
  return new URL("api/world", window.location.href).toString();
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function readLocalState() {
  try {
    const raw = localStorage.getItem(LOCAL_STATE_KEY);
    if (!raw) return {} as Record<string, LocalEconomyAgent>;
    return JSON.parse(raw) as Record<string, LocalEconomyAgent>;
  } catch {
    return {} as Record<string, LocalEconomyAgent>;
  }
}

function saveLocalState(value: Record<string, LocalEconomyAgent>) {
  try {
    localStorage.setItem(LOCAL_STATE_KEY, JSON.stringify(value));
  } catch {
    // The visual simulation can remain memory-only when storage is unavailable.
  }
}

function scanAgentHosts() {
  const result = new Map<string, HTMLButtonElement>();
  document.querySelectorAll<HTMLButtonElement>(".world-agent").forEach((node) => {
    const name = node
      .querySelector<HTMLElement>(".agent-label strong")
      ?.textContent?.trim();
    if (name) result.set(name, node);
  });
  return result;
}

function sameHosts(
  current: Map<string, HTMLButtonElement>,
  next: Map<string, HTMLButtonElement>,
) {
  if (current.size !== next.size) return false;
  return [...next.entries()].every(([name, node]) => current.get(name) === node);
}

function moveLocalAgents(hosts: Map<string, HTMLButtonElement>) {
  hosts.forEach((node) => {
    const left = Number.parseFloat(node.style.left) || node.offsetLeft;
    const top = Number.parseFloat(node.style.top) || node.offsetTop;
    const angle = Math.random() * Math.PI * 2;
    const distance = 12 + Math.random() * 24;
    node.style.left =
      String(clamp(left + Math.cos(angle) * distance, MIN_X, MAX_X)) + "px";
    node.style.top =
      String(clamp(top + Math.sin(angle) * distance, MIN_Y, MAX_Y)) + "px";
  });
}

function choose<T>(values: T[]) {
  return values[Math.floor(Math.random() * values.length)];
}

export function AutonomousAgentOverlay() {
  const [shared, setShared] = useState<SharedSnapshot | null>(null);
  const [mode, setMode] = useState<"probing" | "shared" | "local">(
    "probing",
  );
  const [hosts, setHosts] = useState<Map<string, HTMLButtonElement>>(new Map());
  const [localBubbles, setLocalBubbles] = useState<Record<string, Bubble>>({});
  const localEconomyRef = useRef<Record<string, LocalEconomyAgent>>({});

  useEffect(() => {
    localEconomyRef.current = readLocalState();
    let cancelled = false;

    const refresh = async () => {
      try {
        const response = await fetch(apiUrl(), {
          headers: { accept: "application/json" },
          cache: "no-store",
        });
        if (!response.ok) throw new Error("No shared simulation endpoint.");
        const payload = (await response.json()) as { world?: SharedSnapshot };
        if (!payload.world?.agents) throw new Error("Invalid shared world.");
        if (!cancelled) {
          setShared(payload.world);
          setMode("shared");
        }
      } catch {
        if (!cancelled) setMode("local");
      }
    };

    void refresh();
    const timer = window.setInterval(refresh, 2600);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const scan = () => {
      const next = scanAgentHosts();
      setHosts((current) => (sameHosts(current, next) ? current : next));
    };
    scan();
    const timer = window.setInterval(scan, 900);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (mode !== "local" || hosts.size === 0) return;
    const names = [...hosts.keys()];

    for (const [index, name] of names.entries()) {
      if (!localEconomyRef.current[name]) {
        localEconomyRef.current[name] = {
          balance: 120 + index * 8,
          energy: 58 + ((index * 13) % 35),
          food: 1 + (index % 4),
          resources: index % 3,
          skillProgress: 0,
        };
      }
    }

    const tick = () => {
      const economy = localEconomyRef.current;
      const nextBubbles: Record<string, Bubble> = {};
      const now = Date.now();

      for (const name of names) {
        const agent = economy[name];
        agent.energy = clamp(agent.energy - (2 + Math.random() * 3), 5, 100);
        if (agent.energy < 38 && agent.food > 0) {
          agent.food -= 1;
          agent.energy = clamp(agent.energy + 38, 0, 100);
          nextBubbles[name] = {
            kind: "energy",
            text: "Ate food · energy " + String(Math.round(agent.energy)),
            createdAt: now,
          };
        }
      }

      const roll = Math.random();
      if (roll < 0.34) {
        const buyerName = names.find(
          (name) => economy[name].food <= 1 && economy[name].balance >= 5,
        );
        const sellerName = names.find(
          (name) => name !== buyerName && economy[name].food >= 3,
        );
        if (buyerName && sellerName) {
          const price = 4 + Math.floor(Math.random() * 4);
          economy[buyerName].balance -= price;
          economy[sellerName].balance += price;
          economy[buyerName].food += 1;
          economy[sellerName].food -= 1;
          nextBubbles[buyerName] = {
            kind: "deal",
            text: "Bought food · -" + String(price) + "cr",
            createdAt: now,
          };
          nextBubbles[sellerName] = {
            kind: "food",
            text: "Sold food · +" + String(price) + "cr",
            createdAt: now,
          };
        }
      } else if (roll < 0.58) {
        const buyerName = names.find(
          (name) => economy[name].resources === 0 && economy[name].balance >= 6,
        );
        const sellerName = names.find(
          (name) => name !== buyerName && economy[name].resources >= 2,
        );
        if (buyerName && sellerName) {
          const price = 6 + Math.floor(Math.random() * 5);
          economy[buyerName].balance -= price;
          economy[sellerName].balance += price;
          economy[buyerName].resources += 1;
          economy[sellerName].resources -= 1;
          nextBubbles[buyerName] = {
            kind: "resource",
            text: "Resource +1 · -" + String(price) + "cr",
            createdAt: now,
          };
          nextBubbles[sellerName] = {
            kind: "deal",
            text: "Resource sold · +" + String(price) + "cr",
            createdAt: now,
          };
        }
      } else if (roll < 0.82 && names.length > 1) {
        const learner = choose(names);
        const teacher = choose(names.filter((name) => name !== learner));
        const price = 5 + Math.floor(Math.random() * 4);
        if (economy[learner].balance >= price) {
          economy[learner].balance -= price;
          economy[teacher].balance += price;
          economy[learner].skillProgress += 1;
          nextBubbles[learner] = {
            kind: "skill",
            text:
              "Skill practice " + String(economy[learner].skillProgress) + "/3",
            createdAt: now,
          };
          nextBubbles[teacher] = {
            kind: "deal",
            text: "Shared a skill · +" + String(price) + "cr",
            createdAt: now,
          };
          if (economy[learner].skillProgress >= 3) {
            economy[learner].skillProgress = 0;
            nextBubbles[learner].text = "New skill unlocked";
          }
        }
      } else if (names.length > 1) {
        const asker = choose(names);
        const peer = choose(names.filter((name) => name !== asker));
        nextBubbles[asker] = {
          kind: "enquiry",
          text: choose([
            "Any work nearby?",
            "Need a hand?",
            "What are you learning?",
            "Spare resources?",
            "Want to make a deal?",
          ]),
          createdAt: now,
        };
        nextBubbles[peer] = {
          kind: "status",
          text: "Listening to " + asker,
          createdAt: now,
        };
      }

      const quietNames = names
        .filter((name) => !nextBubbles[name])
        .sort(() => Math.random() - 0.5)
        .slice(0, 2);
      for (const name of quietNames) {
        const agent = economy[name];
        nextBubbles[name] = {
          kind: agent.energy < 48 ? "energy" : "status",
          text:
            agent.energy < 48
              ? "Energy " + String(Math.round(agent.energy))
              : "Exploring the world",
          createdAt: now,
        };
      }

      moveLocalAgents(hosts);
      saveLocalState(economy);
      setLocalBubbles(nextBubbles);
    };

    tick();
    const timer = window.setInterval(tick, 3600);
    return () => window.clearInterval(timer);
  }, [hosts, mode]);

  const visibleShared = useMemo(() => {
    if (!shared) return new Map<string, VisualThought>();
    return new Map(
      shared.agents
        .filter(
          (agent) =>
            agent.thought &&
            agent.thought.expiresAt >= shared.worldTime - 1200,
        )
        .sort(
          (a, b) =>
            (b.thought?.createdAt ?? 0) - (a.thought?.createdAt ?? 0),
        )
        .slice(0, 6)
        .map((agent) => [agent.name, agent.thought as VisualThought]),
    );
  }, [shared]);

  return (
    <>
      <style>{`
        .world-agent {
          overflow: visible !important;
          transition:
            left 3.15s cubic-bezier(.2,.72,.22,1),
            top 3.15s cubic-bezier(.2,.72,.22,1),
            background 240ms ease,
            border-color 240ms ease,
            transform 500ms ease,
            opacity 240ms ease !important;
          will-change: left, top;
        }

        .agent-thought-bubble {
          position: absolute;
          z-index: 42;
          left: 34px;
          bottom: calc(100% + 12px);
          display: grid;
          gap: 3px;
          min-width: 104px;
          max-width: 168px;
          padding: 7px 8px 8px;
          border: 1px solid #9ca99f;
          border-left-width: 3px;
          border-radius: 4px;
          background: rgba(250, 249, 243, .97);
          box-shadow: 3px 3px 0 rgba(55, 67, 59, .09);
          color: #343a35;
          pointer-events: none;
          transform-origin: 18px 100%;
          animation: asympta-thought-in 260ms steps(3, end) both;
        }

        .agent-thought-bubble::before,
        .agent-thought-bubble::after {
          content: "";
          position: absolute;
          border: 1px solid #9ca99f;
          border-radius: 50%;
          background: rgba(250, 249, 243, .98);
        }

        .agent-thought-bubble::before {
          left: 10px;
          bottom: -8px;
          width: 7px;
          height: 7px;
        }

        .agent-thought-bubble::after {
          left: 4px;
          bottom: -14px;
          width: 4px;
          height: 4px;
        }

        .agent-thought-bubble > small {
          font-family: var(--pixel-font);
          font-size: .34rem;
          font-weight: 800;
          letter-spacing: .08em;
          line-height: 1;
          text-transform: uppercase;
          opacity: .7;
        }

        .agent-thought-bubble > strong {
          overflow: hidden;
          font-size: .49rem;
          font-weight: 680;
          line-height: 1.28;
          text-overflow: ellipsis;
        }

        .agent-thought-bubble--energy { border-left-color: #ba9b63; }
        .agent-thought-bubble--food { border-left-color: #8aa477; }
        .agent-thought-bubble--skill { border-left-color: #718ba8; }
        .agent-thought-bubble--enquiry { border-left-color: #857ca8; }
        .agent-thought-bubble--deal { border-left-color: #b18465; }
        .agent-thought-bubble--resource { border-left-color: #7c9b96; }
        .agent-thought-bubble--status { border-left-color: #9ba09b; }

        @keyframes asympta-thought-in {
          from { opacity: 0; transform: translateY(4px) scale(.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        @media (max-width: 720px) {
          .agent-thought-bubble {
            max-width: 132px;
            min-width: 88px;
            padding: 6px 7px;
          }
        }
      `}</style>

      {[...hosts.entries()].map(([name, host]) => {
        const thought =
          mode === "shared" ? visibleShared.get(name) : localBubbles[name];
        if (!thought) return null;
        return createPortal(
          <span
            className={
              "agent-thought-bubble agent-thought-bubble--" + thought.kind
            }
            aria-hidden="true"
          >
            <small>{thought.kind}</small>
            <strong>{thought.text}</strong>
          </span>,
          host,
          "thought-" + name,
        );
      })}
    </>
  );
}
