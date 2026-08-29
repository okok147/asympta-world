"use client";

import { useEffect } from "react";

type Locale = "en" | "zh-Hant" | "ja";
type Task = { id: string; title: string; agentId: string; status: string };
type Agent = { id: string; name: string; side: string; role: string; status: string };
type Approval = { id: string; source?: string; title?: string; actionType?: string | null; taskId?: string | null };
type Ambient = { id: string; name: string; side: string; role: string; organisation: string; status: string; task: string };
type Snapshot = {
  foreground?: {
    tasks?: Task[];
    agents?: Agent[];
    pendingApprovals?: Approval[];
  };
  ambient?: Ambient[];
};

const REFRESH_MS = 400;
const ACTIVE = new Set(["moving", "working", "waiting_approval", "blocked"]);

const COPY: Record<Locale, Record<string, string>> = {
  en: {
    waitingApproval: "Waiting for approval",
    approvalTitle: "Approve",
    approvalDetail: "This simulated step needs approval before the workflow can continue.",
    approvalConsequence: "Only the local simulation will advance. No real order, payment, inventory reservation or shipment will occur.",
    nearby: "nearby agents",
    movingAgents: "workflow agents moving",
  },
  "zh-Hant": {
    waitingApproval: "等待批准",
    approvalTitle: "批准",
    approvalDetail: "此模擬步驟需要批准後，工作流程才會繼續。",
    approvalConsequence: "只會推進本地模擬，不會產生真實訂單、付款、庫存預留或出貨。",
    nearby: "個附近角色",
    movingAgents: "個工作流角色移動中",
  },
  ja: {
    waitingApproval: "承認待ち",
    approvalTitle: "承認",
    approvalDetail: "このシミュレーション手順は、ワークフローを続行する前に承認が必要です。",
    approvalConsequence: "進むのはローカルのシミュレーションだけです。実際の注文、支払い、在庫予約、出荷は行いません。",
    nearby: "周辺エージェント",
    movingAgents: "ワークフローエージェント移動中",
  },
};

const FOREGROUND_META: Record<Locale, Record<string, { role: string; organisation: string }>> = {
  en: {
    "agent-user": { role: "Personal intent agent", organisation: "You" },
    "agent-customer": { role: "Customer advocate", organisation: "Customer side" },
    "agent-business": { role: "Business coordinator", organisation: "Merchant network" },
    "agent-supplier": { role: "Supplier agent", organisation: "Supply network" },
    "agent-operations": { role: "Operations planner", organisation: "Operations" },
    "agent-finance": { role: "Finance controller", organisation: "Finance" },
    "agent-logistics": { role: "Logistics dispatcher", organisation: "Delivery network" },
    "agent-support": { role: "Service recovery agent", organisation: "Customer support" },
    "agent-quality": { role: "Quality verifier", organisation: "Quality assurance" },
    "agent-market": { role: "Market intelligence agent", organisation: "Market intelligence" },
  },
  "zh-Hant": {
    "agent-user": { role: "個人需求代理", organisation: "你" },
    "agent-customer": { role: "客戶需求代理", organisation: "客戶端" },
    "agent-business": { role: "商業協調代理", organisation: "商家網絡" },
    "agent-supplier": { role: "供應代理", organisation: "供應網絡" },
    "agent-operations": { role: "營運規劃代理", organisation: "營運" },
    "agent-finance": { role: "財務控制代理", organisation: "財務" },
    "agent-logistics": { role: "物流調度代理", organisation: "配送網絡" },
    "agent-support": { role: "服務復原代理", organisation: "客戶支援" },
    "agent-quality": { role: "品質驗證代理", organisation: "品質保證" },
    "agent-market": { role: "市場情報代理", organisation: "市場情報" },
  },
  ja: {
    "agent-user": { role: "個人意図エージェント", organisation: "あなた" },
    "agent-customer": { role: "顧客担当エージェント", organisation: "顧客側" },
    "agent-business": { role: "ビジネス調整エージェント", organisation: "加盟店ネットワーク" },
    "agent-supplier": { role: "サプライヤーエージェント", organisation: "供給ネットワーク" },
    "agent-operations": { role: "オペレーション計画エージェント", organisation: "オペレーション" },
    "agent-finance": { role: "財務管理エージェント", organisation: "財務" },
    "agent-logistics": { role: "物流配車エージェント", organisation: "配送ネットワーク" },
    "agent-support": { role: "サービス復旧エージェント", organisation: "カスタマーサポート" },
    "agent-quality": { role: "品質検証エージェント", organisation: "品質保証" },
    "agent-market": { role: "市場情報エージェント", organisation: "市場情報" },
  },
};

