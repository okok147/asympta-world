import type { MarketplaceGoal } from "./asympta-context-compiler.ts";
import type {
  AsymptaLocalizedText,
  AsymptaTaskQuestionOption,
  AsymptaTaskRequirement,
} from "./asympta-task-protocol.ts";

export const MARKETPLACE_SELECTION_GATE_VERSION = "asympta.selection-gate.v1" as const;
export const MARKETPLACE_SELECTION_FIELD = "selected_offer_id" as const;

export type MarketplaceSelectionOffer = {
  id: string;
  productClass: string;
  itemLabel: string;
  sellerId: string;
  price: {
    amount: number;
    currency: "HKD";
  };
  provenance: "simulated";
  label: AsymptaLocalizedText;
  description: AsymptaLocalizedText;
  aliases: RegExp[];
};

export type MarketplaceSelectionGateSpec = {
  schemaVersion: typeof MARKETPLACE_SELECTION_GATE_VERSION;
  goalId: string;
  field: typeof MARKETPLACE_SELECTION_FIELD;
  productClass: string;
  prompt: AsymptaLocalizedText;
  description: AsymptaLocalizedText;
  options: MarketplaceSelectionOffer[];
  requiredBefore: "commitment";
  provenance: "simulated";
};

const INTERNAL_SELECTION_ASSIGNMENT = /(?:^|[\s{[,;·])["']?(?:selected_offer_id|selectedOfferId)["']?\s*[:=]\s*["']?[^,;}\]·\n]+["']?/giu;

const VEHICLE_OFFERS: MarketplaceSelectionOffer[] = [
  {
    id: "vehicle:mercedes-c200",
    productClass: "vehicle",
    itemLabel: "Mercedes-Benz C 200",
    sellerId: "simulated-dealer:mercedes",
    price: { amount: 438_000, currency: "HKD" },
    provenance: "simulated",
    label: {
      en: "Mercedes-Benz C 200",
      "zh-Hant": "Mercedes-Benz C 200",
      ja: "Mercedes-Benz C 200",
    },
    description: {
      en: "Demo quote · HK$438,000 · simulated dealer",
      "zh-Hant": "示範報價 · HK$438,000 · 模擬車商",
      ja: "デモ見積 · HK$438,000 · シミュレーション販売店",
    },
    aliases: [
      /\bmercedes(?:-benz)?\s+c\s*200\b/iu,
      /\bbenz\s+c\s*200\b/iu,
      /\bc\s*200\b/iu,
    ],
  },
  {
    id: "vehicle:tesla-model-3",
    productClass: "vehicle",
    itemLabel: "Tesla Model 3",
    sellerId: "simulated-dealer:tesla",
    price: { amount: 268_000, currency: "HKD" },
    provenance: "simulated",
    label: {
      en: "Tesla Model 3",
      "zh-Hant": "Tesla Model 3",
      ja: "Tesla Model 3",
    },
    description: {
      en: "Demo quote · HK$268,000 · simulated dealer",
      "zh-Hant": "示範報價 · HK$268,000 · 模擬車商",
      ja: "デモ見積 · HK$268,000 · シミュレーション販売店",
    },
    aliases: [
      /\btesla\s+(?:model\s*)?3\b/iu,
      /\bmodel\s*3\b/iu,
    ],
  },
  {
    id: "vehicle:toyota-corolla-cross",
    productClass: "vehicle",
    itemLabel: "Toyota Corolla Cross",
    sellerId: "simulated-dealer:toyota",
    price: { amount: 298_000, currency: "HKD" },
    provenance: "simulated",
    label: {
      en: "Toyota Corolla Cross",
      "zh-Hant": "Toyota Corolla Cross",
      ja: "Toyota Corolla Cross",
    },
    description: {
      en: "Demo quote · HK$298,000 · simulated dealer",
      "zh-Hant": "示範報價 · HK$298,000 · 模擬車商",
      ja: "デモ見積 · HK$298,000 · シミュレーション販売店",
    },
    aliases: [
      /\btoyota\s+corolla\s+cross\b/iu,
      /\bcorolla\s+cross\b/iu,
    ],
  },
];

const CATALOGUES: Record<string, MarketplaceSelectionOffer[]> = {
  vehicle: VEHICLE_OFFERS,
};

function factString(goal: MarketplaceGoal, key: string) {
  const fact = goal.facts.find((candidate) => candidate.key === key);
  return typeof fact?.value === "string" ? fact.value : null;
}

function selectionEvidenceText(text: string) {
  INTERNAL_SELECTION_ASSIGNMENT.lastIndex = 0;
  return text.replace(INTERNAL_SELECTION_ASSIGNMENT, " ").replace(/\s+/g, " ").trim();
}

function aliasMatch(text: string, offer: MarketplaceSelectionOffer) {
  for (const alias of offer.aliases) {
    alias.lastIndex = 0;
    const match = alias.exec(text);
    if (match) return match[0];
  }
  return null;
}

function selectionGateCopy(productClass: string) {
  if (productClass === "vehicle") {
    return {
      prompt: {
        en: "There are a few options. Which car do you want?",
        "zh-Hant": "這裏有幾個選擇，你想要哪一架車？",
        ja: "いくつか候補があります。どの車にしますか？",
      },
      description: {
        en: "Choose one concrete demo offer first. Agents will not start purchasing work until you confirm the target.",
        "zh-Hant": "先選定一個具體示範方案；在你確認目標之前，代理不會開始購買流程。",
        ja: "まず具体的なデモ候補を一つ選んでください。対象を確認するまで購入ワークフローは開始しません。",
      },
    } satisfies { prompt: AsymptaLocalizedText; description: AsymptaLocalizedText };
  }
  return {
    prompt: {
      en: "There are a few options. Which one do you want?",
      "zh-Hant": "這裏有幾個選擇，你想要哪一個？",
      ja: "いくつか候補があります。どれにしますか？",
    },
    description: {
      en: "Choose and confirm one concrete target before execution starts.",
      "zh-Hant": "執行前先選擇並確認一個具體目標。",
      ja: "実行前に具体的な対象を一つ選んで確認してください。",
    },
  } satisfies { prompt: AsymptaLocalizedText; description: AsymptaLocalizedText };
}

export function marketplaceSelectionGateForGoal(goal: MarketplaceGoal): MarketplaceSelectionGateSpec | null {
  const productClass = factString(goal, "product_class");
  if (!productClass) return null;
  const options = CATALOGUES[productClass];
  if (!options?.length) return null;
  const copy = selectionGateCopy(productClass);
  return {
    schemaVersion: MARKETPLACE_SELECTION_GATE_VERSION,
    goalId: goal.id,
    field: MARKETPLACE_SELECTION_FIELD,
    productClass,
    prompt: copy.prompt,
    description: copy.description,
    options,
    requiredBefore: "commitment",
    provenance: "simulated",
  };
}

export function marketplaceSelectionOfferById(goal: MarketplaceGoal, offerId: string) {
  return marketplaceSelectionGateForGoal(goal)?.options.find((offer) => offer.id === offerId) ?? null;
}

export function matchMarketplaceSelection(text: string, productClass: string) {
  const evidenceText = selectionEvidenceText(text);
  const offers = CATALOGUES[productClass] ?? [];
  for (const offer of offers) {
    const evidence = aliasMatch(evidenceText, offer);
    if (evidence) return { offer, evidence };
  }
  return null;
}

export function marketplaceSelectionRequirement(goal: MarketplaceGoal): AsymptaTaskRequirement | null {
  const gate = marketplaceSelectionGateForGoal(goal);
  if (!gate) return null;
  const options: AsymptaTaskQuestionOption[] = gate.options.map((offer) => ({
    value: offer.id,
    label: offer.label,
    description: offer.description,
  }));
  return {
    id: `${goal.id}:concrete-selection`,
    capability: "marketplace.select_concrete_offer",
    field: gate.field,
    stage: "selection",
    blocking: true,
    priority: 120,
    userEffort: 1,
    description: gate.description,
    acceptedValues: gate.options.map((offer) => offer.id),
    question: {
      prompt: gate.prompt,
      answerType: "single_choice",
      options,
      remember: "never",
    },
  };
}

export function marketplaceSelectionConfirmationIntent(
  originalIntent: string,
  goal: MarketplaceGoal,
  offerId: string,
) {
  const offer = marketplaceSelectionOfferById(goal, offerId);
  if (!offer) throw new Error(`Unknown marketplace selection: ${offerId}.`);
  const clean = originalIntent.replace(/\s+/g, " ").trim();
  if (aliasMatch(selectionEvidenceText(clean), offer)) return clean;
  // A click/tap confirmation is normalized into the same evidence-bearing input
  // channel as typed text. Internal field-like text is deliberately excluded
  // from evidence so serialized state can never grant authority by itself.
  return `${clean} · Selected option: ${offer.itemLabel}`;
}

export function marketplaceSelectionIsResolved(goal: MarketplaceGoal) {
  const gate = marketplaceSelectionGateForGoal(goal);
  if (!gate) return true;
  const selected = factString(goal, gate.field);
  return Boolean(selected && gate.options.some((offer) => offer.id === selected));
}
