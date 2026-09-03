# Asympta Agent Runtime

Asympta World is **event-driven, AI-ready, and not AI-dependent**.

The deterministic Atlas engine remains the canonical source of truth for the WebMCP demo. Agents no longer need to poll mutable world state to decide when to run: the agent runtime consumes committed world events, filters them through per-agent subscriptions, and wakes only the agents whose work is related to those events.

## Architecture invariant

```text
Committed world event
        ↓
collectCommittedAgentEvents()
        ↓
per-agent subscription filter
        ↓
triggerEvents batch
        ↓
buildAgentContext()
        ↓
Agent Runtime / Provider
        ↓
validated AgentDecision proposal
        ↓
kernel commit adapter
        ↓
canonical world state changes
        ↓
new committed event
        ↓
next subscribed agent(s)
```

The rule remains:

> **Event wakes. Model proposes. Runtime validates. Kernel commits. Human approves consequences.**

A provider never receives direct authority to mutate `AtlasWorldState`.

## Event subscriptions

Every foreground agent has an explicit subscription profile in `profiles.ts`.

- The personal intent agent subscribes to workflow lifecycle events plus related task, message, and approval events.
- Business, supplier, operations, finance, logistics, support, quality, market, and customer agents subscribe to task, message, and approval events addressed to them.
- A completed task is also routed to agents that own dependent tasks, so a committed handoff can wake the next stakeholder without global polling.
- Direct messages wake only their recipient.
- Approval events wake only the responsible agent/task owner; human approval itself is never delegated to a model.

`events.ts` normalises the current Atlas event log, agent messages, and approval records into a bounded `AgentRuntimeEvent` stream. This is a migration bridge for the existing demo state. A production kernel should emit typed canonical domain events directly rather than deriving event kind from the legacy Atlas record shape.

## Idempotency and replay

`AgentEventCursor` stores event IDs seen by each agent. `dispatchEvents()` uses that cursor to provide at-least-once-compatible, duplicate-safe delivery semantics:

- the same committed event is not executed twice for the same agent when the cursor is preserved;
- one event may legitimately wake multiple subscribed agents;
- events are delivered in deterministic time/ID order;
- each dispatch batch wakes an agent at most once and supplies all currently relevant trigger events together;
- cursor history is bounded so the browser demo cannot grow it indefinitely.

Persist the cursor beside the authoritative runtime when moving this flow to a server-owned production kernel.

## Cascading following steps

`runEventDrivenCycle()` implements the event → proposal → commit → next-event loop without granting mutation authority to the model.

The caller supplies a `commit({ world, delivery })` function. That adapter is the kernel boundary: it re-validates the proposal against current state, performs only allowed commands/tool requests, and returns the newly committed world. The runtime dispatches again only when that commit produced a new canonical event.

The cycle has a bounded `maxRounds` guard to prevent accidental event storms. A `wait` decision never calls the commit adapter.

## What exists now

`lib/agent-runtime/` contains:

- `profiles.ts` — goals, capability boundaries, and event subscriptions for every foreground agent.
- `events.ts` — canonical-event normalisation, related-agent routing, subscription filtering, and per-agent idempotency cursors.
- `context.ts` — creates a small, coordinate-free context containing trigger events, the agent's current task, dependencies, recent messages, approvals, and peers.
- `schema.ts` — creates a JSON Schema for exactly the actions currently available to that agent.
- `validator.ts` — treats all provider output as untrusted and normalises only valid decisions.
- `provider.ts` — provider interface plus deterministic and vendor-neutral AI adapters.
- `runtime.ts` — event dispatch, provider execution, validation, fail-closed fallback, and bounded event-driven cascade execution.

The Atlas engine remains the source of truth. The deterministic provider continues to return a safe `wait`, so the demo requires no model API key and no network inference call.

## Supported decision boundary

An agent can propose only:

- `send_message`
- `request_tool`
- `complete_task`
- `wait`
- `delegate`

There is no `approve`, `decline`, `set_world_state`, `set_inventory`, `pay`, or `ship` decision. Consequential work must enter an allowed kernel/tool boundary and then the existing human approval system.

## Example

```ts
import { createAgentEventCursor, createAgentRuntime } from "@/lib/agent-runtime";

const runtime = createAgentRuntime({ provider });
let cursor = createAgentEventCursor();

const result = await runtime.runEventDrivenCycle(world, {
  cursor,
  commit: async ({ world, delivery }) => {
    // Re-read current world state here.
    // Validate delivery.turn.decision against kernel invariants.
    // Commit an allowed command and return the canonical updated world.
    return commitAgentProposal(world, delivery);
  },
});

cursor = result.cursor;
world = result.world;
```

## Failure policy

Provider timeout, malformed JSON, duplicate event delivery, unavailable provider, or an overpowered action must not grant extra authority or stop the world. `createAgentRuntime()` fails closed to the deterministic provider. The kernel commit adapter remains responsible for version checks, idempotent side effects, approval gates, and final state-transition authority.
