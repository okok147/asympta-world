"use client";

import { Package, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type TaskKind =
  | "food"
  | "delivery"
  | "research"
  | "design"
  | "web"
  | "automation"
  | "learning"
  | "repair"
  | "business"
  | "generic";

type MissionSubtaskSnapshot = {
  id: string;
  title: string;
  status: string;
  progress: number;
  assignedAgentName?: string;
};

type MissionSnapshot = {
  id: string;
  title: string;
  description: string;
  status: string;
  progress: number;
  subtasks: MissionSubtaskSnapshot[];
  currentEncounterId?: string;
  createdAt?: number;
  updatedAt?: number;
};

type EncounterSnapshot = {
  id: string;
  phase: string;
  participants: string[];
  completed: boolean;
};

type StageBlueprint = {
  id: string;
  title: string;
  planning: string;
  hiring: string;
  working: string;
  output: { id: string; name: string; category: string };
};

type ProcessStage = StageBlueprint & { key: string };

type ProcessRecord = {
  missionId: string;
  taskKind: TaskKind;
  taskLabel: string;
  stages: ProcessStage[];
  currentStageIndex: number;
  currentLabel: string;
  progress: number;
  status: string;
  awardedSubtaskIds: string[];
  recentDelta?: { label: string; until: number };
  completed: boolean;
  updatedAt: number;
};

type TaskInventoryItem = {
  id: string;
  name: string;
  category: string;
  quantity: number;
  sourceMissionId: string;
  updatedAt: number;
};

type InventoryView = {
  id: string;
  name: string;
  quantity: number;
  source: "task" | "city";
  updatedAt: number;
};

type CitySnapshot = {
  externalInventory?: Record<string, number>;
  externalServices?: Record<string, number>;
  businesses?: Array<{
    products?: Array<{ id: string; name: string }>;
    services?: Array<{ id: string; name: string }>;
  }>;
};

const MISSIONS_KEY = "asympta-user-missions-v1";
const ENCOUNTERS_KEY = "asympta-encounters-v1";
const PROCESS_KEY = "asympta-task-process-v1";
const INVENTORY_KEY = "asympta-task-inventory-v1";
const CITY_KEY = "asympta-latent-city-v1";

const TASKS: Record<TaskKind, { label: string; stages: StageBlueprint[] }> = {
  food: {
    label: "Local purchase",
    stages: [
      {
        id: "order",
        title: "Clarify order",
        planning: "Reading the food request",
        hiring: "Finding someone who knows the local options",
        working: "Confirming the order",
        output: { id: "order-note", name: "Order note", category: "note" },
      },
      {
        id: "seller",
        title: "Find seller",
        planning: "Comparing nearby food sellers",
        hiring: "Asking for price and availability",
        working: "Selecting the best local seller",
        output: { id: "seller-match", name: "Seller match", category: "match" },
      },
      {
        id: "purchase",
        title: "Complete purchase",
        planning: "Preparing the purchase",
        hiring: "Confirming the transaction",
        working: "Buying the requested food",
        output: { id: "food-parcel", name: "Food parcel", category: "food" },
      },
      {
        id: "return",
        title: "Return with goods",
        planning: "Checking the collected items",
        hiring: "Confirming hand-off",
        working: "Returning with the purchase",
        output: { id: "purchase-receipt", name: "Purchase receipt", category: "receipt" },
      },
    ],
  },
  delivery: {
    label: "Delivery mission",
    stages: [
      {
        id: "prepare",
        title: "Prepare parcel",
        planning: "Checking the parcel and destination",
        hiring: "Finding delivery support",
        working: "Preparing the parcel",
        output: { id: "parcel-ready", name: "Prepared parcel", category: "parcel" },
      },
      {
        id: "route",
        title: "Plan route",
        planning: "Choosing the delivery route",
        hiring: "Coordinating pickup",
        working: "Moving through the route",
        output: { id: "route-plan", name: "Route plan", category: "plan" },
      },
      {
        id: "deliver",
        title: "Deliver parcel",
        planning: "Checking arrival conditions",
        hiring: "Confirming the receiver",
        working: "Completing delivery",
        output: { id: "delivery-receipt", name: "Delivery receipt", category: "receipt" },
      },
    ],
  },
  research: {
    label: "Research mission",
    stages: [
      {
        id: "question",
        title: "Frame question",
        planning: "Turning the goal into research questions",
        hiring: "Finding domain knowledge",
        working: "Defining the research frame",
        output: { id: "research-brief", name: "Research brief", category: "brief" },
      },
      {
        id: "evidence",
        title: "Collect evidence",
        planning: "Choosing useful evidence sources",
        hiring: "Coordinating evidence gathering",
        working: "Collecting evidence",
        output: { id: "evidence-set", name: "Evidence set", category: "research" },
      },
      {
        id: "analysis",
        title: "Analyze findings",
        planning: "Organizing observations",
        hiring: "Finding analytical support",
        working: "Analyzing the evidence",
        output: { id: "analysis-notes", name: "Analysis notes", category: "analysis" },
      },
      {
        id: "report",
        title: "Write report",
        planning: "Structuring the conclusion",
        hiring: "Reviewing the synthesis",
        working: "Writing the research report",
        output: { id: "research-report", name: "Research report", category: "report" },
      },
    ],
  },
  design: {
    label: "Design mission",
    stages: [
      {
        id: "brief",
        title: "Clarify brief",
        planning: "Understanding the visual goal",
        hiring: "Finding design perspective",
        working: "Writing the design brief",
        output: { id: "design-brief", name: "Design brief", category: "brief" },
      },
      {
        id: "direction",
        title: "Explore direction",
        planning: "Exploring visual directions",
        hiring: "Discussing references",
        working: "Building the visual direction",
        output: { id: "moodboard", name: "Moodboard", category: "design" },
      },
      {
        id: "create",
        title: "Create design",
        planning: "Preparing the design pass",
        hiring: "Agreeing the visual scope",
        working: "Creating the design",
        output: { id: "design-concept", name: "Design concept", category: "design" },
      },
      {
        id: "refine",
        title: "Refine package",
        planning: "Checking visual consistency",
        hiring: "Requesting final review",
        working: "Refining the final package",
        output: { id: "design-pack", name: "Final design pack", category: "deliverable" },
      },
    ],
  },
  web: {
    label: "Web product mission",
    stages: [
      {
        id: "scope",
        title: "Scope product",
        planning: "Turning the goal into a product scope",
        hiring: "Finding product capability",
        working: "Preparing the product brief",
        output: { id: "product-brief", name: "Product brief", category: "brief" },
      },
      {
        id: "interface",
        title: "Design interface",
        planning: "Mapping the user journey",
        hiring: "Coordinating interface design",
        working: "Designing the interface",
        output: { id: "interface-concept", name: "Interface concept", category: "design" },
      },
      {
        id: "build",
        title: "Build experience",
        planning: "Preparing the implementation route",
        hiring: "Agreeing the build hand-off",
        working: "Building the web experience",
        output: { id: "working-build", name: "Working build", category: "build" },
      },
      {
        id: "verify",
        title: "Verify quality",
        planning: "Preparing quality checks",
        hiring: "Finding a reviewer",
        working: "Testing the experience",
        output: { id: "qa-report", name: "QA report", category: "report" },
      },
      {
        id: "release",
        title: "Package release",
        planning: "Preparing the release package",
        hiring: "Confirming final ownership",
        working: "Packaging the release",
        output: { id: "release-package", name: "Release package", category: "deliverable" },
      },
    ],
  },
  automation: {
    label: "Automation mission",
    stages: [
      {
        id: "map",
        title: "Map workflow",
        planning: "Reading the current workflow",
        hiring: "Finding process knowledge",
        working: "Mapping the workflow",
        output: { id: "workflow-map", name: "Workflow map", category: "plan" },
      },
      {
        id: "logic",
        title: "Design logic",
        planning: "Choosing triggers and actions",
        hiring: "Reviewing automation logic",
        working: "Designing the automation",
        output: { id: "automation-spec", name: "Automation spec", category: "spec" },
      },
      {
        id: "build",
        title: "Build automation",
        planning: "Preparing the implementation",
        hiring: "Coordinating the build",
        working: "Building the automation",
        output: { id: "automation-flow", name: "Automation flow", category: "build" },
      },
      {
        id: "test",
        title: "Test edge cases",
        planning: "Preparing failure cases",
        hiring: "Finding a verifier",
        working: "Testing the workflow",
        output: { id: "automation-test", name: "Automation test report", category: "report" },
      },
      {
        id: "deploy",
        title: "Deploy workflow",
        planning: "Preparing deployment",
        hiring: "Confirming the final hand-off",
        working: "Deploying the workflow",
        output: { id: "automation-package", name: "Automation package", category: "deliverable" },
      },
    ],
  },
  learning: {
    label: "Learning mission",
    stages: [
      {
        id: "assess",
        title: "Assess level",
        planning: "Checking the current skill level",
        hiring: "Finding a suitable mentor",
        working: "Preparing the learning plan",
        output: { id: "learning-plan", name: "Learning plan", category: "plan" },
      },
      {
        id: "practice",
        title: "Practice skill",
        planning: "Choosing the practice target",
        hiring: "Coordinating guided practice",
        working: "Practicing the skill",
        output: { id: "practice-notes", name: "Practice notes", category: "learning" },
      },
      {
        id: "review",
        title: "Review progress",
        planning: "Preparing the review",
        hiring: "Requesting feedback",
        working: "Reviewing progress",
        output: { id: "skill-progress", name: "Skill progress record", category: "learning" },
      },
    ],
  },
  repair: {
    label: "Repair mission",
    stages: [
      {
        id: "diagnose",
        title: "Diagnose issue",
        planning: "Reading the symptoms",
        hiring: "Finding diagnostic knowledge",
        working: "Diagnosing the issue",
        output: { id: "diagnostic-note", name: "Diagnostic note", category: "report" },
      },
      {
        id: "fix",
        title: "Apply fix",
        planning: "Choosing a safe repair route",
        hiring: "Coordinating repair support",
        working: "Applying the fix",
        output: { id: "repair-result", name: "Repair result", category: "repair" },
      },
      {
        id: "verify",
        title: "Verify device",
        planning: "Preparing verification",
        hiring: "Requesting a final check",
        working: "Verifying the repair",
        output: { id: "repair-report", name: "Repair report", category: "report" },
      },
    ],
  },
  business: {
    label: "Business mission",
    stages: [
      {
        id: "offer",
        title: "Clarify offer",
        planning: "Clarifying the customer and value",
        hiring: "Finding product perspective",
        working: "Preparing the offer",
        output: { id: "offer-brief", name: "Offer brief", category: "brief" },
      },
      {
        id: "market",
        title: "Research market",
        planning: "Choosing market questions",
        hiring: "Finding market knowledge",
        working: "Researching the market",
        output: { id: "market-notes", name: "Market notes", category: "research" },
      },
      {
        id: "execute",
        title: "Prepare execution",
        planning: "Turning the offer into actions",
        hiring: "Coordinating execution",
        working: "Preparing the launch",
        output: { id: "launch-plan", name: "Launch plan", category: "plan" },
      },
      {
        id: "review",
        title: "Review launch",
        planning: "Preparing the final review",
        hiring: "Finding a reviewer",
        working: "Reviewing launch readiness",
        output: { id: "launch-package", name: "Launch package", category: "deliverable" },
      },
    ],
  },
  generic: {
    label: "General mission",
    stages: [
      {
        id: "understand",
        title: "Understand goal",
        planning: "Turning the goal into a clear route",
        hiring: "Finding the first useful capability",
        working: "Preparing the task brief",
        output: { id: "task-brief", name: "Task brief", category: "brief" },
      },
      {
        id: "execute",
        title: "Execute work",
        planning: "Preparing the work sequence",
        hiring: "Coordinating the right capability",
        working: "Executing the task",
        output: { id: "work-result", name: "Work result", category: "result" },
      },
      {
        id: "review",
        title: "Review result",
        planning: "Preparing final checks",
        hiring: "Finding a final reviewer",
        working: "Reviewing the result",
        output: { id: "final-delivery", name: "Final delivery", category: "deliverable" },
      },
    ],
  },
};

function safeArray<T>(key: string): T[] {
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
    // The process remains available in memory when storage is unavailable.
  }
}

