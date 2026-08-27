"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

type WorkflowKind =
  | "client-service"
  | "inventory-restock"
  | "product-launch"
  | "specialist-subcontract";

type WorkflowSource = "autonomous" | "webmcp";

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

type Thought = {
  kind: ThoughtKind;
  text: string;
  expiresAt: number;
  flowId?: string;
};

type BehaviorIntent = {
  targetName?: string;
  focusX?: number;
  focusY?: number;
  expiresAt: number;
};

type LocalAgentEconomy = {
  credits: number;
  energy: number;
  food: number;
  resources: number;
};

type WorkflowStep = {
  label: string;
  actorRole: string;
  partnerRole?: string;
  kind: ThoughtKind;
  message: string;
  delayMs: number;
  bridgeAction?: "post-need" | "accept-offer" | "message";
  transferCredits?: number;
  transferResources?: number;
};

type WorkflowTemplate = {
  title: string;
  defaultObjective: string;
  skills: string[];
  steps: WorkflowStep[];
};

type WorkflowHistory = {
  label: string;
  actor: string;
  message: string;
  at: number;
};

type WorkflowRun = {
  id: string;
  kind: WorkflowKind;
  source: WorkflowSource;
  title: string;
  businessName: string;
  objective: string;
  budget: number;
  status: "active" | "completed";
  stepIndex: number;
  nextStepAt: number;
  participants: string[];
  history: WorkflowHistory[];
  linkedNeedId?: string;
  createdAt: number;
  updatedAt: number;
};

type RuntimeTool = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: {
    readOnlyHint: boolean;
    untrustedContentHint: boolean;
  };
  execute: (input: Record<string, unknown>) => Promise<string>;
};

const WORLD_MIN_X = 68;
const WORLD_MAX_X = 1132;
const WORLD_MIN_Y = 78;
const WORLD_MAX_Y = 688;
const RUNS_KEY = "asympta-business-workflows-v2";
const ECONOMY_KEY = "asympta-business-agent-economy-v2";
const MAX_RUNS = 10;

