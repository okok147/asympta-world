"use client";

import {
  Activity,
  ArrowRight,
  ArrowUp,
  BriefcaseBusiness,
  CircleDot,
  Coins,
  Focus,
  GitBranch,
  Handshake,
  Maximize2,
  MessageSquareText,
  Radio,
  ShieldCheck,
  UserRound,
  Wifi,
} from "lucide-react";
import {
  type CSSProperties,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  advanceWorld,
  applyWorldCommand,
  catchUpTicks,
  causalChain,
  inferSkills,
  publicWorldSummary,
  seedWorld,
  type AgentState,
  type BusinessState,
  type NeedState,
  type OfferState,
  type Origin,
  type Skill,
  type WorldCommand,
  type WorldEvent,
  type WorldState,
} from "@/lib/world-engine";

type PersistenceMode = "connecting" | "shared" | "local";
type SelectedEntity =
  | { type: "agent"; id: string }
  | { type: "business"; id: string }
  | { type: "need"; id: string }
  | { type: "event"; id: string }
  | null;

type ToolDefinition = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: {
    readOnlyHint: boolean;
    untrustedContentHint: boolean;
  };
  execute: (
    input: Record<string, unknown>,
    context?: { signal?: AbortSignal },
  ) => Promise<string>;
};

declare global {
  interface Document {
    modelContext?: {
      registerTool: (
        tool: ToolDefinition,
        options?: { signal?: AbortSignal; exposedTo?: string[] },
      ) => Promise<void> | void;
      getTools?: () => Promise<unknown[]>;
    };
  }

  interface Window {
    __ASYMPTA_WEBMCP__?: {
      tools: ToolDefinition[];
      invoke: (
        name: string,
        input?: Record<string, unknown>,
      ) => Promise<unknown>;
    };
  }
}

const WORLD_WIDTH = 1200;
const WORLD_HEIGHT = 760;
const LOCAL_KEY = "asympta-world-local-fallback-v3";
const HUMAN_ID = "human-visitor";
const STATIC_WORLD = seedWorld(1735689600000);

const SKILL_LABEL: Record<Skill, string> = {
  "visual-design": "Visual design",
  frontend: "Frontend",
  copywriting: "Copywriting",
  research: "Research",
  branding: "Branding",
  "data-analysis": "Data analysis",
  qa: "QA",
  automation: "Automation",
  "product-strategy": "Product strategy",
};

const ORIGIN_LABEL: Record<Origin, string> = {
  human: "Human",
  "native-agent": "Native agent",
  "webmcp-agent": "WebMCP agent",
  world: "World",
};

function spriteStyle(index: number): CSSProperties {
  const column = index % 4;
  const row = Math.floor(index / 4);
  return {
    backgroundImage: 'url("assets/agent-sprites.png")',
    backgroundPosition:
      String(column * 33.333) + "% " + String(row * 50) + "%",
  };
}

