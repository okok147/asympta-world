# Asympta Kernel Recursive Lab — generation 11

Seed: `1537153112`

## Process integrity

- Cases: **320**
- Completed: **114**
- Controlled / predictable failures: **206**
- Uncontrolled failures: **0**
- Process integrity rate: **100.00%**
- Deterministic replay rate: **100.00%**
- New uncontrolled fingerprints: **0**

A controlled failure is a valid terminal result. The lab only treats hangs, non-terminal stalls, nondeterminism, false completion, missing failure ownership/reason, or broken verification/handoff as kernel failures.

## Families

| Family | Total | Completed | Controlled failure | Uncontrolled |
| --- | ---: | ---: | ---: | ---: |
| baseline_success | 18 | 18 | 0 | 0 |
| controlled_no_capability | 45 | 0 | 45 | 0 |
| controlled_human_input | 40 | 0 | 40 | 0 |
| controlled_approval | 35 | 8 | 27 | 0 |
| multilingual_noise | 25 | 25 | 0 | 0 |
| novel_requirement | 52 | 0 | 52 | 0 |
| step_pressure | 42 | 0 | 42 | 0 |
| fallback_route | 20 | 20 | 0 | 0 |
| reordered_requirements | 18 | 18 | 0 | 0 |
| compound_noise | 25 | 25 | 0 | 0 |

## Adaptive weights

Attack curriculum: controlled_no_capability=1.539, controlled_human_input=1.539, controlled_approval=1.539, novel_requirement=1.539, step_pressure=1.539, baseline_success=0.638, multilingual_noise=0.638, fallback_route=0.638, reordered_requirements=0.638, compound_noise=0.638

Repair priority: semantic=0.946, capability=0.946, liveness=0.946, approval=0.946, handoff=0.946, verification=0.946

## Repair contract

The repair loop must optimize **uncontrolled process-integrity failures**, not completion rate. It must not turn a predictable refusal, missing capability, human clarification, approval boundary, bounded timeout, or other controlled terminal failure into invented success.