const TASKS: Record<"zh-Hant" | "ja", Record<string, string>> = {
  "zh-Hant": {
    "co-intent": "瞭解客製需求", "co-customer": "驗證客戶適配", "co-business": "建立商業報價", "co-supply": "檢查供應商產能",
    "co-quality": "驗證規格", "co-finance": "建模利潤與付款", "co-negotiate": "整合商業條款", "co-ops": "規劃生產與履約",
    "co-reserve": "預留供應商產能", "co-pay": "授權付款里程碑", "co-pack": "準備並品質檢查訂單", "co-dispatch": "放行出貨",
    "co-deliver": "交付給客戶", "co-aftercare": "確認滿意度與售後", "dn-intent": "理解晚餐需求", "dn-customer": "確認客戶偏好",
    "dn-business": "檢查餐廳產能", "dn-supplier": "確認食材供應", "dn-quality": "驗證替代方案", "dn-plan": "同步廚房與外送",
    "dn-authorize": "確認晚餐訂單", "dn-prepare": "準備晚餐", "dn-dispatch": "放行外送取件", "dn-deliver": "完成晚餐配送",
    "dn-feedback": "完成服務回饋循環", "ls-brief": "定義上架目標", "ls-market": "估算客戶需求", "ls-customer": "壓力測試客戶價值",
    "ls-supply": "整理供應限制", "ls-finance": "建模上架風險", "ls-quality": "定義上架品質閘門", "ls-plan": "建立營運計畫",
    "ls-reserve": "預留上架產能", "ls-budget": "授權上架預算", "ls-stage": "備妥上架庫存", "ls-release": "放行上架庫存",
    "ls-monitor": "啟動上架支援循環", "sr-triage": "分流服務故障", "sr-customer": "評估客戶影響", "sr-quality": "追查故障原因",
    "sr-supplier": "尋找替代產能", "sr-finance": "建模補救方案", "sr-plan": "建立復原計畫", "sr-reserve": "預留復原庫存",
    "sr-credit": "授權客戶補救", "sr-dispatch": "發送優先替換品", "sr-update": "發送復原更新",
  },
  ja: {
    "co-intent": "カスタム依頼を理解", "co-customer": "顧客適合性を確認", "co-business": "商業提案を作成", "co-supply": "サプライヤー能力を確認",
    "co-quality": "仕様を検証", "co-finance": "利益と支払いをモデル化", "co-negotiate": "商取引条件を収束", "co-ops": "生産と履行を計画",
    "co-reserve": "サプライヤー能力を予約", "co-pay": "支払いマイルストーンを承認", "co-pack": "注文を準備・品質確認", "co-dispatch": "出荷を解放",
    "co-deliver": "顧客へ配送", "co-aftercare": "満足度とアフターケアを確認", "dn-intent": "夕食ニーズを解釈", "dn-customer": "顧客の希望を確認",
    "dn-business": "レストランの受入能力を確認", "dn-supplier": "食材供給を確認", "dn-quality": "代替案を検証", "dn-plan": "キッチンと配達を同期",
    "dn-authorize": "夕食注文を確認", "dn-prepare": "夕食を準備", "dn-dispatch": "配達ピックアップを解放", "dn-deliver": "夕食配達を完了",
    "dn-feedback": "サービスループを完了", "ls-brief": "ローンチ目標を設定", "ls-market": "顧客需要を推定", "ls-customer": "顧客価値をストレステスト",
    "ls-supply": "供給制約を整理", "ls-finance": "ローンチリスクをモデル化", "ls-quality": "ローンチ品質ゲートを定義", "ls-plan": "運用計画を構築",
    "ls-reserve": "ローンチ能力を予約", "ls-budget": "ローンチ予算を承認", "ls-stage": "ローンチ在庫を準備", "ls-release": "ローンチ在庫を解放",
    "ls-monitor": "ローンチ支援ループを開始", "sr-triage": "サービス障害をトリアージ", "sr-customer": "顧客影響を評価", "sr-quality": "障害原因を追跡",
    "sr-supplier": "代替供給能力を確保", "sr-finance": "救済案をモデル化", "sr-plan": "復旧計画を構築", "sr-reserve": "復旧在庫を予約",
    "sr-credit": "顧客救済を承認", "sr-dispatch": "優先交換品を発送", "sr-update": "復旧状況を通知",
  },
};

