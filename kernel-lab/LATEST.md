# Asympta Kernel Recursive Lab — generation 225

Seed: `784090226`

## Process integrity

- Cases: **320**
- Completed: **24**
- Controlled / predictable failures: **296**
- Uncontrolled failures: **0**
- Process integrity rate: **100.00%**
- Deterministic replay rate: **100.00%**
- New uncontrolled fingerprints: **0**

A controlled failure is a valid terminal result. The lab only treats hangs, non-terminal stalls, nondeterminism, false completion, missing failure ownership/reason, or broken verification/handoff as kernel failures.

## Families

| Family | Total | Completed | Controlled failure | Uncontrolled |
| --- | ---: | ---: | ---: | ---: |
| baseline_success | 2 | 2 | 0 | 0 |
| controlled_no_capability | 61 | 0 | 61 | 0 |
| controlled_human_input | 57 | 0 | 57 | 0 |
| controlled_approval | 63 | 10 | 53 | 0 |
| multilingual_noise | 2 | 2 | 0 | 0 |
| novel_requirement | 58 | 0 | 58 | 0 |
| step_pressure | 67 | 0 | 67 | 0 |
| fallback_route | 2 | 2 | 0 | 0 |
| reordered_requirements | 5 | 5 | 0 | 0 |
| compound_noise | 3 | 3 | 0 | 0 |

## Adaptive weights

Attack curriculum: controlled_no_capability=8.000, controlled_human_input=8.000, controlled_approval=8.000, novel_requirement=8.000, step_pressure=8.000, baseline_success=0.250, multilingual_noise=0.250, fallback_route=0.250, reordered_requirements=0.250, compound_noise=0.250

Repair priority: semantic=0.324, capability=0.324, liveness=0.324, approval=0.324, handoff=0.324, verification=0.324

## Repair contract

The repair loop must optimize **uncontrolled process-integrity failures**, not completion rate. It must not turn a predictable refusal, missing capability, human clarification, approval boundary, bounded timeout, or other controlled terminal failure into invented success.
