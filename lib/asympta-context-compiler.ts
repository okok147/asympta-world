import {
  isMarketplaceFoodPreference,
  isMarketplaceFulfilmentMethod,
  isMarketplacePaymentMethod,
  marketplaceFoodPreferenceItem,
  marketplaceProfileSourceRef,
  type AsymptaMarketplaceProfile,
  type MarketplaceFoodPreference,
  type MarketplaceFulfilmentMethod,
  type MarketplacePaymentMethod,
  type MarketplaceProfileField,
} from "./asympta-marketplace-profile.ts";

export type MarketplaceDomain = "food" | "clothing" | "retail";
export type ContextFactStatus = "explicit" | "profile" | "defaulted";
export type ContextFactSource = "user_message" | "approved_user_profile" | "system_default";

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
    profileRef?: string;
  };
};

export type ContextProfileRequirements = {
  required: MarketplaceProfileField[];
  missing: MarketplaceProfileField[];
  resolvedFromProfile: MarketplaceProfileField[];
};

export type ContextCompilation = {
  supported: boolean;
  envelope: ContextEnvelope | null;
  issues: string[];
  profileRequirements: ContextProfileRequirements;
};

export type CompilerOptions = {
  requestId?: string;
  conversationId?: string;
  locale?: string;
  now?: number | string | Date;
  profile?: AsymptaMarketplaceProfile | null;
};

type DomainMatch = {
  domain: MarketplaceDomain;
  index: number;
  evidence: string;
};

type ExtractedValue<T> = {
  value: T;
  evidence: string;
};

type MatchedItem = {
  label: string;
  evidence: string;
  index: number;
};

const DEFAULT_SOURCE_REF = "system:asympta-marketplace-defaults/v1";
const EMPTY_PROFILE_REQUIREMENTS: ContextProfileRequirements = {
  required: [],
  missing: [],
  resolvedFromProfile: [],
};

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

const APPLE_ITEM_PATTERN = /\bapples?\b/i;
const APPLE_NON_FOOD_CONTEXT = /\b(?:apple\s+(?:watch|iphone|ipad|mac(?:book)?|vision(?:\s+pro)?|pencil|tv|device|computer|laptop|phone|stock|shares?|gift\s*cards?|inc\.?|store|care|music|pay)|(?:shares?|stock)\s+(?:in|of)\s+apple)\b/i;