const AMBIENT_TASKS: Record<"zh-Hant" | "ja", Record<string, string>> = {
  "zh-Hant": {
    "Comparing dinner options": "比較晚餐選項", "Finding a repair slot": "尋找維修時段", "Planning a custom order": "規劃客製訂單", "Checking delivery choices": "檢查配送選項",
    "Reviewing an offer": "檢視報價", "Confirming requirements": "確認需求", "Checking replacement timing": "檢查替換時間", "Comparing service options": "比較服務選項",
    "Preparing a quote": "準備報價", "Responding to an order": "處理訂單", "Checking merchant capacity": "檢查商家產能", "Coordinating a service request": "協調服務請求",
    "Checking material stock": "檢查材料庫存", "Reserving production capacity": "預留生產產能", "Confirming lead time": "確認交期", "Preparing replenishment": "準備補貨",
    "Sequencing fulfilment": "安排履約次序", "Planning preparation": "規劃準備工作", "Rebalancing workload": "重新平衡工作量", "Coordinating handoffs": "協調交接",
    "Checking payment terms": "檢查付款條款", "Reviewing margin exposure": "檢視利潤風險", "Approving a demo budget": "批准模擬預算", "Reconciling an order": "核對訂單",
    "Routing a courier": "規劃外送路線", "Collecting a parcel": "收取包裹", "Rebalancing deliveries": "重新平衡配送", "Preparing a last-mile handoff": "準備最後一哩交接",
    "Following up a customer": "跟進客戶", "Resolving a service issue": "處理服務問題", "Sending a recovery update": "發送復原更新", "Checking aftercare": "檢查售後服務",
    "Verifying a specification": "驗證規格", "Checking a replacement": "檢查替換品", "Reviewing acceptance criteria": "檢視驗收條件", "Inspecting a demo order": "檢查模擬訂單",
    "Watching demand signals": "觀察需求訊號", "Comparing local activity": "比較本地活動", "Estimating launch demand": "估算上架需求", "Reviewing customer interest": "檢視客戶興趣",
  },
  ja: {
    "Comparing dinner options": "夕食候補を比較", "Finding a repair slot": "修理枠を検索", "Planning a custom order": "カスタム注文を計画", "Checking delivery choices": "配送方法を確認",
    "Reviewing an offer": "提案を確認", "Confirming requirements": "要件を確認", "Checking replacement timing": "交換時期を確認", "Comparing service options": "サービス案を比較",
    "Preparing a quote": "見積もりを準備", "Responding to an order": "注文に対応", "Checking merchant capacity": "店舗能力を確認", "Coordinating a service request": "サービス依頼を調整",
    "Checking material stock": "材料在庫を確認", "Reserving production capacity": "生産能力を予約", "Confirming lead time": "リードタイムを確認", "Preparing replenishment": "補充を準備",
    "Sequencing fulfilment": "履行順序を調整", "Planning preparation": "準備工程を計画", "Rebalancing workload": "作業負荷を再調整", "Coordinating handoffs": "引き継ぎを調整",
    "Checking payment terms": "支払い条件を確認", "Reviewing margin exposure": "利益リスクを確認", "Approving a demo budget": "デモ予算を承認", "Reconciling an order": "注文を照合",
    "Routing a courier": "配達ルートを計画", "Collecting a parcel": "荷物を集荷", "Rebalancing deliveries": "配送を再調整", "Preparing a last-mile handoff": "ラストマイル引き渡しを準備",
    "Following up a customer": "顧客をフォロー", "Resolving a service issue": "サービス問題を解決", "Sending a recovery update": "復旧情報を送信", "Checking aftercare": "アフターケアを確認",
    "Verifying a specification": "仕様を検証", "Checking a replacement": "交換品を確認", "Reviewing acceptance criteria": "受入基準を確認", "Inspecting a demo order": "デモ注文を検査",
    "Watching demand signals": "需要シグナルを監視", "Comparing local activity": "地域活動を比較", "Estimating launch demand": "ローンチ需要を推定", "Reviewing customer interest": "顧客関心を確認",
  },
};

