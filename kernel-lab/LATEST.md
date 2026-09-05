# Asympta Kernel Recursive Lab — generation 43

Seed: `1735981471`

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
| baseline_success | 2 | 2 | 0 | 0 |
| controlled_no_capability | 48 | 0 | 48 | 0 |
| controlled_human_input | 63 | 0 | 63 | 0 |
| controlled_approval | 62 | 13 | 49 | 0 |
| multilingual_noise | 5 | 5 | 0 | 0 |
| novel_requirement | 66 | 0 | 66 | 0 |
| step_pressure | 65 | 0 | 65 | 0 |
| fallback_route | 4 | 4 | 0 | 0 |
| reordered_requirements | 4 | 4 | 0 | 0 |
| compound_noise | 1 | 1 | 0 | 0 |

## Adaptive weights

Attack curriculum: controlled_no_capability=5.400, controlled_human_input=5.400, controlled_approval=5.400, novel_requirement=5.400, step_pressure=5.400, baseline_success=0.250, multilingual_noise=0.250, fallback_route=0.250, reordered_requirements=0.250, compound_noise=0.250

Repair priority: semantic=0.806, capability=0.806, liveness=0.806, approval=0.806, handoff=0.806, verification=0.806

## Repair contract

The repair loop must optimize **uncontrolled process-integrity failures**, not completion rate. It must not turn a predictable refusal, missing capability, human clarification, approval boundary, bounded timeout, or other controlled terminal failure into invented success.