function taskKind(text: string): TaskKind {
  const value = text.toLowerCase();
  if (/food|meal|bread|coffee|tea|grocery|lunch|dinner|食物|麵包|咖啡|茶|午餐|晚餐|日用品/.test(value)) return "food";
  if (/deliver|delivery|courier|parcel|配送|送貨|快遞/.test(value)) return "delivery";
  if (/repair|fix|diagnos|維修|修理|故障/.test(value)) return "repair";
  if (/learn|study|lesson|practice|course|學習|課程|練習/.test(value)) return "learning";
  if (/automat|workflow|agent flow|自動化|工作流|流程/.test(value)) return "automation";
  if (/website|web app|landing page|frontend|site|網頁|網站|前端/.test(value)) return "web";
  if (/design|brand|logo|visual|設計|品牌|視覺|圖標/.test(value)) return "design";
  if (/research|analysis|compare|evidence|研究|分析|比較|調查/.test(value)) return "research";
  if (/launch|business|product|market|customer|sell|商業|產品|市場|客戶|銷售/.test(value)) return "business";
  return "generic";
}

function fitStages(kind: TaskKind, count: number): ProcessStage[] {
  const source = TASKS[kind].stages;
  const size = Math.max(1, count);
  if (size === 1) {
    const selected = source[source.length - 1];
    return [{ ...selected, key: kind + "-0-" + selected.id }];
  }
  return Array.from({ length: size }, (_, index) => {
    const sourceIndex = Math.round((index * (source.length - 1)) / (size - 1));
    const selected = source[sourceIndex];
    return { ...selected, key: kind + "-" + String(index) + "-" + selected.id };
  });
}