const FOOD_ITEMS: Array<[RegExp, string]> = [
  [/\bapple\s+juice\b/i, "apple juice"],
  [/\borange\s+juice\b/i, "orange juice"],
  [/\bapple\s+pie\b/i, "apple pie"],
  [APPLE_ITEM_PATTERN, "apple"],
  [/\bbananas?\b/i, "banana"],
  [/\boranges?\b/i, "orange"],
  [/\bpears?\b/i, "pear"],
  [/\bgrapes?\b/i, "grapes"],
  [/\bstrawberr(?:y|ies)\b/i, "strawberries"],
  [/\bwatermelons?\b/i, "watermelon"],
  [/\bfruits?\b/i, "fruit"],
  [/\bbread\b/i, "bread"],
  [/\bmilk\b/i, "milk"],
  [/\beggs?\b/i, "eggs"],
  [/\bcheese\b/i, "cheese"],
  [/\byog(?:h)?urts?\b/i, "yogurt"],
  [/\bchicken\b/i, "chicken"],
  [/\bbeef\b/i, "beef"],
  [/\bpork\b/i, "pork"],
  [/\bfish\b/i, "fish"],
  [/\bvegetables?\b/i, "vegetables"],
  [/\bsalads?\b/i, "salad"],
  [/\bsandwich(?:es)?\b/i, "sandwich"],
  [/\bsoups?\b/i, "soup"],
  [/\bcereals?\b/i, "cereal"],
  [/\bcoffee\b/i, "coffee"],
  [/\btea\b/i, "tea"],
  [/\bjuices?\b/i, "juice"],
  [/\bwater\b/i, "water"],
  [/\bsnacks?\b/i, "snack"],
  [/\bchocolates?\b/i, "chocolate"],
  [/\b(?:biscuits?|cookies?)\b/i, "biscuits"],
  [/\bcakes?\b/i, "cake"],
  [/\bpizza\b/i, "pizza"],
  [/\bsushi\b/i, "sushi"],
  [/\bramen\b/i, "ramen"],
  [/\bburger\b/i, "burger"],
  [/\bnoodles?\b/i, "noodles"],
  [/\brice\b/i, "rice meal"],
  [/蘋果汁|苹果汁/u, "apple juice"],
  [/橙汁/u, "orange juice"],
  [/蘋果批|苹果派/u, "apple pie"],
  [/蘋果|苹果/u, "apple"],
  [/香蕉/u, "banana"],
  [/橙(?:仔)?/u, "orange"],
  [/梨/u, "pear"],
  [/提子|葡萄/u, "grapes"],
  [/士多啤梨|草莓/u, "strawberries"],
  [/西瓜/u, "watermelon"],
  [/水果/u, "fruit"],
  [/麵包|面包/u, "bread"],
  [/牛奶/u, "milk"],
  [/雞蛋|鸡蛋/u, "eggs"],
  [/芝士|奶酪/u, "cheese"],
  [/乳酪|酸奶/u, "yogurt"],
  [/雞肉|鸡肉/u, "chicken"],
  [/牛肉/u, "beef"],
  [/豬肉|猪肉/u, "pork"],
  [/魚|鱼/u, "fish"],
  [/蔬菜/u, "vegetables"],
  [/沙律|沙拉/u, "salad"],
  [/三文治|三明治/u, "sandwich"],
  [/湯|汤/u, "soup"],
  [/麥片|麦片/u, "cereal"],
  [/咖啡/u, "coffee"],
  [/果汁/u, "juice"],
  [/零食/u, "snack"],
  [/朱古力|巧克力/u, "chocolate"],
  [/餅乾|饼干/u, "biscuits"],
  [/蛋糕/u, "cake"],
  [/壽司/u, "sushi"],
  [/拉麵/u, "ramen"],
  [/薄餅/u, "pizza"],
  [/漢堡/u, "burger"],
  [/麵/u, "noodles"],
  [/飯/u, "rice meal"],
  [/りんごジュース/u, "apple juice"],
  [/オレンジジュース/u, "orange juice"],
  [/アップルパイ/u, "apple pie"],
  [/りんご|リンゴ/u, "apple"],
  [/バナナ/u, "banana"],
  [/オレンジ/u, "orange"],
  [/ぶどう|ブドウ/u, "grapes"],
  [/いちご|イチゴ/u, "strawberries"],
  [/すいか|スイカ/u, "watermelon"],
  [/果物/u, "fruit"],
  [/パン/u, "bread"],
  [/牛乳/u, "milk"],
  [/卵/u, "eggs"],
  [/チーズ/u, "cheese"],
  [/ヨーグルト/u, "yogurt"],
  [/鶏肉/u, "chicken"],
  [/牛肉/u, "beef"],
  [/豚肉/u, "pork"],
  [/魚/u, "fish"],
  [/野菜/u, "vegetables"],
  [/サラダ/u, "salad"],
  [/サンドイッチ/u, "sandwich"],
  [/スープ/u, "soup"],
  [/シリアル/u, "cereal"],
  [/コーヒー/u, "coffee"],
  [/ジュース/u, "juice"],
  [/お菓子/u, "snack"],
  [/チョコレート/u, "chocolate"],
  [/クッキー/u, "biscuits"],
  [/ケーキ/u, "cake"],
  [/寿司/u, "sushi"],
  [/ラーメン/u, "ramen"],
  [/ピザ/u, "pizza"],
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
  ...FOOD_ITEMS.map(([pattern]) => pattern),
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

const FOOD_PREFERENCE_PATTERNS: Array<[RegExp, MarketplaceFoodPreference]> = [
  [/\b(?:vegetarian|vegan|plant[- ]based)\b/i, "vegetarian"],
  [/素食|食素|齋/u, "vegetarian"],
  [/\b(?:japanese|sushi|ramen)\b/i, "japanese"],
  [/日式|日本菜|日本料理|壽司|拉麵/u, "japanese"],
  [/\b(?:cantonese|hong kong|dim sum|chinese)\b/i, "local_cantonese"],
  [/港式|粵菜|中菜|點心/u, "local_cantonese"],
  [/\b(?:western|pizza|burger|pasta)\b/i, "western_comfort"],
  [/西餐|薄餅|漢堡|意粉/u, "western_comfort"],
  [/\b(?:anything|no preference|surprise me)\b/i, "no_preference"],
  [/無所謂|冇所謂|隨便/u, "no_preference"],
];

const FULFILMENT_PATTERNS: Array<[RegExp, MarketplaceFulfilmentMethod]> = [
  [/\b(?:courier|deliver(?:y|ed)?|shipping|ship it)\b/i, "courier_delivery"],
  [/送貨|配送|外賣|速遞/u, "courier_delivery"],
  [/\b(?:personal agent|agent pickup|pick it up|pick up|collect|bring it back)\b/i, "personal_agent_pickup"],
  [/代理.*(?:去買|自取|拎返)|自取|拎返/u, "personal_agent_pickup"],
];

const PAYMENT_PATTERNS: Array<[RegExp, MarketplacePaymentMethod]> = [
  [/\b(?:cash on delivery|pay on delivery|cod|cash)\b/i, "pay_on_delivery"],
  [/貨到付款|到付|現金/u, "pay_on_delivery"],
  [/\b(?:card on file|credit card|debit card|card)\b/i, "card_on_file"],
  [/信用卡|扣帳卡|銀行卡/u, "card_on_file"],
  [/\b(?:asympta wallet|wallet|balance)\b/i, "asympta_wallet"],
  [/錢包|餘額/u, "asympta_wallet"],
];

const LATIN_ITEM_QUANTITIES: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
};

