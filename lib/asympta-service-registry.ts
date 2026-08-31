import {
  ATLAS_AGENTS,
  ATLAS_LOCATIONS,
  ATLAS_WORKFLOWS,
  type AtlasTaskBlueprint,
  type AtlasWorkflowDefinition,
  type ExternalAction,
  type WorkflowId,
} from "./atlas-simulation.ts";
import {
  assertAsymptaTaskReady,
  createAsymptaTaskIntent,
  type AsymptaActionPermission,
  type AsymptaJsonValue,
  type AsymptaLocalizedText,
  type AsymptaSuccessCriterion,
  type AsymptaTaskFact,
  type AsymptaTaskIntent,
  type AsymptaTaskQuestionOption,
  type AsymptaTaskRequirement,
  type AsymptaTaskStage,
} from "./asympta-task-protocol.ts";
import {
  userContextProfileAsTaskFacts,
  type AsymptaUserContextProfile,
} from "./asympta-user-context-profile.ts";

export const ASYMPTA_SERVICE_REGISTRY_EVENT = "asympta:service-registry-changed" as const;
export const ASYMPTA_SERVICE_WORKFLOW_ID = "asympta-service-runtime" as WorkflowId;

export type AsymptaServiceAdapter = "atlas_simulation";
export type AsymptaServiceManifestProvenance = "bundled_simulated" | "runtime_simulated";

export type AsymptaServiceItemType = {
  id: string;
  domain: string;
  canonicalItem: string;
  labels: AsymptaLocalizedText;
  phrases: string[];
  marketLocationId: string;
};

export type AsymptaServiceRequirementDefinition = {
  id: string;
  capability?: string;
  field: string;
  stage: AsymptaTaskStage;
  blocking: boolean;
  priority: number;
  userEffort: number;
  description: AsymptaLocalizedText;
  appliesToItemTypes?: string[];
  acceptedValues?: AsymptaJsonValue[];
  question?: {
    prompt: AsymptaLocalizedText;
    answerType: "single_choice" | "text" | "number" | "boolean";
    options?: AsymptaTaskQuestionOption[];
    allowSkip?: boolean;
    skipValue?: AsymptaJsonValue;
    remember?: "offer" | "never" | "always";
    sensitive?: boolean;
  };
  valueMatchers?: Array<{
    value: AsymptaJsonValue;
    phrases: string[];
  }>;
};

export type AsymptaServiceWorkflowTaskTemplate = {
  id: string;
  title: AsymptaLocalizedText;
  detail: AsymptaLocalizedText;
  agentId: string;
  locationId: string | "$market" | "$home";
  dependsOn: string[];
  workMs: number;
  requiresApproval?: boolean;
  approvalLabel?: AsymptaLocalizedText;
  actionType?: ExternalAction;
};

export type AsymptaServiceManifest = {
  schemaVersion: "asympta.service-manifest.v1";
  serviceId: string;
  version: string;
  enabled: boolean;
  adapter: AsymptaServiceAdapter;
  provenance: AsymptaServiceManifestProvenance;
  updatedAt: string;
  labels: AsymptaLocalizedText;
  action: {
    id: string;
    phrases: string[];
  };
  itemTypes: AsymptaServiceItemType[];
  excludePhrases?: string[];
  requirements: AsymptaServiceRequirementDefinition[];
  permissions?: AsymptaActionPermission[];
  successCriteria?: AsymptaSuccessCriterion[];
  workflow: {
    name: AsymptaLocalizedText;
    shortName: AsymptaLocalizedText;
    summary: AsymptaLocalizedText;
    outcome: AsymptaLocalizedText;
    tasks: AsymptaServiceWorkflowTaskTemplate[];
  };
};

export type AsymptaServiceIntentMatch = {
  manifest: AsymptaServiceManifest;
  action: string;
  actionEvidence: string;
  itemType: AsymptaServiceItemType;
  itemEvidence: string;
  quantity: number;
  quantityEvidence: string | null;
};

