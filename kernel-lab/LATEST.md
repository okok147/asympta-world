# Asympta Kernel Recursive Lab — generation 24

Seed: `1542116961`

## Process integrity

- Cases: **320**
- Completed: **48**
- Controlled / predictable failures: **272**
- Uncontrolled failures: **0**
- Process integrity rate: **100.00%**
- Deterministic replay rate: **100.00%**
- New uncontrolled fingerprints: **0**

A controlled failure is a valid terminal result. The lab only treats hangs, non-terminal stalls, nondeterminism, false completion, missing failure ownership/reason, or broken verification/handoff as kernel failures.

## Families

| Family | Total | Completed | Controlled failure | Uncontrolled |
| --- | ---: | ---: | ---: | ---: |
| baseline_success | 5 | 5 | 0 | 0 |
| controlled_no_capability | 62 | 0 | 62 | 0 |
| controlled_human_input | 56 | 0 | 56 | 0 |
| controlled_approval | 57 | 14 | 43 | 0 |
| multilingual_noise | 7 | 7 | 0 | 0 |
| novel_requirement | 62 | 0 | 62 | 0 |
| step_pressure | 49 | 0 | 49 | 0 |
| fallback_route | 8 | 8 | 0 | 0 |
| reordered_requirements | 7 | 7 | 0 | 0 |
| compound_noise | 7 | 7 | 0 | 0 |

## Adaptive weights

Attack curriculum: controlled_no_capability=2.563, controlled_human_input=2.563, controlled_approval=2.563, novel_requirement=2.563, step_pressure=2.563, baseline_success=0.375, multilingual_noise=0.375, fallback_route=0.375, reordered_requirements=0.375, compound_noise=0.375

Repair priority: semantic=0.887, capability=0.887, liveness=0.887, approval=0.887, handoff=0.887, verification=0.887

## Repair contract

The repair loop must optimize **uncontrolled process-integrity failures**, not completion rate. It must not turn a predictable refusal, missing capability, human clarification, approval boundary, bounded timeout, or other controlled terminal failure into invented success.
