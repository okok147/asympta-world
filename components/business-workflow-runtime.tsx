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

type EconomyEntry = {
  credits: number;
  resources: number;
};

type AgentIdentity = {
  name: string;
  role: string;
};

const RUNS_KEY = "asympta-business-workflows-v3";
const ECONOMY_KEY = "asympta-business-ledger-v3";
const MAX_RUNS = 10;

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

const WORKFLOWS: Record<WorkflowKind, WorkflowTemplate> = {
  "client-service": {
    title: "Client service delivery",
    defaultObjective: "Turn a customer request into a scoped, quoted and delivered service",
    skills: ["product-strategy", "research", "visual-design", "frontend"],
    steps: [
      {
        label: "Customer enquiry",
        actorRole: "product",
        partnerRole: "opportunity",
        kind: "enquiry",
        message: "New customer brief · checking scope, urgency and budget",
        delayMs: 4300,
        bridgeAction: "post-need",
      },
      {
        label: "Discovery",
        actorRole: "research",
        partnerRole: "product",
        kind: "workflow",
        message: "Clarifying audience, constraints and success metric",
        delayMs: 4700,
      },
      {
        label: "Quote",
        actorRole: "visual",
        partnerRole: "product",
        kind: "deal",
        message: "Preparing fixed-scope quote + accountable delivery promise",
        delayMs: 4500,
      },
      {
        label: "Contract",
        actorRole: "product",
        partnerRole: "visual",
        kind: "deal",
        message: "Best valid offer selected · work authorised",
        delayMs: 4200,
        bridgeAction: "accept-offer",
      },
      {
        label: "Production",
        actorRole: "frontend",
        partnerRole: "visual",
        kind: "workflow",
        message: "Design → implementation handoff with shared acceptance criteria",
        delayMs: 5000,
      },
      {
        label: "Quality review",
        actorRole: "quality",
        partnerRole: "frontend",
        kind: "status",
        message: "QA checking responsive flow, edge cases and delivery quality",
        delayMs: 4500,
      },
      {
        label: "Delivery + settlement",
        actorRole: "product",
        partnerRole: "frontend",
        kind: "deal",
        message: "Deliverable accepted · invoice settled · reputation updated",
        delayMs: 3800,
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
        delayMs: 3900,
      },
      {
        label: "Supplier enquiry",
        actorRole: "automation",
        partnerRole: "opportunity",
        kind: "enquiry",
        message: "RFQ sent · asking price, lead time and available quantity",
        delayMs: 4300,
        bridgeAction: "message",
      },
      {
        label: "Price negotiation",
        actorRole: "opportunity",
        partnerRole: "automation",
        kind: "deal",
        message: "Comparing unit economics · negotiating bounded purchase terms",
        delayMs: 4300,
      },
      {
        label: "Purchase order",
        actorRole: "operations",
        partnerRole: "automation",
        kind: "resource",
        message: "PO approved · credits reserved · supplier commits stock",
        delayMs: 4500,
        transferCredits: 14,
      },
      {
        label: "Goods received",
        actorRole: "operations",
        partnerRole: "automation",
        kind: "resource",
        message: "Inventory received +3 · quantity and condition verified",
        delayMs: 4100,
        transferResources: 3,
      },
      {
        label: "Reorder updated",
        actorRole: "data",
        partnerRole: "operations",
        kind: "status",
        message: "Reorder level recalibrated from demand and lead-time evidence",
        delayMs: 3700,
      },
    ],
  },
  "product-launch": {
    title: "Small product launch",
    defaultObjective: "Research, position, design, build, QA and launch a small product",
    skills: ["research", "branding", "visual-design", "frontend"],
    steps: [
      {
        label: "Opportunity brief",
        actorRole: "product",
        partnerRole: "research",
        kind: "enquiry",
        message: "Launch hypothesis formed · requesting evidence before building",
        delayMs: 4100,
        bridgeAction: "post-need",
      },
      {
        label: "Market research",
        actorRole: "research",
        partnerRole: "product",
        kind: "workflow",
        message: "Checking competitors, demand signals and target customer",
        delayMs: 4800,
      },
      {
        label: "Positioning",
        actorRole: "brand",
        partnerRole: "research",
        kind: "skill",
        message: "Turning evidence into positioning and a clear promise",
        delayMs: 4500,
      },
      {
        label: "Visual concept",
        actorRole: "visual",
        partnerRole: "brand",
        kind: "workflow",
        message: "Visual system created from positioning constraints",
        delayMs: 4600,
      },
      {
        label: "Build",
        actorRole: "frontend",
        partnerRole: "visual",
        kind: "workflow",
        message: "Building the launch surface · implementation follows design",
        delayMs: 5000,
      },
      {
        label: "QA",
        actorRole: "quality",
        partnerRole: "frontend",
        kind: "status",
        message: "Testing launch path · blocking defects before release",
        delayMs: 4400,
      },
      {
        label: "Launch decision",
        actorRole: "product",
        partnerRole: "quality",
        kind: "deal",
        message: "Evidence + quality gate passed · launch approved",
        delayMs: 3700,
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
        message: "Required capability is missing · do not pretend the team covers it",
        delayMs: 3800,
        bridgeAction: "post-need",
      },
      {
        label: "Specialist search",
        actorRole: "research",
        partnerRole: "automation",
        kind: "enquiry",
        message: "Searching capability + reputation + available capacity",
        delayMs: 4200,
      },
      {
        label: "Rate negotiation",
        actorRole: "opportunity",
        partnerRole: "automation",
        kind: "deal",
        message: "Negotiating rate, scope boundary and accountable handoff",
        delayMs: 4300,
        bridgeAction: "message",
      },
      {
        label: "Subcontract work",
        actorRole: "automation",
        partnerRole: "opportunity",
        kind: "workflow",
        message: "Specialist executes bounded work · lead remains accountable",
        delayMs: 4900,
      },
      {
        label: "Review",
        actorRole: "quality",
        partnerRole: "automation",
        kind: "status",
        message: "Reviewing output against agreed acceptance criteria",
        delayMs: 4200,
      },
      {
        label: "Payment",
        actorRole: "opportunity",
        partnerRole: "automation",
        kind: "deal",
        message: "Subcontract accepted · specialist paid · relationship strengthened",
        delayMs: 3700,
        bridgeAction: "accept-offer",
        transferCredits: 18,
      },
    ],
  },
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
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

function loadRuns(): WorkflowRun[] {
  try {
    const raw = localStorage.getItem(RUNS_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as WorkflowRun[]).slice(0, MAX_RUNS);
  } catch {
    return [];
  }
}

function saveRuns(runs: WorkflowRun[]) {
  try {
    localStorage.setItem(RUNS_KEY, JSON.stringify(runs.slice(0, MAX_RUNS)));
  } catch {
    // Memory-only fallback is acceptable.
  }
}

function loadEconomy() {
  try {
    const raw = localStorage.getItem(ECONOMY_KEY);
    if (!raw) return {} as Record<string, EconomyEntry>;
    return JSON.parse(raw) as Record<string, EconomyEntry>;
  } catch {
    return {} as Record<string, EconomyEntry>;
  }
}

function saveEconomy(value: Record<string, EconomyEntry>) {
  try {
    localStorage.setItem(ECONOMY_KEY, JSON.stringify(value));
  } catch {
    // Keep values in memory when storage is unavailable.
  }
}

function agentByRole(role: string): AgentIdentity | undefined {
  const phrases = ROLE_MATCH[role] ?? [role];
  const nodes = [...document.querySelectorAll<HTMLButtonElement>(".world-agent")];
  for (const node of nodes) {
    const name = node.querySelector<HTMLElement>(".agent-label strong")?.textContent?.trim();
    const agentRole = node.querySelector<HTMLElement>(".agent-label small")?.textContent?.trim();
    if (
      name &&
      agentRole &&
      phrases.some((phrase) => agentRole.toLowerCase().includes(phrase))
    ) {
      return { name, role: agentRole };
    }
  }
  const fallback = nodes[0];
  const name = fallback
    ?.querySelector<HTMLElement>(".agent-label strong")
    ?.textContent?.trim();
  const agentRole = fallback
    ?.querySelector<HTMLElement>(".agent-label small")
    ?.textContent?.trim();
  return name && agentRole ? { name, role: agentRole } : undefined;
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

function emitBehavior(
  actor: AgentIdentity | undefined,
  partner: AgentIdentity | undefined,
  step: WorkflowStep,
) {
  window.dispatchEvent(
    new CustomEvent("asympta:agent-behavior", {
      detail: {
        actorName: actor?.name,
        actorRole: step.actorRole,
        partnerName: partner?.name,
        partnerRole: step.partnerRole,
        kind: step.kind,
        message: step.message,
        partnerMessage: actor
          ? step.label + " handoff with " + actor.name
          : step.label,
        durationMs: step.delayMs + 1800,
      },
    }),
  );
}

export function BusinessWorkflowRuntime() {
  const runsRef = useRef<WorkflowRun[]>([]);
  const economyRef = useRef<Record<string, EconomyEntry>>({});
  const advancingRef = useRef(new Set<string>());
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);
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
      const run: WorkflowRun = {
        id: "flow-" + now.toString(36) + "-" + Math.random().toString(36).slice(2, 6),
        kind,
        source,
        title: template.title,
        businessName: options?.businessName?.trim() || "Asympta microbusiness",
        objective: options?.objective?.trim() || template.defaultObjective,
        budget: clamp(
          Number.isFinite(options?.budget) ? Number(options?.budget) : 120,
          20,
          5000,
        ),
        status: "active",
        stepIndex: 0,
        nextStepAt: now + 400,
        participants: [],
        history: [],
        createdAt: now,
        updatedAt: now,
      };
      commitRuns([run, ...runsRef.current]);
      return run;
    },
    [commitRuns],
  );

  useEffect(() => {
    const initialize = window.setTimeout(() => {
      economyRef.current = loadEconomy();
      const saved = loadRuns().map((run) => ({
        ...run,
        nextStepAt: Date.now() + 700 + Math.floor(Math.random() * 900),
      }));
      commitRuns(saved);
      setPortalHost(document.querySelector<HTMLElement>(".world-viewport"));
    }, 0);
    return () => window.clearTimeout(initialize);
  }, [commitRuns]);

  const mirrorStepToExistingWorld = useCallback(
    async (
      run: WorkflowRun,
      step: WorkflowStep,
      actor: AgentIdentity | undefined,
      partner: AgentIdentity | undefined,
    ) => {
      const registry = bridgeRegistry();
      if (!registry) return;

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
            .map((item) => parseUnknown(item))
            .find((item) => item?.name === actor.name);
          const partnerRecord = agents
            .map((item) => parseUnknown(item))
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
            .map((item) => parseUnknown(item))
            .find((offer) => offer?.status === "pending");
          if (typeof pending?.id === "string") {
            await registry.invoke("accept_offer", {
              participantId: "relay",
              offerId: pending.id,
            });
          }
        }
      } catch {
        // A workflow remains visible even if the existing registry is unavailable.
      }
    },
    [],
  );

  const advanceRun = useCallback(
    async (run: WorkflowRun) => {
      if (run.status !== "active" || advancingRef.current.has(run.id)) return;
      const template = WORKFLOWS[run.kind];
      const step = template.steps[run.stepIndex];
      if (!step) return;
      advancingRef.current.add(run.id);

      try {
        const actor = agentByRole(step.actorRole);
        const partner = step.partnerRole ? agentByRole(step.partnerRole) : undefined;
        const now = Date.now();
        emitBehavior(actor, partner, step);
        const mutableRun = { ...run };
        await mirrorStepToExistingWorld(mutableRun, step, actor, partner);

        if (actor && !economyRef.current[actor.name]) {
          economyRef.current[actor.name] = { credits: 160, resources: 1 };
        }
        if (partner && !economyRef.current[partner.name]) {
          economyRef.current[partner.name] = { credits: 160, resources: 1 };
        }
        if (actor && partner && step.transferCredits) {
          const amount = Math.min(
            step.transferCredits,
            economyRef.current[actor.name]?.credits ?? step.transferCredits,
          );
          economyRef.current[actor.name].credits -= amount;
          economyRef.current[partner.name].credits += amount;
        }
        if (actor && step.transferResources) {
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
        const nextStep = mutableRun.stepIndex + 1;
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
          stepIndex: nextStep,
          status: nextStep >= template.steps.length ? "completed" : "active",
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
    [commitRuns, mirrorStepToExistingWorld],
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      for (const run of runsRef.current) {
        if (run.status === "active" && run.nextStepAt <= now) {
          void advanceRun(run);
        }
      }
    }, 650);
    return () => window.clearInterval(timer);
  }, [advanceRun]);

  useEffect(() => {
    let timer = 0;
    let cancelled = false;
    const schedule = () => {
      timer = window.setTimeout(() => {
        if (cancelled) return;
        const activeCount = runsRef.current.filter((run) => run.status === "active").length;
        if (activeCount < 2) {
          const kinds = Object.keys(WORKFLOWS) as WorkflowKind[];
          const kind = kinds[Math.floor(Math.random() * kinds.length)];
          void startWorkflow(kind, "autonomous");
        }
        schedule();
      }, 18000 + Math.random() * 12000);
    };

    const bootstrap = window.setTimeout(() => {
      if (!runsRef.current.some((run) => run.status === "active")) {
        void startWorkflow("client-service", "autonomous", {
          businessName: "Corner Coffee",
          objective: "Launch a responsive local site and improve customer conversion",
          budget: 120,
        });
      }
      schedule();
    }, 1100);

    return () => {
      cancelled = true;
      window.clearTimeout(bootstrap);
      if (timer) window.clearTimeout(timer);
    };
  }, [startWorkflow]);

  useEffect(() => {
    const controller = new AbortController();
    const tools: RuntimeTool[] = [
      {
        name: "observe_business_workflows",
        title: "Observe live business workflows",
        description:
          "Read active and recent business workflows, their steps, participants, history and local resource ledger.",
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
            ledger: economyRef.current,
          }),
      },
      {
        name: "start_business_workflow",
        title: "Start a visible business workflow",
        description:
          "Start a client-service, inventory-restock, product-launch, or specialist-subcontract workflow. Agents visibly move, communicate, hand off work, exchange resources and reuse the normal Asympta economy tools when available.",
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
            note: "The workflow is visible in agent movement and dialogue.",
          });
        },
      },
      {
        name: "create_customer_enquiry",
        title: "Create a customer enquiry",
        description:
          "Create a customer service enquiry that becomes a visible multi-agent workflow and a normal Asympta world need when the existing registry is available.",
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
      window.setTimeout(() => setRuntimeStatus("fallback"), 0);
    }

    return () => {
      controller.abort();
      delete fallback.__ASYMPTA_BUSINESS_WEBMCP__;
    };
  }, [startWorkflow]);

  const activeRun = runs.find((run) => run.status === "active");
  const activeTemplate = activeRun ? WORKFLOWS[activeRun.kind] : undefined;
  const visibleIndex = activeRun && activeTemplate
    ? Math.min(activeRun.stepIndex, activeTemplate.steps.length - 1)
    : 0;
  const activeStep = activeTemplate?.steps[visibleIndex];

  if (!portalHost || !activeRun || !activeTemplate) return null;

  return createPortal(
    <>
      <style>{`
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
        @media (max-width: 720px) {
          .business-flow-panel { right: 10px; bottom: 96px; width: 220px; }
        }
      `}</style>
      <aside className="business-flow-panel" aria-live="polite">
        <header>
          <b>{activeRun.source === "webmcp" ? "WebMCP flow" : "Autonomous flow"}</b>
          <small>
            {Math.min(activeRun.stepIndex + 1, activeTemplate.steps.length)}/
            {activeTemplate.steps.length}
          </small>
        </header>
        <strong>{activeRun.businessName} · {activeRun.title}</strong>
        <p>
          {activeStep?.label ?? "Completing"} — {activeStep?.message ?? activeRun.objective}
        </p>
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
      </aside>
    </>,
    portalHost,
  );
}
