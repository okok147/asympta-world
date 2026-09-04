# Asympta Kernel Recursive Lab — generation 39

Seed: `1714941692`

## Process integrity

- Cases: **320**
- Completed: **35**
- Controlled / predictable failures: **285**
- Uncontrolled failures: **0**
- Process integrity rate: **100.00%**
- Deterministic replay rate: **100.00%**
- New uncontrolled fingerprints: **0**

A controlled failure is a valid terminal result. The lab only treats hangs, non-terminal stalls, nondeterminism, false completion, missing failure ownership/reason, or broken verification/handoff as kernel failures.

## Families

| Family | Total | Completed | Controlled failure | Uncontrolled |
| --- | ---: | ---: | ---: | ---: |
| baseline_success | 2 | 2 | 0 | 0 |
| controlled_no_capability | 61 | 0 | 61 | 0 |
| controlled_human_input | 64 | 0 | 64 | 0 |
| controlled_approval | 66 | 20 | 46 | 0 |
| multilingual_noise | 3 | 3 | 0 | 0 |
| novel_requirement | 61 | 0 | 61 | 0 |
| step_pressure | 53 | 0 | 53 | 0 |
| fallback_route | 2 | 2 | 0 | 0 |
| reordered_requirements | 3 | 3 | 0 | 0 |
| compound_noise | 5 | 5 | 0 | 0 |

## Adaptive weights

Attack curriculum: controlled_no_capability=4.616, controlled_human_input=4.616, controlled_approval=4.616, novel_requirement=4.616, step_pressure=4.616, baseline_success=0.250, multilingual_noise=0.250, fallback_route=0.250, reordered_requirements=0.250, compound_noise=0.250

Repair priority: semantic=0.822, capability=0.822, liveness=0.822, approval=0.822, handoff=0.822, verification=0.822

## Repair contract

The repair loop must optimize **uncontrolled process-integrity failures**, not completion rate. It must not turn a predictable refusal, missing capability, human clarification, approval boundary, bounded timeout, or other controlled terminal failure into invented success.
