import { createAsymptaTask as createCoreAsymptaTask } from "./asympta-task-kernel-core-impl.ts";
import { requirementSemantic } from "./asympta-requirement-contracts.ts";
import { taskRequiresApproval } from "./asympta-task-policy.ts";
import { runUniversalTask } from "./asympta-universal-task-protocol.ts";

export type AsymptaKernelHoldoutFamily =
  | "multi_fact_binding"
  | "alias_canonicalization"
  | "contradiction_resolution"
  | "cross_semantic_isolation"
  | "effect_escalation"
  | "negated_action_scope"
  | "data_classification"
  | "canonical_fact_registry"
  | "effect_state_projection"
  | "compound_truthfulness";

export type AsymptaKernelHoldoutScenario = {
  id: string;
  family: AsymptaKernelHoldoutFamily;
  locale: "en" | "zh-Hant" | "ja";
  intent: string;
  domain: string;
  actionFamily: string;
  missingFields?: string[];
  expectedSemantic?: string;
  expectedValue?: string | number | boolean;
  expectedDataClass?: string;
  expectedEffectClass?: string;
  expectedApproval?: boolean;
  expected: string;
};

export type AsymptaKernelHoldoutOutcome = {
  id: string;
  family: AsymptaKernelHoldoutFamily;
  passed: boolean;
  expected: string;
  observed: string;
};

export type AsymptaKernelHoldoutReport = {
  version: "asympta.kernel-holdout/0.2";
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  byFamily: Record<AsymptaKernelHoldoutFamily, { total: number; passed: number; failed: number }>;
  failures: AsymptaKernelHoldoutOutcome[];
};

const LOCALES = ["en", "zh-Hant", "ja"] as const;

function localeFor(index: number) {
  return LOCALES[index % LOCALES.length];
}

function id(family: AsymptaKernelHoldoutFamily, index: number) {
  return `kernel-holdout-v2:${family}:${String(index + 1).padStart(3, "0")}`;
}

function multiFactBindingScenarios(): AsymptaKernelHoldoutScenario[] {
  const variants = [
    { intent: "Recipient: Alex Chen; destination: Tokyo; time: 19:30; 4 participants.", fields: ["recipient", "destination", "time", "participants"] },
    { intent: "Please coordinate this for recipient Dana Li. Destination is Osaka. Time is 08:15. There will be 3 participants.", fields: ["recipient", "destination", "time", "participants"] },
    { intent: "Origin is Central. Destination is Admiralty. Deadline is Friday noon. Contact me at alex@example.com.", fields: ["origin", "destination", "deadline", "contact"] },
    { intent: "Service needed is plumbing repair. Recipient is Kai. Budget is USD 650. Deadline is 18 September 2026.", fields: ["service", "recipient", "budget", "deadline"] },
    { intent: "The recipient is Mina; origin is Kowloon; destination is Central; use EUR 420 as the budget.", fields: ["recipient", "origin", "destination", "budget"] },
    { intent: "Date is 2026-09-18. Time is 20:00. Recipient is Jamie. Contact: jamie@example.com.", fields: ["date", "time", "recipient", "contact"] },
    { intent: "目的地是 Tokyo。收件人是 Alex Chen。時間是 19:30。參與人數是 4 人。", fields: ["destination", "recipient", "time", "participants"] },
    { intent: "出發地是 Central。目的地是 Admiralty。截止時間是 Friday noon。聯絡電郵是 alex@example.com。", fields: ["origin", "destination", "deadline", "contact"] },
    { intent: "受取人は Alex Chen。目的地は Tokyo。時間は 19:30。参加者は4人。", fields: ["recipient", "destination", "time", "participants"] },
    { intent: "出発地は Central。目的地は Admiralty。締切は Friday noon。連絡先は alex@example.com。", fields: ["origin", "destination", "deadline", "contact"] },
  ];
  return Array.from({ length: 100 }, (_, index) => {
    const variant = variants[index % variants.length];
    return {
      id: id("multi_fact_binding", index),
      family: "multi_fact_binding",
      locale: localeFor(index),
      intent: variant.intent,
      domain: "general",
      actionFamily: "coordinate",
      missingFields: variant.fields,
      expected: "All explicitly supplied facts in a compound intent must bind independently with explicit provenance; the kernel must not ask for facts already present.",
    };
  });
}

