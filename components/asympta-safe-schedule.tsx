"use client";

import { useEffect, useState } from "react";

type Locale = "en" | "zh-Hant" | "ja";

type TaskSnapshot = {
  id: string;
  title: string;
  agentId: string;
  status: string;
  progress: number;
  dependencies: string[];
  actionType: string | null;
};

type AgentSnapshot = {
  id: string;
  name: string;
  side: string;
  role: string;
  status: string;
  taskId: string | null;
};

type ForegroundSnapshot = {
  phase: string;
  workflow: string | null;
  tasks: TaskSnapshot[];
  agents: AgentSnapshot[];
  pendingApprovals: Array<{ id: string }>;
};

type DemoSnapshot = {
  foreground?: ForegroundSnapshot;
};

type ScheduleRow = {
  id: string;
  title: string;
  agentId: string;
  agentName: string;
  agentSide: string;
  taskStatus: string;
  agentStatus: string;
  progress: number;
};

type ResourceRow = {
  key: string;
  agentName: string;
  side: string;
  resource: string;
  state: string;
};

type Projection = {
  locale: Locale;
  phase: string;
  workflow: string | null;
  activeCount: number;
  approvalCount: number;
  rows: ScheduleRow[];
  resources: ResourceRow[];
};

const COPY: Record<Locale, Record<string, string>> = {
  en: {
    schedule: "Schedule",
    status: "Status",
    resources: "Resources",
    ready: "Ready",
    idle: "Ready",
    running: "Coordinating",
    waiting_approval: "Waiting for approval",
    completed: "Completed",
    blocked: "Blocked",
    active: "active",
    approval: "approval",
    queued: "Queued",
    moving: "Moving",
    working: "Working",
    sharing: "Sharing",
    waiting: "Waiting",
    returning: "Returning",
    done: "Done",
    inUse: "in use",
    available: "available",
    next: "next",
  },
  "zh-Hant": {
    schedule: "工作排程",
    status: "狀態",
    resources: "資源",
    ready: "就緒",
    idle: "就緒",
    running: "協作中",
    waiting_approval: "等待批准",
    completed: "已完成",
    blocked: "已暫停",
    active: "進行中",
    approval: "待批准",
    queued: "排程中",
    moving: "移動中",
    working: "工作中",
    sharing: "交接中",
    waiting: "等待中",
    returning: "返回中",
    done: "完成",
    inUse: "使用中",
    available: "可用",
    next: "下一步",
  },
  ja: {
    schedule: "タスク予定",
    status: "状態",
    resources: "リソース",
    ready: "準備完了",
    idle: "準備完了",
    running: "連携中",
    waiting_approval: "承認待ち",
    completed: "完了",
    blocked: "停止中",
    active: "進行中",
    approval: "承認待ち",
    queued: "予定",
    moving: "移動中",
    working: "作業中",
    sharing: "共有中",
    waiting: "待機中",
    returning: "帰還中",
    done: "完了",
    inUse: "使用中",
    available: "利用可能",
    next: "次",
  },
};

const WORKFLOW_NAMES: Record<Locale, Record<string, string>> = {
  en: {
    "Custom Order Network": "Custom Order Network",
    "Dinner Coordination": "Dinner Coordination",
    "Launch Stock Orchestration": "Launch Stock Orchestration",
    "Service Recovery Network": "Service Recovery Network",
  },
  "zh-Hant": {
    "Custom Order Network": "客製訂單協作",
    "Dinner Coordination": "晚餐協作",
    "Launch Stock Orchestration": "上架庫存協作",
    "Service Recovery Network": "服務復原協作",
  },
  ja: {
    "Custom Order Network": "カスタム注文連携",
    "Dinner Coordination": "夕食コーディネーション",
    "Launch Stock Orchestration": "ローンチ在庫連携",
    "Service Recovery Network": "サービス復旧連携",
  },
};

