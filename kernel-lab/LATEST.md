# Asympta Kernel Recursive Lab — generation 2

Seed: `1458208850`

## Process integrity

- Cases: **320**
- Completed: **166**
- Controlled / predictable failures: **154**
- Uncontrolled failures: **0**
- Process integrity rate: **100.00%**
- Deterministic replay rate: **100.00%**
- New uncontrolled fingerprints: **0**

A controlled failure is a valid terminal result. The lab only treats hangs, non-terminal stalls, nondeterminism, false completion, missing failure ownership/reason, or broken verification/handoff as kernel failures.

## Families

| Family | Total | Completed | Controlled failure | Uncontrolled |
| --- | ---: | ---: | ---: | ---: |
| baseline_success | 29 | 29 | 0 | 0 |
| controlled_no_capability | 28 | 0 | 28 | 0 |
| controlled_human_input | 36 | 0 | 36 | 0 |
| controlled_approval | 25 | 7 | 18 | 0 |
| multilingual_noise | 30 | 30 | 0 | 0 |
| novel_requirement | 34 | 0 | 34 | 0 |
| step_pressure | 38 | 0 | 38 | 0 |
| fallback_route | 32 | 32 | 0 | 0 |
| reordered_requirements | 33 | 33 | 0 | 0 |
| compound_noise | 35 | 35 | 0 | 0 |

## Adaptive weights

Attack curriculum: controlled_no_capability=1.082, controlled_human_input=1.082, controlled_approval=1.082, novel_requirement=1.082, step_pressure=1.082, baseline_success=0.922, multilingual_noise=0.922, fallback_route=0.922, reordered_requirements=0.922, compound_noise=0.922

Repair priority: semantic=0.990, capability=0.990, liveness=0.990, approval=0.990, handoff=0.990, verification=0.990

## Repair contract

The repair loop must optimize **uncontrolled process-integrity failures**, not completion rate. It must not turn a predictable refusal, missing capability, human clarification, approval boundary, bounded timeout, or other controlled terminal failure into invented success.
