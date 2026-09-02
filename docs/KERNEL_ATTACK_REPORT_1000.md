# Asympta World — 1,000-Scenario Task Kernel Attack Report

Date: 2026-09-02

## Conclusion

The independent adversarial benchmark found **790 failures out of 1,000 scenarios (79%)** against the current pre-fix Task Kernel baseline.

This does **not** mean the product is 79% broken. The existing functional suite remains green, including the legacy 5,100-case universal benchmark and browser workflows. It means the previous benchmark mostly proved liveness and simulated completion, while this benchmark deliberately tests stricter semantic and safety invariants that a reusable cross-domain kernel needs.

The 790 failures collapse into four common structural kernels rather than hundreds of unrelated case bugs:

1. **Canonical semantic grounding is missing before requirement binding.**
2. **Safety and side-effect policy is still inferred from string/verb patterns instead of typed effects and data classes.**
3. **Requirement satisfaction is not a single kernel invariant; `blocked` can escape the unresolved gate.**
4. **Benchmark truthfulness is weaker than workflow liveness; synthetic defaults can make unknown facts look solved.**

The deepest common kernel is #1. A general Asympta kernel should first turn natural language into typed canonical facts, then bind those facts to typed requirements. It should not make each field parser independently rediscover meaning from raw strings.

---

## Measured baseline

GitHub Actions run against the benchmark branch produced:

| Attack family | Total | Pass | Fail | What it attacks |
| --- | ---: | ---: | ---: | --- |
| explicit_fact_binding | 100 | 0 | 100 | Explicit facts already present in the user's intent are not rebound generically |
| numeric_disambiguation | 100 | 0 | 100 | Time/year/other numbers can be confused with quantity or budget |
| currency_integrity | 100 | 0 | 100 | Non-HKD budget facts can lose their stated currency identity |
| sensitive_metadata | 100 | 10 | 90 | Sensitive identity/contact/security fields are incompletely classified |
| write_approval_coverage | 100 | 0 | 100 | Consequential verbs outside the existing regex can miss approval |
| domain_contract_coverage | 100 | 0 | 100 | Unseen domains fall back to contracts that omit domain-critical semantics |
| blocked_requirement_safety | 100 | 0 | 100 | A blocked required field can stop being counted as unresolved |
| benchmark_false_pass | 100 | 0 | 100 | Policy/world/simulation defaults can fabricate semantic success in benchmark mode |
| positive_approval_control | 100 | 100 | 0 | Existing known approval verbs still work |
| positive_explicit_control | 100 | 100 | 0 | Existing known explicit parsers still work |
| **Total** | **1,000** | **210** | **790** | **21% pass / 79% fail** |

The two positive-control families are intentionally green. This is important: the adversarial harness is not simply declaring everything broken; it can distinguish known working behavior from structural holes.

---

## Kernel 1 — Canonical Semantic Grounding + Typed Requirement Binding

### Evidence

The current core compiles adaptive fields, then calls the explicit parser using each normalized string key. The parser contains explicit branches for a small set such as `budget`, `screen_size`, `brand`, `purpose`, `delivery_location`, `fulfilment`, and `quantity`.

That architecture works for known aliases but degrades across domains:

- `date`, `time`, `recipient`, `origin`, `destination`, `participants`, `deadline`, `contact`, `service`, etc. can already be present in the root intent and still remain unresolved.
- Semantic aliases can diverge from parser keys.
- A generic numeric regex can bind a year or clock component to the wrong semantic.
- Budget extraction can capture an amount while rewriting its display currency.

### Common root cause

The system currently behaves roughly like:

```text
intent
  -> missing field string
  -> normalize field key
  -> field-specific regex extraction
  -> requirement
```

The reusable kernel should instead behave like:

```text
intent
  -> CanonicalFact[]
  -> semantic canonicalization
  -> typed compatibility / constraint checking
  -> bind facts to Requirement[]
  -> unresolved requirements only
  -> ask human only for genuinely missing facts
```

Recommended canonical fact shape:

```ts
type CanonicalFact = {
  semantic: string;
  valueType: "string" | "number" | "money" | "date" | "time" | "duration" | "location" | "identity" | "boolean";
  value: unknown;
  unit?: string;
  currency?: string;
  sourceSpan?: string;
  provenance: "explicit" | "human_confirmation" | "profile" | "tool" | "world" | "inference";
  confidence: number;
};
```

The binder should match by canonical semantic + compatible type + constraints, not by raw key equality.

### Why this is the deepest kernel

It explains several apparently unrelated failure families at once:

- duplicate clarification,
- alias failures,
- wrong-number capture,
- currency corruption,
- weak domain portability,
- unnecessary human questions.

Fixing individual domains would grow another taxonomy. Fixing the canonical fact boundary makes new domains compositional.

---

## Kernel 2 — Typed Effect and Sensitive-Data Policy

### Evidence

The current approval policy recognizes a bounded list of verbs through regex. The sensitivity classifier also recognizes a bounded string list such as payment/card/account/identity/contact/document/address/medical/symptom.

The attack found systematic holes for actions such as:

- apply,
- refund,
- withdraw,
- renew,
- register,
- enroll,
- schedule,
- dispatch,
- ship,
- accept a binding quote.

It also found incomplete sensitive classification for fields such as passport number, phone number, date of birth, tax/social-security identifiers, biometrics, license identifiers, access codes, and security answers. The 10 passing sensitivity cases were caused by `email address` incidentally matching the word `address`, not by a complete data-class model.

### Kernel fix

Policy should consume typed metadata rather than infer authority from English verbs:

