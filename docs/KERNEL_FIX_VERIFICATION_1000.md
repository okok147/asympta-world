# Task Kernel fix verification — 1,000 adversarial scenarios

Date: 2026-09-02

Structural fix commit: `1027f431bc91b872261570da18d81fbd0d68b0eb`

## Result

The same independent adversarial benchmark that previously measured 210/1,000 passing now reports **1,000/1,000 passing, 0 failures** after the structural Task Kernel fixes.

| Family | Pass | Fail |
| --- | ---: | ---: |
| explicit_fact_binding | 100 | 0 |
| numeric_disambiguation | 100 | 0 |
| currency_integrity | 100 | 0 |
| sensitive_metadata | 100 | 0 |
| write_approval_coverage | 100 | 0 |
| domain_contract_coverage | 100 | 0 |
| blocked_requirement_safety | 100 | 0 |
| benchmark_false_pass | 100 | 0 |
| positive_approval_control | 100 | 0 |
| positive_explicit_control | 100 | 0 |

The same pre-push verification also passed all 237 engine tests and the public-agent test suites.

## Structural changes

- Expanded explicit semantic fact binding and typed number/money/time handling so explicit facts are not re-asked or rebound to the wrong semantic.
- Preserved stated currency identity instead of treating a number as an HKD-shaped budget by default.
- Expanded sensitive-data and consequential-write classification coverage.
- Made requirement satisfaction a single invariant: only resolved, confirmed, or not-applicable requirements are satisfied; blocked requirements remain gating.
- Added requirement contracts for travel, hotel, restaurant, healthcare, employment, government, finance, logistics, home services, and calendar coordination.
- Prevented profile-less benchmark tasks from treating an invented generic required fact as semantic success, while retaining profile-backed capability discovery.

This file is also used to trigger the normal main-branch build/render/browser deployment pipeline after the verified fix was pushed by GitHub Actions.