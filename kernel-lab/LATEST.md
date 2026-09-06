# Asympta Kernel Recursive Lab — generation 51

Seed: `1800233028`

## Process integrity

- Cases: **320**
- Completed: **35**
- Controlled / predictable failures: **285**
- Uncontrolled failures: **0**
- Process integrity rate: **100.00%**
- Deterministic replay rate: **100.00%**
- New uncontrolled fingerprints: **0**

A controlled failure is a valid terminal result. The lab only treats hangs, non-terminal stalls, nondeterminism, false completion, missing failure ownership/reason, or broken verification/handoff as kernel failures.

## Families

| Family | Total | Completed | Controlled failure | Uncontrolled |
| --- | ---: | ---: | ---: | ---: |
| baseline_success | 4 | 4 | 0 | 0 |
| controlled_no_capability | 49 | 0 | 49 | 0 |
| controlled_human_input | 63 | 0 | 63 | 0 |
| controlled_approval | 59 | 13 | 46 | 0 |
| multilingual_noise | 7 | 7 | 0 | 0 |
| novel_requirement | 56 | 0 | 56 | 0 |
| step_pressure | 71 | 0 | 71 | 0 |
| fallback_route | 6 | 6 | 0 | 0 |
| reordered_requirements | 1 | 1 | 0 | 0 |
| compound_noise | 4 | 4 | 0 | 0 |

## Adaptive weights

Attack curriculum: controlled_no_capability=7.391, controlled_human_input=7.391, controlled_approval=7.391, novel_requirement=7.391, step_pressure=7.391, baseline_success=0.250, multilingual_noise=0.250, fallback_route=0.250, reordered_requirements=0.250, compound_noise=0.250

Repair priority: semantic=0.774, capability=0.774, liveness=0.774, approval=0.774, handoff=0.774, verification=0.774

## Repair contract

The repair loop must optimize **uncontrolled process-integrity failures**, not completion rate. It must not turn a predictable refusal, missing capability, human clarification, approval boundary, bounded timeout, or other controlled terminal failure into invented success.
