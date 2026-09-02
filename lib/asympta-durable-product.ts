import {
  validateContextEnvelope,
  type CompilerOptions,
  type ContextCompilation,
  type ContextFact,
  type MarketplaceGoal,
} from "./asympta-context-compiler.ts";
import { compileSimpleProductContext } from "./asympta-simple-product.ts";

export type DurableProductMatch = {
  index: number;
  evidence: string;
  label: string;
  productClass: "vehicle";
};

const ENGLISH_VEHICLE_PURCHASE = /\b(?:buy|purchase|order|get\s+me|bring\s+me)\s+(?:me\s+)?(?:(?:a|an|one|1)\s+)?(car|vehicle|automobile|motorcycle|motorbike|scooter|van|truck)\b/iu;
const CJK_VEHICLE_PURCHASE = /(?:幫我買|帮我买|想買|想买|要買|要买|我要買|我要买)\s*(?:一\s*(?:架|輛|辆|部|台|臺)?\s*)?(汽車|汽车|私家車|私家车|電單車|电单车|摩托車|摩托车)/u;
const JAPANESE_VEHICLE_PURCHASE = /(自動車|乗用車|バイク|オートバイ)を(?:買いたい|購入したい)/u;
const VEHICLE_ADD_ON_AFTER_ITEM = /^\s+(?:insurance|loan|finance|financing|shares?|stock|parts?|tires?|tyres?|licen[cs]e|registration)\b/iu;

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

function systemFact(key: string, value: string, requestId: string): ContextFact {
  return {
    key,
    value,
    status: "defaulted",
    source: {
      type: "system_default",
      ref: "system:durable-product-fulfilment/v1",
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

function patchVehicleGoal(goal: MarketplaceGoal, match: DurableProductMatch, requestId: string): MarketplaceGoal {
  const facts = goal.facts
    .filter((fact) => !["product_class", "handling_class", "fulfilment_mode", "market_selection"].includes(fact.key))
    .map((fact) => {
      if (fact.key !== "requested_item") return fact;
      return {
        ...fact,
        value: match.label,
        status: "explicit" as const,
        source: {
          type: "user_message" as const,
          ref: requestId,
          evidence: match.evidence,
        },
        confidence: 1,
      };
    });

  facts.push(
    explicitFact("product_class", match.productClass, requestId, match.evidence),
    systemFact("handling_class", "vehicle_transport", requestId),
    systemFact("market_selection", "simulated_vehicle_dealer", requestId),
    // A personal/animal agent cannot physically carry a vehicle. Vehicle
    // purchases therefore default to the logistics/transport lane; payment
    // still remains human-gated by the existing marketplace contract.
    systemFact("fulfilment_mode", "courier_delivery", requestId),
  );

  return {
    ...goal,
    domain: "retail",
    facts,
    unknownFields: goal.unknownFields.filter((field) => field !== "fulfilment_mode"),
    successCriteria: [
      "A simulated dealer confirms a bounded vehicle offer.",
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

  // Reuse the proven generic physical-product compiler as the syntactic
  // scaffold, then restore the real durable item and attach a handling class.
  // This keeps one marketplace protocol instead of adding a car-only workflow.
  const surrogate = `${clean.slice(0, match.index)}guitar${clean.slice(match.index + match.evidence.length)}`;
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
    goals: compiled.envelope.goals.map((goal) => patchVehicleGoal(goal, match, requestId)),
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
    profileRequirements: {
      required: compiled.profileRequirements.required.filter((field) => field !== "fulfilmentMethod"),
      missing: compiled.profileRequirements.missing.filter((field) => field !== "fulfilmentMethod"),
      resolvedFromProfile: compiled.profileRequirements.resolvedFromProfile.filter((field) => field !== "fulfilmentMethod"),
    },
  };
}
