import {
  normalizeMarketplaceProfile,
  type AsymptaMarketplaceProfile,
} from "./asympta-marketplace-profile.ts";
import {
  marketplaceProfileFromUserContext,
  mergeMarketplaceProfileIntoUserContext,
  removeMarketplaceFactsFromUserContext,
} from "./asympta-marketplace-user-context.ts";
import {
  emptyAsymptaUserContextProfile,
  normalizeAsymptaUserContextProfile,
  upsertAsymptaUserContextFact,
  type AsymptaUserContextProfile,
  type UpsertAsymptaUserContextFactInput,
} from "./asympta-user-context-profile.ts";

export type AsymptaLocale = "en" | "zh-Hant" | "ja";

export type AsymptaUserPreferences = {
  locale: AsymptaLocale;
  autoExplore: boolean;
  autoJobMode: boolean;
  marketplaceProfile: AsymptaMarketplaceProfile | null;
  contextProfile: AsymptaUserContextProfile;
};

export const ASYMPTA_USER_PREFERENCES_KEY = "asympta-world.user-preferences.v1";
export const ASYMPTA_USER_PREFERENCES_EVENT = "asympta-world:user-preferences";

export const DEFAULT_ASYMPTA_USER_PREFERENCES: AsymptaUserPreferences = {
  locale: "en",
  autoExplore: true,
  autoJobMode: true,
  marketplaceProfile: null,
  contextProfile: emptyAsymptaUserContextProfile(0),
};

function isLocale(value: unknown): value is AsymptaLocale {
  return value === "en" || value === "zh-Hant" || value === "ja";
}

function normalizePreferences(value: unknown): AsymptaUserPreferences {
  if (!value || typeof value !== "object") return {
    ...DEFAULT_ASYMPTA_USER_PREFERENCES,
    contextProfile: normalizeAsymptaUserContextProfile(DEFAULT_ASYMPTA_USER_PREFERENCES.contextProfile),
  };
  const candidate = value as Partial<AsymptaUserPreferences>;
  const storedMarketplace = normalizeMarketplaceProfile(candidate.marketplaceProfile);
  let contextProfile = normalizeAsymptaUserContextProfile(candidate.contextProfile);
  const contextMarketplace = marketplaceProfileFromUserContext(contextProfile);

  // `asympta.user-context.v1` is the durable source of truth. The older
  // marketplace object is imported only when a legacy record has no matching
  // context facts yet, so later app-wide profile edits cannot be overwritten.
  if (!contextMarketplace && storedMarketplace) {
    contextProfile = mergeMarketplaceProfileIntoUserContext(contextProfile, storedMarketplace);
  }
  const marketplaceProfile = contextMarketplace
    ?? storedMarketplace
    ?? marketplaceProfileFromUserContext(contextProfile);

  return {
    locale: isLocale(candidate.locale) ? candidate.locale : DEFAULT_ASYMPTA_USER_PREFERENCES.locale,
    autoExplore: typeof candidate.autoExplore === "boolean" ? candidate.autoExplore : DEFAULT_ASYMPTA_USER_PREFERENCES.autoExplore,
    autoJobMode: typeof candidate.autoJobMode === "boolean" ? candidate.autoJobMode : DEFAULT_ASYMPTA_USER_PREFERENCES.autoJobMode,
    marketplaceProfile,
    contextProfile,
  };
}

function browserStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function hasStoredAsymptaUserPreferences() {
  const storage = browserStorage();
  if (!storage) return false;
  try {
    return storage.getItem(ASYMPTA_USER_PREFERENCES_KEY) !== null;
  } catch {
    return false;
  }
}

export function readAsymptaUserPreferences(): AsymptaUserPreferences {
  const storage = browserStorage();
  if (!storage) return normalizePreferences(DEFAULT_ASYMPTA_USER_PREFERENCES);
  try {
    const raw = storage.getItem(ASYMPTA_USER_PREFERENCES_KEY);
    if (!raw) return normalizePreferences(DEFAULT_ASYMPTA_USER_PREFERENCES);
    return normalizePreferences(JSON.parse(raw));
  } catch {
    return normalizePreferences(DEFAULT_ASYMPTA_USER_PREFERENCES);
  }
}

export function writeAsymptaUserPreferences(
  patch: Partial<AsymptaUserPreferences>,
): AsymptaUserPreferences {
  const next = normalizePreferences({ ...readAsymptaUserPreferences(), ...patch });
  const storage = browserStorage();
  if (storage) {
    try {
      storage.setItem(ASYMPTA_USER_PREFERENCES_KEY, JSON.stringify(next));
    } catch {
      // Keep the current session working even when storage is unavailable.
    }
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<AsymptaUserPreferences>(ASYMPTA_USER_PREFERENCES_EVENT, { detail: next }),
    );
  }
  return next;
}

export function readAsymptaUserContextProfile() {
  return readAsymptaUserPreferences().contextProfile;
}

export function writeAsymptaUserContextProfile(profile: AsymptaUserContextProfile) {
  return writeAsymptaUserPreferences({ contextProfile: normalizeAsymptaUserContextProfile(profile) }).contextProfile;
}

export function rememberAsymptaUserContextFact(
  input: UpsertAsymptaUserContextFactInput,
  now: number | string | Date = Date.now(),
) {
  const preferences = readAsymptaUserPreferences();
  const contextProfile = upsertAsymptaUserContextFact(preferences.contextProfile, input, now);
  return writeAsymptaUserPreferences({ contextProfile }).contextProfile;
}

export function readAsymptaMarketplaceProfile() {
  const preferences = readAsymptaUserPreferences();
  return marketplaceProfileFromUserContext(preferences.contextProfile) ?? preferences.marketplaceProfile;
}

export function writeAsymptaMarketplaceProfile(profile: AsymptaMarketplaceProfile | null) {
  const preferences = readAsymptaUserPreferences();
  const marketplaceProfile = normalizeMarketplaceProfile(profile);
  const contextProfile = marketplaceProfile
    ? mergeMarketplaceProfileIntoUserContext(preferences.contextProfile, marketplaceProfile)
    : removeMarketplaceFactsFromUserContext(preferences.contextProfile);
  return writeAsymptaUserPreferences({ marketplaceProfile, contextProfile }).marketplaceProfile;
}

export function clearAsymptaMarketplaceProfile() {
  const preferences = readAsymptaUserPreferences();
  const contextProfile = removeMarketplaceFactsFromUserContext(preferences.contextProfile);
  return writeAsymptaUserPreferences({ marketplaceProfile: null, contextProfile }).marketplaceProfile;
}

export function subscribeAsymptaUserPreferences(
  listener: (preferences: AsymptaUserPreferences) => void,
) {
  if (typeof window === "undefined") return () => undefined;

  const onPreferenceChange = (event: Event) => {
    const detail = (event as CustomEvent<AsymptaUserPreferences>).detail;
    listener(detail ? normalizePreferences(detail) : readAsymptaUserPreferences());
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key !== ASYMPTA_USER_PREFERENCES_KEY) return;
    listener(readAsymptaUserPreferences());
  };

  window.addEventListener(ASYMPTA_USER_PREFERENCES_EVENT, onPreferenceChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(ASYMPTA_USER_PREFERENCES_EVENT, onPreferenceChange);
    window.removeEventListener("storage", onStorage);
  };
}
