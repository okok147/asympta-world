# Asympta Kernel Recursive Lab — generation 47

Seed: `1772292824`

## Process integrity

- Cases: **320**
- Completed: **36**
- Controlled / predictable failures: **284**
- Uncontrolled failures: **0**
- Process integrity rate: **100.00%**
- Deterministic replay rate: **100.00%**
- New uncontrolled fingerprints: **0**

A controlled failure is a valid terminal result. The lab only treats hangs, non-terminal stalls, nondeterminism, false completion, missing failure ownership/reason, or broken verification/handoff as kernel failures.

## Families

| Family | Total | Completed | Controlled failure | Uncontrolled |
| --- | ---: | ---: | ---: | ---: |
| baseline_success | 5 | 5 | 0 | 0 |
| controlled_no_capability | 71 | 0 | 71 | 0 |
| controlled_human_input | 49 | 0 | 49 | 0 |
| controlled_approval | 52 | 14 | 38 | 0 |
| multilingual_noise | 2 | 2 | 0 | 0 |
| novel_requirement | 68 | 0 | 68 | 0 |
| step_pressure | 58 | 0 | 58 | 0 |
| fallback_route | 5 | 5 | 0 | 0 |
| reordered_requirements | 7 | 7 | 0 | 0 |
| compound_noise | 3 | 3 | 0 | 0 |

## Adaptive weights

Attack curriculum: controlled_no_capability=6.318, controlled_human_input=6.318, controlled_approval=6.318, novel_requirement=6.318, step_pressure=6.318, baseline_success=0.250, multilingual_noise=0.250, fallback_route=0.250, reordered_requirements=0.250, compound_noise=0.250

Repair priority: semantic=0.790, capability=0.790, liveness=0.790, approval=0.790, handoff=0.790, verification=0.790

## Repair contract

The repair loop must optimize **uncontrolled process-integrity failures**, not completion rate. It must not turn a predictable refusal, missing capability, human clarification, approval boundary, bounded timeout, or other controlled terminal failure into invented success.
