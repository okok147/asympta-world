# Asympta Kernel Recursive Lab — generation 28

Seed: `1555678434`

## Process integrity

- Cases: **320**
- Completed: **48**
- Controlled / predictable failures: **272**
- Uncontrolled failures: **0**
- Process integrity rate: **100.00%**
- Deterministic replay rate: **100.00%**
- New uncontrolled fingerprints: **0**

A controlled failure is a valid terminal result. The lab only treats hangs, non-terminal stalls, nondeterminism, false completion, missing failure ownership/reason, or broken verification/handoff as kernel failures.

## Families

| Family | Total | Completed | Controlled failure | Uncontrolled |
| --- | ---: | ---: | ---: | ---: |
| baseline_success | 7 | 7 | 0 | 0 |
| controlled_no_capability | 54 | 0 | 54 | 0 |
| controlled_human_input | 59 | 0 | 59 | 0 |
| controlled_approval | 58 | 10 | 48 | 0 |
| multilingual_noise | 8 | 8 | 0 | 0 |
| novel_requirement | 63 | 0 | 63 | 0 |
| step_pressure | 48 | 0 | 48 | 0 |
| fallback_route | 9 | 9 | 0 | 0 |
| reordered_requirements | 9 | 9 | 0 | 0 |
| compound_noise | 5 | 5 | 0 | 0 |

## Adaptive weights

Attack curriculum: controlled_no_capability=2.999, controlled_human_input=2.999, controlled_approval=2.999, novel_requirement=2.999, step_pressure=2.999, baseline_success=0.319, multilingual_noise=0.319, fallback_route=0.319, reordered_requirements=0.319, compound_noise=0.319

Repair priority: semantic=0.869, capability=0.869, liveness=0.869, approval=0.869, handoff=0.869, verification=0.869

## Repair contract

The repair loop must optimize **uncontrolled process-integrity failures**, not completion rate. It must not turn a predictable refusal, missing capability, human clarification, approval boundary, bounded timeout, or other controlled terminal failure into invented success.
