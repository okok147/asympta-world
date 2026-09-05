# Asympta Kernel Recursive Lab — generation 48

Seed: `1778732979`

## Process integrity

- Cases: **320**
- Completed: **29**
- Controlled / predictable failures: **291**
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
| controlled_human_input | 63 | 0 | 63 | 0 |
| controlled_approval | 53 | 14 | 39 | 0 |
| multilingual_noise | 2 | 2 | 0 | 0 |
| novel_requirement | 70 | 0 | 70 | 0 |
| step_pressure | 62 | 0 | 62 | 0 |
| fallback_route | 2 | 2 | 0 | 0 |
| reordered_requirements | 4 | 4 | 0 | 0 |
| compound_noise | 4 | 4 | 0 | 0 |

## Adaptive weights

Attack curriculum: controlled_no_capability=6.571, controlled_human_input=6.571, controlled_approval=6.571, novel_requirement=6.571, step_pressure=6.571, baseline_success=0.250, multilingual_noise=0.250, fallback_route=0.250, reordered_requirements=0.250, compound_noise=0.250

Repair priority: semantic=0.786, capability=0.786, liveness=0.786, approval=0.786, handoff=0.786, verification=0.786

## Repair contract

The repair loop must optimize **uncontrolled process-integrity failures**, not completion rate. It must not turn a predictable refusal, missing capability, human clarification, approval boundary, bounded timeout, or other controlled terminal failure into invented success.
