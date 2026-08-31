# Asympta Task Kernel v0.3

## North star

A human intention creates exactly one durable task. Language models and external agents are replaceable workers inside that task; they are never the authority for the current state.

```text
Human intent
  -> Task Kernel
  -> atomic requirements
  -> typed answers / profile / world resolution
  -> bounded specialist agent mesh
  -> policy and approval gate
  -> execution adapter
  -> independent verification
  -> completion receipt
```

## Canonical state

`AsymptaTaskState` is versioned as `asympta.task/0.3` and contains:

- immutable root intent;
- monotonic `revision`;
- atomic requirements and provenance;
- human locks;
- bounded assignments and delegation depth;
- approvals;
- evidence;
- plan;
- result or failure;
- append-only task events;
- processed command IDs for idempotency.

Communication packets and natural-language summaries remain presentation and audit data. They are not the state authority.

## Typed commands

The browser calls typed operations:

```ts
answerRequirement({
  commandId,
  taskId,
  requirementId,
  expectedRevision,
  value,
  label,
});
```

A stale `expectedRevision` is rejected. Replaying the same `commandId` is idempotent. Human-confirmed values are locked and cannot be overwritten by agent patches.

The adaptive UI never rebuilds a continuation prompt such as:

```text
Buy a television
User-confirmed details: screen size 55 inches ...
```

Instead it reads the next unresolved requirement from TaskState and writes the answer directly into that same task.

## Agent mesh

The initial logical mesh contains:

1. intent interpreter;
2. domain specialist;
3. dynamically delegated researchers or coordinators;
4. independent verifier.

Current specialist routes include consumer electronics and event discovery. Agents submit bounded `AsymptaAgentPatch` operations; the Task Kernel validates revision, assignment identity, scope, delegation depth, assignment count, human locks and approval boundaries before applying a patch.

The same underlying model may serve several logical roles initially. Role, scope, input contract and output patch contract remain separate so agents can later move to different models or services.

## Internal, external and tool boundaries

```text
Internal logical agents -> AsymptaAgentPatch
External independent agents -> A2A adapter
Tools, APIs and resources -> MCP adapter
Human decisions -> typed UI primitives
```

No internal agent directly mutates another agent's memory or the browser UI.

## Safety

- Simulated work is explicitly marked simulated.
- Live writes stop at an approval record.
- Approval does not imply execution; a connected executor and evidence are still required.
- Current built-in offer discovery produces simulated candidates and never claims live inventory or price.
- Sensitive requirements stay protected in task evidence.

## Browser integration

`AsymptaTaskKernelBridge` exposes `window.__ASYMPTA_TASK_KERNEL__` and stores a bounded set of recent task snapshots in `sessionStorage`.

`AsymptaIntentComposer` creates a task when the public interpreter asks for clarification. `AsymptaAdaptiveInteraction` then calls `answerRequirement()` directly. Task updates are projected back into the activity and current-request surfaces through `asympta:task-kernel` events.

## Current TV flow

```text
Buy a television
  -> screen size
  -> brand preference
  -> delivery location
  -> electronics specialist
  -> retailer search agent (simulated offer set)
  -> logistics agent (simulated fulfilment plan)
  -> independent verifier
  -> verified simulated result
```

Selecting an option never starts a new intent request and cannot return to an already-confirmed field.
