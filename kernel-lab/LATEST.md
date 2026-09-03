# Asympta Kernel Recursive Lab — generation 19

Seed: `1540402653`

## Process integrity

- Cases: **320**
- Completed: **68**
- Controlled / predictable failures: **252**
- Uncontrolled failures: **0**
- Process integrity rate: **100.00%**
- Deterministic replay rate: **100.00%**
- New uncontrolled fingerprints: **0**

A controlled failure is a valid terminal result. The lab only treats hangs, non-terminal stalls, nondeterminism, false completion, missing failure ownership/reason, or broken verification/handoff as kernel failures.

## Families

| Family | Total | Completed | Controlled failure | Uncontrolled |
| --- | ---: | ---: | ---: | ---: |
| baseline_success | 13 | 13 | 0 | 0 |
| controlled_no_capability | 56 | 0 | 56 | 0 |
| controlled_human_input | 53 | 0 | 53 | 0 |
| controlled_approval | 51 | 9 | 42 | 0 |
| multilingual_noise | 11 | 11 | 0 | 0 |
| novel_requirement | 48 | 0 | 48 | 0 |
| step_pressure | 53 | 0 | 53 | 0 |
| fallback_route | 12 | 12 | 0 | 0 |
| reordered_requirements | 10 | 10 | 0 | 0 |
| compound_noise | 13 | 13 | 0 | 0 |

## Adaptive weights

Attack curriculum: controlled_no_capability=2.107, controlled_human_input=2.107, controlled_approval=2.107, novel_requirement=2.107, step_pressure=2.107, baseline_success=0.460, multilingual_noise=0.460, fallback_route=0.460, reordered_requirements=0.460, compound_noise=0.460

Repair priority: semantic=0.909, capability=0.909, liveness=0.909, approval=0.909, handoff=0.909, verification=0.909

## Repair contract

The repair loop must optimize **uncontrolled process-integrity failures**, not completion rate. It must not turn a predictable refusal, missing capability, human clarification, approval boundary, bounded timeout, or other controlled terminal failure into invented success.
