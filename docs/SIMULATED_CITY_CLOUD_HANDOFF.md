# Simulated City + OpenRouter Cloud Handoff

## Product goal

Build a hybrid (not 100% preset) simulated city where stores, businesses and users have agents. A person writes a natural-language intention; OpenRouter reads a bounded city snapshot, selects a safe READ or WRITE REQUEST plan, and Asympta shows the selected agent working. All writes affect the simulation only.

## Current state

- `main` commit `0df40c4` contains the new top-left WebMCP READ / WRITE REQUEST card, current-request card, information journeys, server-only OpenRouter integration, two independent research agents plus one cross-check agent, and source-less research support.
- Cloudflare Worker version `c52a789f-71a7-451a-8ba2-7c885da75be3` is deployed.
- The OpenRouter key is a Cloudflare secret and is not in browser code or the repository. Rotate it because it was pasted into chat.
- 149 local tests pass; typecheck and Pages export pass.
- GitHub Pages run `33319958976` failed only because the old hydration smoke still required the removed schedule card. `scripts/smoke-pages-browser.mjs` has a local fix that validates the new access/request cards and must be committed with this handoff.

## What remains unfinished

OpenRouter currently classifies goals, extracts weather locations, creates action proposals, and performs multi-agent research, but it does **not yet read or mutate the Atlas city state**. The 10 foreground agents, ambient actors, four workflows and task graphs are still deterministic. This is acceptable for this stage if the model genuinely chooses the city operation, target agent and arguments from unfamiliar natural language.

## Minimal cloud implementation

1. Add a bounded `cityContext` to `PublicAgentRequest` in `lib/asympta-public-agent-contract.ts`: current phase, workflow, pending-approval count, and at most 10 `{id, role, status}` agents. Never include coordinates, credentials, local storage, or personal data.
2. In `cloudflare/intent-agent/src/index.ts`, add an allowlisted `cityPlan` to the classifier output:
   - access: `READ` or `WRITE_REQUEST`
   - operation: `observe_city`, `inspect_agent`, `send_simulated_message`, `start_simulated_workflow`, or `request_simulated_action`
   - targetAgentId: one of the 10 known Atlas agent IDs
   - workflowId/actionType: allowlisted enum or `null`
   - message/reason: bounded plain text
3. Validate every field fail-closed. READ plans cannot mutate. WRITE REQUEST plans only create a pending human approval; they must never directly approve themselves.
4. In `components/asympta-intent-composer.tsx`, send the bounded snapshot from `window.__ASYMPTA_DEMO__.snapshot()` and dispatch the validated plan to the city.
5. In `components/asympta-world-live-60hz.tsx`, listen for that plan, select/follow the model-chosen agent, execute READ immediately, or use `requestWebMcpWorkflow` / `requestWebMcpAction` to queue a simulated write for human approval.
6. Preserve read-after-write evidence: include the exact request ID, selected agent, operation and bounded reason in `atlasSnapshot`; `asympta_observe_living_city` or `asympta_read_request` must read it back.

## Acceptance examples

- “看看城內哪個商戶 agent 有空處理一宗蛋糕查詢” → model chooses READ/inspect and a valid business agent; state revision does not change.
- “請物流 agent 記錄一個模擬取件請求” → model chooses WRITE REQUEST/logistics; one pending approval appears; no real shipment occurs.
- Two novel prompts should produce different validated agent/operation/arguments without matching a hard-coded sentence.

## Required tests

- Reject unknown agents/operations, extra keys, oversized context and credentials.
- Prompt-injection text inside city context remains untrusted data.
- READ does not change revision; WRITE REQUEST changes only the pending-request revision until human approval.
- Stale/aborted plans cannot overwrite a newer request.
- Browser E2E proves: natural language → OpenRouter plan → selected moving agent → simulated state write → exact read-back.
- Keep the existing 149-test suite, typecheck, secret scan, Pages export, Worker dry-run and live Turnstile test green.

## Resume commands

```bash
npm run test:all
npm run typecheck
npm run lint
npm run export:pages
npx wrangler deploy --dry-run --config cloudflare/intent-agent/wrangler.jsonc
```

Deploy the Worker first, then push `main`, wait for GitHub Pages Actions, and verify the public URL. Do not claim completion until both deployments and one live novel-prompt read/write demonstration succeed.
