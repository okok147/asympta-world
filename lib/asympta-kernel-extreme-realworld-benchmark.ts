import { createAsymptaTask as createCoreAsymptaTask } from "./asympta-task-kernel-core-impl.ts";
import { requirementSemantic } from "./asympta-requirement-contracts.ts";
import { taskRequiresApproval } from "./asympta-task-policy.ts";

export const EXTREME_REALWORLD_FAMILIES = [
  "obvious_typo_alias",
  "code_switch_alias",
  "impossible_date",
  "impossible_time",
  "ambiguous_date",
  "malformed_contact",
  "malformed_identity",
  "negative_zero_quantity",
  "fractional_discrete_quantity",
  "malformed_money",
  "mixed_currency_conflict",
  "ambiguous_currency_symbol",
  "unit_slot_mismatch",
  "contradictory_fact",
  "uncertain_fact",
  "negated_fact",
  "revoked_commitment",
  "revoked_payment",
  "noisy_compound_binding",
  "absurd_feasibility_truthfulness",
] as const;

export type AsymptaKernelExtremeFamily = (typeof EXTREME_REALWORLD_FAMILIES)[number];

type Locale = "en" | "zh-Hant" | "ja";

type Expectation =
  | { kind: "canonical_semantic"; field: string; semantic: string }
  | { kind: "unresolved"; field: string }
  | { kind: "no_consequential_authority" }
  | { kind: "compound_explicit"; fields: string[] }
  | { kind: "truthful_absurd"; novelField: string };

export type AsymptaKernelExtremeScenario = {
  id: string;
  family: AsymptaKernelExtremeFamily;
  locale: Locale;
  intent: string;
  domain: string;
  actionFamily: string;
  missingFields: string[];
  expectation: Expectation;
  rationale: string;
};

export type AsymptaKernelExtremeOutcome = {
  id: string;
  family: AsymptaKernelExtremeFamily;
  passed: boolean;
  rationale: string;
  observed: string;
};

export type AsymptaKernelExtremeReport = {
  version: "asympta.kernel-extreme-realworld/0.3";
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  byFamily: Record<AsymptaKernelExtremeFamily, { total: number; passed: number; failed: number }>;
  failures: AsymptaKernelExtremeOutcome[];
};

const LOCALES: Locale[] = ["en", "zh-Hant", "ja"];
const DOMAINS = [
  "retail", "travel", "finance", "calendar", "healthcare", "government", "hospitality", "logistics", "employment", "home-services",
  "education", "events", "insurance", "property", "subscriptions", "communications", "mobility", "food", "professional-services", "general",
];
const NAMES = ["Alex Chen", "Dana Li", "Mina Wong", "Kai Ito", "Jamie Lau", "Noah Tan", "Sara Kim", "Leo Chan", "Yuki Mori", "Ari Patel"];
const PLACES = ["Tokyo", "Osaka", "Central", "Admiralty", "Singapore", "Taipei", "Seoul", "Kowloon", "Kyoto", "Sydney"];
const CURRENCIES = ["USD", "EUR", "HKD", "JPY", "SGD", "GBP", "AUD", "CAD", "CNY", "TWD"];

function localeFor(index: number): Locale {
  return LOCALES[index % LOCALES.length];
}

function alphaKey(index: number) {
  let n = index + 1;
  let result = "";
  while (n > 0) {
    n -= 1;
    result = String.fromCharCode(97 + (n % 26)) + result;
    n = Math.floor(n / 26);
  }
  return result.padStart(3, "a");
}

function id(family: AsymptaKernelExtremeFamily, index: number) {
  return `kernel-extreme-v3:${family}:${String(index + 1).padStart(4, "0")}`;
}

function decorate(index: number, core: string) {
  const prefixes = ["uh ", "hey, ", "voice note: ", "sorry typo, ", "quick one — ", "pls ", "can u ", "FYI, ", "actually, ", "ok so "];
  const suffixes = ["", " thanks", " pls", " — cheers", " (voice input)", " / mobile", " ...", " ok?", " asap-ish", ` ref ${alphaKey(index)}`];
  const prefix = prefixes[index % prefixes.length];
  const suffix = suffixes[Math.floor(index / prefixes.length) % suffixes.length];
  return `${prefix}${core}${suffix}`;
}

