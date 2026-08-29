# Asympta Agent Runtime

Asympta World is intentionally **AI-ready but not AI-dependent**.

The current WebMCP Challenge demo continues to run entirely from the deterministic Atlas engine. No model API key, inference endpoint or network model call is required. The optional `lib/agent-runtime/` layer exists so future AI agents can be added without moving world authority into an LLM.

## Architecture invariant

```text
Task becomes eligible
        ↓
Asympta world state
        ↓
buildAgentContext()
        ↓
Agent Runtime
        ↓
Provider (deterministic today / AI later)
        ↓
validated AgentDecision
        ↓
engine / tool router / WebMCP
        ↓
human approval when consequential
        ↓
world state changes
```

The rule is:

> **Model proposes. Runtime validates. Engine executes. Human approves consequences.**

An AI provider must never receive direct authority to mutate `AtlasWorldState`.

## What exists now

`lib/agent-runtime/` contains:

- `profiles.ts` — goals, instructions and capability boundaries for every foreground agent.
- `context.ts` — creates a small, coordinate-free context containing only the agent's current task, dependencies, recent messages, approvals and peers.
- `schema.ts` — creates a JSON Schema for exactly the actions currently available to that agent.
- `validator.ts` — treats all provider output as untrusted and normalises only valid decisions.
- `provider.ts` — provider interface plus deterministic and vendor-neutral AI adapters.
- `runtime.ts` — provider execution, validation and fail-closed deterministic fallback.

The existing Atlas engine remains unchanged and remains the source of truth for the demo.

## Supported decision boundary

A future model can propose only:

- `send_message`
- `request_tool`
- `complete_task`
- `wait`
- `delegate`

There is no `approve`, `decline`, `set_world_state`, `set_inventory`, `pay`, or `ship` decision. Consequential work must enter an allowed tool boundary and then the existing human approval system.

## Integrating an AI API later

Keep provider secrets on the server/Cloudflare Worker. Do not call a paid model directly from a React component and never ship API keys to the browser.

A provider can be attached without changing Atlas:

```ts
import { createAgentRuntime, createAiAgentProvider } from "@/lib/agent-runtime";

const provider = createAiAgentProvider({
  id: "production-ai",
  model: "your-model",
  infer: async ({ context, responseSchema, systemInstructions, model }) => {
    // Server-side only: call the chosen AI provider here.
    // Ask for structured output matching responseSchema.
    // Return the parsed object; the runtime validates it again.
    return callYourModel({ context, responseSchema, systemInstructions, model });
  },
});

const runtime = createAgentRuntime({ provider });
const turn = await runtime.runTurn(world, "agent-supplier");
```

The next production step should add a server-side **decision-to-engine adapter** that maps validated decisions into existing engine commands/WebMCP requests. That adapter should be the only place where an AI proposal can request a state transition.

## Recommended rollout

1. **Demo / current:** deterministic engine only. Agent Runtime is dormant and testable.
2. **AI dialogue:** use the runtime for bounded messages and reasoning summaries while task execution stays deterministic.
3. **AI decisions:** allow validated delegation and tool requests.
4. **Real connectors:** map approved tool requests to merchant, supplier, payment sandbox and logistics adapters.
5. **Server-owned canonical state:** before real economic actions, move authoritative production state off the browser and keep the model behind a server-side runtime.

## Failure policy

Model timeout, malformed JSON, unavailable provider or an overpowered action must not stop the world or grant extra authority. `createAgentRuntime()` falls back to the deterministic provider and returns a safe `wait` decision while preserving the validation error for observability.