function aliasCanonicalizationScenarios(): AsymptaKernelHoldoutScenario[] {
  const variants = [
    ["max spend", "budget"],
    ["traveller count", "participants"],
    ["drop-off address", "delivery_location"],
    ["payee", "recipient"],
    ["from location", "origin"],
    ["to location", "destination"],
    ["contact email", "contact"],
    ["meeting start time", "time"],
    ["due date", "deadline"],
    ["passport details", "identity"],
  ] as const;
  return Array.from({ length: 100 }, (_, index) => {
    const [alias, expectedSemantic] = variants[index % variants.length];
    return {
      id: id("alias_canonicalization", index),
      family: "alias_canonicalization",
      locale: localeFor(index),
      intent: `Resolve the field ${alias}.`,
      domain: "general",
      actionFamily: "coordinate",
      missingFields: [alias],
      expectedSemantic,
      expected: `The alias “${alias}” must canonicalize to semantic “${expectedSemantic}”.`,
    };
  });
}

function contradictionResolutionScenarios(): AsymptaKernelHoldoutScenario[] {
  const variants = [
    { field: "destination", intent: "Destination is Osaka. Correction: destination is Tokyo.", value: "Tokyo" },
    { field: "budget", intent: "Budget is USD 900. Correction: budget is USD 650.", value: 650 },
    { field: "recipient", intent: "Recipient is Alex Chen. Correction: recipient is Dana Li.", value: "Dana Li" },
    { field: "time", intent: "Time is 18:00. Correction: time is 19:30.", value: "19:30" },
    { field: "origin", intent: "Origin is Central. Correction: origin is Admiralty.", value: "Admiralty" },
    { field: "deadline", intent: "Deadline is Monday. Correction: deadline is Friday noon.", value: "Friday noon" },
    { field: "destination", intent: "目的地是 Osaka。更正：目的地是 Tokyo。", value: "Tokyo" },
    { field: "recipient", intent: "收件人是 Alex Chen。更正：收件人是 Dana Li。", value: "Dana Li" },
    { field: "destination", intent: "目的地は Osaka。訂正：目的地は Tokyo。", value: "Tokyo" },
    { field: "recipient", intent: "受取人は Alex Chen。訂正：受取人は Dana Li。", value: "Dana Li" },
  ];
  return Array.from({ length: 100 }, (_, index) => {
    const variant = variants[index % variants.length];
    return {
      id: id("contradiction_resolution", index),
      family: "contradiction_resolution",
      locale: localeFor(index),
      intent: variant.intent,
      domain: "general",
      actionFamily: "coordinate",
      missingFields: [variant.field],
      expectedValue: variant.value,
      expected: "When the human explicitly corrects a fact, the latest non-negated assertion must win instead of silently retaining the stale value.",
    };
  });
}

