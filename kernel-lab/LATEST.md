# Asympta Kernel Recursive Lab — generation 23

Seed: `1541788301`

## Process integrity

- Cases: **320**
- Completed: **61**
- Controlled / predictable failures: **259**
- Uncontrolled failures: **0**
- Process integrity rate: **100.00%**
- Deterministic replay rate: **100.00%**
- New uncontrolled fingerprints: **0**

A controlled failure is a valid terminal result. The lab only treats hangs, non-terminal stalls, nondeterminism, false completion, missing failure ownership/reason, or broken verification/handoff as kernel failures.

## Families

| Family | Total | Completed | Controlled failure | Uncontrolled |
| --- | ---: | ---: | ---: | ---: |
| baseline_success | 11 | 11 | 0 | 0 |
| controlled_no_capability | 53 | 0 | 53 | 0 |
| controlled_human_input | 63 | 0 | 63 | 0 |
| controlled_approval | 69 | 15 | 54 | 0 |
| multilingual_noise | 8 | 8 | 0 | 0 |
| novel_requirement | 39 | 0 | 39 | 0 |
| step_pressure | 50 | 0 | 50 | 0 |
| fallback_route | 8 | 8 | 0 | 0 |
| reordered_requirements | 8 | 8 | 0 | 0 |
| compound_noise | 11 | 11 | 0 | 0 |

## Adaptive weights

Attack curriculum: controlled_no_capability=2.465, controlled_human_input=2.465, controlled_approval=2.465, novel_requirement=2.465, step_pressure=2.465, baseline_success=0.391, multilingual_noise=0.391, fallback_route=0.391, reordered_requirements=0.391, compound_noise=0.391

Repair priority: semantic=0.891, capability=0.891, liveness=0.891, approval=0.891, handoff=0.891, verification=0.891

## Repair contract

The repair loop must optimize **uncontrolled process-integrity failures**, not completion rate. It must not turn a predictable refusal, missing capability, human clarification, approval boundary, bounded timeout, or other controlled terminal failure into invented success.
