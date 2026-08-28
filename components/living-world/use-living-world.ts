"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  advanceLivingWorld,
  chooseResult,
  createLivingWorld,
  exchangeAgentInformation,
  locationContextForCoordinates,
  resetLivingWorld,
  resolveApproval,
  setWorldLocation,
  startHumanNeed,
  startScenario,
  worldSnapshot,
} from "@/lib/living-world/engine";
import { scenarioFor } from "@/lib/living-world/scenarios";
import type {
  LivingWorldState,
  Locale,
  LocationContext,
  ScenarioId,
} from "@/lib/living-world/types";

type ToolAnnotations = {
  readOnlyHint: boolean;
  untrustedContentHint: boolean;
};

export type WebMcpTool = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: ToolAnnotations;
  execute: (input: Record<string, unknown>) => Promise<string>;
};

declare global {
  interface Document {
    modelContext?: {
      registerTool: (
        tool: WebMcpTool,
        options?: { signal?: AbortSignal; exposedTo?: string[] },
      ) => Promise<void> | void;
    };
  }

  interface Window {
    __ASYMPTA_WORLD__?: {
      tools: WebMcpTool[];
      invoke: (
        name: string,
        input?: Record<string, unknown>,
      ) => Promise<unknown>;
    };
    render_game_to_text?: () => string;
    advanceTime?: (milliseconds: number) => void;
  }
}

const LOCALE_KEY = "asympta-world-locale-v1";
const FOLLOW_KEY = "asympta-world-follow-v1";

function initialLocale(): Locale {
  if (typeof window === "undefined") return "en";
  return localStorage.getItem(LOCALE_KEY) === "zh-Hant" ? "zh-Hant" : "en";
}

function initialFollow() {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(FOLLOW_KEY) !== "false";
}

function activePhase(world: LivingWorldState) {
  return (
    world.phase === "understanding" ||
    world.phase === "coordinating" ||
    world.phase === "converging" ||
    world.phase === "reporting" ||
    Boolean(world.celebrationUntil && world.celebrationUntil > world.now)
  );
}

function webMcpSnapshot(world: LivingWorldState, locale: Locale) {
  return {
    phase: world.phase,
    localWorld: {
      name: world.location.worldName[locale],
      area: world.location.areaName[locale],
      source: world.location.source,
    },
    need: world.need
      ? {
          text: world.need.text,
          scenario: world.need.scenarioId,
          status: world.need.status,
        }
      : null,
    team: world.agents.map((agent) => ({
      id: agent.id,
      name: agent.profile.name,
      species: agent.profile.species,
      role: agent.profile.role[locale],
      status: agent.status,
    })),
    tasks: world.tasks.map((task) => ({
      id: task.id,
      agentId: task.agentId,
      status: task.status,
      dependsOn: task.dependencies,
    })),
    exchanges: worldSnapshot(world, locale).activeMessages.slice(0, 4),
    toolRuns: world.toolRuns.map((run) => ({
      tool: run.toolId,
      mode: run.mode,
      status: run.status,
    })),
    resultReady: Boolean(world.result),
    approval: world.approval.status,
  };
}

