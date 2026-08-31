# Structured Marketplace Context Runtime

Asympta World now has a local, deterministic execution path for natural-language marketplace intentions such as:

- `I want to buy some food.`
- `Get me two meals.`
- `幫我買一啲嘢食。`
- `I want some food and new clothes.`

This path is a simulated city runtime. It does not claim live inventory, contact a real merchant, place a real order, or charge a real payment method.

## Canonical flow

```text
natural-language message
  → asympta.context.v1 envelope
  → validated goals, facts, unknowns and permissions
  → request-specific marketplace task graph
  → map movement from the deterministic Atlas engine
  → asympta.packet.v1 handoffs between agents
  → simulated inventory reservation
  → explicit human payment checkpoint
  → goods handoff into personal-agent cargo
  → personal agent returns home
  → delivery receipt and user-inventory mutation
```

The map is not playing a recorded sequence. The visible route, active agents, approval pause, cargo badge, protocol trace and completion percentage are all derived from current engine tasks and the marketplace ledger.

## Context rules

The compiler separates explicit facts from system defaults:

- Facts taken from the message include their source reference and evidence span.
- Missing information remains in `unknownFields`.
- A demo-safe default is marked `defaulted` and sourced from `system_default`; it is never represented as something the user said.
- A message that only discusses food or clothing without asking to obtain it does not start a purchase workflow.
- Consequential actions require approval.
- Real purchases, real charges, private-address sharing and claims of live stock are prohibited.

## Structured communication

Agents exchange versioned packets rather than relying on prose alone:

- `intent`
- `context_envelope`
- `enquiry`
- `availability`
- `offer`
- `verification`
- `approval_request`
- `payment_authorized`
- `goods_handoff`
- `delivery_receipt`

Every packet contains a request correlation id, sender, receiver, sequence, goal id, typed payload and simulated provenance.

## Inventory invariant

For each requested item, the runtime enforces:

```text
marketAvailable
+ marketReserved
+ carriedByPersonalAgent
+ userInventory
= initialMarketStock
```

Reservation moves quantity from market availability to reserved stock. Store handoff moves it into personal-agent cargo. Delivery moves it into user inventory. A negative quantity or broken conservation invariant fails closed.

## Browser inspection

The current structured runtime can be inspected through:

```js
window.__ASYMPTA_MARKETPLACE__.compile("buy some food")
window.__ASYMPTA_MARKETPLACE__.runIntent("buy some food")
window.__ASYMPTA_MARKETPLACE__.snapshot()
```

The interface also emits:

- `asympta:marketplace-context`
- `asympta:marketplace-execution`

The on-screen trace exposes the context envelope in a collapsed semantic `<details>` element and labels all results as simulated.
