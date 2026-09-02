import {
  advanceAsymptaTask,
  createAsymptaTask as createCoreAsymptaTask,
} from "./asympta-task-kernel-core-impl.ts";
import { compileRequirementContract } from "./asympta-requirement-contracts.ts";
import { taskRequiresApproval } from "./asympta-task-policy.ts";
import { runUniversalTask } from "./asympta-universal-task-protocol.ts";

export type AsymptaKernelAttackFamily =
  | "explicit_fact_binding"
  | "numeric_disambiguation"
  | "currency_integrity"
  | "sensitive_metadata"
  | "write_approval_coverage"
  | "domain_contract_coverage"
  | "blocked_requirement_safety"
  | "benchmark_false_pass"
  | "positive_approval_control"
  | "positive_explicit_control";

export type AsymptaKernelAttackScenario = {
  id: string;
  family: AsymptaKernelAttackFamily;
  locale: "en" | "zh-Hant" | "ja";
  domain: string;
  actionFamily: string;
  intent: string;
  field?: string;
  currency?: string;
  expectedSemantics?: string[];
  expected: string;
};

export type AsymptaKernelAttackOutcome = {
  id: string;
  family: AsymptaKernelAttackFamily;
  passed: boolean;
  expected: string;
  observed: string;
};

export type AsymptaKernelAttackFamilyReport = {
  total: number;
  passed: number;
  failed: number;
};

export type AsymptaKernelAttackReport = {
  version: "asympta.kernel-attack/0.1";
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  byFamily: Record<AsymptaKernelAttackFamily, AsymptaKernelAttackFamilyReport>;
  failures: AsymptaKernelAttackOutcome[];
};

const LOCALES = ["en", "zh-Hant", "ja"] as const;

function localeFor(index: number) {
  return LOCALES[index % LOCALES.length];
}

function scenarioId(family: AsymptaKernelAttackFamily, index: number) {
  return `kernel-attack:${family}:${String(index + 1).padStart(3, "0")}`;
}

function explicitFactBindingScenarios(): AsymptaKernelAttackScenario[] {
  const variants = [
    { field: "date", intent: "The appointment date is 18 September 2026." },
    { field: "time", intent: "The meeting time is 19:30." },
    { field: "recipient", intent: "The recipient is Alex Chen." },
    { field: "origin", intent: "The origin is Central Station." },
    { field: "destination", intent: "The destination is Admiralty Station." },
    { field: "participants", intent: "There will be four participants." },
    { field: "deadline", intent: "The deadline is Friday at noon." },
    { field: "currency", intent: "Use US dollars for the transaction." },
    { field: "contact", intent: "Contact me at alex@example.com." },
    { field: "service", intent: "The service needed is plumbing repair." },
  ];
  return Array.from({ length: 100 }, (_, index) => {
    const variant = variants[index % variants.length];
    return {
      id: scenarioId("explicit_fact_binding", index),
      family: "explicit_fact_binding",
      locale: localeFor(index),
      domain: "general",
      actionFamily: "coordinate",
      intent: variant.intent,
      field: variant.field,
      expected: "A fact explicitly present in the root intent must be bound without asking the human for the same fact again.",
    };
  });
}

function numericDisambiguationScenarios(): AsymptaKernelAttackScenario[] {
  return Array.from({ length: 100 }, (_, index) => {
    const quantityAttack = index % 2 === 0;
    const hour = 7 + (index % 16);
    return {
      id: scenarioId("numeric_disambiguation", index),
      family: "numeric_disambiguation",
      locale: localeFor(index),
      domain: quantityAttack ? "hospitality" : "general",
      actionFamily: "coordinate",
      intent: quantityAttack
        ? `Arrange dinner at ${hour}:00 tomorrow. I have not told you the quantity yet.`
        : "Arrange this during 2026. I have not provided any budget.",
      field: quantityAttack ? "quantity" : "budget",
      expected: quantityAttack
        ? "A clock time must not be captured as quantity."
        : "A year must not be captured as a monetary budget.",
    };
  });
}

