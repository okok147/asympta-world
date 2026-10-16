# Asympta Kernel Recursive Lab — generation 272

Seed: `176955715`

## Process integrity

- Cases: **320**
- Completed: **28**
- Controlled / predictable failures: **292**
- Uncontrolled failures: **0**
- Process integrity rate: **100.00%**
- Deterministic replay rate: **100.00%**
- New uncontrolled fingerprints: **0**

A controlled failure is a valid terminal result. The lab only treats hangs, non-terminal stalls, nondeterminism, false completion, missing failure ownership/reason, or broken verification/handoff as kernel failures.

## Families

| Family | Total | Completed | Controlled failure | Uncontrolled |
| --- | ---: | ---: | ---: | ---: |
| baseline_success | 3 | 3 | 0 | 0 |
| controlled_no_capability | 65 | 0 | 65 | 0 |
| controlled_human_input | 63 | 0 | 63 | 0 |
| controlled_approval | 64 | 14 | 50 | 0 |
| multilingual_noise | 4 | 4 | 0 | 0 |
| novel_requirement | 62 | 0 | 62 | 0 |
| step_pressure | 52 | 0 | 52 | 0 |
| fallback_route | 2 | 2 | 0 | 0 |
| reordered_requirements | 3 | 3 | 0 | 0 |
| compound_noise | 2 | 2 | 0 | 0 |

## Adaptive weights

Attack curriculum: controlled_no_capability=8.000, controlled_human_input=8.000, controlled_approval=8.000, novel_requirement=8.000, step_pressure=8.000, baseline_success=0.250, multilingual_noise=0.250, fallback_route=0.250, reordered_requirements=0.250, compound_noise=0.250

Repair priority: semantic=0.256, capability=0.256, liveness=0.256, approval=0.256, handoff=0.256, verification=0.256

## Repair contract

The repair loop must optimize **uncontrolled process-integrity failures**, not completion rate. It must not turn a predictable refusal, missing capability, human clarification, approval boundary, bounded timeout, or other controlled terminal failure into invented success.