function createRecord(mission: MissionSnapshot): ProcessRecord {
  const kind = taskKind(mission.title + " " + mission.description);
  return {
    missionId: mission.id,
    taskKind: kind,
    taskLabel: TASKS[kind].label,
    stages: fitStages(kind, mission.subtasks.length),
    currentStageIndex: 0,
    currentLabel: "Starting · " + TASKS[kind].label,
    progress: mission.progress,
    status: mission.status,
    awardedSubtaskIds: [],
    completed: mission.status === "completed",
    updatedAt: Date.now(),
  };
}

function stageIndexFor(mission: MissionSnapshot) {
  const next = mission.subtasks.findIndex((subtask) => subtask.status !== "completed");
  return next < 0 ? Math.max(0, mission.subtasks.length - 1) : next;
}

function processLabel(
  mission: MissionSnapshot,
  record: ProcessRecord,
  encounter: EncounterSnapshot | undefined,
) {
  const stage = record.stages[Math.min(record.currentStageIndex, record.stages.length - 1)];
  if (!stage) return record.taskLabel;
  if (mission.status === "new") return "Queued · " + record.taskLabel;
  if (mission.status === "blocked") return "Blocked · finding another route";
  if (mission.status === "completed") return "Complete · " + record.taskLabel;
  if (mission.status === "working") return "Working · " + stage.working;
  if (mission.status === "hiring") {
    if (!encounter) return "Finding help · " + stage.hiring;
    const partner = encounter.participants[1] ? " · " + encounter.participants[1] : "";
    if (encounter.phase === "approach") return "Approaching collaborator" + partner;
    if (encounter.phase === "greet") return "Opening conversation" + partner;
    if (encounter.phase === "discuss") return "Discussing · " + stage.title;
    if (encounter.phase === "deal") return "Agreeing scope · " + stage.title;
    if (encounter.phase === "close") return "Confirming hand-off" + partner;
    return "Starting work · " + stage.title;
  }
  return (record.currentStageIndex === 0 ? "Starting · " : "Next · ") + stage.planning;
}

