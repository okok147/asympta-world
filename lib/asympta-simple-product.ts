import {
  compileAsymptaContext as compileBaseAsymptaContext,
  marketplaceStableHash,
  validateContextEnvelope,
  type CompilerOptions,
  type ContextCompilation,
  type ContextFact,
  type MarketplaceGoal,
} from "./asympta-context-compiler.ts";
import {
  exactProductDecisionForIntent,
  type ExactProductDecision,
} from "./asympta-product-decision.ts";

export type SimpleProductMatch = {
  index: number;
  evidence: string;
  label: string;
};

const ENGLISH_PURCHASE_ACTION = /\b(?:buy|purchase|order|get\s+me|bring\s+me|pick\s+up)\b/i;
const CJK_PURCHASE_ACTION = /幫我買|帮我买|想買|想买|要買|要买|我要/u;
const JAPANESE_PURCHASE = /(.{1,48}?)を(?:買いたい|購入したい)/u;

// Keep the generic physical-product boundary deliberately narrow. These
// categories require a different authority, safety or fulfilment contract.
const NON_RETAIL_CONTEXT = /\b(?:stock|stocks|share|shares|equity|equities|etf|option|options|bond|bonds|security|securities|crypto|bitcoin|company|corporation|business|inc\.?|real\s+estate|property|house|land|mortgage|loan|insurance|subscription|software|app|license|ticket|reservation|booking|weapon|weapons|gun|guns|firearm|firearms|ammunition|drug|drugs|medicine|medication|alcohol|tobacco|vehicle|vehicles|car|cars|motorcycle|motorcycles)\b/i;
const NON_RETAIL_CJK_CONTEXT = /股票|股份|證券|证券|加密貨幣|加密货币|公司|企業|企业|房屋|房子|地產|地产|按揭|貸款|贷款|保險|保险|訂閱|订阅|軟件|软件|門票|门票|預訂|预订|武器|槍|枪|彈藥|弹药|毒品|藥物|药物|酒精|煙草|烟草|汽車|汽车|電單車|摩托車|株式|暗号資産|会社|不動産|住宅|保険|予約|武器|銃|弾薬|薬物|酒類|たばこ|自動車/u;
const NON_ITEM_VALUE = /^(?:it|this|that|something|anything|stuff|things?|product|item|one)$/i;
const TRAILING_INSTRUCTION = /(?:\s*[,;]\s*|\s+and\s+)(?:use|using|pay|let|have|deliver|ship|send|collect|pick)\b.*$/i;
const TRAILING_PAYMENT = /\s+(?:using|with)\s+(?:an?\s+)?(?:asympta\s+wallet|wallet|card(?:\s+on\s+file)?|cash|pay\s+on\s+delivery)\b.*$/i;
const TRAILING_BUDGET = /\s+(?:for|under)\s+(?:HK\$|HKD|US\$|USD|JPY|¥|\$)\s*\d.*$/iu;

const LATIN_QUANTITIES: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
};

const CJK_QUANTITIES: Record<string, number> = {
  一: 1,
  壹: 1,
  二: 2,
  兩: 2,
  两: 2,
  貳: 2,
  三: 3,
  參: 3,
  参: 3,
  四: 4,
  五: 5,
};

function cleanEnglishItem(raw: string) {
  return raw
    .replace(TRAILING_INSTRUCTION, "")
    .replace(TRAILING_PAYMENT, "")
    .replace(TRAILING_BUDGET, "")
    .replace(/[.!?]+$/g, "")
    .trim();
}

