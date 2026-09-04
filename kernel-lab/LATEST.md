# Asympta Kernel Recursive Lab — generation 41

Seed: `1718189704`

## Process integrity

- Cases: **320**
- Completed: **31**
- Controlled / predictable failures: **289**
- Uncontrolled failures: **0**
- Process integrity rate: **100.00%**
- Deterministic replay rate: **100.00%**
- New uncontrolled fingerprints: **0**

A controlled failure is a valid terminal result. The lab only treats hangs, non-terminal stalls, nondeterminism, false completion, missing failure ownership/reason, or broken verification/handoff as kernel failures.

## Families

| Family | Total | Completed | Controlled failure | Uncontrolled |
| --- | ---: | ---: | ---: | ---: |
| baseline_success | 5 | 5 | 0 | 0 |
| controlled_no_capability | 55 | 0 | 55 | 0 |
| controlled_human_input | 72 | 0 | 72 | 0 |
| controlled_approval | 53 | 10 | 43 | 0 |
| multilingual_noise | 8 | 8 | 0 | 0 |
| novel_requirement | 62 | 0 | 62 | 0 |
| step_pressure | 57 | 0 | 57 | 0 |
| fallback_route | 2 | 2 | 0 | 0 |
| reordered_requirements | 2 | 2 | 0 | 0 |
| compound_noise | 4 | 4 | 0 | 0 |

## Adaptive weights

Attack curriculum: controlled_no_capability=4.993, controlled_human_input=4.993, controlled_approval=4.993, novel_requirement=4.993, step_pressure=4.993, baseline_success=0.250, multilingual_noise=0.250, fallback_route=0.250, reordered_requirements=0.250, compound_noise=0.250

Repair priority: semantic=0.814, capability=0.814, liveness=0.814, approval=0.814, handoff=0.814, verification=0.814

## Repair contract

The repair loop must optimize **uncontrolled process-integrity failures**, not completion rate. It must not turn a predictable refusal, missing capability, human clarification, approval boundary, bounded timeout, or other controlled terminal failure into invented success.
