import { classifyTaskEffect, resolveExplicitRequirementValue } from "./asympta-semantic-kernel.ts";
import { createUniversalTaskEnvelope, type AsymptaUniversalLocale, type AsymptaUniversalTaskEnvelope } from "./asympta-universal-task-protocol.ts";
import { compileAsymptaContext, buildMarketplaceTaskProtocol, marketplaceSelectionConfirmationIntent } from "./asympta-marketplace-intent.ts";
import { ATLAS_AGENTS, ATLAS_LOCATIONS, type AtlasWorkflowDefinition, type WorkflowId } from "./atlas-simulation.ts";
import { assertAsymptaWorkflowContract } from "./asympta-workflow-contract.ts";

export type SimulationSide = "users" | "business";
export type SimulationFamily = "purchase" | "booking" | "supply" | "service" | "delivery" | "change" | "research" | "coordinate";
export type SimulationFact = { key: string; value: string; numericValue?: number; source: "explicit" | "answer"; evidence: string };
export type SimulationQuestion = { key: string; options?: Array<{ value: string; label: string; description?: string }> };
export type SimulationStage = "intake" | "route" | "check" | "proposal" | "approval" | "execute" | "verify" | "return";
export type SimulationPacket = {
  schemaVersion: "asympta.simulation/1";
  id: string;
  side: SimulationSide;
  raw: string;
  executionIntent: string;
  family: SimulationFamily;
  interpretation: "rule_based_proposal";
  facts: SimulationFact[];
  questions: SimulationQuestion[];
  agents: string[];
  requiresApproval: boolean;
  sourceClauses: string[];
  protocol: AsymptaUniversalTaskEnvelope;
  permissions: { mode: "simulated"; externalTools: false; approvalGranted: false };
};

export const SIMULATION_LIMIT = 12000;
export const SIMULATION_WORKFLOW_ID = "context-simulation" as WorkflowId;
export const SIMULATION_STAGES: SimulationStage[] = ["intake", "route", "check", "proposal", "approval", "execute", "verify", "return"];

const FAMILY_RULES: Array<[SimulationFamily, RegExp]> = [
  ["change", /\b(refund|cancel|delay|reschedule|return|change)\b|退款|取消|延遲|延迟|改期|退貨|遅延|変更|返品|返金/iu],
  ["supply", /\b(restock|replenish|supplier|inventory|stock|manufactur|produce)\w*\b|補貨|补货|庫存|库存|供應|供应|生產|生产|在庫|補充|仕入/iu],
  ["booking", /\b(book|reserve|appointment|ticket)\w*\b|預約|预约|預訂|预订|訂位|予約|チケット/iu],
  ["service", /\b(repair|fix|maintain|clean|install)\w*\b|維修|维修|修理|清潔|清洁|安裝|安装|掃除/iu],
  ["delivery", /\b(deliver|ship|dispatch|courier)\w*\b|送貨|送货|交付|運送|运送|配送|発送/iu],
  ["purchase", /\b(buy|purchase|order|shop)\w*\b|買|买|購|购|購入|注文/iu],
  ["research", /\b(research|compare|find|learn|explain|summarize|analyse|analyze)\w*\b|研究|比較|比较|尋找|寻找|學習|学习|調查|调查|調べ|比較|検索/iu],
];
const FACT_KEYS = ["budget", "quantity", "deadline", "location", "constraints", "outcome", "target", "stock", "capacity", "capability"] as const;
const ALIASES: Record<string, typeof FACT_KEYS[number]> = {
  stock: "stock", 庫存: "stock", 库存: "stock", 在庫: "stock", capacity: "capacity", 產能: "capacity", 産能: "capacity", 対応可能数: "capacity",
  capability: "capability", service: "capability", 服務: "capability", サービス: "capability", target: "target", 物品: "target", 対象: "target",
  budget: "budget", 預算: "budget", 预算: "budget", 予算: "budget", quantity: "quantity", 數量: "quantity", 数量: "quantity",
  deadline: "deadline", time: "deadline", 時間: "deadline", 期限: "deadline", 納期: "deadline", location: "location", 地點: "location", 地点: "location", 場所: "location",
  constraints: "constraints", conditions: "constraints", 條件: "constraints", 条件: "constraints", outcome: "outcome", 目標: "outcome", 目标: "outcome", 結果: "outcome",
};
const PARTNER: Record<SimulationFamily, string> = {
  purchase: "agent-business", booking: "agent-business", supply: "agent-supplier", service: "agent-operations",
  delivery: "agent-logistics", change: "agent-support", research: "agent-market", coordinate: "agent-operations",
};