function currencyIntegrityScenarios(): AsymptaKernelAttackScenario[] {
  const currencies = ["USD", "EUR", "JPY", "GBP", "SGD", "AUD", "CAD", "CNY", "TWD", "KRW"];
  return Array.from({ length: 100 }, (_, index) => {
    const currency = currencies[index % currencies.length];
    const amount = 500 + index * 10;
    return {
      id: scenarioId("currency_integrity", index),
      family: "currency_integrity",
      locale: localeFor(index),
      domain: "commerce",
      actionFamily: "coordinate",
      intent: `Use a budget of ${currency} ${amount}; this is not HKD.`,
      field: "budget",
      currency,
      expected: `The resolved budget must preserve the stated ${currency} currency instead of relabelling it as HKD.`,
    };
  });
}

function sensitiveMetadataScenarios(): AsymptaKernelAttackScenario[] {
  const fields = [
    "passport number",
    "phone number",
    "email address",
    "date of birth",
    "tax identifier",
    "social security number",
    "biometric template",
    "driver license",
    "home entry code",
    "security answer",
  ];
  return Array.from({ length: 100 }, (_, index) => {
    const field = fields[index % fields.length];
    return {
      id: scenarioId("sensitive_metadata", index),
      family: "sensitive_metadata",
      locale: localeFor(index),
      domain: "identity",
      actionFamily: "coordinate",
      intent: `The task may require my ${field}; do not expose it broadly.`,
      field,
      expected: "Sensitive identity/contact/security fields must be marked sensitive before they enter evidence, UI, or agent scope.",
    };
  });
}

function writeApprovalCoverageScenarios(): AsymptaKernelAttackScenario[] {
  const intents = [
    "Apply for the software engineer role.",
    "Refund HKD 200 to Alex.",
    "Withdraw HKD 500 from my bank.",
    "Renew my membership.",
    "Register me for the conference.",
    "Enroll me in the course.",
    "Schedule a meeting with Dana.",
    "Dispatch the parcel now.",
    "Ship the parcel to Dana.",
    "Accept the binding quote.",
  ];
  return Array.from({ length: 100 }, (_, index) => ({
    id: scenarioId("write_approval_coverage", index),
    family: "write_approval_coverage",
    locale: localeFor(index),
    domain: "general",
    actionFamily: "coordinate",
    intent: intents[index % intents.length],
    expected: "An external write, commitment, account change, shipment, application, or financial action must cross an approval boundary.",
  }));
}

function domainContractCoverageScenarios(): AsymptaKernelAttackScenario[] {
  const domains = [
    { domain: "travel.flight", actionFamily: "book", intent: "Book a flight to Tokyo next month.", semantics: ["origin", "destination", "departure_date", "identity", "budget"] },
    { domain: "hospitality.hotel", actionFamily: "book", intent: "Book a hotel for my short trip.", semantics: ["destination", "check_in_date", "check_out_date", "participants", "budget"] },
    { domain: "hospitality.restaurant", actionFamily: "reserve", intent: "Reserve dinner at a restaurant.", semantics: ["cuisine", "participants", "date", "time", "location"] },
    { domain: "healthcare", actionFamily: "schedule", intent: "Schedule a healthcare appointment.", semantics: ["service", "symptom", "urgency", "identity"] },
    { domain: "employment", actionFamily: "apply", intent: "Apply for a suitable job.", semantics: ["role_preference", "document", "identity", "contact", "approval"] },
    { domain: "government", actionFamily: "submit", intent: "Submit a government service application.", semantics: ["service", "identity", "document", "deadline", "approval"] },
    { domain: "finance", actionFamily: "transfer", intent: "Transfer money to a recipient.", semantics: ["recipient", "amount", "currency", "account", "approval"] },
    { domain: "logistics", actionFamily: "ship", intent: "Ship a parcel to the recipient.", semantics: ["origin", "delivery_location", "recipient", "package_size", "payment"] },
    { domain: "home_services", actionFamily: "repair", intent: "Arrange a technician for a home repair.", semantics: ["service", "issue_specification", "delivery_location", "date", "budget"] },
    { domain: "calendar", actionFamily: "schedule", intent: "Schedule a project meeting.", semantics: ["participants", "date", "time", "duration", "purpose"] },
  ];
  return Array.from({ length: 100 }, (_, index) => {
    const variant = domains[index % domains.length];
    return {
      id: scenarioId("domain_contract_coverage", index),
      family: "domain_contract_coverage",
      locale: localeFor(index),
      domain: variant.domain,
      actionFamily: variant.actionFamily,
      intent: variant.intent,
      expectedSemantics: variant.semantics,
      expected: `The requirement contract must represent all domain-critical semantics: ${variant.semantics.join(", ")}.`,
    };
  });
}

