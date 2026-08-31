import {
  normalizeMarketplaceProfile,
  type AsymptaMarketplaceProfile,
  type MarketplaceFoodPreference,
  type MarketplaceFulfilmentMethod,
  type MarketplacePaymentMethod,
} from "./asympta-marketplace-profile.ts";
import {
  normalizeAsymptaUserContextProfile,
  removeAsymptaUserContextFact,
  selectAsymptaUserContextFacts,
  upsertAsymptaUserContextFact,
  type AsymptaUserContextProfile,
} from "./asympta-user-context-profile.ts";

const MARKETPLACE_CONTEXT_KEYS = {
  foodPreference: { domain: "food", key: "food_preference" },
  fulfilmentMethod: { domain: "marketplace", key: "fulfilment_mode" },
  paymentMethod: { domain: "payment", key: "payment_method" },
  presetId: { domain: "marketplace", key: "profile_preset" },
} as const;

function sourceRef(profile: AsymptaMarketplaceProfile) {
  return `approved-profile:${profile.presetId}:${profile.updatedAt}`;
}

export function mergeMarketplaceProfileIntoUserContext(
  context: AsymptaUserContextProfile | null,
  profile: AsymptaMarketplaceProfile | null,
  now: number | string | Date = Date.now(),
) {
  let next = normalizeAsymptaUserContextProfile(context, now);
  if (!profile) return removeMarketplaceFactsFromUserContext(next, now);
  const normalized = normalizeMarketplaceProfile(profile);
  if (!normalized) return removeMarketplaceFactsFromUserContext(next, now);
  const ref = sourceRef(normalized);

  next = upsertAsymptaUserContextFact(next, {
    ...MARKETPLACE_CONTEXT_KEYS.presetId,
    value: normalized.presetId,
    source: { type: "approved_user_profile", ref },
  }, normalized.updatedAt);

  if (normalized.foodPreference) {
    next = upsertAsymptaUserContextFact(next, {
      ...MARKETPLACE_CONTEXT_KEYS.foodPreference,
      value: normalized.foodPreference,
      source: { type: "approved_user_profile", ref },
    }, normalized.updatedAt);
  }
  if (normalized.fulfilmentMethod) {
    next = upsertAsymptaUserContextFact(next, {
      ...MARKETPLACE_CONTEXT_KEYS.fulfilmentMethod,
      value: normalized.fulfilmentMethod,
      source: { type: "approved_user_profile", ref },
    }, normalized.updatedAt);
  }
  if (normalized.paymentMethod) {
    next = upsertAsymptaUserContextFact(next, {
      ...MARKETPLACE_CONTEXT_KEYS.paymentMethod,
      value: normalized.paymentMethod,
      source: { type: "approved_user_profile", ref },
    }, normalized.updatedAt);
  }
  return next;
}

export function marketplaceProfileFromUserContext(
  context: AsymptaUserContextProfile | null,
): AsymptaMarketplaceProfile | null {
  const facts = selectAsymptaUserContextFacts(context, {
    domains: ["food", "marketplace", "payment"],
    keys: ["food_preference", "fulfilment_mode", "payment_method", "profile_preset"],
    includeSensitive: false,
    includeInferred: false,
  });
  const values = new Map(facts.map((fact) => [`${fact.domain}:${fact.key}`, fact.value]));
  const foodPreference = values.get("food:food_preference") as MarketplaceFoodPreference | undefined;
  const fulfilmentMethod = values.get("marketplace:fulfilment_mode") as MarketplaceFulfilmentMethod | undefined;
  const paymentMethod = values.get("payment:payment_method") as MarketplacePaymentMethod | undefined;
  const presetId = values.get("marketplace:profile_preset");
  if (!foodPreference && !fulfilmentMethod && !paymentMethod) return null;
  const latest = facts
    .map((fact) => new Date(fact.updatedAt).getTime())
    .filter(Number.isFinite)
    .sort((left, right) => right - left)[0] ?? 0;
  return normalizeMarketplaceProfile({
    schemaVersion: "asympta.marketplace-profile.v1",
    presetId: typeof presetId === "string" ? presetId : "custom",
    ...(foodPreference ? { foodPreference } : {}),
    ...(fulfilmentMethod ? { fulfilmentMethod } : {}),
    ...(paymentMethod ? { paymentMethod } : {}),
    updatedAt: new Date(latest).toISOString(),
  });
}

export function removeMarketplaceFactsFromUserContext(
  context: AsymptaUserContextProfile | null,
  now: number | string | Date = Date.now(),
) {
  let next = normalizeAsymptaUserContextProfile(context, now);
  for (const { domain, key } of Object.values(MARKETPLACE_CONTEXT_KEYS)) {
    next = removeAsymptaUserContextFact(next, domain, key, now);
  }
  return next;
}

export function marketplaceContextFactKeys() {
  return Object.values(MARKETPLACE_CONTEXT_KEYS).map(({ domain, key }) => `${domain}:${key}`);
}
