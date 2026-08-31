"use client";

import { useEffect } from "react";

type Locale = "en" | "zh-Hant" | "ja";
type Key = keyof typeof COPY["zh-Hant"];

const COPY = {
  "zh-Hant": {
    planning: "代理正在根據已確認要求建立可驗證的執行方案。",
    searching: "代理正在尋找符合條件的可用選項。",
    logistics: "物流代理正在準備送達或自取安排。",
    verifying: "獨立驗證代理正在核對要求、證據與完成狀態。",
    coordinating: "協調代理正在整合各專業代理的結果。",
    completed: "專業代理網絡已在模擬 Asympta World 內完成並驗證任務。",
    prepared: "任務要求已完整確認及驗證，但尚未執行任何真實外部行動。",
    verified: "所有必要資料、受限代理分工及協調證據均已驗證。",
    approve: "批准這項已連接的外部行動？",
    consequence: "批准後可能產生外部承諾；目前尚未執行任何行動。",
    compiled: "已把原始意圖整理成可追蹤、可驗證的任務要求。",
    waiting: "正等待下一項必要資料，不會重新解讀整個意圖。",
    ready: "必要資料已齊全，正在啟動受限代理協調。",
    progress: "代理已安全更新任務進度。",
    approval: "批准決定已記錄，任務會依安全邊界繼續。",
    failed: "任務未能安全完成，代理已停止並保留目前狀態。",
    notReady: "Task Kernel 暫時未準備好，請稍後再試。",
    stale: "任務資料剛剛已更新，請使用最新選項再試。",
    locked: "這項資料已由你確認，代理不能覆寫。",
    missing: "找不到目前的任務資料，請重新開始這一步。",
    terminal: "這個任務已經結束，無需再次提交。",
    invalid: "這項操作已失效，請使用最新畫面再試。",
  },
  ja: {
    planning: "エージェントが確認済みの条件から検証可能な実行計画を作成しています。",
    searching: "エージェントが条件に合う利用可能な候補を探しています。",
    logistics: "物流エージェントが配送または受取方法を準備しています。",
    verifying: "独立検証エージェントが条件・根拠・完了状態を確認しています。",
    coordinating: "調整エージェントが専門エージェントの結果を統合しています。",
    completed: "専門エージェント網がシミュレーションの Asympta World 内でタスクを完了し、検証しました。",
    prepared: "タスクの条件は確定・検証済みですが、実際の外部操作は実行していません。",
    verified: "必要情報、制限された担当、連携の根拠をすべて検証しました。",
    approve: "接続された外部操作を承認しますか？",
    consequence: "承認すると外部の確約が発生する可能性があります。まだ操作は実行していません。",
    compiled: "元の意図を追跡・検証可能なタスク要件に整理しました。",
    waiting: "意図全体を解釈し直さず、次に必要な情報だけを待っています。",
    ready: "必要情報が揃ったため、制限付きエージェント連携を開始します。",
    progress: "エージェントがタスクの進行状況を安全に更新しました。",
    approval: "承認結果を記録し、安全境界に沿ってタスクを続行します。",
    failed: "タスクを安全に完了できなかったため、現在の状態を保持して停止しました。",
    notReady: "Task Kernel の準備ができていません。少し待って再試行してください。",
    stale: "タスク情報が更新されました。最新の選択肢でもう一度お試しください。",
    locked: "この情報はユーザー確認済みのため、エージェントは上書きできません。",
    missing: "現在のタスク情報が見つかりません。この手順をやり直してください。",
    terminal: "このタスクはすでに終了しているため、再送信は不要です。",
    invalid: "この操作は無効になりました。最新の画面でもう一度お試しください。",
  },
} as const;

const RULES: Array<[RegExp, Key]> = [
  [/^(?:Compare suitable televisions|Discover matching performances first|Use confirmed requirements)/i, "planning"],
  [/^(?:Discover matching television offers|Search matching performances|Retailer agents|The event agent)/i, "searching"],
  [/^(?:Prepare delivery or pickup route|The logistics agent)/i, "logistics"],
  [/^(?:Verify constraints|Verify the selected|Verify the result|The independent verifier)/i, "verifying"],
  [/^(?:Coordinate the best|The coordinator)/i, "coordinating"],
  [/^The specialist agent mesh completed/i, "completed"],
  [/^The task is fully specified and verified/i, "prepared"],
  [/^(?:All required facts|All requirements and approval boundaries)/i, "verified"],
  [/^Approve the connected external action\?$/i, "approve"],
  [/^Approval may create an external commitment/i, "consequence"],
  [/^(?:Created one revisioned task|Compiled missing information)/i, "compiled"],
  [/^(?:Waiting only for the next unresolved requirement|Advanced to the next unresolved requirement)/i, "waiting"],
  [/^(?:Every required fact is available|All requirements are resolved)/i, "ready"],
  [/^(?:Assigned |Started |Completed |Applied a bounded patch|Confirmed |Resolved |Rejected an agent attempt)/i, "progress"],
  [/^(?:Approved the bounded external action|Rejected the external action|Approval recorded)/i, "approval"],
  [/^(?:The task was cancelled|One or more agent assignments|The verifier finished without|An agent assignment disappeared|The bounded agent mesh exceeded|Task verification failed:|No logical agent is registered for )/i, "failed"],
  [/^The Task Kernel is not ready yet/i, "notReady"],
  [/ is at revision .+ not /i, "stale"],
  [/locked by a human confirmation/i, "locked"],
  [/(?:Task|Requirement|Assignment) .+ was not found/i, "missing"],
  [/Task .+ is already /i, "terminal"],
  [/(?:identity did not match|is not pending)/i, "invalid"],
];

const SOURCE = new WeakMap<Text, string>();
const LAST = new WeakMap<Text, string>();

function locale(): Locale {
  const value = document.documentElement.lang.toLowerCase();
  if (value.startsWith("zh")) return "zh-Hant";
  if (value.startsWith("ja")) return "ja";
  return "en";
}

function translation(source: string, selected: Locale) {
  const key = RULES.find(([pattern]) => pattern.test(source))?.[1];
  if (!key) return null;
  return selected === "en" ? source : COPY[selected][key];
}

function project(node: Text, selected: Locale) {
  const raw = node.nodeValue ?? "";
  const text = raw.trim();
  if (!text) return;
  const previous = LAST.get(node);
  let source = SOURCE.get(node);
  if (!source || (previous !== undefined && text !== previous && text !== source)) source = text;
  const nextText = translation(source, selected);
  if (nextText === null) return;
  SOURCE.set(node, source);
  LAST.set(node, nextText);
  const next = `${raw.slice(0, raw.indexOf(text))}${nextText}${raw.slice(raw.indexOf(text) + text.length)}`;
  if (node.nodeValue !== next) node.nodeValue = next;
}

function sync() {
  const selected = locale();
  document.documentElement.dataset.asymptaTaskKernelLocale = selected;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) project(node as Text, selected);
}

export function AsymptaTaskKernelLocale() {
  useEffect(() => {
    let frame = 0;
    const run = () => { frame = 0; if (!document.hidden) sync(); };
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(run); };
    queueMicrotask(run);
    const observer = new MutationObserver(schedule);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    window.addEventListener("asympta:task-kernel", schedule, { capture: true });
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("asympta:task-kernel", schedule, { capture: true });
    };
  }, []);
  return null;
}
