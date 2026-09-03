# Asympta Kernel Recursive Lab — generation 6

Seed: `1485768747`

## Process integrity

- Cases: **320**
- Completed: **139**
- Controlled / predictable failures: **181**
- Uncontrolled failures: **0**
- Process integrity rate: **100.00%**
- Deterministic replay rate: **100.00%**
- New uncontrolled fingerprints: **0**

A controlled failure is a valid terminal result. The lab only treats hangs, non-terminal stalls, nondeterminism, false completion, missing failure ownership/reason, or broken verification/handoff as kernel failures.

## Families

| Family | Total | Completed | Controlled failure | Uncontrolled |
| --- | ---: | ---: | ---: | ---: |
| baseline_success | 24 | 24 | 0 | 0 |
| controlled_no_capability | 44 | 0 | 44 | 0 |
| controlled_human_input | 38 | 0 | 38 | 0 |
| controlled_approval | 37 | 11 | 26 | 0 |
| multilingual_noise | 28 | 28 | 0 | 0 |
| novel_requirement | 27 | 0 | 27 | 0 |
| step_pressure | 46 | 0 | 46 | 0 |
| fallback_route | 26 | 26 | 0 | 0 |
| reordered_requirements | 28 | 28 | 0 | 0 |
| compound_noise | 22 | 22 | 0 | 0 |

## Adaptive weights

Attack curriculum: controlled_no_capability=1.265, controlled_human_input=1.265, controlled_approval=1.265, novel_requirement=1.265, step_pressure=1.265, baseline_success=0.783, multilingual_noise=0.783, fallback_route=0.783, reordered_requirements=0.783, compound_noise=0.783

Repair priority: semantic=0.970, capability=0.970, liveness=0.970, approval=0.970, handoff=0.970, verification=0.970

## Repair contract

The repair loop must optimize **uncontrolled process-integrity failures**, not completion rate. It must not turn a predictable refusal, missing capability, human clarification, approval boundary, bounded timeout, or other controlled terminal failure into invented success.
