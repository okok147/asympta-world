# Asympta Kernel Recursive Lab — generation 3

Seed: `1475239124`

## Process integrity

- Cases: **320**
- Completed: **157**
- Controlled / predictable failures: **163**
- Uncontrolled failures: **0**
- Process integrity rate: **100.00%**
- Deterministic replay rate: **100.00%**
- New uncontrolled fingerprints: **0**

A controlled failure is a valid terminal result. The lab only treats hangs, non-terminal stalls, nondeterminism, false completion, missing failure ownership/reason, or broken verification/handoff as kernel failures.

## Families

| Family | Total | Completed | Controlled failure | Uncontrolled |
| --- | ---: | ---: | ---: | ---: |
| baseline_success | 35 | 35 | 0 | 0 |
| controlled_no_capability | 35 | 0 | 35 | 0 |
| controlled_human_input | 33 | 0 | 33 | 0 |
| controlled_approval | 35 | 7 | 28 | 0 |
| multilingual_noise | 32 | 32 | 0 | 0 |
| novel_requirement | 33 | 0 | 33 | 0 |
| step_pressure | 34 | 0 | 34 | 0 |
| fallback_route | 22 | 22 | 0 | 0 |
| reordered_requirements | 34 | 34 | 0 | 0 |
| compound_noise | 27 | 27 | 0 | 0 |

## Adaptive weights

Attack curriculum: controlled_no_capability=1.125, controlled_human_input=1.125, controlled_approval=1.125, novel_requirement=1.125, step_pressure=1.125, baseline_success=0.885, multilingual_noise=0.885, fallback_route=0.885, reordered_requirements=0.885, compound_noise=0.885

Repair priority: semantic=0.985, capability=0.985, liveness=0.985, approval=0.985, handoff=0.985, verification=0.985

## Repair contract

The repair loop must optimize **uncontrolled process-integrity failures**, not completion rate. It must not turn a predictable refusal, missing capability, human clarification, approval boundary, bounded timeout, or other controlled terminal failure into invented success.
