# Asympta Kernel Recursive Lab — generation 29

Seed: `1576377885`

## Process integrity

- Cases: **320**
- Completed: **51**
- Controlled / predictable failures: **269**
- Uncontrolled failures: **0**
- Process integrity rate: **100.00%**
- Deterministic replay rate: **100.00%**
- New uncontrolled fingerprints: **0**

A controlled failure is a valid terminal result. The lab only treats hangs, non-terminal stalls, nondeterminism, false completion, missing failure ownership/reason, or broken verification/handoff as kernel failures.

## Families

| Family | Total | Completed | Controlled failure | Uncontrolled |
| --- | ---: | ---: | ---: | ---: |
| baseline_success | 7 | 7 | 0 | 0 |
| controlled_no_capability | 54 | 0 | 54 | 0 |
| controlled_human_input | 62 | 0 | 62 | 0 |
| controlled_approval | 53 | 11 | 42 | 0 |
| multilingual_noise | 8 | 8 | 0 | 0 |
| novel_requirement | 58 | 0 | 58 | 0 |
| step_pressure | 53 | 0 | 53 | 0 |
| fallback_route | 9 | 9 | 0 | 0 |
| reordered_requirements | 6 | 6 | 0 | 0 |
| compound_noise | 10 | 10 | 0 | 0 |

## Adaptive weights

Attack curriculum: controlled_no_capability=3.119, controlled_human_input=3.119, controlled_approval=3.119, novel_requirement=3.119, step_pressure=3.119, baseline_success=0.306, multilingual_noise=0.306, fallback_route=0.306, reordered_requirements=0.306, compound_noise=0.306

Repair priority: semantic=0.865, capability=0.865, liveness=0.865, approval=0.865, handoff=0.865, verification=0.865

## Repair contract

The repair loop must optimize **uncontrolled process-integrity failures**, not completion rate. It must not turn a predictable refusal, missing capability, human clarification, approval boundary, bounded timeout, or other controlled terminal failure into invented success.
