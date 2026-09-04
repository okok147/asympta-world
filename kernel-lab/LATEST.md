# Asympta Kernel Recursive Lab — generation 35

Seed: `1675675666`

## Process integrity

- Cases: **320**
- Completed: **30**
- Controlled / predictable failures: **290**
- Uncontrolled failures: **0**
- Process integrity rate: **100.00%**
- Deterministic replay rate: **100.00%**
- New uncontrolled fingerprints: **0**

A controlled failure is a valid terminal result. The lab only treats hangs, non-terminal stalls, nondeterminism, false completion, missing failure ownership/reason, or broken verification/handoff as kernel failures.

## Families

| Family | Total | Completed | Controlled failure | Uncontrolled |
| --- | ---: | ---: | ---: | ---: |
| baseline_success | 6 | 6 | 0 | 0 |
| controlled_no_capability | 61 | 0 | 61 | 0 |
| controlled_human_input | 63 | 0 | 63 | 0 |
| controlled_approval | 63 | 9 | 54 | 0 |
| multilingual_noise | 5 | 5 | 0 | 0 |
| novel_requirement | 55 | 0 | 55 | 0 |
| step_pressure | 57 | 0 | 57 | 0 |
| fallback_route | 2 | 2 | 0 | 0 |
| reordered_requirements | 5 | 5 | 0 | 0 |
| compound_noise | 3 | 3 | 0 | 0 |

## Adaptive weights

Attack curriculum: controlled_no_capability=3.946, controlled_human_input=3.946, controlled_approval=3.946, novel_requirement=3.946, step_pressure=3.946, baseline_success=0.250, multilingual_noise=0.250, fallback_route=0.250, reordered_requirements=0.250, compound_noise=0.250

Repair priority: semantic=0.839, capability=0.839, liveness=0.839, approval=0.839, handoff=0.839, verification=0.839

## Repair contract

The repair loop must optimize **uncontrolled process-integrity failures**, not completion rate. It must not turn a predictable refusal, missing capability, human clarification, approval boundary, bounded timeout, or other controlled terminal failure into invented success.
