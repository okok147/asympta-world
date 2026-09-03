# Asympta Kernel Recursive Lab — generation 12

Seed: `1537299572`

## Process integrity

- Cases: **320**
- Completed: **101**
- Controlled / predictable failures: **219**
- Uncontrolled failures: **0**
- Process integrity rate: **100.00%**
- Deterministic replay rate: **100.00%**
- New uncontrolled fingerprints: **0**

A controlled failure is a valid terminal result. The lab only treats hangs, non-terminal stalls, nondeterminism, false completion, missing failure ownership/reason, or broken verification/handoff as kernel failures.

## Families

| Family | Total | Completed | Controlled failure | Uncontrolled |
| --- | ---: | ---: | ---: | ---: |
| baseline_success | 15 | 15 | 0 | 0 |
| controlled_no_capability | 46 | 0 | 46 | 0 |
| controlled_human_input | 34 | 0 | 34 | 0 |
| controlled_approval | 49 | 11 | 38 | 0 |
| multilingual_noise | 26 | 26 | 0 | 0 |
| novel_requirement | 55 | 0 | 55 | 0 |
| step_pressure | 46 | 0 | 46 | 0 |
| fallback_route | 20 | 20 | 0 | 0 |
| reordered_requirements | 17 | 17 | 0 | 0 |
| compound_noise | 12 | 12 | 0 | 0 |

## Adaptive weights

Attack curriculum: controlled_no_capability=1.601, controlled_human_input=1.601, controlled_approval=1.601, novel_requirement=1.601, step_pressure=1.601, baseline_success=0.613, multilingual_noise=0.613, fallback_route=0.613, reordered_requirements=0.613, compound_noise=0.613

Repair priority: semantic=0.942, capability=0.942, liveness=0.942, approval=0.942, handoff=0.942, verification=0.942

## Repair contract

The repair loop must optimize **uncontrolled process-integrity failures**, not completion rate. It must not turn a predictable refusal, missing capability, human clarification, approval boundary, bounded timeout, or other controlled terminal failure into invented success.