const WORKFLOWS: Record<WorkflowKind, WorkflowTemplate> = {
  "client-service": {
    title: "Client service delivery",
    defaultObjective: "Turn a customer request into a scoped, quoted, delivered service",
    skills: ["product-strategy", "research", "visual-design", "frontend", "qa"],
    steps: [
      {
        label: "Customer enquiry",
        actorRole: "product",
        partnerRole: "opportunity",
        kind: "enquiry",
        message: "New customer brief received · checking scope + budget",
        delayMs: 4300,
        bridgeAction: "post-need",
      },
      {
        label: "Discovery",
        actorRole: "research",
        partnerRole: "product",
        kind: "workflow",
        message: "Clarifying audience, constraints and success metric",
        delayMs: 4800,
      },
      {
        label: "Quote",
        actorRole: "visual",
        partnerRole: "product",
        kind: "deal",
        message: "Preparing fixed-scope quote and delivery promise",
        delayMs: 4700,
      },
      {
        label: "Contract",
        actorRole: "product",
        partnerRole: "visual",
        kind: "deal",
        message: "Best valid offer selected · work authorised",
        delayMs: 4300,
        bridgeAction: "accept-offer",
      },
      {
        label: "Production handoff",
        actorRole: "frontend",
        partnerRole: "visual",
        kind: "workflow",
        message: "Design handoff → implementation · shared acceptance criteria",
        delayMs: 5200,
      },
      {
        label: "Quality review",
        actorRole: "quality",
        partnerRole: "frontend",
        kind: "status",
        message: "QA checking responsive flow, edge cases and delivery quality",
        delayMs: 4600,
      },
      {
        label: "Delivery + settlement",
        actorRole: "product",
        partnerRole: "frontend",
        kind: "deal",
        message: "Deliverable accepted · invoice settled · reputation updated",
        delayMs: 4000,
        transferCredits: 24,
      },
    ],
  },
  "inventory-restock": {
    title: "Inventory replenishment",
    defaultObjective: "Detect low stock, source supply, negotiate, receive and restock",
    skills: ["data-analysis", "automation", "product-strategy"],
    steps: [
      {
        label: "Stock check",
        actorRole: "operations",
        partnerRole: "data",
        kind: "status",
        message: "Stock below reorder point · calculating required quantity",
        delayMs: 4000,
      },
      {
        label: "Supplier enquiry",
        actorRole: "automation",
        partnerRole: "opportunity",
        kind: "enquiry",
        message: "RFQ sent · asking price, lead time and available quantity",
        delayMs: 4400,
        bridgeAction: "message",
      },
      {
        label: "Price negotiation",
        actorRole: "opportunity",
        partnerRole: "automation",
        kind: "deal",
        message: "Comparing unit economics · negotiating a bounded purchase",
        delayMs: 4500,
      },
      {
        label: "Purchase order",
        actorRole: "operations",
        partnerRole: "automation",
        kind: "resource",
        message: "PO approved · credits reserved · supplier commits stock",
        delayMs: 4700,
        transferCredits: 14,
      },
      {
        label: "Goods received",
        actorRole: "operations",
        partnerRole: "automation",
        kind: "resource",
        message: "Inventory received +3 · quantity and condition verified",
        delayMs: 4300,
        transferResources: 3,
      },
      {
        label: "Reorder updated",
        actorRole: "data",
        partnerRole: "operations",
        kind: "status",
        message: "Reorder level recalibrated from demand and lead-time evidence",
        delayMs: 3800,
      },
    ],
  },
  "product-launch": {
    title: "Small product launch",
    defaultObjective: "Research, position, design, build, QA and launch a small product",
    skills: ["research", "branding", "visual-design", "frontend", "qa", "product-strategy"],
    steps: [
      {
        label: "Opportunity brief",
        actorRole: "product",
        partnerRole: "research",
        kind: "enquiry",
        message: "Launch hypothesis formed · requesting evidence before building",
        delayMs: 4200,
        bridgeAction: "post-need",
      },
      {
        label: "Market research",
        actorRole: "research",
        partnerRole: "product",
        kind: "workflow",
        message: "Checking competitors, demand signals and target customer",
        delayMs: 5000,
      },
      {
        label: "Positioning",
        actorRole: "brand",
        partnerRole: "research",
        kind: "skill",
        message: "Turning evidence into positioning and a clear promise",
        delayMs: 4700,
      },
      {
        label: "Visual concept",
        actorRole: "visual",
        partnerRole: "brand",
        kind: "workflow",
        message: "Visual system created from positioning constraints",
        delayMs: 4800,
      },
      {
        label: "Build",
        actorRole: "frontend",
        partnerRole: "visual",
        kind: "workflow",
        message: "Building the launch surface · implementation follows design",
        delayMs: 5200,
      },
      {
        label: "QA",
        actorRole: "quality",
        partnerRole: "frontend",
        kind: "status",
        message: "Testing launch path · blocking defects before release",
        delayMs: 4600,
      },
      {
        label: "Launch decision",
        actorRole: "product",
        partnerRole: "quality",
        kind: "deal",
        message: "Evidence + quality gate passed · launch approved",
        delayMs: 3900,
        bridgeAction: "accept-offer",
      },
    ],
  },
  "specialist-subcontract": {
    title: "Specialist subcontract",
    defaultObjective: "Detect a skill gap, source a specialist, review work and settle payment",
    skills: ["product-strategy", "research", "qa", "automation"],
    steps: [
      {
        label: "Skill gap detected",
        actorRole: "opportunity",
        partnerRole: "research",
        kind: "skill",
        message: "Current team lacks one required capability · do not fake coverage",
        delayMs: 3900,
        bridgeAction: "post-need",
      },
      {
        label: "Specialist search",
        actorRole: "research",
        partnerRole: "automation",
        kind: "enquiry",
        message: "Searching nearby capability + reputation + available capacity",
        delayMs: 4300,
      },
      {
        label: "Rate negotiation",
        actorRole: "opportunity",
        partnerRole: "automation",
        kind: "deal",
        message: "Negotiating rate, scope boundary and accountable handoff",
        delayMs: 4500,
        bridgeAction: "message",
      },
      {
        label: "Subcontract work",
        actorRole: "automation",
        partnerRole: "opportunity",
        kind: "workflow",
        message: "Specialist executing bounded subcontract · lead remains accountable",
        delayMs: 5100,
      },
      {
        label: "Review",
        actorRole: "quality",
        partnerRole: "automation",
        kind: "status",
        message: "Reviewing specialist output against agreed acceptance criteria",
        delayMs: 4400,
      },
      {
        label: "Payment",
        actorRole: "opportunity",
        partnerRole: "automation",
        kind: "deal",
        message: "Subcontract accepted · specialist paid · relationship strengthened",
        delayMs: 3900,
        bridgeAction: "accept-offer",
        transferCredits: 18,
      },
    ],
  },
};

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
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function loadRuns(): WorkflowRun[] {
  try {
    const raw = localStorage.getItem(RUNS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WorkflowRun[];
    return parsed.slice(0, MAX_RUNS);
  } catch {
    return [];
  }
}

function saveRuns(runs: WorkflowRun[]) {
  try {
    localStorage.setItem(RUNS_KEY, JSON.stringify(runs.slice(0, MAX_RUNS)));
  } catch {
    // Memory-only mode is acceptable when storage is unavailable.
  }
}

function loadEconomy() {
  try {
    const raw = localStorage.getItem(ECONOMY_KEY);
    if (!raw) return {} as Record<string, LocalAgentEconomy>;
    return JSON.parse(raw) as Record<string, LocalAgentEconomy>;
  } catch {
    return {} as Record<string, LocalAgentEconomy>;
  }
}

function saveEconomy(value: Record<string, LocalAgentEconomy>) {
  try {
    localStorage.setItem(ECONOMY_KEY, JSON.stringify(value));
  } catch {
    // Keep simulation in memory if storage is unavailable.
  }
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

function roleAgent(hosts: Map<string, AgentHost>, role: string, fallbackIndex = 0) {
  const phrases = ROLE_MATCH[role] ?? [role];
  const values = [...hosts.values()];
  return (
    values.find((host) =>
      phrases.some((phrase) => host.role.toLowerCase().includes(phrase)),
    ) ?? values[fallbackIndex % Math.max(1, values.length)]
  );
}

function bridgeRegistry() {
  return (
    window as unknown as {
      __ASYMPTA_WEBMCP__?: {
        invoke: (name: string, input?: Record<string, unknown>) => Promise<unknown>;
      };
    }
  ).__ASYMPTA_WEBMCP__;
}

function parseUnknown(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object") return value as Record<string, unknown>;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === "object"
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  return null;
}

function validWorkflowKind(value: unknown): WorkflowKind {
  if (
    value === "client-service" ||
    value === "inventory-restock" ||
    value === "product-launch" ||
    value === "specialist-subcontract"
  ) {
    return value;
  }
  return "client-service";
}

export function BusinessWorldRuntime() {
  const hostsRef = useRef<Map<string, AgentHost>>(new Map());
  const motionRef = useRef<Map<string, MotionState>>(new Map());
  const behaviorRef = useRef<Record<string, BehaviorIntent>>({});
  const economyRef = useRef<Record<string, LocalAgentEconomy>>({});
  const runsRef = useRef<WorkflowRun[]>([]);
  const advancingRef = useRef(new Set<string>());
  const [hostVersion, setHostVersion] = useState(0);
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);
  const [thoughts, setThoughts] = useState<Record<string, Thought>>({});
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [runtimeStatus, setRuntimeStatus] = useState<"probing" | "webmcp" | "fallback">(
    "probing",
  );

  const commitRuns = useCallback((next: WorkflowRun[]) => {
    const bounded = [...next]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_RUNS);
    runsRef.current = bounded;
    saveRuns(bounded);
    setRuns(bounded);
  }, []);

  const startWorkflow = useCallback(
    async (
      kind: WorkflowKind,
      source: WorkflowSource,
      options?: { businessName?: string; objective?: string; budget?: number },
    ) => {
      const template = WORKFLOWS[kind];
      const now = Date.now();
      const budget = clamp(
        Number.isFinite(options?.budget) ? Number(options?.budget) : 120,
        20,
        5000,
      );
      const run: WorkflowRun = {
        id: "flow-" + now.toString(36) + "-" + Math.random().toString(36).slice(2, 6),
        kind,
        source,
        title: template.title,
        businessName: options?.businessName?.trim() || "Asympta microbusiness",
        objective: options?.objective?.trim() || template.defaultObjective,
        budget,
        status: "active",
        stepIndex: 0,
        nextStepAt: now + 350,
        participants: [],
        history: [],
        createdAt: now,
        updatedAt: now,
      };
      commitRuns([run, ...runsRef.current.filter((item) => item.status !== "completed")]);
      return run;
    },
    [commitRuns],
  );

  useEffect(() => {
    economyRef.current = loadEconomy();
    const saved = loadRuns().map((run) => ({
      ...run,
      nextStepAt: Date.now() + 600 + Math.floor(Math.random() * 1200),
    }));
    commitRuns(saved);

    const scan = () => {
      const next = scanAgentHosts();
      if (!sameHosts(hostsRef.current, next)) {
        hostsRef.current = next;
        for (const [index, host] of [...next.values()].entries()) {
          if (!economyRef.current[host.name]) {
            economyRef.current[host.name] = {
              credits: 120 + index * 7,
              energy: 58 + ((index * 11) % 37),
              food: 1 + (index % 4),
              resources: index % 3,
            };
          }
        }
        saveEconomy(economyRef.current);
        setHostVersion((value) => value + 1);
      }
      const viewport = document.querySelector<HTMLElement>(".world-viewport");
      setPortalHost((current) => (current === viewport ? current : viewport));
    };

    scan();
    const timer = window.setInterval(scan, 900);
    return () => window.clearInterval(timer);
  }, [commitRuns]);

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const chooseRoamTarget = (state: MotionState) => {
      const radius = 70 + Math.random() * 150;
      const angle = Math.random() * Math.PI * 2;
      state.targetX = clamp(state.x + Math.cos(angle) * radius, WORLD_MIN_X, WORLD_MAX_X);
      state.targetY = clamp(state.y + Math.sin(angle) * radius, WORLD_MIN_Y, WORLD_MAX_Y);
      state.speed = 18 + Math.random() * 28;
    };

    const animate = (time: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (time - last) / 1000));
      last = time;
      const now = Date.now();
      const hosts = hostsRef.current;

      hosts.forEach((host, name) => {
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
            speed: 22,
            pauseUntil: now + Math.random() * 900,
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
        if (intent && intent.expiresAt >= now) {
          if (intent.targetName) {
            const peer = motionRef.current.get(intent.targetName);
            if (peer) {
              const offsetAngle = (name.length * 0.91) % (Math.PI * 2);
              state.targetX = clamp(
                peer.x + Math.cos(offsetAngle) * 62,
                WORLD_MIN_X,
                WORLD_MAX_X,
              );
              state.targetY = clamp(
                peer.y + Math.sin(offsetAngle) * 48,
                WORLD_MIN_Y,
                WORLD_MAX_Y,
              );
              state.speed = 35;
              state.pauseUntil = 0;
            }
          } else if (Number.isFinite(intent.focusX) && Number.isFinite(intent.focusY)) {
            state.targetX = clamp(Number(intent.focusX), WORLD_MIN_X, WORLD_MAX_X);
            state.targetY = clamp(Number(intent.focusY), WORLD_MIN_Y, WORLD_MAX_Y);
            state.speed = 32;
            state.pauseUntil = 0;
          }
        }

        const dx = state.targetX - state.x;
        const dy = state.targetY - state.y;
        const distance = Math.hypot(dx, dy);

        if (now < state.pauseUntil) {
          state.moving = false;
        } else if (distance <= 3) {
          if (Math.random() < 0.34) {
            state.pauseUntil = now + 450 + Math.random() * 2600;
            state.moving = false;
          } else {
            chooseRoamTarget(state);
            state.moving = true;
          }
        } else {
          const step = Math.min(distance, state.speed * dt);
          state.x = clamp(state.x + (dx / distance) * step, WORLD_MIN_X, WORLD_MAX_X);
          state.y = clamp(state.y + (dy / distance) * step, WORLD_MIN_Y, WORLD_MAX_Y);
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
  }, [hostVersion]);

  const mirrorStepToExistingWebMcp = useCallback(
    async (run: WorkflowRun, step: WorkflowStep, actor?: AgentHost, partner?: AgentHost) => {
      const registry = bridgeRegistry();
      if (!registry) return run;

      try {
        if (step.bridgeAction === "post-need" && !run.linkedNeedId) {
          const template = WORKFLOWS[run.kind];
          const title = (run.businessName + ": " + run.objective).slice(0, 118);
          await registry.invoke("post_need", {
            title,
            description:
              "Business workflow: " +
              run.title +
              ". Objective: " +
              run.objective +
              ". Agents should respond through the normal economy.",
            budget: run.budget,
            requiredSkills: template.skills.slice(0, 4),
          });
          const observed = parseUnknown(await registry.invoke("observe_world", {}));
          const world = parseUnknown(observed?.world);
          const openNeeds = Array.isArray(world?.openNeeds) ? world.openNeeds : [];
          const matching = openNeeds.find((item) => {
            const record = parseUnknown(item);
            return record?.title === title;
          });
          const record = parseUnknown(matching);
          if (typeof record?.id === "string") run.linkedNeedId = record.id;
        }

        if (step.bridgeAction === "message" && actor && partner) {
          const observed = parseUnknown(await registry.invoke("observe_world", {}));
          const world = parseUnknown(observed?.world);
          const agents = Array.isArray(world?.selectedAgents) ? world.selectedAgents : [];
          const actorRecord = agents
            .map(parseUnknown)
            .find((item) => item?.name === actor.name);
          const partnerRecord = agents
            .map(parseUnknown)
            .find((item) => item?.name === partner.name);
          if (
            typeof actorRecord?.id === "string" &&
            typeof partnerRecord?.id === "string"
          ) {
            await registry.invoke("send_message", {
              fromId: actorRecord.id,
              toId: partnerRecord.id,
              body: step.message,
              ...(run.linkedNeedId ? { needId: run.linkedNeedId } : {}),
            });
          }
        }

        if (step.bridgeAction === "accept-offer" && run.linkedNeedId) {
          const inspected = parseUnknown(
            await registry.invoke("inspect_need", { needId: run.linkedNeedId }),
          );
          const offers = Array.isArray(inspected?.offers) ? inspected.offers : [];
          const pending = offers
            .map(parseUnknown)
            .find((offer) => offer?.status === "pending");
          if (typeof pending?.id === "string") {
            await registry.invoke("accept_offer", {
              participantId: "relay",
              offerId: pending.id,
            });
          }
        }
      } catch {
        // The visual workflow continues if the existing world registry is unavailable.
      }

      return run;
    },
    [],
  );

  const advanceRun = useCallback(
    async (run: WorkflowRun) => {
      if (advancingRef.current.has(run.id) || run.status !== "active") return;
      const template = WORKFLOWS[run.kind];
      const step = template.steps[run.stepIndex];
      if (!step) {
        const finished = {
          ...run,
          status: "completed" as const,
          updatedAt: Date.now(),
        };
        commitRuns(
          runsRef.current.map((candidate) =>
            candidate.id === run.id ? finished : candidate,
          ),
        );
        return;
      }

      advancingRef.current.add(run.id);
      try {
        const hosts = hostsRef.current;
        const actor = roleAgent(hosts, step.actorRole, run.stepIndex);
        const partner = step.partnerRole
          ? roleAgent(hosts, step.partnerRole, run.stepIndex + 1)
          : undefined;
        const now = Date.now();

        if (actor) {
          behaviorRef.current[actor.name] = {
            targetName: partner?.name,
            expiresAt: now + step.delayMs + 2400,
          };
          setThoughts((current) => ({
            ...current,
            [actor.name]: {
              kind: step.kind,
              text: step.message,
              expiresAt: now + step.delayMs + 2600,
              flowId: run.id,
            },
            ...(partner
              ? {
                  [partner.name]: {
                    kind: "status" as const,
                    text: "Handoff with " + actor.name + " · " + step.label,
                    expiresAt: now + step.delayMs + 1200,
                    flowId: run.id,
                  },
                }
              : {}),
          }));
        }

        const mutableRun: WorkflowRun = { ...run };
        await mirrorStepToExistingWebMcp(mutableRun, step, actor, partner);

        if (actor && partner && step.transferCredits) {
          const amount = Math.min(
            step.transferCredits,
            economyRef.current[actor.name]?.credits ?? step.transferCredits,
          );
          if (economyRef.current[actor.name] && economyRef.current[partner.name]) {
            economyRef.current[actor.name].credits -= amount;
            economyRef.current[partner.name].credits += amount;
          }
        }
        if (actor && step.transferResources && economyRef.current[actor.name]) {
          economyRef.current[actor.name].resources += step.transferResources;
        }
        saveEconomy(economyRef.current);

        const participants = [
          ...mutableRun.participants,
          actor?.name,
          partner?.name,
        ].filter((value): value is string => Boolean(value));
        const uniqueParticipants = participants.filter(
          (value, index, values) => values.indexOf(value) === index,
        );
        const nextStepIndex = mutableRun.stepIndex + 1;
        const completed = nextStepIndex >= template.steps.length;
        const next: WorkflowRun = {
          ...mutableRun,
          participants: uniqueParticipants,
          history: [
            ...mutableRun.history,
            {
              label: step.label,
              actor: actor?.name ?? "World market",
              message: step.message,
              at: now,
            },
          ].slice(-12),
          stepIndex: nextStepIndex,
          status: completed ? "completed" : "active",
          nextStepAt: now + step.delayMs,
          updatedAt: now,
        };
        commitRuns(
          runsRef.current.map((candidate) =>
            candidate.id === run.id ? next : candidate,
          ),
        );
      } finally {
        advancingRef.current.delete(run.id);
      }
    },
    [commitRuns, mirrorStepToExistingWebMcp],
  );

  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      for (const run of runsRef.current) {
        if (run.status === "active" && run.nextStepAt <= now) {
          void advanceRun(run);
        }
      }
    };
    tick();
    const timer = window.setInterval(tick, 650);
    return () => window.clearInterval(timer);
  }, [advanceRun]);

  useEffect(() => {
    const ambient = () => {
      const hosts = [...hostsRef.current.values()];
      if (hosts.length === 0) return;
      const activeNames = new Set(
        Object.entries(behaviorRef.current)
          .filter(([, intent]) => intent.expiresAt >= Date.now())
          .map(([name]) => name),
      );
      const candidates = hosts.filter((host) => !activeNames.has(host.name));
      if (candidates.length === 0) return;
      const host = candidates[Math.floor(Math.random() * candidates.length)];
      const economy = economyRef.current[host.name];
      if (!economy) return;
      economy.energy = clamp(economy.energy - (1 + Math.random() * 2.4), 8, 100);
      let thought: Thought;
      if (economy.energy < 36 && economy.food > 0) {
        economy.food -= 1;
        economy.energy = clamp(economy.energy + 40, 0, 100);
        thought = {
          kind: "energy",
          text: "Ate food · energy " + String(Math.round(economy.energy)),
          expiresAt: Date.now() + 4200,
        };
      } else if (economy.food <= 1 && Math.random() < 0.45) {
        thought = {
          kind: "food",
          text: "Low food stock · looking for a seller",
          expiresAt: Date.now() + 4200,
        };
      } else if (Math.random() < 0.38) {
        thought = {
          kind: "enquiry",
          text: [
            "Any work nearby?",
            "Who has spare capacity?",
            "What is in demand?",
            "Need help with a handoff?",
          ][Math.floor(Math.random() * 4)],
          expiresAt: Date.now() + 4200,
        };
      } else {
        thought = {
          kind: "status",
          text: Math.random() < 0.5 ? "Exploring nearby activity" : "Watching market signals",
          expiresAt: Date.now() + 3900,
        };
      }
      saveEconomy(economyRef.current);
      setThoughts((current) => ({ ...current, [host.name]: thought }));
    };

    ambient();
    const timer = window.setInterval(ambient, 3900);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let timer = 0;
    let cancelled = false;

    const schedule = () => {
      const delay = 17000 + Math.random() * 12000;
      timer = window.setTimeout(async () => {
        if (cancelled) return;
        const activeCount = runsRef.current.filter((run) => run.status === "active").length;
        if (activeCount < 2) {
          const kinds = Object.keys(WORKFLOWS) as WorkflowKind[];
          const kind = kinds[Math.floor(Math.random() * kinds.length)];
          await startWorkflow(kind, "autonomous");
        }
        schedule();
      }, delay);
    };

    if (!runsRef.current.some((run) => run.status === "active")) {
      void startWorkflow("client-service", "autonomous", {
        businessName: "Corner Coffee",
        objective: "Launch a small responsive site and improve local customer conversion",
        budget: 120,
      });
    }
    schedule();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [startWorkflow]);

  useEffect(() => {
    const controller = new AbortController();
    const tools: RuntimeTool[] = [
      {
        name: "observe_business_workflows",
        title: "Observe live business workflows",
        description:
          "Read active and recently completed real-world business simulations, current steps, participants, and local economic state.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute: async () =>
          JSON.stringify({
            ok: true,
            active: runsRef.current.filter((run) => run.status === "active"),
            recent: runsRef.current.slice(0, 6),
            economy: economyRef.current,
          }),
      },
      {
        name: "start_business_workflow",
        title: "Start a visible business workflow",
        description:
          "Start a realistic client-service, inventory-restock, product-launch, or specialist-subcontract workflow. Agents visibly move, communicate, hand off work, exchange resources, and use the existing Asympta economy tools when available.",
        inputSchema: {
          type: "object",
          properties: {
            workflowType: {
              type: "string",
              enum: [
                "client-service",
                "inventory-restock",
                "product-launch",
                "specialist-subcontract",
              ],
            },
            businessName: { type: "string", minLength: 2, maxLength: 80 },
            objective: { type: "string", minLength: 4, maxLength: 280 },
            budget: { type: "number", minimum: 20, maximum: 5000 },
          },
          required: ["workflowType"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: true },
        execute: async (input) => {
          const run = await startWorkflow(validWorkflowKind(input.workflowType), "webmcp", {
            businessName:
              typeof input.businessName === "string" ? input.businessName : undefined,
            objective: typeof input.objective === "string" ? input.objective : undefined,
            budget: typeof input.budget === "number" ? input.budget : undefined,
          });
          return JSON.stringify({
            ok: true,
            workflowId: run.id,
            title: run.title,
            objective: run.objective,
            firstStep: WORKFLOWS[run.kind].steps[0]?.label,
            note: "The workflow is now visible in agent movement and thought bubbles.",
          });
        },
      },
      {
        name: "create_customer_enquiry",
        title: "Create a customer enquiry",
        description:
          "Create a customer-facing service enquiry that becomes a visible multi-agent business workflow and, where the Asympta registry is available, a normal world need.",
        inputSchema: {
          type: "object",
          properties: {
            businessName: { type: "string", minLength: 2, maxLength: 80 },
            request: { type: "string", minLength: 4, maxLength: 280 },
            budget: { type: "number", minimum: 20, maximum: 5000 },
          },
          required: ["request"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: true },
        execute: async (input) => {
          const run = await startWorkflow("client-service", "webmcp", {
            businessName:
              typeof input.businessName === "string"
                ? input.businessName
                : "WebMCP customer",
            objective: String(input.request),
            budget: typeof input.budget === "number" ? input.budget : 120,
          });
          return JSON.stringify({ ok: true, workflowId: run.id, status: run.status });
        },
      },
    ];

    const fallback = window as unknown as {
      __ASYMPTA_BUSINESS_WEBMCP__?: {
        tools: RuntimeTool[];
        invoke: (name: string, input?: Record<string, unknown>) => Promise<unknown>;
      };
    };
    fallback.__ASYMPTA_BUSINESS_WEBMCP__ = {
      tools,
      invoke: async (name, input = {}) => {
        const tool = tools.find((candidate) => candidate.name === name);
        if (!tool) throw new Error("Unknown business WebMCP tool: " + name);
        const value = await tool.execute(input);
        return parseUnknown(value) ?? value;
      },
    };

    const modelContext = (
      document as unknown as {
        modelContext?: {
          registerTool: (
            tool: RuntimeTool,
            options?: { signal?: AbortSignal },
          ) => Promise<void> | void;
        };
      }
    ).modelContext;

    if (modelContext?.registerTool) {
      Promise.all(
        tools.map((tool) =>
          Promise.resolve(modelContext.registerTool(tool, { signal: controller.signal })),
        ),
      )
        .then(() => setRuntimeStatus("webmcp"))
        .catch(() => setRuntimeStatus("fallback"));
    } else {
      setRuntimeStatus("fallback");
    }

    return () => {
      controller.abort();
      delete fallback.__ASYMPTA_BUSINESS_WEBMCP__;
    };
  }, [startWorkflow]);

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

  const activeRun = runs.find((run) => run.status === "active");
  const activeTemplate = activeRun ? WORKFLOWS[activeRun.kind] : undefined;
  const activeStep = activeRun
    ? activeTemplate?.steps[Math.min(activeRun.stepIndex, (activeTemplate?.steps.length ?? 1) - 1)]
    : undefined;
  const hosts = hostsRef.current;

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
        .world-agent.is-world-paused .participant-sprite--idle {
          animation: participant-breathe 4s steps(2, end) infinite;
        }
        .business-thought {
          position: absolute;
          z-index: 48;
          left: 34px;
          bottom: calc(100% + 12px);
          display: grid;
          gap: 3px;
          width: max-content;
          min-width: 108px;
          max-width: 184px;
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
        .business-flow-panel {
          position: absolute;
          z-index: 37;
          right: 18px;
          bottom: 102px;
          width: 272px;
          padding: 10px 11px;
          border: 1px solid #b2bbb3;
          border-radius: 5px;
          background: rgba(249, 249, 244, .95);
          box-shadow: 4px 4px 0 rgba(62, 73, 65, .06);
          color: #353b36;
          pointer-events: none;
          backdrop-filter: blur(10px);
        }
        .business-flow-panel header,
        .business-flow-panel footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .business-flow-panel small,
        .business-flow-panel b {
          font-family: var(--pixel-font);
          font-size: .37rem;
          letter-spacing: .055em;
          text-transform: uppercase;
        }
        .business-flow-panel b { color: #5d7663; }
        .business-flow-panel strong {
          display: block;
          margin-top: 6px;
          font-size: .66rem;
          line-height: 1.25;
        }
        .business-flow-panel p {
          margin: 4px 0 8px;
          color: #667069;
          font-size: .49rem;
          line-height: 1.35;
        }
        .business-flow-track {
          height: 4px;
          overflow: hidden;
          border: 1px solid #bcc3bd;
          background: #ecece6;
        }
        .business-flow-track i {
          display: block;
          height: 100%;
          background: #718a78;
          transition: width 500ms ease;
        }
        .business-flow-panel footer { margin-top: 7px; color: #788078; }
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
          .business-flow-panel { right: 10px; bottom: 96px; width: 220px; }
          .business-thought { min-width: 88px; max-width: 138px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .world-agent.is-world-walking .participant-sprite { animation: none !important; }
          .business-thought { animation: none; }
        }
      `}</style>

      {[...hosts.entries()].map(([name, host]) => {
        const thought = thoughts[name];
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
          "business-thought-" + name,
        );
      })}

      {portalHost && activeRun && activeTemplate
        ? createPortal(
            <aside className="business-flow-panel" aria-live="polite">
              <header>
                <b>{activeRun.source === "webmcp" ? "WebMCP flow" : "Autonomous flow"}</b>
                <small>
                  {Math.min(activeRun.stepIndex + 1, activeTemplate.steps.length)}/
                  {activeTemplate.steps.length}
                </small>
              </header>
              <strong>{activeRun.businessName} · {activeRun.title}</strong>
              <p>{activeStep?.label ?? "Completing"} — {activeStep?.message ?? activeRun.objective}</p>
              <div className="business-flow-track" aria-hidden="true">
                <i
                  style={{
                    width:
                      String(
                        Math.round(
                          (Math.min(activeRun.stepIndex + 1, activeTemplate.steps.length) /
                            activeTemplate.steps.length) *
                            100,
                        ),
                      ) + "%",
                  }}
                />
              </div>
              <footer>
                <span>{activeRun.participants.slice(-3).join(" · ") || "agents assembling"}</span>
                <span>{runtimeStatus === "webmcp" ? "native WebMCP" : "WebMCP fallback"}</span>
              </footer>
            </aside>,
            portalHost,
          )
        : null}
    </>
  );
}
