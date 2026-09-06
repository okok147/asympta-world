# Asympta Kernel Recursive Lab — generation 53

Seed: `1823076847`

## Process integrity

- Cases: **320**
- Completed: **26**
- Controlled / predictable failures: **294**
- Uncontrolled failures: **0**
- Process integrity rate: **100.00%**
- Deterministic replay rate: **100.00%**
- New uncontrolled fingerprints: **0**

A controlled failure is a valid terminal result. The lab only treats hangs, non-terminal stalls, nondeterminism, false completion, missing failure ownership/reason, or broken verification/handoff as kernel failures.

## Families

| Family | Total | Completed | Controlled failure | Uncontrolled |
| --- | ---: | ---: | ---: | ---: |
| baseline_success | 5 | 5 | 0 | 0 |
| controlled_no_capability | 71 | 0 | 71 | 0 |
| controlled_human_input | 60 | 0 | 60 | 0 |
| controlled_approval | 58 | 11 | 47 | 0 |
| multilingual_noise | 2 | 2 | 0 | 0 |
| novel_requirement | 60 | 0 | 60 | 0 |
| step_pressure | 56 | 0 | 56 | 0 |
| fallback_route | 1 | 1 | 0 | 0 |
| reordered_requirements | 5 | 5 | 0 | 0 |
| compound_noise | 2 | 2 | 0 | 0 |

## Adaptive weights

Attack curriculum: controlled_no_capability=7.994, controlled_human_input=7.994, controlled_approval=7.994, novel_requirement=7.994, step_pressure=7.994, baseline_success=0.250, multilingual_noise=0.250, fallback_route=0.250, reordered_requirements=0.250, compound_noise=0.250

Repair priority: semantic=0.767, capability=0.767, liveness=0.767, approval=0.767, handoff=0.767, verification=0.767

## Repair contract

The repair loop must optimize **uncontrolled process-integrity failures**, not completion rate. It must not turn a predictable refusal, missing capability, human clarification, approval boundary, bounded timeout, or other controlled terminal failure into invented success.