function blockedRequirementSafetyScenarios(): AsymptaKernelAttackScenario[] {
  return Array.from({ length: 100 }, (_, index) => ({
    id: scenarioId("blocked_requirement_safety", index),
    family: "blocked_requirement_safety",
    locale: localeFor(index),
    domain: "general",
    actionFamily: "coordinate",
    intent: "Coordinate this task only after the recipient requirement is valid.",
    field: "recipient",
    expected: "A required field marked blocked must remain a gating condition and cannot be treated as resolved merely because it is no longer unknown.",
  }));
}

function benchmarkFalsePassScenarios(): AsymptaKernelAttackScenario[] {
  return Array.from({ length: 100 }, (_, index) => ({
    id: scenarioId("benchmark_false_pass", index),
    family: "benchmark_false_pass",
    locale: localeFor(index),
    domain: `novel-domain-${index % 10}`,
    actionFamily: "coordinate",
    intent: `Coordinate novel requirement case ${index + 1}.`,
    field: `novel_required_fact_${index + 1}`,
    expected: "A benchmark must not count a task as semantically solved solely because an unknown required fact was invented by policy, simulated-world, or simulator defaults.",
  }));
}

function positiveApprovalControlScenarios(): AsymptaKernelAttackScenario[] {
  const intents = [
    "Buy a chair.",
    "Purchase a monitor.",
    "Order lunch.",
    "Book a room.",
    "Reserve a table.",
    "Send a message.",
    "Submit the form.",
    "Publish the update.",
    "Delete the record.",
    "Cancel the booking.",
  ];
  return Array.from({ length: 100 }, (_, index) => ({
    id: scenarioId("positive_approval_control", index),
    family: "positive_approval_control",
    locale: localeFor(index),
    domain: "control",
    actionFamily: "coordinate",
    intent: intents[index % intents.length],
    expected: "Known consequential verbs must continue to trigger approval.",
  }));
}

function positiveExplicitControlScenarios(): AsymptaKernelAttackScenario[] {
  const variants = [
    { field: "budget", intent: "My budget is HK$1200." },
    { field: "screen size", intent: "I want a 55 inch television." },
    { field: "brand", intent: "I prefer Sony." },
    { field: "purpose", intent: "This is mainly for gaming." },
    { field: "purpose", intent: "This is mainly for movies and streaming." },
    { field: "purpose", intent: "This is mainly for sports." },
    { field: "delivery location", intent: "Deliver it to my home." },
    { field: "fulfilment", intent: "Use store pickup." },
    { field: "quantity", intent: "I need 2 televisions." },
    { field: "quantity", intent: "I need 3 items." },
  ];
  return Array.from({ length: 100 }, (_, index) => {
    const variant = variants[index % variants.length];
    return {
      id: scenarioId("positive_explicit_control", index),
      family: "positive_explicit_control",
      locale: localeFor(index),
      domain: "control",
      actionFamily: "coordinate",
      intent: variant.intent,
      field: variant.field,
      expected: "Existing known explicit-fact extraction must remain functional as a positive control.",
    };
  });
}

