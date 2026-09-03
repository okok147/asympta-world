# Asympta Kernel Recursive Lab — generation 7

Seed: `1486420200`

## Process integrity

- Cases: **320**
- Completed: **137**
- Controlled / predictable failures: **183**
- Uncontrolled failures: **0**
- Process integrity rate: **100.00%**
- Deterministic replay rate: **100.00%**
- New uncontrolled fingerprints: **0**

A controlled failure is a valid terminal result. The lab only treats hangs, non-terminal stalls, nondeterminism, false completion, missing failure ownership/reason, or broken verification/handoff as kernel failures.

## Families

| Family | Total | Completed | Controlled failure | Uncontrolled |
| --- | ---: | ---: | ---: | ---: |
| baseline_success | 32 | 32 | 0 | 0 |
| controlled_no_capability | 35 | 0 | 35 | 0 |
| controlled_human_input | 42 | 0 | 42 | 0 |
| controlled_approval | 37 | 7 | 30 | 0 |
| multilingual_noise | 30 | 30 | 0 | 0 |
| novel_requirement | 40 | 0 | 40 | 0 |
| step_pressure | 36 | 0 | 36 | 0 |
| fallback_route | 26 | 26 | 0 | 0 |
| reordered_requirements | 25 | 25 | 0 | 0 |
| compound_noise | 17 | 17 | 0 | 0 |

## Adaptive weights

Attack curriculum: controlled_no_capability=1.316, controlled_human_input=1.316, controlled_approval=1.316, novel_requirement=1.316, step_pressure=1.316, baseline_success=0.751, multilingual_noise=0.751, fallback_route=0.751, reordered_requirements=0.751, compound_noise=0.751

Repair priority: semantic=0.966, capability=0.966, liveness=0.966, approval=0.966, handoff=0.966, verification=0.966

## Repair contract

The repair loop must optimize **uncontrolled process-integrity failures**, not completion rate. It must not turn a predictable refusal, missing capability, human clarification, approval boundary, bounded timeout, or other controlled terminal failure into invented success.
