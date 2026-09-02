# Asympta Kernel Recursive Cloud Loop

Status: active design for continuous self-play, trajectory learning, and bounded repair.

## Success criterion

The recursive mission optimizes **process integrity**, not raw completion rate.

A case passes when the stakeholder process reaches one of two deterministic terminal outcomes:

1. **Completed** — multiple stakeholder agents actually participated, a real handoff occurred inside the canonical process, verification ran, and the result is receipt/result-backed.
2. **Controlled failure** — the process ends with a stable failure state containing a reason, an owner, and a predictable recovery direction such as human input, reroute, retry/replan, escalation, or stop.

A refusal, missing capability, missing human fact, approval boundary, or bounded failure is not a kernel defect merely because the requested real-world goal was not completed.

A case fails the kernel when it produces an **uncontrolled failure**, including:

- a non-terminal stall or hang;
- state-loop / liveness behaviour without a bounded terminal contract;
- nondeterministic replay of the same case;
- false completion without handoff + verification + result evidence;
- a failure with no reason or no owner;
- an orphan continuation that no stakeholder owns;
- inconsistent process evidence.

## Two recursive loops

### 1. GitHub Actions self-play loop

`.github/workflows/kernel-recursive-loop.yml` runs twice per hour and can also be started manually.

Each generation:

1. restores the previous weighted state from the `kernel-lab-state` branch;
2. generates fresh unseen cases from weighted attack families;
3. executes every case twice through the current Asympta universal task kernel;
4. records a normalized process trajectory;
5. checks deterministic replay;
6. classifies the terminal result as `completed`, `controlled_failure`, or `uncontrolled_failure`;
7. increases attack weight around weak families;
8. increases repair priority around the kernel area implicated by uncontrolled failures;
9. stores the new state and latest trajectories on `kernel-lab-state`;
10. uploads a full 30-day trajectory artifact;
11. opens or updates a GitHub issue only when an uncontrolled process-integrity failure exists.

The loop deliberately keeps generating cases even when the current generation is perfect. Stable families are sampled a little less; controlled failures stay in the curriculum; uncontrolled failures receive the strongest future attack weight.

### 2. Repair loop

The repair loop consumes `kernel-lab-state` and may change main code only for **new reproducible uncontrolled failures**.

Repair priority weights cover:

- semantic interpretation;
- capability routing;
- liveness / loops;
- approval boundaries;
- stakeholder handoff;
- verification / false completion.

A repair must not optimize a controlled failure into fabricated success.

Before any autonomous main-code change is accepted, the candidate must preserve:

- the frozen 1,000-case adversarial suite;
- the frozen 1,000-case semantic holdout;
- the frozen 10,000 extreme-real-world benchmark definition and baseline philosophy;
- engine / type / lint invariants;
- marketplace and literal browser journeys;
- human approval boundaries;
- provenance and simulation truthfulness;
- deterministic replay.

Main is never rewritten merely because completion rate is lower than 100%.

## Persistent state

The cloud runner itself is ephemeral. The recursive mission is persistent because its learned state is externalized to the repository:

- branch: `kernel-lab-state`
- `kernel-lab/state.json` — generation number, cumulative case count, adaptive attack weights, adaptive repair weights, failure fingerprints;
- `kernel-lab/latest-report.json` — latest complete generation;
- `kernel-lab/latest-trajectories.jsonl` — bounded latest trajectory sample;
- `kernel-lab/LATEST.md` — human-readable process-integrity report.

This separates research memory from production `main` while keeping the history inspectable and reproducible.

## Attack families

The initial curriculum includes:

- normal successful coordination;
- no compatible capability;
- missing human-only facts;
- consequential approval boundaries;
- multilingual/noisy language;
- unseen requirements;
- bounded step pressure;
- unknown domain/action fallback routing;
- reordered requirements;
- duplicated / compound noise.

The generator is intentionally not a fixed benchmark. Seeds and family weights change continuously, so each generation produces fresh trajectories while frozen suites remain untouched.

## Why weighted learning is used

The weights are not treated as evidence that a task must succeed. They are a curriculum and repair-priority signal.

If one family exposes uncontrolled behaviour, later generations attack it more frequently. If a reproducible uncontrolled failure maps to liveness, verification, handoff, capability, semantic, or approval logic, the repair loop prioritizes that kernel module.

This makes the recursive system search for **loss of control**, rather than teaching Asympta to pretend the world always cooperates.