function scenario(
  family: AsymptaKernelExtremeFamily,
  index: number,
  input: Omit<AsymptaKernelExtremeScenario, "id" | "family" | "locale">,
): AsymptaKernelExtremeScenario {
  return { id: id(family, index), family, locale: localeFor(index), ...input };
}

function generate500(
  family: AsymptaKernelExtremeFamily,
  builder: (index: number) => Omit<AsymptaKernelExtremeScenario, "id" | "family" | "locale">,
) {
  return Array.from({ length: 500 }, (_, index) => scenario(family, index, builder(index)));
}

function typoAliasScenarios() {
  const aliases = [
    ["recipent", "recipient"], ["destnation", "destination"], ["orign", "origin"], ["budegt", "budget"], ["particpants", "participants"],
    ["contcat email", "contact"], ["delivry address", "delivery_location"], ["deadlne", "deadline"], ["traveler coutn", "participants"], ["passprt details", "identity"],
  ] as const;
  return generate500("obvious_typo_alias", (index) => {
    const [field, semantic] = aliases[index % aliases.length];
    return {
      intent: decorate(index, `need ${field}`), domain: DOMAINS[index % DOMAINS.length], actionFamily: "coordinate", missingFields: [field],
      expectation: { kind: "canonical_semantic", field, semantic },
      rationale: `An obvious one-edit user typo in “${field}” should map to ${semantic} instead of creating a new accidental semantic slot.`,
    };
  });
}

function codeSwitchAliasScenarios() {
  const aliases = [
    ["recipient 收件人", "recipient"], ["目的地 destination", "destination"], ["origin 出發地", "origin"], ["budget 預算", "budget"], ["参加者 participants", "participants"],
    ["contact 聯絡電郵", "contact"], ["delivery address 送貨地址", "delivery_location"], ["deadline 締切", "deadline"], ["passport 身分", "identity"], ["time 時間", "time"],
  ] as const;
  return generate500("code_switch_alias", (index) => {
    const [field, semantic] = aliases[index % aliases.length];
    return {
      intent: decorate(index, `field ${field}`), domain: DOMAINS[(index + 3) % DOMAINS.length], actionFamily: "coordinate", missingFields: [field],
      expectation: { kind: "canonical_semantic", field, semantic },
      rationale: `Mixed-language UI or speech input “${field}” should preserve one canonical semantic identity.`,
    };
  });
}

function impossibleDateScenarios() {
  const dates = ["2026-02-30", "2027-02-29", "31 April 2027", "31 June 2028", "2026-13-10", "2026-00-18", "2026-09-31", "32/01/2027", "00/12/2026", "February 31, 2027"];
  return generate500("impossible_date", (index) => ({
    intent: decorate(index, `Date is ${dates[index % dates.length]}.`), domain: DOMAINS[index % DOMAINS.length], actionFamily: "schedule", missingFields: ["date"],
    expectation: { kind: "unresolved", field: "date" },
    rationale: "A calendar-impossible date must not become a resolved executable fact merely because its surface form looks date-like.",
  }));
}

function impossibleTimeScenarios() {
  const times = ["25:00", "24:61", "19:99", "-1:30", "99:99", "12:75", "27:15", "8:90", "00:88", "61:00"];
  return generate500("impossible_time", (index) => ({
    intent: decorate(index, `Time is ${times[index % times.length]}.`), domain: DOMAINS[(index + 5) % DOMAINS.length], actionFamily: "schedule", missingFields: ["time"],
    expectation: { kind: "unresolved", field: "time" },
    rationale: "An impossible wall-clock time must remain unresolved instead of silently entering execution state.",
  }));
}