const SIDE_ROLE: Record<Locale, Record<string, string>> = {
  en: { user: "User agent", customer: "Customer agent", business: "Business agent", supplier: "Supplier agent", operations: "Operations agent", finance: "Finance agent", logistics: "Logistics agent", support: "Support agent", quality: "Quality agent", market: "Market agent" },
  "zh-Hant": { user: "使用者代理", customer: "客戶代理", business: "商業代理", supplier: "供應代理", operations: "營運代理", finance: "財務代理", logistics: "物流代理", support: "支援代理", quality: "品質代理", market: "市場代理" },
  ja: { user: "ユーザーエージェント", customer: "顧客エージェント", business: "ビジネスエージェント", supplier: "供給エージェント", operations: "運用エージェント", finance: "財務エージェント", logistics: "物流エージェント", support: "サポートエージェント", quality: "品質エージェント", market: "市場エージェント" },
};

const STATUS: Record<Locale, Record<string, string>> = {
  en: { idle: "Ready", moving: "Moving", working: "Working", sharing: "Sharing", waiting: "Waiting", returning: "Returning" },
  "zh-Hant": { idle: "就緒", moving: "移動中", working: "工作中", sharing: "交接中", waiting: "等待中", returning: "返回中" },
  ja: { idle: "準備完了", moving: "移動中", working: "作業中", sharing: "共有中", waiting: "待機中", returning: "帰還中" },
};

const TOOL_LABELS: Record<Locale, Record<string, string>> = {
  en: {
    asympta_observe_living_city: "Observe living city", asympta_list_workflows: "List workflows", asympta_follow_agent: "Follow agent",
    asympta_request_workflow: "Request workflow", asympta_request_external_action: "Request external action",
  },
  "zh-Hant": {
    asympta_observe_living_city: "檢視協作城市", asympta_list_workflows: "列出工作流程", asympta_follow_agent: "跟隨代理",
    asympta_request_workflow: "請求工作流程", asympta_request_external_action: "請求外部動作",
  },
  ja: {
    asympta_observe_living_city: "協調都市を観察", asympta_list_workflows: "ワークフロー一覧", asympta_follow_agent: "エージェントを追従",
    asympta_request_workflow: "ワークフローを要求", asympta_request_external_action: "外部アクションを要求",
  },
};

const ACTIONS: Record<Locale, Record<string, string>> = {
  en: { reserve_capacity: "Reserve capacity", authorize_payment: "Authorise payment", release_shipment: "Release shipment", send_customer_update: "Send customer update" },
  "zh-Hant": { reserve_capacity: "預留產能", authorize_payment: "授權付款", release_shipment: "放行出貨", send_customer_update: "發送客戶更新" },
  ja: { reserve_capacity: "容量を予約", authorize_payment: "支払いを承認", release_shipment: "出荷を解放", send_customer_update: "顧客更新を送信" },
};

function locale(): Locale {
  const value = document.documentElement.lang.toLowerCase();
  if (value.startsWith("zh")) return "zh-Hant";
  if (value.startsWith("ja")) return "ja";
  return "en";
}

function setData(node: Element | null, key: string, value: string) {
  if (!(node instanceof HTMLElement)) return;
  if (node.dataset[key] !== value) node.dataset[key] = value;
}