export type AsymptaServiceTaskBundle = {
  match: AsymptaServiceIntentMatch;
  task: AsymptaTaskIntent;
};

type RegistryListener = (manifests: AsymptaServiceManifest[]) => void;

const SERVICE_ID = /^[a-z0-9][a-z0-9._-]{2,80}$/;
const VERSION = /^[0-9A-Za-z][0-9A-Za-z._+-]{0,40}$/;
const FIELD = /^[a-z][a-z0-9_]{1,80}$/;
const AGENT_IDS = new Set(ATLAS_AGENTS.map((agent) => agent.id));
const LOCATION_IDS = new Set(Object.keys(ATLAS_LOCATIONS));
const EXTERNAL_ACTIONS = new Set<ExternalAction>([
  "reserve_capacity",
  "authorize_payment",
  "release_shipment",
  "send_customer_update",
]);
const registry = new Map<string, AsymptaServiceManifest>();
const listeners = new Set<RegistryListener>();

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isoDate(value: string | number | Date | undefined) {
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

function normalizedText(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, " ").trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function phraseEvidence(text: string, phrase: string) {
  const cleanPhrase = normalizedText(phrase);
  if (!cleanPhrase) return null;
  const latin = /[a-z0-9]/i.test(cleanPhrase);
  const pattern = latin
    ? new RegExp(`(?:^|[^a-z0-9])(${escapeRegExp(cleanPhrase)})(?=$|[^a-z0-9])`, "iu")
    : new RegExp(`(${escapeRegExp(cleanPhrase)})`, "u");
  const match = pattern.exec(normalizedText(text));
  return match ? { evidence: match[1], index: match.index + match[0].indexOf(match[1]) } : null;
}

function longestPhraseMatch(text: string, phrases: string[]) {
  let best: { evidence: string; index: number; phrase: string } | null = null;
  for (const phrase of phrases) {
    const match = phraseEvidence(text, phrase);
    if (!match) continue;
    if (!best || phrase.length > best.phrase.length || (phrase.length === best.phrase.length && match.index < best.index)) {
      best = { ...match, phrase };
    }
  }
  return best;
}

function localized(value: AsymptaLocalizedText, locale = "en") {
  if (locale.startsWith("zh") && value["zh-Hant"]) return value["zh-Hant"];
  if (locale.startsWith("ja") && value.ja) return value.ja;
  return value.en;
}

function isJsonValue(value: unknown): value is AsymptaJsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (!value || typeof value !== "object") return false;
  return Object.values(value as Record<string, unknown>).every(isJsonValue);
}

function quantityNearItem(text: string, itemEvidence: string) {
  const normalized = normalizedText(text);
  const itemIndex = normalized.indexOf(normalizedText(itemEvidence));
  const prefix = normalized.slice(Math.max(0, itemIndex - 24), Math.max(0, itemIndex));
  const latin = /(?:^|\s)(a|an|one|two|three|four|five|\d{1,2})\s*$/i.exec(prefix);
  const latinValues: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5 };
  if (latin) {
    const token = latin[1].toLocaleLowerCase();
    const value = /^\d+$/.test(token) ? Number(token) : latinValues[token];
    if (Number.isFinite(value)) return { value: Math.max(1, value), evidence: `${latin[1]} ${itemEvidence}` };
  }
  const cjk = /([一二兩两三四五壹貳參参\d]{1,2})\s*(?:個|个|件|部|台|份|盒|包)?\s*$/u.exec(prefix);
  const cjkValues: Record<string, number> = { 一: 1, 壹: 1, 二: 2, 兩: 2, 两: 2, 貳: 2, 三: 3, 參: 3, 参: 3, 四: 4, 五: 5 };
  if (cjk) {
    const value = /^\d+$/.test(cjk[1]) ? Number(cjk[1]) : cjkValues[cjk[1]];
    if (Number.isFinite(value)) return { value: Math.max(1, value), evidence: `${cjk[0].trim()}${itemEvidence}` };
  }
  return { value: 1, evidence: null };
}