const CJK_ITEM_QUANTITIES: Record<string, number> = {
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
    if (pattern === APPLE_ITEM_PATTERN && APPLE_NON_FOOD_CONTEXT.test(text)) continue;
    const match = pattern.exec(text);
    if (!match || (best && match.index >= best.index)) continue;
    best = { index: match.index, evidence: match[0] };
  }
  return best;
}

function firstMappedMatch<T>(text: string, patterns: Array<[RegExp, T]>): ExtractedValue<T> | null {
  let best: { index: number; evidence: string; value: T } | null = null;
  for (const [pattern, value] of patterns) {
    const match = pattern.exec(text);
    if (!match || (best && match.index >= best.index)) continue;
    best = { index: match.index, evidence: match[0], value };
  }
  return best ? { value: best.value, evidence: best.evidence } : null;
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

function profileFact(key: string, value: ContextFact["value"], profile: AsymptaMarketplaceProfile): ContextFact {
  return {
    key,
    value,
    status: "profile",
    source: { type: "approved_user_profile", ref: marketplaceProfileSourceRef(profile) },
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

function matchItem(text: string, domain: MarketplaceDomain): MatchedItem | null {
  const candidates = domain === "food" ? FOOD_ITEMS : CLOTHING_ITEMS;
  let best: MatchedItem | null = null;
  for (const [pattern, label] of candidates) {
    if (pattern === APPLE_ITEM_PATTERN && APPLE_NON_FOOD_CONTEXT.test(text)) continue;
    const match = pattern.exec(text);
    if (!match || (best && match.index >= best.index)) continue;
    best = { label, evidence: match[0], index: match.index };
  }
  return best;
}

function quantityBeforeItem(text: string, item: MatchedItem) {
  const prefix = text.slice(Math.max(0, item.index - 24), item.index);
  const latin = /(?:^|\s)(a|an|one|two|three|four|five|\d{1,2})\s*$/i.exec(prefix);
  if (latin) {
    const token = latin[1].toLowerCase();
    const value = /^\d+$/.test(token) ? Number(token) : LATIN_ITEM_QUANTITIES[token];
    if (Number.isFinite(value)) {
      return {
        value: Math.max(1, Number(value)),
        evidence: `${latin[1]} ${item.evidence}`,
      };
    }
  }

  const cjk = /([一二兩两三四五壹貳參参\d]{1,2})\s*(?:個|个|件|份|盒|包|樽|瓶|支)?\s*$/u.exec(prefix);
  if (cjk) {
    const token = cjk[1];
    const value = /^\d+$/.test(token) ? Number(token) : CJK_ITEM_QUANTITIES[token];
    if (Number.isFinite(value)) {
      return {
        value: Math.max(1, Number(value)),
        evidence: `${cjk[0].trim()}${item.evidence}`,
      };
    }
  }
  return null;
}

function extractQuantity(text: string, domain: MarketplaceDomain, item: MatchedItem | null) {
  const itemQuantity = item ? quantityBeforeItem(text, item) : null;
  if (itemQuantity) return itemQuantity;

  const latinUnits = domain === "food"
    ? "meals?|servings?|portions?|orders?"
    : "items?|pieces?|sets?";
  const cjkUnits = domain === "food" ? "份|餐" : "件|套";
  const numeric = new RegExp(`(?:\\b(\\d{1,2})\\s*(?:${latinUnits})\\b)|(\\d{1,2})\\s*(?:${cjkUnits})`, "iu").exec(text);
  if (numeric) {
    const value = Number(numeric[1] ?? numeric[2]);
    return { value: Math.max(1, value), evidence: numeric[0] };
  }

  const words: Array<[RegExp, number]> = [
    [new RegExp(`\\bone\\s+(?:${latinUnits})\\b`, "iu"), 1],
    [new RegExp(`\\btwo\\s+(?:${latinUnits})\\b`, "iu"), 2],
    [new RegExp(`\\bthree\\s+(?:${latinUnits})\\b`, "iu"), 3],
    [new RegExp(`(?:一|壹)\\s*(?:${cjkUnits})`, "u"), 1],
    [new RegExp(`(?:兩|二|貳)\\s*(?:${cjkUnits})`, "u"), 2],
    [new RegExp(`(?:三|參)\\s*(?:${cjkUnits})`, "u"), 3],
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

function factValue<T extends string>(goal: MarketplaceGoal, key: string): T | null {
  const fact = goal.facts.find((candidate) => candidate.key === key);
  return typeof fact?.value === "string" ? fact.value as T : null;
}

export function marketplaceGoalItem(goal: MarketplaceGoal) {
  const fact = goal.facts.find((candidate) => candidate.key === "requested_item");
  if (typeof fact?.value === "string") return fact.value;
  if (goal.domain === "food") return "ready-to-eat meal";
  if (goal.domain === "clothing") return "everyday clothing set";
  return "general retail item";
}

export function marketplaceGoalQuantity(goal: MarketplaceGoal) {
  const fact = goal.facts.find((candidate) => candidate.key === "quantity");
  const value = Number(fact?.value ?? 1);
  return Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1;
}

export function marketplaceGoalFoodPreference(goal: MarketplaceGoal): MarketplaceFoodPreference | null {
  const value = factValue<MarketplaceFoodPreference>(goal, "food_preference");
  return isMarketplaceFoodPreference(value) ? value : null;
}

export function marketplaceGoalFulfilmentMethod(goal: MarketplaceGoal): MarketplaceFulfilmentMethod {
  const value = factValue<MarketplaceFulfilmentMethod>(goal, "fulfilment_mode");
  return isMarketplaceFulfilmentMethod(value) ? value : "personal_agent_pickup";
}

export function marketplaceGoalPaymentMethod(goal: MarketplaceGoal): MarketplacePaymentMethod {
  const value = factValue<MarketplacePaymentMethod>(goal, "payment_method");
  return isMarketplacePaymentMethod(value) ? value : "asympta_wallet";
}

function goalUnknownFields(domain: MarketplaceDomain, facts: ContextFact[]) {
  const keys = new Set(facts.map((fact) => fact.key));
  const candidates = domain === "food"
    ? ["dietary_constraints", "max_budget", "desired_time", "food_preference", "fulfilment_mode", "payment_method"]
    : ["size", "style", "occasion", "max_budget", "fulfilment_mode", "payment_method"];
  return candidates.filter((field) => !keys.has(field));
}

function buildGoal(
  match: DomainMatch,
  text: string,
  requestId: string,
  index: number,
  profile: AsymptaMarketplaceProfile | null,
): MarketplaceGoal {
  const facts: ContextFact[] = [explicitFact("domain", match.domain, requestId, match.evidence)];
  const item = matchItem(text, match.domain);
  const quantity = extractQuantity(text, match.domain, item);
  const budget = extractBudget(text);
  const foodPreference = match.domain === "food" ? firstMappedMatch(text, FOOD_PREFERENCE_PATTERNS) : null;
  const fulfilment = firstMappedMatch(text, FULFILMENT_PATTERNS);
  const payment = firstMappedMatch(text, PAYMENT_PATTERNS);

  if (item) {
    facts.push(explicitFact("requested_item", item.label, requestId, item.evidence));
  } else if (match.domain === "food" && profile?.foodPreference) {
    facts.push(profileFact("requested_item", marketplaceFoodPreferenceItem(profile.foodPreference), profile));
  } else {
    facts.push(defaultFact("requested_item", match.domain === "food" ? "ready-to-eat meal" : "everyday clothing set"));
  }

  if (match.domain === "food") {
    if (foodPreference) facts.push(explicitFact("food_preference", foodPreference.value, requestId, foodPreference.evidence));
    else if (profile?.foodPreference) facts.push(profileFact("food_preference", profile.foodPreference, profile));
  }

  facts.push(quantity
    ? explicitFact("quantity", quantity.value, requestId, quantity.evidence)
    : defaultFact("quantity", 1));
  if (budget) facts.push(explicitFact("max_budget", budget.value, requestId, budget.evidence));

  if (fulfilment) facts.push(explicitFact("fulfilment_mode", fulfilment.value, requestId, fulfilment.evidence));
  else if (profile?.fulfilmentMethod) facts.push(profileFact("fulfilment_mode", profile.fulfilmentMethod, profile));

  if (payment) facts.push(explicitFact("payment_method", payment.value, requestId, payment.evidence));
  else if (profile?.paymentMethod) facts.push(profileFact("payment_method", profile.paymentMethod, profile));

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
      "The selected carrier returns the requested item to the user.",
      "A delivery receipt confirms the item entered user inventory.",
    ],
  };
}

function profileRequirements(goals: MarketplaceGoal[]): ContextProfileRequirements {
  const required = new Set<MarketplaceProfileField>();
  const missing = new Set<MarketplaceProfileField>();
  const resolvedFromProfile = new Set<MarketplaceProfileField>();

  for (const goal of goals) {
    const item = goal.facts.find((fact) => fact.key === "requested_item");
    const foodPreference = goal.facts.find((fact) => fact.key === "food_preference");
    const fulfilment = goal.facts.find((fact) => fact.key === "fulfilment_mode");
    const payment = goal.facts.find((fact) => fact.key === "payment_method");

    if (goal.domain === "food" && item?.status === "defaulted") {
      required.add("foodPreference");
      if (!foodPreference) missing.add("foodPreference");
      else if (foodPreference.source.type === "approved_user_profile") resolvedFromProfile.add("foodPreference");
    }

    required.add("fulfilmentMethod");
    if (!fulfilment) missing.add("fulfilmentMethod");
    else if (fulfilment.source.type === "approved_user_profile") resolvedFromProfile.add("fulfilmentMethod");

    required.add("paymentMethod");
    if (!payment) missing.add("paymentMethod");
    else if (payment.source.type === "approved_user_profile") resolvedFromProfile.add("paymentMethod");
  }

  return {
    required: [...required],
    missing: [...missing],
    resolvedFromProfile: [...resolvedFromProfile],
  };
}

export function compileAsymptaContext(intention: string, options: CompilerOptions = {}): ContextCompilation {
  const clean = intention.replace(/\s+/g, " ").trim();
  if (!clean) return { supported: false, envelope: null, issues: ["An intention is required."], profileRequirements: EMPTY_PROFILE_REQUIREMENTS };
  if (clean.length > 600) return { supported: false, envelope: null, issues: ["An intention can contain at most 600 characters."], profileRequirements: EMPTY_PROFILE_REQUIREMENTS };

  const matches = domainMatches(clean);
  if (!matches.length) return { supported: false, envelope: null, issues: ["No supported marketplace goal was found."], profileRequirements: EMPTY_PROFILE_REQUIREMENTS };
  if (!firstPatternMatch(clean, MARKETPLACE_ACTION_PATTERNS)) {
    return {
      supported: false,
      envelope: null,
      issues: ["The message names a marketplace domain but does not ask to obtain anything."],
      profileRequirements: EMPTY_PROFILE_REQUIREMENTS,
    };
  }

  const requestId = options.requestId?.trim() || `market-${marketplaceStableHash(clean)}`;
  const profile = options.profile ?? null;
  const goals = matches.map((match, index) => buildGoal(match, clean, requestId, index, profile));
  const requirements = profileRequirements(goals);
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
    goals,
    sharedFacts: [
      defaultFact("execution_environment", "asympta_simulated_city"),
      defaultFact("user_handoff_location", "personal_agent_home"),
      ...(profile ? [profileFact("approved_profile", profile.presetId, profile)] : []),
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
      ...(profile ? { profileRef: marketplaceProfileSourceRef(profile) } : {}),
    },
  };

  const validation = validateContextEnvelope(envelope);
  return {
    supported: validation.valid,
    envelope: validation.valid ? envelope : null,
    issues: validation.issues,
    profileRequirements: requirements,
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
      if (fact.status === "profile" && fact.source.type !== "approved_user_profile") {
        issues.push(`${goal.id}:${fact.key} has an invalid profile source.`);
      }
      if (fact.status === "profile" && !fact.source.ref.startsWith("approved-profile:")) {
        issues.push(`${goal.id}:${fact.key} lacks an approved profile reference.`);
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
