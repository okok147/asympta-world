# CURRENT MAIN PRODUCT STATE — 2026-08-28

The calm multi-party Asympta World redesign is now the source of truth. Do not restore the rough WebMCP demo/dashboard visual language. Preserve the paper-like Asympta aesthetic, one-world stakeholder process, deterministic event engine, WebMCP truthfulness, human approval boundaries, responsive design and reduced-motion support.

---

# Asympta World — active repository instructions

## Active request from KL — 2026-08-28

Status: **IMPLEMENTED ON MAIN — 2026-08-28**

This note is committed directly to `main` so the Codex session currently running on KL's home machine can receive the next product requirement without overwriting its in-progress work.

**IMMEDIATE MUST-READ RULE:** before making the next feature change, read `MUST_READ_ME.md` at the repository root in full. Treat it as the latest highest-priority product directive. It adds both the multi-party economic coordination requirement and the new aesthetic/simple/elegant/product-grade art direction.

**Coordination rule:** do not interrupt, reset, discard, or overwrite the work already in progress on the home machine. Finish or safely checkpoint the current work first, then fetch/rebase the latest `main`, read this file again, read `MUST_READ_ME.md`, acknowledge it, and integrate this directive with the current implementation.

### 1. Mandatory, externally verifiable acknowledgement to KL

As soon as you read this latest note, **before changing feature code for this directive**, complete both acknowledgement steps below.

1. Reply in your current Codex conversation with:

> Received. I will extend Asympta World from a requester-side demo into a visible multi-party real-world coordination system showing customer, business, supplier/material, fulfilment, logistics, payment/approval, and other relevant actors working together end to end, while preserving the current agent process and work already in progress. I will also apply the product-grade visual direction in MUST_READ_ME.md.

2. Create `HOME_CODEX_ACKNOWLEDGEMENT.md` at the repository root with exactly this structure:

```markdown
# Home Codex acknowledgement

Status: RECEIVED
Request: Multi-party real-world economic coordination + product-grade visual refinement
Response: Received. I will add the requested feature and visual refinement without overwriting current work.
Acknowledged at: <actual UTC ISO-8601 timestamp>
```

Commit **only that acknowledgement file** with message `chore: acknowledge must-read directive` and push it to `main` before implementing this directive. Preserve any unrelated local or in-progress changes; do not stage them merely to send this acknowledgement.

Only continue implementation after GitHub confirms that acknowledgement commit was pushed successfully. Do not say the request was received unless you have actually read this latest file, read `MUST_READ_ME.md`, and inspected the current repository state.

### 2. Product outcome

Do not show only the current requester-side agent process, and do not stop at a simple buyer-versus-business flow. Extend the living world so people can understand a **complete real-world economic coordination network**.

The demonstration should make it visually obvious that one human intention can trigger coordinated work across many independent sides:

- customer / requester and personal agents;
- merchant / business receiving and operations agents;
- sales / clarification / customer-service agents;
- inventory and warehouse agents;
- upstream supplier and procurement agents;
- material preparation / production agents;
- quality-control agents;
- packing and fulfilment agents;
- logistics / courier / carrier agents;
- payment, invoice, approval, and settlement actors;
- optional specialist/service providers where relevant;
- return, exception, support, or after-sales actors when a scenario needs them.

The core idea is **not a task list and not a prerecorded animation**. It is a legible, autonomous exchange among multiple agent societies representing the real sides of an economy.

### 3. Required end-to-end flagship demo

Add one polished **Business Order / Supply Chain** scenario, reachable from the existing UI and by a clear slash command such as `/order`.

Use a concrete order that naturally demonstrates materials, suppliers, business operations, fulfilment, and shipping—for example a small business fulfilling an order for 12 customised notebooks—while keeping the lifecycle reusable for food, retail, services, manufacturing, local commerce, and future connectors.

The canonical event-driven state should visibly progress through something equivalent to:

`request_created → sent_to_business → received → needs_clarification → confirmed → inventory_check → supplier_check → materials_reserved/procured → materials_preparing → production_or_fulfilment → quality_check → packed → payment_or_dispatch_approval → ready_to_ship → carrier_handoff → shipped → delivered_or_completed`

