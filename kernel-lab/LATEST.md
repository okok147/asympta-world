# Asympta Kernel Recursive Lab — generation 32

Seed: `1613409899`

## Process integrity

- Cases: **320**
- Completed: **49**
- Controlled / predictable failures: **271**
- Uncontrolled failures: **0**
- Process integrity rate: **100.00%**
- Deterministic replay rate: **100.00%**
- New uncontrolled fingerprints: **0**

A controlled failure is a valid terminal result. The lab only treats hangs, non-terminal stalls, nondeterminism, false completion, missing failure ownership/reason, or broken verification/handoff as kernel failures.

## Families

| Family | Total | Completed | Controlled failure | Uncontrolled |
| --- | ---: | ---: | ---: | ---: |
| baseline_success | 9 | 9 | 0 | 0 |
| controlled_no_capability | 58 | 0 | 58 | 0 |
| controlled_human_input | 53 | 0 | 53 | 0 |
| controlled_approval | 65 | 11 | 54 | 0 |
| multilingual_noise | 8 | 8 | 0 | 0 |
| novel_requirement | 60 | 0 | 60 | 0 |
| step_pressure | 46 | 0 | 46 | 0 |
| fallback_route | 10 | 10 | 0 | 0 |
| reordered_requirements | 5 | 5 | 0 | 0 |
| compound_noise | 6 | 6 | 0 | 0 |

## Adaptive weights

Attack curriculum: controlled_no_capability=3.508, controlled_human_input=3.508, controlled_approval=3.508, novel_requirement=3.508, step_pressure=3.508, baseline_success=0.271, multilingual_noise=0.271, fallback_route=0.271, reordered_requirements=0.271, compound_noise=0.271

Repair priority: semantic=0.852, capability=0.852, liveness=0.852, approval=0.852, handoff=0.852, verification=0.852

## Repair contract

The repair loop must optimize **uncontrolled process-integrity failures**, not completion rate. It must not turn a predictable refusal, missing capability, human clarification, approval boundary, bounded timeout, or other controlled terminal failure into invented success.