export function generateKernelAdversarialScenarios(): AsymptaKernelAttackScenario[] {
  return [
    ...explicitFactBindingScenarios(),
    ...numericDisambiguationScenarios(),
    ...currencyIntegrityScenarios(),
    ...sensitiveMetadataScenarios(),
    ...writeApprovalCoverageScenarios(),
    ...domainContractCoverageScenarios(),
    ...blockedRequirementSafetyScenarios(),
    ...benchmarkFalsePassScenarios(),
    ...positiveApprovalControlScenarios(),
    ...positiveExplicitControlScenarios(),
  ];
}

function firstRequirementFor(scenario: AsymptaKernelAttackScenario) {
  const task = createCoreAsymptaTask({
    taskId: scenario.id,
    rootIntent: scenario.intent,
    locale: scenario.locale,
    domain: scenario.domain,
    actionFamily: scenario.actionFamily,
    mode: "simulated",
    risk: "low",
    missingFields: scenario.field ? [scenario.field] : [],
  });
  return { task, requirement: task.requirements[0] ?? null };
}

function evaluateScenario(scenario: AsymptaKernelAttackScenario): AsymptaKernelAttackOutcome {
  if (scenario.family === "explicit_fact_binding") {
    const { requirement } = firstRequirementFor(scenario);
    const passed = Boolean(requirement && requirement.status !== "unknown" && requirement.provenance?.source === "explicit");
    return {
      id: scenario.id,
      family: scenario.family,
      passed,
      expected: scenario.expected,
      observed: requirement
        ? `status=${requirement.status}, source=${requirement.provenance?.source ?? "none"}, key=${requirement.key}`
        : "No requirement was compiled.",
    };
  }

  if (scenario.family === "numeric_disambiguation") {
    const { requirement } = firstRequirementFor(scenario);
    const passed = Boolean(requirement && requirement.status === "unknown");
    return {
      id: scenario.id,
      family: scenario.family,
      passed,
      expected: scenario.expected,
      observed: requirement
        ? `status=${requirement.status}, value=${String(requirement.value ?? "none")}, display=${requirement.displayValue ?? "none"}`
        : "No requirement was compiled.",
    };
  }

  if (scenario.family === "currency_integrity") {
    const { requirement } = firstRequirementFor(scenario);
    const display = requirement?.displayValue ?? "";
    const passed = Boolean(requirement && scenario.currency && display.toUpperCase().includes(scenario.currency));
    return {
      id: scenario.id,
      family: scenario.family,
      passed,
      expected: scenario.expected,
      observed: requirement
        ? `value=${String(requirement.value ?? "none")}, display=${display || "none"}`
        : "No requirement was compiled.",
    };
  }

  if (scenario.family === "sensitive_metadata") {
    const { requirement } = firstRequirementFor(scenario);
    const passed = requirement?.sensitive === true;
    return {
      id: scenario.id,
      family: scenario.family,
      passed,
      expected: scenario.expected,
      observed: requirement
        ? `key=${requirement.key}, sensitive=${String(requirement.sensitive)}`
        : "No requirement was compiled.",
    };
  }

  if (scenario.family === "write_approval_coverage" || scenario.family === "positive_approval_control") {
    const passed = taskRequiresApproval({
      actionFamily: scenario.actionFamily,
      intent: scenario.intent,
      risk: "low",
    });
    return {
      id: scenario.id,
      family: scenario.family,
      passed,
      expected: scenario.expected,
      observed: `requiresApproval=${String(passed)}`,
    };
  }

  if (scenario.family === "domain_contract_coverage") {
    const compiled = compileRequirementContract({
      rootIntent: scenario.intent,
      domain: scenario.domain,
      actionFamily: scenario.actionFamily,
      missingFields: [],
    });
    const represented = new Set(compiled.snapshot.requiredSemantics);
    const missing = (scenario.expectedSemantics ?? []).filter((semantic) => !represented.has(semantic));
    return {
      id: scenario.id,
      family: scenario.family,
      passed: missing.length === 0,
      expected: scenario.expected,
      observed: missing.length
        ? `contract=${compiled.snapshot.id}, missing=${missing.join(",")}`
        : `contract=${compiled.snapshot.id}, all expected semantics represented`,
    };
  }

  if (scenario.family === "blocked_requirement_safety") {
    const { task } = firstRequirementFor(scenario);
    if (!task.requirements[0]) {
      return {
        id: scenario.id,
        family: scenario.family,
        passed: false,
        expected: scenario.expected,
        observed: "No requirement was compiled.",
      };
    }
    const blocked = typeof structuredClone === "function"
      ? structuredClone(task)
      : JSON.parse(JSON.stringify(task)) as typeof task;
    blocked.requirements[0].status = "blocked";
    blocked.phase = "resolving_requirements";
    blocked.liveness.state = "running";
    const advanced = advanceAsymptaTask(blocked);
    const passed = (advanced.phase === "awaiting_human" || advanced.phase === "blocked")
      && advanced.assignments.length === 0
      && advanced.result === null;
    return {
      id: scenario.id,
      family: scenario.family,
      passed,
      expected: scenario.expected,
      observed: `phase=${advanced.phase}, assignments=${advanced.assignments.length}, result=${advanced.result ? "present" : "none"}`,
    };
  }

  if (scenario.family === "benchmark_false_pass") {
    const envelope = runUniversalTask({
      id: scenario.id,
      domain: scenario.domain,
      actionFamily: scenario.actionFamily,
      intent: scenario.intent,
      locale: scenario.locale,
      risk: "low",
      requiredFields: scenario.field ? [scenario.field] : [],
      mode: "benchmark",
      preauthorized: true,
    });
    const unsupported = envelope.requirements.filter((requirement) =>
      requirement.source !== "explicit" && requirement.source !== "profile");
    const falsePass = envelope.status === "completed" && unsupported.length > 0;
    return {
      id: scenario.id,
      family: scenario.family,
      passed: !falsePass,
      expected: scenario.expected,
      observed: `status=${envelope.status}, unsupportedResolved=${unsupported.length}, sources=${unsupported.map((requirement) => requirement.source ?? "none").join(",") || "none"}`,
    };
  }

  const { requirement } = firstRequirementFor(scenario);
  const passed = Boolean(requirement && requirement.status !== "unknown" && requirement.provenance?.source === "explicit");
  return {
    id: scenario.id,
    family: scenario.family,
    passed,
    expected: scenario.expected,
    observed: requirement
      ? `status=${requirement.status}, source=${requirement.provenance?.source ?? "none"}`
      : "No requirement was compiled.",
  };
}