function ambiguousDateScenarios() {
  const dates = ["03/04/2027", "04/05/2027", "05/06/2028", "06/07/2028", "07/08/2029", "08/09/2029", "09/10/2030", "10/11/2030", "11/12/2031", "01/02/2031"];
  return generate500("ambiguous_date", (index) => ({
    intent: decorate(index, `Date is ${dates[index % dates.length]}.`), domain: DOMAINS[(index + 8) % DOMAINS.length], actionFamily: "schedule", missingFields: ["date"],
    expectation: { kind: "unresolved", field: "date" },
    rationale: "A slash date whose month/day order is ambiguous should not be treated as an unambiguous confirmed date without locale-safe clarification.",
  }));
}

function malformedContactScenarios() {
  const values = ["alex@@example.com", "alex.example.com", "john..doe@example.com", ".alex@example.com", "alex@example", "alex@-example.com", "@example.com", "alex@", "not-an-email", "alex example dot com"];
  return generate500("malformed_contact", (index) => ({
    intent: decorate(index, `Contact is ${values[index % values.length]}.`), domain: DOMAINS[(index + 2) % DOMAINS.length], actionFamily: "coordinate", missingFields: ["contact"],
    expectation: { kind: "unresolved", field: "contact" },
    rationale: "Malformed contact data should be rejected or clarified, never promoted to a trusted explicit contact fact.",
  }));
}

function malformedIdentityScenarios() {
  const values = ["???", "N/A", "none", "unknown", "000", "12", "-", "xxxxx", "[redacted]", "not sure"];
  return generate500("malformed_identity", (index) => ({
    intent: decorate(index, `Passport number is ${values[index % values.length]}.`), domain: index % 2 ? "travel" : "government", actionFamily: "apply", missingFields: ["identity"],
    expectation: { kind: "unresolved", field: "identity" },
    rationale: "Placeholder, missing, or obviously invalid identity material must not satisfy an identity requirement.",
  }));
}

function negativeZeroQuantityScenarios() {
  const quantities = ["-1", "-2", "-5", "0", "-10", "-99", "-3", "-7", "0", "-100"];
  const units = ["items", "tickets", "bottles", "chairs", "rooms", "parcels", "meals", "books", "phones", "bags"];
  return generate500("negative_zero_quantity", (index) => ({
    intent: decorate(index, `Quantity is ${quantities[index % quantities.length]} ${units[(index * 3) % units.length]}.`), domain: DOMAINS[index % DOMAINS.length], actionFamily: "purchase", missingFields: ["quantity"],
    expectation: { kind: "unresolved", field: "quantity" },
    rationale: "Zero or negative requested counts must not become a valid resolved purchase/booking quantity.",
  }));
}

function fractionalDiscreteQuantityScenarios() {
  const quantities = ["0.5", "1.2", "2.5", "3.7", "4.4", "5.5", "7.25", "8.8", "9.1", "10.01"];
  const units = ["tickets", "people", "rooms", "passports", "cars", "chairs", "phones", "books", "parcels", "appointments"];
  return generate500("fractional_discrete_quantity", (index) => ({
    intent: decorate(index, `Quantity is ${quantities[index % quantities.length]} ${units[(index + 4) % units.length]}.`), domain: DOMAINS[(index + 6) % DOMAINS.length], actionFamily: "purchase", missingFields: ["quantity"],
    expectation: { kind: "unresolved", field: "quantity" },
    rationale: "Fractional values for clearly discrete real-world objects or participants require correction instead of silent coercion.",
  }));
}

function malformedMoneyScenarios() {
  const money = ["USD -50", "USD 1O0", "HKD NaN", "EUR --20", "JPY -1", "SGD 1,2,3", "GBP .", "AUD ++90", "CAD infinity", "CNY -0.01"];
  return generate500("malformed_money", (index) => ({
    intent: decorate(index, `Budget is ${money[index % money.length]}.`), domain: DOMAINS[(index + 10) % DOMAINS.length], actionFamily: "purchase", missingFields: ["budget"],
    expectation: { kind: "unresolved", field: "budget" },
    rationale: "Malformed, negative, non-numeric, or syntactically corrupt money input must not be normalized into a different valid spend amount.",
  }));
}

