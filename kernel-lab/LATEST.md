# Asympta Kernel Recursive Lab — generation 38

Seed: `1714737377`

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
| baseline_success | 6 | 6 | 0 | 0 |
| controlled_no_capability | 53 | 0 | 53 | 0 |
| controlled_human_input | 66 | 0 | 66 | 0 |
| controlled_approval | 61 | 10 | 51 | 0 |
| multilingual_noise | 2 | 2 | 0 | 0 |
| novel_requirement | 51 | 0 | 51 | 0 |
| step_pressure | 69 | 0 | 69 | 0 |
| fallback_route | 4 | 4 | 0 | 0 |
| reordered_requirements | 4 | 4 | 0 | 0 |
| compound_noise | 4 | 4 | 0 | 0 |

## Adaptive weights

Attack curriculum: controlled_no_capability=4.439, controlled_human_input=4.439, controlled_approval=4.439, novel_requirement=4.439, step_pressure=4.439, baseline_success=0.250, multilingual_noise=0.250, fallback_route=0.250, reordered_requirements=0.250, compound_noise=0.250

Repair priority: semantic=0.827, capability=0.827, liveness=0.827, approval=0.827, handoff=0.827, verification=0.827

## Repair contract

The repair loop must optimize **uncontrolled process-integrity failures**, not completion rate. It must not turn a predictable refusal, missing capability, human clarification, approval boundary, bounded timeout, or other controlled terminal failure into invented success.
