# Asympta Kernel Recursive Lab — generation 49

Seed: `1783453671`

## Process integrity

- Cases: **320**
- Completed: **27**
- Controlled / predictable failures: **293**
- Uncontrolled failures: **0**
- Process integrity rate: **100.00%**
- Deterministic replay rate: **100.00%**
- New uncontrolled fingerprints: **0**

A controlled failure is a valid terminal result. The lab only treats hangs, non-terminal stalls, nondeterminism, false completion, missing failure ownership/reason, or broken verification/handoff as kernel failures.

## Families

| Family | Total | Completed | Controlled failure | Uncontrolled |
| --- | ---: | ---: | ---: | ---: |
| baseline_success | 4 | 4 | 0 | 0 |
| controlled_no_capability | 61 | 0 | 61 | 0 |
| controlled_human_input | 69 | 0 | 69 | 0 |
| controlled_approval | 53 | 11 | 42 | 0 |
| multilingual_noise | 2 | 2 | 0 | 0 |
| novel_requirement | 58 | 0 | 58 | 0 |
| step_pressure | 63 | 0 | 63 | 0 |
| fallback_route | 3 | 3 | 0 | 0 |
| reordered_requirements | 3 | 3 | 0 | 0 |
| compound_noise | 4 | 4 | 0 | 0 |

## Adaptive weights

Attack curriculum: controlled_no_capability=6.833, controlled_human_input=6.833, controlled_approval=6.833, novel_requirement=6.833, step_pressure=6.833, baseline_success=0.250, multilingual_noise=0.250, fallback_route=0.250, reordered_requirements=0.250, compound_noise=0.250

Repair priority: semantic=0.782, capability=0.782, liveness=0.782, approval=0.782, handoff=0.782, verification=0.782

## Repair contract

The repair loop must optimize **uncontrolled process-integrity failures**, not completion rate. It must not turn a predictable refusal, missing capability, human clarification, approval boundary, bounded timeout, or other controlled terminal failure into invented success.