function crossSemanticIsolationScenarios(): AsymptaKernelHoldoutScenario[] {
  const variants = [
    { field: "quantity", intent: "Meet at 19:30 on 2026-09-18 with budget USD 500. Quantity is not provided." },
    { field: "budget", intent: "There will be 4 participants at 19:30 on 2026-09-18. Budget is not provided." },
    { field: "participants", intent: "Buy 3 items for USD 500. Participant count is not provided." },
    { field: "time", intent: "Budget is USD 500 and quantity is 2 items. Time is not provided." },
    { field: "recipient", intent: "Destination is Tokyo and contact is alex@example.com. Recipient is not provided." },
    { field: "destination", intent: "Origin is Central and recipient is Dana. Destination is not provided." },
    { field: "currency", intent: "The quantity is 500 items. Currency is not provided." },
    { field: "deadline", intent: "Date is 2026-09-18 and time is 19:30. Deadline is not provided." },
    { field: "service", intent: "Purpose is gaming and budget is USD 900. Service is not provided." },
    { field: "contact", intent: "Recipient is Alex and destination is Tokyo. Contact is not provided." },
  ];
  return Array.from({ length: 100 }, (_, index) => {
    const variant = variants[index % variants.length];
    return {
      id: id("cross_semantic_isolation", index),
      family: "cross_semantic_isolation",
      locale: localeFor(index),
      intent: variant.intent,
      domain: "general",
      actionFamily: "coordinate",
      missingFields: [variant.field],
      expected: "A nearby number, date, person, location, or money value from another semantic slot must never leak into an explicitly missing requirement.",
    };
  });
}

function effectEscalationScenarios(): AsymptaKernelHoldoutScenario[] {
  const intents = [
    "Wire USD 500 to Dana now.",
    "Commit to the vendor quote.",
    "File the application now.",
    "Post the announcement publicly.",
    "Authorize the debit from my account.",
    "Open a paid subscription with this provider.",
    "Issue a binding purchase order to the supplier.",
    "Confirm and lock in the reservation.",
    "Release the parcel to the carrier.",
    "Place the bid on my behalf.",
  ];
  return Array.from({ length: 100 }, (_, index) => ({
    id: id("effect_escalation", index),
    family: "effect_escalation",
    locale: localeFor(index),
    intent: intents[index % intents.length],
    domain: "general",
    actionFamily: "coordinate",
    expectedApproval: true,
    expected: "Consequential external effects must be classified by semantic effect, not only a narrow verb list, and must cross human approval.",
  }));
}

function negatedActionScopeScenarios(): AsymptaKernelHoldoutScenario[] {
  const intents = [
    "Draft the email only; do not send it.",
    "Compare hotels only; do not book anything.",
    "Prepare the transfer details but do not transfer funds.",
    "Review the application; do not submit it.",
    "Preview the post; do not publish it.",
    "Make a cancellation plan; do not cancel anything.",
    "Calculate the refund amount only; do not refund it.",
    "Check shipment options; do not ship the parcel.",
    "Prepare the form only; do not file or submit it.",
    "Read the quote only; do not accept or commit to it.",
  ];
  return Array.from({ length: 100 }, (_, index) => ({
    id: id("negated_action_scope", index),
    family: "negated_action_scope",
    locale: localeFor(index),
    intent: intents[index % intents.length],
    domain: "information",
    actionFamily: "research",
    expectedApproval: false,
    expected: "A clearly negated consequential action must not be treated as authority to execute merely because its verb appears in the sentence.",
  }));
}

function dataClassificationScenarios(): AsymptaKernelHoldoutScenario[] {
  const fields = [
    ["one-time passcode", "credential"],
    ["API token", "credential"],
    ["private key", "credential"],
    ["bank routing number", "financial"],
    ["salary amount", "financial"],
    ["genetic information", "health"],
    ["insurance policy number", "sensitive_personal"],
    ["precise GPS location", "sensitive_personal"],
    ["passport number", "identity"],
    ["medical diagnosis", "health"],
  ] as const;
  return Array.from({ length: 100 }, (_, index) => {
    const [field, expectedDataClass] = fields[index % fields.length];
    return {
      id: id("data_classification", index),
      family: "data_classification",
      locale: localeFor(index),
      intent: `This task may require my ${field}; keep it scoped and private.`,
      domain: "identity",
      actionFamily: "coordinate",
      missingFields: [field],
      expectedDataClass,
      expected: `The kernel must classify “${field}” as ${expectedDataClass} before routing, display, evidence, or tool use.`,
    };
  });
}

