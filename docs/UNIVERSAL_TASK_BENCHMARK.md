# Universal task benchmark and communication envelope

## Purpose

Asympta World must improve by testing broad task structure, not by adding one hard-coded workflow for every sentence. This benchmark therefore separates:

1. **task archetypes** — reusable real-life coordination shapes;
2. **language variants** — English, Traditional Chinese and Japanese requests;
3. **requirement semantics** — budget, identity, destination, deadline, evidence and other atomic facts;
4. **capability discovery** — which agent or tool can supply a missing fact or execute a step;
5. **communication packets** — the ordered messages that make every decision inspectable;
6. **stress mutation** — reordered, aliased, noisy and previously unseen fields.

The first deterministic suite generates 100 cases from 25 reusable archetypes. A second seeded stress generator mutates those cases, including unseen coordination fields, without adding case-specific branches.

## Canonical packet

Every task runs through `asympta.task/0.2` and emits ordered packets:

`intent → requirements → fact/discovery → handoff → proposal → decision → execution → verification → result`

Exceptions and genuine unresolved decisions use `question` or `exception` packets. Packet sequence, requirement resolution, step limits and terminal state are verified before completion.

## Resolution order

For each atomic requirement, the resolver checks:

1. facts explicitly supplied by the user;
2. values expressed inside the original intention;
3. approved profile facts;
4. discoverable world or connector state;
5. a safe policy default;
6. a clearly labelled simulated value in benchmark/simulation mode.

An unseen field does not require a new UI component. It is represented as a generic requirement and sent through capability discovery. This is the structural fallback that allows future task types to enter the same protocol.

## Autonomy and safety boundary

The zero-human benchmark is intentionally run in **benchmark/simulated mode with explicit simulated-write authorization**. It may complete purchases, bookings, messages, forms and transfers only as simulated world actions.

Live consequential actions keep the existing safety boundary. High-risk purchases, payments, transfers, submissions, identity use and other external writes do not silently execute merely to satisfy a benchmark. They stop at `needs_human` unless a valid live authorization policy explicitly permits the action.

## Browser verification

The release workflow exports the production site, launches headless Chrome, and then:

- executes 100 generated core cases;
- executes 500 deterministic stress mutations;
- fails on any stuck case, human intervention, loop, step overflow or non-terminal result;
- compiles the natural-language television clarification into four option groups;
- dispatches real `asympta:activity` events into the hydrated React interface;
- verifies that budget and delivery options are visibly rendered;
- checks that delivery destination is not confused with purchase-source location;
- fails on browser exceptions or material console errors.

## What passing means

A passing suite is strong regression evidence that the shared task envelope, requirement resolver, capability router and communication packet can generalize across the tested structures and mutations.

It is not a mathematical proof that every possible future real-world request can complete, because live completion also depends on available tools, permissions, trustworthy data and external services. New failures should be added as minimized regression seeds, then fixed at the semantic resolver, capability or packet-contract layer rather than with one-off sentence matching.
