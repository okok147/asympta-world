# Asympta Kernel Recursive Lab — generation 37

Seed: `1707070015`

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
| baseline_success | 3 | 3 | 0 | 0 |
| controlled_no_capability | 49 | 0 | 49 | 0 |
| controlled_human_input | 70 | 0 | 70 | 0 |
| controlled_approval | 56 | 13 | 43 | 0 |
| multilingual_noise | 3 | 3 | 0 | 0 |
| novel_requirement | 68 | 0 | 68 | 0 |
| step_pressure | 54 | 0 | 54 | 0 |
| fallback_route | 8 | 8 | 0 | 0 |
| reordered_requirements | 4 | 4 | 0 | 0 |
| compound_noise | 5 | 5 | 0 | 0 |

## Adaptive weights

Attack curriculum: controlled_no_capability=4.268, controlled_human_input=4.268, controlled_approval=4.268, novel_requirement=4.268, step_pressure=4.268, baseline_success=0.250, multilingual_noise=0.250, fallback_route=0.250, reordered_requirements=0.250, compound_noise=0.250

Repair priority: semantic=0.831, capability=0.831, liveness=0.831, approval=0.831, handoff=0.831, verification=0.831

## Repair contract

The repair loop must optimize **uncontrolled process-integrity failures**, not completion rate. It must not turn a predictable refusal, missing capability, human clarification, approval boundary, bounded timeout, or other controlled terminal failure into invented success.
