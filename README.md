# Asympta World

> Humans live. Agents coordinate the world around them.

[Live world](https://okok147.github.io/asympta-world/) · [Public source](https://github.com/okok147/asympta-world) · [WebMCP challenge kit](docs/WEBMCP_CHALLENGE_SUBMISSION.md)

Asympta World is a living coordination map built for the WebMCP Challenge. A human chooses an intent and specialised stakeholder agents visibly coordinate the customer, business, supplier, operations, finance, logistics, support, quality and market sides around that intent.

The current challenge build contains four end-to-end simulated workflows: Custom Order, Dinner, Launch Stock and Service Recovery. Agent movement, task dependencies, information exchange, approval state, the map and WebMCP tools all read the same deterministic state engine.

## The participation bridge

Most agent products assume the participant already understands agents, tools, schemas, APIs or automation. Asympta World should remove that requirement.

The product principle is:

> **Natural language for people. Structured semantics for agents. One shared economic world.**

A person, elderly user, small merchant or non-technical organisation should be able to enter the agent economy with an ordinary sentence such as:

> I need dinner around 7pm. I do not know which service to use.

They do not need to know an agent ID, workflow name, JSON schema or tool call. The structured communication bridge defaults that message to the personal intent agent and preserves the original human-readable body. Technical participants can optionally add message kind, subject, intent, action, entities and structured data without replacing the human language.

`lib/agent-message-state.ts` is the persistent communication ledger. It mirrors workflow communication into structured message records and keeps:

- human-readable `body`
- sender and recipient participant types
- thread and reply relationships
- message kind and subject
- optional machine-readable semantics
- source, delivery state and world context

This is deliberately a bridge between non-technical society and technical/agent systems rather than a requirement that every participant learn agent infrastructure.

## AI-ready, not AI-dependent

The demo deliberately runs with **zero AI API dependency**. The deterministic Atlas engine remains the source of truth, so the deployed challenge build continues to work without an API key, model availability or inference latency.

At the same time, `lib/agent-runtime/` now provides the future AI boundary: agent profiles, bounded context building, per-agent decision schemas, untrusted-output validation, a deterministic fallback provider and a vendor-neutral AI provider adapter. A future model can be inserted above the engine without rewriting the map, workflows, WebMCP tools or approval system.

Core invariant:

> **Model proposes. Runtime validates. Engine executes. Human approves consequences.**

The boundary is not intended to exclude capable agents or non-technical people. It is the translation and safety layer that lets different participants join the same world without needing the same technical knowledge.

See [`docs/AI_AGENT_RUNTIME.md`](docs/AI_AGENT_RUNTIME.md) and run `npm run test:agent-runtime`.

## WebMCP is part of the product

The deployed page uses the imperative WebMCP API directly through `document.modelContext.registerTool(...)`. The WebMCP surface is schema-bounded and inspectable, while the human-facing communication model remains plain-language first.

### Core living-world tools

- `asympta_observe_living_city` — read the current workflow, foreground agents and nearby synthetic city activity.
- `asympta_list_workflows` — list the available coordination workflows.
- `asympta_follow_agent` — move the local map camera to a foreground agent.
- `asympta_request_workflow` — request a workflow start; it queues a human approval instead of starting silently.
- `asympta_request_external_action` — request a simulated consequential action such as capacity reservation, payment authorisation or shipment release; it queues a human approval.

### Communication bridge tools

- `asympta_send_agent_message` — send a human-readable message with optional structured semantics. Only `body` is required; omitted routing defaults to `human → agent-user`.
- `asympta_list_agent_messages` — read the persistent structured communication ledger, optionally filtered by participant or thread.

Sending a message does not grant permission for consequential actions. Communication can be low-friction while payments, shipment release and other consequential state transitions continue to use the visible approval boundary.

### Agent discovery and verification tools

- `asympta_describe_capabilities` — return the live WebMCP manifest, safety boundary, participation bridge, workflow catalog and stakeholder agents.
- `asympta_inspect_agent` — inspect one stakeholder, its current tasks and recent structured messages without returning map coordinates.
- `asympta_get_pending_approval` — read the current human approval request. It cannot approve or decline it.

There is deliberately **no WebMCP approval/decline tool**. WebMCP can request consequential work, but the human must resolve the approval in the visible Asympta UI. The page also audits the native tool registry through `getTools()` when the browser exposes it and records the result in `document.documentElement.dataset.webmcpQualification` plus `window.__ASYMPTA_WEBMCP_AUDIT__` for inspection.

## Camera/process follow

When process camera lock is active, Asympta follows the agent currently executing the active workflow task. Starting from a workflow tile or selecting a task in the Schedule enables process lock. When one task finishes and the next active task moves to another stakeholder, the camera automatically switches to that agent and re-arms the real 60Hz follow loop. A manual map drag still releases the process lock immediately.

## Why this is WebMCP-specific

Without WebMCP, an external agent would have to infer map controls and scrape visual state. With WebMCP, the browser agent receives explicit workflow IDs, agent IDs, JSON Schemas, descriptions and safety semantics while the person continues to see the same world change on screen. The tool calls are not a second hidden backend: consequential requests enter the same event state used by the visible agents, while structured messages use the shared persistent communication ledger.

## Human approval and simulation boundary

- All supplier, commerce, payment, shipment and customer-update actions in the challenge build are simulated.
- WebMCP-requested workflow starts and consequential external actions stop at a visible human approval boundary.
- Plain communication does not require a technical user to understand the approval architecture.
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

`tests/agent-message-bridge.test.mjs` proves that plain language alone enters structured communication state, technical semantics remain optional, workflow communication is mirrored without duplicate polling, persistence works, and process camera lock switches across task handoffs.

`tests/webmcp-contract.test.mjs` verifies the ten expected tool names, JSON-Schema discovery shape, direct `document.modelContext.registerTool(...)` source integration, abort lifecycle, approval-safety invariant and documentation/source agreement. GitHub Pages runs the validation chain before every deployment from `main`.

## Verify WebMCP in a real browser

### ChatGPT in-app browser

Open the live site and ask the browser agent:

> Send the message "I need dinner around 7pm and I do not know which service to use." without specifying an agent ID. Then list my Asympta messages. After that, inspect `agent-supplier` and request the `custom-order` workflow, but do not approve anything for me.

Expected behavior: the first message is accepted as a structured `human → agent-user` request without requiring technical routing knowledge. The browser can read it back from the message ledger. It can then discover the Asympta tools, inspect supplier state and create a visible human approval request for the consequential workflow. Approval remains a human UI action.

### WebMCP-enabled Chrome

1. Enable `chrome://flags/#enable-webmcp-testing` and relaunch Chrome.
2. Open the live site.
3. Inspect the Model Context/WebMCP tool registry.
4. Confirm all ten tool names above are present.
5. Call `asympta_send_agent_message` with only a `body` and confirm it defaults to the personal intent agent.
6. Call `asympta_list_agent_messages` and confirm the same human body is preserved alongside structured fields.
7. Execute the other read tools, request a workflow, and confirm the site enters the visible human approval state.
8. Confirm a browser agent cannot discover any tool that approves or declines the pending request.

## Challenge assets

The repository is public and licensed under MIT. The current submission/testing notes are in [`docs/WEBMCP_CHALLENGE_SUBMISSION.md`](docs/WEBMCP_CHALLENGE_SUBMISSION.md). The live site is deployed by [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml).
