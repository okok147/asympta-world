# Asympta Kernel Recursive Lab — generation 57

Seed: `1847050106`

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
| baseline_success | 2 | 2 | 0 | 0 |
| controlled_no_capability | 63 | 0 | 63 | 0 |
| controlled_human_input | 62 | 0 | 62 | 0 |
| controlled_approval | 70 | 13 | 57 | 0 |
| multilingual_noise | 1 | 1 | 0 | 0 |
| novel_requirement | 58 | 0 | 58 | 0 |
| step_pressure | 57 | 0 | 57 | 0 |
| fallback_route | 4 | 4 | 0 | 0 |
| reordered_requirements | 1 | 1 | 0 | 0 |
| compound_noise | 2 | 2 | 0 | 0 |

## Adaptive weights

Attack curriculum: controlled_no_capability=8.000, controlled_human_input=8.000, controlled_approval=8.000, novel_requirement=8.000, step_pressure=8.000, baseline_success=0.250, multilingual_noise=0.250, fallback_route=0.250, reordered_requirements=0.250, compound_noise=0.250

Repair priority: semantic=0.751, capability=0.751, liveness=0.751, approval=0.751, handoff=0.751, verification=0.751

## Repair contract

The repair loop must optimize **uncontrolled process-integrity failures**, not completion rate. It must not turn a predictable refusal, missing capability, human clarification, approval boundary, bounded timeout, or other controlled terminal failure into invented success.
