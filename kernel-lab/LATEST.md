# Asympta Kernel Recursive Lab — generation 34

Seed: `1657257821`

## Process integrity

- Cases: **320**
- Completed: **39**
- Controlled / predictable failures: **281**
- Uncontrolled failures: **0**
- Process integrity rate: **100.00%**
- Deterministic replay rate: **100.00%**
- New uncontrolled fingerprints: **0**

A controlled failure is a valid terminal result. The lab only treats hangs, non-terminal stalls, nondeterminism, false completion, missing failure ownership/reason, or broken verification/handoff as kernel failures.

## Families

| Family | Total | Completed | Controlled failure | Uncontrolled |
| --- | ---: | ---: | ---: | ---: |
| baseline_success | 4 | 4 | 0 | 0 |
| controlled_no_capability | 58 | 0 | 58 | 0 |
| controlled_human_input | 66 | 0 | 66 | 0 |
| controlled_approval | 64 | 13 | 51 | 0 |
| multilingual_noise | 5 | 5 | 0 | 0 |
| novel_requirement | 51 | 0 | 51 | 0 |
| step_pressure | 55 | 0 | 55 | 0 |
| fallback_route | 4 | 4 | 0 | 0 |
| reordered_requirements | 9 | 9 | 0 | 0 |
| compound_noise | 4 | 4 | 0 | 0 |

## Adaptive weights

Attack curriculum: controlled_no_capability=3.794, controlled_human_input=3.794, controlled_approval=3.794, novel_requirement=3.794, step_pressure=3.794, baseline_success=0.250, multilingual_noise=0.250, fallback_route=0.250, reordered_requirements=0.250, compound_noise=0.250

Repair priority: semantic=0.843, capability=0.843, liveness=0.843, approval=0.843, handoff=0.843, verification=0.843

## Repair contract

The repair loop must optimize **uncontrolled process-integrity failures**, not completion rate. It must not turn a predictable refusal, missing capability, human clarification, approval boundary, bounded timeout, or other controlled terminal failure into invented success.
