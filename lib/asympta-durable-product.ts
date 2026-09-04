import {
  validateContextEnvelope,
  type CompilerOptions,
  type ContextCompilation,
  type ContextFact,
  type MarketplaceGoal,
} from "./asympta-context-compiler.ts";
import {
  MARKETPLACE_SELECTION_FIELD,
  matchMarketplaceSelection,
  type MarketplaceSelectionOffer,
} from "./asympta-marketplace-selection-gate.ts";
import { compileSimpleProductContext } from "./asympta-simple-product.ts";

export type DurableProductMatch = {
  index: number;
  evidence: string;
  label: string;
  productClass: "vehicle";
};

type DurableProductSelection = {
  offer: MarketplaceSelectionOffer;
  evidence: string;
};

const ENGLISH_VEHICLE_PURCHASE = /\b(?:buy|purchase|order|get\s+me|bring\s+me|want|need|would\s+like)\s+(?:me\s+)?(?:(?:a|an|one|1)\s+)?(car|vehicle|automobile|motorcycle|motorbike|scooter|van|truck)\b/iu;
const CJK_VEHICLE_PURCHASE = /(?:幫我買|帮我买|想買|想买|要買|要买|我要買|我要买)\s*(?:一\s*(?:架|輛|辆|部|台|臺)?\s*)?(汽車|汽车|私家車|私家车|電單車|电单车|摩托車|摩托车)/u;
const JAPANESE_VEHICLE_PURCHASE = /(自動車|乗用車|バイク|オートバイ)を(?:買いたい|購入したい)/u;
const VEHICLE_ADD_ON_AFTER_ITEM = /^\s+(?:insurance|loan|finance|financing|shares?|stock|parts?|tires?|tyres?|licen[cs]e|registration)\b/iu;
const GENERATED_SELECTION_MARKER = /\s*·\s*Selected option:\s*[^·]+$/iu;

const VEHICLE_LABELS: Record<string, string> = {
  car: "car",
  vehicle: "car",
  automobile: "car",
  motorcycle: "motorcycle",
  motorbike: "motorcycle",
  scooter: "scooter",
  van: "van",
  truck: "truck",
  汽車: "car",
  汽车: "car",
  私家車: "car",
  私家车: "car",
  電單車: "motorcycle",
  电单车: "motorcycle",
  摩托車: "motorcycle",
  摩托车: "motorcycle",
  自動車: "car",
  乗用車: "car",
  バイク: "motorcycle",
  オートバイ: "motorcycle",
};

function vehicleMatch(text: string): DurableProductMatch | null {
  const english = ENGLISH_VEHICLE_PURCHASE.exec(text);
  if (english) {
    const evidence = english[1];
    const index = (english.index ?? 0) + english[0].lastIndexOf(evidence);
    if (VEHICLE_ADD_ON_AFTER_ITEM.test(text.slice(index + evidence.length))) return null;
    return { index, evidence, label: VEHICLE_LABELS[evidence.toLowerCase()] ?? evidence.toLowerCase(), productClass: "vehicle" };
  }

  const cjk = CJK_VEHICLE_PURCHASE.exec(text);
  if (cjk) {
    const evidence = cjk[1];
    const index = (cjk.index ?? 0) + cjk[0].lastIndexOf(evidence);
    return { index, evidence, label: VEHICLE_LABELS[evidence] ?? evidence, productClass: "vehicle" };
  }

  const japanese = JAPANESE_VEHICLE_PURCHASE.exec(text);
  if (japanese) {
    const evidence = japanese[1];
    const index = (japanese.index ?? 0) + japanese[0].indexOf(evidence);
    return { index, evidence, label: VEHICLE_LABELS[evidence] ?? evidence, productClass: "vehicle" };
  }
  return null;
}

function systemFact(key: string, value: string | number): ContextFact {
  return {
    key,
    value,
    status: "defaulted",
    source: {
      type: "system_default",
      ref: "system:durable-product-fulfilment/v3",
    },
    confidence: 1,
    scope: "task",
  };
}

function explicitFact(key: string, value: string, requestId: string, evidence: string): ContextFact {
  return {
    key,
    value,
    status: "explicit",
    source: {
      type: "user_message",
      ref: requestId,
      evidence,
    },
    confidence: 1,
    scope: "task",
  };
}

function restoreVehicleEvidence(fact: ContextFact, match: DurableProductMatch, requestId: string): ContextFact {
  if (fact.source.type !== "user_message") return fact;
  const evidence = fact.source.evidence?.replace(/guitar/giu, match.evidence);
  return {
    ...fact,
    source: {
      ...fact.source,
      ref: requestId,
      ...(evidence ? { evidence } : {}),
    },
  };
}

function durableScaffoldText(text: string, selection: DurableProductSelection | null) {
  if (!selection) return text;
  const normalized = text.replace(GENERATED_SELECTION_MARKER, "").trim();
  if (normalized !== text.trim()) return normalized;

  // A concrete model is evidence for the selection gate, not a second product
  // for the generic product parser. Remove it only from the temporary scaffold;
  // the original message remains authoritative and is restored below.
  return text
    .replace(selection.evidence, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s*[·—,:;/|-]\s*$/u, "")
    .trim();
}

