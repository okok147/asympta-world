# Asympta Kernel Recursive Lab — generation 60

Seed: `1877379270`

## Process integrity

- Cases: **320**
- Completed: **23**
- Controlled / predictable failures: **297**
- Uncontrolled failures: **0**
- Process integrity rate: **100.00%**
- Deterministic replay rate: **100.00%**
- New uncontrolled fingerprints: **0**

A controlled failure is a valid terminal result. The lab only treats hangs, non-terminal stalls, nondeterminism, false completion, missing failure ownership/reason, or broken verification/handoff as kernel failures.

## Families

| Family | Total | Completed | Controlled failure | Uncontrolled |
| --- | ---: | ---: | ---: | ---: |
| baseline_success | 1 | 1 | 0 | 0 |
| controlled_no_capability | 67 | 0 | 67 | 0 |
| controlled_human_input | 63 | 0 | 63 | 0 |
| controlled_approval | 62 | 13 | 49 | 0 |
| multilingual_noise | 2 | 2 | 0 | 0 |
| novel_requirement | 59 | 0 | 59 | 0 |
| step_pressure | 59 | 0 | 59 | 0 |
| fallback_route | 1 | 1 | 0 | 0 |
| reordered_requirements | 3 | 3 | 0 | 0 |
| compound_noise | 3 | 3 | 0 | 0 |

## Adaptive weights

Attack curriculum: controlled_no_capability=8.000, controlled_human_input=8.000, controlled_approval=8.000, novel_requirement=8.000, step_pressure=8.000, baseline_success=0.250, multilingual_noise=0.250, fallback_route=0.250, reordered_requirements=0.250, compound_noise=0.250

Repair priority: semantic=0.740, capability=0.740, liveness=0.740, approval=0.740, handoff=0.740, verification=0.740

## Repair contract

The repair loop must optimize **uncontrolled process-integrity failures**, not completion rate. It must not turn a predictable refusal, missing capability, human clarification, approval boundary, bounded timeout, or other controlled terminal failure into invented success.