const TASK_TITLES: Record<"zh-Hant" | "ja", Record<string, string>> = {
  "zh-Hant": {
    "co-intent": "瞭解客製需求",
    "co-customer": "驗證客戶適配",
    "co-business": "建立商業報價",
    "co-supply": "檢查供應商產能",
    "co-quality": "驗證規格",
    "co-finance": "建模利潤與付款",
    "co-negotiate": "整合商業條款",
    "co-ops": "規劃生產與履約",
    "co-reserve": "預留供應商產能",
    "co-pay": "授權付款里程碑",
    "co-pack": "準備並品質檢查訂單",
    "co-dispatch": "放行出貨",
    "co-deliver": "交付給客戶",
    "co-aftercare": "確認滿意度與售後",
    "dn-intent": "理解晚餐需求",
    "dn-customer": "確認客戶偏好",
    "dn-business": "檢查餐廳產能",
    "dn-supplier": "確認食材供應",
    "dn-quality": "驗證替代方案",
    "dn-plan": "同步廚房與外送",
    "dn-authorize": "確認晚餐訂單",
    "dn-prepare": "準備晚餐",
    "dn-dispatch": "放行外送取件",
    "dn-deliver": "完成晚餐配送",
    "dn-feedback": "完成服務回饋循環",
    "ls-brief": "定義上架目標",
    "ls-market": "估算客戶需求",
    "ls-customer": "壓力測試客戶價值",
    "ls-supply": "整理供應限制",
    "ls-finance": "建模上架風險",
    "ls-quality": "定義上架品質閘門",
    "ls-plan": "建立營運計畫",
    "ls-reserve": "預留上架產能",
    "ls-budget": "授權上架預算",
    "ls-stage": "備妥上架庫存",
    "ls-release": "放行上架庫存",
    "ls-monitor": "啟動上架支援循環",
    "sr-triage": "分流服務故障",
    "sr-customer": "評估客戶影響",
    "sr-quality": "追查故障原因",
    "sr-supplier": "尋找替代產能",
    "sr-finance": "建模補救方案",
    "sr-plan": "建立復原計畫",
    "sr-reserve": "預留復原庫存",
    "sr-credit": "授權客戶補救",
    "sr-dispatch": "發送優先替換品",
    "sr-update": "發送復原更新",
  },
  ja: {
    "co-intent": "カスタム依頼を理解",
    "co-customer": "顧客適合性を確認",
    "co-business": "商業提案を作成",
    "co-supply": "サプライヤー能力を確認",
    "co-quality": "仕様を検証",
    "co-finance": "利益と支払いをモデル化",
    "co-negotiate": "商取引条件を収束",
    "co-ops": "生産と履行を計画",
    "co-reserve": "サプライヤー能力を予約",
    "co-pay": "支払いマイルストーンを承認",
    "co-pack": "注文を準備・品質確認",
    "co-dispatch": "出荷を解放",
    "co-deliver": "顧客へ配送",
    "co-aftercare": "満足度とアフターケアを確認",
    "dn-intent": "夕食ニーズを解釈",
    "dn-customer": "顧客の希望を確認",
    "dn-business": "レストランの受入能力を確認",
    "dn-supplier": "食材供給を確認",
    "dn-quality": "代替案を検証",
    "dn-plan": "キッチンと配達を同期",
    "dn-authorize": "夕食注文を確認",
    "dn-prepare": "夕食を準備",
    "dn-dispatch": "配達ピックアップを解放",
    "dn-deliver": "夕食配達を完了",
    "dn-feedback": "サービスループを完了",
    "ls-brief": "ローンチ目標を設定",
    "ls-market": "顧客需要を推定",
    "ls-customer": "顧客価値をストレステスト",
    "ls-supply": "供給制約を整理",
    "ls-finance": "ローンチリスクをモデル化",
    "ls-quality": "ローンチ品質ゲートを定義",
    "ls-plan": "運用計画を構築",
    "ls-reserve": "ローンチ能力を予約",
    "ls-budget": "ローンチ予算を承認",
    "ls-stage": "ローンチ在庫を準備",
    "ls-release": "ローンチ在庫を解放",
    "ls-monitor": "ローンチ支援ループを開始",
    "sr-triage": "サービス障害をトリアージ",
    "sr-customer": "顧客影響を評価",
    "sr-quality": "障害原因を追跡",
    "sr-supplier": "代替供給能力を確保",
    "sr-finance": "救済案をモデル化",
    "sr-plan": "復旧計画を構築",
    "sr-reserve": "復旧在庫を予約",
    "sr-credit": "顧客救済を承認",
    "sr-dispatch": "優先交換品を発送",
    "sr-update": "復旧状況を通知",
  },
};

