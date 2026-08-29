# Asympta World Scenarios

Asympta World scenarios initialize conditions; they do not dictate every dialogue/action. Existing deep multi-stakeholder workflow graphs remain the task layer, while the canonical runtime adds finite resources, disruption, information boundaries, commitments and consequences underneath them.

## A. Custom order / retail supply

Participants include customer, merchant, primary/alternate suppliers, finance, operations, quality, logistics and support.

Canonical runtime conditions:

- accepted finite-quantity order
- limited primary supply
- larger but more expensive alternate supply
- finite fulfilment capacity
- explicit payment ledger
- delivery commitment/deadline
- courier capacity

Expected emergent behavior: primary supply cannot satisfy the reservation after the seeded disruption, so the reservation intent chooses a feasible alternate supplier. Payment moves money, shipment moves physical inventory into transit, and delivery arrival transfers it to the customer.

## B. Dinner / local service fulfilment

The existing workflow coordinates customer constraints, restaurant, ingredient supply, quality, finance and courier handoff. Runtime quantity and price differ from the custom-order case while using the same world rules. The primary supplier disruption can force alternate sourcing rather than a hard-coded dialogue branch.

## C. Launch stock / manufacturing-style capacity

The launch workflow contains market, customer, supplier, finance, operations, quality, distribution and support stakeholders. Runtime demand is higher, so finite supply/capacity matters more strongly. The same intent validation and reservation conservation rules prevent impossible simultaneous consumption.

## D. Service recovery / B2B-style consequence chain

The existing recovery graph includes failure evidence, commercial obligations, replacement supply, finance, quality, priority logistics and postmortem work. Runtime commitments and reputation provide persistent consequences instead of treating recovery as a successful animation by default.

## E. Information / digital coordination

Every completed Atlas task can publish a structured task-result information packet to dependent agents. Non-dependent agents do not automatically receive it. This lets the existing workflows demonstrate the same information-asymmetry principle for digital work, not only physical goods.

## Seeded disruption

A workflow schedules a reproducible supplier-capacity shock. Direct supply/operations participants learn about it first. A market agent discovers the pressure later through a separate event and shares it with a different set of stakeholders.

This is the acceptance case for:

```text
unexpected event
-> local observation only
-> constraint at action time
-> alternate plan
-> changed resource allocation
-> downstream causal history
```

## Commitment acceptance case

Every prepared workflow creates an active delivery commitment. Delivery arrival fulfills it. If simulation time reaches the deadline first, the commitment is violated and the runtime applies its simulated penalty/reputation consequence.

## Persistence acceptance case

Mid-workflow state includes pending tasks, runtime event queue, order, reservations/commitments and agent information. Serialization followed by restore must reproduce those states without creating duplicate timers or resources.

## WebMCP acceptance case

1. WebMCP requests a workflow/action.
2. No canonical resource is mutated yet.
3. Human approval is surfaced in the product.
4. On approval, the request becomes a runtime intent.
5. The same validator/action executor used by the product processes it.
6. `asympta_observe_living_city` exposes the resulting canonical state.
7. Rejected intents leave the ledger unchanged and carry a structured reason.
