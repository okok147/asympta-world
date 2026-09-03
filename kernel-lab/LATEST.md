# Asympta Kernel Recursive Lab — generation 14

Seed: `1538545298`

## Process integrity

- Cases: **320**
- Completed: **92**
- Controlled / predictable failures: **228**
- Uncontrolled failures: **0**
- Process integrity rate: **100.00%**
- Deterministic replay rate: **100.00%**
- New uncontrolled fingerprints: **0**

A controlled failure is a valid terminal result. The lab only treats hangs, non-terminal stalls, nondeterminism, false completion, missing failure ownership/reason, or broken verification/handoff as kernel failures.

## Families

| Family | Total | Completed | Controlled failure | Uncontrolled |
| --- | ---: | ---: | ---: | ---: |
| baseline_success | 17 | 17 | 0 | 0 |
| controlled_no_capability | 45 | 0 | 45 | 0 |
| controlled_human_input | 55 | 0 | 55 | 0 |
| controlled_approval | 54 | 13 | 41 | 0 |
| multilingual_noise | 15 | 15 | 0 | 0 |
| novel_requirement | 47 | 0 | 47 | 0 |
| step_pressure | 40 | 0 | 40 | 0 |
| fallback_route | 15 | 15 | 0 | 0 |
| reordered_requirements | 16 | 16 | 0 | 0 |
| compound_noise | 16 | 16 | 0 | 0 |

## Adaptive weights

Attack curriculum: controlled_no_capability=1.732, controlled_human_input=1.732, controlled_approval=1.732, novel_requirement=1.732, step_pressure=1.732, baseline_success=0.565, multilingual_noise=0.565, fallback_route=0.565, reordered_requirements=0.565, compound_noise=0.565

Repair priority: semantic=0.932, capability=0.932, liveness=0.932, approval=0.932, handoff=0.932, verification=0.932

## Repair contract

The repair loop must optimize **uncontrolled process-integrity failures**, not completion rate. It must not turn a predictable refusal, missing capability, human clarification, approval boundary, bounded timeout, or other controlled terminal failure into invented success.
