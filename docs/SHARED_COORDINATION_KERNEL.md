# Shared intent/action coordination kernel

Implemented 2026-09-07. This is a bounded, testable kernel candidate, not a claim of a universally correct agent or a new scientific theorem.

## What changed

The user and business simulation workspaces now use the same executable contract:

`source → goal predicates → capability-assigned action DAG → guarded command → simulated adapter result → checked receipt → next action`

The language/domain adapter proposes a graph. The kernel does not contain purchase, notebook, appointment or other scenario keywords. The Atlas engine projects the kernel's authorized actor and destination into actual movement. A timer may request a simulated result; it cannot directly declare success. An action needs verified predecessors, appropriate capability, satisfied preconditions, any required principal approval, an exact result shape, and satisfied postconditions. The final state additionally checks goal predicates and the receipt chain.

The original text and selected option are included in the immutable contract binding. They are not executable authority. Imported packets are recompiled from source and explicit answers; they cannot override their own family, approval policy or action graph. Selection and confirmation remain distinct.

## Modules and boundaries

- `lib/asympta-coordination-kernel.ts`: pure serializable reducer, validation, version checks, replay identity, receipts, routing, bounded corrections and safe summaries.
- `lib/asympta-simulation-coordination.ts`: trusted application capabilities and conservative domain-to-graph adapter.
- `lib/asympta-simulation-compiler.ts`: source extraction, numeric validation, questions, packet review and workflow compilation.
- `lib/atlas-simulation.ts`: execution gate and canonical movement/task projection. Existing workflows without a coordination contract retain their existing engine behavior.
- `lib/atlas-canonical-world.ts`: shared runtime/persistence integration. A contract approval does not accidentally invoke the legacy generic `send_customer_update` adapter.

This release is integrated into both **Simulation** workspaces. It does not claim to have migrated every older marketplace/task-kernel implementation to this contract, or to replace the live connector/authorization layer.

## Reproduced failures and explicit examples

The previous implementation completed both `Quantity: -5` stock tasks and `Quantity: 5 / Capacity: 0` booking tasks. Negative/zero/invalid quantities now request correction; a known booking/service capacity below a known quantity blocks before proposal or execution.

For a supply request with `Quantity: 50 / Stock: 20`, the graph computes shortage 30, routes to the supplier, requests approval, simulates replenishment 30, fulfills 50, and checks remaining stock 0. With stock 100 it routes internally, replenishes zero and checks remaining stock 50. Missing stock is not invented: without both numeric fields the narrower quantitative conservation claim is unavailable. The interface separately counts source fields that still need semantic or external review.

## Corrections, concurrency and repeat safety

Every command includes `commandId` and `expectedRevision`. An identical replay returns the existing state; a reused ID with a changed payload fails. Stale revisions/results cannot commit. Approval is tied to a specific contract epoch. The source and graph are held immutable between corrections using an exact canonical representation stored once, rather than copying a large contract into every receipt.

`correctAtlasCoordination(world, changes, principalId, commandId)` is a host API for numeric source corrections before a consequential result. It increments the epoch, clears pending approvals/grants/results, resets the same workflow and derives its direction again. Old approval IDs cannot approve the revised plan. This is a conservative full pre-commit replan, not fine-grained partial recomputation. After a consequential simulated action has produced a verified result, correction returns `compensation_required`; this version does not silently undo effects or pretend to implement real refunds. The UI supports editing/recompiling a new simulation; an in-flight correction editor is not added in this release.

Bounds: 64 actions, 32 participants, 128 source facts, expression depth 12, 1,024 commands and 16 corrections. Dependency cycles, duplicate output ownership, invalid destinations and consequential actions without an ancestor approval gate are rejected. These bounds contain this interpreter, not the costs or risks of future external tools.

## What the evidence does and does not establish

All receipts are `mode: simulated`, adapter `asympta-simulator/1`. A valid receipt proves consistency with the executable local simulation contract, **not** real delivery, truthful provider input, real stock, fair prices, semantic equivalence to every sentence, or arbitrary user satisfaction. The rule-based adapter still covers only a bounded vocabulary. Uncompiled semantics and external facts remain explicitly reviewable. In particular, accepting a supply replenishment simulation is not evidence that an actual supplier has capacity.

There is no cryptographic attestation or authenticated multi-tenant server in this browser module. The host must authenticate principal/adapter identity, keep authoritative state private from untrusted model/tool code, and persist command acceptance atomically before using this for real effects. A caller with arbitrary JavaScript memory access can replace state and checks; local validation is not an isolation boundary. Real connectors additionally need durable idempotency, access controls, leases/CAS and connector-specific verification/compensation.

The main public snapshot omits raw text, source values, addresses and receipt payloads. The local packet inspector and task-scoped input still contain the user's own source data. Numerical predicates only establish the predicates actually compiled; they do not certify the whole natural-language instruction.

## Reproducible evidence

Run `npm run test:engine` (includes the new suite), or on Node 22.16:

```sh
node --experimental-strip-types --experimental-loader ./scripts/cloudflare-node-loader.mjs --test tests/coordination-kernel.test.mjs tests/simulation-studio.test.mjs
```

The new suite covers symmetry, resource conservation, state-dependent routing/destinations, invalid numbers, capacity blockers, selection/approval separation, policy tampering, wrong actors/results, version conflicts, idempotent replay, approval invalidation, bounded pre-commit correction, forged completion, persisted corruption, runtime-side-effect isolation, privacy and three-locale UI copy.

Its seeded stress test executes **100,000 command checks**, using **128 fixtures and 10 patterns**: 20,000 valid-result/replay checks and 80,000 expected rejections. The extra domain is a tiny lab-sample heating contract with different action vocabulary. This is useful regression evidence, not 100,000 independent real-world scenarios, proof of unseen-domain generalization, a measured 99% real-world success rate, or an LLM benchmark.

The existing extreme real-world v3 semantic benchmark remains a separate diagnostic: this run reports 4,800/10,000 passing (48%), including unresolved typo, date, currency, revocation and noisy-input interpretation cases. The engine regression suite passing does not mean those 10,000 semantic cases all pass. This release strengthens execution contracts; it does not claim to solve that language-understanding benchmark.

## Design references

The separation of task lifecycle, input-required states and artifacts is consistent with the A2A task lifecycle: https://a2a-protocol.org/latest/topics/life-of-a-task/

Human oversight and treating tool annotations as untrusted are consistent with the MCP tools guidance: https://modelcontextprotocol.io/specification/2025-11-25/server/tools

These protocols inspire boundary design. Neither specification guarantees this implementation's correctness; the tested predicates and explicit trust model above are its actual guarantees.
