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

The Turnstile widget must issue tokens with action `asympta_public_intent` and allow the GitHub Pages hostname. The Worker validates both action and hostname through server-side Siteverify.

## Public-usage guards

- Cloudflare Rate Limiting binding: 10 requests per 60 seconds per edge key for burst protection.
- Durable Object `DailyGlobalBudget`: one strongly consistent global counter with a default UTC-day limit of 500 accepted requests.
- Turnstile server validation before budget consumption.
- 16 KiB request body limit and 600-character intent limit.
- Bounded upstream timeouts, output sizes, tool calls, and source count.

The single global Durable Object deliberately favours an exact low-volume demo budget over high-throughput sharding. Raise the limit only together with a provider-side spending cap.

## Model and safety boundary

The default model is `minimax/minimax-m3:free`; `OPENROUTER_MODEL` is a non-secret Worker variable and may override it. Every response reports the actual configured model in provenance.

The first model call only classifies and validates the goal. Weather reads Open-Meteo. Research may make at most one required `openrouter:web_search` server-tool call and returns sources from OpenRouter URL annotations. An action is only a proposal with `requiresConfirmation: true`; this Worker has no side-effect connector and never executes it.

## Local validation

Use test Turnstile credentials only in local secret storage. Production secrets are not available to local development automatically.

```sh
npm run test:intent-agent
npx wrangler deploy --dry-run --config cloudflare/intent-agent/wrangler.jsonc
```

Deployment is intentionally a separate, explicit step.
