# Asympta Kernel Recursive Lab — generation 21

Seed: `1541112004`

## Process integrity

- Cases: **320**
- Completed: **79**
- Controlled / predictable failures: **241**
- Uncontrolled failures: **0**
- Process integrity rate: **100.00%**
- Deterministic replay rate: **100.00%**
- New uncontrolled fingerprints: **0**

A controlled failure is a valid terminal result. The lab only treats hangs, non-terminal stalls, nondeterminism, false completion, missing failure ownership/reason, or broken verification/handoff as kernel failures.

## Families

| Family | Total | Completed | Controlled failure | Uncontrolled |
| --- | ---: | ---: | ---: | ---: |
| baseline_success | 10 | 10 | 0 | 0 |
| controlled_no_capability | 48 | 0 | 48 | 0 |
| controlled_human_input | 52 | 0 | 52 | 0 |
| controlled_approval | 49 | 11 | 38 | 0 |
| multilingual_noise | 13 | 13 | 0 | 0 |
| novel_requirement | 57 | 0 | 57 | 0 |
| step_pressure | 46 | 0 | 46 | 0 |
| fallback_route | 17 | 17 | 0 | 0 |
| reordered_requirements | 13 | 13 | 0 | 0 |
| compound_noise | 15 | 15 | 0 | 0 |

## Adaptive weights

Attack curriculum: controlled_no_capability=2.279, controlled_human_input=2.279, controlled_approval=2.279, novel_requirement=2.279, step_pressure=2.279, baseline_success=0.424, multilingual_noise=0.424, fallback_route=0.424, reordered_requirements=0.424, compound_noise=0.424

Repair priority: semantic=0.900, capability=0.900, liveness=0.900, approval=0.900, handoff=0.900, verification=0.900

## Repair contract

The repair loop must optimize **uncontrolled process-integrity failures**, not completion rate. It must not turn a predictable refusal, missing capability, human clarification, approval boundary, bounded timeout, or other controlled terminal failure into invented success.
