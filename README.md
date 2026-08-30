# Asympta World

> **Express an intention. Let the world coordinate around it.**

[Live world](https://okok147.github.io/asympta-world/) · [Public source](https://github.com/okok147/asympta-world) · [WebMCP challenge kit](docs/WEBMCP_CHALLENGE_SUBMISSION.md)

Asympta World is an experimental shared environment for humans, agents, businesses and tools. The human-facing interface is deliberately simple: a person says what they want to happen in ordinary language. Asympta keeps that intention as the durable activity root, discovers independent capabilities, communicates over real protocols, executes what can safely be executed, and records evidence before treating an outcome as complete.

The long-term product test is intentionally human rather than technical:

> A non-technical 90-year-old person should be able to say, “I want some food,” without learning agents, APIs, MCP, A2A, workflows or model configuration. The infrastructure should learn how to understand her.

## What changed

The main product path is no longer a preset-workflow picker.

```text
Human language
    ↓
Asympta Activity IR
    ↓
capability discovery
    ↓
┌───────────────┬───────────────┐
│ real A2A      │ real MCP      │
│ agent work    │ tool work     │
└───────────────┴───────────────┘
    ↓
activity events + evidence
    ↓
verification
    ↓
verified outcome
```

The existing paper map, multilingual product language and illustrated animal agents remain the visible world. Protocol/debug surfaces and preset workflow tiles are not the primary consumer experience. When protocol work happens, the relevant existing agent becomes the visual focus and reports progress in human language such as “Finding who can help…” or “Checking that it really happened…”.

## Asympta is currently an internal semantic layer, not a replacement for MCP or A2A

The early architecture deliberately does **not** assume the outside world already speaks a future Asympta Protocol.

`lib/asympta-activity.ts` defines the current experimental intermediate representation, `asympta-ir/0.1`. It preserves:

- the original human intention;
- the principal who owns that intention;
- activity status;
- protocol-backed events;
- protocol evidence;
- the final verified or failed outcome.

`lib/asympta-protocol-runtime.ts` is the Activity Kernel. It understands **why** protocol calls are being made and whether their combined results support the original human intention.

The important separation is:

> **Protocols execute locally. Asympta maintains global meaning.**

The stable primitives discovered through real use can later be extracted into a public Asympta Protocol. They are not frozen prematurely.

## Real MCP

`lib/protocols/mcp-client.ts` implements the current stateless MCP request model used by this experiment. It performs actual HTTP JSON-RPC requests for:

- `tools/list`
- `tools/call`

The runtime sends protocol/client metadata, discovers the remote tool surface and calls the selected remote tool rather than fabricating a tool result inside the simulation.

The argument builder is intentionally conservative. A low-risk semantic field such as a single `query` can receive the human intention directly. Required consequential fields such as payment amounts are **not guessed**; the activity moves to `waiting_input` instead.

## Real A2A

`lib/protocols/a2a-client.ts` performs actual A2A discovery and messaging:

- public Agent Card discovery through `/.well-known/agent-card.json`;
- interface selection from the Agent Card;
- v1-style `SendMessage` and `GetTask` JSON-RPC operations;
- compatibility fallback for older `message/send` and `tasks/get` peers.

The Asympta runtime can delegate the human intention to an independent A2A agent, follow a returned task until a terminal state, stop when additional human input is required, and use the terminal task state as outcome evidence.

## The living world is the interface, not a dashboard

The project intentionally keeps the existing visual language:

- calm paper map;
- cute illustrated stakeholder agents;
- English, Traditional Chinese and Japanese UI;
- visible communication and movement;
- human checkpoints for information or consequential decisions;
- camera focus on the participant currently handling the activity.

Ordinary users should not need to see protocol names, JSON calls, tool schemas or workflow IDs. The main surface is the natural-language intention composer.

The deterministic Atlas city still exists as a visual/demo world and as regression infrastructure. It is **not** presented as proof that an external MCP server or A2A agent performed an action. Protocol-backed work and simulated ambient city life remain distinguishable in the implementation.

## Connecting real protocol peers

No remote service is silently invented. If no real A2A or MCP peer is configured, the intent runtime says that no connected service is available instead of fabricating success.

For development, browser-test peers can be supplied with repeated URL parameters:

```text
?a2a=https://agent.example.com&mcp=https://tools.example.com/mcp
```

Or configure the runtime bridge from trusted development code:

```js
window.__ASYMPTA_PROTOCOLS__.configure({
  a2a: [{ url: "https://agent.example.com" }],
  mcp: [{ url: "https://tools.example.com/mcp" }],
})
```

Then the normal UI remains only:

```text
Tell Asympta what you want to happen…
```

The bridge also exposes `runIntent()` and `lastActivity()` for integration tests. URL-based configuration persists only endpoint URLs/names when explicitly requested. Credentials should stay in an appropriate runtime/deployment secret boundary and must not be committed or stored as ordinary browser preferences.

Because the GitHub Pages build is static, a browser calling a remote MCP/A2A service directly requires that remote service to permit the relevant browser origin and provide an appropriate authentication path. A production deployment can place the same protocol clients behind a trusted server/gateway without changing the Activity Kernel semantics.

## WebMCP remains part of the challenge build

The deployed page still uses `document.modelContext.registerTool(...)` to expose a browser-agent interface for the WebMCP Challenge. This is separate from the new outbound MCP client:

- **WebMCP surface:** lets a browser agent inspect or communicate with Asympta World.
- **Outbound MCP client:** lets Asympta call an independent MCP service while pursuing a human intention.
- **A2A client:** lets Asympta communicate with an independent autonomous agent.

The challenge build currently exposes these thirteen WebMCP tools:

- `asympta_observe_living_city`
- `asympta_observe_global_supply_network`
- `asympta_list_workflows`
- `asympta_follow_agent`
- `asympta_request_workflow`
- `asympta_request_external_action`
- `asympta_describe_capabilities`
- `asympta_inspect_agent`
- `asympta_get_pending_approval`
- `asympta_submit_request`
- `asympta_read_request`
- `asympta_send_agent_message`
- `asympta_list_agent_messages`

These names are part of the browser-agent qualification surface, not the normal consumer UI. Preset workflow and inspector chrome are hidden from the ordinary human experience even though the challenge tools remain registered and testable.

Consequential simulated WebMCP actions still preserve the explicit approval boundary. There is deliberately no browser-agent tool that silently approves a pending consequential action for the person.

## Product architecture

```text
┌──────────────────────────────────────┐
│ Human                                │
│ “I want this to happen.”             │
└──────────────────┬───────────────────┘
                   ↓
┌──────────────────────────────────────┐
│ Asympta Activity Kernel              │
│ intent · principal · state · events  │
│ evidence · outcome                   │
└───────────┬──────────────────┬───────┘
            │                  │
            ↓                  ↓
      A2A adapter          MCP adapter
            │                  │
            ↓                  ↓
   independent agent     independent tool
            │                  │
            └─────────┬────────┘
                      ↓
                 real response
                      ↓
                 verification
                      ↓
┌──────────────────────────────────────┐
│ Living map / cute agents             │
│ human language · progress · approval │
└──────────────────────────────────────┘
```

Core product invariant:

> **A model or agent may propose and coordinate. External protocols must actually execute their own work. Asympta records the evidence. The human retains authority over consequential decisions.**

## AI/model boundary

The repo still contains `lib/agent-runtime/`, which provides bounded agent context, decision schemas, untrusted-output validation and a vendor-neutral provider interface. The protocol architecture is deliberately model-independent: a stronger model can improve intent interpretation and routing without becoming the source of truth for whether an MCP tool or A2A task actually executed.

No model is allowed to turn the sentence “I called the tool” into evidence that the tool was called.

## Run locally

Requires Node.js 22.13 or newer.

```bash
npm ci
npm run dev
```

## Verify

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

`tests/asympta-protocol-runtime.test.mjs` verifies that:

- the raw human intention remains the durable activity root;
- MCP uses the stateless protocol request path rather than a fake session;
- an MCP tool is invoked through a real `tools/call` request;
- an A2A peer is discovered through its Agent Card;
- A2A work is sent through `SendMessage` and verified through task state;
- the runtime can route a natural-language intention into either real protocol adapter;
- consequential required MCP arguments are not invented;
- the consumer surface is intent-first and hides preset/debug dashboard chrome.

Existing engine, WebMCP, living-world, safety, economy, rendering and browser-hydration regression tests remain in the deployment chain. GitHub Pages only deploys after that validation chain succeeds.

## The experiment

The current question is not “Can we design a complete Asympta Protocol on paper?”

It is:

> **What is the smallest shared language required for independent humans, agents and tools to turn an intention into verified action?**

Asympta World is now the laboratory for discovering that answer through real protocol interactions rather than assuming it in advance.
