# Asympta Kernel Recursive Lab — generation 15

Seed: `1538725416`

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
| baseline_success | 14 | 14 | 0 | 0 |
| controlled_no_capability | 44 | 0 | 44 | 0 |
| controlled_human_input | 44 | 0 | 44 | 0 |
| controlled_approval | 39 | 10 | 29 | 0 |
| multilingual_noise | 20 | 20 | 0 | 0 |
| novel_requirement | 47 | 0 | 47 | 0 |
| step_pressure | 59 | 0 | 59 | 0 |
| fallback_route | 19 | 19 | 0 | 0 |
| reordered_requirements | 19 | 19 | 0 | 0 |
| compound_noise | 15 | 15 | 0 | 0 |

## Adaptive weights

Attack curriculum: controlled_no_capability=1.801, controlled_human_input=1.801, controlled_approval=1.801, novel_requirement=1.801, step_pressure=1.801, baseline_success=0.542, multilingual_noise=0.542, fallback_route=0.542, reordered_requirements=0.542, compound_noise=0.542

Repair priority: semantic=0.928, capability=0.928, liveness=0.928, approval=0.928, handoff=0.928, verification=0.928

## Repair contract

The repair loop must optimize **uncontrolled process-integrity failures**, not completion rate. It must not turn a predictable refusal, missing capability, human clarification, approval boundary, bounded timeout, or other controlled terminal failure into invented success.