const RESOURCES: Record<Locale, Record<string, string>> = {
  en: {
    user: "Confirmed preferences",
    customer: "Acceptance criteria",
    business: "Commercial context",
    supplier: "Capacity context",
    operations: "Fulfilment plan",
    finance: "Cost model",
    logistics: "Route capacity",
    support: "Customer context",
    quality: "Specification evidence",
    market: "Demand signals",
  },
  "zh-Hant": {
    user: "已確認偏好",
    customer: "驗收條件",
    business: "商業資訊",
    supplier: "供應產能",
    operations: "履約計畫",
    finance: "成本模型",
    logistics: "路線運力",
    support: "客戶資訊",
    quality: "規格證據",
    market: "需求訊號",
  },
  ja: {
    user: "確認済みの希望",
    customer: "受入条件",
    business: "商取引コンテキスト",
    supplier: "供給能力",
    operations: "履行計画",
    finance: "コストモデル",
    logistics: "配送容量",
    support: "顧客コンテキスト",
    quality: "仕様エビデンス",
    market: "需要シグナル",
  },
};

const ACTIVE_TASK = new Set(["moving", "working", "waiting_approval", "blocked"]);

function currentLocale(): Locale {
  const value = String(document.documentElement.lang || "en").toLowerCase();
  if (value.startsWith("zh")) return "zh-Hant";
  if (value.startsWith("ja")) return "ja";
  return "en";
}

function safeProgress(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(Math.max(0, Math.min(1, value)) * 100);
}

function localizedWorkflow(locale: Locale, workflow: string | null) {
  if (!workflow) return null;
  return WORKFLOW_NAMES[locale][workflow] ?? workflow;
}

function localizedTask(locale: Locale, task: TaskSnapshot) {
  if (locale === "en") return task.title;
  return TASK_TITLES[locale][task.id] ?? task.title;
}

function buildProjection(snapshot: DemoSnapshot, locale: Locale): Projection | null {
  const foreground = snapshot.foreground;
  if (!foreground || !Array.isArray(foreground.tasks) || !Array.isArray(foreground.agents)) return null;

  const agents = new Map(foreground.agents.map((agent) => [agent.id, agent]));
  const unfinished = foreground.tasks.filter((task) => task.status !== "done");
  const active = unfinished.filter((task) => ACTIVE_TASK.has(task.status));
  const queued = unfinished.filter((task) => task.status === "queued");
  const visibleTasks = [...active, ...queued].slice(0, 6);

  const rows: ScheduleRow[] = visibleTasks.map((task) => {
    const agent = agents.get(task.agentId);
    return {
      id: task.id,
      title: localizedTask(locale, task),
      agentId: task.agentId,
      agentName: agent?.name ?? task.agentId,
      agentSide: agent?.side ?? "",
      taskStatus: task.status,
      agentStatus: agent?.status ?? "idle",
      progress: safeProgress(task.progress),
    };
  });

  const resourceAgents = rows
    .map((row) => agents.get(row.agentId))
    .filter((agent): agent is AgentSnapshot => Boolean(agent));
  const seen = new Set<string>();
  const resources: ResourceRow[] = [];
  for (const agent of resourceAgents) {
    if (seen.has(agent.id)) continue;
    seen.add(agent.id);
    const activeState = ["moving", "working", "sharing", "waiting", "returning"].includes(agent.status);
    resources.push({
      key: agent.id,
      agentName: agent.name,
      side: agent.side,
      resource: RESOURCES[locale][agent.side] ?? agent.role,
      state: activeState ? COPY[locale].inUse : COPY[locale].available,
    });
    if (resources.length >= 4) break;
  }

  return {
    locale,
    phase: foreground.phase,
    workflow: localizedWorkflow(locale, foreground.workflow),
    activeCount: active.length,
    approvalCount: foreground.pendingApprovals?.length ?? 0,
    rows,
    resources,
  };
}

