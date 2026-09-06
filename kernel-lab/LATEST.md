# Asympta Kernel Recursive Lab — generation 52

Seed: `1812571725`

## Process integrity

- Cases: **320**
- Completed: **35**
- Controlled / predictable failures: **285**
- Uncontrolled failures: **0**
- Process integrity rate: **100.00%**
- Deterministic replay rate: **100.00%**
- New uncontrolled fingerprints: **0**

A controlled failure is a valid terminal result. The lab only treats hangs, non-terminal stalls, nondeterminism, false completion, missing failure ownership/reason, or broken verification/handoff as kernel failures.

## Families

| Family | Total | Completed | Controlled failure | Uncontrolled |
| --- | ---: | ---: | ---: | ---: |
| baseline_success | 1 | 1 | 0 | 0 |
| controlled_no_capability | 64 | 0 | 64 | 0 |
| controlled_human_input | 64 | 0 | 64 | 0 |
| controlled_approval | 73 | 23 | 50 | 0 |
| multilingual_noise | 3 | 3 | 0 | 0 |
| novel_requirement | 57 | 0 | 57 | 0 |
| step_pressure | 50 | 0 | 50 | 0 |
| fallback_route | 1 | 1 | 0 | 0 |
| reordered_requirements | 5 | 5 | 0 | 0 |
| compound_noise | 2 | 2 | 0 | 0 |

## Adaptive weights

Attack curriculum: controlled_no_capability=7.687, controlled_human_input=7.687, controlled_approval=7.687, novel_requirement=7.687, step_pressure=7.687, baseline_success=0.250, multilingual_noise=0.250, fallback_route=0.250, reordered_requirements=0.250, compound_noise=0.250

Repair priority: semantic=0.771, capability=0.771, liveness=0.771, approval=0.771, handoff=0.771, verification=0.771

## Repair contract

The repair loop must optimize **uncontrolled process-integrity failures**, not completion rate. It must not turn a predictable refusal, missing capability, human clarification, approval boundary, bounded timeout, or other controlled terminal failure into invented success.
