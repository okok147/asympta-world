export type AdaptiveActivityIntentValue =
  | string
  | {
      raw?: unknown;
      locale?: unknown;
    };

export type AdaptiveActivityLike = {
  intent?: AdaptiveActivityIntentValue;
};

/**
 * Reads the durable human intention from either the canonical Asympta IR
 * (`activity.intent.raw`) or the former browser-test shorthand (`intent`).
 * Unknown shapes fail closed instead of throwing inside an activity listener.
 */
export function readAdaptiveActivityIntent(activity: unknown): string {
  if (!activity || typeof activity !== "object" || Array.isArray(activity)) return "";

  const intent = Reflect.get(activity, "intent");
  if (typeof intent === "string") return intent.trim();
  if (!intent || typeof intent !== "object" || Array.isArray(intent)) return "";

  const raw = Reflect.get(intent, "raw");
  return typeof raw === "string" ? raw.trim() : "";
}
