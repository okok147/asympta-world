# Asympta Kernel Recursive Lab — generation 42

Seed: `1722726442`

## Process integrity

- Cases: **320**
- Completed: **34**
- Controlled / predictable failures: **286**
- Uncontrolled failures: **0**
- Process integrity rate: **100.00%**
- Deterministic replay rate: **100.00%**
- New uncontrolled fingerprints: **0**

A controlled failure is a valid terminal result. The lab only treats hangs, non-terminal stalls, nondeterminism, false completion, missing failure ownership/reason, or broken verification/handoff as kernel failures.

## Families

| Family | Total | Completed | Controlled failure | Uncontrolled |
| --- | ---: | ---: | ---: | ---: |
| baseline_success | 5 | 5 | 0 | 0 |
| controlled_no_capability | 58 | 0 | 58 | 0 |
| controlled_human_input | 67 | 0 | 67 | 0 |
| controlled_approval | 62 | 14 | 48 | 0 |
| multilingual_noise | 5 | 5 | 0 | 0 |
| novel_requirement | 56 | 0 | 56 | 0 |
| step_pressure | 57 | 0 | 57 | 0 |
| fallback_route | 4 | 4 | 0 | 0 |
| reordered_requirements | 5 | 5 | 0 | 0 |
| compound_noise | 1 | 1 | 0 | 0 |

## Adaptive weights

Attack curriculum: controlled_no_capability=5.193, controlled_human_input=5.193, controlled_approval=5.193, novel_requirement=5.193, step_pressure=5.193, baseline_success=0.250, multilingual_noise=0.250, fallback_route=0.250, reordered_requirements=0.250, compound_noise=0.250

Repair priority: semantic=0.810, capability=0.810, liveness=0.810, approval=0.810, handoff=0.810, verification=0.810

## Repair contract

The repair loop must optimize **uncontrolled process-integrity failures**, not completion rate. It must not turn a predictable refusal, missing capability, human clarification, approval boundary, bounded timeout, or other controlled terminal failure into invented success.