```ts
type EffectClass =
  | "read"
  | "write"
  | "external_commitment"
  | "money_movement"
  | "shipment"
  | "account_mutation"
  | "publication"
  | "deletion";

type DataClass =
  | "public"
  | "personal"
  | "sensitive_personal"
  | "credential"
  | "financial"
  | "health";
```

Every capability/action contract should declare its effect class. Every requirement/fact should declare its data class. Approval, disclosure, persistence, and agent scoping should then be deterministic policy over those types.

Natural-language verb detection can still help classify an intent, but it must not be the final authority boundary.

---

## Kernel 3 — Requirement Satisfaction Must Be a Single Invariant

### Evidence

The Task Kernel requirement type supports:

- `unknown`,
- `resolved`,
- `confirmed`,
- `not_applicable`,
- `blocked`.

But the current unresolved selector only returns required requirements whose status is exactly `unknown`.

Therefore a required requirement changed from `unknown` to `blocked` can disappear from the unresolved set even though it is not satisfied. The attack then observes progression into coordination/assignment rather than preserving a safe gate.

The core also treats `blocked` and `failed` as legacy dead-end phases and redirects transitions toward `coordinating`, which makes the distinction even easier to erase.

### Kernel fix

Define one authoritative predicate and use it everywhere:

```ts
function requirementIsSatisfied(requirement: Requirement): boolean {
  return requirement.status === "resolved"
    || requirement.status === "confirmed"
    || requirement.status === "not_applicable";
}
```

Then:

```ts
const unsatisfied = task.requirements.filter(
  (requirement) => requirement.required && !requirementIsSatisfied(requirement),
);
```

Planning, assignment, execution, verification, completion, UI readiness, and recovery should all consume the same predicate. `blocked` must never mean satisfied.

---

## Kernel 4 — Benchmark Truthfulness Must Be Independent of Simulation Liveness

### Evidence

The previous universal benchmark can resolve unknown required fields using capability/world discovery, policy defaults, or simulation defaults, then verify that a value exists and complete the task.

That is useful for testing liveness: unknown fields do not stall the simulator.

It is not sufficient for testing semantic correctness: an unknown fact can be invented and then treated as if the task truly knew it.

This explains how these can both be true at the same time:

- legacy universal benchmark: **5,100 / 5,100 completed**, and
- independent kernel attack: **790 / 1,000 semantic/safety failures**.

There is no contradiction; they test different properties.

### Kernel fix

Every benchmark scenario should define not only an expected terminal state, but also allowed fact provenance:

```ts
type BenchmarkExpectation = {
  terminal: "completed" | "awaiting_human" | "awaiting_approval" | "blocked";
  requiredFacts: Array<{
    semantic: string;
    allowedSources: Array<"explicit" | "profile" | "tool" | "world" | "human_confirmation">;
  }>;
  forbiddenSyntheticFacts?: string[];
};
```

A correct benchmark result may be `awaiting_human`. Correctly refusing to invent a missing consequential fact is a pass, not a failure.

---

## Domain contract finding

The requirement-contract registry is currently strongest for a small set of known areas such as property purchase, TV/electronics, cinema/events, and generic purchase. Many unrelated domains fall back to a generic purpose/deadline-style contract.

The attack explicitly probes travel, hotel, restaurant, healthcare, employment, government, finance, logistics, home services, and calendar coordination. All 100 domain-contract cases failed their expected semantic coverage.

The long-term solution should not be one huge hand-written contract per noun. Build contracts compositionally from semantic capabilities, for example:

```text
flight booking
= route(origin, destination)
+ schedule(departure_date, optional return_date)
+ traveler(identity)
+ spend(budget, currency)
+ commitment(approval)

money transfer
= recipient
+ money(amount, currency)
+ account
+ commitment(approval)
```

This lets unseen domains reuse semantic primitives instead of requiring bespoke branches.

---

## Fix order

### P0 — Canonical Fact Layer

Introduce `CanonicalFact` extraction/canonicalization before requirements. Preserve value type, unit/currency, provenance, confidence, and source span.

### P0 — Single Satisfaction Invariant

Make every gate use `requirementIsSatisfied`; treat `blocked` as unsatisfied everywhere.

### P0 — Typed Effect/Data Classification

Move approval/sensitivity from final regex authority to typed action effects and requirement data classes.

### P1 — Typed Number/Money/Time Parser

Disambiguate quantities, years, dates, clock times, duration, and money before binding. Preserve currency as part of the value, not display text.

### P1 — Composable Semantic Contracts

Replace sparse domain fallback behavior with reusable semantic contract components.

### P1 — Independent Benchmark Oracle

Require expected terminal state + allowed provenance. Never reward invented required facts as semantic completion.

---

## Regression policy added by this benchmark

The test suite records the current measured failure counts as **ceilings**, not permanent expected failures.

That means:

- fixing a kernel and reducing failures keeps CI green,
- a new regression that increases failures above the measured baseline turns CI red,
- positive-control families must remain at zero failures.

Current total failure ceiling: **790 / 1,000**.

The goal is now straightforward: reduce the same fixed benchmark toward **0 structural failures** without losing the existing functional/browser test suite.

---

## Validation from the same CI run

The calibrated benchmark branch passed the existing product checks alongside the new attack suite:

- engine tests: **237 / 237 passed**,
- legacy universal benchmark: **5,100 / 5,100 completed**,
- browser universal benchmark: **600 / 600 passed**,
- Buy-some-food browser flow: passed through verified completion and celebration,
- build/render/export/hydration checks: passed.

This makes the 1,000-case attack useful as a new semantic/safety layer rather than a replacement for the existing liveness and product checks.
