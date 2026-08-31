export type MarketplaceDomain = "food" | "clothing";
export type ContextFactStatus = "explicit" | "defaulted";
export type ContextFactSource = "user_message" | "system_default";

export type ContextFact = {
  key: string;
  value: string | number | boolean;
  status: ContextFactStatus;
  source: {
    type: ContextFactSource;
    ref: string;
    evidence?: string;
  };
  confidence: number;
  scope: "task";
};

export type MarketplaceGoal = {
  id: string;
  domain: MarketplaceDomain;
  action: "obtain";
  desiredOutcome: "deliver_to_user";
  status: "ready_for_simulation";
  facts: ContextFact[];
  unknownFields: string[];
  successCriteria: string[];
};

export type ContextEnvelope = {
  schemaVersion: "asympta.context.v1";
  requestId: string;
  conversationId: string;
  contextVersion: 1;
  locale: string;
  createdAt: string;
  rawMessage: {
    text: string;
    sourceRef: string;
  };
  goals: MarketplaceGoal[];
  sharedFacts: ContextFact[];
  permissions: {
    allowed: string[];
    prohibited: string[];
    consequentialActionsRequireApproval: true;
  };
  provenance: {
    mode: "simulated";
    compiler: "asympta-context-compiler/1";
  };
};

export type ContextCompilation = {
  supported: boolean;
  envelope: ContextEnvelope | null;
  issues: string[];
};


export type CompilerOptions = {
  requestId?: string;
  conversationId?: string;
  locale?: string;
  now?: number | string | Date;
};

type DomainMatch = {
  domain: MarketplaceDomain;
  index: number;
  evidence: string;
};


const DEFAULT_SOURCE_REF = "system:asympta-marketplace-defaults/v1";

const MARKETPLACE_ACTION_PATTERNS = [
  /\bbuy\b/i,
  /\bpurchase\b/i,
  /\border\b/i,
  /\bget\s+me\b/i,
  /\bbring\s+me\b/i,
  /\bpick\s+up\b/i,
  /\bi\s+(?:want|need|would\s+like)\b/i,
  /\bhungry\b/i,
  /\bsomething\s+to\s+eat\b/i,
  /想買/u,
  /要買/u,
  /幫我買/u,
  /想要/u,
  /我要/u,
  /想食/u,
  /要食/u,
  /想吃/u,
  /肚餓/u,
  /お腹が空/u,
  /買いたい/u,
  /食べたい/u,
];

const FOOD_PATTERNS = [
  /\bfood\b/i,
  /\bmeal(?:s)?\b/i,
  /\bdinner\b/i,
  /\blunch\b/i,
  /\bbreakfast\b/i,
  /\bhungry\b/i,
  /\bgrocer(?:y|ies)\b/i,
  /\btakeaway\b/i,
  /\bsomething\s+to\s+eat\b/i,
  /食物/u,
  /嘢食/u,
  /野食/u,
  /外賣/u,
  /買餸/u,
  /晚餐/u,
  /午餐/u,
  /早餐/u,
  /食べ物/u,
  /ご飯/u,
  /夕食/u,
];

const CLOTHING_PATTERNS = [
  /\bclothes?\b/i,
  /\bclothing\b/i,
  /\bshirt(?:s)?\b/i,
  /\bjacket(?:s)?\b/i,
  /\btrousers?\b/i,
  /\bpants\b/i,
  /\bdress(?:es)?\b/i,
  /\boutfit(?:s)?\b/i,
  /衣服/u,
  /衫/u,
  /褲/u,
  /裙/u,
  /工作服/u,
  /洋服/u,
];

const FOOD_ITEMS: Array<[RegExp, string]> = [
  [/\bpizza\b/i, "pizza"],
  [/\bsushi\b/i, "sushi"],
  [/\bburger\b/i, "burger"],
  [/\bnoodles?\b/i, "noodles"],
  [/\brice\b/i, "rice meal"],
  [/壽司/u, "sushi"],
  [/薄餅/u, "pizza"],
  [/漢堡/u, "burger"],
  [/麵/u, "noodles"],
  [/飯/u, "rice meal"],
];

const CLOTHING_ITEMS: Array<[RegExp, string]> = [
  [/\bshirt(?:s)?\b/i, "shirt"],
  [/\bjacket(?:s)?\b/i, "jacket"],
  [/\btrousers?\b/i, "trousers"],
  [/\bpants\b/i, "trousers"],
  [/\bdress(?:es)?\b/i, "dress"],
  [/\boutfit(?:s)?\b/i, "outfit"],
  [/恤衫/u, "shirt"],
  [/外套/u, "jacket"],
  [/褲/u, "trousers"],
  [/裙/u, "dress"],
  [/工作服/u, "work outfit"],
];

export function marketplaceStableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function isoDate(value: CompilerOptions["now"]) {
  const date = value instanceof Date ? value : new Date(value ?? Date.now());
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date(0).toISOString();
}

