# Asympta Kernel Recursive Lab — generation 1

Seed: `1437334468`

## Process integrity

- Cases: **320**
- Completed: **162**
- Controlled / predictable failures: **158**
- Uncontrolled failures: **0**
- Process integrity rate: **100.00%**
- Deterministic replay rate: **100.00%**
- New uncontrolled fingerprints: **0**

A controlled failure is a valid terminal result. The lab only treats hangs, non-terminal stalls, nondeterminism, false completion, missing failure ownership/reason, or broken verification/handoff as kernel failures.

## Families

| Family | Total | Completed | Controlled failure | Uncontrolled |
| --- | ---: | ---: | ---: | ---: |
| baseline_success | 27 | 27 | 0 | 0 |
| controlled_no_capability | 36 | 0 | 36 | 0 |
| controlled_human_input | 35 | 0 | 35 | 0 |
| controlled_approval | 33 | 10 | 23 | 0 |
| multilingual_noise | 36 | 36 | 0 | 0 |
| novel_requirement | 37 | 0 | 37 | 0 |
| step_pressure | 27 | 0 | 27 | 0 |
| fallback_route | 32 | 32 | 0 | 0 |
| reordered_requirements | 30 | 30 | 0 | 0 |
| compound_noise | 27 | 27 | 0 | 0 |

## Adaptive weights

Attack curriculum: controlled_no_capability=1.040, controlled_human_input=1.040, controlled_approval=1.040, novel_requirement=1.040, step_pressure=1.040, baseline_success=0.960, multilingual_noise=0.960, fallback_route=0.960, reordered_requirements=0.960, compound_noise=0.960

Repair priority: semantic=0.995, capability=0.995, liveness=0.995, approval=0.995, handoff=0.995, verification=0.995

## Repair contract

The repair loop must optimize **uncontrolled process-integrity failures**, not completion rate. It must not turn a predictable refusal, missing capability, human clarification, approval boundary, bounded timeout, or other controlled terminal failure into invented success.