function firstProductMatch(text: string): SimpleProductMatch | null {
  const action = ENGLISH_PURCHASE_ACTION.exec(text);
  if (action) {
    const rawStart = action.index + action[0].length;
    const remainder = text.slice(rawStart);
    const leading = /^\s*(?:me\s+)?(?:(?:a|an|one|two|three|four|five|\d{1,2})\s+)?/i.exec(remainder)?.[0] ?? "";
    const rawItem = cleanEnglishItem(remainder.slice(leading.length));
    const evidenceMatch = rawItem ? text.indexOf(rawItem, rawStart + leading.length) : -1;
    const words = rawItem.split(/\s+/).filter(Boolean);
    if (
      evidenceMatch >= 0
      && words.length >= 1
      && words.length <= 8
      && /^[\p{L}\p{N}][\p{L}\p{N}'’&+(). -]*$/u.test(rawItem)
      && !NON_ITEM_VALUE.test(rawItem)
      && !/\band\b/i.test(rawItem)
    ) {
      return { index: evidenceMatch, evidence: rawItem, label: rawItem.toLocaleLowerCase() };
    }
  }

  const cjkAction = CJK_PURCHASE_ACTION.exec(text);
  if (cjkAction) {
    const rawStart = cjkAction.index + cjkAction[0].length;
    const remainder = text.slice(rawStart).trim();
    const rawItem = remainder
      .replace(/^[一二兩两三四五壹貳參参\d]{0,2}\s*(?:個|个|件|份|盒|包|樽|瓶|支|本|台|臺|把)?\s*/u, "")
      .replace(/[，。！？；].*$/u, "")
      .trim();
    const evidenceMatch = rawItem ? text.indexOf(rawItem, rawStart) : -1;
    if (evidenceMatch >= 0 && rawItem.length <= 48 && !NON_ITEM_VALUE.test(rawItem)) {
      return { index: evidenceMatch, evidence: rawItem, label: rawItem };
    }
  }

  const japanese = JAPANESE_PURCHASE.exec(text);
  const japaneseItem = japanese?.[1]?.trim() ?? "";
  if (japanese && japaneseItem && japaneseItem.length <= 48) {
    return { index: japanese.index, evidence: japaneseItem, label: japaneseItem };
  }
  return null;
}

function quantityNearItem(text: string, item: SimpleProductMatch) {
  const prefixStart = Math.max(0, item.index - 36);
  const prefix = text.slice(prefixStart, item.index);
  const latin = /(?:^|\s)(a|an|one|two|three|four|five|\d{1,2})\s*(?:(?:items?|pieces?|sets?|units?)\s*(?:of\s*)?)?$/i.exec(prefix);
  if (latin) {
    const token = latin[1].toLowerCase();
    const value = /^\d+$/.test(token) ? Number(token) : LATIN_QUANTITIES[token];
    if (Number.isFinite(value)) {
      const start = prefixStart + (latin.index ?? 0) + latin[0].search(/\S/);
      return {
        value: Math.max(1, Number(value)),
        evidence: text.slice(Math.max(prefixStart, start), item.index + item.evidence.length).trim(),
      };
    }
  }

  const cjk = /([一二兩两三四五壹貳參参\d]{1,2})\s*(?:個|个|件|份|盒|包|樽|瓶|支|本|台|臺|把)?\s*$/u.exec(prefix);
  if (cjk) {
    const token = cjk[1];
    const value = /^\d+$/.test(token) ? Number(token) : CJK_QUANTITIES[token];
    if (Number.isFinite(value)) {
      const start = prefixStart + (cjk.index ?? 0);
      return {
        value: Math.max(1, Number(value)),
        evidence: text.slice(start, item.index + item.evidence.length).trim(),
      };
    }
  }
  return null;
}

function patchFact(
  fact: ContextFact,
  item: SimpleProductMatch,
  quantity: ReturnType<typeof quantityNearItem>,
): ContextFact {
  if (fact.key === "domain") {
    return {
      ...fact,
      value: "retail",
      source: { ...fact.source, evidence: item.evidence },
    };
  }
  if (fact.key === "requested_item") {
    return {
      ...fact,
      value: item.label,
      status: "explicit",
      source: { type: "user_message", ref: fact.source.ref, evidence: item.evidence },
    };
  }
  if (fact.key === "quantity" && quantity) {
    return {
      ...fact,
      value: quantity.value,
      status: "explicit",
      source: { type: "user_message", ref: fact.source.ref, evidence: quantity.evidence },
    };
  }
  if (fact.key === "market_selection") return { ...fact, value: "nearby_retail_market" };
  if (fact.status !== "explicit" || !fact.source.evidence) return fact;
  return {
    ...fact,
    source: { ...fact.source, evidence: fact.source.evidence.replace(/shirt/iu, item.evidence) },
  };
}

function catalogueFacts(decision: ExactProductDecision | null, requestId: string): ContextFact[] {
  if (!decision) return [];
  const common: ContextFact = {
    key: "product_catalog_category",
    value: decision.category,
    status: "defaulted",
    source: { type: "system_default", ref: `catalog:${decision.category}:verified-reference`, evidence: decision.requestedLabel },
    confidence: 1,
    scope: "task",
  };
  if (!decision.selected) return [common];
  const selected = decision.selected;
  const explicit = (key: string, value: string): ContextFact => ({
    key,
    value,
    status: "explicit",
    source: { type: "user_message", ref: requestId, evidence: selected.exactName },
    confidence: 1,
    scope: "task",
  });
  return [
    common,
    explicit("exact_product_id", selected.id),
    explicit("exact_product_name", selected.exactName),
    explicit("brand", selected.brand),
    explicit("model", selected.model),
    {
      key: "product_reference_url",
      value: selected.manufacturerUrl,
      status: "defaulted",
      source: { type: "system_default", ref: `manufacturer:${selected.brand}`, evidence: selected.verifiedAt },
      confidence: 1,
      scope: "task",
    },
  ];
}

function retailUnknownFields(facts: ContextFact[]) {
  const keys = new Set(facts.map((fact) => fact.key));
  const requiresExactProduct = keys.has("product_catalog_category");
  return [
    ...(requiresExactProduct ? ["exact_product_id"] : []),
    "product_preference",
    "model",
    "max_budget",
    "desired_time",
    "fulfilment_mode",
    "payment_method",
  ].filter((field) => !keys.has(field));
}

function retailGoal(
  goal: MarketplaceGoal,
  requestId: string,
  item: SimpleProductMatch,
  quantity: ReturnType<typeof quantityNearItem>,
  decision: ExactProductDecision | null,
): MarketplaceGoal {
  const facts = [
    ...goal.facts.map((fact) => patchFact(fact, item, quantity)),
    ...catalogueFacts(decision, requestId),
  ];
  return {
    ...goal,
    id: `${requestId}:goal:1:retail`,
    domain: "retail",
    facts,
    unknownFields: retailUnknownFields(facts),
  };
}

export function compileSimpleProductContext(
  intention: string,
  options: CompilerOptions = {},
): ContextCompilation | null {
  const clean = intention.replace(/\s+/g, " ").trim();
  if (!clean || clean.length > 600 || NON_RETAIL_CONTEXT.test(clean) || NON_RETAIL_CJK_CONTEXT.test(clean)) return null;

  const item = firstProductMatch(clean);
  if (!item) return null;

  const surrogate = `${clean.slice(0, item.index)}shirt${clean.slice(item.index + item.evidence.length)}`;
  const requestId = options.requestId?.trim() || `market-${marketplaceStableHash(clean)}`;
  const compiled = compileBaseAsymptaContext(surrogate, {
    ...options,
    requestId,
    conversationId: options.conversationId?.trim() || requestId,
  });
  if (!compiled.supported || !compiled.envelope) return null;

  const quantity = quantityNearItem(clean, item);
  const productDecision = exactProductDecisionForIntent(clean);
  const envelope = {
    ...compiled.envelope,
    rawMessage: {
      ...compiled.envelope.rawMessage,
      text: clean,
      sourceRef: requestId,
    },
    goals: compiled.envelope.goals.map((goal) => (
      goal.domain === "clothing" ? retailGoal(goal, requestId, item, quantity, productDecision) : goal
    )),
  };
  const validation = validateContextEnvelope(envelope);
  return {
    supported: validation.valid,
    envelope: validation.valid ? envelope : null,
    issues: validation.issues,
    profileRequirements: compiled.profileRequirements,
  };
}
