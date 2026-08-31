"use client";

import { useEffect } from "react";

/**
 * Canonical browser activity events carry `activity.intent` as Asympta IR:
 * `{ raw, locale }`. A few older listeners still call `.trim()` on that value.
 *
 * Keep the canonical object intact while exposing a non-enumerable compatibility
 * method during event dispatch. JSON persistence and protocol payloads therefore
 * remain unchanged, and legacy listeners cannot crash the whole event fan-out.
 * New code should read `activity.intent.raw` through readAdaptiveActivityIntent.
 */
function installIntentCompatibility(detail: unknown) {
  if (!detail || typeof detail !== "object" || Array.isArray(detail)) return;
  const activity = Reflect.get(detail, "activity");
  if (!activity || typeof activity !== "object" || Array.isArray(activity)) return;
  const intent = Reflect.get(activity, "intent");
  if (!intent || typeof intent !== "object" || Array.isArray(intent)) return;
  const raw = Reflect.get(intent, "raw");
  if (typeof raw !== "string" || typeof Reflect.get(intent, "trim") === "function") return;

  try {
    Object.defineProperty(intent, "trim", {
      configurable: true,
      enumerable: false,
      value: () => raw.trim(),
      writable: false,
    });
  } catch {
    // Frozen or foreign activity payloads fail closed; canonical listeners still
    // use readAdaptiveActivityIntent and remain safe.
  }
}

export function AsymptaActivityEventContract() {
  useEffect(() => {
    const normalize = (event: Event) => {
      installIntentCompatibility((event as CustomEvent<unknown>).detail);
    };

    window.addEventListener("asympta:activity", normalize, { capture: true });
    return () => window.removeEventListener("asympta:activity", normalize, { capture: true });
  }, []);

  return null;
}
