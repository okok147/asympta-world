import {
  normalizeMarketplaceProfile,
  type AsymptaMarketplaceProfile,
} from "./asympta-marketplace-profile.ts";

export type AsymptaLocale = "en" | "zh-Hant" | "ja";

export type AsymptaUserPreferences = {
  locale: AsymptaLocale;
  autoExplore: boolean;
  autoJobMode: boolean;
  marketplaceProfile: AsymptaMarketplaceProfile | null;
};

export const ASYMPTA_USER_PREFERENCES_KEY = "asympta-world.user-preferences.v1";
export const ASYMPTA_USER_PREFERENCES_EVENT = "asympta-world:user-preferences";

export const DEFAULT_ASYMPTA_USER_PREFERENCES: AsymptaUserPreferences = {
  locale: "en",
  autoExplore: true,
  autoJobMode: true,
  marketplaceProfile: null,
};

function isLocale(value: unknown): value is AsymptaLocale {
  return value === "en" || value === "zh-Hant" || value === "ja";
}

function normalizePreferences(value: unknown): AsymptaUserPreferences {
  if (!value || typeof value !== "object") return { ...DEFAULT_ASYMPTA_USER_PREFERENCES };
  const candidate = value as Partial<AsymptaUserPreferences>;
  return {
    locale: isLocale(candidate.locale) ? candidate.locale : DEFAULT_ASYMPTA_USER_PREFERENCES.locale,
    autoExplore: typeof candidate.autoExplore === "boolean" ? candidate.autoExplore : DEFAULT_ASYMPTA_USER_PREFERENCES.autoExplore,
    autoJobMode: typeof candidate.autoJobMode === "boolean" ? candidate.autoJobMode : DEFAULT_ASYMPTA_USER_PREFERENCES.autoJobMode,
    marketplaceProfile: normalizeMarketplaceProfile(candidate.marketplaceProfile),
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
  if (!storage) return { ...DEFAULT_ASYMPTA_USER_PREFERENCES };
  try {
    const raw = storage.getItem(ASYMPTA_USER_PREFERENCES_KEY);
    if (!raw) return { ...DEFAULT_ASYMPTA_USER_PREFERENCES };
    return normalizePreferences(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_ASYMPTA_USER_PREFERENCES };
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

export function readAsymptaMarketplaceProfile() {
  return readAsymptaUserPreferences().marketplaceProfile;
}

export function writeAsymptaMarketplaceProfile(profile: AsymptaMarketplaceProfile | null) {
  return writeAsymptaUserPreferences({ marketplaceProfile: normalizeMarketplaceProfile(profile) }).marketplaceProfile;
}

export function clearAsymptaMarketplaceProfile() {
  return writeAsymptaUserPreferences({ marketplaceProfile: null }).marketplaceProfile;
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
