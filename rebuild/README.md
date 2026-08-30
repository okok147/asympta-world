# Asympta World

**A conversation-first, validated agent simulation.**

Asympta World no longer plays preset workflows. A user states an intent in ordinary language; a planning model proposes a bounded plan; agents coordinate inside the world; and the runtime accepts each state change only after validation.

## Core loop

```text
user intent
  → GPT-OSS plan (free OpenRouter route)
  → allowlisted action
  → schema + precondition validation
  → immutable candidate state
  → postcondition + global invariant validation
  → commit world revision or reject
  → evidence ledger
```

The language model is a planner, not a state authority. It cannot directly mutate the simulation.

## What changed

- Removed preset workflow selection from the product experience.
- Added one natural-language conversation field for arbitrary user intents.
- Added intent-specific plan generation through a server-side OpenRouter adapter.
- Added deterministic local planning when the free model route is unavailable.
- Added an allowlisted simulation action protocol.
- Added preconditions, postconditions, immutable state transitions, global invariants, and an evidence ledger.
- Added one bounded repair attempt and a hard transition limit.
- Added live agent movement, camera following, world activity, progress, estimated remaining simulation time, and world revision display.
- Added Plan, Actions, and State inspectors.
- Persisted the user's language preference.
- Kept the system explicitly simulation-only: it does not perform real payments, orders, bookings, or external communications.

## Free-only OpenRouter configuration

The API route accepts only these model IDs:

```text
openai/gpt-oss-120b:free
openai/gpt-oss-20b:free
```

The larger free GPT-OSS route is the default; the smaller free route is the only model fallback. Paid model IDs and client-provided model overrides are rejected by design.

Set the key as a **server-side deployment secret**:

```bash
OPENROUTER_API_KEY=your_rotated_key
OPENROUTER_MODEL=openai/gpt-oss-120b:free
OPENROUTER_SITE_URL=https://your-domain.example
OPENROUTER_APP_NAME=Asympta World
```

Never prefix the key with `VITE_`; that would expose it to the browser bundle. Never commit `.env` files.

## Local development

Requirements: Node.js 20 or newer.

```bash
npm install
cp .env.example .env.local
npm run dev:full
```

`npm run dev` starts only the Vite client. `npm run dev:full` uses Vercel's local runtime so `/api/agent` is available.

## Validation

```bash
npm test
npm run build
npm run check
```

The lifecycle tests cover:

- initial world invariants;
- immutable candidate transitions;
- quote/reservation/order/preparation/handoff/delivery/verification/completion;
- rejection of an invalid early delivery;
- rejection of unsupported model actions;
- discovery-before-contact for new service entities.

## Security boundary

The OpenRouter credential is read only from `process.env.OPENROUTER_API_KEY` inside `api/agent.js`. It is never returned to the client, stored in simulation state, written into logs by the application, or included in the repository.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the execution and validation model.
