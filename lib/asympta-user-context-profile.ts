import type {
  AsymptaJsonValue,
  AsymptaTaskFact,
} from "./asympta-task-protocol.ts";

export type AsymptaUserContextFactStatus = "approved" | "inferred";
export type AsymptaUserContextSensitivity = "normal" | "sensitive";

export type AsymptaUserContextFact = {
  id: string;
  domain: string;
  key: string;
  value: AsymptaJsonValue;
  status: AsymptaUserContextFactStatus;
  source: {
    type: "user_confirmation" | "approved_user_profile" | "agent_inference";
    ref: string;
  };
  confidence: number;
  sensitivity: AsymptaUserContextSensitivity;
  updatedAt: string;
  expiresAt?: string;
};

export type AsymptaUserContextProfile = {
  schemaVersion: "asympta.user-context.v1";
  facts: AsymptaUserContextFact[];
  updatedAt: string;
};

export type UpsertAsymptaUserContextFactInput = {
  domain: string;
  key: string;
  value: AsymptaJsonValue;
  status?: AsymptaUserContextFactStatus;
  source?: AsymptaUserContextFact["source"];
  confidence?: number;
  sensitivity?: AsymptaUserContextSensitivity;
  expiresAt?: string;
};

const BLOCKED_SECRET_KEY = /(?:card[_-]?number|cvv|cvc|pin|password|passcode|payment[_-]?token|bank[_-]?credential|private[_-]?key|full[_-]?address|street[_-]?address)/i;

function normalizedDate(value: number | string | Date | undefined) {
  const date = value instanceof Date ? value : new Date(value ?? Date.now());
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date(0).toISOString();
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function isJsonValue(value: unknown): value is AsymptaJsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (!value || typeof value !== "object") return false;
  return Object.values(value as Record<string, unknown>).every(isJsonValue);
}

function isExpired(fact: AsymptaUserContextFact, now = Date.now()) {
  if (!fact.expiresAt) return false;
  const expiresAt = new Date(fact.expiresAt).getTime();
  return Number.isFinite(expiresAt) && expiresAt <= now;
}

function normalizedFact(value: unknown): AsymptaUserContextFact | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<AsymptaUserContextFact>;
  const domain = typeof candidate.domain === "string" ? candidate.domain.trim() : "";
  const key = typeof candidate.key === "string" ? candidate.key.trim() : "";
  if (!domain || !key || BLOCKED_SECRET_KEY.test(key) || !isJsonValue(candidate.value)) return null;
  const status: AsymptaUserContextFactStatus = candidate.status === "inferred" ? "inferred" : "approved";
  const updatedAt = normalizedDate(candidate.updatedAt);
  const sourceType = candidate.source?.type;
  const source: AsymptaUserContextFact["source"] = {
    type: sourceType === "agent_inference"
      ? "agent_inference"
      : sourceType === "approved_user_profile"
        ? "approved_user_profile"
        : "user_confirmation",
    ref: typeof candidate.source?.ref === "string" && candidate.source.ref.trim()
      ? candidate.source.ref.trim()
      : `profile:${domain}:${key}`,
  };
  const expiresAt = typeof candidate.expiresAt === "string" && Number.isFinite(new Date(candidate.expiresAt).getTime())
    ? new Date(candidate.expiresAt).toISOString()
    : undefined;
  return {
    id: typeof candidate.id === "string" && candidate.id.trim()
      ? candidate.id.trim()
      : `profile-fact-${stableHash(`${domain}:${key}:${updatedAt}`)}`,
    domain,
    key,
    value: candidate.value,
    status,
    source,
    confidence: Math.max(0, Math.min(1, Number(candidate.confidence ?? (status === "approved" ? 1 : 0.5)))),
    sensitivity: candidate.sensitivity === "sensitive" ? "sensitive" : "normal",
    updatedAt,
    ...(expiresAt ? { expiresAt } : {}),
  };
}

export function emptyAsymptaUserContextProfile(now: number | string | Date = Date.now()): AsymptaUserContextProfile {
  return {
    schemaVersion: "asympta.user-context.v1",
    facts: [],
    updatedAt: normalizedDate(now),
  };
}

export function normalizeAsymptaUserContextProfile(
  value: unknown,
  now: number | string | Date = Date.now(),
): AsymptaUserContextProfile {
  if (!value || typeof value !== "object") return emptyAsymptaUserContextProfile(now);
  const candidate = value as Partial<AsymptaUserContextProfile>;
  const facts = (Array.isArray(candidate.facts) ? candidate.facts : [])
    .map(normalizedFact)
    .filter((fact): fact is AsymptaUserContextFact => Boolean(fact));
  const deduplicated = new Map<string, AsymptaUserContextFact>();
  for (const fact of facts) {
    const key = `${fact.domain}:${fact.key}`;
    const current = deduplicated.get(key);
    if (!current || new Date(fact.updatedAt).getTime() >= new Date(current.updatedAt).getTime()) deduplicated.set(key, fact);
  }
  return {
    schemaVersion: "asympta.user-context.v1",
    facts: [...deduplicated.values()],
    updatedAt: normalizedDate(candidate.updatedAt ?? now),
  };
}