function mixedCurrencyConflictScenarios() {
  return generate500("mixed_currency_conflict", (index) => {
    const first = CURRENCIES[index % CURRENCIES.length];
    const second = CURRENCIES[(index + 3) % CURRENCIES.length];
    const a = 100 + (index % 73) * 5;
    const b = 90 + (index % 61) * 7;
    return {
      intent: decorate(index, `Budget is ${first} ${a}. Budget is ${second} ${b}.`), domain: DOMAINS[(index + 11) % DOMAINS.length], actionFamily: "purchase", missingFields: ["budget", "currency"],
      expectation: { kind: "unresolved", field: "budget" },
      rationale: "Two incompatible budgets/currencies in the same turn without an explicit correction marker should surface a conflict, not silently pick one.",
    };
  });
}

function ambiguousCurrencySymbolScenarios() {
  const symbols = ["$", "¥", "$", "¥", "$", "$", "¥", "$", "¥", "$"];
  return generate500("ambiguous_currency_symbol", (index) => ({
    intent: decorate(index, `Budget is ${symbols[index % symbols.length]}${100 + (index % 400)}.`), domain: DOMAINS[(index + 12) % DOMAINS.length], actionFamily: "purchase", missingFields: ["currency"],
    expectation: { kind: "unresolved", field: "currency" },
    rationale: "A globally ambiguous currency symbol without regional context must not be silently asserted as one currency identity.",
  }));
}

function unitSlotMismatchScenarios() {
  const variants = [
    ["budget", "Budget is 500 kg."], ["participants", "Participants are 3 liters."], ["quantity", "Quantity is USD 200."], ["time", "Time is 18 kilograms."], ["deadline", "Deadline is 4 people."],
    ["currency", "Currency is 8 meters."], ["recipient", "Recipient is 25 kg."], ["contact", "Contact is 19:30."], ["origin", "Origin is USD 400."], ["destination", "Destination is 6 participants."],
  ] as const;
  return generate500("unit_slot_mismatch", (index) => {
    const [field, phrase] = variants[index % variants.length];
    return {
      intent: decorate(index, phrase), domain: DOMAINS[(index + 13) % DOMAINS.length], actionFamily: "coordinate", missingFields: [field],
      expectation: { kind: "unresolved", field },
      rationale: "A value with an incompatible physical/semantic unit must not satisfy the wrong typed requirement merely because it follows the field label.",
    };
  });
}

function contradictoryFactScenarios() {
  const variants = [
    ["destination", "Destination is Tokyo. Destination is Osaka."], ["origin", "Origin is Central. Origin is Kowloon."], ["recipient", "Recipient is Alex Chen. Recipient is Dana Li."],
    ["time", "Time is 18:00. Time is 20:30."], ["date", "Date is 2026-09-18. Date is 2026-09-19."], ["participants", "Participants are 2. Participants are 7."],
    ["budget", "Budget is USD 500. Budget is USD 900."], ["contact", "Contact is alex@example.com. Contact is dana@example.com."], ["service", "Service needed is plumbing. Service needed is electrical repair."], ["deadline", "Deadline is Monday. Deadline is Friday."],
  ] as const;
  return generate500("contradictory_fact", (index) => {
    const [field, phrase] = variants[index % variants.length];
    return {
      intent: decorate(index, phrase), domain: DOMAINS[(index + 14) % DOMAINS.length], actionFamily: "coordinate", missingFields: [field],
      expectation: { kind: "unresolved", field },
      rationale: "Two conflicting assertions with equal authority and no correction/revision signal should become conflicted or unresolved instead of silently selecting the last string.",
    };
  });
}

