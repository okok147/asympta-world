# Asympta Kernel Recursive Lab — generation 26

Seed: `1542879669`

## Process integrity

- Cases: **320**
- Completed: **54**
- Controlled / predictable failures: **266**
- Uncontrolled failures: **0**
- Process integrity rate: **100.00%**
- Deterministic replay rate: **100.00%**
- New uncontrolled fingerprints: **0**

A controlled failure is a valid terminal result. The lab only treats hangs, non-terminal stalls, nondeterminism, false completion, missing failure ownership/reason, or broken verification/handoff as kernel failures.

## Families

| Family | Total | Completed | Controlled failure | Uncontrolled |
| --- | ---: | ---: | ---: | ---: |
| baseline_success | 9 | 9 | 0 | 0 |
| controlled_no_capability | 63 | 0 | 63 | 0 |
| controlled_human_input | 54 | 0 | 54 | 0 |
| controlled_approval | 55 | 12 | 43 | 0 |
| multilingual_noise | 9 | 9 | 0 | 0 |
| novel_requirement | 56 | 0 | 56 | 0 |
| step_pressure | 50 | 0 | 50 | 0 |
| fallback_route | 11 | 11 | 0 | 0 |
| reordered_requirements | 6 | 6 | 0 | 0 |
| compound_noise | 7 | 7 | 0 | 0 |

## Adaptive weights

Attack curriculum: controlled_no_capability=2.772, controlled_human_input=2.772, controlled_approval=2.772, novel_requirement=2.772, step_pressure=2.772, baseline_success=0.346, multilingual_noise=0.346, fallback_route=0.346, reordered_requirements=0.346, compound_noise=0.346

Repair priority: semantic=0.878, capability=0.878, liveness=0.878, approval=0.878, handoff=0.878, verification=0.878

## Repair contract

The repair loop must optimize **uncontrolled process-integrity failures**, not completion rate. It must not turn a predictable refusal, missing capability, human clarification, approval boundary, bounded timeout, or other controlled terminal failure into invented success.
