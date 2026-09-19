# Asympta Kernel Recursive Lab — generation 141

Seed: `1100362369`

## Process integrity

- Cases: **320**
- Completed: **28**
- Controlled / predictable failures: **292**
- Uncontrolled failures: **0**
- Process integrity rate: **100.00%**
- Deterministic replay rate: **100.00%**
- New uncontrolled fingerprints: **0**

A controlled failure is a valid terminal result. The lab only treats hangs, non-terminal stalls, nondeterminism, false completion, missing failure ownership/reason, or broken verification/handoff as kernel failures.

## Families

| Family | Total | Completed | Controlled failure | Uncontrolled |
| --- | ---: | ---: | ---: | ---: |
| baseline_success | 2 | 2 | 0 | 0 |
| controlled_no_capability | 75 | 0 | 75 | 0 |
| controlled_human_input | 54 | 0 | 54 | 0 |
| controlled_approval | 63 | 15 | 48 | 0 |
| multilingual_noise | 6 | 6 | 0 | 0 |
| novel_requirement | 50 | 0 | 50 | 0 |
| step_pressure | 65 | 0 | 65 | 0 |
| fallback_route | 2 | 2 | 0 | 0 |
| reordered_requirements | 2 | 2 | 0 | 0 |
| compound_noise | 1 | 1 | 0 | 0 |

## Adaptive weights

Attack curriculum: controlled_no_capability=8.000, controlled_human_input=8.000, controlled_approval=8.000, novel_requirement=8.000, step_pressure=8.000, baseline_success=0.250, multilingual_noise=0.250, fallback_route=0.250, reordered_requirements=0.250, compound_noise=0.250

Repair priority: semantic=0.493, capability=0.493, liveness=0.493, approval=0.493, handoff=0.493, verification=0.493

## Repair contract

The repair loop must optimize **uncontrolled process-integrity failures**, not completion rate. It must not turn a predictable refusal, missing capability, human clarification, approval boundary, bounded timeout, or other controlled terminal failure into invented success.
