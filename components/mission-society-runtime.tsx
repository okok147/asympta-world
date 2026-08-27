"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { inferSkills, type Skill } from "@/lib/world-engine";

type MissionSource = "human" | "webmcp";
type MissionStatus =
  | "new"
  | "planning"
  | "hiring"
  | "working"
  | "blocked"
  | "completed";
type SubtaskStatus = "open" | "negotiating" | "working" | "completed" | "blocked";
type EncounterPhase = "approach" | "greet" | "discuss" | "deal" | "close" | "depart";
type EncounterType = "enquiry" | "negotiation" | "mission-collab";
type EncounterOutcome = "success" | "failed" | "partial";
type IconSymbol =
  | "target"
  | "search"
  | "question"
  | "talk"
  | "skill"
  | "deal"
  | "work"
  | "payment"
  | "complete"
  | "walk"
  | "status";

type MissionSubtask = {
  id: string;
  title: string;
  requiredSkills: Skill[];
  assignedAgentName?: string;
  status: SubtaskStatus;
  progress: number;
};

type MissionState = {
  id: string;
  source: MissionSource;
  ownerAgentName: string;
  title: string;
  description: string;
  budget: number;
  requiredSkills: Skill[];
  status: MissionStatus;
  subtasks: MissionSubtask[];
  collaborators: string[];
  progress: number;
  currentEncounterId?: string;
  nextActionAt: number;
  createdAt: number;
  updatedAt: number;
};

type EncounterSession = {
  id: string;
  missionId: string;
  subtaskId: string;
  participants: string[];
  type: EncounterType;
  phase: EncounterPhase;
  startedAt: number;
  updatedAt: number;
  phaseEndsAt: number;
  minDurationMs: number;
  targetDurationMs: number;
  iconQueue: IconSymbol[][];
  lockedUntil: number;
  completed: boolean;
  outcome?: EncounterOutcome;
};

type UserAgentState = {
  id: string;
  name: string;
  role: string;
  homeX: number;
  homeY: number;
};

type Collaborator = {
  name: string;
  role: string;
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

const MISSIONS_KEY = "asympta-user-missions-v1";
const ENCOUNTERS_KEY = "asympta-encounters-v1";
const OWNER_NAME = "Your Agent";
const OWNER_ROLE = "Mission runner";
const MAX_MISSIONS = 8;
const MAX_ENCOUNTERS = 24;
const HOME_X = 1085;
const HOME_Y = 665;
const PHASES: EncounterPhase[] = [
  "approach",
  "greet",
  "discuss",
  "deal",
  "close",
  "depart",
];

const SKILL_ROLE: Record<Skill, string[]> = {
  "visual-design": ["visual designer", "brand strategist"],
  frontend: ["frontend engineer", "quality engineer"],
  copywriting: ["copywriter", "brand strategist"],
  research: ["market researcher", "data analyst"],
  branding: ["brand strategist", "visual designer"],
  "data-analysis": ["data analyst", "operations analyst"],
  qa: ["quality engineer", "operations analyst"],
  automation: ["automation specialist", "operations analyst"],
  "product-strategy": ["product strategist", "opportunity generalist"],
};

const PHASE_ICONS: Record<EncounterPhase, IconSymbol[]> = {
  approach: ["target", "walk"],
  greet: ["talk"],
  discuss: ["question", "skill", "talk"],
  deal: ["deal", "payment"],
  close: ["complete", "deal"],
  depart: ["walk", "status"],
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function loadArray<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function saveArray<T>(key: string, value: T[]) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // A memory-only mission remains usable when storage is unavailable.
  }
}

function missionId(prefix: string) {
  return (
    prefix +
    "-" +
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2, 7)
  );
}

function scanCollaborators(): Collaborator[] {
  return [...document.querySelectorAll<HTMLButtonElement>(".world-agent")]
    .filter((node) => !node.classList.contains("mission-user-agent"))
    .map((node) => {
      const name = node.querySelector<HTMLElement>(".agent-label strong")?.textContent?.trim();
      const role = node.querySelector<HTMLElement>(".agent-label small")?.textContent?.trim();
      return name && role ? { name, role } : null;
    })
    .filter((value): value is Collaborator => Boolean(value));
}

