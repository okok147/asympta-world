"use client";

import { useEffect } from "react";

type Locale = "en" | "zh-Hant" | "ja";
type Agent = { id: string; status: string; role: string; name: string; taskId: string | null };
type Task = { id: string; title: string; agentId: string; status: string };
type Snapshot = { foreground?: { agents?: Agent[]; tasks?: Task[] } };

const META: Record<Locale, Record<string, string>> = {
  en: {
    "agent-user": "Personal intent agent · You",
    "agent-customer": "Customer advocate · Customer side",
    "agent-business": "Business coordinator · Merchant network",
    "agent-supplier": "Supplier agent · Supply network",
    "agent-operations": "Operations planner · Operations",
    "agent-finance": "Finance controller · Finance",
    "agent-logistics": "Logistics dispatcher · Delivery network",
    "agent-support": "Service recovery agent · Customer support",
    "agent-quality": "Quality verifier · Quality assurance",
    "agent-market": "Market intelligence agent · Market intelligence",
  },
  "zh-Hant": {
    "agent-user": "個人需求代理 · 你",
    "agent-customer": "客戶需求代理 · 客戶端",
    "agent-business": "商業協調代理 · 商家網絡",
    "agent-supplier": "供應代理 · 供應網絡",
    "agent-operations": "營運規劃代理 · 營運",
    "agent-finance": "財務控制代理 · 財務",
    "agent-logistics": "物流調度代理 · 配送網絡",
    "agent-support": "服務復原代理 · 客戶支援",
    "agent-quality": "品質驗證代理 · 品質保證",
    "agent-market": "市場情報代理 · 市場情報",
  },
  ja: {
    "agent-user": "個人意図エージェント · あなた",
    "agent-customer": "顧客担当エージェント · 顧客側",
    "agent-business": "ビジネス調整エージェント · 加盟店ネットワーク",
    "agent-supplier": "サプライヤーエージェント · 供給ネットワーク",
    "agent-operations": "オペレーション計画エージェント · オペレーション",
    "agent-finance": "財務管理エージェント · 財務",
    "agent-logistics": "物流配車エージェント · 配送ネットワーク",
    "agent-support": "サービス復旧エージェント · カスタマーサポート",
    "agent-quality": "品質検証エージェント · 品質保証",
    "agent-market": "市場情報エージェント · 市場情報",
  },
};

const STATUS: Record<Locale, Record<string, string>> = {
  en: { idle: "Ready", moving: "Moving", working: "Working", sharing: "Sharing", waiting: "Waiting", returning: "Returning" },
  "zh-Hant": { idle: "就緒", moving: "移動中", working: "工作中", sharing: "交接中", waiting: "等待中", returning: "返回中" },
  ja: { idle: "準備完了", moving: "移動中", working: "作業中", sharing: "共有中", waiting: "待機中", returning: "帰還中" },
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

function locale(): Locale {
  const value = document.documentElement.lang.toLowerCase();
  if (value.startsWith("zh")) return "zh-Hant";
  if (value.startsWith("ja")) return "ja";
  return "en";
}

function setLocalized(node: Element | null, value: string) {
  if (!(node instanceof HTMLElement)) return;
  if (node.dataset.asymptaLocalized !== value) node.dataset.asymptaLocalized = value;
}

export function AsymptaAgentCardLocale() {
  useEffect(() => {
    const sync = () => {
      if (document.hidden) return;
      const card = document.querySelector(".atlas-agent-card");
      if (!card) return;
      const marker = document.querySelector<HTMLElement>(".animal-map-marker--foreground.is-selected");
      const agentId = marker?.dataset.agentId;
      if (!agentId) return;

      let snapshot: Snapshot | undefined;
      try { snapshot = window.__ASYMPTA_DEMO__?.snapshot() as Snapshot | undefined; } catch { return; }
      const foreground = snapshot?.foreground;
      const agent = foreground?.agents?.find((item) => item.id === agentId);
      if (!agent) return;
      const currentTask = foreground?.tasks?.find((task) => task.agentId === agentId && ["moving", "working", "waiting_approval", "blocked"].includes(task.status));
      const lang = locale();
      const taskTitle = currentTask
        ? lang === "en" ? currentTask.title : TASKS[lang][currentTask.id] ?? currentTask.title
        : lang === "zh-Hant" ? "待命中" : lang === "ja" ? "待機中" : "Standing by";

      setLocalized(card.querySelector(".atlas-agent-card__top > div > small"), META[lang][agentId] ?? agent.role);
      setLocalized(card.querySelector(".atlas-agent-status span:first-child"), STATUS[lang][agent.status] ?? agent.status);
      setLocalized(card.querySelector(".atlas-agent-status span:last-child"), taskTitle);
    };

    sync();
    const timer = window.setInterval(sync, 400);
    return () => window.clearInterval(timer);
  }, []);

  return null;
}
