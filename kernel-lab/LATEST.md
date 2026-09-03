# Asympta Kernel Recursive Lab — generation 18

Seed: `1540346697`

## Process integrity

- Cases: **320**
- Completed: **72**
- Controlled / predictable failures: **248**
- Uncontrolled failures: **0**
- Process integrity rate: **100.00%**
- Deterministic replay rate: **100.00%**
- New uncontrolled fingerprints: **0**

A controlled failure is a valid terminal result. The lab only treats hangs, non-terminal stalls, nondeterminism, false completion, missing failure ownership/reason, or broken verification/handoff as kernel failures.

## Families

| Family | Total | Completed | Controlled failure | Uncontrolled |
| --- | ---: | ---: | ---: | ---: |
| baseline_success | 13 | 13 | 0 | 0 |
| controlled_no_capability | 48 | 0 | 48 | 0 |
| controlled_human_input | 55 | 0 | 55 | 0 |
| controlled_approval | 55 | 11 | 44 | 0 |
| multilingual_noise | 12 | 12 | 0 | 0 |
| novel_requirement | 44 | 0 | 44 | 0 |
| step_pressure | 57 | 0 | 57 | 0 |
| fallback_route | 12 | 12 | 0 | 0 |
| reordered_requirements | 13 | 13 | 0 | 0 |
| compound_noise | 11 | 11 | 0 | 0 |

## Adaptive weights

Attack curriculum: controlled_no_capability=2.026, controlled_human_input=2.026, controlled_approval=2.026, novel_requirement=2.026, step_pressure=2.026, baseline_success=0.480, multilingual_noise=0.480, fallback_route=0.480, reordered_requirements=0.480, compound_noise=0.480

Repair priority: semantic=0.914, capability=0.914, liveness=0.914, approval=0.914, handoff=0.914, verification=0.914

## Repair contract

The repair loop must optimize **uncontrolled process-integrity failures**, not completion rate. It must not turn a predictable refusal, missing capability, human clarification, approval boundary, bounded timeout, or other controlled terminal failure into invented success.
