# Asympta World

> Humans live. Agents coordinate the world around them.

[Live world](https://okok147.github.io/asympta-world/) · [Public source](https://github.com/okok147/asympta-world) · [WebMCP challenge kit](docs/WEBMCP_CHALLENGE_SUBMISSION.md)

Asympta World is a living coordination map built for the WebMCP Challenge. A human chooses an intent and specialised stakeholder agents visibly coordinate the customer, business, supplier, operations, finance, logistics, support, quality and market sides around that intent.

The current challenge build contains four end-to-end simulated workflows: Custom Order, Dinner, Launch Stock and Service Recovery. Agent movement, task dependencies, information exchange, approval state, the map and WebMCP tools all read the same deterministic state engine.

## AI-ready, not AI-dependent

The demo deliberately runs with **zero AI API dependency**. The deterministic Atlas engine remains the source of truth, so the deployed challenge build continues to work without an API key, model availability or inference latency.

At the same time, `lib/agent-runtime/` now provides the future AI boundary: agent profiles, bounded context building, per-agent decision schemas, untrusted-output validation, a deterministic fallback provider and a vendor-neutral AI provider adapter. A future model can be inserted above the engine without rewriting the map, workflows, WebMCP tools or approval system.

Core invariant:

> **Model proposes. Runtime validates. Engine executes. Human approves consequences.**

See [`docs/AI_AGENT_RUNTIME.md`](docs/AI_AGENT_RUNTIME.md) and run `npm run test:agent-runtime`.

## WebMCP is part of the product

The deployed page uses the imperative WebMCP API directly through `document.modelContext.registerTool(...)`. The WebMCP surface is intentionally narrow, schema-bounded and inspectable.

### Core living-world tools

- `asympta_observe_living_city` — read the current workflow, foreground agents and nearby synthetic city activity.
- `asympta_list_workflows` — list the available coordination workflows.
- `asympta_follow_agent` — move the local map camera to a foreground agent.
- `asympta_request_workflow` — request a workflow start; it queues a human approval instead of starting silently.
- `asympta_request_external_action` — request a simulated consequential action such as capacity reservation, payment authorisation or shipment release; it queues a human approval.

### Agent discovery and verification tools

- `asympta_describe_capabilities` — return the live WebMCP manifest, safety boundary, workflow catalog and stakeholder agents.
- `asympta_inspect_agent` — inspect one stakeholder and its current tasks without returning map coordinates.
- `asympta_get_pending_approval` — read the current human approval request. It cannot approve or decline it.

There is deliberately **no WebMCP approval/decline tool**. WebMCP can request consequential work, but the human must resolve the approval in the visible Asympta UI. The page also audits the native tool registry through `getTools()` when the browser exposes it and records the result in `document.documentElement.dataset.webmcpQualification` plus `window.__ASYMPTA_WEBMCP_AUDIT__` for inspection.

## Why this is WebMCP-specific

Without WebMCP, an external agent would have to infer map controls and scrape visual state. With WebMCP, the browser agent receives explicit workflow IDs, agent IDs, JSON Schemas, descriptions and safety semantics while the person continues to see the same world change on screen. The tool calls are not a second hidden backend: they enter the same event state used by the visible agents.

## Human approval and simulation boundary

- All supplier, commerce, payment, shipment and customer-update actions in the challenge build are simulated.
- WebMCP-requested workflow starts and consequential external actions stop at a visible human approval boundary.
- No WebMCP tool can resolve that approval boundary.
- The map uses a synthetic Tokyo demonstration world. The WebMCP surface does not request device geolocation.
- `asympta_inspect_agent` intentionally removes synthetic longitude/latitude from its response; `asympta_observe_living_city` can expose the synthetic map state needed to observe the demo world.

## Run locally

Requires Node.js 22.13 or newer.

```bash
npm ci
npm run dev
```

## Verify the implementation

```bash
npm run lint
npm run typecheck
npm run test:agent-runtime
npm run test:webmcp
npm run test:engine
npm run build
npm run test:rendered
npm run export:pages
```

`tests/agent-runtime.test.mjs` proves that every visible agent has a future AI profile, context stays bounded and coordinate-free, the demo requires no AI provider, an AI provider can be injected without changing Atlas, overpowered model output fails closed, and generated schemas expose only each agent's allowed capabilities.

`tests/webmcp-contract.test.mjs` verifies the eight expected tool names, JSON-Schema discovery shape, direct `document.modelContext.registerTool(...)` source integration, abort lifecycle, approval-safety invariant and documentation/source agreement. GitHub Pages runs the validation chain before every deployment from `main`.

## Verify WebMCP in a real browser

### ChatGPT in-app browser

Open the live site and ask the browser agent:

> Describe what I can do in Asympta World. Inspect `agent-supplier`. Then request the `custom-order` workflow, but do not approve anything for me.

Expected behavior: the browser discovers the Asympta tools, reads the supplier state and creates a visible human approval request for the workflow. Approval remains a human UI action.

### WebMCP-enabled Chrome

1. Enable `chrome://flags/#enable-webmcp-testing` and relaunch Chrome.
2. Open the live site.
3. Inspect the Model Context/WebMCP tool registry.
4. Confirm all eight tool names above are present.
5. Execute the read tools, request a workflow, and confirm the site enters the visible human approval state.
6. Confirm a browser agent cannot discover any tool that approves or declines the pending request.

## Challenge assets

The repository is public and licensed under MIT. The current submission/testing notes are in [`docs/WEBMCP_CHALLENGE_SUBMISSION.md`](docs/WEBMCP_CHALLENGE_SUBMISSION.md). The live site is deployed by [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml).
