# Asympta Kernel Recursive Lab — generation 16

Seed: `1540271362`

## Process integrity

- Cases: **320**
- Completed: **99**
- Controlled / predictable failures: **221**
- Uncontrolled failures: **0**
- Process integrity rate: **100.00%**
- Deterministic replay rate: **100.00%**
- New uncontrolled fingerprints: **0**

A controlled failure is a valid terminal result. The lab only treats hangs, non-terminal stalls, nondeterminism, false completion, missing failure ownership/reason, or broken verification/handoff as kernel failures.

## Families

| Family | Total | Completed | Controlled failure | Uncontrolled |
| --- | ---: | ---: | ---: | ---: |
| baseline_success | 18 | 18 | 0 | 0 |
| controlled_no_capability | 53 | 0 | 53 | 0 |
| controlled_human_input | 41 | 0 | 41 | 0 |
| controlled_approval | 56 | 18 | 38 | 0 |
| multilingual_noise | 19 | 19 | 0 | 0 |
| novel_requirement | 46 | 0 | 46 | 0 |
| step_pressure | 43 | 0 | 43 | 0 |
| fallback_route | 14 | 14 | 0 | 0 |
| reordered_requirements | 17 | 17 | 0 | 0 |
| compound_noise | 13 | 13 | 0 | 0 |

## Adaptive weights

Attack curriculum: controlled_no_capability=1.873, controlled_human_input=1.873, controlled_approval=1.873, novel_requirement=1.873, step_pressure=1.873, baseline_success=0.520, multilingual_noise=0.520, fallback_route=0.520, reordered_requirements=0.520, compound_noise=0.520

Repair priority: semantic=0.923, capability=0.923, liveness=0.923, approval=0.923, handoff=0.923, verification=0.923

## Repair contract

The repair loop must optimize **uncontrolled process-integrity failures**, not completion rate. It must not turn a predictable refusal, missing capability, human clarification, approval boundary, bounded timeout, or other controlled terminal failure into invented success.
