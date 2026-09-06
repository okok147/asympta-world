# Asympta Kernel Recursive Lab — generation 50

Seed: `1788512850`

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
| baseline_success | 1 | 1 | 0 | 0 |
| controlled_no_capability | 53 | 0 | 53 | 0 |
| controlled_human_input | 74 | 0 | 74 | 0 |
| controlled_approval | 58 | 9 | 49 | 0 |
| multilingual_noise | 4 | 4 | 0 | 0 |
| novel_requirement | 49 | 0 | 49 | 0 |
| step_pressure | 71 | 0 | 71 | 0 |
| fallback_route | 5 | 5 | 0 | 0 |
| reordered_requirements | 3 | 3 | 0 | 0 |
| compound_noise | 2 | 2 | 0 | 0 |

## Adaptive weights

Attack curriculum: controlled_no_capability=7.107, controlled_human_input=7.107, controlled_approval=7.107, novel_requirement=7.107, step_pressure=7.107, baseline_success=0.250, multilingual_noise=0.250, fallback_route=0.250, reordered_requirements=0.250, compound_noise=0.250

Repair priority: semantic=0.778, capability=0.778, liveness=0.778, approval=0.778, handoff=0.778, verification=0.778

## Repair contract

The repair loop must optimize **uncontrolled process-integrity failures**, not completion rate. It must not turn a predictable refusal, missing capability, human clarification, approval boundary, bounded timeout, or other controlled terminal failure into invented success.
