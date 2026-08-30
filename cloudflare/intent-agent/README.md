# Asympta public intent agent

Standalone Cloudflare Worker for the public Asympta World intent composer.

## Routes

- `GET /health`
- `POST /v1/intent`
- `OPTIONS /v1/intent`

The production browser origin is exactly `https://okok147.github.io`. HTTP localhost, `127.0.0.1`, and `[::1]` origins are accepted only when `ENVIRONMENT` is `development` or `test`. Production intent requests without an Origin are rejected.

## Required Cloudflare secrets

Set both values as Worker secrets. Never put their values in this repository, a frontend variable, a Pages build, or a command committed to shell history.

```sh
npx wrangler secret put OPENROUTER_API_KEY --config cloudflare/intent-agent/wrangler.jsonc
npx wrangler secret put TURNSTILE_SECRET_KEY --config cloudflare/intent-agent/wrangler.jsonc
```

Use a newly rotated, dedicated OpenRouter key with its own provider-side spending limit. If an initial deployment temporarily used a key that had been pasted into chat or otherwise exposed, rotate it immediately and replace the Worker secret before treating the deployment as production-ready.

Configure the production Turnstile widget in **Non-Interactive** mode so its browser challenge runs without a checkbox or visitor click. It must issue tokens with action `asympta_public_intent` and allow the GitHub Pages hostname. The frontend uses explicit `execute` with interaction-only appearance and automatic transient-error retry; the Worker validates both action and hostname through server-side Siteverify.

## Public-usage guards

- Cloudflare Rate Limiting binding: 10 requests per 60 seconds per edge key for burst protection.
- Durable Object `DailyGlobalBudget`: one strongly consistent global counter with a default UTC-day limit of 500 accepted requests.
- Turnstile server validation before budget consumption.
- 16 KiB request body limit and 600-character intent limit.
- Bounded upstream timeouts, output sizes, tool calls, and source count.

The single global Durable Object deliberately favours an exact low-volume demo budget over high-throughput sharding. Raise the limit only together with a provider-side spending cap.

## Model and safety boundary

The default model is `minimax/minimax-m3:free`; `OPENROUTER_MODEL` is a non-secret Worker variable and may override it. Every response reports the actual configured model in provenance.

The first model call only classifies the goal. The model is instructed to return one schema-shaped JSON object, then the Worker validates every field, allowed key, enum, length, and cross-field safety invariant locally before using it. This avoids trusting provider-specific structured-output support.

Weather reads Open-Meteo. Research runs two independent agents in parallel. Each agent may make exactly one bounded `openrouter:web_search` server-tool call and cannot see the other agent's report. A third model call receives both bounded reports, has no tools, and must compare consensus, material conflicts, missing evidence, and uncertainty before returning the final plain-text answer. These research and synthesis calls do not request provider-specific strict response schemas.

Only formal `url_citation` annotations from the two search calls can become returned sources; model-authored URLs are never promoted. If OpenRouter returns no valid URL annotations, the request still succeeds with `sources: []`, `verification.status: "not_verified"`, and an explicit note that the two-agent cross-check has no verifiable source links. When valid annotations exist, they are normalized, merged, deduplicated, capped at four, and the result remains `partially_verified` until a person opens the originals. One research request therefore uses four model calls in total: classification, two bounded searches, and one no-tool cross-check. OpenRouter currently lists Parallel search at USD 0.005 per search, so this configuration has a USD 0.01 search surcharge per research request before any model-token cost; the 500-request daily guard therefore caps the search-only worst case at USD 5 per UTC day. Keep the exact global request budget and a provider-side spending cap aligned with current [OpenRouter web-search pricing](https://openrouter.ai/docs/guides/features/server-tools/web-search).

An action is only a proposal with `requiresConfirmation: true`; this Worker has no side-effect connector and never executes it.

## Local validation

Use test Turnstile credentials only in local secret storage. Production secrets are not available to local development automatically.

```sh
npm run test:intent-agent
npx wrangler deploy --dry-run --config cloudflare/intent-agent/wrangler.jsonc
```

Deployment is intentionally a separate, explicit step.
