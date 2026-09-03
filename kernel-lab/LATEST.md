# Asympta Kernel Recursive Lab — generation 17

Seed: `1540316649`

## Process integrity

- Cases: **320**
- Completed: **73**
- Controlled / predictable failures: **247**
- Uncontrolled failures: **0**
- Process integrity rate: **100.00%**
- Deterministic replay rate: **100.00%**
- New uncontrolled fingerprints: **0**

A controlled failure is a valid terminal result. The lab only treats hangs, non-terminal stalls, nondeterminism, false completion, missing failure ownership/reason, or broken verification/handoff as kernel failures.

## Families

| Family | Total | Completed | Controlled failure | Uncontrolled |
| --- | ---: | ---: | ---: | ---: |
| baseline_success | 12 | 12 | 0 | 0 |
| controlled_no_capability | 53 | 0 | 53 | 0 |
| controlled_human_input | 63 | 0 | 63 | 0 |
| controlled_approval | 41 | 9 | 32 | 0 |
| multilingual_noise | 8 | 8 | 0 | 0 |
| novel_requirement | 44 | 0 | 44 | 0 |
| step_pressure | 55 | 0 | 55 | 0 |
| fallback_route | 14 | 14 | 0 | 0 |
| reordered_requirements | 16 | 16 | 0 | 0 |
| compound_noise | 14 | 14 | 0 | 0 |

## Adaptive weights

Attack curriculum: controlled_no_capability=1.948, controlled_human_input=1.948, controlled_approval=1.948, novel_requirement=1.948, step_pressure=1.948, baseline_success=0.500, multilingual_noise=0.500, fallback_route=0.500, reordered_requirements=0.500, compound_noise=0.500

Repair priority: semantic=0.918, capability=0.918, liveness=0.918, approval=0.918, handoff=0.918, verification=0.918

## Repair contract

The repair loop must optimize **uncontrolled process-integrity failures**, not completion rate. It must not turn a predictable refusal, missing capability, human clarification, approval boundary, bounded timeout, or other controlled terminal failure into invented success.