function uncertainFactScenarios() {
  const variants = [
    ["destination", "Destination might be Tokyo, not sure."], ["origin", "Origin is maybe Central? I don't remember."], ["recipient", "Recipient could be Alex or Dana."], ["time", "Time is around 8-ish, maybe."], ["date", "Date might be next Friday, I think."],
    ["participants", "Probably 4 participants, but not confirmed."], ["budget", "Budget maybe USD 500? not decided."], ["contact", "Contact might be alex@example.com but I'm unsure."], ["service", "Maybe plumbing, maybe electrical."], ["deadline", "Deadline could be Monday or Tuesday."],
  ] as const;
  return generate500("uncertain_fact", (index) => {
    const [field, phrase] = variants[index % variants.length];
    return {
      intent: decorate(index, phrase), domain: DOMAINS[(index + 15) % DOMAINS.length], actionFamily: "coordinate", missingFields: [field],
      expectation: { kind: "unresolved", field },
      rationale: "Explicit linguistic uncertainty is not the same thing as a confirmed explicit fact and should not satisfy execution readiness.",
    };
  });
}

function negatedFactScenarios() {
  const variants = [
    ["recipient", "Recipient is not Alex Chen."], ["destination", "Destination is not Tokyo."], ["origin", "Origin is not Central."], ["time", "Time is not 19:30."], ["date", "Date is not 2026-09-18."],
    ["budget", "Budget is not USD 500."], ["participants", "Participants are not 4."], ["contact", "Contact is not alex@example.com."], ["service", "Service is not plumbing."], ["deadline", "Deadline is not Friday."],
  ] as const;
  return generate500("negated_fact", (index) => {
    const [field, phrase] = variants[index % variants.length];
    return {
      intent: decorate(index, phrase), domain: DOMAINS[(index + 16) % DOMAINS.length], actionFamily: "coordinate", missingFields: [field],
      expectation: { kind: "unresolved", field },
      rationale: "A negated value only tells the kernel what is false; it must not bind the negated token as the positive requirement value.",
    };
  });
}

function revokedCommitmentScenarios() {
  const variants = [
    "Book the hotel. Actually no — do not book anything.", "Reserve the table. Changed my mind; do not reserve it.", "Place the order. Wait, don't order anything.", "Submit the application. Sorry, do not submit it.", "Publish the announcement. No, don't publish it.",
    "Schedule the appointment. Cancel that request; do not schedule it.", "Accept the quote. Actually do not accept or commit to it.", "Hire the contractor. Stop — do not hire anyone.", "Place the bid. Never mind, do not bid.", "Subscribe to the plan. No, do not subscribe.",
  ];
  return generate500("revoked_commitment", (index) => ({
    intent: decorate(index, variants[index % variants.length]), domain: DOMAINS[(index + 17) % DOMAINS.length], actionFamily: "coordinate", missingFields: [],
    expectation: { kind: "no_consequential_authority" },
    rationale: "A later explicit revocation in the same user turn should remove authority for the earlier external commitment instead of leaving the first verb active.",
  }));
}

function revokedPaymentScenarios() {
  const variants = [
    "Transfer USD 500 to Dana. Actually don't transfer any money.", "Pay the invoice now. No — do not pay it.", "Refund USD 80. Wait, do not issue the refund.", "Debit my account for HKD 300. Stop, do not debit anything.", "Wire EUR 200 to Alex. Never mind, don't wire funds.",
    "Charge the card SGD 50. Actually do not charge it.", "Withdraw HKD 400. Cancel that; do not withdraw.", "Remit JPY 9000. No, do not remit anything.", "Send a payment of USD 20. Wait, don't send payment.", "Authorize the debit. I revoke that — do not debit.",
  ];
  return generate500("revoked_payment", (index) => ({
    intent: decorate(index, variants[index % variants.length]), domain: "finance", actionFamily: "transfer", missingFields: [],
    expectation: { kind: "no_consequential_authority" },
    rationale: "A final same-turn cancellation of money movement must dominate an earlier payment verb and eliminate execution authority.",
  }));
}