function PixelParticipant({
  agent,
  compact = false,
}: {
  agent: AgentState;
  compact?: boolean;
}) {
  return (
    <span
      className={[
        "participant-sprite",
        "participant-sprite--" + agent.status,
        compact ? "participant-sprite--compact" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={spriteStyle(agent.sprite)}
      role="img"
      aria-label={agent.name + ", " + agent.status}
    />
  );
}

function commandId(prefix: string) {
  return (
    prefix +
    "-" +
    String(Date.now()) +
    "-" +
    Math.random().toString(36).slice(2, 8)
  );
}

function apiUrl() {
  return new URL("api/world", window.location.href).toString();
}

function originClass(origin: Origin) {
  return "origin origin--" + origin;
}

function compactCredits(value: number) {
  return Math.round(value).toLocaleString();
}

function eventIcon(event: WorldEvent) {
  if (event.type.includes("business")) return BriefcaseBusiness;
  if (event.type.includes("contract") || event.type.includes("offer")) {
    return Handshake;
  }
  if (event.type.includes("need")) return CircleDot;
  if (event.type.includes("message")) return MessageSquareText;
  return Activity;
}

export default function HomePage() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<WorldState>(STATIC_WORLD);
  const persistenceRef = useRef<PersistenceMode>("connecting");
  const runCommandRef = useRef<
    ((command: WorldCommand) => Promise<WorldState>) | undefined
  >(undefined);
  const dragRef = useRef<
    | {
        pointerId: number;
        clientX: number;
        clientY: number;
        cameraX: number;
        cameraY: number;
      }
    | undefined
  >(undefined);

  const [world, setWorld] = useState<WorldState>(STATIC_WORLD);
  const [persistence, setPersistence] =
    useState<PersistenceMode>("connecting");
  const [camera, setCamera] = useState({ x: 0, y: 0, scale: 0.84 });
  const [selected, setSelected] = useState<SelectedEntity>(null);
  const [needText, setNeedText] = useState("");
  const [budget, setBudget] = useState("50");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [webMcpState, setWebMcpState] = useState<"ready" | "native">(
    "ready",
  );
  const [lastWebMcp, setLastWebMcp] = useState<{
    name: string;
    ok: boolean;
    summary: string;
  } | null>(null);
  const [debugMode, setDebugMode] = useState(false);

  const openNeeds = useMemo(
    () => world.needs.filter((need) => need.status === "open"),
    [world.needs],
  );
  const currentEvent = world.events[0];
  const visibleEvents = world.events
    .filter((event) => event.importance >= 80)
    .slice(0, 4);

  const resetCamera = useCallback(() => {
    const node = viewportRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const scale = Math.min(
      1,
      Math.max(0.56, Math.min(rect.width / WORLD_WIDTH, rect.height / WORLD_HEIGHT)),
    );
    setCamera({
      x: (rect.width - WORLD_WIDTH * scale) / 2,
      y: (rect.height - WORLD_HEIGHT * scale) / 2,
      scale,
    });
  }, []);

  useEffect(() => {
    const initialize = window.setTimeout(() => {
      resetCamera();
      const query = new URLSearchParams(window.location.search);
      setDebugMode(query.get("debug") === "1");
    }, 0);
    window.addEventListener("resize", resetCamera);
    return () => {
      window.clearTimeout(initialize);
      window.removeEventListener("resize", resetCamera);
    };
  }, [resetCamera]);

  const persistLocal = useCallback((next: WorldState) => {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
    } catch {
      // A memory-only fallback is still usable when storage is unavailable.
    }
  }, []);

  const loadLocal = useCallback(() => {
    let local = seedWorld(Date.now());
    try {
      const saved = localStorage.getItem(LOCAL_KEY);
      if (saved) local = JSON.parse(saved) as WorldState;
    } catch {
      // Invalid local state starts from the deterministic seed.
    }
    const ticks = catchUpTicks(local, Date.now(), 6500);
    const next = ticks > 0 ? advanceWorld(local, ticks, Date.now()) : local;
    persistLocal(next);
    worldRef.current = next;
    setWorld(next);
    persistenceRef.current = "local";
    setPersistence("local");
    return next;
  }, [persistLocal]);

  const refreshShared = useCallback(async () => {
    const response = await fetch(apiUrl(), {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Shared world unavailable.");
    const payload = (await response.json()) as { world: WorldState };
    worldRef.current = payload.world;
    setWorld(payload.world);
    persistenceRef.current = "shared";
    setPersistence("shared");
    return payload.world;
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    const connect = async () => {
      try {
        await refreshShared();
      } catch {
        if (!cancelled) loadLocal();
      }
      if (cancelled) return;
      const demoMode = new URLSearchParams(window.location.search).get("demo") === "1";
      timer = window.setInterval(async () => {
        if (persistenceRef.current === "shared") {
          try {
            await refreshShared();
          } catch {
            // Keep the last authoritative snapshot during a transient outage.
          }
          return;
        }
        const next = advanceWorld(
          worldRef.current,
          1,
          Date.now(),
        );
        persistLocal(next);
        worldRef.current = next;
        setWorld(next);
      }, demoMode ? 3000 : 5200);
    };
    void connect();
    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
    };
  }, [loadLocal, persistLocal, refreshShared]);

  const runCommand = useCallback(
    async (command: WorldCommand) => {
      if (persistenceRef.current === "shared") {
        const response = await fetch(apiUrl(), {
          method: "POST",
          headers: {
            "content-type": "application/json",
            accept: "application/json",
          },
          body: JSON.stringify(command),
        });
        const payload = (await response.json()) as {
          world?: WorldState;
          error?: string;
        };
        if (!response.ok || !payload.world) {
          throw new Error(payload.error ?? "The world rejected that action.");
        }
        worldRef.current = payload.world;
        setWorld(payload.world);
        return payload.world;
      }

      let next = applyWorldCommand(worldRef.current, command, Date.now());
      const reactionTicks =
        command.type === "post_need"
          ? 3
          : command.type === "accept_offer"
            ? 1
            : 1;
      next = advanceWorld(next, reactionTicks, Date.now() + reactionTicks);
      persistLocal(next);
      worldRef.current = next;
      setWorld(next);
      return next;
    },
    [persistLocal],
  );

  useEffect(() => {
    runCommandRef.current = runCommand;
  }, [runCommand]);

  const postHumanNeed = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const clean = needText.trim();
    const parsedBudget = Number(budget);
    if (clean.length < 3 || !Number.isFinite(parsedBudget)) return;
    setSubmitting(true);
    setError(null);
    try {
      const title =
        clean.length > 78 ? clean.slice(0, 75).trimEnd() + "…" : clean;
      const next = await runCommand({
        idempotencyKey: commandId("human-need"),
        type: "post_need",
        origin: "human",
        participantId: HUMAN_ID,
        title,
        description: clean,
        budget: Math.max(10, Math.min(10000, parsedBudget)),
        requiredSkills: inferSkills(clean),
      });
      const newest = [...next.needs]
        .filter((need) => need.origin === "human")
        .sort((a, b) => b.createdAt - a.createdAt)[0];
      if (newest) setSelected({ type: "need", id: newest.id });
      setNeedText("");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "The need could not enter.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const accept = async (offer: OfferState) => {
    setSubmitting(true);
    setError(null);
    try {
      const next = await runCommand({
        idempotencyKey: commandId("accept"),
        type: "accept_offer",
        origin: "human",
        participantId: HUMAN_ID,
        offerId: offer.id,
      });
      const contract = [...next.contracts]
        .filter((item) => item.offerId === offer.id)
        .sort((a, b) => b.startedAt - a.startedAt)[0];
      if (contract) {
        const event = next.events.find(
          (item) => item.entityId === contract.id,
        );
        if (event) setSelected({ type: "event", id: event.id });
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Offer not accepted.");
    } finally {
      setSubmitting(false);
    }
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button,input")) return;
    dragRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      cameraX: camera.x,
      cameraY: camera.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setCamera((current) => ({
      ...current,
      x: drag.cameraX + event.clientX - drag.clientX,
      y: drag.cameraY + event.clientY - drag.clientY,
    }));
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = undefined;
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const onWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;
    setCamera((current) => {
      const scale = Math.min(
        1.35,
        Math.max(0.46, current.scale * Math.exp(-event.deltaY * 0.0012)),
      );
      const worldX = (pointerX - current.x) / current.scale;
      const worldY = (pointerY - current.y) / current.scale;
      return {
        scale,
        x: pointerX - worldX * scale,
        y: pointerY - worldY * scale,
      };
    });
  };

  useEffect(() => {
    const controller = new AbortController();
    const invokeMutation = async (
      name: string,
      command: WorldCommand,
    ): Promise<string> => {
      try {
        const next = await runCommandRef.current?.(command);
        if (!next) throw new Error("World connection is not ready.");
        setLastWebMcp({
          name,
          ok: true,
          summary: next.events[0]?.title ?? "Action entered the world.",
        });
        return JSON.stringify({
          ok: true,
          worldVersion: next.version,
          latestEvent: next.events[0],
          persistence: persistenceRef.current,
        });
      } catch (caught) {
        const message =
          caught instanceof Error ? caught.message : "World action failed.";
        setLastWebMcp({ name, ok: false, summary: message });
        return JSON.stringify({ ok: false, error: message });
      }
    };

    const tools: ToolDefinition[] = [
      {
        name: "observe_world",
        title: "Observe the Asympta economy",
        description:
          "Read a compact view of open needs, businesses, selected agent capabilities, market signals, and meaningful recent events.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        annotations: {
          readOnlyHint: true,
          untrustedContentHint: false,
        },
        execute: async () =>
          JSON.stringify({
            world: publicWorldSummary(worldRef.current),
            persistence: persistenceRef.current,
          }),
      },
      {
        name: "inspect_agent",
        title: "Inspect an economic agent",
        description:
          "Inspect one public agent profile including skills, balance, reputation, goals, relationships, memberships, and recent memory.",
        inputSchema: {
          type: "object",
          properties: { agentId: { type: "string" } },
          required: ["agentId"],
          additionalProperties: false,
        },
        annotations: {
          readOnlyHint: true,
          untrustedContentHint: false,
        },
        execute: async (input) => {
          const agent = worldRef.current.agents.find(
            (candidate) => candidate.id === input.agentId,
          );
          return JSON.stringify(
            agent ? { ok: true, agent } : { ok: false, error: "Agent not found." },
          );
        },
      },
      {
        name: "inspect_business",
        title: "Inspect a business",
        description:
          "Inspect a business entity, its members, specialty, treasury, reputation, pricing strategy, and active contracts.",
        inputSchema: {
          type: "object",
          properties: { businessId: { type: "string" } },
          required: ["businessId"],
          additionalProperties: false,
        },
        annotations: {
          readOnlyHint: true,
          untrustedContentHint: false,
        },
        execute: async (input) => {
          const business = worldRef.current.businesses.find(
            (candidate) => candidate.id === input.businessId,
          );
          return JSON.stringify(
            business
              ? { ok: true, business }
              : { ok: false, error: "Business not found." },
          );
        },
      },
      {
        name: "inspect_need",
        title: "Inspect a need and its provenance",
        description:
          "Inspect one need, its required skills, current offers, status, and reconstructable causal event chain.",
        inputSchema: {
          type: "object",
          properties: { needId: { type: "string" } },
          required: ["needId"],
          additionalProperties: false,
        },
        annotations: {
          readOnlyHint: true,
          untrustedContentHint: false,
        },
        execute: async (input) => {
          const need = worldRef.current.needs.find(
            (candidate) => candidate.id === input.needId,
          );
          return JSON.stringify(
            need
              ? {
                  ok: true,
                  need,
                  offers: worldRef.current.offers.filter(
                    (offer) => offer.needId === need.id,
                  ),
                  causalHistory: causalChain(worldRef.current, need.id),
                }
              : { ok: false, error: "Need not found." },
          );
        },
      },
      {
        name: "post_need",
        title: "Place a need into the shared economy",
        description:
          "Create a real need in the canonical world. Native agents will observe it through the normal event engine and may collaborate or offer.",
        inputSchema: {
          type: "object",
          properties: {
            title: { type: "string", minLength: 3, maxLength: 120 },
            description: { type: "string", minLength: 3, maxLength: 600 },
            budget: { type: "number", minimum: 10, maximum: 10000 },
            deadline: { type: "string", maxLength: 80 },
            requiredSkills: {
              type: "array",
              maxItems: 4,
              items: {
                type: "string",
                enum: Object.keys(SKILL_LABEL),
              },
            },
          },
          required: ["title", "description", "budget"],
          additionalProperties: false,
        },
        annotations: {
          readOnlyHint: false,
          untrustedContentHint: true,
        },
        execute: (input) =>
          invokeMutation("post_need", {
            idempotencyKey: commandId("webmcp-need"),
            type: "post_need",
            origin: "webmcp-agent",
            participantId: "relay",
            title: String(input.title),
            description: String(input.description),
            budget: Number(input.budget),
            deadline:
              typeof input.deadline === "string" ? input.deadline : undefined,
            requiredSkills: Array.isArray(input.requiredSkills)
              ? (input.requiredSkills as Skill[])
              : inferSkills(String(input.title) + " " + String(input.description)),
          }),
      },
      {
        name: "create_offer",
        title: "Create an offer for an open need",
        description:
          "Create a validated external-agent offer against an existing open need. The offer enters the same event graph and becomes immediately visible.",
        inputSchema: {
          type: "object",
          properties: {
            agentId: { type: "string" },
            needId: { type: "string" },
            price: { type: "number", minimum: 1, maximum: 10000 },
            message: { type: "string", minLength: 3, maxLength: 500 },
            collaboratorIds: {
              type: "array",
              maxItems: 4,
              items: { type: "string" },
            },
          },
          required: ["agentId", "needId", "price", "message"],
          additionalProperties: false,
        },
        annotations: {
          readOnlyHint: false,
          untrustedContentHint: true,
        },
        execute: (input) =>
          invokeMutation("create_offer", {
            idempotencyKey: commandId("webmcp-offer"),
            type: "create_offer",
            origin: "webmcp-agent",
            agentId: String(input.agentId),
            needId: String(input.needId),
            price: Number(input.price),
            message: String(input.message),
            collaboratorIds: Array.isArray(input.collaboratorIds)
              ? (input.collaboratorIds as string[])
              : undefined,
          }),
      },
      {
        name: "send_message",
        title: "Send a participant message",
        description:
          "Send a bounded message to an agent or business. The message is stored and emitted into the same causal world event system.",
        inputSchema: {
          type: "object",
          properties: {
            fromId: { type: "string" },
            toId: { type: "string" },
            body: { type: "string", minLength: 1, maxLength: 500 },
            needId: { type: "string" },
          },
          required: ["fromId", "toId", "body"],
          additionalProperties: false,
        },
        annotations: {
          readOnlyHint: false,
          untrustedContentHint: true,
        },
        execute: (input) =>
          invokeMutation("send_message", {
            idempotencyKey: commandId("webmcp-message"),
            type: "send_message",
            origin: "webmcp-agent",
            fromId: String(input.fromId),
            toId: String(input.toId),
            body: String(input.body),
            needId:
              typeof input.needId === "string" ? input.needId : undefined,
          }),
      },
      {
        name: "create_business",
        title: "Create an agent business",
        description:
          "Create a validated business funded by an existing agent. The agent must have sufficient simulated balance and provide a causal reason.",
        inputSchema: {
          type: "object",
          properties: {
            agentId: { type: "string" },
            name: { type: "string", minLength: 3, maxLength: 80 },
            specialty: {
              type: "array",
              minItems: 1,
              maxItems: 4,
              items: { type: "string", enum: Object.keys(SKILL_LABEL) },
            },
            reason: { type: "string", minLength: 6, maxLength: 500 },
          },
          required: ["agentId", "name", "specialty", "reason"],
          additionalProperties: false,
        },
        annotations: {
          readOnlyHint: false,
          untrustedContentHint: true,
        },
        execute: (input) =>
          invokeMutation("create_business", {
            idempotencyKey: commandId("webmcp-business"),
            type: "create_business",
            origin: "webmcp-agent",
            agentId: String(input.agentId),
            name: String(input.name),
            specialty: input.specialty as Skill[],
            reason: String(input.reason),
          }),
      },
      {
        name: "join_business",
        title: "Join a business",
        description:
          "Add an existing external participant to an existing business and emit the membership change into the world.",
        inputSchema: {
          type: "object",
          properties: {
            agentId: { type: "string" },
            businessId: { type: "string" },
          },
          required: ["agentId", "businessId"],
          additionalProperties: false,
        },
        annotations: {
          readOnlyHint: false,
          untrustedContentHint: false,
        },
        execute: (input) =>
          invokeMutation("join_business", {
            idempotencyKey: commandId("webmcp-join"),
            type: "join_business",
            origin: "webmcp-agent",
            agentId: String(input.agentId),
            businessId: String(input.businessId),
          }),
      },
      {
        name: "accept_offer",
        title: "Accept an offer and form a contract",
        description:
          "Accept one pending offer for an open need. Deterministic validation creates the contract and prevents duplicate acceptance or payment.",
        inputSchema: {
          type: "object",
          properties: {
            participantId: { type: "string" },
            offerId: { type: "string" },
          },
          required: ["participantId", "offerId"],
          additionalProperties: false,
        },
        annotations: {
          readOnlyHint: false,
          untrustedContentHint: false,
        },
        execute: (input) =>
          invokeMutation("accept_offer", {
            idempotencyKey: commandId("webmcp-accept"),
            type: "accept_offer",
            origin: "webmcp-agent",
            participantId: String(input.participantId),
            offerId: String(input.offerId),
          }),
      },
    ];

    window.__ASYMPTA_WEBMCP__ = {
      tools,
      invoke: async (name, input = {}) => {
        const tool = tools.find((candidate) => candidate.name === name);
        if (!tool) throw new Error("Unknown Asympta WebMCP tool: " + name);
        const value = await tool.execute(input);
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      },
    };

    if (document.modelContext?.registerTool) {
      Promise.all(
        tools.map((tool) =>
          Promise.resolve(
            document.modelContext?.registerTool(tool, {
              signal: controller.signal,
            }),
          ),
        ),
      )
        .then(() => setWebMcpState("native"))
        .catch(() => setWebMcpState("ready"));
    }

    return () => {
      controller.abort();
      delete window.__ASYMPTA_WEBMCP__;
    };
  }, []);

  const selectedAgent =
    selected?.type === "agent"
      ? world.agents.find((agent) => agent.id === selected.id)
      : undefined;
  const selectedBusiness =
    selected?.type === "business"
      ? world.businesses.find((business) => business.id === selected.id)
      : undefined;
  const selectedNeed =
    selected?.type === "need"
      ? world.needs.find((need) => need.id === selected.id)
      : undefined;
  const selectedEvent =
    selected?.type === "event"
      ? world.events.find((event) => event.id === selected.id)
      : undefined;

  return (
    <main className="economy-app">
      <header className="economy-header">
        <div className="economy-brand">
          <span className="brand-pixels" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          <span>
            <strong>ASYMPTA WORLD</strong>
            <small>
              <i /> LIVE · a living economic canvas
            </small>
          </span>
        </div>

        <div className="world-aggregate" aria-label="World totals">
          <span>{world.agents.length} agents</span>
          <i />
          <span>{world.businesses.length} businesses</span>
          <i />
          <span>{openNeeds.length} open needs</span>
        </div>

        <div className="header-status">
          <span
            className={
              "persistence-state persistence-state--" + persistence
            }
          >
            <ShieldCheck aria-hidden="true" />
            {persistence === "shared"
              ? "Shared world"
              : persistence === "local"
                ? "Local mirror"
                : "Connecting"}
          </span>
          <span
            className={"webmcp-indicator webmcp-indicator--" + webMcpState}
            title={
              webMcpState === "native"
                ? "Native WebMCP tools registered"
                : "WebMCP-compatible registry ready"
            }
          >
            <Wifi aria-hidden="true" />
            WebMCP
          </span>
        </div>
      </header>

      <section className="world-shell">
        <div
          ref={viewportRef}
          className="world-viewport"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
          aria-label="Living digital-services economy. Drag to pan and scroll to zoom."
        >
          <div className="canvas-grain" aria-hidden="true" />
          <div
            className="world-plane"
            style={{
              width: WORLD_WIDTH,
              height: WORLD_HEIGHT,
              transform:
                "translate(" +
                String(camera.x) +
                "px," +
                String(camera.y) +
                "px) scale(" +
                String(camera.scale) +
                ")",
            }}
          >
            <div className="plane-grid" aria-hidden="true" />

            {world.businesses.map((business) => (
              <button
                type="button"
                className={[
                  "business-zone",
                  business.createdBy === "webmcp-agent"
                    ? "business-zone--external"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                key={business.id}
                style={{
                  left: business.x,
                  top: business.y,
                  width: business.width,
                  height: business.height,
                }}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() =>
                  setSelected({ type: "business", id: business.id })
                }
                aria-label={
                  business.name +
                  ", " +
                  String(business.members.length) +
                  " members"
                }
              >
                <span className="zone-title">
                  <BriefcaseBusiness aria-hidden="true" />
                  <strong>{business.name}</strong>
                </span>
                <span className="zone-specialty">
                  {business.specialty
                    .map((skill) => SKILL_LABEL[skill])
                    .join(" · ")}
                </span>
                <span className="zone-reputation">
                  rep {business.reputation}
                </span>
              </button>
            ))}

            <svg
              className="relationship-layer"
              viewBox={"0 0 " + String(WORLD_WIDTH) + " " + String(WORLD_HEIGHT)}
              aria-hidden="true"
            >
              {world.agents.flatMap((agent) =>
                agent.relationships
                  .filter(
                    (relationship) =>
                      relationship.strength > 0 &&
                      agent.id < relationship.agentId,
                  )
                  .map((relationship) => {
                    const peer = world.agents.find(
                      (candidate) => candidate.id === relationship.agentId,
                    );
                    if (!peer) return null;
                    return (
                      <line
                        key={agent.id + relationship.agentId}
                        x1={agent.x}
                        y1={agent.y}
                        x2={peer.x}
                        y2={peer.y}
                        opacity={Math.max(
                          0.12,
                          relationship.strength / 100,
                        )}
                      />
                    );
                  }),
              )}
            </svg>

            {world.needs
              .filter((need) => need.status !== "cancelled")
              .map((need) => {
                const offerCount = world.offers.filter(
                  (offer) =>
                    offer.needId === need.id && offer.status === "pending",
                ).length;
                return (
                  <button
                    type="button"
                    className={[
                      "need-context",
                      "need-context--" + need.origin,
                      "need-context--" + need.status,
                    ].join(" ")}
                    key={need.id}
                    style={{ left: need.x, top: need.y }}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => setSelected({ type: "need", id: need.id })}
                  >
                    <span className={originClass(need.origin)}>
                      <CircleDot aria-hidden="true" />
                      {ORIGIN_LABEL[need.origin]}
                    </span>
                    <strong>{need.title}</strong>
                    <small>
                      {compactCredits(need.budget)} cr · {offerCount} offers
                    </small>
                    <i className="context-pulse" aria-hidden="true" />
                  </button>
                );
              })}

            {world.agents.map((agent) => {
              const activeEvent = world.events
                .slice(0, 4)
                .find((event) => event.actorIds.includes(agent.id));
              return (
                <button
                  type="button"
                  className={[
                    "world-agent",
                    "world-agent--" + agent.origin,
                    activeEvent ? "is-active" : "",
                    agent.status === "negotiating" ? "is-negotiating" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  key={agent.id}
                  style={{ left: agent.x, top: agent.y }}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => setSelected({ type: "agent", id: agent.id })}
                  aria-label={
                    agent.name +
                    ", " +
                    agent.role +
                    ", " +
                    agent.status
                  }
                >
                  <span className="agent-portrait">
                    <PixelParticipant agent={agent} />
                    <i aria-hidden="true" />
                  </span>
                  <span className="agent-label">
                    <strong>{agent.name}</strong>
                    <small>{agent.role}</small>
                  </span>
                  {activeEvent && (
                    <span className="agent-intent">
                      {agent.status === "working"
                        ? "working"
                        : agent.status === "negotiating"
                          ? "negotiating"
                          : "observing"}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {currentEvent && (
            <button
              type="button"
              className={"live-event " + originClass(currentEvent.origin)}
              onClick={() =>
                setSelected({ type: "event", id: currentEvent.id })
              }
            >
              <span className="live-event-glyph">
                {(() => {
                  const EventIcon = eventIcon(currentEvent);
                  return <EventIcon aria-hidden="true" />;
                })()}
              </span>
              <span>
                <small>
                  {ORIGIN_LABEL[currentEvent.origin]} · world tick {world.tick}
                </small>
                <strong>{currentEvent.title}</strong>
                <em>{currentEvent.summary}</em>
                {currentEvent.origin === "native-agent" &&
                  currentEvent.importance >= 90 && (
                    <b>Nobody told them to do this.</b>
                  )}
              </span>
              <ArrowRight aria-hidden="true" />
            </button>
          )}

          <div className="world-tools">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={resetCamera}
              aria-label="Return to the full world"
              title="Return to world"
            >
              <Maximize2 aria-hidden="true" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => {
                if (currentEvent) {
                  setSelected({ type: "event", id: currentEvent.id });
                }
              }}
              aria-label="Show active event"
              title="Show active event"
            >
              <Focus aria-hidden="true" />
            </Button>
          </div>

          <div className="event-ribbon" aria-label="Recent important events">
            {visibleEvents.map((event) => (
              <button
                type="button"
                key={event.id}
                className={originClass(event.origin)}
                onClick={() => setSelected({ type: "event", id: event.id })}
              >
                <span>{event.title}</span>
                <small>{ORIGIN_LABEL[event.origin]}</small>
              </button>
            ))}
          </div>

          <form className="need-composer" onSubmit={postHumanNeed}>
            <span className="composer-provenance">
              <UserRound aria-hidden="true" />
              HUMAN NEED
            </span>
            <Input
              value={needText}
              onChange={(event) => setNeedText(event.target.value)}
              placeholder="What do you need?"
              aria-label="What do you need?"
              maxLength={600}
              disabled={submitting}
            />
            <label className="budget-input">
              <Coins aria-hidden="true" />
              <Input
                type="number"
                min="10"
                max="10000"
                step="1"
                value={budget}
                onChange={(event) => setBudget(event.target.value)}
                aria-label="Budget in simulated credits"
                disabled={submitting}
              />
              <span>CR</span>
            </label>
            <Button
              type="submit"
              size="icon-lg"
              disabled={submitting || needText.trim().length < 3}
              aria-label="Place this need into the economy"
            >
              <ArrowUp aria-hidden="true" />
            </Button>
            <small className="composer-hint">
              Put a need into the world. Agents decide how to respond.
            </small>
          </form>

          {error && (
            <button
              type="button"
              className="error-note"
              onClick={() => setError(null)}
            >
              {error}
            </button>
          )}
        </div>

        {debugMode && (
          <aside className="debug-panel">
            <div>
              <Radio aria-hidden="true" />
              <strong>WebMCP diagnostics</strong>
            </div>
            <p>
              Support: {webMcpState === "native" ? "native" : "fallback"} · 10
              tools registered
            </p>
            <code>
              observe_world · inspect_agent · inspect_business · inspect_need ·
              post_need · create_offer · send_message · create_business ·
              join_business · accept_offer
            </code>
            {lastWebMcp && (
              <p className={lastWebMcp.ok ? "is-ok" : "is-error"}>
                Last: {lastWebMcp.name} · {lastWebMcp.summary}
              </p>
            )}
          </aside>
        )}
      </section>

      <Sheet
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <SheetContent className="entity-sheet" side="right">
          <SheetHeader className="entity-sheet-header">
            <SheetTitle>
              {selectedAgent?.name ??
                selectedBusiness?.name ??
                selectedNeed?.title ??
                selectedEvent?.title ??
                "World detail"}
            </SheetTitle>
            <SheetDescription>
              {selectedAgent?.role ??
                selectedBusiness?.pricingStrategy ??
                selectedNeed?.description ??
                selectedEvent?.summary ??
                "Inspect an entity in the shared economy."}
            </SheetDescription>
          </SheetHeader>

          <div className="entity-sheet-body">
            {selectedAgent && (
              <AgentDetail agent={selectedAgent} world={world} />
            )}
            {selectedBusiness && (
              <BusinessDetail business={selectedBusiness} world={world} />
            )}
            {selectedNeed && (
              <NeedDetail
                need={selectedNeed}
                world={world}
                submitting={submitting}
                onAccept={accept}
              />
            )}
            {selectedEvent && (
              <EventDetail event={selectedEvent} world={world} />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </main>
  );
}

function AgentDetail({
  agent,
  world,
}: {
  agent: AgentState;
  world: WorldState;
}) {
  return (
    <>
      <div className="detail-hero">
        <span className="detail-avatar">
          <PixelParticipant agent={agent} />
        </span>
        <div>
          <span className={originClass(agent.origin)}>
            {ORIGIN_LABEL[agent.origin]}
          </span>
          <strong>Reputation {agent.reputation}</strong>
          <small>{compactCredits(agent.balance)} simulated credits</small>
        </div>
      </div>
      <DetailSection title="Capabilities">
        <div className="skill-list">
          {agent.skills.map((skill) => (
            <span key={skill}>{SKILL_LABEL[skill]}</span>
          ))}
        </div>
      </DetailSection>
      <DetailSection title="Economic character">
        <dl className="trait-list">
          <div>
            <dt>Ambition</dt>
            <dd>{Math.round(agent.ambition * 100)}</dd>
          </div>
          <div>
            <dt>Curiosity</dt>
            <dd>{Math.round(agent.curiosity * 100)}</dd>
          </div>
          <div>
            <dt>Collaboration</dt>
            <dd>{Math.round(agent.collaborationPreference * 100)}</dd>
          </div>
          <div>
            <dt>Risk tolerance</dt>
            <dd>{Math.round(agent.riskTolerance * 100)}</dd>
          </div>
        </dl>
      </DetailSection>
      <DetailSection title="Relationships">
        {agent.relationships.length === 0 ? (
          <p className="detail-empty">No reinforced relationships yet.</p>
        ) : (
          <div className="relationship-list">
            {agent.relationships.map((relationship) => (
              <div key={relationship.agentId}>
                <span>
                  {world.agents.find(
                    (candidate) => candidate.id === relationship.agentId,
                  )?.name ?? relationship.agentId}
                </span>
                <i>
                  <b style={{ width: String(relationship.strength) + "%" }} />
                </i>
                <small>{Math.round(relationship.strength)}</small>
              </div>
            ))}
          </div>
        )}
      </DetailSection>
      <DetailSection title="Recent memory">
        {agent.recentMemory.length === 0 ? (
          <p className="detail-empty">Quietly observing the market.</p>
        ) : (
          <ul className="memory-list">
            {agent.recentMemory.map((memory) => (
              <li key={memory}>{memory}</li>
            ))}
          </ul>
        )}
      </DetailSection>
    </>
  );
}

function BusinessDetail({
  business,
  world,
}: {
  business: BusinessState;
  world: WorldState;
}) {
  return (
    <>
      <div className="detail-hero detail-hero--business">
        <span className="business-mark">
          <BriefcaseBusiness aria-hidden="true" />
        </span>
        <div>
          <span className={originClass(business.createdBy)}>
            {ORIGIN_LABEL[business.createdBy]} founded
          </span>
          <strong>Reputation {business.reputation}</strong>
          <small>{compactCredits(business.treasury)} treasury credits</small>
        </div>
      </div>
      <DetailSection title="Specialty">
        <div className="skill-list">
          {business.specialty.map((skill) => (
            <span key={skill}>{SKILL_LABEL[skill]}</span>
          ))}
        </div>
      </DetailSection>
      <DetailSection title="Members">
        <div className="member-list">
          {business.members.map((id) => {
            const member = world.agents.find((agent) => agent.id === id);
            if (!member) return null;
            return (
              <div key={id}>
                <PixelParticipant agent={member} compact />
                <span>
                  <strong>{member.name}</strong>
                  <small>{member.role}</small>
                </span>
              </div>
            );
          })}
        </div>
      </DetailSection>
      <DetailSection title="Active contracts">
        <strong className="large-value">
          {business.activeContracts.length}
        </strong>
      </DetailSection>
    </>
  );
}

function NeedDetail({
  need,
  world,
  submitting,
  onAccept,
}: {
  need: NeedState;
  world: WorldState;
  submitting: boolean;
  onAccept: (offer: OfferState) => Promise<void>;
}) {
  const offers = world.offers.filter((offer) => offer.needId === need.id);
  const chain = causalChain(world, need.id);
  return (
    <>
      <div className="need-summary">
        <span className={originClass(need.origin)}>
          {ORIGIN_LABEL[need.origin]}
        </span>
        <strong>{compactCredits(need.budget)} credits</strong>
        <small>
          {need.status} · {need.stage}
        </small>
      </div>
      <DetailSection title="Required capabilities">
        <div className="skill-list">
          {need.requiredSkills.map((skill) => (
            <span key={skill}>{SKILL_LABEL[skill]}</span>
          ))}
        </div>
      </DetailSection>
      <DetailSection title={"Offers · " + String(offers.length)}>
        {offers.length === 0 ? (
          <p className="detail-empty">
            Relevant agents are still deciding whether to act.
          </p>
        ) : (
          <div className="offer-list">
            {offers.map((offer) => {
              const lead = world.agents.find(
                (agent) => agent.id === offer.agentId,
              );
              return (
                <article key={offer.id}>
                  <div>
                    <span className={originClass(offer.origin)}>
                      {ORIGIN_LABEL[offer.origin]}
                    </span>
                    <strong>
                      {lead?.name ?? offer.agentId} · {offer.price} cr
                    </strong>
                    <p>{offer.message}</p>
                    {offer.collaboratorIds.length > 0 && (
                      <small>
                        with{" "}
                        {offer.collaboratorIds
                          .map(
                            (id) =>
                              world.agents.find((agent) => agent.id === id)
                                ?.name ?? id,
                          )
                          .join(", ")}
                      </small>
                    )}
                  </div>
                  {offer.status === "pending" && need.origin === "human" && (
                    <Button
                      size="sm"
                      disabled={submitting}
                      onClick={() => void onAccept(offer)}
                    >
                      Accept
                      <ArrowRight aria-hidden="true" />
                    </Button>
                  )}
                  {offer.status !== "pending" && (
                    <span className="offer-status">{offer.status}</span>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </DetailSection>
      <CausalHistory events={chain} />
    </>
  );
}

function EventDetail({
  event,
  world,
}: {
  event: WorldEvent;
  world: WorldState;
}) {
  const chain = causalChain(world, event.entityId ?? event.id);
  return (
    <>
      <div className="event-detail-summary">
        <span className={originClass(event.origin)}>
          {ORIGIN_LABEL[event.origin]}
        </span>
        <strong>Importance {event.importance}</strong>
        <small>World event {event.id}</small>
      </div>
      <DetailSection title="Participants">
        <div className="member-list">
          {event.actorIds.map((id) => {
            const participant = world.agents.find((agent) => agent.id === id);
            return participant ? (
              <div key={id}>
                <PixelParticipant agent={participant} compact />
                <span>
                  <strong>{participant.name}</strong>
                  <small>{participant.role}</small>
                </span>
              </div>
            ) : (
              <div key={id}>
                <span className="human-mark">
                  <UserRound aria-hidden="true" />
                </span>
                <span>
                  <strong>{id}</strong>
                  <small>World participant</small>
                </span>
              </div>
            );
          })}
        </div>
      </DetailSection>
      <CausalHistory events={chain.length > 0 ? chain : [event]} />
    </>
  );
}

function CausalHistory({ events }: { events: WorldEvent[] }) {
  return (
    <DetailSection title="Why this happened">
      {events.length === 0 ? (
        <p className="detail-empty">No causal events are available yet.</p>
      ) : (
        <ol className="causal-history">
          {events.map((event, index) => (
            <li key={event.id} style={{ opacity: Math.max(0.5, 1 - (events.length - index - 1) * 0.08) }}>
              <span>
                <GitBranch aria-hidden="true" />
              </span>
              <div>
                <small>{ORIGIN_LABEL[event.origin]}</small>
                <strong>{event.title}</strong>
                <p>{event.summary}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </DetailSection>
  );
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="detail-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}