export function useLivingWorld() {
  const [world, setWorld] = useState(() => createLivingWorld());
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const [cameraFollow, setCameraFollowState] = useState(initialFollow);
  const [webMcpState, setWebMcpState] = useState<
    "registering" | "native" | "ready"
  >("registering");
  const [locationState, setLocationState] = useState<
    "demo" | "requesting" | "following" | "denied" | "unavailable"
  >("demo");
  const worldRef = useRef(world);
  const localeRef = useRef(locale);
  const watchIdRef = useRef<number | undefined>(undefined);
  const queryStartedRef = useRef(false);

  const apply = useCallback(
    (change: (current: LivingWorldState) => LivingWorldState) => {
      const next = change(worldRef.current);
      worldRef.current = next;
      setWorld(next);
      return next;
    },
    [],
  );

  useEffect(() => {
    worldRef.current = world;
  }, [world]);

  useEffect(() => {
    localeRef.current = locale;
    document.documentElement.lang = locale === "en" ? "en" : "zh-Hant";
    document.documentElement.dataset.locale = locale;
    localStorage.setItem(LOCALE_KEY, locale);
  }, [locale]);

  useEffect(() => {
    localStorage.setItem(FOLLOW_KEY, String(cameraFollow));
  }, [cameraFollow]);

  useEffect(() => {
    let frame = 0;
    let previous = performance.now();
    let accumulator = 0;
    const animate = (now: number) => {
      const elapsed = Math.min(120, Math.max(0, now - previous));
      previous = now;
      if (!activePhase(worldRef.current)) {
        accumulator = 0;
      } else {
        accumulator += elapsed;
      }
      if (accumulator >= 48) {
        const step = accumulator;
        accumulator = 0;
        apply((current) => advanceLivingWorld(current, step));
      }
      frame = window.requestAnimationFrame(animate);
    };
    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [apply]);

  const commitLocation = useCallback(
    (location: LocationContext) => {
      apply((current) => setWorldLocation(current, location));
    },
    [apply],
  );

  const stopLocationWatch = useCallback(() => {
    if (watchIdRef.current !== undefined && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = undefined;
    }
  }, []);

  const followDeviceLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationState("unavailable");
      commitLocation({
        ...worldRef.current.location,
        source: "unavailable",
        updatedAt: Date.now(),
      });
      return;
    }
    stopLocationWatch();
    setLocationState("requesting");
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const next = locationContextForCoordinates(
          position.coords.latitude,
          position.coords.longitude,
          "device",
          Date.now(),
        );
        if (
          next.cellId !== worldRef.current.location.cellId ||
          worldRef.current.location.source !== "device"
        ) {
          commitLocation(next);
        }
        setLocationState("following");
      },
      (error) => {
        const denied = error.code === error.PERMISSION_DENIED;
        setLocationState(denied ? "denied" : "unavailable");
        commitLocation({
          ...worldRef.current.location,
          source: denied ? "denied" : "unavailable",
          updatedAt: Date.now(),
        });
      },
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 45_000 },
    );
  }, [commitLocation, stopLocationWatch]);

  useEffect(() => {
    let permission: PermissionStatus | undefined;
    const reactToPermission = () => {
      if (permission?.state === "granted") followDeviceLocation();
      if (permission?.state === "denied") setLocationState("denied");
    };
    if (navigator.permissions?.query) {
      void navigator.permissions
        .query({ name: "geolocation" })
        .then((status) => {
          permission = status;
          reactToPermission();
          permission.addEventListener("change", reactToPermission);
        })
        .catch(() => undefined);
    }
    return () => {
      permission?.removeEventListener("change", reactToPermission);
      stopLocationWatch();
    };
  }, [followDeviceLocation, stopLocationWatch]);

  const runScenario = useCallback(
    (scenarioId: ScenarioId) =>
      apply((current) => startScenario(current, scenarioId)),
    [apply],
  );

  const submitNeed = useCallback(
    (input: string, preferred?: ScenarioId) =>
      apply((current) => startHumanNeed(current, input, preferred)),
    [apply],
  );

  const reset = useCallback(
    () => apply((current) => resetLivingWorld(current)),
    [apply],
  );

  const choose = useCallback(
    (actionId: string) => apply((current) => chooseResult(current, actionId)),
    [apply],
  );

  const approve = useCallback(
    (approved: boolean) =>
      apply((current) => resolveApproval(current, approved)),
    [apply],
  );

  const exchange = useCallback(
    (fromId: string, toId: string, message: string) =>
      apply((current) =>
        exchangeAgentInformation(current, fromId, toId, message),
      ),
    [apply],
  );

  const setLocale = useCallback((next: Locale) => setLocaleState(next), []);
  const setCameraFollow = useCallback(
    (next: boolean) => setCameraFollowState(next),
    [],
  );

  useEffect(() => {
    window.render_game_to_text = () =>
      JSON.stringify(worldSnapshot(worldRef.current, localeRef.current));
    window.advanceTime = (milliseconds: number) => {
      const safe = Number.isFinite(milliseconds) ? milliseconds : 0;
      apply((current) => advanceLivingWorld(current, safe));
    };
    return () => {
      delete window.render_game_to_text;
      delete window.advanceTime;
    };
  }, [apply]);

  useEffect(() => {
    if (queryStartedRef.current) return;
    queryStartedRef.current = true;
    const demo = new URLSearchParams(window.location.search).get("demo");
    if (["dinner", "work", "shopping", "email"].includes(demo ?? "")) {
      window.requestAnimationFrame(() => runScenario(demo as ScenarioId));
    }
  }, [runScenario]);

  useEffect(() => {
    const controller = new AbortController();
    const readOnly = {
      readOnlyHint: true,
      untrustedContentHint: false,
    };
    const mutating = {
      readOnlyHint: false,
      untrustedContentHint: true,
    };
    const tools: WebMcpTool[] = [
      {
        name: "asympta_observe_coordination",
        title: "Observe Asympta coordination",
        description:
          "Read the current human need, local world group, useful agents, task graph, visible information exchange, tool modes and approval state.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: readOnly,
        execute: async () =>
          JSON.stringify({
            ok: true,
            world: webMcpSnapshot(worldRef.current, localeRef.current),
          }),
      },
      {
        name: "asympta_list_local_services",
        title: "List services around the human need",
        description:
          "List only the capabilities relevant to the current need and disclose whether each is LIVE, DEMO or SIMULATED.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: readOnly,
        execute: async () => {
          const current = worldRef.current;
          const scenario = current.scenarioId
            ? scenarioFor(current.scenarioId)
            : undefined;
          return JSON.stringify({
            ok: true,
            localWorld: current.location.worldName[localeRef.current],
            locationSource: current.location.source,
            services:
              scenario?.services.map((service) => ({
                id: service.id,
                name: service.name[localeRef.current],
                mode: service.mode,
                description: service.description[localeRef.current],
              })) ?? [],
          });
        },
      },
      {
        name: "asympta_submit_need",
        title: "Submit a human need",
        description:
          "Put a human need into the event-driven world. The world classifies it, creates a dependency graph and activates only useful agents.",
        inputSchema: {
          type: "object",
          properties: {
            text: { type: "string", minLength: 3, maxLength: 320 },
          },
          required: ["text"],
          additionalProperties: false,
        },
        annotations: mutating,
        execute: async (input) => {
          const value = String(input.text ?? "").trim();
          if (value.length < 3) {
            return JSON.stringify({ ok: false, error: "A need needs at least 3 characters." });
          }
          const next = submitNeed(value);
          return JSON.stringify({
            ok: true,
            need: next.need,
            tasks: next.tasks.map((task) => ({
              id: task.id,
              dependencies: task.dependencies,
              agentId: task.agentId,
            })),
          });
        },
      },
      {
        name: "asympta_exchange_information",
        title: "Exchange agent information",
        description:
          "Send a concise user-visible information packet between active agents through the same world event system.",
        inputSchema: {
          type: "object",
          properties: {
            fromAgentId: { type: "string" },
            toAgentId: { type: "string" },
            message: { type: "string", minLength: 1, maxLength: 180 },
          },
          required: ["fromAgentId", "toAgentId", "message"],
          additionalProperties: false,
        },
        annotations: mutating,
        execute: async (input) => {
          const current = worldRef.current;
          const fromAgentId = String(input.fromAgentId ?? "");
          const toAgentId = String(input.toAgentId ?? "");
          const message = String(input.message ?? "").trim();
          const activeIds = new Set(current.agents.map((agent) => agent.id));
          if (!activeIds.has(fromAgentId) || !activeIds.has(toAgentId)) {
            return JSON.stringify({
              ok: false,
              error: "Both agent IDs must belong to the active team.",
              activeAgentIds: [...activeIds],
            });
          }
          if (fromAgentId === toAgentId || !message) {
            return JSON.stringify({
              ok: false,
              error: "Choose two different active agents and a non-empty message.",
            });
          }
          const next = exchange(fromAgentId, toAgentId, message);
          return JSON.stringify({ ok: true, latestEvent: next.events[0] });
        },
      },
      {
        name: "asympta_request_action",
        title: "Request a result action",
        description:
          "Request an action from the current result. Consequential actions always stop for human approval and simulated adapters never claim a real action occurred.",
        inputSchema: {
          type: "object",
          properties: { actionId: { type: "string" } },
          required: ["actionId"],
          additionalProperties: false,
        },
        annotations: mutating,
        execute: async (input) => {
          const current = worldRef.current;
          const actionId = String(input.actionId ?? "");
          const actions = current.result
            ? [current.result.primaryAction, current.result.secondaryAction]
            : [];
          if (!actions.some((action) => action.id === actionId)) {
            return JSON.stringify({
              ok: false,
              error: current.result
                ? "Unknown action for the current result."
                : "No result is ready yet.",
              validActionIds: actions.map((action) => action.id),
            });
          }
          const next = choose(actionId);
          return JSON.stringify({
            ok: true,
            phase: next.phase,
            approval: next.approval,
          });
        },
      },
    ];

    window.__ASYMPTA_WORLD__ = {
      tools,
      invoke: async (name, input = {}) => {
        const tool = tools.find((candidate) => candidate.name === name);
        if (!tool) throw new Error(`Unknown Asympta tool: ${name}`);
        const value = await tool.execute(input);
        try {
          return JSON.parse(value) as unknown;
        } catch {
          return value;
        }
      },
    };

    if (!document.modelContext?.registerTool) {
      void Promise.resolve().then(() => setWebMcpState("ready"));
    } else {
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
      delete window.__ASYMPTA_WORLD__;
    };
  }, [approve, choose, exchange, submitNeed]);

  return {
    world,
    locale,
    cameraFollow,
    webMcpState,
    locationState,
    runScenario,
    submitNeed,
    reset,
    choose,
    approve,
    exchange,
    setLocale,
    setCameraFollow,
    requestLocation: followDeviceLocation,
  };
}