function patchVehicleGoal(
  goal: MarketplaceGoal,
  match: DurableProductMatch,
  requestId: string,
  selection: DurableProductSelection | null,
): MarketplaceGoal {
  const facts = goal.facts
    .filter((fact) => ![
      "product_class",
      "handling_class",
      "fulfilment_mode",
      "market_selection",
      MARKETPLACE_SELECTION_FIELD,
      "selected_offer_label",
      "offer_price_hkd",
      "offer_seller_id",
      "offer_provenance",
    ].includes(fact.key))
    .map((fact) => restoreVehicleEvidence(fact, match, requestId))
    .map((fact) => {
      if (fact.key !== "requested_item") return fact;
      const evidence = selection?.evidence ?? match.evidence;
      return {
        ...fact,
        value: selection?.offer.itemLabel ?? match.label,
        status: "explicit" as const,
        source: {
          type: "user_message" as const,
          ref: requestId,
          evidence,
        },
        confidence: 1,
      };
    });

  facts.push(
    explicitFact("product_class", match.productClass, requestId, match.evidence),
    systemFact("handling_class", "vehicle_transport"),
    // Fulfilment/payment here are execution mechanics, not a substitute for
    // choosing the thing itself. The concrete-selection requirement in the
    // task protocol remains blocking until a user-confirmed offer is present.
    systemFact("fulfilment_mode", "courier_delivery"),
  );
  if (!facts.some((fact) => fact.key === "payment_method")) {
    facts.push(systemFact("payment_method", "asympta_wallet"));
  }

  if (selection) {
    facts.push(
      explicitFact(MARKETPLACE_SELECTION_FIELD, selection.offer.id, requestId, selection.evidence),
      explicitFact("selected_offer_label", selection.offer.itemLabel, requestId, selection.evidence),
      systemFact("market_selection", selection.offer.sellerId),
      systemFact("offer_price_hkd", selection.offer.price.amount),
      systemFact("offer_seller_id", selection.offer.sellerId),
      systemFact("offer_provenance", selection.offer.provenance),
    );
  } else {
    facts.push(systemFact("market_selection", "simulated_vehicle_market"));
  }

  const unknownFields = goal.unknownFields.filter((field) => !["fulfilment_mode", "payment_method", MARKETPLACE_SELECTION_FIELD].includes(field));
  if (!selection) unknownFields.unshift(MARKETPLACE_SELECTION_FIELD);

  return {
    ...goal,
    domain: "retail",
    facts,
    unknownFields: [...new Set(unknownFields)],
    successCriteria: [
      "A user-confirmed concrete vehicle offer is bound before commitment or execution starts.",
      "A simulated dealer confirms the bounded selected vehicle offer.",
      "A human approves the consequential simulated purchase before settlement.",
      "Vehicle handoff and transport are recorded with simulated provenance.",
      "A delivery receipt verifies the vehicle reached the user-side handoff state.",
    ],
  };
}

export function compileDurableProductContext(
  intention: string,
  options: CompilerOptions = {},
): ContextCompilation | null {
  const clean = intention.replace(/\s+/g, " ").trim();
  if (!clean || clean.length > 600) return null;
  const match = vehicleMatch(clean);
  if (!match) return null;
  const selection = matchMarketplaceSelection(clean, match.productClass);

  // Reuse the proven generic physical-product compiler as a temporary syntax
  // scaffold. Concrete offer evidence is deliberately removed from that
  // scaffold so it cannot be mistaken for a second product goal.
  const scaffoldText = durableScaffoldText(clean, selection);
  const scaffoldMatch = vehicleMatch(scaffoldText) ?? match;
  const surrogate = `${scaffoldText.slice(0, scaffoldMatch.index)}guitar${scaffoldText.slice(scaffoldMatch.index + scaffoldMatch.evidence.length)}`;
  const compiled = compileSimpleProductContext(surrogate, options);
  if (!compiled?.supported || !compiled.envelope) return null;

  const requestId = compiled.envelope.requestId;
  const envelope = {
    ...compiled.envelope,
    rawMessage: {
      ...compiled.envelope.rawMessage,
      text: clean,
      sourceRef: requestId,
    },
    goals: compiled.envelope.goals.map((goal) => patchVehicleGoal(goal, match, requestId, selection)),
  };
  const validation = validateContextEnvelope(envelope);
  if (!validation.valid) {
    return {
      supported: false,
      envelope: null,
      issues: validation.issues,
      profileRequirements: compiled.profileRequirements,
    };
  }

  return {
    supported: true,
    envelope,
    issues: [],
    // Vehicle requests do not depend on global marketplace preferences. Their
    // own concrete-selection gate is task-scoped and is evaluated separately
    // by buildMarketplaceTaskProtocol before any workflow can be constructed.
    profileRequirements: {
      required: [],
      missing: [],
      resolvedFromProfile: [],
    },
  };
}
