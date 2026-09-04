# Asympta Kernel Recursive Lab — generation 33

Seed: `1632582911`

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
| baseline_success | 10 | 10 | 0 | 0 |
| controlled_no_capability | 63 | 0 | 63 | 0 |
| controlled_human_input | 52 | 0 | 52 | 0 |
| controlled_approval | 57 | 13 | 44 | 0 |
| multilingual_noise | 5 | 5 | 0 | 0 |
| novel_requirement | 59 | 0 | 59 | 0 |
| step_pressure | 62 | 0 | 62 | 0 |
| fallback_route | 5 | 5 | 0 | 0 |
| reordered_requirements | 2 | 2 | 0 | 0 |
| compound_noise | 5 | 5 | 0 | 0 |

## Adaptive weights

Attack curriculum: controlled_no_capability=3.648, controlled_human_input=3.648, controlled_approval=3.648, novel_requirement=3.648, step_pressure=3.648, baseline_success=0.260, multilingual_noise=0.260, fallback_route=0.260, reordered_requirements=0.260, compound_noise=0.260

Repair priority: semantic=0.848, capability=0.848, liveness=0.848, approval=0.848, handoff=0.848, verification=0.848

## Repair contract

The repair loop must optimize **uncontrolled process-integrity failures**, not completion rate. It must not turn a predictable refusal, missing capability, human clarification, approval boundary, bounded timeout, or other controlled terminal failure into invented success.