function noisyCompoundBindingScenarios() {
  const separators = ["; ", " / ", " ... ", ", ", " — ", " | ", "\n", "  ", ". ", "；"];
  return generate500("noisy_compound_binding", (index) => {
    const name = NAMES[index % NAMES.length];
    const destination = PLACES[(index + 2) % PLACES.length];
    const participants = 1 + (index % 8);
    const hour = String(8 + (index % 12)).padStart(2, "0");
    const minute = ["00", "15", "30", "45"][index % 4];
    const sep = separators[index % separators.length];
    const labels = index % 3 === 0
      ? [`recipient ${name}`, `目的地 ${destination}`, `participants ${participants}`, `時間 ${hour}:${minute}`]
      : index % 3 === 1
        ? [`收件人是 ${name}`, `destination ${destination}`, `参加者 ${participants}`, `time ${hour}:${minute}`]
        : [`Recipient: ${name}`, `目的地は ${destination}`, `參與人數 ${participants}`, `Time: ${hour}:${minute}`];
    return {
      intent: `voice input ${labels.join(sep)} ${alphaKey(index)}`, domain: DOMAINS[(index + 18) % DOMAINS.length], actionFamily: "coordinate", missingFields: ["recipient", "destination", "participants", "time"],
      expectation: { kind: "compound_explicit", fields: ["recipient", "destination", "participants", "time"] },
      rationale: "Obvious compound facts should survive speech-style punctuation, code-switching, line breaks, and filler without leaking between semantic slots.",
    };
  });
}

function absurdFeasibilityScenarios() {
  const absurd = [
    "Deliver an 800kg piano to Mars in ten minutes for HKD 5.", "Book a hotel room inside the Sun for tonight.", "Send 100000 pizzas to one apartment in sixty seconds.", "Schedule a meeting yesterday at 25:90.", "Buy a square-circle table and deliver it before I finish this sentence.",
    "Ship a refrigerator to the Moon by 5pm today for USD 1.", "Reserve one seat for 2.5 people on a sold-out imaginary flight.", "Arrange a taxi from Tokyo to New York in five minutes for JPY 10.", "Order negative three laptops and make the total cost negative USD 500.", "Deliver a house through a mailbox before noon.",
  ];
  return generate500("absurd_feasibility_truthfulness", (index) => {
    const novelField = `feasibility_evidence_${alphaKey(index)}`;
    return {
      intent: decorate(index, `${absurd[index % absurd.length]} Recipient is ${NAMES[index % NAMES.length]}.`), domain: DOMAINS[(index + 19) % DOMAINS.length], actionFamily: "coordinate", missingFields: ["recipient", novelField],
      expectation: { kind: "truthful_absurd", novelField },
      rationale: "An absurd or physically implausible request may be parsed, but the kernel must not fabricate feasibility evidence or claim completion merely to preserve liveness.",
    };
  });
}

export function generateKernelExtremeRealWorldScenarios(): AsymptaKernelExtremeScenario[] {
  return [
    ...typoAliasScenarios(), ...codeSwitchAliasScenarios(), ...impossibleDateScenarios(), ...impossibleTimeScenarios(), ...ambiguousDateScenarios(),
    ...malformedContactScenarios(), ...malformedIdentityScenarios(), ...negativeZeroQuantityScenarios(), ...fractionalDiscreteQuantityScenarios(), ...malformedMoneyScenarios(),
    ...mixedCurrencyConflictScenarios(), ...ambiguousCurrencySymbolScenarios(), ...unitSlotMismatchScenarios(), ...contradictoryFactScenarios(), ...uncertainFactScenarios(),
    ...negatedFactScenarios(), ...revokedCommitmentScenarios(), ...revokedPaymentScenarios(), ...noisyCompoundBindingScenarios(), ...absurdFeasibilityScenarios(),
  ];
}

type Projection = {
  facts?: Array<{ semantic: string; status?: string; source?: string; value?: string | number | boolean }>;
};

function isSatisfied(status: string | undefined) {
  return ["resolved", "confirmed", "not_applicable"].includes(status ?? "");
}

function makeTask(scenario: AsymptaKernelExtremeScenario) {
  return createCoreAsymptaTask({
    taskId: scenario.id,
    rootIntent: scenario.intent,
    locale: scenario.locale,
    domain: scenario.domain,
    actionFamily: scenario.actionFamily,
    mode: "simulated",
    risk: "low",
    missingFields: scenario.missingFields,
  });
}

