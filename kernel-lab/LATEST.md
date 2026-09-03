# Asympta Kernel Recursive Lab — generation 25

Seed: `1542550763`

## Process integrity

- Cases: **320**
- Completed: **67**
- Controlled / predictable failures: **253**
- Uncontrolled failures: **0**
- Process integrity rate: **100.00%**
- Deterministic replay rate: **100.00%**
- New uncontrolled fingerprints: **0**

A controlled failure is a valid terminal result. The lab only treats hangs, non-terminal stalls, nondeterminism, false completion, missing failure ownership/reason, or broken verification/handoff as kernel failures.

## Families

| Family | Total | Completed | Controlled failure | Uncontrolled |
| --- | ---: | ---: | ---: | ---: |
| baseline_success | 12 | 12 | 0 | 0 |
| controlled_no_capability | 47 | 0 | 47 | 0 |
| controlled_human_input | 51 | 0 | 51 | 0 |
| controlled_approval | 62 | 15 | 47 | 0 |
| multilingual_noise | 16 | 16 | 0 | 0 |
| novel_requirement | 54 | 0 | 54 | 0 |
| step_pressure | 54 | 0 | 54 | 0 |
| fallback_route | 7 | 7 | 0 | 0 |
| reordered_requirements | 10 | 10 | 0 | 0 |
| compound_noise | 7 | 7 | 0 | 0 |

## Adaptive weights

Attack curriculum: controlled_no_capability=2.666, controlled_human_input=2.666, controlled_approval=2.666, novel_requirement=2.666, step_pressure=2.666, baseline_success=0.360, multilingual_noise=0.360, fallback_route=0.360, reordered_requirements=0.360, compound_noise=0.360

Repair priority: semantic=0.882, capability=0.882, liveness=0.882, approval=0.882, handoff=0.882, verification=0.882

## Repair contract

The repair loop must optimize **uncontrolled process-integrity failures**, not completion rate. It must not turn a predictable refusal, missing capability, human clarification, approval boundary, bounded timeout, or other controlled terminal failure into invented success.
