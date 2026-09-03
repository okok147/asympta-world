# Asympta Kernel Recursive Lab — generation 13

Seed: `1538482902`

## Process integrity

- Cases: **320**
- Completed: **103**
- Controlled / predictable failures: **217**
- Uncontrolled failures: **0**
- Process integrity rate: **100.00%**
- Deterministic replay rate: **100.00%**
- New uncontrolled fingerprints: **0**

A controlled failure is a valid terminal result. The lab only treats hangs, non-terminal stalls, nondeterminism, false completion, missing failure ownership/reason, or broken verification/handoff as kernel failures.

## Families

| Family | Total | Completed | Controlled failure | Uncontrolled |
| --- | ---: | ---: | ---: | ---: |
| baseline_success | 17 | 17 | 0 | 0 |
| controlled_no_capability | 55 | 0 | 55 | 0 |
| controlled_human_input | 40 | 0 | 40 | 0 |
| controlled_approval | 45 | 11 | 34 | 0 |
| multilingual_noise | 18 | 18 | 0 | 0 |
| novel_requirement | 43 | 0 | 43 | 0 |
| step_pressure | 45 | 0 | 45 | 0 |
| fallback_route | 16 | 16 | 0 | 0 |
| reordered_requirements | 18 | 18 | 0 | 0 |
| compound_noise | 23 | 23 | 0 | 0 |

## Adaptive weights

Attack curriculum: controlled_no_capability=1.665, controlled_human_input=1.665, controlled_approval=1.665, novel_requirement=1.665, step_pressure=1.665, baseline_success=0.588, multilingual_noise=0.588, fallback_route=0.588, reordered_requirements=0.588, compound_noise=0.588

Repair priority: semantic=0.937, capability=0.937, liveness=0.937, approval=0.937, handoff=0.937, verification=0.937

## Repair contract

The repair loop must optimize **uncontrolled process-integrity failures**, not completion rate. It must not turn a predictable refusal, missing capability, human clarification, approval boundary, bounded timeout, or other controlled terminal failure into invented success.
