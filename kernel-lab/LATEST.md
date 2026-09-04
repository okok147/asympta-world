# Asympta Kernel Recursive Lab — generation 36

Seed: `1693829508`

## Process integrity

- Cases: **320**
- Completed: **37**
- Controlled / predictable failures: **283**
- Uncontrolled failures: **0**
- Process integrity rate: **100.00%**
- Deterministic replay rate: **100.00%**
- New uncontrolled fingerprints: **0**

A controlled failure is a valid terminal result. The lab only treats hangs, non-terminal stalls, nondeterminism, false completion, missing failure ownership/reason, or broken verification/handoff as kernel failures.

## Families

| Family | Total | Completed | Controlled failure | Uncontrolled |
| --- | ---: | ---: | ---: | ---: |
| baseline_success | 6 | 6 | 0 | 0 |
| controlled_no_capability | 63 | 0 | 63 | 0 |
| controlled_human_input | 64 | 0 | 64 | 0 |
| controlled_approval | 55 | 13 | 42 | 0 |
| multilingual_noise | 4 | 4 | 0 | 0 |
| novel_requirement | 54 | 0 | 54 | 0 |
| step_pressure | 60 | 0 | 60 | 0 |
| fallback_route | 3 | 3 | 0 | 0 |
| reordered_requirements | 8 | 8 | 0 | 0 |
| compound_noise | 3 | 3 | 0 | 0 |

## Adaptive weights

Attack curriculum: controlled_no_capability=4.104, controlled_human_input=4.104, controlled_approval=4.104, novel_requirement=4.104, step_pressure=4.104, baseline_success=0.250, multilingual_noise=0.250, fallback_route=0.250, reordered_requirements=0.250, compound_noise=0.250

Repair priority: semantic=0.835, capability=0.835, liveness=0.835, approval=0.835, handoff=0.835, verification=0.835

## Repair contract

The repair loop must optimize **uncontrolled process-integrity failures**, not completion rate. It must not turn a predictable refusal, missing capability, human clarification, approval boundary, bounded timeout, or other controlled terminal failure into invented success.
