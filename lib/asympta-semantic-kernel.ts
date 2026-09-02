import type { AsymptaCanonicalFact, AsymptaDataClass, AsymptaTaskAnswerValue, AsymptaTaskRequirement } from "./asympta-task-kernel-types.ts";
import {
  canonicalFactsFromRequirements as canonicalFactsFromRequirementsV2,
  resolveExplicitRequirementValue as resolveExplicitRequirementValueV2,
  upsertCanonicalFact as upsertCanonicalFactV2,
} from "./asympta-semantic-kernel-v2.ts";
export { canonicalizeRequirementSemantic, classifyDataClass, dataClassIsSensitive } from "./asympta-semantic-kernel-v3-canonical.ts";
export { classifyTaskEffect } from "./asympta-semantic-kernel-v3-effect.ts";
import { canonicalizeRequirementSemantic } from "./asympta-semantic-kernel-v3-canonical.ts";
import { FACT_NEGATION_PATTERN, UNCERTAINTY_PATTERN, relevantClauses } from "./asympta-semantic-kernel-v3-fact-common.ts";
import type { EnhancedResolution } from "./asympta-semantic-kernel-v3-fact-common.ts";
import { resolveDate, resolveTime } from "./asympta-semantic-kernel-v3-temporal.ts";
import { resolveBudget, resolveContact, resolveCurrency, resolveParticipants, resolveTextSemantic } from "./asympta-semantic-kernel-v3-values.ts";

function enhancedResolution(intent: string, semantic: string): EnhancedResolution {
  const clauses = relevantClauses(intent, semantic);
  if (clauses.some(({ text }) => UNCERTAINTY_PATTERN.test(text) || FACT_NEGATION_PATTERN.test(text))) return { handled: true, result: null };
  if (semantic === "date") return resolveDate(intent);
  if (semantic === "time") return resolveTime(intent);
  if (semantic === "budget") return resolveBudget(intent);
  if (semantic === "participants") return resolveParticipants(intent);
  if (semantic === "contact") return resolveContact(intent);
  if (semantic === "currency") return resolveCurrency(intent);
  if (["recipient", "origin", "destination", "deadline", "service"].includes(semantic)) return resolveTextSemantic(intent, semantic);
  return { handled: false, result: null };
}

export function resolveExplicitRequirementValue(intent: string, key: string): { value: AsymptaTaskAnswerValue; label: string } | null {
  const semantic = canonicalizeRequirementSemantic(key);
  const enhanced = enhancedResolution(intent.trim(), semantic);
  if (enhanced.handled) return enhanced.result;
  return resolveExplicitRequirementValueV2(intent, semantic);
}

export function canonicalFactsFromRequirements(requirements: AsymptaTaskRequirement[], at: string): AsymptaCanonicalFact[] {
  return canonicalFactsFromRequirementsV2(requirements, at);
}

export function upsertCanonicalFact(facts: AsymptaCanonicalFact[], requirement: AsymptaTaskRequirement, at: string) {
  return upsertCanonicalFactV2(facts, requirement, at);
}