Include explicit exception states where appropriate, such as:

`awaiting_customer`, `material_shortage`, `supplier_delay`, `price_change`, `payment_blocked`, `quality_failed`, `shipping_blocked`, `delivery_exception`, or `return_requested`.

The flagship demo must include at least one meaningful clarification and at least one cross-organisation handoff so the viewer can see that coordination is genuinely multi-sided.

### 4. What the person must be able to see

Keep the current calm Asympta World visual language, but make the full process inspectable inside the world rather than hiding it in enterprise dashboards.

The demonstration should visibly show:

- the requester forming an intention and delegating it to an agent;
- the request/order packet travelling to a real business-side receiving agent;
- the business validating requirements and asking concise questions when information is missing;
- the customer side answering and the business resuming automatically;
- inventory agents checking what is already available;
- procurement agents contacting one or more simulated suppliers when stock/material is insufficient;
- supplier-side agents quoting, confirming availability, reserving, preparing, and handing materials over;
- material/inventory quantities changing consistently across stages;
- fulfilment or production agents moving to relevant zones and doing work in dependency order;
- quality control accepting or rejecting work and triggering rework when required;
- packing and dispatch preparation;
- payment/invoice/approval packets when economically consequential actions are reached;
- a logistics/carrier handoff and simulated tracking after approval;
- delivery/completion confirmation and optional after-sales follow-up;
- concise communication packets/dialogue for enquiry, quote, confirmation, exception, decision, status, and handoff;
- a compact chronological audit trail explaining why the world advanced, paused, rerouted, or requested human approval.

Actors from different sides should be visually distinguishable, but the experience must remain one living world—not separate admin screens.

### 5. Multiple real-world cases

Do not hard-code the architecture around one notebook order. The demo should provide or prepare reusable scenario definitions so Asympta World can demonstrate many forms of economic activity with the same coordination engine.

At minimum, make the system capable of representing examples such as:

1. **Retail / custom product:** customer → merchant → supplier/material → fulfilment → courier.
2. **Food / dinner:** person → restaurant → ingredient/inventory → kitchen → courier → person.
3. **Service booking:** person/company → service business → staff/resource scheduling → work → invoice/completion.
4. **Office procurement:** employee → company approval → vendor → stock → shipping → receiving.
5. **Repair / maintenance:** customer → service desk → diagnosis → parts supplier → technician → return delivery.
6. **Small manufacturing:** buyer → producer → raw-material supplier → production → QC → freight.
7. **Digital/knowledge work:** requester → agency/business → specialist agents → review/approval → delivery/payment.

Not every case needs a fully separate UI. Prefer one reusable event/state model with scenario templates and a small set of polished demo entries.

### 6. Autonomy and realistic activity

The world must remain self-propelled and event-driven.

Agents should be able to generate realistic runtime events rather than simply play a fixed script, including:

- incoming enquiries and orders;
- businesses accepting, declining, or requesting clarification;
- supplier availability changes;
- low stock and replenishment;
- quote changes;
- preparation delays;
- quality failures and rework;
- carrier delays or rerouting;
- payment/approval holds;
- completion, return, or follow-up events.

Use seeded/deterministic variation for tests while allowing believable runtime variation in the demo.

### 7. Safety, approval, and truthfulness

Preserve the existing human approval boundary.

- Purchasing missing materials, charging money, accepting binding quotes, confirming consequential orders, issuing refunds, or dispatching shipments must stop for human approval where appropriate.
- Do not claim that any supplier, carrier, payment, purchase, business, or shipment is live unless a real connector exists.
- Clearly label demo/simulated data and tracking.
- Preserve tool provenance (`live`, `demo`, or `simulated`).
- Never display private full addresses, payment details, or other sensitive information in broad world observations or WebMCP output; use safe summaries.

### 8. Architecture and WebMCP

Build on the existing canonical deterministic event engine instead of creating separate animation-only state.

