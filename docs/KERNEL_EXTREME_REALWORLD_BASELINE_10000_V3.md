# Extreme Real-World Kernel Holdout v3 — 10,000-Case Baseline

Date: 2026-09-02

## Result

The fresh independently generated extreme real-world holdout ran **10,000 unique scenario ids and 10,000 unique input strings** against the unchanged Canonical Semantic Kernel v2.

- Passed: **4,800 / 10,000**
- Failed: **5,200 / 10,000**
- Pass rate: **48%**

The previous two frozen adversarial suites remained fully green:

- frozen adversarial v1: **1,000 / 1,000**
- frozen semantic holdout v2: **1,000 / 1,000**

Therefore the v3 failures expose a new generalization layer rather than a regression in the already-fixed 2,000 cases.

## Family results

| Family | Passed | Failed |
| --- | ---: | ---: |
| obvious_typo_alias | 0 / 500 | 500 |
| code_switch_alias | 500 / 500 | 0 |
| impossible_date | 0 / 500 | 500 |
| impossible_time | 400 / 500 | 100 |
| ambiguous_date | 0 / 500 | 500 |
| malformed_contact | 350 / 500 | 150 |
| malformed_identity | 500 / 500 | 0 |
| negative_zero_quantity | 500 / 500 | 0 |
| fractional_discrete_quantity | 500 / 500 | 0 |
| malformed_money | 400 / 500 | 100 |
| mixed_currency_conflict | 0 / 500 | 500 |
| ambiguous_currency_symbol | 500 / 500 | 0 |
| unit_slot_mismatch | 250 / 500 | 250 |
| contradictory_fact | 50 / 500 | 450 |
| uncertain_fact | 250 / 500 | 250 |
| negated_fact | 100 / 500 | 400 |
| revoked_commitment | 0 / 500 | 500 |
| revoked_payment | 0 / 500 | 500 |
| noisy_compound_binding | 0 / 500 | 500 |
| absurd_feasibility_truthfulness | 500 / 500 | 0 |

Total: **4,800 passed / 5,200 failed**.

## What held strongly

### Truthfulness under absurd requests — 500 / 500

The kernel did not fabricate feasibility evidence or terminal completion for physically absurd or internally impossible requests. Examples include delivering an 800 kg piano to Mars in ten minutes for HKD 5, sending a refrigerator to the Moon for USD 1, a hotel room inside the Sun, negative laptop quantities, or delivery of a house through a mailbox.

This is important because a safe `awaiting_human`, unresolved requirement, or non-completed state is a benchmark pass when the request cannot truthfully execute.

### Identity placeholders — 500 / 500

Obvious placeholder or absent identity values such as `???`, `N/A`, `none`, and `unknown` did not satisfy identity requirements.

### Quantity validity — 1,000 / 1,000

Zero/negative quantities and fractional quantities for discrete real-world objects remained invalid or unresolved.

### Code-switch aliases — 500 / 500

Mixed-language field names such as English plus Traditional Chinese or Japanese preserved a canonical semantic identity in the tested forms.

### Ambiguous currency symbols — 500 / 500

Bare ambiguous symbols such as `$` and `¥` did not get silently asserted as a concrete currency identity in these cases.

## New structural failure clusters

### 1. Typo-tolerant semantic normalization

`obvious_typo_alias` failed **500 / 500**. The canonicalizer is robust to known aliases but not to obvious edit-distance mistakes such as `recipent`, `destnation`, `orign`, `budegt`, `particpants`, or `passprt details`.

Next kernel direction: bounded fuzzy matching against the canonical semantic vocabulary with a confidence / ambiguity threshold, rather than expanding a typo dictionary indefinitely.

### 2. Temporal validity and ambiguity

- impossible_date: **500 failures**
- impossible_time: **100 failures**
- ambiguous_date: **500 failures**

The kernel can recognize many date/time-looking strings but lacks one complete typed temporal validator that distinguishes syntactic shape from calendrical validity and locale-safe interpretation.

Next kernel direction: a typed `TemporalFact` validator that separates parsed, valid, ambiguous, impossible, relative, and unresolved states.

### 3. Typed value validation

- malformed_contact: **150 failures**
- malformed_money: **100 failures**
- unit_slot_mismatch: **250 failures**

Some values bind because they are adjacent to the correct label even though their internal grammar or unit is incompatible.

Next kernel direction: validators keyed by canonical semantic / value type before a fact may transition to resolved.

### 4. Conflict and epistemic state

- mixed_currency_conflict: **500 failures**
- contradictory_fact: **450 failures**
- uncertain_fact: **250 failures**

Kernel v2 has correction semantics, but a new distinction is needed between a true correction and two equal-authority contradictory assertions. It also needs to preserve explicit uncertainty instead of treating every assertion-like phrase as confirmed.

Next kernel direction: represent fact state explicitly as something like `asserted | corrected | conflicted | uncertain | negated | revoked` with authority and evidence history.

### 5. Fact-level negation

`negated_fact` failed **400 / 500**. In many forms, `X is not value` still lets `value` leak into the positive semantic slot.

Next kernel direction: scope-aware negation attached to the fact assertion before value binding.

### 6. Revocation and authority timeline

- revoked_commitment: **500 failures**
- revoked_payment: **500 failures**

A later user instruction such as `Actually no — do not book anything` or `don't transfer any money` does not yet reliably invalidate authority created by an earlier verb in the same turn.

Next kernel direction: an ordered authority/effect timeline where a later explicit revocation dominates stale same-turn authorization.

### 7. Noisy multilingual compound parsing

`noisy_compound_binding` failed **500 / 500**. Controlled compound binding introduced in v2 does not yet generalize to much noisier speech-like punctuation, line breaks, filler, and code-switched labels in the same utterance.

Next kernel direction: segment intent into candidate fact clauses before semantic binding, then resolve each clause independently while preserving the shared task context.

## Validation gates

The benchmark-only branch changed no Kernel v2 implementation while measuring this baseline.

The CI run also confirmed:

- 10,000 unique scenario ids
- 10,000 unique input strings
- 20 families × 500 cases
- frozen adversarial v1: **1,000 / 1,000**
- frozen holdout v2: **1,000 / 1,000**
- engine tests: **239 / 239**
- public intent agent: **14 / 14**
- Task Kernel worker: **9 / 9**
- public-agent frontend / information journey: **15 / 15**
- production build: pass
- rendered HTML: **2 / 2**
- browser hydration smoke: pass
- `Buy some food` browser delivery / verified completion / clean reset: pass
- universal browser benchmark: **600 / 600**

Lint retains the same five pre-existing React hook warnings and zero errors. The existing Vite chunk-size warning also remains informational.

## Interpretation

A 48% score here does **not** mean Asympta World is 52% broken in normal usage. This holdout is deliberately concentrated on malformed, contradictory, revoked, ambiguous, noisy, and absurd edge conditions. Its purpose is to find the next shared kernel invariants.

The meaningful result is that the earlier 2,000 adversarial cases stayed green while a new unseen distribution exposed 5,200 failures concentrated in a small number of structural classes. Those clusters are now suitable targets for the next kernel leap without tuning the 10,000-case benchmark itself.
