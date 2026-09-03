# Asympta Kernel Recursive Lab — generation 8

Seed: `1486824768`

## Process integrity

- Cases: **320**
- Completed: **118**
- Controlled / predictable failures: **202**
- Uncontrolled failures: **0**
- Process integrity rate: **100.00%**
- Deterministic replay rate: **100.00%**
- New uncontrolled fingerprints: **0**

A controlled failure is a valid terminal result. The lab only treats hangs, non-terminal stalls, nondeterminism, false completion, missing failure ownership/reason, or broken verification/handoff as kernel failures.

## Families

| Family | Total | Completed | Controlled failure | Uncontrolled |
| --- | ---: | ---: | ---: | ---: |
| baseline_success | 19 | 19 | 0 | 0 |
| controlled_no_capability | 35 | 0 | 35 | 0 |
| controlled_human_input | 50 | 0 | 50 | 0 |
| controlled_approval | 43 | 9 | 34 | 0 |
| multilingual_noise | 22 | 22 | 0 | 0 |
| novel_requirement | 43 | 0 | 43 | 0 |
| step_pressure | 40 | 0 | 40 | 0 |
| fallback_route | 21 | 21 | 0 | 0 |
| reordered_requirements | 24 | 24 | 0 | 0 |
| compound_noise | 23 | 23 | 0 | 0 |

## Adaptive weights

Attack curriculum: controlled_no_capability=1.369, controlled_human_input=1.369, controlled_approval=1.369, novel_requirement=1.369, step_pressure=1.369, baseline_success=0.721, multilingual_noise=0.721, fallback_route=0.721, reordered_requirements=0.721, compound_noise=0.721

Repair priority: semantic=0.961, capability=0.961, liveness=0.961, approval=0.961, handoff=0.961, verification=0.961

## Repair contract

The repair loop must optimize **uncontrolled process-integrity failures**, not completion rate. It must not turn a predictable refusal, missing capability, human clarification, approval boundary, bounded timeout, or other controlled terminal failure into invented success.