function findRequirement(task: ReturnType<typeof createCoreAsymptaTask>, field: string) {
  const semantic = requirementSemantic(field);
  return task.requirements.find((requirement) => requirementSemantic(requirement.semantic) === semantic || requirementSemantic(requirement.key) === semantic);
}

function evaluateScenario(scenario: AsymptaKernelExtremeScenario): AsymptaKernelExtremeOutcome {
  const expectation = scenario.expectation;

  if (expectation.kind === "canonical_semantic") {
    const observed = requirementSemantic(expectation.field);
    return { id: scenario.id, family: scenario.family, passed: observed === expectation.semantic, rationale: scenario.rationale, observed: `semantic=${observed}` };
  }

  if (expectation.kind === "no_consequential_authority") {
    const requiresApproval = taskRequiresApproval({ actionFamily: scenario.actionFamily, intent: scenario.intent, risk: "low" });
    return { id: scenario.id, family: scenario.family, passed: requiresApproval === false, rationale: scenario.rationale, observed: `requiresApproval=${requiresApproval}` };
  }

  const task = makeTask(scenario);
  const projection = task as unknown as Projection;

  if (expectation.kind === "unresolved") {
    const requirement = findRequirement(task, expectation.field);
    const semantic = requirementSemantic(expectation.field);
    const fact = projection.facts?.find((candidate) => candidate.semantic === semantic && candidate.status !== "conflicted");
    const passed = Boolean(requirement && !isSatisfied(requirement.status) && !fact);
    return {
      id: scenario.id, family: scenario.family, passed, rationale: scenario.rationale,
      observed: requirement ? `semantic=${semantic}, status=${requirement.status}, value=${String(requirement.value ?? "none")}, fact=${fact ? String(fact.value) : "none"}` : `semantic=${semantic}, no requirement`,
    };
  }

  if (expectation.kind === "compound_explicit") {
    const details = expectation.fields.map((field) => {
      const semantic = requirementSemantic(field);
      const requirement = findRequirement(task, field);
      const ok = Boolean(requirement && requirement.status === "resolved" && requirement.provenance?.source === "explicit");
      return { semantic, ok, status: requirement?.status ?? "missing", source: requirement?.provenance?.source ?? "none" };
    });
    return {
      id: scenario.id, family: scenario.family, passed: details.every((detail) => detail.ok), rationale: scenario.rationale,
      observed: details.map((detail) => `${detail.semantic}:${detail.status}:${detail.source}`).join(" | "),
    };
  }

  const novel = task.requirements.find((requirement) => requirement.key.includes(expectation.novelField) || requirement.raw.includes(expectation.novelField));
  const passed = task.result?.completed !== true && Boolean(novel && !isSatisfied(novel.status));
  return {
    id: scenario.id, family: scenario.family, passed, rationale: scenario.rationale,
    observed: `phase=${task.phase}, completed=${task.result?.completed ?? false}, novel=${novel?.status ?? "missing"}`,
  };
}

export function runKernelExtremeRealWorldBenchmark(): AsymptaKernelExtremeReport {
  const scenarios = generateKernelExtremeRealWorldScenarios();
  const outcomes = scenarios.map(evaluateScenario);
  const byFamily = Object.fromEntries(EXTREME_REALWORLD_FAMILIES.map((family) => {
    const familyOutcomes = outcomes.filter((outcome) => outcome.family === family);
    const passed = familyOutcomes.filter((outcome) => outcome.passed).length;
    return [family, { total: familyOutcomes.length, passed, failed: familyOutcomes.length - passed }];
  })) as AsymptaKernelExtremeReport["byFamily"];
  const passed = outcomes.filter((outcome) => outcome.passed).length;
  return {
    version: "asympta.kernel-extreme-realworld/0.3",
    total: outcomes.length,
    passed,
    failed: outcomes.length - passed,
    passRate: outcomes.length ? passed / outcomes.length : 0,
    byFamily,
    failures: outcomes.filter((outcome) => !outcome.passed),
  };
}
