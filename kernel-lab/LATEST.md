# Asympta Kernel Recursive Lab — generation 64

Seed: `1951406755`

## Process integrity

- Cases: **320**
- Completed: **30**
- Controlled / predictable failures: **290**
- Uncontrolled failures: **0**
- Process integrity rate: **100.00%**
- Deterministic replay rate: **100.00%**
- New uncontrolled fingerprints: **0**

A controlled failure is a valid terminal result. The lab only treats hangs, non-terminal stalls, nondeterminism, false completion, missing failure ownership/reason, or broken verification/handoff as kernel failures.

## Families

| Family | Total | Completed | Controlled failure | Uncontrolled |
| --- | ---: | ---: | ---: | ---: |
| baseline_success | 3 | 3 | 0 | 0 |
| controlled_no_capability | 57 | 0 | 57 | 0 |
| controlled_human_input | 60 | 0 | 60 | 0 |
| controlled_approval | 61 | 17 | 44 | 0 |
| multilingual_noise | 5 | 5 | 0 | 0 |
| novel_requirement | 59 | 0 | 59 | 0 |
| step_pressure | 70 | 0 | 70 | 0 |
| fallback_route | 1 | 1 | 0 | 0 |
| reordered_requirements | 2 | 2 | 0 | 0 |
| compound_noise | 2 | 2 | 0 | 0 |

## Adaptive weights

Attack curriculum: controlled_no_capability=8.000, controlled_human_input=8.000, controlled_approval=8.000, novel_requirement=8.000, step_pressure=8.000, baseline_success=0.250, multilingual_noise=0.250, fallback_route=0.250, reordered_requirements=0.250, compound_noise=0.250

Repair priority: semantic=0.726, capability=0.726, liveness=0.726, approval=0.726, handoff=0.726, verification=0.726

## Repair contract

The repair loop must optimize **uncontrolled process-integrity failures**, not completion rate. It must not turn a predictable refusal, missing capability, human clarification, approval boundary, bounded timeout, or other controlled terminal failure into invented success.