- UI, movement, dialogue, semantic DOM, `render_game_to_text()`, and WebMCP observations must reflect the same canonical economic state.
- Model organisations, actors, orders/jobs, resources/materials, messages, approvals, handoffs, exceptions, and provenance as reusable structured state.
- Every significant handoff should be represented as an actual event/state transition, not just visual text.
- Expose enough structured state for a browser agent to inspect all participating sides, open questions, inventory/materials, supplier status, fulfilment progress, approvals, exceptions, payment/settlement state, and shipment/completion state.
- Prefer extending the existing narrow tools cleanly; add scenario- or order-specific tools only when they provide a clearer contract.
- Do not regress the current Dinner, Work, Shopping, Email, or other existing scenarios.

### 9. Performance and design constraints

- Follow `MUST_READ_ME.md` for the latest art direction.
- The product must feel **aesthetic, simple, elegant, calm, premium, and product-grade**, not like a rough hackathon demo.
- Interpret the desired standard as the level of refinement associated with a premium modern product website: strong spacing, clear hierarchy, restrained palette, elegant typography, subtle depth, refined cards/panels, and intentional motion.
- Do **not** copy Apple branding, logos, marketing assets, or site layouts. Use the reference only as a quality bar for clarity, restraint, polish, and finish.
- Preserve the distinct pixel-world identity and animal agents, but refine them so the result looks intentional rather than toy-like or placeholder-like.
- Do not replace the world with dense enterprise tables, giant graphs, or a conventional ERP dashboard.
- Use movement, spatial zones, small cards, dialogue packets, status glyphs, and lightweight trails to make coordination understandable.
- Reduce visual noise. Prefer fewer, better-presented elements over showing every piece of state at once.
- Make landing/demo presentation, world scene composition, cards, messages, controls, empty states, transitions, and responsive layouts feel coherent and launch-ready.
- Keep essential state accessible through semantic DOM content; canvas remains progressive enhancement.
- Preserve mobile layouts, keyboard access, reduced-motion behaviour, performance gates, and deterministic replay.
- Reuse existing architecture/components where sensible; avoid a broad rewrite while KL's current work is in progress.

### 10. Acceptance checks

Before claiming completion, verify all of the following:

1. A user can start the flagship multi-party order scenario from the visible UI and slash command.
2. The requester-side task visibly reaches a business receiving agent.
3. A missing/ambiguous detail pauses the process, creates a visible question, receives an answer, and resumes.
4. The business checks inventory/materials and, when needed, visibly reaches an upstream supplier.
5. Supplier-side availability/reservation/preparation is visible and consistent with business-side inventory state.
6. Multiple organisations' agents visibly move, communicate, and hand work/resources to one another.
7. Fulfilment/production, quality check, packing, and logistics occur in dependency order.
8. Consequential purchases, payment/settlement actions, and dispatch respect human approval boundaries.
9. Approval produces only honestly labelled simulated supplier/payment/shipment results unless real connectors exist.
10. At least one realistic exception can reroute or pause the flow without breaking state invariants.
11. The complete flow is inspectable through semantic UI, `render_game_to_text()`, and WebMCP.
12. The visible product passes the qualitative bar in `MUST_READ_ME.md`: aesthetic, simple, elegant, restrained, coherent, and launch-quality rather than merely demo-like.
13. Existing scenarios and responsive/reduced-motion behaviour still work.
14. Add deterministic engine tests for happy path, clarification pause/resume, supplier/material shortage, exception recovery, approval decline/acceptance, multi-party handoff ordering, and state invariants.
15. Run the repository's lint, typecheck, engine tests, build, rendered tests, and export verification before reporting success.

### 11. Coordination and delivery

Preserve all existing user work. Inspect `git status` and the latest `main` before editing; never reset, discard, or overwrite unrelated changes.

Because Codex is already working on KL's home machine:

- safely checkpoint the current local work first;
- fetch the newest remote `main`;
- integrate/rebase without discarding local changes;
- reread this `AGENTS.md` and `MUST_READ_ME.md` after the update;
- acknowledge this directive as specified above;
- then extend the existing implementation rather than starting a competing rewrite.

After implementation and verification:

- give KL a concise summary of what is now visibly different;
- report exact test/build evidence;
- report specifically how the product/art direction was upgraded;
- commit and push the completed feature to `main` only after safely integrating the latest remote changes;
- do not claim the push or deployment succeeded without tool output proving it.