function explicitFact(
  key: string,
  value: AsymptaJsonValue,
  requestId: string,
  evidence: string,
  domain: string,
): AsymptaTaskFact {
  return {
    key,
    value,
    status: "explicit",
    source: { type: "user_message", ref: requestId, evidence },
    confidence: 1,
    scope: "task",
    domain,
    updatedAt: new Date().toISOString(),
  };
}

function defaultFact(key: string, value: AsymptaJsonValue, domain: string): AsymptaTaskFact {
  return {
    key,
    value,
    status: "defaulted",
    source: { type: "system_default", ref: "system:service-registry/v1" },
    confidence: 1,
    scope: "task",
    domain,
    updatedAt: new Date().toISOString(),
  };
}

function materializeRequirement(
  manifest: AsymptaServiceManifest,
  itemType: AsymptaServiceItemType,
  definition: AsymptaServiceRequirementDefinition,
  taskId: string,
): AsymptaTaskRequirement | null {
  if (definition.appliesToItemTypes?.length && !definition.appliesToItemTypes.includes(itemType.id)) return null;
  return {
    id: `${taskId}:service:${definition.id}`,
    capability: definition.capability ?? `${manifest.serviceId}.${manifest.action.id}`,
    field: definition.field,
    stage: definition.stage,
    blocking: definition.blocking,
    priority: definition.priority,
    userEffort: definition.userEffort,
    description: definition.description,
    ...(definition.acceptedValues?.length ? { acceptedValues: definition.acceptedValues } : {}),
    ...(definition.question ? { question: definition.question } : {}),
  };
}

function extractedRequirementFacts(
  text: string,
  match: AsymptaServiceIntentMatch,
  requestId: string,
) {
  const facts: AsymptaTaskFact[] = [];
  for (const requirement of match.manifest.requirements) {
    if (requirement.appliesToItemTypes?.length && !requirement.appliesToItemTypes.includes(match.itemType.id)) continue;
    let best: { value: AsymptaJsonValue; evidence: string; phraseLength: number } | null = null;
    for (const candidate of requirement.valueMatchers ?? []) {
      const found = longestPhraseMatch(text, candidate.phrases);
      if (!found) continue;
      if (!best || found.phrase.length > best.phraseLength) {
        best = { value: candidate.value, evidence: found.evidence, phraseLength: found.phrase.length };
      }
    }
    if (best) facts.push(explicitFact(requirement.field, best.value, requestId, best.evidence, match.itemType.domain));
  }
  return facts;
}

function renderTemplate(value: AsymptaLocalizedText, locale: string, facts: Map<string, AsymptaJsonValue>) {
  return localized(value, locale).replace(/\{\{([a-z0-9_]+)\}\}/gi, (_, key: string) => {
    const fact = facts.get(key);
    return fact === undefined || fact === null ? key.replaceAll("_", " ") : String(fact);
  });
}

function notifyRegistry() {
  const snapshot = listAsymptaServiceManifests();
  for (const listener of listeners) listener(snapshot);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(ASYMPTA_SERVICE_REGISTRY_EVENT, { detail: snapshot }));
  }
}

