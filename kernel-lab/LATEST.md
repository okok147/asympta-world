# Asympta Kernel Recursive Lab — generation 155

Seed: `1305016007`

## Process integrity

- Cases: **320**
- Completed: **32**
- Controlled / predictable failures: **288**
- Uncontrolled failures: **0**
- Process integrity rate: **100.00%**
- Deterministic replay rate: **100.00%**
- New uncontrolled fingerprints: **0**

A controlled failure is a valid terminal result. The lab only treats hangs, non-terminal stalls, nondeterminism, false completion, missing failure ownership/reason, or broken verification/handoff as kernel failures.

## Families

| Family | Total | Completed | Controlled failure | Uncontrolled |
| --- | ---: | ---: | ---: | ---: |
| baseline_success | 3 | 3 | 0 | 0 |
| controlled_no_capability | 58 | 0 | 58 | 0 |
| controlled_human_input | 59 | 0 | 59 | 0 |
| controlled_approval | 65 | 12 | 53 | 0 |
| multilingual_noise | 4 | 4 | 0 | 0 |
| novel_requirement | 56 | 0 | 56 | 0 |
| step_pressure | 62 | 0 | 62 | 0 |
| fallback_route | 3 | 3 | 0 | 0 |
| reordered_requirements | 6 | 6 | 0 | 0 |
| compound_noise | 4 | 4 | 0 | 0 |

## Adaptive weights

Attack curriculum: controlled_no_capability=8.000, controlled_human_input=8.000, controlled_approval=8.000, novel_requirement=8.000, step_pressure=8.000, baseline_success=0.250, multilingual_noise=0.250, fallback_route=0.250, reordered_requirements=0.250, compound_noise=0.250

Repair priority: semantic=0.460, capability=0.460, liveness=0.460, approval=0.460, handoff=0.460, verification=0.460

## Repair contract

The repair loop must optimize **uncontrolled process-integrity failures**, not completion rate. It must not turn a predictable refusal, missing capability, human clarification, approval boundary, bounded timeout, or other controlled terminal failure into invented success.
