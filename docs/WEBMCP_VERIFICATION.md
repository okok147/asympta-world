# WebMCP Verification — Asympta World

## Goal

Verify that the challenge build is not merely publishing tool metadata. WebMCP must discover usable tools whose read/write results correspond to the same canonical world rendered by Asympta World.

## Browser surface

Asympta World uses the imperative WebMCP API:

```js
document.modelContext.registerTool(...)
```

Core tools remain:

- `asympta_observe_living_city`
- `asympta_list_workflows`
- `asympta_follow_agent`
- `asympta_request_workflow`
- `asympta_request_external_action`

Auxiliary read tools remain:

- `asympta_describe_capabilities`
- `asympta_inspect_agent`
- `asympta_get_pending_approval`

The challenge build intentionally does **not** expose a WebMCP tool that approves/declines consequential actions.

## Canonical-state change in this implementation

`@/lib/atlas-simulation` now resolves to `lib/atlas-canonical-world.ts` for the product build. Therefore existing core WebMCP write handlers call the canonical wrapper without duplicating business logic.

`asympta_observe_living_city` returns `atlasSnapshot(...)`, whose `runtime` field now contains:

- world clock
- current order
- accounts
- inventories
- capacities
- active reservations
- commitments
- scheduled events
- recent causal history
- metrics
- invariant violations

This is the primary proof that WebMCP actions and the displayed world share one state path.

## Automated checks

Run:

```bash
npm run lint
npm run typecheck
npm run test:engine
npm run build
npm run test:rendered
```

Runtime tests cover:

- information asymmetry
- resource reservation competition
- invalid action no-mutation behavior
- payment/inventory conservation
- scheduled delivery
- commitment violation
- persistence round trip
- canonical Atlas integration
- WebMCP request remains non-mutating until human approval

Existing WebMCP contract tests also verify tool uniqueness, JSON-object input schemas, imperative `document.modelContext.registerTool` registration and abort lifecycle.

## Browser verification sequence

In a browser with the current WebMCP testing implementation enabled:

1. Load the deployed Asympta World page.
2. Confirm the page marks the WebMCP qualification state as ready/registered.
3. Inspect registered tools using the browser WebMCP testing surface.
4. Call `asympta_describe_capabilities` and confirm the manifest/safety boundary.
5. Call `asympta_observe_living_city`; verify `foreground.runtime.invariantViolations` is empty.
6. Call `asympta_request_workflow` with a valid workflow ID.
7. Confirm the response says it was queued for human approval and that no workflow starts solely because the tool asked.
8. Approve in the Asympta UI.
9. Call `asympta_observe_living_city` again and confirm the workflow/runtime changed.
10. Reach/request a consequential action such as capacity reservation.
11. Before approval, confirm the resource ledger is unchanged.
12. Approve in the UI.
13. Confirm reservation/order state changed in `foreground.runtime` and the visible workflow continued.
14. Try invalid arguments and verify a structured error/rejection without illegal state mutation.

## Expected canonical reservation example

A seeded supplier disruption reduces primary supply. When the capacity reservation is approved, the runtime validates the primary supplier. If it cannot satisfy the order but a feasible alternate exists, the runtime records `alternative_selected`, changes the order's supplier/reservation and increments `alternativePlansTriggered`.

This behavior comes from world state and constraints, not a pre-scripted dialogue branch.

## Safety boundary

All challenge commerce/payment/shipment effects are simulated. WebMCP may request a consequential simulated action, but the request is queued for explicit human approval. Approval grants permission to attempt the intent; the world validator may still reject it if funds, inventory, capacity, order state or another required condition is missing.

## Evidence to record for submission

For the final challenge evidence, capture:

- live deployed URL
- public repository commit SHA
- WebMCP tool discovery screenshot/log
- valid `asympta_observe_living_city` response showing canonical runtime state
- valid write request waiting for approval
- post-approval state mutation
- invalid request rejection
- GitHub Actions build/test result for the same commit