function findCollaborator(skill: Skill, excluded: string[] = []) {
  const phrases = SKILL_ROLE[skill];
  const candidates = scanCollaborators().filter((candidate) => !excluded.includes(candidate.name));
  return (
    candidates.find((candidate) =>
      phrases.some((phrase) => candidate.role.toLowerCase().includes(phrase)),
    ) ?? candidates[0]
  );
}

function phaseDuration(encounter: EncounterSession, phase: EncounterPhase) {
  if (phase === "approach") return 1500;
  if (phase === "greet") return 1200;
  if (phase === "discuss") {
    return Math.max(3200, encounter.targetDurationMs - 6200);
  }
  if (phase === "deal") return 1700;
  if (phase === "close") return 1100;
  return 700;
}

function behaviorKind(phase: EncounterPhase) {
  if (phase === "deal" || phase === "close") return "deal" as const;
  if (phase === "discuss" || phase === "greet") return "enquiry" as const;
  return "workflow" as const;
}

function dispatchEncounterBehavior(
  encounter: EncounterSession,
  actorName: string,
  partnerName: string,
) {
  const remaining = Math.max(1800, encounter.lockedUntil - Date.now());
  window.dispatchEvent(
    new CustomEvent("asympta:agent-behavior", {
      detail: {
        actorName,
        partnerName,
        kind: behaviorKind(encounter.phase),
        message: "Mission encounter · " + encounter.phase,
        partnerMessage: "Mission encounter · " + encounter.phase,
        symbols: PHASE_ICONS[encounter.phase],
        partnerSymbols: PHASE_ICONS[encounter.phase].slice().reverse(),
        durationMs: remaining,
        holdMs: remaining,
        encounterId: encounter.id,
      },
    }),
  );
}

function dispatchMissionSignal(
  symbols: IconSymbol[],
  accessibleText: string,
  targetName?: string,
  durationMs = 4200,
) {
  window.dispatchEvent(
    new CustomEvent("asympta:agent-behavior", {
      detail: {
        actorName: OWNER_NAME,
        partnerName: targetName,
        kind: targetName ? "workflow" : "status",
        message: accessibleText,
        symbols,
        durationMs,
        holdMs: targetName ? Math.max(2800, durationMs - 700) : 0,
      },
    }),
  );
}

function sendAgentHome() {
  window.dispatchEvent(
    new CustomEvent("asympta:agent-motion-target", {
      detail: {
        agentName: OWNER_NAME,
        x: HOME_X,
        y: HOME_Y,
        durationMs: 5200,
      },
    }),
  );
}

function existingWorldRegistry() {
  return (
    window as unknown as {
      __ASYMPTA_WEBMCP__?: {
        invoke: (name: string, input?: Record<string, unknown>) => Promise<unknown>;
      };
    }
  ).__ASYMPTA_WEBMCP__;
}