function localTask(lang: Locale, task: Task | undefined) {
  if (!task) return "";
  return lang === "en" ? task.title : TASKS[lang][task.id] ?? task.title;
}

export function AsymptaGlobalLocale() {
  useEffect(() => {
    const sync = () => {
      if (document.hidden) return;
      let snapshot: Snapshot | undefined;
      try { snapshot = window.__ASYMPTA_DEMO__?.snapshot() as Snapshot | undefined; } catch { return; }
      const foreground = snapshot?.foreground;
      if (!foreground) return;
      const lang = locale();
      const copy = COPY[lang];
      const tasks = foreground.tasks ?? [];
      const approvals = foreground.pendingApprovals ?? [];
      const agents = foreground.agents ?? [];

      for (const agent of agents) {
        const marker = document.querySelector<HTMLElement>(`.animal-map-marker--foreground[data-agent-id="${agent.id}"]`);
        if (!marker) continue;
        const task = tasks.find((item) => item.agentId === agent.id && ACTIVE.has(item.status));
        const approval = approvals.find((item) => item.taskId === task?.id);
        const meta = FOREGROUND_META[lang][agent.id];
        const dialogue = approval ? copy.waitingApproval : task ? localTask(lang, task) : meta?.role ?? agent.role;
        setData(marker.querySelector(".animal-map-marker__dialogue"), "asymptaLocaleText", dialogue);
        marker.title = `${agent.name} · ${meta?.role ?? agent.role}`;
      }

      for (const actor of snapshot?.ambient ?? []) {
        const marker = document.querySelector<HTMLElement>(`.animal-map-marker--ambient[data-agent-id="${actor.id}"]`);
        if (!marker) continue;
        const task = lang === "en" ? actor.task : AMBIENT_TASKS[lang][actor.task] ?? actor.task;
        const role = SIDE_ROLE[lang][actor.side] ?? actor.role;
        setData(marker.querySelector(".animal-map-marker__dialogue"), "asymptaLocaleText", task);
        setData(marker.querySelector(".animal-map-marker__status-text"), "asymptaAmbientStatus", STATUS[lang][actor.status] ?? actor.status);
        marker.title = `${actor.name} · ${role} · ${task}`;
      }

      const pending = approvals[0];
      const approvalCard = document.querySelector(".atlas-approval__copy");
      if (pending && approvalCard) {
        const task = tasks.find((item) => item.id === pending.taskId);
        const action = pending.actionType ? ACTIONS[lang][pending.actionType] : undefined;
        const subject = action ?? localTask(lang, task) || pending.title || copy.approvalTitle;
        const title = lang === "en" ? pending.title || `${copy.approvalTitle}: ${subject}` : `${copy.approvalTitle}：${subject}`;
        setData(approvalCard.querySelector("strong"), "asymptaLocaleText", title);
        setData(approvalCard.querySelector("p"), "asymptaLocaleText", copy.approvalDetail);
        setData(approvalCard.querySelector("small"), "asymptaLocaleText", copy.approvalConsequence);
      }

      document.querySelectorAll<HTMLElement>(".atlas-webmcp-tool-list button").forEach((button) => {
        const tool = button.querySelector("small")?.textContent?.trim() ?? "";
        const label = TOOL_LABELS[lang][tool];
        if (label) setData(button.querySelector("strong"), "asymptaLocaleText", label);
      });

      const summary = document.querySelector<HTMLElement>(".atlas-status-stack .atlas-tool-state:nth-child(2)");
      const moving = agents.filter((agent) => agent.status === "moving").length;
      const ambientCount = snapshot?.ambient?.length ?? 0;
      const summaryText = lang === "en"
        ? `${ambientCount} ${copy.nearby} · ${moving} ${copy.movingAgents}`
        : lang === "zh-Hant"
          ? `${ambientCount} ${copy.nearby} · ${moving} ${copy.movingAgents}`
          : `${copy.nearby} ${ambientCount} · ${copy.movingAgents} ${moving}`;
      setData(summary, "asymptaLocaleSummary", summaryText);
    };

    sync();
    const timer = window.setInterval(sync, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, []);

  return null;
}
