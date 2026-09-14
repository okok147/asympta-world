# Asympta Kernel Recursive Lab — generation 107

Seed: `437158729`

## Process integrity

- Cases: **320**
- Completed: **32**
- Controlled / predictable failures: **288**
- Uncontrolled failures: **0**
- Process integrity rate: **100.00%**
- Deterministic replay rate: **100.00%**
- New uncontrolled fingerprints: **0**

A controlled failure is a valid terminal result. The lab only treats hangs, non-terminal stalls, nondeterminism, false completion, missing failure ownership/reason, or broken verification/handoff as kernel failures.

## Families

| Family | Total | Completed | Controlled failure | Uncontrolled |
| --- | ---: | ---: | ---: | ---: |
| baseline_success | 5 | 5 | 0 | 0 |
| controlled_no_capability | 54 | 0 | 54 | 0 |
| controlled_human_input | 67 | 0 | 67 | 0 |
| controlled_approval | 49 | 14 | 35 | 0 |
| multilingual_noise | 2 | 2 | 0 | 0 |
| novel_requirement | 60 | 0 | 60 | 0 |
| step_pressure | 72 | 0 | 72 | 0 |
| fallback_route | 3 | 3 | 0 | 0 |
| reordered_requirements | 4 | 4 | 0 | 0 |
| compound_noise | 4 | 4 | 0 | 0 |

## Adaptive weights

Attack curriculum: controlled_no_capability=8.000, controlled_human_input=8.000, controlled_approval=8.000, novel_requirement=8.000, step_pressure=8.000, baseline_success=0.250, multilingual_noise=0.250, fallback_route=0.250, reordered_requirements=0.250, compound_noise=0.250

Repair priority: semantic=0.585, capability=0.585, liveness=0.585, approval=0.585, handoff=0.585, verification=0.585

## Repair contract

The repair loop must optimize **uncontrolled process-integrity failures**, not completion rate. It must not turn a predictable refusal, missing capability, human clarification, approval boundary, bounded timeout, or other controlled terminal failure into invented success.
