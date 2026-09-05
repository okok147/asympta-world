# Asympta Kernel Recursive Lab — generation 44

Seed: `1749166762`

## Process integrity

- Cases: **320**
- Completed: **40**
- Controlled / predictable failures: **280**
- Uncontrolled failures: **0**
- Process integrity rate: **100.00%**
- Deterministic replay rate: **100.00%**
- New uncontrolled fingerprints: **0**

A controlled failure is a valid terminal result. The lab only treats hangs, non-terminal stalls, nondeterminism, false completion, missing failure ownership/reason, or broken verification/handoff as kernel failures.

## Families

| Family | Total | Completed | Controlled failure | Uncontrolled |
| --- | ---: | ---: | ---: | ---: |
| baseline_success | 5 | 5 | 0 | 0 |
| controlled_no_capability | 57 | 0 | 57 | 0 |
| controlled_human_input | 58 | 0 | 58 | 0 |
| controlled_approval | 60 | 13 | 47 | 0 |
| multilingual_noise | 4 | 4 | 0 | 0 |
| novel_requirement | 68 | 0 | 68 | 0 |
| step_pressure | 50 | 0 | 50 | 0 |
| fallback_route | 5 | 5 | 0 | 0 |
| reordered_requirements | 8 | 8 | 0 | 0 |
| compound_noise | 5 | 5 | 0 | 0 |

## Adaptive weights

Attack curriculum: controlled_no_capability=5.617, controlled_human_input=5.617, controlled_approval=5.617, novel_requirement=5.617, step_pressure=5.617, baseline_success=0.250, multilingual_noise=0.250, fallback_route=0.250, reordered_requirements=0.250, compound_noise=0.250

Repair priority: semantic=0.802, capability=0.802, liveness=0.802, approval=0.802, handoff=0.802, verification=0.802

## Repair contract

The repair loop must optimize **uncontrolled process-integrity failures**, not completion rate. It must not turn a predictable refusal, missing capability, human clarification, approval boundary, bounded timeout, or other controlled terminal failure into invented success.