/** A conservative local compiler: raw input is data, never authority or code. */
export function compileSimulation(input: { id: string; text: string; side: SimulationSide; locale?: AsymptaUniversalLocale; answers?: Record<string, string> }): SimulationPacket {
  if (typeof input.text !== "string" || !input.text.trim()) throw new Error("empty_input");
  if (input.text.length > SIMULATION_LIMIT) throw new Error("input_too_long");
  if (input.side !== "users" && input.side !== "business") throw new Error("invalid_side");
  if (!/^[a-zA-Z0-9_-]{1,96}$/.test(input.id)) throw new Error("invalid_id");
  const raw = input.text;
  const text = raw.trim();
  const locale = input.locale ?? "en";
  const answers = input.answers ?? {};
  const family = FAMILY_RULES.find(([, pattern]) => pattern.test(text))?.[0] ?? "coordinate";
  const facts: SimulationFact[] = [];
  const sourceClauses = text.split(/[\n;；。]+/u).map(value => value.trim()).filter(Boolean);
  for (const clause of sourceClauses) {
    const match = /^([^:=：]{1,24})\s*[:=：]\s*(.+)$/u.exec(clause);
    const alias = match?.[1].trim().toLowerCase();
    const key = alias && Object.hasOwn(ALIASES, alias) ? ALIASES[alias] : undefined;
    if (key && match) facts.push({ key, value: match[2].trim(), source: "explicit", evidence: clause });
  }
  for (const key of ["budget", "quantity", "deadline"] as const) {
    if (facts.some(fact => fact.key === key)) continue;
    const result = resolveExplicitRequirementValue(text, key);
    if (result) facts.push({ key, value: result.label, source: "explicit", evidence: text });
  }
  const capture = (key: string, patterns: RegExp[], numeric = false) => {
    if (facts.some(fact => fact.key === key)) return;
    const matches = patterns.flatMap(pattern => [...text.matchAll(pattern)]);
    const unique = new Map(matches.map(match => [match[1].trim(), match]));
    for (const match of unique.values()) {
      const value = match[1].trim();
      facts.push({ key, value, ...(numeric ? { numericValue: Number(value) } : {}), source: "explicit", evidence: match[0] });
    }
  };
  capture("quantity", [
    /\b(?:need|order(?:ed)?|buy|purchase|restock|for)\s+(\d+)\s+(?!in\s+stock)[\p{L}]+/giu,
    /(?:需要|訂單|订购|訂購|購買|買|数量|注文)\s*(\d+)\s*(?:本|個|件|位|人|冊|台|張|部)/gu,
    /(?:ノート|商品|注文)[^。\n\d]{0,8}(\d+)\s*(?:冊|個|台|人)/gu,
  ], true);
  capture("stock", [
    /\b(?:stock|inventory)\s*(?:is|of|:|at|only)?\s*(\d+)/giu,
    /\b(?:have|only)\s+(\d+)\s+(?:left|in\s+stock)\b/giu,
    /(?:庫存|库存|在庫)\s*(?:只有|只剩|有|剩下|は|が|：|:)?\s*(\d+)/gu,
  ], true);
  capture("capacity", [
    /\b(?:capacity(?:\s+of)?|can\s+(?:make|produce|serve|handle))\s*[:：]?\s*(\d+)/giu,
    /(?:產能|产能|可接待|可生產|可生产|対応可能数)\s*[:：]?\s*(\d+)/gu,
  ], true);
  capture("deadline", [
    /\b(?:by|before|on|until)\s+((?:next\s+)?(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|tomorrow|tonight)(?:\s+\d{1,2}(?::\d{2})?\s*(?:am|pm))?)/giu,
    /((?:明天|明晚|聽日|今晚|星期[一二三四五六日]|週[一二三四五六日]|金曜日|月曜日|明日)(?:前|まで)?)/gu,
  ]);
  capture("target", [
    /\b(?:buy|purchase|repair|book|restock)\s+([^.;\n,]{1,100}?)(?=\s+(?:by|before|with|under|for)\b|[.;\n,]|$)/giu,
    /(?:購買|購|買|修理|維修|預訂|补货|補貨)\s*([^，。；\n]{1,80})/gu,
  ]);
  capture("capability", [/\b(?:we\s+offer|we\s+provide)\s+([^.;\n,]{1,120})/giu, /(?:我們提供|我哋提供|提供するサービス[:：]?)\s*([^，。；\n]{1,100})/gu]);
  for (const clause of sourceClauses) {
    if (/\b(?:do not|don't|never|must|keep)\b|不要|請勿|必須|保留|保持|しない/iu.test(clause) && !facts.some(fact => fact.key === "constraints" && fact.value === clause)) {
      facts.push({ key: "constraints", value: clause, source: "explicit", evidence: clause });
    }
  }
  for (const key of FACT_KEYS) {
    const value = typeof answers[key] === "string" ? answers[key].trim().slice(0, 2000) : "";
    if (!value) continue;
    for (let i = facts.length - 1; i >= 0; i--) if (facts[i].key === key) facts.splice(i, 1);
    facts.push({ key, value, source: "answer", evidence: value });
  }
  const questions: SimulationQuestion[] = [];
  // A novel scenario gets a real clarification, not a guessed executable action.
  if (family === "coordinate" && !facts.some(fact => fact.key === "outcome")) questions.push({ key: "outcome" });
  const conflicts = ["budget", "quantity", "deadline", "location", "stock", "capacity"].filter(key => new Set(facts.filter(fact => fact.key === key).map(fact => fact.value)).size > 1);
  for (const key of conflicts) questions.push({ key });
  let executionIntent = text;
  if (input.side === "users" && family === "purchase") {
    const compilation = compileAsymptaContext(text, { requestId: input.id, conversationId: input.id, locale, now: 0 });
    if (compilation.envelope) {
      const protocol = buildMarketplaceTaskProtocol(compilation.envelope);
      const question = protocol.readiness.nextQuestion;
      if (question?.field === "selected_offer_id") {
        const options = question.options.map(option => ({ value: String(option.value), label: option.label, description: option.description }));
        const selected = options.find(option => option.value === answers.selected_offer_id);
        if (selected) {
          const goal = compilation.envelope.goals.find(goal => goal.id === protocol.readiness.nextTaskId);
          if (goal) executionIntent = marketplaceSelectionConfirmationIntent(text, goal, selected.value);
          facts.push({ key: "selected_offer_id", value: selected.label, source: "answer", evidence: selected.value });
        } else questions.push({ key: "selected_offer_id", options });
      }
    }
  }
  const effect = classifyTaskEffect({ intent: text });
  // Interpretation does not convey permission, even when the text says "approved".
  const requiresApproval = effect.requiresApproval || !["research", "coordinate"].includes(family);
  const initiator = input.side === "business" ? "agent-business" : "agent-user";
  const counterpart = input.side === "business" && PARTNER[family] === "agent-business" ? "agent-customer" : PARTNER[family];
  const agents = [...new Set([initiator, counterpart, "agent-operations", ...(requiresApproval ? ["agent-finance"] : []), "agent-quality"])];
  const protocol = createUniversalTaskEnvelope({ id: input.id, domain: family, actionFamily: family, intent: raw, locale, mode: "simulated", requiredFields: questions.map(question => question.key), risk: requiresApproval ? "high" : "low" });
  protocol.status = questions.length ? "needs_human" : "planning";
  protocol.packets = [{ id: `${input.id}:intent`, taskId: input.id, sequence: 1, kind: "intent", sender: input.side, recipient: initiator, summary: raw, data: { facts, unresolved: questions.map(question => question.key) }, provenance: { mode: "simulated", simulated: true } }];
  return { schemaVersion: "asympta.simulation/1", id: input.id, side: input.side, raw, executionIntent, family, interpretation: "rule_based_proposal", facts, questions, agents, requiresApproval, sourceClauses, protocol, permissions: { mode: "simulated", externalTools: false, approvalGranted: false } };
}

export function buildSimulationWorkflow(packet: SimulationPacket, titles: Record<SimulationStage, string>): AtlasWorkflowDefinition {
  if (packet.questions.length) throw new Error("unresolved_requirements");
  if (packet.permissions.mode !== "simulated" || packet.permissions.externalTools || packet.permissions.approvalGranted) throw new Error("invalid_simulation_authority");
  const stages = SIMULATION_STAGES.filter(stage => stage !== "approval" || packet.requiresApproval);
  const initiator = packet.side === "business" ? "agent-business" : "agent-user";
  const partner = packet.side === "business" && PARTNER[packet.family] === "agent-business" ? "agent-customer" : PARTNER[packet.family];
  const assignments: Record<SimulationStage, string> = { intake: initiator, route: partner, check: "agent-operations", proposal: partner, approval: "agent-finance", execute: partner, verify: "agent-quality", return: initiator };
  const workflow: AtlasWorkflowDefinition = {
    id: SIMULATION_WORKFLOW_ID, name: titles.intake, shortName: titles.intake, summary: titles.route, outcome: titles.return,
    tasks: stages.map((stage, index) => {
      const agentId = assignments[stage];
      // Exchange packets at the other organisation before returning to origin.
      const host = stage === "intake" ? partner : stage === "return" ? initiator : agentId;
      const locationId = ATLAS_AGENTS.find(agent => agent.id === host)!.homeLocationId;
      return { id: `${packet.id}:${stage}`, title: titles[stage], detail: titles[stage], agentInput: { packetId: packet.id, stage, mode: "simulated", raw: packet.raw, facts: packet.facts, unresolved: packet.questions, permissions: packet.permissions, requiredOutput: stage === "verify" ? "verify_simulated_handoff_trace" : stage }, agentId, locationId, dependsOn: index ? [`${packet.id}:${stages[index - 1]}`] : [], workMs: 1000, ...(stage === "approval" ? { requiresApproval: true, approvalLabel: titles.approval, actionType: "send_customer_update" as const } : {}) };
    }),
  };
  return assertAsymptaWorkflowContract(workflow, { agentIds: ATLAS_AGENTS.map(agent => agent.id), locationIds: Object.keys(ATLAS_LOCATIONS) });
}
