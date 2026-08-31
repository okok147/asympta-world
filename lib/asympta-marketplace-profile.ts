export type MarketplaceFoodPreference =
  | "no_preference"
  | "local_cantonese"
  | "japanese"
  | "western_comfort"
  | "vegetarian";

export type MarketplaceFulfilmentMethod =
  | "personal_agent_pickup"
  | "courier_delivery";

export type MarketplacePaymentMethod =
  | "asympta_wallet"
  | "card_on_file"
  | "pay_on_delivery";

export type MarketplaceProfileField =
  | "foodPreference"
  | "fulfilmentMethod"
  | "paymentMethod";

export type MarketplaceProfilePresetId =
  | "everyday"
  | "local_delivery"
  | "plant_friendly"
  | "custom";

export type AsymptaMarketplaceProfile = {
  schemaVersion: "asympta.marketplace-profile.v1";
  presetId: MarketplaceProfilePresetId;
  foodPreference?: MarketplaceFoodPreference;
  fulfilmentMethod?: MarketplaceFulfilmentMethod;
  paymentMethod?: MarketplacePaymentMethod;
  updatedAt: string;
};

export type MarketplaceProfilePreset = {
  id: Exclude<MarketplaceProfilePresetId, "custom">;
  foodPreference: MarketplaceFoodPreference;
  fulfilmentMethod: MarketplaceFulfilmentMethod;
  paymentMethod: MarketplacePaymentMethod;
};

export const MARKETPLACE_PROFILE_PRESETS: MarketplaceProfilePreset[] = [
  {
    id: "everyday",
    foodPreference: "no_preference",
    fulfilmentMethod: "personal_agent_pickup",
    paymentMethod: "asympta_wallet",
  },
  {
    id: "local_delivery",
    foodPreference: "local_cantonese",
    fulfilmentMethod: "courier_delivery",
    paymentMethod: "card_on_file",
  },
  {
    id: "plant_friendly",
    foodPreference: "vegetarian",
    fulfilmentMethod: "courier_delivery",
    paymentMethod: "asympta_wallet",
  },
];

const FOOD_PREFERENCES = new Set<MarketplaceFoodPreference>([
  "no_preference",
  "local_cantonese",
  "japanese",
  "western_comfort",
  "vegetarian",
]);

const FULFILMENT_METHODS = new Set<MarketplaceFulfilmentMethod>([
  "personal_agent_pickup",
  "courier_delivery",
]);

const PAYMENT_METHODS = new Set<MarketplacePaymentMethod>([
  "asympta_wallet",
  "card_on_file",
  "pay_on_delivery",
]);

const PRESET_IDS = new Set<MarketplaceProfilePresetId>([
  "everyday",
  "local_delivery",
  "plant_friendly",
  "custom",
]);

function normalizedDate(value: unknown, fallback: number | string | Date = Date.now()) {
  const candidate = typeof value === "string" ? new Date(value) : new Date(fallback);
  return Number.isFinite(candidate.getTime()) ? candidate.toISOString() : new Date(0).toISOString();
}

export function isMarketplaceFoodPreference(value: unknown): value is MarketplaceFoodPreference {
  return typeof value === "string" && FOOD_PREFERENCES.has(value as MarketplaceFoodPreference);
}

export function isMarketplaceFulfilmentMethod(value: unknown): value is MarketplaceFulfilmentMethod {
  return typeof value === "string" && FULFILMENT_METHODS.has(value as MarketplaceFulfilmentMethod);
}

export function isMarketplacePaymentMethod(value: unknown): value is MarketplacePaymentMethod {
  return typeof value === "string" && PAYMENT_METHODS.has(value as MarketplacePaymentMethod);
}

export function normalizeMarketplaceProfile(value: unknown): AsymptaMarketplaceProfile | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<AsymptaMarketplaceProfile>;
  const profile: AsymptaMarketplaceProfile = {
    schemaVersion: "asympta.marketplace-profile.v1",
    presetId: typeof candidate.presetId === "string" && PRESET_IDS.has(candidate.presetId as MarketplaceProfilePresetId)
      ? candidate.presetId as MarketplaceProfilePresetId
      : "custom",
    updatedAt: normalizedDate(candidate.updatedAt),
  };
  if (isMarketplaceFoodPreference(candidate.foodPreference)) profile.foodPreference = candidate.foodPreference;
  if (isMarketplaceFulfilmentMethod(candidate.fulfilmentMethod)) profile.fulfilmentMethod = candidate.fulfilmentMethod;
  if (isMarketplacePaymentMethod(candidate.paymentMethod)) profile.paymentMethod = candidate.paymentMethod;
  return profile;
}

export function marketplaceProfilePreset(
  presetId: Exclude<MarketplaceProfilePresetId, "custom">,
  now: number | string | Date = Date.now(),
): AsymptaMarketplaceProfile {
  const preset = MARKETPLACE_PROFILE_PRESETS.find((candidate) => candidate.id === presetId)
    ?? MARKETPLACE_PROFILE_PRESETS[0];
  return {
    schemaVersion: "asympta.marketplace-profile.v1",
    presetId: preset.id,
    foodPreference: preset.foodPreference,
    fulfilmentMethod: preset.fulfilmentMethod,
    paymentMethod: preset.paymentMethod,
    updatedAt: normalizedDate(undefined, now),
  };
}

export function patchMarketplaceProfile(
  current: AsymptaMarketplaceProfile | null,
  patch: Partial<Pick<AsymptaMarketplaceProfile, "foodPreference" | "fulfilmentMethod" | "paymentMethod">>,
  now: number | string | Date = Date.now(),
): AsymptaMarketplaceProfile {
  const next: AsymptaMarketplaceProfile = {
    schemaVersion: "asympta.marketplace-profile.v1",
    presetId: "custom",
    updatedAt: normalizedDate(undefined, now),
  };
  const foodPreference = patch.foodPreference ?? current?.foodPreference;
  const fulfilmentMethod = patch.fulfilmentMethod ?? current?.fulfilmentMethod;
  const paymentMethod = patch.paymentMethod ?? current?.paymentMethod;
  if (isMarketplaceFoodPreference(foodPreference)) next.foodPreference = foodPreference;
  if (isMarketplaceFulfilmentMethod(fulfilmentMethod)) next.fulfilmentMethod = fulfilmentMethod;
  if (isMarketplacePaymentMethod(paymentMethod)) next.paymentMethod = paymentMethod;
  return next;
}

export function isMarketplaceProfileComplete(profile: AsymptaMarketplaceProfile | null) {
  return Boolean(profile?.foodPreference && profile.fulfilmentMethod && profile.paymentMethod);
}

export function marketplaceProfileSourceRef(profile: AsymptaMarketplaceProfile) {
  return `approved-profile:${profile.presetId}:${profile.updatedAt}`;
}

export function marketplaceFoodPreferenceItem(preference: MarketplaceFoodPreference) {
  const labels: Record<MarketplaceFoodPreference, string> = {
    no_preference: "ready-to-eat meal",
    local_cantonese: "Cantonese comfort meal",
    japanese: "Japanese meal",
    western_comfort: "Western comfort meal",
    vegetarian: "vegetarian meal",
  };
  return labels[preference];
}