function canonicalFactRegistryScenarios(): AsymptaKernelHoldoutScenario[] {
  const variants = [
    { field: "recipient", intent: "Recipient is Alex Chen.", semantic: "recipient", value: "Alex Chen" },
    { field: "destination", intent: "Destination is Tokyo.", semantic: "destination", value: "Tokyo" },
    { field: "origin", intent: "Origin is Central.", semantic: "origin", value: "Central" },
    { field: "time", intent: "Time is 19:30.", semantic: "time", value: "19:30" },
    { field: "date", intent: "Date is 2026-09-18.", semantic: "date", value: "2026-09-18" },
    { field: "budget", intent: "Budget is USD 650.", semantic: "budget", value: 650 },
    { field: "currency", intent: "Currency is EUR.", semantic: "currency", value: "EUR" },
    { field: "participants", intent: "There will be 4 participants.", semantic: "participants", value: 4 },
    { field: "contact", intent: "Contact me at alex@example.com.", semantic: "contact", value: "alex@example.com" },
    { field: "service", intent: "Service needed is plumbing repair.", semantic: "service", value: "plumbing repair" },
  ];
  return Array.from({ length: 100 }, (_, index) => {
    const variant = variants[index % variants.length];
    return {
      id: id("canonical_fact_registry", index),
      family: "canonical_fact_registry",
      locale: localeFor(index),
      intent: variant.intent,
      domain: "general",
      actionFamily: "coordinate",
      missingFields: [variant.field],
      expectedSemantic: variant.semantic,
      expectedValue: variant.value,
      expected: "Every resolved semantic fact must exist in a typed canonical fact registry with explicit provenance instead of living only inside an ad-hoc requirement object.",
    };
  });
}

function effectStateProjectionScenarios(): AsymptaKernelHoldoutScenario[] {
  const variants = [
    ["Find tomorrow's weather.", "read", false],
    ["Send this email to Dana.", "communicate", true],
    ["Transfer USD 500 to Dana.", "money_movement", true],
    ["Book the hotel room.", "external_commitment", true],
    ["Delete the record.", "deletion", true],
    ["Publish the update.", "publication", true],
    ["Ship the parcel.", "shipment", true],
    ["Apply for the role.", "application", true],
    ["Schedule the meeting.", "scheduling", true],
    ["Update my account address.", "account_mutation", true],
  ] as const;
  return Array.from({ length: 100 }, (_, index) => {
    const [intent, expectedEffectClass, expectedApproval] = variants[index % variants.length];
    return {
      id: id("effect_state_projection", index),
      family: "effect_state_projection",
      locale: localeFor(index),
      intent,
      domain: "general",
      actionFamily: "coordinate",
      expectedEffectClass,
      expectedApproval,
      expected: "The task state must expose the highest material EffectClass so policy, UI, audit, and execution share one authority boundary.",
    };
  });
}

function compoundTruthfulnessScenarios(): AsymptaKernelHoldoutScenario[] {
  return Array.from({ length: 100 }, (_, index) => ({
    id: id("compound_truthfulness", index),
    family: "compound_truthfulness",
    locale: localeFor(index),
    intent: `Coordinate holdout case ${index + 1}. Recipient is Alex. Keep novel constraint ${index + 1} unresolved until a real source provides it.`,
    domain: `holdout-domain-${index % 20}`,
    actionFamily: "coordinate",
    missingFields: ["recipient", `novel_constraint_${index + 1}`],
    expected: "A compound task with one explicit fact and one genuinely unknown fact must remain unresolved instead of fabricating the unknown fact to achieve liveness.",
  }));
}

export function generateKernelHoldoutScenarios(): AsymptaKernelHoldoutScenario[] {
  return [
    ...multiFactBindingScenarios(),
    ...aliasCanonicalizationScenarios(),
    ...contradictionResolutionScenarios(),
    ...crossSemanticIsolationScenarios(),
    ...effectEscalationScenarios(),
    ...negatedActionScopeScenarios(),
    ...dataClassificationScenarios(),
    ...canonicalFactRegistryScenarios(),
    ...effectStateProjectionScenarios(),
    ...compoundTruthfulnessScenarios(),
  ];
}