export function validateAsymptaServiceManifest(manifest: AsymptaServiceManifest) {
  const issues: string[] = [];
  if (manifest.schemaVersion !== "asympta.service-manifest.v1") issues.push("Unsupported service manifest version.");
  if (!SERVICE_ID.test(manifest.serviceId)) issues.push("Invalid service id.");
  if (!VERSION.test(manifest.version)) issues.push("Invalid service version.");
  if (manifest.adapter !== "atlas_simulation") issues.push("Only the bounded Atlas simulation adapter is available.");
  if (!manifest.action.id.trim() || !manifest.action.phrases.length) issues.push("A service action and action phrases are required.");
  if (!manifest.itemTypes.length) issues.push("At least one item type is required.");
  const itemIds = new Set<string>();
  for (const item of manifest.itemTypes) {
    if (!SERVICE_ID.test(item.id)) issues.push(`Invalid item type id: ${item.id}.`);
    if (itemIds.has(item.id)) issues.push(`Duplicate item type: ${item.id}.`);
    itemIds.add(item.id);
    if (!item.domain.trim() || !item.canonicalItem.trim() || !item.phrases.length) issues.push(`Incomplete item type: ${item.id}.`);
    if (!LOCATION_IDS.has(item.marketLocationId)) issues.push(`Unknown market location: ${item.marketLocationId}.`);
  }
  const requirementIds = new Set<string>();
  for (const requirement of manifest.requirements) {
    if (!SERVICE_ID.test(requirement.id)) issues.push(`Invalid requirement id: ${requirement.id}.`);
    if (requirementIds.has(requirement.id)) issues.push(`Duplicate requirement: ${requirement.id}.`);
    requirementIds.add(requirement.id);
    if (!FIELD.test(requirement.field)) issues.push(`Invalid requirement field: ${requirement.field}.`);
    if (requirement.acceptedValues?.some((value) => !isJsonValue(value))) issues.push(`Non-JSON accepted value: ${requirement.id}.`);
    for (const matcher of requirement.valueMatchers ?? []) {
      if (!isJsonValue(matcher.value) || !matcher.phrases.length) issues.push(`Invalid value matcher: ${requirement.id}.`);
    }
  }
  const taskIds = new Set<string>();
  for (const task of manifest.workflow.tasks) {
    if (!SERVICE_ID.test(task.id)) issues.push(`Invalid workflow task id: ${task.id}.`);
    if (taskIds.has(task.id)) issues.push(`Duplicate workflow task: ${task.id}.`);
    taskIds.add(task.id);
    if (!AGENT_IDS.has(task.agentId)) issues.push(`Unknown workflow agent: ${task.agentId}.`);
    if (task.locationId !== "$market" && task.locationId !== "$home" && !LOCATION_IDS.has(task.locationId)) {
      issues.push(`Unknown workflow location: ${task.locationId}.`);
    }
    if (!Number.isFinite(task.workMs) || task.workMs < 120 || task.workMs > 60_000) issues.push(`Invalid work duration: ${task.id}.`);
    if (task.actionType && !EXTERNAL_ACTIONS.has(task.actionType)) issues.push(`Unsupported action type: ${task.actionType}.`);
  }
  for (const task of manifest.workflow.tasks) {
    for (const dependency of task.dependsOn) {
      if (!taskIds.has(dependency)) issues.push(`Unknown dependency ${dependency} in ${task.id}.`);
    }
  }
  return { valid: issues.length === 0, issues };
}

export function upsertAsymptaServiceManifest(manifest: AsymptaServiceManifest) {
  const normalized: AsymptaServiceManifest = {
    ...clone(manifest),
    serviceId: manifest.serviceId.trim(),
    version: manifest.version.trim(),
    updatedAt: isoDate(manifest.updatedAt),
  };
  const validation = validateAsymptaServiceManifest(normalized);
  if (!validation.valid) throw new Error(validation.issues.join(" "));
  const previous = registry.get(normalized.serviceId);
  if (previous && JSON.stringify(previous) === JSON.stringify(normalized)) return clone(previous);
  registry.set(normalized.serviceId, normalized);
  notifyRegistry();
  return clone(normalized);
}

export function removeAsymptaServiceManifest(serviceId: string) {
  const removed = registry.delete(serviceId);
  if (removed) notifyRegistry();
  return removed;
}

export function listAsymptaServiceManifests() {
  return [...registry.values()]
    .filter((manifest) => manifest.enabled)
    .sort((left, right) => left.serviceId.localeCompare(right.serviceId))
    .map(clone);
}