export function MissionSocietyRuntime() {
  const missionsRef = useRef<MissionState[]>([]);
  const encountersRef = useRef<EncounterSession[]>([]);
  const advancingRef = useRef(new Set<string>());
  const lastSubmitRef = useRef({ signature: "", at: 0 });
  const [missions, setMissions] = useState<MissionState[]>([]);
  const [encounters, setEncounters] = useState<EncounterSession[]>([]);
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);
  const [worldPlane, setWorldPlane] = useState<HTMLElement | null>(null);
  const [userAgent, setUserAgent] = useState<UserAgentState | null>(null);
  const [webMcpStatus, setWebMcpStatus] = useState<"probing" | "native" | "fallback">(
    "probing",
  );

  const commitMissions = useCallback((next: MissionState[]) => {
    const bounded = [...next]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_MISSIONS);
    missionsRef.current = bounded;
    saveArray(MISSIONS_KEY, bounded);
    setMissions(bounded);
  }, []);

  const commitEncounters = useCallback((next: EncounterSession[]) => {
    const bounded = [...next]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_ENCOUNTERS);
    encountersRef.current = bounded;
    saveArray(ENCOUNTERS_KEY, bounded);
    setEncounters(bounded);
  }, []);

  const bridgeWebMcpGoal = useCallback(async (mission: MissionState) => {
    const registry = existingWorldRegistry();
    if (!registry || mission.source !== "webmcp") return;
    try {
      await registry.invoke("post_need", {
        title: mission.title.slice(0, 118),
        description:
          "User-owned mission agent goal: " + mission.description +
          ". Collaborate through the normal Asympta economy.",
        budget: mission.budget,
        requiredSkills: mission.requiredSkills.slice(0, 4),
      });
    } catch {
      // The mission layer remains functional on static GitHub Pages fallback.
    }
  }, []);

  const startMission = useCallback(
    async (description: string, budget: number, source: MissionSource) => {
      const clean = description.trim();
      if (clean.length < 3) throw new Error("Mission goal is too short.");
      const now = Date.now();
      const skills = inferSkills(clean).slice(0, 3);
      const activeExists = missionsRef.current.some(
        (mission) => mission.status !== "new" && mission.status !== "completed",
      );
      const mission: MissionState = {
        id: missionId("mission"),
        source,
        ownerAgentName: OWNER_NAME,
        title: clean.length > 72 ? clean.slice(0, 69).trimEnd() + "…" : clean,
        description: clean,
        budget: clamp(Number.isFinite(budget) ? budget : 80, 10, 10000),
        requiredSkills: skills,
        status: activeExists ? "new" : "planning",
        subtasks: skills.map((skill, index) => ({
          id: "subtask-" + index + "-" + now.toString(36),
          title: "Secure " + skill + " capability",
          requiredSkills: [skill],
          status: "open",
          progress: 0,
        })),
        collaborators: [],
        progress: 0,
        nextActionAt: now + (activeExists ? 1200 : 900),
        createdAt: now,
        updatedAt: now,
      };
      setUserAgent({
        id: "human-mission-agent",
        name: OWNER_NAME,
        role: OWNER_ROLE,
        homeX: HOME_X,
        homeY: HOME_Y,
      });
      commitMissions([mission, ...missionsRef.current]);
      dispatchMissionSignal(["target", "search"], "Mission accepted · planning route");
      await bridgeWebMcpGoal(mission);
      return mission;
    },
    [bridgeWebMcpGoal, commitMissions],
  );

  useEffect(() => {
    const initialize = window.setTimeout(() => {
      const loadedMissions = loadArray<MissionState>(MISSIONS_KEY).map((mission) => ({
        ...mission,
        nextActionAt:
          mission.status === "completed" ? mission.nextActionAt : Date.now() + 900,
      }));
      const loadedEncounters = loadArray<EncounterSession>(ENCOUNTERS_KEY).map((encounter) => ({
        ...encounter,
        completed: true,
        outcome: encounter.outcome ?? "partial",
      }));
      commitMissions(loadedMissions);
      commitEncounters(loadedEncounters);
      if (loadedMissions.length > 0) {
        setUserAgent({
          id: "human-mission-agent",
          name: OWNER_NAME,
          role: OWNER_ROLE,
          homeX: HOME_X,
          homeY: HOME_Y,
        });
      }
      setPortalHost(document.querySelector<HTMLElement>(".world-viewport"));
      setWorldPlane(document.querySelector<HTMLElement>(".world-plane"));
    }, 0);
    return () => window.clearTimeout(initialize);
  }, [commitEncounters, commitMissions]);

  useEffect(() => {
    const onSubmit = (event: Event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement) || !form.matches(".need-composer")) return;
      const goalInput = form.querySelector<HTMLInputElement>(
        'input[aria-label="What do you need?"]',
      );
      const budgetInput = form.querySelector<HTMLInputElement>(
        'input[aria-label="Budget in simulated credits"]',
      );
      const goal = goalInput?.value.trim() ?? "";
      const budget = Number(budgetInput?.value ?? "80");
      if (goal.length < 3 || !Number.isFinite(budget)) return;
      const signature = goal + ":" + String(budget);
      const now = Date.now();
      if (
        lastSubmitRef.current.signature === signature &&
        now - lastSubmitRef.current.at < 1200
      ) {
        return;
      }
      lastSubmitRef.current = { signature, at: now };
      window.setTimeout(() => {
        void startMission(goal, budget, "human");
      }, 0);
    };

    document.addEventListener("submit", onSubmit, true);
    return () => document.removeEventListener("submit", onSubmit, true);
  }, [startMission]);

  const startEncounter = useCallback(
    (mission: MissionState, subtask: MissionSubtask, partner: Collaborator) => {
      const now = Date.now();
      const targetDurationMs = 9000 + Math.floor(Math.random() * 2600);
      const encounter: EncounterSession = {
        id: missionId("encounter"),
        missionId: mission.id,
        subtaskId: subtask.id,
        participants: [OWNER_NAME, partner.name],
        type: "mission-collab",
        phase: "approach",
        startedAt: now,
        updatedAt: now,
        phaseEndsAt: now + 1500,
        minDurationMs: 8200,
        targetDurationMs,
        iconQueue: PHASES.map((phase) => PHASE_ICONS[phase]),
        lockedUntil: now + targetDurationMs,
        completed: false,
      };
      commitEncounters([encounter, ...encountersRef.current]);
      dispatchEncounterBehavior(encounter, OWNER_NAME, partner.name);
      const next: MissionState = {
        ...mission,
        status: "hiring",
        currentEncounterId: encounter.id,
        subtasks: mission.subtasks.map((candidate) =>
          candidate.id === subtask.id
            ? {
                ...candidate,
                assignedAgentName: partner.name,
                status: "negotiating",
              }
            : candidate,
        ),
        collaborators: mission.collaborators.includes(partner.name)
          ? mission.collaborators
          : [...mission.collaborators, partner.name],
        updatedAt: now,
      };
      commitMissions(
        missionsRef.current.map((candidate) =>
          candidate.id === mission.id ? next : candidate,
        ),
      );
    },
    [commitEncounters, commitMissions],
  );

  const advanceEncounter = useCallback(
    (encounter: EncounterSession) => {
      if (encounter.completed || advancingRef.current.has(encounter.id)) return;
      const now = Date.now();
      if (now < encounter.phaseEndsAt) return;
      advancingRef.current.add(encounter.id);
      try {
        const currentIndex = PHASES.indexOf(encounter.phase);
        const nextPhase = PHASES[currentIndex + 1];
        if (!nextPhase) {
          const completed: EncounterSession = {
            ...encounter,
            completed: true,
            outcome: "success",
            updatedAt: now,
          };
          commitEncounters(
            encountersRef.current.map((candidate) =>
              candidate.id === encounter.id ? completed : candidate,
            ),
          );
          const mission = missionsRef.current.find(
            (candidate) => candidate.id === encounter.missionId,
          );
          if (mission) {
            const next: MissionState = {
              ...mission,
              status: "working",
              currentEncounterId: undefined,
              subtasks: mission.subtasks.map((subtask) =>
                subtask.id === encounter.subtaskId
                  ? { ...subtask, status: "working", progress: 35 }
                  : subtask,
              ),
              nextActionAt: now + 3600 + Math.floor(Math.random() * 2200),
              updatedAt: now,
            };
            commitMissions(
              missionsRef.current.map((candidate) =>
                candidate.id === mission.id ? next : candidate,
              ),
            );
            const partner = encounter.participants[1];
            dispatchMissionSignal(
              ["work", "skill"],
              "Collaboration executing",
              partner,
              3900,
            );
          }
          return;
        }

        const next: EncounterSession = {
          ...encounter,
          phase: nextPhase,
          updatedAt: now,
          phaseEndsAt: now + phaseDuration(encounter, nextPhase),
        };
        commitEncounters(
          encountersRef.current.map((candidate) =>
            candidate.id === encounter.id ? next : candidate,
          ),
        );
        dispatchEncounterBehavior(
          next,
          encounter.participants[0],
          encounter.participants[1],
        );
      } finally {
        advancingRef.current.delete(encounter.id);
      }
    },
    [commitEncounters, commitMissions],
  );

  const advanceMission = useCallback(
    (mission: MissionState) => {
      if (mission.status === "completed" || mission.status === "hiring") return;
      const now = Date.now();
      if (now < mission.nextActionAt) return;

      if (mission.status === "new") {
        const anotherActive = missionsRef.current.some(
          (candidate) =>
            candidate.id !== mission.id &&
            candidate.createdAt < mission.createdAt &&
            candidate.status !== "completed" &&
            candidate.status !== "new",
        );
        if (anotherActive) return;
        const next = {
          ...mission,
          status: "planning" as const,
          nextActionAt: now + 800,
          updatedAt: now,
        };
        commitMissions(
          missionsRef.current.map((candidate) =>
            candidate.id === mission.id ? next : candidate,
          ),
        );
        dispatchMissionSignal(["target", "search"], "Queued mission is now active");
        return;
      }

      if (mission.status === "blocked") return;

      if (mission.status === "working") {
        const working = mission.subtasks.find((subtask) => subtask.status === "working");
        if (working) {
          const completedSubtasks = mission.subtasks.map((subtask) =>
            subtask.id === working.id
              ? { ...subtask, status: "completed" as const, progress: 100 }
              : subtask,
          );
          const completedCount = completedSubtasks.filter(
            (subtask) => subtask.status === "completed",
          ).length;
          const progress = Math.round((completedCount / completedSubtasks.length) * 100);
          const remaining = completedSubtasks.find((subtask) => subtask.status === "open");
          const next: MissionState = {
            ...mission,
            subtasks: completedSubtasks,
            progress,
            status: remaining ? "planning" : "completed",
            nextActionAt: now + 800,
            updatedAt: now,
          };
          commitMissions(
            missionsRef.current.map((candidate) =>
              candidate.id === mission.id ? next : candidate,
            ),
          );
          if (remaining) {
            dispatchMissionSignal(["complete", "search"], "Subtask complete · finding next capability");
          } else {
            dispatchMissionSignal(["target", "complete"], "Mission complete", undefined, 5200);
            sendAgentHome();
          }
          return;
        }
      }

      const open = mission.subtasks.find((subtask) => subtask.status === "open");
      if (!open) return;
      const skill = open.requiredSkills[0];
      const partner = findCollaborator(skill, []);
      if (!partner) {
        const next: MissionState = {
          ...mission,
          status: "blocked",
          subtasks: mission.subtasks.map((subtask) =>
            subtask.id === open.id ? { ...subtask, status: "blocked" } : subtask,
          ),
          updatedAt: now,
        };
        commitMissions(
          missionsRef.current.map((candidate) =>
            candidate.id === mission.id ? next : candidate,
          ),
        );
        dispatchMissionSignal(["question", "search"], "Mission blocked · no collaborator found");
        return;
      }
      startEncounter(mission, open, partner);
    },
    [commitMissions, startEncounter],
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      for (const encounter of encountersRef.current) advanceEncounter(encounter);
      for (const mission of [...missionsRef.current].sort((a, b) => a.createdAt - b.createdAt)) {
        advanceMission(mission);
      }
    }, 420);
    return () => window.clearInterval(timer);
  }, [advanceEncounter, advanceMission]);

  useEffect(() => {
    const controller = new AbortController();
    const tools: RuntimeTool[] = [
      {
        name: "submit_user_goal",
        title: "Give the user mission agent a goal",
        description:
          "Create a user-owned mission agent goal. The agent plans, moves into the world, holds realistic encounter sessions with specialist agents, collaborates, and returns after completing the mission.",
        inputSchema: {
          type: "object",
          properties: {
            goal: { type: "string", minLength: 3, maxLength: 600 },
            budget: { type: "number", minimum: 10, maximum: 10000 },
          },
          required: ["goal"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: true },
        execute: async (input) => {
          const mission = await startMission(
            String(input.goal),
            typeof input.budget === "number" ? input.budget : 80,
            "webmcp",
          );
          return JSON.stringify({
            ok: true,
            missionId: mission.id,
            ownerAgent: mission.ownerAgentName,
            requiredSkills: mission.requiredSkills,
            status: mission.status,
          });
        },
      },
      {
        name: "observe_user_missions",
        title: "Observe user mission agents",
        description:
          "Read current and recent user missions, their subtasks, collaborators, progress, and active encounter sessions.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute: async () =>
          JSON.stringify({
            ok: true,
            missions: missionsRef.current,
            activeEncounters: encountersRef.current.filter((encounter) => !encounter.completed),
          }),
      },
      {
        name: "inspect_encounter",
        title: "Inspect an agent encounter",
        description:
          "Inspect one approach, greeting, discussion, deal, close and departure session, including its icon dialogue queue and lock duration.",
        inputSchema: {
          type: "object",
          properties: { encounterId: { type: "string" } },
          required: ["encounterId"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute: async (input) => {
          const encounter = encountersRef.current.find(
            (candidate) => candidate.id === String(input.encounterId),
          );
          return JSON.stringify(
            encounter
              ? { ok: true, encounter }
              : { ok: false, error: "Encounter not found." },
          );
        },
      },
      {
        name: "nudge_mission_strategy",
        title: "Nudge a blocked mission strategy",
        description:
          "Retry a blocked mission, increase its budget, or request another collaborator search without directly completing the user's work.",
        inputSchema: {
          type: "object",
          properties: {
            missionId: { type: "string" },
            action: {
              type: "string",
              enum: ["retry-blocked", "find-new-collaborator", "increase-budget"],
            },
            amount: { type: "number", minimum: 1, maximum: 5000 },
          },
          required: ["missionId", "action"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute: async (input) => {
          const id = String(input.missionId);
          const mission = missionsRef.current.find((candidate) => candidate.id === id);
          if (!mission) return JSON.stringify({ ok: false, error: "Mission not found." });
          const now = Date.now();
          const action = String(input.action);
          const next: MissionState = {
            ...mission,
            budget:
              action === "increase-budget"
                ? clamp(mission.budget + Number(input.amount ?? 20), 10, 10000)
                : mission.budget,
            status: action === "increase-budget" && mission.status !== "blocked"
              ? mission.status
              : "planning",
            subtasks: mission.subtasks.map((subtask) =>
              subtask.status === "blocked"
                ? {
                    ...subtask,
                    status: "open",
                    assignedAgentName:
                      action === "find-new-collaborator" ? undefined : subtask.assignedAgentName,
                  }
                : subtask,
            ),
            nextActionAt: now + 500,
            updatedAt: now,
          };
          commitMissions(
            missionsRef.current.map((candidate) => (candidate.id === id ? next : candidate)),
          );
          dispatchMissionSignal(["target", "search"], "Mission strategy updated");
          return JSON.stringify({ ok: true, mission: next });
        },
      },
    ];

    const fallback = window as unknown as {
      __ASYMPTA_MISSION_WEBMCP__?: {
        tools: RuntimeTool[];
        invoke: (name: string, input?: Record<string, unknown>) => Promise<unknown>;
      };
    };
    fallback.__ASYMPTA_MISSION_WEBMCP__ = {
      tools,
      invoke: async (name, input = {}) => {
        const tool = tools.find((candidate) => candidate.name === name);
        if (!tool) throw new Error("Unknown mission WebMCP tool: " + name);
        return JSON.parse(await tool.execute(input)) as unknown;
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
        .then(() => setWebMcpStatus("native"))
        .catch(() => setWebMcpStatus("fallback"));
    } else {
      window.setTimeout(() => setWebMcpStatus("fallback"), 0);
    }

    return () => {
      controller.abort();
      delete fallback.__ASYMPTA_MISSION_WEBMCP__;
    };
  }, [commitMissions, startMission]);

  const activeMission = missions.find((mission) => mission.status !== "completed");
  const activeEncounter = activeMission?.currentEncounterId
    ? encounters.find((encounter) => encounter.id === activeMission.currentEncounterId)
    : undefined;

  return (
    <>
      <style>{`
        .mission-user-agent {
          z-index: 14 !important;
          border-left-color: #8a7762 !important;
        }
        .mission-agent-portrait {
          background: #eee8dd !important;
          border-color: #b8aa95 !important;
        }
        .mission-pixel-person {
          position: relative;
          width: 22px;
          height: 28px;
          image-rendering: pixelated;
        }
        .mission-pixel-person::before {
          content: "";
          position: absolute;
          left: 7px;
          top: 1px;
          width: 8px;
          height: 8px;
          background: #665f58;
          box-shadow:
            -3px 8px 0 #8d8274,
            0 8px 0 #8d8274,
            3px 8px 0 #8d8274,
            -3px 12px 0 #8d8274,
            0 12px 0 #8d8274,
            3px 12px 0 #8d8274,
            -3px 16px 0 #6f716d,
            3px 16px 0 #6f716d,
            -3px 20px 0 #6f716d,
            3px 20px 0 #6f716d;
        }
        .mission-panel {
          position: absolute;
          z-index: 38;
          left: 18px;
          bottom: 104px;
          width: min(286px, calc(100% - 36px));
          padding: 10px 11px;
          border: 1px solid #b9b4aa;
          border-radius: 5px;
          background: rgba(250, 249, 244, .95);
          box-shadow: 4px 4px 0 rgba(66, 61, 55, .05);
          color: #383a37;
          pointer-events: none;
          backdrop-filter: blur(10px);
        }
        .mission-panel header,
        .mission-panel footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .mission-panel b,
        .mission-panel small {
          font-family: var(--pixel-font);
          font-size: .36rem;
          letter-spacing: .055em;
          text-transform: uppercase;
        }
        .mission-panel b { color: #7c684e; }
        .mission-panel strong {
          display: block;
          margin-top: 6px;
          overflow: hidden;
          font-size: .65rem;
          line-height: 1.25;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .mission-panel p {
          margin: 4px 0 8px;
          color: #6a6e69;
          font-size: .48rem;
          line-height: 1.32;
        }
        .mission-progress {
          height: 4px;
          overflow: hidden;
          border: 1px solid #c5c0b6;
          background: #ece9e2;
        }
        .mission-progress i {
          display: block;
          height: 100%;
          background: #8e806d;
          transition: width 420ms ease;
        }
        .mission-panel footer { margin-top: 7px; color: #7b7c77; }
        @media (max-width: 720px) {
          .mission-panel { left: 10px; bottom: 96px; width: 218px; }
        }
      `}</style>

      {worldPlane && userAgent &&
        createPortal(
          <button
            type="button"
            className="world-agent world-agent--human mission-user-agent"
            style={{ left: userAgent.homeX, top: userAgent.homeY }}
            aria-label="Your mission agent"
            title="Your mission agent"
          >
            <span className="agent-portrait mission-agent-portrait">
              <span className="mission-pixel-person" aria-hidden="true" />
              <i aria-hidden="true" />
            </span>
            <span className="agent-label">
              <strong>{userAgent.name}</strong>
              <small>{userAgent.role}</small>
            </span>
          </button>,
          worldPlane,
          "mission-user-agent",
        )}

      {portalHost && activeMission &&
        createPortal(
          <aside className="mission-panel" aria-live="polite">
            <header>
              <b>YOUR AGENT · MISSION</b>
              <small>{activeMission.progress}%</small>
            </header>
            <strong>{activeMission.title}</strong>
            <p>
              {activeEncounter
                ? "Encounter · " + activeEncounter.phase + " · " + activeEncounter.participants[1]
                : activeMission.status +
                  " · " +
                  (activeMission.collaborators.slice(-2).join(" · ") || "finding collaborators")}
            </p>
            <div className="mission-progress" aria-hidden="true">
              <i style={{ width: String(activeMission.progress) + "%" }} />
            </div>
            <footer>
              <span>
                {activeMission.subtasks.filter((subtask) => subtask.status === "completed").length}/
                {activeMission.subtasks.length} capabilities
              </span>
              <span>{webMcpStatus === "native" ? "WebMCP" : "local + WebMCP ready"}</span>
            </footer>
          </aside>,
          portalHost,
          "mission-panel",
        )}
    </>
  );
}