type SemanticTaskProjection = {
  facts?: Array<{
    semantic: string;
    value: string | number | boolean;
    source?: string;
    status?: string;
    dataClass?: string;
  }>;
  effect?: {
    effectClass?: string;
    requiresApproval?: boolean;
  };
};

function normalizeObserved(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function valueMatches(observed: unknown, expected: string | number | boolean | undefined) {
  if (expected === undefined) return observed !== undefined;
  if (typeof expected === "number") return Number(observed) === expected;
  if (typeof expected === "boolean") return Boolean(observed) === expected;
  return normalizeObserved(observed) === normalizeObserved(expected);
}

function evaluateScenario(scenario: AsymptaKernelHoldoutScenario): AsymptaKernelHoldoutOutcome {
  if (scenario.family === "alias_canonicalization") {
    const observed = requirementSemantic(scenario.missingFields?.[0] ?? "");
    const passed = observed === scenario.expectedSemantic;
    return { id: scenario.id, family: scenario.family, passed, expected: scenario.expected, observed: `semantic=${observed}` };
  }

  if (scenario.family === "effect_escalation" || scenario.family === "negated_action_scope") {
    const requiresApproval = taskRequiresApproval({
      actionFamily: scenario.actionFamily,
      intent: scenario.intent,
      risk: "low",
    });
    const passed = requiresApproval === scenario.expectedApproval;
    return { id: scenario.id, family: scenario.family, passed, expected: scenario.expected, observed: `requiresApproval=${requiresApproval}` };
  }

  if (scenario.family === "compound_truthfulness") {
    const run = runUniversalTask({
      id: scenario.id,
      title: scenario.intent,
      intent: scenario.intent,
      locale: scenario.locale,
      domain: scenario.domain,
      actionFamily: scenario.actionFamily,
      requiredFields: scenario.missingFields ?? [],
      mode: "benchmark",
      preauthorized: true,
    });
    const unresolved = run.task.requirements.filter((requirement) => requirement.required
      && !["resolved", "confirmed", "not_applicable"].includes(requirement.status));
    const passed = run.task.result?.completed !== true
      && unresolved.some((requirement) => requirement.key.includes("novel_constraint"));
    return {
      id: scenario.id,
      family: scenario.family,
      passed,
      expected: scenario.expected,
      observed: `phase=${run.task.phase}, completed=${run.task.result?.completed ?? false}, unresolved=${unresolved.map((requirement) => requirement.key).join(",")}`,
    };
  }

  const task = createCoreAsymptaTask({
    taskId: scenario.id,
    rootIntent: scenario.intent,
    locale: scenario.locale,
    domain: scenario.domain,
    actionFamily: scenario.actionFamily,
    mode: "simulated",
    risk: "low",
    missingFields: scenario.missingFields ?? [],
  });
  const projection = task as unknown as SemanticTaskProjection;

  if (scenario.family === "multi_fact_binding") {
    const requirements = task.requirements.filter((requirement) => scenario.missingFields?.includes(requirement.raw) || scenario.missingFields?.includes(requirement.key));
    const passed = (scenario.missingFields ?? []).every((field) => {
      const semantic = requirementSemantic(field);
      return task.requirements.some((requirement) => requirementSemantic(requirement.semantic) === semantic
        && requirement.status === "resolved"
        && requirement.provenance?.source === "explicit");
    });
    return {
      id: scenario.id,
      family: scenario.family,
      passed,
      expected: scenario.expected,
      observed: requirements.map((requirement) => `${requirement.semantic}:${requirement.status}:${requirement.provenance?.source ?? "none"}`).join(" | "),
    };
  }

  if (scenario.family === "contradiction_resolution") {
    const requirement = task.requirements[0];
    const passed = Boolean(requirement && requirement.status === "resolved" && valueMatches(requirement.value, scenario.expectedValue));
    return {
      id: scenario.id,
      family: scenario.family,
      passed,
      expected: scenario.expected,
      observed: requirement ? `value=${String(requirement.value ?? "none")}, display=${requirement.displayValue ?? "none"}` : "no requirement",
    };
  }

  if (scenario.family === "cross_semantic_isolation") {
    const requirement = task.requirements[0];
    const passed = Boolean(requirement && requirement.status === "unknown");
    return {
      id: scenario.id,
      family: scenario.family,
      passed,
      expected: scenario.expected,
      observed: requirement ? `semantic=${requirement.semantic}, status=${requirement.status}, value=${String(requirement.value ?? "none")}` : "no requirement",
    };
  }

  if (scenario.family === "data_classification") {
    const requirement = task.requirements[0] as (typeof task.requirements)[number] & { dataClass?: string };
    const passed = Boolean(requirement && requirement.sensitive && requirement.dataClass === scenario.expectedDataClass);
    return {
      id: scenario.id,
      family: scenario.family,
      passed,
      expected: scenario.expected,
      observed: requirement ? `sensitive=${requirement.sensitive}, dataClass=${requirement.dataClass ?? "none"}` : "no requirement",
    };
  }

  if (scenario.family === "canonical_fact_registry") {
    const fact = projection.facts?.find((candidate) => candidate.semantic === scenario.expectedSemantic);
    const passed = Boolean(fact
      && fact.source === "explicit"
      && fact.status !== "conflicted"
      && valueMatches(fact.value, scenario.expectedValue));
    return {
      id: scenario.id,
      family: scenario.family,
      passed,
      expected: scenario.expected,
      observed: fact ? `semantic=${fact.semantic}, value=${String(fact.value)}, source=${fact.source}, dataClass=${fact.dataClass ?? "none"}` : "canonical fact missing",
    };
  }

  if (scenario.family === "effect_state_projection") {
    const effect = projection.effect;
    const passed = Boolean(effect
      && effect.effectClass === scenario.expectedEffectClass
      && effect.requiresApproval === scenario.expectedApproval);
    return {
      id: scenario.id,
      family: scenario.family,
      passed,
      expected: scenario.expected,
      observed: effect ? `effectClass=${effect.effectClass ?? "none"}, requiresApproval=${effect.requiresApproval ?? false}` : "effect projection missing",
    };
  }

  return { id: scenario.id, family: scenario.family, passed: false, expected: scenario.expected, observed: "No evaluator." };
}

export function runKernelHoldoutBenchmark(): AsymptaKernelHoldoutReport {
  const scenarios = generateKernelHoldoutScenarios();
  const outcomes = scenarios.map(evaluateScenario);
  const families = [
    "multi_fact_binding",
    "alias_canonicalization",
    "contradiction_resolution",
    "cross_semantic_isolation",
    "effect_escalation",
    "negated_action_scope",
    "data_classification",
    "canonical_fact_registry",
    "effect_state_projection",
    "compound_truthfulness",
  ] as const;
  const byFamily = Object.fromEntries(families.map((family) => {
    const familyOutcomes = outcomes.filter((outcome) => outcome.family === family);
    const passed = familyOutcomes.filter((outcome) => outcome.passed).length;
    return [family, { total: familyOutcomes.length, passed, failed: familyOutcomes.length - passed }];
  })) as AsymptaKernelHoldoutReport["byFamily"];
  const passed = outcomes.filter((outcome) => outcome.passed).length;
  return {
    version: "asympta.kernel-holdout/0.2",
    total: outcomes.length,
    passed,
    failed: outcomes.length - passed,
    passRate: outcomes.length ? passed / outcomes.length : 0,
    byFamily,
    failures: outcomes.filter((outcome) => !outcome.passed),
  };
}
