import {
  compileAsymptaContext as compileBaseAsymptaContext,
  marketplaceStableHash,
  validateContextEnvelope,
  type CompilerOptions,
  type ContextCompilation,
  type ContextFact,
} from "./asympta-context-compiler.ts";

export type SimpleConsumableMatch = {
  index: number;
  evidence: string;
  label: string;
};

const SIMPLE_CONSUMABLE_ITEMS: Array<[RegExp, string]> = [
  [/\bcoca[- ]?cola\b/i, "Coca-Cola"],
  [/\b(?:diet coke|coke zero)\b/i, "Coke"],
  [/\bcola\b/i, "cola"],
  [/\bsodas?\b/i, "soda"],
  [/\bsoft[- ]?drinks?\b/i, "soft drink"],
  [/\benergy[- ]?drinks?\b/i, "energy drink"],
  [/\bsports?[- ]?drinks?\b/i, "sports drink"],
  [/\b(?:potato )?chips?\b/i, "chips"],
  [/\bcrisps?\b/i, "crisps"],
  [/\b(?:chewing )?gum\b/i, "chewing gum"],
  [/\bice[- ]?cream\b/i, "ice cream"],
  [/可樂|可乐/u, "cola"],
  [/汽水/u, "soft drink"],
  [/能量飲料|能量饮料/u, "energy drink"],
  [/運動飲料|运动饮料/u, "sports drink"],
  [/薯片/u, "chips"],
  [/香口膠|香口胶|口香糖/u, "chewing gum"],
  [/雪糕|冰淇淋/u, "ice cream"],
  [/コーラ/u, "cola"],
  [/炭酸飲料/u, "soft drink"],
  [/エナジードリンク/u, "energy drink"],
  [/スポーツドリンク/u, "sports drink"],
  [/ポテトチップス/u, "chips"],
  [/ガム/u, "chewing gum"],
  [/アイスクリーム/u, "ice cream"],
];

const NON_CONSUMABLE_CONTEXT = /\b(?:stock|stocks|share|shares|equity|equities|etf|options?|bond|bonds|company|corporation|inc\.?|recipe|recipes)\b/i;

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

function firstConsumableMatch(text: string): SimpleConsumableMatch | null {
  let best: SimpleConsumableMatch | null = null;
  for (const [pattern, label] of SIMPLE_CONSUMABLE_ITEMS) {
    const match = pattern.exec(text);
    if (!match || (best && match.index >= best.index)) continue;
    best = { index: match.index, evidence: match[0], label };
  }
  return best;
}

function quantityNearItem(text: string, item: SimpleConsumableMatch) {
  const prefixStart = Math.max(0, item.index - 36);
  const prefix = text.slice(prefixStart, item.index);
  const latin = /(?:^|\s)(a|an|one|two|three|four|five|\d{1,2})\s*(?:(?:cans?|bottles?|packs?|bags?|bars?|cups?|tubs?)\s*(?:of\s*)?)?$/i.exec(prefix);
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

  const cjk = /([一二兩两三四五壹貳參参\d]{1,2})\s*(?:個|个|件|份|盒|包|樽|瓶|支|罐|杯|本|缶|袋|箱)?\s*$/u.exec(prefix);
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

function evidenceFromOriginal(
  fact: ContextFact,
  item: SimpleConsumableMatch,
  quantity: ReturnType<typeof quantityNearItem>,
) {
  if (fact.key === "domain" || fact.key === "requested_item") return item.evidence;
  if (fact.key === "quantity" && quantity) return quantity.evidence;
  const current = fact.source.evidence;
  if (!current) return current;
  const candidate = current.replace(/juice/iu, item.evidence);
  return candidate;
}

function patchConsumableFact(
  fact: ContextFact,
  item: SimpleConsumableMatch,
  quantity: ReturnType<typeof quantityNearItem>,
): ContextFact {
  if (fact.status !== "explicit") return fact;
  if (fact.key === "requested_item") {
    return {
      ...fact,
      value: item.label,
      source: { ...fact.source, evidence: item.evidence },
    };
  }
  if (fact.key === "quantity" && quantity) {
    return {
      ...fact,
      value: quantity.value,
      source: { ...fact.source, evidence: quantity.evidence },
    };
  }
  const evidence = evidenceFromOriginal(fact, item, quantity);
  return evidence ? { ...fact, source: { ...fact.source, evidence } } : fact;
}

export function compileSimpleConsumableContext(
  intention: string,
  options: CompilerOptions = {},
): ContextCompilation | null {
  const clean = intention.replace(/\s+/g, " ").trim();
  if (!clean || NON_CONSUMABLE_CONTEXT.test(clean)) return null;

  const item = firstConsumableMatch(clean);
  if (!item) return null;

  const surrogate = `${clean.slice(0, item.index)}juice${clean.slice(item.index + item.evidence.length)}`;
  const requestId = options.requestId?.trim() || `market-${marketplaceStableHash(clean)}`;
  const compiled = compileBaseAsymptaContext(surrogate, {
    ...options,
    requestId,
    conversationId: options.conversationId?.trim() || requestId,
  });
  if (!compiled.supported || !compiled.envelope) return null;

  const quantity = quantityNearItem(clean, item);
  const envelope = {
    ...compiled.envelope,
    rawMessage: {
      ...compiled.envelope.rawMessage,
      text: clean,
      sourceRef: requestId,
    },
    goals: compiled.envelope.goals.map((goal) => goal.domain !== "food"
      ? goal
      : {
          ...goal,
          facts: goal.facts.map((fact) => patchConsumableFact(fact, item, quantity)),
        }),
  };

  const validation = validateContextEnvelope(envelope);
  return {
    supported: validation.valid,
    envelope: validation.valid ? envelope : null,
    issues: validation.issues,
    profileRequirements: compiled.profileRequirements,
  };
}
