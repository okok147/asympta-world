# Asympta Kernel Recursive Lab — generation 31

Seed: `1604839703`

## Process integrity

- Cases: **320**
- Completed: **42**
- Controlled / predictable failures: **278**
- Uncontrolled failures: **0**
- Process integrity rate: **100.00%**
- Deterministic replay rate: **100.00%**
- New uncontrolled fingerprints: **0**

A controlled failure is a valid terminal result. The lab only treats hangs, non-terminal stalls, nondeterminism, false completion, missing failure ownership/reason, or broken verification/handoff as kernel failures.

## Families

| Family | Total | Completed | Controlled failure | Uncontrolled |
| --- | ---: | ---: | ---: | ---: |
| baseline_success | 4 | 4 | 0 | 0 |
| controlled_no_capability | 57 | 0 | 57 | 0 |
| controlled_human_input | 47 | 0 | 47 | 0 |
| controlled_approval | 74 | 13 | 61 | 0 |
| multilingual_noise | 5 | 5 | 0 | 0 |
| novel_requirement | 59 | 0 | 59 | 0 |
| step_pressure | 54 | 0 | 54 | 0 |
| fallback_route | 6 | 6 | 0 | 0 |
| reordered_requirements | 7 | 7 | 0 | 0 |
| compound_noise | 7 | 7 | 0 | 0 |

## Adaptive weights

Attack curriculum: controlled_no_capability=3.373, controlled_human_input=3.373, controlled_approval=3.373, novel_requirement=3.373, step_pressure=3.373, baseline_success=0.282, multilingual_noise=0.282, fallback_route=0.282, reordered_requirements=0.282, compound_noise=0.282

Repair priority: semantic=0.856, capability=0.856, liveness=0.856, approval=0.856, handoff=0.856, verification=0.856

## Repair contract

The repair loop must optimize **uncontrolled process-integrity failures**, not completion rate. It must not turn a predictable refusal, missing capability, human clarification, approval boundary, bounded timeout, or other controlled terminal failure into invented success.
