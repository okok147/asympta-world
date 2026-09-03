# Asympta Kernel Recursive Lab — generation 20

Seed: `1540911375`

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
| baseline_success | 15 | 15 | 0 | 0 |
| controlled_no_capability | 45 | 0 | 45 | 0 |
| controlled_human_input | 44 | 0 | 44 | 0 |
| controlled_approval | 47 | 7 | 40 | 0 |
| multilingual_noise | 14 | 14 | 0 | 0 |
| novel_requirement | 68 | 0 | 68 | 0 |
| step_pressure | 55 | 0 | 55 | 0 |
| fallback_route | 10 | 10 | 0 | 0 |
| reordered_requirements | 10 | 10 | 0 | 0 |
| compound_noise | 12 | 12 | 0 | 0 |

## Adaptive weights

Attack curriculum: controlled_no_capability=2.191, controlled_human_input=2.191, controlled_approval=2.191, novel_requirement=2.191, step_pressure=2.191, baseline_success=0.442, multilingual_noise=0.442, fallback_route=0.442, reordered_requirements=0.442, compound_noise=0.442

Repair priority: semantic=0.905, capability=0.905, liveness=0.905, approval=0.905, handoff=0.905, verification=0.905

## Repair contract

The repair loop must optimize **uncontrolled process-integrity failures**, not completion rate. It must not turn a predictable refusal, missing capability, human clarification, approval boundary, bounded timeout, or other controlled terminal failure into invented success.
