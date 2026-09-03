# Asympta Kernel Recursive Lab — generation 27

Seed: `1546809322`

## Process integrity

- Cases: **320**
- Completed: **52**
- Controlled / predictable failures: **268**
- Uncontrolled failures: **0**
- Process integrity rate: **100.00%**
- Deterministic replay rate: **100.00%**
- New uncontrolled fingerprints: **0**

A controlled failure is a valid terminal result. The lab only treats hangs, non-terminal stalls, nondeterminism, false completion, missing failure ownership/reason, or broken verification/handoff as kernel failures.

## Families

| Family | Total | Completed | Controlled failure | Uncontrolled |
| --- | ---: | ---: | ---: | ---: |
| baseline_success | 6 | 6 | 0 | 0 |
| controlled_no_capability | 60 | 0 | 60 | 0 |
| controlled_human_input | 49 | 0 | 49 | 0 |
| controlled_approval | 74 | 20 | 54 | 0 |
| multilingual_noise | 7 | 7 | 0 | 0 |
| novel_requirement | 54 | 0 | 54 | 0 |
| step_pressure | 51 | 0 | 51 | 0 |
| fallback_route | 6 | 6 | 0 | 0 |
| reordered_requirements | 7 | 7 | 0 | 0 |
| compound_noise | 6 | 6 | 0 | 0 |

## Adaptive weights

Attack curriculum: controlled_no_capability=2.883, controlled_human_input=2.883, controlled_approval=2.883, novel_requirement=2.883, step_pressure=2.883, baseline_success=0.332, multilingual_noise=0.332, fallback_route=0.332, reordered_requirements=0.332, compound_noise=0.332

Repair priority: semantic=0.873, capability=0.873, liveness=0.873, approval=0.873, handoff=0.873, verification=0.873

## Repair contract

The repair loop must optimize **uncontrolled process-integrity failures**, not completion rate. It must not turn a predictable refusal, missing capability, human clarification, approval boundary, bounded timeout, or other controlled terminal failure into invented success.
