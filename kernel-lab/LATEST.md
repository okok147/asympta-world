# Asympta Kernel Recursive Lab — generation 22

Seed: `1541141409`

## Process integrity

- Cases: **320**
- Completed: **70**
- Controlled / predictable failures: **250**
- Uncontrolled failures: **0**
- Process integrity rate: **100.00%**
- Deterministic replay rate: **100.00%**
- New uncontrolled fingerprints: **0**

A controlled failure is a valid terminal result. The lab only treats hangs, non-terminal stalls, nondeterminism, false completion, missing failure ownership/reason, or broken verification/handoff as kernel failures.

## Families

| Family | Total | Completed | Controlled failure | Uncontrolled |
| --- | ---: | ---: | ---: | ---: |
| baseline_success | 10 | 10 | 0 | 0 |
| controlled_no_capability | 62 | 0 | 62 | 0 |
| controlled_human_input | 44 | 0 | 44 | 0 |
| controlled_approval | 50 | 13 | 37 | 0 |
| multilingual_noise | 9 | 9 | 0 | 0 |
| novel_requirement | 45 | 0 | 45 | 0 |
| step_pressure | 62 | 0 | 62 | 0 |
| fallback_route | 14 | 14 | 0 | 0 |
| reordered_requirements | 10 | 10 | 0 | 0 |
| compound_noise | 14 | 14 | 0 | 0 |

## Adaptive weights

Attack curriculum: controlled_no_capability=2.370, controlled_human_input=2.370, controlled_approval=2.370, novel_requirement=2.370, step_pressure=2.370, baseline_success=0.407, multilingual_noise=0.407, fallback_route=0.407, reordered_requirements=0.407, compound_noise=0.407

Repair priority: semantic=0.896, capability=0.896, liveness=0.896, approval=0.896, handoff=0.896, verification=0.896

## Repair contract

The repair loop must optimize **uncontrolled process-integrity failures**, not completion rate. It must not turn a predictable refusal, missing capability, human clarification, approval boundary, bounded timeout, or other controlled terminal failure into invented success.
