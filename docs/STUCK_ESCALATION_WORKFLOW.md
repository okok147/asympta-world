# Stuck Escalation Workflow

Asympta World treats a stuck task as a coordination problem, not a reason to reset the world.

This document is intentionally small and executable in spirit. The product behavior is covered by automated tests.

## Invariant

A blocked task must preserve:

- current workflow identity
- completed tasks
- money balances
- inventory and resource state
- agent positions and history
- commitments and message history

A stuck state is therefore resumed in place. It is never repaired by silently starting a fresh workflow.

## Demonstration case: Service Recovery

The Service Recovery workflow contains one deterministic demonstration escalation during supplier recovery planning:

1. `agent-supplier` begins the recovery-capacity task.
2. The current path becomes stuck because the ordinary supplier route cannot satisfy the recovery window.
3. The task becomes `blocked` and the workflow pauses in place.
4. A structured escalation is created and surfaced as an animal-to-animal cooperation message.
5. `agent-business` acts as the higher coordination agent and evaluates an already-available alternate path.
6. The higher agent resolves the escalation without creating a fresh world or restoring initial balances.
7. The original supplier task resumes from the blocked point.
8. Downstream tasks continue normally until the workflow completes.

The escalation is deliberately time-bounded and deterministic so it can be reproduced in tests and in the visible demo.

## Human decisions are different

A human-declined approval is not automatically overridden by escalation. Human approval remains authoritative. The automatic escalation path applies to operational/coordination stuck states, not a user saying no.
