# Asympta Kernel Recursive Lab — generation 80

Seed: `104313381`

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
| baseline_success | 3 | 3 | 0 | 0 |
| controlled_no_capability | 49 | 0 | 49 | 0 |
| controlled_human_input | 67 | 0 | 67 | 0 |
| controlled_approval | 71 | 23 | 48 | 0 |
| multilingual_noise | 5 | 5 | 0 | 0 |
| novel_requirement | 57 | 0 | 57 | 0 |
| step_pressure | 65 | 0 | 65 | 0 |
| fallback_route | 1 | 1 | 0 | 0 |
| reordered_requirements | 1 | 1 | 0 | 0 |
| compound_noise | 1 | 1 | 0 | 0 |

## Adaptive weights

Attack curriculum: controlled_no_capability=8.000, controlled_human_input=8.000, controlled_approval=8.000, novel_requirement=8.000, step_pressure=8.000, baseline_success=0.250, multilingual_noise=0.250, fallback_route=0.250, reordered_requirements=0.250, compound_noise=0.250

Repair priority: semantic=0.670, capability=0.670, liveness=0.670, approval=0.670, handoff=0.670, verification=0.670

## Repair contract

The repair loop must optimize **uncontrolled process-integrity failures**, not completion rate. It must not turn a predictable refusal, missing capability, human clarification, approval boundary, bounded timeout, or other controlled terminal failure into invented success.
