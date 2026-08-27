"use client";

import { Check, LoaderCircle, Search, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type ProcessTone =
  | "planning"
  | "moving"
  | "talking"
  | "working"
  | "done"
  | "transaction"
  | "blocked";

type ScenarioRegistry = "city" | "mission";

type ScenarioStep = {
  registry: ScenarioRegistry;
  tool: string;
  input: Record<string, unknown>;
  label: string;
  detail: string;
  progress: number;
  tone: ProcessTone;
  pauseMs?: number;
};

type WebMcpScenario = {
  id: string;
  title: string;
  prompt: string;
  summary: string;
  keywords: string[];
  businesses: string[];
  steps: ScenarioStep[];
};

type Registry = {
  invoke: (name: string, input?: Record<string, unknown>) => Promise<unknown>;
};

type ScenarioRun = {
  scenarioId: string;
  title: string;
  status: "running" | "completed" | "failed";
  startedAt: number;
  completedAt?: number;
  completedSteps: number;
  totalSteps: number;
  lastTool?: string;
  error?: string;
};

const RUN_KEY = "asympta-webmcp-scenario-run-v1";

const SCENARIOS: WebMcpScenario[] = [
  {
    id: "breakfast-run",
    title: "早餐補給",
    prompt: "幫我準備一份簡單早餐和咖啡",
    summary: "搜尋食物 → 比較 Bakery / Cafe → 買麵包與咖啡",
    keywords: ["早餐", "食物", "coffee", "咖啡", "bakery", "cafe", "food"],
    businesses: ["Hearth Bakery", "Corner Cafe"],
    steps: [
      { registry: "city", tool: "city_search_businesses", input: { query: "food breakfast coffee" }, label: "理解需求", detail: "搜尋早餐、麵包與咖啡", progress: 8, tone: "planning" },
      { registry: "city", tool: "city_inspect_business", input: { businessId: "hearth-bakery" }, label: "比較選項", detail: "查看 Hearth Bakery 商品與庫存", progress: 22, tone: "talking" },
      { registry: "city", tool: "city_execute_action", input: { businessId: "hearth-bakery", action: "buy_product", agentId: "your-agent", itemId: "milk-bun", quantity: 1 }, label: "購買早餐", detail: "Your Agent 前往 Hearth Bakery", progress: 48, tone: "moving" },
      { registry: "city", tool: "city_inspect_business", input: { businessId: "corner-cafe" }, label: "尋找飲品", detail: "檢查 Corner Cafe 咖啡", progress: 66, tone: "talking" },
      { registry: "city", tool: "city_execute_action", input: { businessId: "corner-cafe", action: "buy_product", agentId: "your-agent", itemId: "coffee", quantity: 1 }, label: "購買咖啡", detail: "完成第二筆在地交易", progress: 92, tone: "transaction" },
    ],
  },
  {
    id: "weekly-groceries",
    title: "一週食材補給",
    prompt: "幫我買一些一週會用到的基本食材和日用品",
    summary: "搜尋 Grocery → 看庫存 → 買水果、米與 Daily kit",
    keywords: ["食材", "雜貨", "grocery", "rice", "水果", "日用品", "買"],
    businesses: ["Market Grocer"],
    steps: [
      { registry: "city", tool: "city_search_businesses", input: { query: "grocery food resource" }, label: "拆解清單", detail: "尋找食材與日用品來源", progress: 8, tone: "planning" },
      { registry: "city", tool: "city_inspect_business", input: { businessId: "market-grocer" }, label: "檢查庫存", detail: "讀取 Market Grocer 價格與現貨", progress: 22, tone: "talking" },
      { registry: "city", tool: "city_execute_action", input: { businessId: "market-grocer", action: "buy_product", agentId: "your-agent", itemId: "fruit-box", quantity: 1 }, label: "購買水果", detail: "加入 Fruit box 到 inventory", progress: 45, tone: "transaction" },
      { registry: "city", tool: "city_execute_action", input: { businessId: "market-grocer", action: "buy_product", agentId: "your-agent", itemId: "rice-pack", quantity: 1 }, label: "購買主食", detail: "加入 Rice pack 到 inventory", progress: 68, tone: "transaction" },
      { registry: "city", tool: "city_execute_action", input: { businessId: "market-grocer", action: "buy_product", agentId: "your-agent", itemId: "daily-kit", quantity: 1 }, label: "補齊用品", detail: "加入 Daily kit 到 inventory", progress: 94, tone: "transaction" },
    ],
  },
  {
    id: "device-repair",
    title: "裝置維修",
    prompt: "我的裝置電池有問題，幫我找維修、先詢價再預約",
    summary: "搜尋 Repair → Quote → 預約 Battery fix",
    keywords: ["repair", "維修", "電池", "battery", "手機", "device", "quote"],
    businesses: ["Pixel Repair"],
    steps: [
      { registry: "city", tool: "city_search_businesses", input: { query: "repair battery device" }, label: "尋找維修", detail: "搜尋可處理電池問題的商店", progress: 8, tone: "planning" },
      { registry: "city", tool: "city_inspect_business", input: { businessId: "pixel-repair" }, label: "檢查服務", detail: "查看 Pixel Repair 價格、時長與 slots", progress: 25, tone: "talking" },
      { registry: "city", tool: "city_execute_action", input: { businessId: "pixel-repair", action: "request_quote", agentId: "your-agent", itemId: "battery-fix" }, label: "取得報價", detail: "向 Pixel Repair 詢問 Battery fix", progress: 48, tone: "talking" },
      { registry: "city", tool: "city_execute_action", input: { businessId: "pixel-repair", action: "book_service", agentId: "your-agent", itemId: "battery-fix" }, label: "確認維修", detail: "預約 Battery fix 並更新 service inventory", progress: 94, tone: "transaction" },
    ],
  },
  {
    id: "brand-launch-kit",
    title: "品牌發佈包",
    prompt: "替一個平靜極簡的新品牌準備視覺概念、品牌方向和名片",
    summary: "啟動 specialist mission → Design Studio → 印名片",
    keywords: ["品牌", "brand", "design", "名片", "visual", "launch", "branding"],
    businesses: ["Soft Form Studio", "Tiny Print"],
    steps: [
      { registry: "mission", tool: "submit_user_goal", input: { goal: "為一個平靜極簡的新品牌建立視覺概念、品牌方向與簡短文案", budget: 200 }, label: "啟動 AI 任務", detail: "Your Agent 尋找設計、品牌與文案 specialist", progress: 8, tone: "planning" },
      { registry: "city", tool: "city_search_businesses", input: { query: "design branding" }, label: "搜尋在地設計", detail: "尋找可以補充 specialist 工作的 business", progress: 24, tone: "planning" },
      { registry: "city", tool: "city_inspect_business", input: { businessId: "soft-form-studio" }, label: "比較設計服務", detail: "查看 Visual concept 與 Brand sprint", progress: 38, tone: "talking" },
      { registry: "city", tool: "city_execute_action", input: { businessId: "soft-form-studio", action: "book_service", agentId: "your-agent", itemId: "visual-concept" }, label: "預約視覺概念", detail: "把 Visual concept 加入服務 inventory", progress: 62, tone: "transaction" },
      { registry: "city", tool: "city_inspect_business", input: { businessId: "tiny-print" }, label: "準備實體物料", detail: "查看 Tiny Print 名片庫存", progress: 76, tone: "talking" },
      { registry: "city", tool: "city_execute_action", input: { businessId: "tiny-print", action: "buy_product", agentId: "your-agent", itemId: "cards-50", quantity: 1 }, label: "完成名片", detail: "50 cards 加入 inventory", progress: 94, tone: "transaction" },
    ],
  },
  {
    id: "event-setup",
    title: "小型活動準備",
    prompt: "幫我準備一個小型活動：餐飲、印刷物和即日配送",
    summary: "Catering → Print → Same-day courier",
    keywords: ["活動", "event", "catering", "配送", "courier", "print", "聚會"],
    businesses: ["Corner Cafe", "Tiny Print", "Swift Courier"],
    steps: [
      { registry: "city", tool: "city_search_businesses", input: { query: "event food print delivery" }, label: "規劃活動", detail: "同時搜尋餐飲、印刷與配送", progress: 8, tone: "planning" },
      { registry: "city", tool: "city_execute_action", input: { businessId: "corner-cafe", action: "book_service", agentId: "your-agent", itemId: "catering" }, label: "預約餐飲", detail: "Small catering 加入 services", progress: 34, tone: "transaction" },
      { registry: "city", tool: "city_execute_action", input: { businessId: "tiny-print", action: "buy_product", agentId: "your-agent", itemId: "cards-50", quantity: 1 }, label: "準備印刷物", detail: "取得 50 cards", progress: 58, tone: "transaction" },
      { registry: "city", tool: "city_execute_action", input: { businessId: "swift-courier", action: "book_service", agentId: "your-agent", itemId: "same-day" }, label: "安排配送", detail: "預約 Same-day delivery", progress: 92, tone: "transaction" },
    ],
  },
  {
    id: "focus-learning-day",
    title: "學習＋專注工作日",
    prompt: "幫我安排一節技能學習，之後找一個安靜工作位完成練習",
    summary: "Learning session → Focus booth / workspace",
    keywords: ["學習", "learning", "技能", "工作位", "focus", "coworking", "study"],
    businesses: ["Little Learning", "Quiet Desk"],
    steps: [
      { registry: "city", tool: "city_search_businesses", input: { query: "learning workspace focus" }, label: "安排學習日", detail: "搜尋學習與工作空間", progress: 10, tone: "planning" },
      { registry: "city", tool: "city_inspect_business", input: { businessId: "little-learning" }, label: "選擇課程", detail: "比較 Skill session 與 Mentor hour", progress: 28, tone: "talking" },
      { registry: "city", tool: "city_execute_action", input: { businessId: "little-learning", action: "book_service", agentId: "your-agent", itemId: "skill-session" }, label: "預約學習", detail: "Skill session 加入 inventory", progress: 52, tone: "transaction" },
      { registry: "city", tool: "city_inspect_business", input: { businessId: "quiet-desk" }, label: "尋找工作位", detail: "查看 Focus booth 可用 slots", progress: 70, tone: "talking" },
      { registry: "city", tool: "city_execute_action", input: { businessId: "quiet-desk", action: "book_service", agentId: "your-agent", itemId: "focus-booth" }, label: "進入專注模式", detail: "Focus booth 加入 services", progress: 94, tone: "transaction" },
    ],
  },
  {
    id: "support-automation",
    title: "自動化客服流程",
    prompt: "幫我設計一個自動化客戶查詢流程，先分析再建立 workflow",
    summary: "Specialist mission → Automation audit → Small workflow",
    keywords: ["automation", "自動化", "客服", "workflow", "customer", "查詢", "support"],
    businesses: ["Loop Lab"],
    steps: [
      { registry: "mission", tool: "submit_user_goal", input: { goal: "分析客戶查詢流程並設計可執行的自動化 workflow，包括 QA 與營運檢查", budget: 260 }, label: "啟動自動化任務", detail: "Your Agent 尋找 automation / QA specialist", progress: 8, tone: "planning" },
      { registry: "city", tool: "city_inspect_business", input: { businessId: "loop-lab" }, label: "檢查 Automation Lab", detail: "讀取 audit 與 workflow capacity", progress: 28, tone: "talking" },
      { registry: "city", tool: "city_execute_action", input: { businessId: "loop-lab", action: "request_quote", agentId: "your-agent", itemId: "small-workflow" }, label: "取得方案報價", detail: "向 Loop Lab 詢問 Small workflow", progress: 46, tone: "talking" },
      { registry: "city", tool: "city_execute_action", input: { businessId: "loop-lab", action: "book_service", agentId: "your-agent", itemId: "automation-audit" }, label: "先做流程 Audit", detail: "Automation audit 加入 services", progress: 68, tone: "transaction" },
      { registry: "city", tool: "city_execute_action", input: { businessId: "loop-lab", action: "book_service", agentId: "your-agent", itemId: "small-workflow" }, label: "建立 Workflow", detail: "Small workflow 加入 services", progress: 94, tone: "transaction" },
    ],
  },
  {
    id: "print-campaign",
    title: "宣傳印刷 Campaign",
    prompt: "幫我做一個小型宣傳 campaign，需要概念、海報、名片和 rush print",
    summary: "Visual concept → Posters → Cards → Rush print",
    keywords: ["campaign", "海報", "poster", "名片", "印刷", "print", "宣傳"],
    businesses: ["Soft Form Studio", "Tiny Print"],
    steps: [
      { registry: "city", tool: "city_search_businesses", input: { query: "design print poster cards" }, label: "規劃宣傳物料", detail: "搜尋設計與印刷服務", progress: 8, tone: "planning" },
      { registry: "city", tool: "city_execute_action", input: { businessId: "soft-form-studio", action: "book_service", agentId: "your-agent", itemId: "visual-concept" }, label: "建立視覺概念", detail: "Visual concept 加入 services", progress: 30, tone: "transaction" },
      { registry: "city", tool: "city_execute_action", input: { businessId: "tiny-print", action: "buy_product", agentId: "your-agent", itemId: "posters-10", quantity: 1 }, label: "取得海報", detail: "10 posters 加入 inventory", progress: 54, tone: "transaction" },
      { registry: "city", tool: "city_execute_action", input: { businessId: "tiny-print", action: "buy_product", agentId: "your-agent", itemId: "cards-50", quantity: 1 }, label: "取得名片", detail: "50 cards 加入 inventory", progress: 74, tone: "transaction" },
      { registry: "city", tool: "city_execute_action", input: { businessId: "tiny-print", action: "book_service", agentId: "your-agent", itemId: "rush-print" }, label: "完成 Rush print", detail: "Rush print 加入 services", progress: 94, tone: "transaction" },
    ],
  },
  {
    id: "product-launch",
    title: "產品快速上市",
    prompt: "幫我把一個新產品快速推上市：策略、品牌、工作空間和自動化",
    summary: "Product mission → Brand sprint → Workspace → Automation audit",
    keywords: ["產品", "product", "launch", "策略", "strategy", "品牌", "上市"],
    businesses: ["Soft Form Studio", "Quiet Desk", "Loop Lab"],
    steps: [
      { registry: "mission", tool: "submit_user_goal", input: { goal: "為一個新產品制定上市策略、品牌訊息、前端展示與 QA 檢查", budget: 320 }, label: "建立 Launch mission", detail: "拆解 product strategy / branding / frontend / QA", progress: 8, tone: "planning" },
      { registry: "city", tool: "city_execute_action", input: { businessId: "soft-form-studio", action: "book_service", agentId: "your-agent", itemId: "brand-sprint" }, label: "啟動 Brand sprint", detail: "Brand sprint 加入 services", progress: 38, tone: "transaction" },
      { registry: "city", tool: "city_execute_action", input: { businessId: "quiet-desk", action: "buy_product", agentId: "your-agent", itemId: "day-pass", quantity: 1 }, label: "建立工作基地", detail: "Desk day pass 加入 inventory", progress: 62, tone: "transaction" },
      { registry: "city", tool: "city_execute_action", input: { businessId: "loop-lab", action: "book_service", agentId: "your-agent", itemId: "automation-audit" }, label: "檢查營運自動化", detail: "Automation audit 加入 services", progress: 90, tone: "transaction" },
    ],
  },
  {
    id: "local-business-launch",
    title: "在地小店開張",
    prompt: "幫一間新的 local business 從零準備品牌、印刷、配送和營運 workflow",
    summary: "Business mission → Design → Print → Courier → Automation",
    keywords: ["business", "小店", "開店", "local", "品牌", "營運", "business launch"],
    businesses: ["Soft Form Studio", "Tiny Print", "Swift Courier", "Loop Lab"],
    steps: [
      { registry: "mission", tool: "submit_user_goal", input: { goal: "替一間新的 local business 建立定位、品牌、產品說明與基本營運流程", budget: 380 }, label: "建立開店任務", detail: "Your Agent 組合 strategy / design / copy / automation", progress: 7, tone: "planning" },
      { registry: "city", tool: "city_execute_action", input: { businessId: "soft-form-studio", action: "book_service", agentId: "your-agent", itemId: "brand-sprint" }, label: "建立品牌", detail: "預約 Brand sprint", progress: 30, tone: "transaction" },
      { registry: "city", tool: "city_execute_action", input: { businessId: "tiny-print", action: "buy_product", agentId: "your-agent", itemId: "cards-50", quantity: 1 }, label: "準備開店物料", detail: "50 cards 加入 inventory", progress: 50, tone: "transaction" },
      { registry: "city", tool: "city_execute_action", input: { businessId: "swift-courier", action: "book_service", agentId: "your-agent", itemId: "local-delivery" }, label: "建立配送", detail: "Local delivery 加入 services", progress: 70, tone: "transaction" },
      { registry: "city", tool: "city_execute_action", input: { businessId: "loop-lab", action: "book_service", agentId: "your-agent", itemId: "small-workflow" }, label: "建立營運 Workflow", detail: "Small workflow 加入 services", progress: 94, tone: "transaction" },
    ],
  },
];

function registry(kind: ScenarioRegistry): Registry | undefined {
  const target = window as unknown as {
    __ASYMPTA_CITY_WEBMCP__?: Registry;
    __ASYMPTA_MISSION_WEBMCP__?: Registry;
  };
  return kind === "city" ? target.__ASYMPTA_CITY_WEBMCP__ : target.__ASYMPTA_MISSION_WEBMCP__;
}

async function waitForRegistry(kind: ScenarioRegistry) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const found = registry(kind);
    if (found) return found;
    await new Promise<void>((resolve) => window.setTimeout(resolve, 100));
  }
  throw new Error(kind === "city" ? "City WebMCP registry is not ready." : "Mission WebMCP registry is not ready.");
}