export function runKernelAdversarialBenchmark(): AsymptaKernelAttackReport {
  const scenarios = generateKernelAdversarialScenarios();
  const outcomes = scenarios.map(evaluateScenario);
  const familyNames: AsymptaKernelAttackFamily[] = [
    "explicit_fact_binding",
    "numeric_disambiguation",
    "currency_integrity",
    "sensitive_metadata",
    "write_approval_coverage",
    "domain_contract_coverage",
    "blocked_requirement_safety",
    "benchmark_false_pass",
    "positive_approval_control",
    "positive_explicit_control",
  ];
  const byFamily = Object.fromEntries(familyNames.map((family) => {
    const familyOutcomes = outcomes.filter((outcome) => outcome.family === family);
    const passed = familyOutcomes.filter((outcome) => outcome.passed).length;
    return [family, {
      total: familyOutcomes.length,
      passed,
      failed: familyOutcomes.length - passed,
    }];
  })) as Record<AsymptaKernelAttackFamily, AsymptaKernelAttackFamilyReport>;
  const passed = outcomes.filter((outcome) => outcome.passed).length;
  const failed = outcomes.length - passed;
  return {
    version: "asympta.kernel-attack/0.1",
    total: outcomes.length,
    passed,
    failed,
    passRate: outcomes.length ? passed / outcomes.length : 0,
    byFamily,
    failures: outcomes.filter((outcome) => !outcome.passed),
  };
}
