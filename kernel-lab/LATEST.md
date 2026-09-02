# Asympta Kernel Recursive Lab — generation 5

Seed: `1484155075`

## Process integrity

- Cases: **320**
- Completed: **153**
- Controlled / predictable failures: **167**
- Uncontrolled failures: **0**
- Process integrity rate: **100.00%**
- Deterministic replay rate: **100.00%**
- New uncontrolled fingerprints: **0**

A controlled failure is a valid terminal result. The lab only treats hangs, non-terminal stalls, nondeterminism, false completion, missing failure ownership/reason, or broken verification/handoff as kernel failures.

## Families

| Family | Total | Completed | Controlled failure | Uncontrolled |
| --- | ---: | ---: | ---: | ---: |
| baseline_success | 32 | 32 | 0 | 0 |
| controlled_no_capability | 32 | 0 | 32 | 0 |
| controlled_human_input | 37 | 0 | 37 | 0 |
| controlled_approval | 40 | 8 | 32 | 0 |
| multilingual_noise | 33 | 33 | 0 | 0 |
| novel_requirement | 29 | 0 | 29 | 0 |
| step_pressure | 37 | 0 | 37 | 0 |
| fallback_route | 29 | 29 | 0 | 0 |
| reordered_requirements | 24 | 24 | 0 | 0 |
| compound_noise | 27 | 27 | 0 | 0 |

## Adaptive weights

Attack curriculum: controlled_no_capability=1.217, controlled_human_input=1.217, controlled_approval=1.217, novel_requirement=1.217, step_pressure=1.217, baseline_success=0.815, multilingual_noise=0.815, fallback_route=0.815, reordered_requirements=0.815, compound_noise=0.815

Repair priority: semantic=0.975, capability=0.975, liveness=0.975, approval=0.975, handoff=0.975, verification=0.975

## Repair contract

The repair loop must optimize **uncontrolled process-integrity failures**, not completion rate. It must not turn a predictable refusal, missing capability, human clarification, approval boundary, bounded timeout, or other controlled terminal failure into invented success.