function firstPatternMatch(text: string, patterns: RegExp[]) {
  let best: { index: number; evidence: string } | null = null;
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (!match || (best && match.index >= best.index)) continue;
    best = { index: match.index, evidence: match[0] };
  }
  return best;
}

function domainMatches(text: string): DomainMatch[] {
  const matches: DomainMatch[] = [];
  const food = firstPatternMatch(text, FOOD_PATTERNS);
  const clothing = firstPatternMatch(text, CLOTHING_PATTERNS);
  if (food) matches.push({ domain: "food", ...food });
  if (clothing) matches.push({ domain: "clothing", ...clothing });
  return matches.sort((left, right) => left.index - right.index);
}

function explicitFact(key: string, value: ContextFact["value"], requestId: string, evidence: string): ContextFact {
  return {
    key,
    value,
    status: "explicit",
    source: { type: "user_message", ref: requestId, evidence },
    confidence: 1,
    scope: "task",
  };
}

function defaultFact(key: string, value: ContextFact["value"]): ContextFact {
  return {
    key,
    value,
    status: "defaulted",
    source: { type: "system_default", ref: DEFAULT_SOURCE_REF },
    confidence: 1,
    scope: "task",
  };
}

function matchItem(text: string, domain: MarketplaceDomain) {
  const candidates = domain === "food" ? FOOD_ITEMS : CLOTHING_ITEMS;
  for (const [pattern, label] of candidates) {
    const match = pattern.exec(text);
    if (match) return { label, evidence: match[0] };
  }
  return null;
}

function extractQuantity(text: string, domain: MarketplaceDomain) {
  const units = domain === "food"
    ? "meals?|servings?|portions?|orders?|份|餐"
    : "items?|pieces?|sets?|件|套";
  const numeric = new RegExp(`\\b(\\d{1,2})\\s*(?:${units})\\b`, "iu").exec(text);
  if (numeric) return { value: Math.max(1, Number(numeric[1])), evidence: numeric[0] };

  const words: Array<[RegExp, number]> = [
    [new RegExp(`\\bone\\s+(?:${units})\\b`, "iu"), 1],
    [new RegExp(`\\btwo\\s+(?:${units})\\b`, "iu"), 2],
    [new RegExp(`\\bthree\\s+(?:${units})\\b`, "iu"), 3],
  ];
  for (const [pattern, value] of words) {
    const match = pattern.exec(text);
    if (match) return { value, evidence: match[0] };
  }
  return null;
}

function extractBudget(text: string) {
  const prefix = /(?:HK\$|HKD|US\$|USD|JPY|¥|\$)\s*(\d+(?:\.\d{1,2})?)/iu.exec(text);
  if (prefix) return { value: Number(prefix[1]), evidence: prefix[0] };
  const suffix = /(\d+(?:\.\d{1,2})?)\s*(?:HKD|港幣|蚊|元|円)/iu.exec(text);
  if (suffix) return { value: Number(suffix[1]), evidence: suffix[0] };
  return null;
}

export function marketplaceGoalItem(goal: MarketplaceGoal) {
  const fact = goal.facts.find((candidate) => candidate.key === "requested_item");
  return typeof fact?.value === "string" ? fact.value : goal.domain === "food" ? "ready-to-eat meal" : "everyday clothing set";
}

export function marketplaceGoalQuantity(goal: MarketplaceGoal) {
  const fact = goal.facts.find((candidate) => candidate.key === "quantity");
  const value = Number(fact?.value ?? 1);
  return Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1;
}

function goalUnknownFields(domain: MarketplaceDomain, facts: ContextFact[]) {
  const keys = new Set(facts.map((fact) => fact.key));
  const candidates = domain === "food"
    ? ["dietary_constraints", "cuisine_preference", "max_budget", "desired_time"]
    : ["size", "style", "occasion", "max_budget"];
  return candidates.filter((field) => !keys.has(field));
}

function buildGoal(match: DomainMatch, text: string, requestId: string, index: number): MarketplaceGoal {
  const facts: ContextFact[] = [explicitFact("domain", match.domain, requestId, match.evidence)];
  const item = matchItem(text, match.domain);
  const quantity = extractQuantity(text, match.domain);
  const budget = extractBudget(text);

  facts.push(item
    ? explicitFact("requested_item", item.label, requestId, item.evidence)
    : defaultFact("requested_item", match.domain === "food" ? "ready-to-eat meal" : "everyday clothing set"));
  facts.push(quantity
    ? explicitFact("quantity", quantity.value, requestId, quantity.evidence)
    : defaultFact("quantity", 1));
  if (budget) facts.push(explicitFact("max_budget", budget.value, requestId, budget.evidence));
  facts.push(defaultFact("fulfilment_mode", "personal_agent_market_pickup"));
  facts.push(defaultFact("market_selection", match.domain === "food" ? "nearby_food_market" : "nearby_clothing_market"));

  return {
    id: `${requestId}:goal:${index + 1}:${match.domain}`,
    domain: match.domain,
    action: "obtain",
    desiredOutcome: "deliver_to_user",
    status: "ready_for_simulation",
    facts,
    unknownFields: goalUnknownFields(match.domain, facts),
    successCriteria: [
      "A marketplace agent receives a typed enquiry packet.",
      "Simulated stock is checked and transferred consistently.",
      "Any simulated payment pauses for explicit human approval.",
      "The personal agent returns to the user carrying the requested item.",
      "A delivery receipt confirms the item entered user inventory.",
    ],
  };
}

