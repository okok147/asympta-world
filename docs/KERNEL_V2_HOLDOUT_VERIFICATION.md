# Canonical Semantic Kernel v2 — Holdout Verification

Date: 2026-09-02

## Result

The fresh independent semantic holdout improved from **230 / 1,000** on the pre-v2 kernel to **1,000 / 1,000** after the structural v2 changes.

The frozen previous adversarial regression suite remains **1,000 / 1,000**.

This means the two independent adversarial suites currently cover **2,000 / 2,000** passing kernel cases. It is a regression/generalization checkpoint, not a mathematical proof of correctness for every possible task.

## Fresh holdout v2

| Family | Pass |
| --- | ---: |
| multi_fact_binding | 100 / 100 |
| alias_canonicalization | 100 / 100 |
| contradiction_resolution | 100 / 100 |
| cross_semantic_isolation | 100 / 100 |
| effect_escalation | 100 / 100 |
| negated_action_scope | 100 / 100 |
| data_classification | 100 / 100 |
| canonical_fact_registry | 100 / 100 |
| effect_state_projection | 100 / 100 |
| compound_truthfulness | 100 / 100 |

Total: **1,000 / 1,000**.

Baseline before v2: **230 / 1,000**.

## Frozen adversarial regression suite

All ten existing families remain **100 / 100**:

- explicit_fact_binding
- numeric_disambiguation
- currency_integrity
- sensitive_metadata
- write_approval_coverage
- domain_contract_coverage
- blocked_requirement_safety
- benchmark_false_pass
- positive_approval_control
- positive_explicit_control

Total: **1,000 / 1,000**.

## Structural kernel changes

### CanonicalFact registry

Resolved semantic facts now project into a typed fact registry carrying semantic identity, typed value, source/provenance, confidence, DataClass, sensitivity, status, and timestamp. Human-confirmed facts remain protected from lower-authority overwrites.

### One canonical semantic layer

Requirement aliases and explicit-value binding now share the same semantic canonicalizer instead of maintaining divergent field-name interpretations in contracts and the core task implementation.

### DataClass

The kernel now classifies facts into explicit data classes:

- public
- personal
- sensitive_personal
- identity
- credential
- financial
- health

Sensitivity is derived from this typed classification rather than being only an isolated field-name regex decision.

### EffectClass

The kernel exposes the task's material effect as a typed projection shared by policy and completion logic:

- read
- communicate
- external_commitment
- money_movement
- account_mutation
- shipment
- publication
- deletion
- application
- scheduling

Consequential effects require approval. Effect detection distinguishes active actions from nearby nouns and excludes clearly negated consequential clauses.

### Correction and composition semantics

Compound intents can bind multiple independent explicit facts. When a user explicitly corrects a fact, the latest supported assertion wins. Values from one semantic slot are not allowed to leak into a different missing slot.

### Truthfulness invariant

Unknown required facts remain unresolved. A task cannot fabricate an unknown fact merely to achieve liveness or a completed benchmark state. Blocked required facts also remain unsatisfied.

## Validation gates

Validated before the feature commit was accepted:

- lint: 0 errors; 5 pre-existing React hook warnings
- typecheck: pass
- engine: **238 / 238**
- public intent agent: **14 / 14**
- Task Kernel worker: **9 / 9**
- public-agent frontend / information journey: **15 / 15**
- production build: pass
- rendered HTML: **2 / 2**
- legacy universal benchmark: **5,100 / 5,100**
- fresh holdout v2: **1,000 / 1,000**
- frozen adversarial suite: **1,000 / 1,000**

The existing Vite chunk-size warning remains informational and was not introduced by this kernel change.