function focusAgent(agentId: string) {
  const marker = document.querySelector<HTMLElement>(`.animal-map-marker[data-agent-id="${agentId}"]`);
  marker?.click();
}

export function AsymptaSafeSchedule() {
  const [projection, setProjection] = useState<Projection | null>(null);

  useEffect(() => {
    let lastFingerprint = "";

    const sync = () => {
      if (document.visibilityState === "hidden") return;
      let snapshot: DemoSnapshot | undefined;
      try {
        snapshot = window.__ASYMPTA_DEMO__?.snapshot() as DemoSnapshot | undefined;
      } catch {
        return;
      }
      if (!snapshot) return;
      const next = buildProjection(snapshot, currentLocale());
      if (!next) return;
      const fingerprint = JSON.stringify(next);
      if (fingerprint === lastFingerprint) return;
      lastFingerprint = fingerprint;
      setProjection(next);
    };

    sync();
    const timer = window.setInterval(sync, 500);
    return () => window.clearInterval(timer);
  }, []);

  if (!projection) return null;

  const copy = COPY[projection.locale];
  const phase = copy[projection.phase] ?? projection.phase.replaceAll("_", " ");

  return (
    <aside className="atlas-safe-schedule" aria-label={copy.schedule}>
      <header className="atlas-safe-schedule__header">
        <div>
          <small>{copy.schedule}</small>
          <strong>{projection.workflow ?? copy.ready}</strong>
        </div>
        <span className={`atlas-safe-schedule__phase is-${projection.phase}`}><i />{phase}</span>
      </header>

      <div className="atlas-safe-schedule__summary" aria-label={copy.status}>
        <span><strong>{projection.activeCount}</strong> {copy.active}</span>
        {projection.approvalCount > 0 ? <span><strong>{projection.approvalCount}</strong> {copy.approval}</span> : null}
      </div>

      <div className="atlas-safe-schedule__tasks">
        {projection.rows.map((row) => {
          const status = copy[row.taskStatus] ?? copy[row.agentStatus] ?? row.taskStatus;
          const queued = row.taskStatus === "queued";
          return (
            <button key={row.id} type="button" className={`atlas-safe-task is-${row.taskStatus}`} onClick={() => focusAgent(row.agentId)}>
              <span className="atlas-safe-task__rail"><i /></span>
              <span className="atlas-safe-task__body">
                <strong>{row.title}</strong>
                <small>{row.agentName} · {status}</small>
              </span>
              <span className="atlas-safe-task__progress">{queued ? copy.next : `${row.progress}%`}</span>
            </button>
          );
        })}
      </div>

      {projection.resources.length > 0 ? (
        <section className="atlas-safe-resources" aria-label={copy.resources}>
          <div className="atlas-safe-resources__title">{copy.resources}</div>
          <div className="atlas-safe-resources__grid">
            {projection.resources.map((resource) => (
              <div key={resource.key} className="atlas-safe-resource">
                <span className="atlas-safe-resource__dot" data-side={resource.side} />
                <span><strong>{resource.resource}</strong><small>{resource.agentName} · {resource.state}</small></span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </aside>
  );
}
