# Structured Marketplace Context Runtime

Asympta World has a local, deterministic execution path for natural-language marketplace intentions such as:

- `I want to buy some food.`
- `Get me two meals.`
- `幫我買一啲嘢食。`
- `I want some food and new clothes.`

This path is a simulated city runtime. It does not claim live inventory, contact a real merchant, place a real order, or charge a real payment method.

## Canonical flow

```text
natural-language message
  → explicit message facts
  → approved marketplace profile fills only missing preferences
  → asympta.context.v1 envelope
  → validated goals, facts, unknowns and permissions
  → request-specific marketplace task graph
  → map movement from the deterministic Atlas engine
  → asympta.packet.v1 handoffs between agents
  → simulated inventory reservation
  → explicit human payment checkpoint
  → goods handoff into the selected carrier's cargo
  → personal or courier agent returns home
  → delivery receipt and user-inventory mutation
```

The map is not playing a recorded sequence. The visible route, active agents, approval pause, cargo badge, protocol trace and completion percentage are all derived from current engine tasks and the marketplace ledger.

## Persistent marketplace profile

The browser user-preference record may contain one versioned profile:

```ts
{
  schemaVersion: "asympta.marketplace-profile.v1",
  presetId: "everyday" | "local_delivery" | "plant_friendly" | "custom",
  foodPreference,
  fulfilmentMethod,
  paymentMethod,
  updatedAt
}
```

The provided presets are:

1. `everyday`: anything suitable, personal-agent pickup, Asympta Wallet;
2. `local_delivery`: Cantonese/local food, courier delivery, card-on-file alias;
3. `plant_friendly`: vegetarian food, courier delivery, Asympta Wallet.

A user can instead select each field individually. The profile stores only enum-like preference aliases. It never stores a full address, card number, CVV, bank credential or payment token.

If a request is vague and the needed profile fields are absent, Asympta pauses before map execution and opens the profile selector. Once the user chooses and saves the fields, the same request is recompiled and resumes. The selection is retained in the existing browser preference record for later requests.

Explicit natural-language instructions always override the stored profile. For example:

```text
Saved profile: courier delivery + card on file
Current request: "Buy sushi, let my personal agent pick it up, and pay on delivery"
Result: personal_agent_pickup + pay_on_delivery
```

The saved payment method only tells the finance agent what method to propose. It never authorises a transaction; the existing per-transaction approval checkpoint remains mandatory.

## Context rules

The compiler separates three provenance classes:

- `explicit`: taken from the current user message, with a source reference and evidence span;
- `profile`: taken from an approved profile, with an `approved-profile:` source reference;
- `defaulted`: a safe system default, never represented as something the user said.

Other rules:

- Missing information remains in `unknownFields`.
- A message that only discusses food or clothing without asking to obtain it does not start a purchase workflow.
- Consequential actions require approval.
- Real purchases, real charges, private-address sharing and claims of live stock are prohibited.

## Fulfilment routing

`personal_agent_pickup` keeps the original flow: the personal agent carries the enquiry to the market, receives the goods and returns home.

`courier_delivery` changes the real task graph rather than only changing a label:

```text
store enquiry
→ stock and offer
→ payment approval
→ logistics agent travels to market
→ store hands goods to logistics cargo
→ logistics agent returns to the user
→ delivery receipt
```

The cargo badge attaches to the agent that actually owns the cargo state.

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

Every packet contains a request correlation id, sender, receiver, sequence, goal id, typed payload and simulated provenance. Profile-backed packets also expose the fulfilment and payment aliases without exposing sensitive payment data.

## Inventory invariant

For each requested item, the runtime enforces:

```text
marketAvailable
+ marketReserved
+ carrierCargo
+ userInventory
= initialMarketStock
```

Reservation moves quantity from market availability to reserved stock. Store handoff moves it into either personal-agent or logistics-agent cargo. Delivery moves it into user inventory. A negative quantity or broken conservation invariant fails closed.

## Interface placement

Marketplace context and profile controls live inside the existing top-right current-request card. They are no longer rendered above the centre/bottom intention composer, so they do not obstruct clicking or inspecting map agents.

Both levels are collapsible:

1. the top-right current-request card header collapses the whole request surface;
2. the Marketplace Context row independently collapses its profile, route, packet and context details.

When a first-time request needs profile choices, the top-right card expands once to show the selector. The user can collapse it again at any time.

## Browser inspection

The structured runtime can be inspected through:

```js
window.__ASYMPTA_MARKETPLACE__.compile("buy some food")
window.__ASYMPTA_MARKETPLACE__.runIntent("buy some food")
window.__ASYMPTA_MARKETPLACE__.snapshot()
window.__ASYMPTA_MARKETPLACE__.profile()
```

The interface also emits:

- `asympta:marketplace-context`
- `asympta:marketplace-execution`
- `asympta:marketplace-profile-required`

The on-screen trace exposes the context envelope in a collapsed semantic `<details>` element and labels all results as simulated.
