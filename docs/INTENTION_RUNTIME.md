# Asympta World — Intention Runtime

## Product contract

The product entry point has no preset workflow selector. A user writes an ordinary-language intention in the conversation field. The runtime then performs four separate stages:

1. **Plan** — the server-only OpenRouter adapter asks `openai/gpt-oss-120b:free` for either bounded clarification or a JSON task graph.
2. **Validate** — local code normalises identifiers, restricts agents/locations/actions to a whitelist, verifies a DAG, and forces consequential actions behind human approval.
3. **Execute** — a deterministic world state machine advances movement, work, handoffs, approvals, completion and audit events. The model never directly mutates the world.
4. **Verify** — every state candidate is checked against invariants before commit. Invalid mutations are rejected and the previous valid world is retained.

## Secret boundary

`OPENROUTER_API_KEY` is read only inside `app/api/asympta/plan/route.ts`. It must be configured as a deployment secret or local environment variable. It must never be placed in a client component, a `NEXT_PUBLIC_*` variable, Git history, logs, screenshots, or rendered JSON.

The public GitHub Pages build calls the server-hosted planner proxy. `NEXT_PUBLIC_ASYMPTA_AGENT_API_URL` may contain the public proxy URL, but never a credential.

## Model and fallback

The adapter pins the model slug to `openai/gpt-oss-120b:free`; it does not use the random `openrouter/free` router. If the secret is absent, the free provider is rate-limited, or structured output fails validation, the runtime creates a clearly labelled request-specific deterministic plan. It never claims the model succeeded when it did not.

## Approval boundary

These simulated action types always require direct human approval:

- `reserve_capacity`
- `place_order`
- `authorize_payment`
- `commit_contract`
- `release_shipment`
- `send_external_message`

WebMCP can submit an intention and inspect a pending approval, but it cannot grant or decline approval.

## Verification commands

```bash
npm run lint
npm run typecheck
npm run test:engine
npm run build
npm run test:rendered
npm run export:pages
node scripts/smoke-pages-browser.mjs
```