export function compileAsymptaContext(intention: string, options: CompilerOptions = {}): ContextCompilation {
  const clean = intention.replace(/\s+/g, " ").trim();
  if (!clean) return { supported: false, envelope: null, issues: ["An intention is required."] };
  if (clean.length > 600) return { supported: false, envelope: null, issues: ["An intention can contain at most 600 characters."] };

  const matches = domainMatches(clean);
  if (!matches.length) return { supported: false, envelope: null, issues: ["No supported marketplace goal was found."] };
  if (!firstPatternMatch(clean, MARKETPLACE_ACTION_PATTERNS)) {
    return { supported: false, envelope: null, issues: ["The message names a marketplace domain but does not ask to obtain anything."] };
  }

  const requestId = options.requestId?.trim() || `market-${marketplaceStableHash(clean)}`;
  const envelope: ContextEnvelope = {
    schemaVersion: "asympta.context.v1",
    requestId,
    conversationId: options.conversationId?.trim() || requestId,
    contextVersion: 1,
    locale: options.locale?.trim() || "en",
    createdAt: isoDate(options.now),
    rawMessage: {
      text: clean,
      sourceRef: requestId,
    },
    goals: matches.map((match, index) => buildGoal(match, clean, requestId, index)),
    sharedFacts: [
      defaultFact("execution_environment", "asympta_simulated_city"),
      defaultFact("user_handoff_location", "personal_agent_home"),
    ],
    permissions: {
      allowed: [
        "compile_context",
        "move_simulated_agent",
        "query_simulated_marketplace",
        "reserve_simulated_inventory",
        "exchange_structured_packets",
      ],
      prohibited: [
        "place_real_order",
        "charge_real_payment_method",
        "share_private_address",
        "claim_live_inventory",
      ],
      consequentialActionsRequireApproval: true,
    },
    provenance: {
      mode: "simulated",
      compiler: "asympta-context-compiler/1",
    },
  };

  const validation = validateContextEnvelope(envelope);
  return {
    supported: validation.valid,
    envelope: validation.valid ? envelope : null,
    issues: validation.issues,
  };
}

export function validateContextEnvelope(envelope: ContextEnvelope) {
  const issues: string[] = [];
  if (envelope.schemaVersion !== "asympta.context.v1") issues.push("Unsupported context schema version.");
  if (!envelope.requestId.trim()) issues.push("A request id is required.");
  if (!envelope.rawMessage.text.trim()) issues.push("The raw user message is required.");
  if (!envelope.goals.length) issues.push("At least one goal is required.");
  if (envelope.provenance.mode !== "simulated") issues.push("This runtime must not claim a live marketplace.");
  if (!envelope.permissions.consequentialActionsRequireApproval) issues.push("Consequential actions must require approval.");

  const raw = envelope.rawMessage.text.toLocaleLowerCase();
  for (const goal of envelope.goals) {
    if (!goal.successCriteria.length) issues.push(`${goal.id} has no success criteria.`);
    for (const fact of goal.facts) {
      if (fact.status === "explicit") {
        if (fact.source.type !== "user_message") issues.push(`${goal.id}:${fact.key} has an invalid explicit source.`);
        const evidence = fact.source.evidence?.trim().toLocaleLowerCase();
        if (!evidence || !raw.includes(evidence)) issues.push(`${goal.id}:${fact.key} lacks message evidence.`);
      }
      if (fact.status === "defaulted" && fact.source.type !== "system_default") {
        issues.push(`${goal.id}:${fact.key} has an invalid default source.`);
      }
      if (fact.confidence < 0 || fact.confidence > 1) issues.push(`${goal.id}:${fact.key} has invalid confidence.`);
    }
  }
  return { valid: issues.length === 0, issues };
}


export function compactContextEnvelope(envelope: ContextEnvelope) {
  return {
    schemaVersion: envelope.schemaVersion,
    requestId: envelope.requestId,
    contextVersion: envelope.contextVersion,
    goals: envelope.goals.map((goal) => ({
      id: goal.id,
      domain: goal.domain,
      action: goal.action,
      desiredOutcome: goal.desiredOutcome,
      facts: goal.facts.map((fact) => ({
        key: fact.key,
        value: fact.value,
        status: fact.status,
        source: fact.source.type,
        evidence: fact.source.evidence ?? null,
      })),
      unknownFields: goal.unknownFields,
    })),
    permissions: envelope.permissions,
    provenance: envelope.provenance,
  };
}