export function upsertAsymptaUserContextFact(
  profile: AsymptaUserContextProfile | null,
  input: UpsertAsymptaUserContextFactInput,
  now: number | string | Date = Date.now(),
) {
  const current = normalizeAsymptaUserContextProfile(profile, now);
  const domain = input.domain.trim();
  const key = input.key.trim();
  if (!domain || !key) throw new Error("A user-context fact requires a domain and key.");
  if (BLOCKED_SECRET_KEY.test(key)) throw new Error(`Sensitive secret field is not allowed in the Asympta profile: ${key}.`);
  if (!isJsonValue(input.value)) throw new Error("A user-context fact must contain a JSON-compatible value.");
  const updatedAt = normalizedDate(now);
  const status = input.status ?? "approved";
  const nextFact: AsymptaUserContextFact = {
    id: `profile-fact-${stableHash(`${domain}:${key}`)}`,
    domain,
    key,
    value: input.value,
    status,
    source: input.source ?? {
      type: status === "inferred" ? "agent_inference" : "user_confirmation",
      ref: `profile:${domain}:${key}`,
    },
    confidence: Math.max(0, Math.min(1, Number(input.confidence ?? (status === "approved" ? 1 : 0.5)))),
    sensitivity: input.sensitivity ?? "normal",
    updatedAt,
    ...(input.expiresAt ? { expiresAt: normalizedDate(input.expiresAt) } : {}),
  };
  const facts = current.facts.filter((fact) => !(fact.domain === domain && fact.key === key));
  facts.push(nextFact);
  return {
    schemaVersion: "asympta.user-context.v1" as const,
    facts,
    updatedAt,
  };
}

export function removeAsymptaUserContextFact(
  profile: AsymptaUserContextProfile | null,
  domain: string,
  key: string,
  now: number | string | Date = Date.now(),
) {
  const current = normalizeAsymptaUserContextProfile(profile, now);
  return {
    ...current,
    facts: current.facts.filter((fact) => !(fact.domain === domain && fact.key === key)),
    updatedAt: normalizedDate(now),
  };
}

export function selectAsymptaUserContextFacts(
  profile: AsymptaUserContextProfile | null,
  input: {
    domains?: string[];
    keys?: string[];
    includeSensitive?: boolean;
    includeInferred?: boolean;
    now?: number | string | Date;
  } = {},
) {
  const nowValue = new Date(input.now ?? Date.now()).getTime();
  const normalized = normalizeAsymptaUserContextProfile(profile, nowValue);
  const domains = input.domains ? new Set(input.domains) : null;
  const keys = input.keys ? new Set(input.keys) : null;
  return normalized.facts.filter((fact) => (
    !isExpired(fact, nowValue)
    && (!domains || domains.has(fact.domain))
    && (!keys || keys.has(fact.key))
    && (input.includeSensitive || fact.sensitivity !== "sensitive")
    && (input.includeInferred || fact.status !== "inferred")
  ));
}

export function userContextProfileAsTaskFacts(
  profile: AsymptaUserContextProfile | null,
  input: Parameters<typeof selectAsymptaUserContextFacts>[1] = {},
): AsymptaTaskFact[] {
  return selectAsymptaUserContextFacts(profile, input).map((fact) => ({
    key: fact.key,
    value: fact.value,
    status: fact.status === "approved" ? "profile" : "inferred",
    source: {
      type: fact.status === "approved" ? "approved_user_profile" : "agent_inference",
      ref: fact.source.ref,
    },
    confidence: fact.confidence,
    scope: "long_term",
    domain: fact.domain,
    sensitive: fact.sensitivity === "sensitive",
    updatedAt: fact.updatedAt,
    ...(fact.expiresAt ? { expiresAt: fact.expiresAt } : {}),
  }));
}

export function validateAsymptaUserContextProfile(profile: AsymptaUserContextProfile) {
  const issues: string[] = [];
  if (profile.schemaVersion !== "asympta.user-context.v1") issues.push("Unsupported user-context profile version.");
  const seen = new Set<string>();
  for (const fact of profile.facts) {
    const id = `${fact.domain}:${fact.key}`;
    if (seen.has(id)) issues.push(`Duplicate user-context fact: ${id}.`);
    seen.add(id);
    if (BLOCKED_SECRET_KEY.test(fact.key)) issues.push(`Secret-like field is prohibited: ${fact.key}.`);
    if (!isJsonValue(fact.value)) issues.push(`Non-JSON value in user-context fact: ${id}.`);
    if (fact.confidence < 0 || fact.confidence > 1) issues.push(`Invalid confidence in user-context fact: ${id}.`);
  }
  return { valid: issues.length === 0, issues };
}
