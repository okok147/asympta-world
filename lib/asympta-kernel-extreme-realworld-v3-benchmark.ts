import { createAsymptaTask as createCoreAsymptaTask } from "./asympta-task-kernel-core-impl.ts";
import { requirementSemantic } from "./asympta-requirement-contracts.ts";
import { taskRequiresApproval } from "./asympta-task-policy.ts";

export const EXTREME_REALWORLD_V3_FAMILIES = [
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

export type ExtremeRealWorldV3Family = (typeof EXTREME_REALWORLD_V3_FAMILIES)[number];
type Locale = "en" | "zh-Hant" | "ja";

type Expectation =
  | { kind: "canonical"; field: string; semantic: string }
  | { kind: "unresolved"; field: string }
  | { kind: "no_authority" }
  | { kind: "compound"; fields: string[] }
  | { kind: "truthful_absurd"; novelField: string };

export type ExtremeRealWorldV3Scenario = {
  id: string;
  family: ExtremeRealWorldV3Family;
  locale: Locale;
  intent: string;
  domain: string;
  actionFamily: string;
  missingFields: string[];
  expectation: Expectation;
  rationale: string;
};

export type ExtremeRealWorldV3Outcome = {
  id: string;
  family: ExtremeRealWorldV3Family;
  passed: boolean;
  rationale: string;
  observed: string;
};

export type ExtremeRealWorldV3Report = {
  version: "asympta.kernel-extreme-realworld/0.3";
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  byFamily: Record<ExtremeRealWorldV3Family, { total: number; passed: number; failed: number }>;
  failures: ExtremeRealWorldV3Outcome[];
};

const LOCALES: Locale[] = ["en", "zh-Hant", "ja"];
const DOMAINS = [
  "retail", "travel", "finance", "calendar", "healthcare", "government", "hospitality", "logistics", "employment", "home-services",
  "education", "events", "insurance", "property", "subscriptions", "communications", "mobility", "food", "professional-services", "general",
];
const NAMES = ["Alex Chen", "Dana Li", "Mina Wong", "Kai Ito", "Jamie Lau", "Noah Tan", "Sara Kim", "Leo Chan", "Yuki Mori", "Ari Patel"];
const PLACES = ["Tokyo", "Osaka", "Central", "Admiralty", "Singapore", "Taipei", "Seoul", "Kowloon", "Kyoto", "Sydney"];
const CURRENCIES = ["USD", "EUR", "HKD", "JPY", "SGD", "GBP", "AUD", "CAD", "CNY", "TWD"];
const PREFIXES = ["uh ", "hey, ", "voice note: ", "sorry typo, ", "quick one — ", "pls ", "can u ", "FYI, ", "actually, ", "ok so "];
const SUFFIXES = ["", " thanks", " pls", " — cheers", " (voice input)", " / mobile", " ...", " ok?", " asap-ish", " thx"];

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

function uniqueIntent(family: ExtremeRealWorldV3Family, index: number, core: string) {
  const prefix = PREFIXES[index % PREFIXES.length];
  const suffix = SUFFIXES[Math.floor(index / PREFIXES.length) % SUFFIXES.length];
  return `voice-${family}-${alphaKey(index)}: ${prefix}${core}${suffix}`;
}

function make500(
  family: ExtremeRealWorldV3Family,
  builder: (index: number) => Omit<ExtremeRealWorldV3Scenario, "id" | "family" | "locale" | "intent"> & { core: string },
) {
  return Array.from({ length: 500 }, (_, index) => {
    const built = builder(index);
    const { core, ...rest } = built;
    return {
      id: `kernel-extreme-v3:${family}:${String(index + 1).padStart(4, "0")}`,
      family,
      locale: LOCALES[index % LOCALES.length],
      intent: uniqueIntent(family, index, core),
      ...rest,
    } satisfies ExtremeRealWorldV3Scenario;
  });
}

function aliasFamily(family: ExtremeRealWorldV3Family, aliases: readonly (readonly [string, string])[]) {
  return make500(family, (index) => {
    const [field, semantic] = aliases[index % aliases.length];
    return {
      core: `field is ${field}.`,
      domain: DOMAINS[index % DOMAINS.length], actionFamily: "coordinate", missingFields: [field],
      expectation: { kind: "canonical", field, semantic },
      rationale: `The user-facing field “${field}” should resolve to canonical semantic “${semantic}”.`,
    };
  });
}

function unresolvedFamily(
  family: ExtremeRealWorldV3Family,
  variants: readonly (readonly [string, string])[],
  actionFamily = "coordinate",
) {
  return make500(family, (index) => {
    const [field, core] = variants[index % variants.length];
    return {
      core,
      domain: DOMAINS[(index + EXTREME_REALWORLD_V3_FAMILIES.indexOf(family)) % DOMAINS.length],
      actionFamily,
      missingFields: [field],
      expectation: { kind: "unresolved", field },
      rationale: `Malformed, ambiguous, negated, uncertain, contradictory, or type-incompatible ${field} input must remain unresolved rather than becoming an executable fact.`,
    };
  });
}

function obviousTypoAliasScenarios() {
  return aliasFamily("obvious_typo_alias", [
    ["recipent", "recipient"], ["destnation", "destination"], ["orign", "origin"], ["budegt", "budget"], ["particpants", "participants"],
    ["contcat email", "contact"], ["delivry address", "delivery_location"], ["deadlne", "deadline"], ["traveler coutn", "participants"], ["passprt details", "identity"],
  ]);
}

function codeSwitchAliasScenarios() {
  return aliasFamily("code_switch_alias", [
    ["recipient 收件人", "recipient"], ["目的地 destination", "destination"], ["origin 出發地", "origin"], ["budget 預算", "budget"], ["参加者 participants", "participants"],
    ["contact 聯絡電郵", "contact"], ["delivery address 送貨地址", "delivery_location"], ["deadline 締切", "deadline"], ["passport 身分", "identity"], ["time 時間", "time"],
  ]);
}

function impossibleDateScenarios() {
  const values = ["2026-02-30", "2027-02-29", "31 April 2027", "31 June 2028", "2026-13-10", "2026-00-18", "2026-09-31", "32/01/2027", "00/12/2026", "February 31, 2027"];
  return unresolvedFamily("impossible_date", values.map((value) => ["date", `Date is ${value}.`] as const), "schedule");
}

function impossibleTimeScenarios() {
  const values = ["25:00", "24:61", "19:99", "-1:30", "99:99", "12:75", "27:15", "8:90", "00:88", "61:00"];
  return unresolvedFamily("impossible_time", values.map((value) => ["time", `Time is ${value}.`] as const), "schedule");
}

function ambiguousDateScenarios() {
  const values = ["03/04/2027", "04/05/2027", "05/06/2028", "06/07/2028", "07/08/2029", "08/09/2029", "09/10/2030", "10/11/2030", "11/12/2031", "01/02/2031"];
  return unresolvedFamily("ambiguous_date", values.map((value) => ["date", `Date is ${value}.`] as const), "schedule");
}

function malformedContactScenarios() {
  const values = ["alex@@example.com", "alex.example.com", "john..doe@example.com", ".alex@example.com", "alex@example", "alex@-example.com", "@example.com", "alex@", "not-an-email", "alex example dot com"];
  return unresolvedFamily("malformed_contact", values.map((value) => ["contact", `Contact is ${value}.`] as const));
}

function malformedIdentityScenarios() {
  const values = ["???", "N/A", "none", "unknown", "000", "12", "-", "xxxxx", "[redacted]", "not sure"];
  return unresolvedFamily("malformed_identity", values.map((value) => ["identity", `Passport number is ${value}.`] as const), "apply");
}

function negativeZeroQuantityScenarios() {
  const values = ["-1 items", "-2 tickets", "-5 bottles", "0 chairs", "-10 rooms", "-99 parcels", "-3 meals", "-7 books", "0 phones", "-100 bags"];
  return unresolvedFamily("negative_zero_quantity", values.map((value) => ["quantity", `Quantity is ${value}.`] as const), "purchase");
}

function fractionalDiscreteQuantityScenarios() {
  const values = ["0.5 tickets", "1.2 people", "2.5 rooms", "3.7 passports", "4.4 cars", "5.5 chairs", "7.25 phones", "8.8 books", "9.1 parcels", "10.01 appointments"];
  return unresolvedFamily("fractional_discrete_quantity", values.map((value) => ["quantity", `Quantity is ${value}.`] as const), "purchase");
}

function malformedMoneyScenarios() {
  const values = ["USD -50", "USD 1O0", "HKD NaN", "EUR --20", "JPY -1", "SGD 1,2,3", "GBP .", "AUD ++90", "CAD infinity", "CNY -0.01"];
  return unresolvedFamily("malformed_money", values.map((value) => ["budget", `Budget is ${value}.`] as const), "purchase");
}

function mixedCurrencyConflictScenarios() {
  return make500("mixed_currency_conflict", (index) => {
    const first = CURRENCIES[index % CURRENCIES.length];
    const second = CURRENCIES[(index + 3) % CURRENCIES.length];
    return {
      core: `Budget is ${first} ${100 + (index % 73) * 5}. Budget is ${second} ${90 + (index % 61) * 7}.`,
      domain: DOMAINS[index % DOMAINS.length], actionFamily: "purchase", missingFields: ["budget", "currency"],
      expectation: { kind: "unresolved", field: "budget" },
      rationale: "Two incompatible same-authority budgets without a correction signal should become conflicted, not silently collapse to the final string.",
    };
  });
}

function ambiguousCurrencySymbolScenarios() {
  const values = ["$100", "¥500", "$250", "¥900", "$42", "$188", "¥1200", "$999", "¥77", "$300"];
  return unresolvedFamily("ambiguous_currency_symbol", values.map((value) => ["currency", `Budget is ${value}.`] as const), "purchase");
}

function unitSlotMismatchScenarios() {
  return unresolvedFamily("unit_slot_mismatch", [
    ["budget", "Budget is 500 kg."], ["participants", "Participants are 3 liters."], ["quantity", "Quantity is USD 200."], ["time", "Time is 18 kilograms."], ["deadline", "Deadline is 4 people."],
    ["currency", "Currency is 8 meters."], ["recipient", "Recipient is 25 kg."], ["contact", "Contact is 19:30."], ["origin", "Origin is USD 400."], ["destination", "Destination is 6 participants."],
  ]);
}

function contradictoryFactScenarios() {
  return unresolvedFamily("contradictory_fact", [
    ["destination", "Destination is Tokyo. Destination is Osaka."], ["origin", "Origin is Central. Origin is Kowloon."], ["recipient", "Recipient is Alex Chen. Recipient is Dana Li."],
    ["time", "Time is 18:00. Time is 20:30."], ["date", "Date is 2026-09-18. Date is 2026-09-19."], ["participants", "Participants are 2. Participants are 7."],
    ["budget", "Budget is USD 500. Budget is USD 900."], ["contact", "Contact is alex@example.com. Contact is dana@example.com."], ["service", "Service needed is plumbing. Service needed is electrical repair."], ["deadline", "Deadline is Monday. Deadline is Friday."],
  ]);
}

function uncertainFactScenarios() {
  return unresolvedFamily("uncertain_fact", [
    ["destination", "Destination might be Tokyo, not sure."], ["origin", "Origin is maybe Central? I don't remember."], ["recipient", "Recipient could be Alex or Dana."], ["time", "Time is around 8-ish, maybe."], ["date", "Date might be next Friday, I think."],
    ["participants", "Probably 4 participants, but not confirmed."], ["budget", "Budget maybe USD 500? not decided."], ["contact", "Contact might be alex@example.com but I'm unsure."], ["service", "Maybe plumbing, maybe electrical."], ["deadline", "Deadline could be Monday or Tuesday."],
  ]);
}

function negatedFactScenarios() {
  return unresolvedFamily("negated_fact", [
    ["recipient", "Recipient is not Alex Chen."], ["destination", "Destination is not Tokyo."], ["origin", "Origin is not Central."], ["time", "Time is not 19:30."], ["date", "Date is not 2026-09-18."],
    ["budget", "Budget is not USD 500."], ["participants", "Participants are not 4."], ["contact", "Contact is not alex@example.com."], ["service", "Service is not plumbing."], ["deadline", "Deadline is not Friday."],
  ]);
}

function revokedCommitmentScenarios() {
  const values = [
    "Book the hotel. Actually no — do not book anything.", "Reserve the table. Changed my mind; do not reserve it.", "Place the order. Wait, don't order anything.", "Submit the application. Sorry, do not submit it.", "Publish the announcement. No, don't publish it.",
    "Schedule the appointment. Cancel that request; do not schedule it.", "Accept the quote. Actually do not accept or commit to it.", "Hire the contractor. Stop — do not hire anyone.", "Place the bid. Never mind, do not bid.", "Subscribe to the plan. No, do not subscribe.",
  ];
  return make500("revoked_commitment", (index) => ({
    core: values[index % values.length], domain: DOMAINS[index % DOMAINS.length], actionFamily: "coordinate", missingFields: [], expectation: { kind: "no_authority" },
    rationale: "A later same-turn explicit revocation should remove authority for an earlier external commitment.",
  }));
}

function revokedPaymentScenarios() {
  const values = [
    "Transfer USD 500 to Dana. Actually don't transfer any money.", "Pay the invoice now. No — do not pay it.", "Refund USD 80. Wait, do not issue the refund.", "Debit my account for HKD 300. Stop, do not debit anything.", "Wire EUR 200 to Alex. Never mind, don't wire funds.",
    "Charge the card SGD 50. Actually do not charge it.", "Withdraw HKD 400. Cancel that; do not withdraw.", "Remit JPY 9000. No, do not remit anything.", "Send a payment of USD 20. Wait, don't send payment.", "Authorize the debit. I revoke that — do not debit.",
  ];
  return make500("revoked_payment", (index) => ({
    core: values[index % values.length], domain: "finance", actionFamily: "transfer", missingFields: [], expectation: { kind: "no_authority" },
    rationale: "A final same-turn cancellation of money movement should dominate the stale positive payment intent.",
  }));
}

function noisyCompoundBindingScenarios() {
  const separators = ["; ", " / ", " ... ", ", ", " — ", " | ", "\n", "  ", ". ", "；"];
  return make500("noisy_compound_binding", (index) => {
    const name = NAMES[index % NAMES.length];
    const destination = PLACES[(index + 2) % PLACES.length];
    const participants = 1 + (index % 8);
    const hour = String(8 + (index % 12)).padStart(2, "0");
    const minute = ["00", "15", "30", "45"][index % 4];
    const sep = separators[index % separators.length];
    const parts = index % 3 === 0
      ? [`recipient ${name}`, `目的地 ${destination}`, `participants ${participants}`, `時間 ${hour}:${minute}`]
      : index % 3 === 1
        ? [`收件人是 ${name}`, `destination ${destination}`, `参加者 ${participants}`, `time ${hour}:${minute}`]
        : [`Recipient: ${name}`, `目的地は ${destination}`, `參與人數 ${participants}`, `Time: ${hour}:${minute}`];
    return {
      core: parts.join(sep), domain: DOMAINS[index % DOMAINS.length], actionFamily: "coordinate", missingFields: ["recipient", "destination", "participants", "time"],
      expectation: { kind: "compound", fields: ["recipient", "destination", "participants", "time"] },
      rationale: "Explicit compound facts should survive speech-like punctuation, filler, code switching, and line breaks without leaking between slots.",
    };
  });
}

function absurdFeasibilityScenarios() {
  const values = [
    "Deliver an 800kg piano to Mars in ten minutes for HKD 5.", "Book a hotel room inside the Sun for tonight.", "Send 100000 pizzas to one apartment in sixty seconds.", "Schedule a meeting yesterday at 25:90.", "Buy a square-circle table and deliver it before I finish this sentence.",
    "Ship a refrigerator to the Moon by 5pm today for USD 1.", "Reserve one seat for 2.5 people on a sold-out imaginary flight.", "Arrange a taxi from Tokyo to New York in five minutes for JPY 10.", "Order negative three laptops and make the total cost negative USD 500.", "Deliver a house through a mailbox before noon.",
  ];
  return make500("absurd_feasibility_truthfulness", (index) => {
    const novelField = `feasibility_evidence_${alphaKey(index)}`;
    return {
      core: `${values[index % values.length]} Recipient is ${NAMES[index % NAMES.length]}.`, domain: DOMAINS[index % DOMAINS.length], actionFamily: "coordinate", missingFields: ["recipient", novelField],
      expectation: { kind: "truthful_absurd", novelField },
      rationale: "An absurd request may be parsed, but the kernel must not fabricate feasibility evidence or a completed result merely to preserve liveness.",
    };
  });
}

export function generateKernelExtremeRealWorldV3Scenarios(): ExtremeRealWorldV3Scenario[] {
  return [
    ...obviousTypoAliasScenarios(), ...codeSwitchAliasScenarios(), ...impossibleDateScenarios(), ...impossibleTimeScenarios(), ...ambiguousDateScenarios(),
    ...malformedContactScenarios(), ...malformedIdentityScenarios(), ...negativeZeroQuantityScenarios(), ...fractionalDiscreteQuantityScenarios(), ...malformedMoneyScenarios(),
    ...mixedCurrencyConflictScenarios(), ...ambiguousCurrencySymbolScenarios(), ...unitSlotMismatchScenarios(), ...contradictoryFactScenarios(), ...uncertainFactScenarios(),
    ...negatedFactScenarios(), ...revokedCommitmentScenarios(), ...revokedPaymentScenarios(), ...noisyCompoundBindingScenarios(), ...absurdFeasibilityScenarios(),
  ];
}

type Projection = { facts?: Array<{ semantic: string; status?: string; source?: string; value?: string | number | boolean }> };

function satisfied(status: string | undefined) {
  return ["resolved", "confirmed", "not_applicable"].includes(status ?? "");
}

function createTask(scenario: ExtremeRealWorldV3Scenario) {
  return createCoreAsymptaTask({
    taskId: scenario.id, rootIntent: scenario.intent, locale: scenario.locale, domain: scenario.domain, actionFamily: scenario.actionFamily,
    mode: "simulated", risk: "low", missingFields: scenario.missingFields,
  });
}

function findRequirement(task: ReturnType<typeof createCoreAsymptaTask>, field: string) {
  const semantic = requirementSemantic(field);
  return task.requirements.find((requirement) => requirementSemantic(requirement.semantic) === semantic || requirementSemantic(requirement.key) === semantic);
}

function evaluate(scenario: ExtremeRealWorldV3Scenario): ExtremeRealWorldV3Outcome {
  const expected = scenario.expectation;
  if (expected.kind === "canonical") {
    const observed = requirementSemantic(expected.field);
    return { id: scenario.id, family: scenario.family, passed: observed === expected.semantic, rationale: scenario.rationale, observed: `semantic=${observed}` };
  }
  if (expected.kind === "no_authority") {
    const approval = taskRequiresApproval({ actionFamily: scenario.actionFamily, intent: scenario.intent, risk: "low" });
    return { id: scenario.id, family: scenario.family, passed: !approval, rationale: scenario.rationale, observed: `requiresApproval=${approval}` };
  }

  const task = createTask(scenario);
  const projection = task as unknown as Projection;

  if (expected.kind === "unresolved") {
    const semantic = requirementSemantic(expected.field);
    const requirement = findRequirement(task, expected.field);
    const fact = projection.facts?.find((candidate) => candidate.semantic === semantic && candidate.status !== "conflicted");
    const passed = Boolean(requirement && !satisfied(requirement.status) && !fact);
    return {
      id: scenario.id, family: scenario.family, passed, rationale: scenario.rationale,
      observed: requirement ? `semantic=${semantic}, status=${requirement.status}, value=${String(requirement.value ?? "none")}, fact=${fact ? String(fact.value) : "none"}` : `semantic=${semantic}, no requirement`,
    };
  }

  if (expected.kind === "compound") {
    const details = expected.fields.map((field) => {
      const semantic = requirementSemantic(field);
      const requirement = findRequirement(task, field);
      return { semantic, ok: Boolean(requirement && requirement.status === "resolved" && requirement.provenance?.source === "explicit"), status: requirement?.status ?? "missing", source: requirement?.provenance?.source ?? "none" };
    });
    return { id: scenario.id, family: scenario.family, passed: details.every((detail) => detail.ok), rationale: scenario.rationale, observed: details.map((detail) => `${detail.semantic}:${detail.status}:${detail.source}`).join(" | ") };
  }

  const novel = task.requirements.find((requirement) => requirement.key.includes(expected.novelField) || requirement.raw.includes(expected.novelField));
  const passed = task.result?.completed !== true && Boolean(novel && !satisfied(novel.status));
  return { id: scenario.id, family: scenario.family, passed, rationale: scenario.rationale, observed: `phase=${task.phase}, completed=${task.result?.completed ?? false}, novel=${novel?.status ?? "missing"}` };
}

export function runKernelExtremeRealWorldV3Benchmark(): ExtremeRealWorldV3Report {
  const outcomes = generateKernelExtremeRealWorldV3Scenarios().map(evaluate);
  const byFamily = Object.fromEntries(EXTREME_REALWORLD_V3_FAMILIES.map((family) => {
    const familyOutcomes = outcomes.filter((outcome) => outcome.family === family);
    const passed = familyOutcomes.filter((outcome) => outcome.passed).length;
    return [family, { total: familyOutcomes.length, passed, failed: familyOutcomes.length - passed }];
  })) as ExtremeRealWorldV3Report["byFamily"];
  const passed = outcomes.filter((outcome) => outcome.passed).length;
  return { version: "asympta.kernel-extreme-realworld/0.3", total: outcomes.length, passed, failed: outcomes.length - passed, passRate: outcomes.length ? passed / outcomes.length : 0, byFamily, failures: outcomes.filter((outcome) => !outcome.passed) };
}
