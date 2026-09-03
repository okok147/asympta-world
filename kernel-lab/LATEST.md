# Asympta Kernel Recursive Lab — generation 9

Seed: `1505648372`

## Process integrity

- Cases: **320**
- Completed: **120**
- Controlled / predictable failures: **200**
- Uncontrolled failures: **0**
- Process integrity rate: **100.00%**
- Deterministic replay rate: **100.00%**
- New uncontrolled fingerprints: **0**

A controlled failure is a valid terminal result. The lab only treats hangs, non-terminal stalls, nondeterminism, false completion, missing failure ownership/reason, or broken verification/handoff as kernel failures.

## Families

| Family | Total | Completed | Controlled failure | Uncontrolled |
| --- | ---: | ---: | ---: | ---: |
| baseline_success | 25 | 25 | 0 | 0 |
| controlled_no_capability | 42 | 0 | 42 | 0 |
| controlled_human_input | 48 | 0 | 48 | 0 |
| controlled_approval | 38 | 14 | 24 | 0 |
| multilingual_noise | 23 | 23 | 0 | 0 |
| novel_requirement | 47 | 0 | 47 | 0 |
| step_pressure | 39 | 0 | 39 | 0 |
| fallback_route | 25 | 25 | 0 | 0 |
| reordered_requirements | 16 | 16 | 0 | 0 |
| compound_noise | 17 | 17 | 0 | 0 |

## Adaptive weights

Attack curriculum: controlled_no_capability=1.423, controlled_human_input=1.423, controlled_approval=1.423, novel_requirement=1.423, step_pressure=1.423, baseline_success=0.693, multilingual_noise=0.693, fallback_route=0.693, reordered_requirements=0.693, compound_noise=0.693

Repair priority: semantic=0.956, capability=0.956, liveness=0.956, approval=0.956, handoff=0.956, verification=0.956

## Repair contract

The repair loop must optimize **uncontrolled process-integrity failures**, not completion rate. It must not turn a predictable refusal, missing capability, human clarification, approval boundary, bounded timeout, or other controlled terminal failure into invented success.
