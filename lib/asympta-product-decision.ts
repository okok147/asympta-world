export type ProductReferencePrice = {
  amount: number;
  currency: "USD" | "SGD" | "JPY";
  label: string;
};

export type ExactProductCandidate = {
  id: string;
  category: string;
  brand: string;
  model: string;
  exactName: string;
  summary: string;
  keySpecs: string[];
  referencePrice: ProductReferencePrice;
  manufacturerUrl: string;
  verifiedAt: string;
  verification: "manufacturer_reference";
};

export type ExactProductDecision = {
  category: string;
  requestedLabel: string;
  status: "choice_required" | "resolved";
  candidates: ExactProductCandidate[];
  selected?: ExactProductCandidate;
  provenance: "verified_reference_catalog";
};

const PURCHASE_ACTION = /\b(?:buy|purchase|order|get\s+me|bring\s+me|pick\s+up)\b|幫我買|帮我买|想買|想买|要買|要买|買いたい|購入したい/iu;
const GUITAR_CATEGORY = /\bguitars?\b|結他|吉他|ギター/iu;

const GUITAR_CANDIDATES: ExactProductCandidate[] = [
  {
    id: "martin-d-x2e",
    category: "guitar",
    brand: "Martin",
    model: "D-X2E",
    exactName: "Martin D-X2E",
    summary: "Acoustic-electric Dreadnought with Martin E-1 electronics and a softshell case.",
    keySpecs: ["6-string acoustic-electric", "D-14 Fret body", "Martin E-1 electronics", "Softshell case"],
    referencePrice: { amount: 749.99, currency: "USD", label: "US$749.99" },
    manufacturerUrl: "https://www.martinguitar.com/guitars/x-series/D-X2E.html",
    verifiedAt: "2026-09-02",
    verification: "manufacturer_reference",
  },
  {
    id: "taylor-214ce",
    category: "guitar",
    brand: "Taylor",
    model: "214ce",
    exactName: "Taylor 214ce",
    summary: "Grand Auditorium acoustic-electric with torrefied spruce top and Expression System 2 electronics.",
    keySpecs: ["6-string acoustic-electric", "Grand Auditorium body", "Torrefied spruce top", "ES2 electronics", "Gig bag"],
    referencePrice: { amount: 999, currency: "USD", label: "US$999" },
    manufacturerUrl: "https://www.taylorguitars.com/guitars/acoustic/214ce",
    verifiedAt: "2026-09-02",
    verification: "manufacturer_reference",
  },
  {
    id: "yamaha-fg830",
    category: "guitar",
    brand: "Yamaha",
    model: "FG830",
    exactName: "Yamaha FG830",
    summary: "Solid-top acoustic guitar with a traditional western body and rosewood back and sides.",
    keySpecs: ["Traditional Western body", "Solid spruce top", "Rosewood back and sides", "Scalloped bracing"],
    referencePrice: { amount: 505, currency: "SGD", label: "S$505" },
    manufacturerUrl: "https://shop.sg.yamaha.com/products/guitars-basses/acoustic-guitars/fg830.html",
    verifiedAt: "2026-09-02",
    verification: "manufacturer_reference",
  },
];

function normalized(value: string) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function exactCandidateInIntent(intent: string, candidates: ExactProductCandidate[]) {
  const haystack = normalized(intent);
  return candidates.find((candidate) => {
    const exact = normalized(candidate.exactName);
    const model = normalized(candidate.model);
    return haystack.includes(exact) || (haystack.includes(normalized(candidate.brand)) && haystack.includes(model));
  });
}

export function exactProductDecisionForIntent(intent: string): ExactProductDecision | null {
  const clean = intent.trim();
  if (!PURCHASE_ACTION.test(clean)) return null;
  if (GUITAR_CATEGORY.test(clean) || GUITAR_CANDIDATES.some((candidate) => exactCandidateInIntent(clean, [candidate]))) {
    const selected = exactCandidateInIntent(clean, GUITAR_CANDIDATES);
    return {
      category: "guitar",
      requestedLabel: "guitar",
      status: selected ? "resolved" : "choice_required",
      candidates: GUITAR_CANDIDATES.map((candidate) => ({ ...candidate, keySpecs: [...candidate.keySpecs], referencePrice: { ...candidate.referencePrice } })),
      ...(selected ? { selected: { ...selected, keySpecs: [...selected.keySpecs], referencePrice: { ...selected.referencePrice } } } : {}),
      provenance: "verified_reference_catalog",
    };
  }
  return null;
}

export function applyExactProductSelection(intent: string, candidate: ExactProductCandidate) {
  const replacement = `${candidate.exactName} guitar`;
  if (GUITAR_CATEGORY.test(intent)) return intent.replace(GUITAR_CATEGORY, replacement);
  return `${intent.trim()} Exact product: ${replacement}.`;
}

export function exactProductCandidates(category: string) {
  return category === "guitar"
    ? GUITAR_CANDIDATES.map((candidate) => ({ ...candidate, keySpecs: [...candidate.keySpecs], referencePrice: { ...candidate.referencePrice } }))
    : [];
}
