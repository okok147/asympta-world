# Asympta Kernel Recursive Lab — generation 40

Seed: `1715840370`

## Process integrity

- Cases: **320**
- Completed: **34**
- Controlled / predictable failures: **286**
- Uncontrolled failures: **0**
- Process integrity rate: **100.00%**
- Deterministic replay rate: **100.00%**
- New uncontrolled fingerprints: **0**

A controlled failure is a valid terminal result. The lab only treats hangs, non-terminal stalls, nondeterminism, false completion, missing failure ownership/reason, or broken verification/handoff as kernel failures.

## Families

| Family | Total | Completed | Controlled failure | Uncontrolled |
| --- | ---: | ---: | ---: | ---: |
| baseline_success | 2 | 2 | 0 | 0 |
| controlled_no_capability | 57 | 0 | 57 | 0 |
| controlled_human_input | 73 | 0 | 73 | 0 |
| controlled_approval | 57 | 13 | 44 | 0 |
| multilingual_noise | 4 | 4 | 0 | 0 |
| novel_requirement | 53 | 0 | 53 | 0 |
| step_pressure | 59 | 0 | 59 | 0 |
| fallback_route | 5 | 5 | 0 | 0 |
| reordered_requirements | 5 | 5 | 0 | 0 |
| compound_noise | 5 | 5 | 0 | 0 |

## Adaptive weights

Attack curriculum: controlled_no_capability=4.801, controlled_human_input=4.801, controlled_approval=4.801, novel_requirement=4.801, step_pressure=4.801, baseline_success=0.250, multilingual_noise=0.250, fallback_route=0.250, reordered_requirements=0.250, compound_noise=0.250

Repair priority: semantic=0.818, capability=0.818, liveness=0.818, approval=0.818, handoff=0.818, verification=0.818

## Repair contract

The repair loop must optimize **uncontrolled process-integrity failures**, not completion rate. It must not turn a predictable refusal, missing capability, human clarification, approval boundary, bounded timeout, or other controlled terminal failure into invented success.
