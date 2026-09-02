# Asympta Kernel Recursive Lab — generation 4

Seed: `1484120115`

## Process integrity

- Cases: **320**
- Completed: **151**
- Controlled / predictable failures: **169**
- Uncontrolled failures: **0**
- Process integrity rate: **100.00%**
- Deterministic replay rate: **100.00%**
- New uncontrolled fingerprints: **0**

A controlled failure is a valid terminal result. The lab only treats hangs, non-terminal stalls, nondeterminism, false completion, missing failure ownership/reason, or broken verification/handoff as kernel failures.

## Families

| Family | Total | Completed | Controlled failure | Uncontrolled |
| --- | ---: | ---: | ---: | ---: |
| baseline_success | 29 | 29 | 0 | 0 |
| controlled_no_capability | 34 | 0 | 34 | 0 |
| controlled_human_input | 39 | 0 | 39 | 0 |
| controlled_approval | 37 | 10 | 27 | 0 |
| multilingual_noise | 24 | 24 | 0 | 0 |
| novel_requirement | 37 | 0 | 37 | 0 |
| step_pressure | 32 | 0 | 32 | 0 |
| fallback_route | 25 | 25 | 0 | 0 |
| reordered_requirements | 31 | 31 | 0 | 0 |
| compound_noise | 32 | 32 | 0 | 0 |

## Adaptive weights

Attack curriculum: controlled_no_capability=1.170, controlled_human_input=1.170, controlled_approval=1.170, novel_requirement=1.170, step_pressure=1.170, baseline_success=0.849, multilingual_noise=0.849, fallback_route=0.849, reordered_requirements=0.849, compound_noise=0.849

Repair priority: semantic=0.980, capability=0.980, liveness=0.980, approval=0.980, handoff=0.980, verification=0.980

## Repair contract

The repair loop must optimize **uncontrolled process-integrity failures**, not completion rate. It must not turn a predictable refusal, missing capability, human clarification, approval boundary, bounded timeout, or other controlled terminal failure into invented success.
