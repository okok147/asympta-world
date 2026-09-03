# Asympta Kernel Recursive Lab — generation 10

Seed: `1529251479`

## Process integrity

- Cases: **320**
- Completed: **97**
- Controlled / predictable failures: **223**
- Uncontrolled failures: **0**
- Process integrity rate: **100.00%**
- Deterministic replay rate: **100.00%**
- New uncontrolled fingerprints: **0**

A controlled failure is a valid terminal result. The lab only treats hangs, non-terminal stalls, nondeterminism, false completion, missing failure ownership/reason, or broken verification/handoff as kernel failures.

## Families

| Family | Total | Completed | Controlled failure | Uncontrolled |
| --- | ---: | ---: | ---: | ---: |
| baseline_success | 15 | 15 | 0 | 0 |
| controlled_no_capability | 46 | 0 | 46 | 0 |
| controlled_human_input | 39 | 0 | 39 | 0 |
| controlled_approval | 54 | 14 | 40 | 0 |
| multilingual_noise | 16 | 16 | 0 | 0 |
| novel_requirement | 53 | 0 | 53 | 0 |
| step_pressure | 45 | 0 | 45 | 0 |
| fallback_route | 15 | 15 | 0 | 0 |
| reordered_requirements | 16 | 16 | 0 | 0 |
| compound_noise | 21 | 21 | 0 | 0 |

## Adaptive weights

Attack curriculum: controlled_no_capability=1.480, controlled_human_input=1.480, controlled_approval=1.480, novel_requirement=1.480, step_pressure=1.480, baseline_success=0.665, multilingual_noise=0.665, fallback_route=0.665, reordered_requirements=0.665, compound_noise=0.665

Repair priority: semantic=0.951, capability=0.951, liveness=0.951, approval=0.951, handoff=0.951, verification=0.951

## Repair contract

The repair loop must optimize **uncontrolled process-integrity failures**, not completion rate. It must not turn a predictable refusal, missing capability, human clarification, approval boundary, bounded timeout, or other controlled terminal failure into invented success.