export function subscribeAsymptaServiceRegistry(listener: RegistryListener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function matchAsymptaServiceIntent(text: string): AsymptaServiceIntentMatch | null {
  const clean = normalizedText(text);
  if (!clean) return null;
  let best: AsymptaServiceIntentMatch | null = null;
  let bestScore = -1;
  for (const manifest of listAsymptaServiceManifests()) {
    if ((manifest.excludePhrases ?? []).some((phrase) => phraseEvidence(clean, phrase))) continue;
    const action = longestPhraseMatch(clean, manifest.action.phrases);
    if (!action) continue;
    for (const itemType of manifest.itemTypes) {
      const item = longestPhraseMatch(clean, itemType.phrases);
      if (!item) continue;
      const quantity = quantityNearItem(clean, item.evidence);
      const score = item.phrase.length * 100 + action.phrase.length * 10 - item.index;
      if (score <= bestScore) continue;
      bestScore = score;
      best = {
        manifest,
        action: manifest.action.id,
        actionEvidence: action.evidence,
        itemType,
        itemEvidence: item.evidence,
        quantity: quantity.value,
        quantityEvidence: quantity.evidence,
      };
    }
  }
  return best ? clone(best) : null;
}

export function buildAsymptaServiceTask(input: {
  match: AsymptaServiceIntentMatch;
  requestId: string;
  conversationId?: string;
  locale?: string;
  contextProfile?: AsymptaUserContextProfile | null;
  confirmedFacts?: AsymptaTaskFact[];
  now?: number | string | Date;
}): AsymptaServiceTaskBundle {
  const { match } = input;
  const locale = input.locale ?? "en";
  const domain = match.itemType.domain;
  const explicitFacts: AsymptaTaskFact[] = [
    explicitFact("requested_item", match.itemType.canonicalItem, input.requestId, match.itemEvidence, domain),
    explicitFact("item_type", match.itemType.id, input.requestId, match.itemEvidence, domain),
    explicitFact("service_id", match.manifest.serviceId, input.requestId, match.actionEvidence, domain),
    explicitFact("service_version", match.manifest.version, input.requestId, match.actionEvidence, domain),
    match.quantityEvidence
      ? explicitFact("quantity", match.quantity, input.requestId, match.quantityEvidence, domain)
      : defaultFact("quantity", match.quantity, domain),
    defaultFact("market_location_id", match.itemType.marketLocationId, domain),
    ...extractedRequirementFacts(match.itemEvidence === input.requestId ? input.requestId : "", match, input.requestId),
  ];

  // Requirement value phrases must be searched in the full message. Replace the
  // placeholder extraction above with the correctly scoped full-text facts.
  explicitFacts.splice(
    explicitFacts.length - extractedRequirementFacts(match.itemEvidence === input.requestId ? input.requestId : "", match, input.requestId).length,
  );

  const requirements = match.manifest.requirements
    .map((definition) => materializeRequirement(match.manifest, match.itemType, definition, input.requestId))
    .filter((requirement): requirement is AsymptaTaskRequirement => Boolean(requirement));
  const profileFacts = userContextProfileAsTaskFacts(input.contextProfile ?? null, {
    domains: [domain, "marketplace", "payment", match.manifest.serviceId],
    includeSensitive: false,
    includeInferred: false,
    now: input.now,
  });
  const task = createAsymptaTaskIntent({
    taskId: input.requestId,
    conversationId: input.conversationId ?? input.requestId,
    goal: {
      action: match.action,
      domain,
      desiredOutcome: `complete_${match.action}_${match.itemType.id}`,
    },
    targetStage: "commitment",
    factLayers: [profileFacts, explicitFacts, input.confirmedFacts ?? []],
    requirements,
    permissions: match.manifest.permissions ?? [
      { action: "query_simulated_service", mode: "allowed" },
      { action: "execute_simulated_workflow", mode: "allowed" },
      { action: "place_real_order", mode: "prohibited", reason: "This adapter is simulation-only." },
      { action: "charge_real_payment_method", mode: "prohibited", reason: "This adapter is simulation-only." },
    ],
    successCriteria: match.manifest.successCriteria ?? [
      { id: `${input.requestId}:service-accepted`, description: "The simulated service accepts the structured task.", requiredEvidence: ["service_acceptance"] },
      { id: `${input.requestId}:action-completed`, description: "The requested simulated action reaches its declared outcome.", requiredEvidence: ["completion_receipt"] },
    ],
    locale,
    now: input.now,
    compiler: `asympta-service-registry/${match.manifest.version}`,
  });
  return { match: clone(match), task };
}

export function buildAsymptaServiceTaskFromText(input: {
  text: string;
  requestId: string;
  conversationId?: string;
  locale?: string;
  contextProfile?: AsymptaUserContextProfile | null;
  confirmedFacts?: AsymptaTaskFact[];
  now?: number | string | Date;
}) {
  const match = matchAsymptaServiceIntent(input.text);
  if (!match) return null;
  const bundle = buildAsymptaServiceTask({ ...input, match });
  const extracted = extractedRequirementFacts(input.text, match, input.requestId);
  if (!extracted.length) return bundle;
  return buildAsymptaServiceTask({
    ...input,
    match,
    confirmedFacts: [...extracted, ...(input.confirmedFacts ?? [])],
  });
}

export function buildAsymptaServiceWorkflow(bundle: AsymptaServiceTaskBundle, locale = "en") {
  assertAsymptaTaskReady(bundle.task);
  const facts = new Map(bundle.task.facts.map((fact) => [fact.key, fact.value]));
  const prefix = `svc-${stableHash(bundle.task.taskId)}`;
  const market = bundle.match.itemType.marketLocationId;
  const tasks: AtlasTaskBlueprint[] = bundle.match.manifest.workflow.tasks.map((template) => ({
    id: `${prefix}-${template.id}`,
    title: renderTemplate(template.title, locale, facts),
    detail: renderTemplate(template.detail, locale, facts),
    agentId: template.agentId,
    locationId: template.locationId === "$market" ? market : template.locationId === "$home" ? "shibuya" : template.locationId,
    dependsOn: template.dependsOn.map((dependency) => `${prefix}-${dependency}`),
    workMs: template.workMs,
    ...(template.requiresApproval ? { requiresApproval: true } : {}),
    ...(template.approvalLabel ? { approvalLabel: renderTemplate(template.approvalLabel, locale, facts) } : {}),
    ...(template.actionType ? { actionType: template.actionType } : {}),
  }));
  return {
    id: ASYMPTA_SERVICE_WORKFLOW_ID,
    name: renderTemplate(bundle.match.manifest.workflow.name, locale, facts),
    shortName: renderTemplate(bundle.match.manifest.workflow.shortName, locale, facts),
    summary: renderTemplate(bundle.match.manifest.workflow.summary, locale, facts),
    outcome: renderTemplate(bundle.match.manifest.workflow.outcome, locale, facts),
    tasks,
  } satisfies AtlasWorkflowDefinition;
}

export function upsertAsymptaServiceWorkflow(bundle: AsymptaServiceTaskBundle, locale = "en") {
  const workflow = buildAsymptaServiceWorkflow(bundle, locale);
  const existing = ATLAS_WORKFLOWS.findIndex((candidate) => candidate.id === ASYMPTA_SERVICE_WORKFLOW_ID);
  if (existing >= 0) ATLAS_WORKFLOWS.splice(existing, 1, workflow);
  else ATLAS_WORKFLOWS.push(workflow);
  return workflow;
}

export function serviceManifestSnapshot() {
  return {
    schemaVersion: "asympta.service-registry.v1" as const,
    services: listAsymptaServiceManifests().map((manifest) => ({
      serviceId: manifest.serviceId,
      version: manifest.version,
      enabled: manifest.enabled,
      adapter: manifest.adapter,
      itemTypes: manifest.itemTypes.map((item) => ({ id: item.id, domain: item.domain })),
      action: manifest.action.id,
      updatedAt: manifest.updatedAt,
    })),
  };
}