function emitProcess(label: string, detail: string, progress: number, tone: ProcessTone) {
  window.dispatchEvent(
    new CustomEvent("asympta:user-task-process", {
      detail: { label, detail, progress, tone },
    }),
  );
}

function setNativeInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function scoreScenario(scenario: WebMcpScenario, query: string) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return 1;
  const haystack = [
    scenario.title,
    scenario.prompt,
    scenario.summary,
    ...scenario.keywords,
    ...scenario.businesses,
  ]
    .join(" ")
    .toLowerCase();
  if (!terms.every((term) => haystack.includes(term))) return 0;
  return terms.reduce((score, term) => score + (scenario.title.toLowerCase().includes(term) ? 4 : 1), 0);
}

function saveRun(run: ScenarioRun) {
  try {
    localStorage.setItem(RUN_KEY, JSON.stringify(run));
  } catch {
    // Scenario remains usable in memory-only mode.
  }
}

export function WebMcpScenarioRuntime() {
  const runTokenRef = useRef(0);
  const [composer, setComposer] = useState<HTMLFormElement | null>(null);
  const [input, setInput] = useState<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [runProgress, setRunProgress] = useState(0);
  const [runDetail, setRunDetail] = useState("");
  const [lastCompletedId, setLastCompletedId] = useState<string | null>(null);

  useEffect(() => {
    const scan = () => {
      const nextComposer = document.querySelector<HTMLFormElement>(".need-composer");
      const nextInput = nextComposer?.querySelector<HTMLInputElement>('input[aria-label="What do you need?"]') ?? null;
      setComposer((current) => (current === nextComposer ? current : nextComposer));
      setInput((current) => (current === nextInput ? current : nextInput));
    };
    const initial = window.setTimeout(scan, 0);
    const timer = window.setInterval(scan, 700);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, []);

  const matches = useMemo(
    () =>
      SCENARIOS.map((scenario) => ({ scenario, score: scoreScenario(scenario, query) }))
        .filter((entry) => entry.score > 0)
        .sort((left, right) => right.score - left.score)
        .map((entry) => entry.scenario),
    [query],
  );

  useEffect(() => {
    if (!input) return;
    const sync = () => {
      setQuery(input.value);
      setActiveIndex(0);
    };
    const onFocus = () => {
      setFocused(true);
      sync();
    };
    const onBlur = () => window.setTimeout(() => setFocused(false), 120);
    input.addEventListener("input", sync);
    input.addEventListener("focus", onFocus);
    input.addEventListener("blur", onBlur);
    return () => {
      input.removeEventListener("input", sync);
      input.removeEventListener("focus", onFocus);
      input.removeEventListener("blur", onBlur);
    };
  }, [input]);

  const runScenario = useCallback(
    async (scenario: WebMcpScenario) => {
      if (runningId) return;
      const token = runTokenRef.current + 1;
      runTokenRef.current = token;
      setRunningId(scenario.id);
      setRunProgress(2);
      setRunDetail("AI planner 正在拆解 scenario");
      setFocused(false);
      setLastCompletedId(null);
      if (input) setNativeInputValue(input, scenario.prompt);

      let run: ScenarioRun = {
        scenarioId: scenario.id,
        title: scenario.title,
        status: "running",
        startedAt: Date.now(),
        completedSteps: 0,
        totalSteps: scenario.steps.length,
      };
      saveRun(run);
      emitProcess("AI 分析需求", scenario.title + " · 建立 WebMCP 執行計畫", 2, "planning");

      try {
        for (let index = 0; index < scenario.steps.length; index += 1) {
          if (runTokenRef.current !== token) return;
          const step = scenario.steps[index];
          setRunProgress(step.progress);
          setRunDetail(step.label + " · " + step.detail);
          emitProcess(step.label, step.detail, step.progress, step.tone);
          const targetRegistry = await waitForRegistry(step.registry);
          await targetRegistry.invoke(step.tool, step.input);
          run = {
            ...run,
            completedSteps: index + 1,
            lastTool: step.tool,
          };
          saveRun(run);
          await new Promise<void>((resolve) => window.setTimeout(resolve, step.pauseMs ?? 520));
        }

        emitProcess(
          "Scenario 完成",
          scenario.title + " · 真實 city state / inventory 已更新",
          100,
          "done",
        );
        run = {
          ...run,
          status: "completed",
          completedAt: Date.now(),
          completedSteps: scenario.steps.length,
        };
        saveRun(run);
        setRunProgress(100);
        setRunDetail("完成 · inventory 與 services 已同步");
        setLastCompletedId(scenario.id);
        window.setTimeout(() => {
          if (runTokenRef.current !== token) return;
          setRunningId(null);
          setRunProgress(0);
          setRunDetail("");
          if (input && input.value === scenario.prompt) setNativeInputValue(input, "");
        }, 2600);
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Scenario execution failed.";
        emitProcess("Scenario 暫停", message, runProgress, "blocked");
        saveRun({
          ...run,
          status: "failed",
          completedAt: Date.now(),
          error: message,
        });
        setRunDetail(message);
        window.setTimeout(() => setRunningId(null), 3200);
      }
    },
    [input, runProgress, runningId],
  );

  useEffect(() => {
    if (!input) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!focused || runningId || matches.length === 0) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((value) => (value + 1) % matches.length);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((value) => (value - 1 + matches.length) % matches.length);
      } else if (event.key === "Enter") {
        event.preventDefault();
        void runScenario(matches[Math.min(activeIndex, matches.length - 1)]);
      } else if (event.key === "Escape") {
        setFocused(false);
        input.blur();
      }
    };
    input.addEventListener("keydown", onKeyDown);
    return () => input.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, focused, input, matches, runScenario, runningId]);

  if (!composer) return null;

  const showPicker = focused && !runningId && matches.length > 0;
  return createPortal(
    <>
      <style>{`
        .need-composer { overflow: visible !important; }
        .webmcp-scenario-picker {
          position: absolute;
          left: 0;
          right: 44px;
          bottom: 50px;
          z-index: 120;
          max-height: min(334px, 46svh);
          overflow: auto;
          padding: 6px;
          border: 1px solid rgba(111, 122, 113, .16);
          border-radius: 16px;
          background: rgba(248, 247, 241, .96);
          box-shadow: 0 16px 44px rgba(48, 58, 52, .11);
          backdrop-filter: blur(18px);
        }
        .webmcp-scenario-head {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 7px 7px;
          color: #7d857f;
          font-family: var(--pixel-font);
          font-size: .31rem;
          letter-spacing: .06em;
          text-transform: uppercase;
        }
        .webmcp-scenario-head svg { width: 11px; height: 11px; }
        .webmcp-scenario-option {
          display: grid;
          grid-template-columns: 22px minmax(0, 1fr) auto;
          align-items: center;
          gap: 8px;
          width: 100%;
          min-height: 50px;
          padding: 7px 8px;
          border: 0;
          border-radius: 11px;
          background: transparent;
          color: #46504a;
          text-align: left;
          cursor: pointer;
        }
        .webmcp-scenario-option:hover,
        .webmcp-scenario-option.is-active {
          background: rgba(106, 124, 111, .075);
          outline: none;
        }
        .webmcp-scenario-option > i {
          display: grid;
          place-items: center;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: rgba(116, 139, 181, .1);
          color: #647ba9;
          font-style: normal;
        }
        .webmcp-scenario-option > i svg { width: 11px; height: 11px; }
        .webmcp-scenario-copy { display: grid; gap: 2px; min-width: 0; }
        .webmcp-scenario-copy strong { font-size: .53rem; font-weight: 680; }
        .webmcp-scenario-copy small {
          overflow: hidden;
          color: #7a827d;
          font-size: .4rem;
          line-height: 1.25;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .webmcp-scenario-option em {
          max-width: 92px;
          overflow: hidden;
          color: #929993;
          font-family: var(--pixel-font);
          font-size: .27rem;
          font-style: normal;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .webmcp-scenario-running {
          position: absolute;
          left: 0;
          right: 44px;
          bottom: 50px;
          z-index: 119;
          display: grid;
          gap: 5px;
          padding: 8px 10px;
          border: 1px solid rgba(116, 139, 181, .17);
          border-radius: 14px;
          background: rgba(248, 247, 241, .94);
          color: #59655e;
          box-shadow: 0 10px 30px rgba(48, 58, 52, .08);
          backdrop-filter: blur(16px);
          pointer-events: none;
        }
        .webmcp-scenario-running header {
          display: flex;
          align-items: center;
          gap: 6px;
          min-width: 0;
        }
        .webmcp-scenario-running header svg { width: 12px; height: 12px; color: #6b82ae; }
        .webmcp-scenario-running header strong {
          overflow: hidden;
          font-family: var(--pixel-font);
          font-size: .34rem;
          letter-spacing: .04em;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .webmcp-scenario-running small {
          overflow: hidden;
          color: #7c8580;
          font-size: .4rem;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .webmcp-scenario-progress { height: 3px; overflow: hidden; border-radius: 99px; background: rgba(111, 125, 115, .1); }
        .webmcp-scenario-progress i { display: block; height: 100%; border-radius: inherit; background: #788db5; transition: width 320ms ease; }
        @media (max-width: 620px) {
          .webmcp-scenario-picker,
          .webmcp-scenario-running { right: 0; }
          .webmcp-scenario-option em { display: none; }
          .webmcp-scenario-picker { max-height: 42svh; }
        }
        @media (prefers-reduced-motion: reduce) {
          .webmcp-scenario-progress i { transition: none; }
        }
      `}</style>

      {showPicker ? (
        <section className="webmcp-scenario-picker" aria-label="Select a WebMCP AI simulation scenario">
          <div className="webmcp-scenario-head"><Search aria-hidden="true" /> 10 WebMCP scenarios · type to filter</div>
          {matches.map((scenario, index) => (
            <button
              key={scenario.id}
              type="button"
              className={"webmcp-scenario-option" + (index === activeIndex ? " is-active" : "")}
              onPointerDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => void runScenario(scenario)}
            >
              <i>{lastCompletedId === scenario.id ? <Check aria-hidden="true" /> : <Sparkles aria-hidden="true" />}</i>
              <span className="webmcp-scenario-copy">
                <strong>{scenario.title}</strong>
                <small>{scenario.summary}</small>
              </span>
              <em>{scenario.businesses.join(" · ")}</em>
            </button>
          ))}
        </section>
      ) : null}

      {runningId ? (
        <div className="webmcp-scenario-running" aria-live="polite">
          <header>
            {runProgress >= 100 ? <Check aria-hidden="true" /> : <LoaderCircle aria-hidden="true" />}
            <strong>AI SIM · {SCENARIOS.find((scenario) => scenario.id === runningId)?.title}</strong>
          </header>
          <small>{runDetail}</small>
          <span className="webmcp-scenario-progress" aria-hidden="true"><i style={{ width: String(runProgress) + "%" }} /></span>
        </div>
      ) : null}
    </>,
    composer,
  );
}
