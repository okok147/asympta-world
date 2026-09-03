# Asympta Kernel Recursive Lab — generation 30

Seed: `1593956641`

## Process integrity

- Cases: **320**
- Completed: **53**
- Controlled / predictable failures: **267**
- Uncontrolled failures: **0**
- Process integrity rate: **100.00%**
- Deterministic replay rate: **100.00%**
- New uncontrolled fingerprints: **0**

A controlled failure is a valid terminal result. The lab only treats hangs, non-terminal stalls, nondeterminism, false completion, missing failure ownership/reason, or broken verification/handoff as kernel failures.

## Families

| Family | Total | Completed | Controlled failure | Uncontrolled |
| --- | ---: | ---: | ---: | ---: |
| baseline_success | 10 | 10 | 0 | 0 |
| controlled_no_capability | 52 | 0 | 52 | 0 |
| controlled_human_input | 55 | 0 | 55 | 0 |
| controlled_approval | 56 | 13 | 43 | 0 |
| multilingual_noise | 10 | 10 | 0 | 0 |
| novel_requirement | 61 | 0 | 61 | 0 |
| step_pressure | 56 | 0 | 56 | 0 |
| fallback_route | 9 | 9 | 0 | 0 |
| reordered_requirements | 6 | 6 | 0 | 0 |
| compound_noise | 5 | 5 | 0 | 0 |

## Adaptive weights

Attack curriculum: controlled_no_capability=3.243, controlled_human_input=3.243, controlled_approval=3.243, novel_requirement=3.243, step_pressure=3.243, baseline_success=0.294, multilingual_noise=0.294, fallback_route=0.294, reordered_requirements=0.294, compound_noise=0.294

Repair priority: semantic=0.860, capability=0.860, liveness=0.860, approval=0.860, handoff=0.860, verification=0.860

## Repair contract

The repair loop must optimize **uncontrolled process-integrity failures**, not completion rate. It must not turn a predictable refusal, missing capability, human clarification, approval boundary, bounded timeout, or other controlled terminal failure into invented success.
