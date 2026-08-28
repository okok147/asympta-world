# Asympta World — active repository instructions

## Active request from KL — 2026-08-28

Status: **PENDING HOME CODEX ACKNOWLEDGEMENT**

This note was committed directly to `main` so the Codex session running on KL's home machine can receive the next product requirement without overwriting its in-progress work.

### 1. Mandatory acknowledgement to KL

As soon as you read this note, **before changing code**, reply in your current Codex conversation with:

> Received. I will extend Asympta World to visibly show the business-side order fulfilment flow—receiving the order, clarifying details, checking and preparing materials, packing, and shipping—while preserving the current agent process.

Then continue the implementation. Do not say the request was received unless you have actually read this file and inspected the current repository state.

### 2. Product outcome

Do not show only the current requester-side agent process. Extend the living world so people can see **both sides of a real economic interaction**:

- the human/requester and their agents forming and sending an order;
- a business agent receiving the order;
- business-side agents validating and clarifying its details;
- inventory/materials agents checking, reserving, sourcing, and preparing materials;
- fulfilment agents preparing the item, checking it, and packing it;
- a shipping agent arranging dispatch and returning a visible shipment/tracking update.

The important idea is not another task list. It is a legible, autonomous exchange between a buyer-side agent society and a business-side agent society.

### 3. Required end-to-end demo

Add one polished **Business Order** scenario, reachable from the existing UI and by a clear slash command such as `/order`. Use a concrete order that makes materials and shipping understandable—for example, a small business fulfilling an order for 12 customised notebooks—while keeping the underlying lifecycle reusable for future businesses.

The canonical event-driven state should visibly progress through:

`received → needs_clarification → confirmed → materials_check → materials_reserved/preparing → quality_check → packed → ready_to_ship → shipped`

Include explicit exception states where appropriate, such as `material_shortage`, `awaiting_customer`, or `shipping_blocked`.

The demo must include at least one meaningful clarification—such as missing artwork, quantity, finish, deadline, or delivery detail—so the business agent sends a visible question and the requester side returns a visible answer before work continues.

### 4. What the person must be able to see

Keep the current calm Asympta World visual language, but make the business process inspectable:

- clearly distinguish requester/customer-side and business/fulfilment-side actors without splitting the experience into a boring dashboard;
- show the order handoff travelling from the requester side to the receiving business agent;
- show business agents actually moving to relevant service/material/preparation/packing/shipping zones;
- show concise visible communication packets or dialogue for questions, answers, status, decisions, and exceptions;
- show an order card with item, quantity, required details, deadline, and current state;
- show a materials checklist with required, available, reserved, missing, and prepared quantities;
- show preparation, quality-check, and packing progress;
- show a shipment card with carrier/mode, destination summary, dispatch status, and simulated tracking only after approval;
- keep a compact chronological audit trail so the human can understand why the order advanced or paused.

The world should feel self-propelled and event-driven, not like a prerecorded video. Use seeded/deterministic variation for tests while allowing realistic runtime events such as a missing detail, low stock, preparation delay, failed quality check, or shipping change.

### 5. Safety and truthfulness

- Preserve the existing human approval boundary.
- Purchasing missing materials, charging money, confirming an order, or dispatching a shipment must stop for human approval when consequential.
- Do not claim that a supplier, carrier, payment, purchase, or shipment is live unless a real connector exists.
- Clearly label all demo/simulated data and tracking.
- Never display private full addresses in broad world observations or WebMCP output; use a safe destination summary.

### 6. Architecture and WebMCP

Build on the existing canonical deterministic event engine instead of creating a separate animation-only state.

- UI, movement, dialogue, `render_game_to_text()`, and WebMCP observations must reflect the same order state.
- Expose enough structured state for a browser agent to inspect the order, open clarification, materials, fulfilment progress, exceptions, approval boundary, and shipment.
- Prefer extending the existing narrow tools cleanly; add order-specific tools only if they provide a genuinely clearer contract.
- Preserve tool provenance (`live`, `demo`, or `simulated`) and schema validation.
- Do not regress the current Dinner, Work, Shopping, or Email scenarios.

### 7. Performance and design constraints

- Preserve the existing calm, elegant, low-noise experience and distinct animal agents.
- Do not replace the world with dense enterprise tables.
- Keep all essential order state accessible through semantic DOM content; canvas remains progressive enhancement.
- Preserve mobile layouts, keyboard access, reduced-motion behaviour, performance gates, and deterministic replay.
- Reuse the existing architecture and components where sensible; avoid a broad rewrite while KL's current work is in progress.

### 8. Acceptance checks

Before claiming completion, verify all of the following:

1. A user can start the Business Order scenario from the visible UI and slash command.
2. The requester-side order visibly reaches a business receiving agent.
3. A missing/ambiguous detail pauses the order, produces a visible question, receives an answer, and resumes.
4. Materials requirements and reservation/preparation changes are visible and internally consistent.
5. Business agents visibly move and communicate as the state changes.
6. Preparation, quality check, packing, and ready-to-ship stages occur in dependency order.
7. Consequential purchase/dispatch actions wait for human approval.
8. Approval produces only an honestly labelled simulated shipment/tracking result unless a real connector is present.
9. The complete flow is inspectable through the semantic UI, `render_game_to_text()`, and WebMCP.
10. Existing scenarios and responsive/reduced-motion behaviour still work.
11. Add deterministic engine tests for the happy path, clarification pause/resume, material shortage, approval decline/acceptance, and state invariants.
12. Run the repository's lint, typecheck, engine tests, build, rendered tests, and export verification before reporting success.

### 9. Coordination and delivery

Preserve all existing user work. Inspect `git status` and the latest `main` before editing; never reset, discard, or overwrite unrelated changes. Integrate this feature with the work already underway on the home machine.

After implementation and verification:

- give KL a concise summary of what is now visibly different;
- report exact test/build evidence;
- commit and push the completed feature to `main` only after safely integrating the latest remote changes;
- do not claim the push or deployment succeeded without tool output proving it.