function titleCaseId(value: string) {
  return value
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function readCityInventory(): InventoryView[] {
  try {
    const raw = localStorage.getItem(CITY_KEY);
    if (!raw) return [];
    const city = JSON.parse(raw) as CitySnapshot;
    const labels = new Map<string, string>();
    for (const business of city.businesses ?? []) {
      for (const product of business.products ?? []) labels.set(product.id, product.name);
      for (const service of business.services ?? []) labels.set(service.id, service.name);
    }
    const inventory = Object.entries(city.externalInventory ?? {}).map(([id, quantity]) => ({
      id: "city-product-" + id,
      name: labels.get(id) ?? titleCaseId(id),
      quantity,
      source: "city" as const,
      updatedAt: 0,
    }));
    const services = Object.entries(city.externalServices ?? {}).map(([id, quantity]) => ({
      id: "city-service-" + id,
      name: labels.get(id) ?? titleCaseId(id),
      quantity,
      source: "city" as const,
      updatedAt: 0,
    }));
    return [...inventory, ...services].filter((item) => item.quantity > 0);
  } catch {
    return [];
  }
}

function sameJson(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function TaskProcessRuntime() {
  const recordsRef = useRef<ProcessRecord[]>([]);
  const inventoryRef = useRef<TaskInventoryItem[]>([]);
  const dispatchedRef = useRef<Record<string, string>>({});
  const [activeRecord, setActiveRecord] = useState<ProcessRecord | null>(null);
  const [inventory, setInventory] = useState<TaskInventoryItem[]>([]);
  const [cityInventory, setCityInventory] = useState<InventoryView[]>([]);
  const [agentHost, setAgentHost] = useState<HTMLElement | null>(null);
  const [menuHost, setMenuHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    recordsRef.current = safeArray<ProcessRecord>(PROCESS_KEY);
    inventoryRef.current = safeArray<TaskInventoryItem>(INVENTORY_KEY);
    setInventory(inventoryRef.current);

    const sync = () => {
      const now = Date.now();
      const missions = safeArray<MissionSnapshot>(MISSIONS_KEY);
      const encounters = safeArray<EncounterSnapshot>(ENCOUNTERS_KEY);
      let records = [...recordsRef.current];
      let nextInventory = [...inventoryRef.current];
      let recordsChanged = false;
      let inventoryChanged = false;

      for (const mission of missions) {
        let record = records.find((candidate) => candidate.missionId === mission.id);
        if (!record) {
          record = createRecord(mission);
          records = [record, ...records];
          recordsChanged = true;
        }

        const currentStageIndex = Math.min(
          stageIndexFor(mission),
          Math.max(0, record.stages.length - 1),
        );
        let recentDelta = record.recentDelta;
        if (recentDelta && recentDelta.until < now) recentDelta = undefined;
        const awardedSubtaskIds = [...record.awardedSubtaskIds];

        mission.subtasks.forEach((subtask, index) => {
          if (subtask.status !== "completed" || awardedSubtaskIds.includes(subtask.id)) return;
          const stage = record?.stages[Math.min(index, record.stages.length - 1)];
          if (!stage) return;
          const itemId = "task-" + stage.output.id;
          const existing = nextInventory.find((item) => item.id === itemId);
          if (existing) {
            existing.quantity += 1;
            existing.updatedAt = now;
            existing.sourceMissionId = mission.id;
          } else {
            nextInventory = [
              {
                id: itemId,
                name: stage.output.name,
                category: stage.output.category,
                quantity: 1,
                sourceMissionId: mission.id,
                updatedAt: now,
              },
              ...nextInventory,
            ];
          }
          awardedSubtaskIds.push(subtask.id);
          recentDelta = { label: "+ " + stage.output.name, until: now + 5200 };
          inventoryChanged = true;
          window.dispatchEvent(
            new CustomEvent("asympta:task-inventory-updated", {
              detail: {
                missionId: mission.id,
                itemId,
                itemName: stage.output.name,
                quantity: 1,
              },
            }),
          );
        });

        const encounter = mission.currentEncounterId
          ? encounters.find((candidate) => candidate.id === mission.currentEncounterId)
          : undefined;
        const nextRecord: ProcessRecord = {
          ...record,
          currentStageIndex,
          currentLabel: processLabel(
            mission,
            { ...record, currentStageIndex },
            encounter,
          ),
          progress: mission.progress,
          status: mission.status,
          awardedSubtaskIds,
          recentDelta,
          completed: mission.status === "completed",
          updatedAt: mission.updatedAt ?? now,
        };

        if (!sameJson(record, nextRecord)) {
          records = records.map((candidate) =>
            candidate.missionId === mission.id ? nextRecord : candidate,
          );
          recordsChanged = true;
        }

        if (dispatchedRef.current[mission.id] !== nextRecord.currentLabel) {
          dispatchedRef.current[mission.id] = nextRecord.currentLabel;
          window.dispatchEvent(
            new CustomEvent("asympta:task-process", {
              detail: {
                missionId: mission.id,
                taskKind: nextRecord.taskKind,
                label: nextRecord.currentLabel,
                progress: nextRecord.progress,
                stage: nextRecord.currentStageIndex + 1,
                totalStages: nextRecord.stages.length,
              },
            }),
          );
        }
      }

      records = records
        .sort((left, right) => right.updatedAt - left.updatedAt)
        .slice(0, 12);
      nextInventory = nextInventory
        .sort((left, right) => right.updatedAt - left.updatedAt)
        .slice(0, 32);

      if (recordsChanged) {
        recordsRef.current = records;
        saveArray(PROCESS_KEY, records);
      }
      if (inventoryChanged) {
        inventoryRef.current = nextInventory;
        saveArray(INVENTORY_KEY, nextInventory);
        setInventory([...nextInventory]);
      }

      const activeMission =
        missions.find((mission) => mission.status !== "completed" && mission.status !== "new") ??
        missions.find((mission) => mission.status !== "completed");
      const active = activeMission
        ? records.find((record) => record.missionId === activeMission.id) ?? null
        : records.find(
            (record) =>
              Boolean(record.recentDelta && record.recentDelta.until >= now) ||
              (record.completed && now - record.updatedAt < 5200),
          ) ?? null;
      setActiveRecord(active ? { ...active } : null);
      setCityInventory(readCityInventory());
    };

    const initial = window.setTimeout(sync, 0);
    const timer = window.setInterval(sync, 380);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const scan = () => {
      const actual = document.querySelector<HTMLElement>(
        ".mission-user-agent:not([data-presence-fallback])",
      );
      const fallback = document.querySelector<HTMLElement>(
        ".mission-user-agent[data-presence-fallback]",
      );
      const nextAgent = actual ?? fallback;
      const nextMenu = document.querySelector<HTMLElement>(".agent-task-panel");
      setAgentHost((current) => (current === nextAgent ? current : nextAgent));
      setMenuHost((current) => (current === nextMenu ? current : nextMenu));
    };
    const initial = window.setTimeout(scan, 0);
    const timer = window.setInterval(scan, 520);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, []);

  const combinedInventory = useMemo(() => {
    const items = new Map<string, InventoryView>();
    for (const item of inventory) {
      items.set(item.id, {
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        source: "task",
        updatedAt: item.updatedAt,
      });
    }
    for (const item of cityInventory) {
      const existing = items.get(item.id);
      if (existing) existing.quantity += item.quantity;
      else items.set(item.id, item);
    }
    return [...items.values()]
      .sort((left, right) => right.updatedAt - left.updatedAt || left.name.localeCompare(right.name))
      .slice(0, 8);
  }, [cityInventory, inventory]);

  const activeStage = activeRecord
    ? activeRecord.stages[Math.min(activeRecord.currentStageIndex, activeRecord.stages.length - 1)]
    : undefined;
  const recentDelta = activeRecord?.recentDelta?.label;

  return (
    <>
      <style>{`
        .mission-user-agent { overflow: visible !important; }
        .task-process-bubble {
          position: absolute;
          z-index: 82;
          left: 50%;
          bottom: calc(100% + 46px);
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          align-items: center;
          gap: 3px 7px;
          width: max-content;
          max-width: 190px;
          padding: 7px 9px;
          transform: translateX(-50%);
          border: 1px solid rgba(118, 128, 120, .2);
          border-radius: 12px;
          background: rgba(248, 247, 241, .95);
          box-shadow: 0 8px 24px rgba(54, 63, 58, .08);
          color: #4b5650;
          pointer-events: none;
          backdrop-filter: blur(12px);
        }
        .task-process-bubble::after {
          content: "";
          position: absolute;
          left: 50%;
          bottom: -5px;
          width: 8px;
          height: 8px;
          transform: translateX(-50%) rotate(45deg);
          border-right: 1px solid rgba(118, 128, 120, .18);
          border-bottom: 1px solid rgba(118, 128, 120, .18);
          background: rgba(248, 247, 241, .95);
        }
        .task-process-index {
          display: grid;
          place-items: center;
          min-width: 27px;
          height: 20px;
          padding: 0 4px;
          border-radius: 8px;
          background: rgba(116, 139, 181, .1);
          color: #6279a5;
          font-family: var(--pixel-font);
          font-size: .31rem;
          letter-spacing: .035em;
        }
        .task-process-bubble strong {
          overflow: hidden;
          font-size: .5rem;
          font-weight: 650;
          line-height: 1.25;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .task-process-meter {
          grid-column: 1 / -1;
          height: 3px;
          overflow: hidden;
          border-radius: 99px;
          background: rgba(107, 119, 111, .11);
        }
        .task-process-meter i {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: #8295bd;
          transition: width 300ms ease;
        }
        .task-process-delta {
          grid-column: 1 / -1;
          color: #6d866f;
          font-family: var(--pixel-font);
          font-size: .32rem;
          font-weight: 700;
          letter-spacing: .025em;
        }

        .agent-task-panel { max-height: calc(100svh - 82px); overflow: auto; }
        .agent-task-panel .agent-resource-row .agent-resource-pill:nth-child(1),
        .agent-task-panel .agent-resource-row .agent-resource-pill:nth-child(2) {
          display: none !important;
        }
        .task-process-addon {
          display: grid;
          gap: 8px;
          margin-top: 10px;
          padding-top: 10px;
          border-top: 1px solid rgba(112, 120, 114, .11);
        }
        .task-process-addon-header,
        .task-process-addon-row,
        .task-inventory-title {
          display: flex;
          align-items: center;
          gap: 7px;
        }
        .task-process-addon-header { justify-content: space-between; }
        .task-process-addon-header span,
        .task-inventory-title {
          color: #858b86;
          font-family: var(--pixel-font);
          font-size: .36rem;
          letter-spacing: .06em;
          text-transform: uppercase;
        }
        .task-process-addon-header b {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 5px 7px;
          border-radius: 9px;
          background: rgba(116, 139, 181, .1);
          color: #5f75a1;
          font-family: var(--pixel-font);
          font-size: .33rem;
          letter-spacing: .03em;
        }
        .task-process-addon-header svg,
        .task-inventory-title svg { width: 12px; height: 12px; stroke-width: 1.8; }
        .task-process-addon-row {
          align-items: flex-start;
          color: #606a64;
          font-size: .49rem;
          line-height: 1.35;
        }
        .task-process-addon-row strong {
          margin-left: auto;
          flex: 0 0 auto;
          color: #4b554f;
          font-size: .46rem;
        }
        .task-stage-track {
          display: grid;
          grid-template-columns: repeat(var(--task-stage-count), minmax(8px, 1fr));
          gap: 4px;
        }
        .task-stage-track i {
          height: 4px;
          border-radius: 99px;
          background: rgba(110, 120, 113, .12);
        }
        .task-stage-track i[data-state="done"] { background: #7f9a83; }
        .task-stage-track i[data-state="current"] { background: #7d91ba; }
        .task-inventory-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
        }
        .task-inventory-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          max-width: 132px;
          padding: 5px 6px;
          border-radius: 8px;
          background: rgba(103, 118, 107, .06);
          color: #616b65;
          font-size: .41rem;
        }
        .task-inventory-chip span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .task-inventory-chip b {
          color: #4e5a53;
          font-size: .4rem;
        }
        .task-inventory-empty {
          color: #8a908c;
          font-size: .44rem;
        }
        @media (max-width: 620px) {
          .task-process-bubble { max-width: 160px; bottom: calc(100% + 42px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .task-process-meter i { transition: none; }
        }
      `}</style>

      {agentHost && activeRecord
        ? createPortal(
            <span className="task-process-bubble" aria-live="polite">
              <span className="task-process-index">
                {activeRecord.currentStageIndex + 1}/{activeRecord.stages.length}
              </span>
              <strong>{activeRecord.currentLabel}</strong>
              <span className="task-process-meter" aria-hidden="true">
                <i style={{ width: String(activeRecord.progress) + "%" }} />
              </span>
              {recentDelta ? <span className="task-process-delta">{recentDelta}</span> : null}
            </span>,
            agentHost,
            "task-process-bubble",
          )
        : null}

      {menuHost
        ? createPortal(
            <section className="task-process-addon" aria-label="Task process and inventory">
              <div className="task-process-addon-header">
                <span>Task process</span>
                <b><Sparkles aria-hidden="true" />∞ credits</b>
              </div>
              <div className="task-process-addon-row">
                <span>{activeRecord?.currentLabel ?? "Ready for a new task"}</span>
                <strong>{activeRecord ? activeRecord.progress + "%" : "idle"}</strong>
              </div>
              {activeRecord ? (
                <div
                  className="task-stage-track"
                  style={{ "--task-stage-count": activeRecord.stages.length } as React.CSSProperties}
                  aria-label={activeRecord.taskLabel + " stages"}
                >
                  {activeRecord.stages.map((stage, index) => (
                    <i
                      key={stage.key}
                      data-state={
                        index < activeRecord.currentStageIndex
                          ? "done"
                          : index === activeRecord.currentStageIndex
                            ? "current"
                            : "next"
                      }
                      title={stage.title}
                    />
                  ))}
                </div>
              ) : null}
              <div className="task-inventory-title"><Package aria-hidden="true" />Inventory</div>
              <div className="task-inventory-grid">
                {combinedInventory.length > 0 ? (
                  combinedInventory.map((item) => (
                    <span className="task-inventory-chip" key={item.id}>
                      <span>{item.name}</span>
                      <b>×{item.quantity}</b>
                    </span>
                  ))
                ) : (
                  <span className="task-inventory-empty">Task outputs and purchased resources appear here.</span>
                )}
              </div>
              {activeStage ? (
                <div className="task-process-addon-row">
                  <span>Current output</span>
                  <strong>{activeStage.output.name}</strong>
                </div>
              ) : null}
            </section>,
            menuHost,
            "task-process-addon",
          )
        : null}
    </>
  );
}
