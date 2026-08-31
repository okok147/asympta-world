# User Context and Task Readiness

Asympta separates two responsibilities that must evolve together but must not be conflated.

## 1. App experience

The app lets a person express the smallest useful amount of information in natural language. It can use previously approved preferences, current task confirmations and safe defaults. When a blocking detail is still absent, the app asks exactly one next necessary question and continues the same task after the answer.

```text
human intention
  → explicit facts from the current message
  → approved app-wide user context
  → capability requirements
  → one next blocking question, or execution
```

A profile is optional. It reduces repeated input; it never becomes a command and never overrides the current explicit instruction.

## 2. Protocol and infrastructure

The protocol determines whether an agent has enough context to perform a capability safely and correctly. UI components do not hard-code a universal form. Each capability supplies a requirement contract, including the stage where a field becomes necessary.

The current implementation provides:

- `asympta.user-context.v1`
- `asympta.task-intent.v1`
- `asympta.task-packet.v1`
- `asympta.receipt.v1`

## Context precedence

When two facts use the same key, the resolver applies this fixed order:

```text
current explicit user instruction
> current task confirmation
> verified tool result
> approved user profile
> agent inference
> safe system default
```

Facts carry source references, confidence, scope, optional expiry and a sensitivity marker.

## App-wide profile

The app-wide user context stores reusable facts by domain instead of storing entire conversations:

```ts
{
  schemaVersion: "asympta.user-context.v1",
  facts: [
    {
      domain: "food",
      key: "food_preference",
      value: "local_cantonese",
      status: "approved",
      source: {
        type: "user_confirmation",
        ref: "profile:food:food_preference"
      },
      confidence: 1,
      sensitivity: "normal"
    }
  ]
}
```

Task packets request a scoped view, so a food agent does not receive clothing size, unrelated relationships or sensitive payment context.

The profile rejects secret-like keys such as raw card numbers, CVV, PINs, passwords, payment tokens, private keys and full street addresses. Payment methods are aliases only.

## Requirement contracts

A requirement defines:

- the capability that needs the field;
- the stage where it becomes blocking;
- optional conditions;
- accepted values;
- priority and user effort;
- a localized question and answer type.

```ts
{
  id: "food:fulfilment",
  capability: "marketplace.fulfil",
  field: "fulfilment_mode",
  stage: "commitment",
  blocking: true,
  priority: 90,
  question: {
    answerType: "single_choice",
    prompt: {
      en: "Personal-agent pickup or courier delivery?",
      "zh-Hant": "由個人代理自取，還是由速遞代理送貨？"
    }
  }
}
```

Requirements are stage-aware:

```text
discovery → selection → commitment → execution → verification
```

Information that is not required until commitment does not prevent discovery. Information that is non-blocking remains explicitly unknown rather than being invented.

## Always ask the next necessary information

`evaluateAsymptaTaskReadiness` has only two terminal outputs before execution:

```text
ready
needs_information + nextQuestion
```

There is no `needs_information` state without a question. If a contract omits custom wording, the protocol generates a bounded fallback question for the missing field.

Question order is deterministic:

1. earliest required stage;
2. highest impact priority;
3. lowest user effort;
4. stable requirement id.

After an answer, `recompileAsymptaTaskIntent` merges the confirmed fact and evaluates the same task again. The user does not need to repeat the original request.

## Fail-closed execution

An action graph must call `assertAsymptaTaskReady` before any agent task is created. If a blocking requirement is absent, it throws `AsymptaNeedsInformationError`, which contains the exact next question.

The marketplace adapter applies this gate inside `buildMarketplaceWorkflow`. Even a caller that bypasses the UI cannot start an incomplete purchase workflow.

## Agent handoff

A ready task can produce a recipient-specific packet:

```ts
{
  schemaVersion: "asympta.task-packet.v1",
  taskId,
  recipient: "agent-market",
  capability: "food.enquiry",
  context: {
    requested_item: "Cantonese comfort meal",
    fulfilment_mode: "courier_delivery"
  },
  contextProvenance,
  unknownButNonBlocking,
  permissions,
  successCriteria
}
```

Sensitive facts are excluded unless the packet builder is explicitly allowed to include them.

## Completion

An agent saying “done” is not completion. `asympta.receipt.v1` must match the task id and satisfy every declared success criterion with required evidence.

For the marketplace vertical slice, the evidence includes:

- availability;
- goods handoff;
- delivery receipt;
- inventory conservation.

## Marketplace adapter

The current food and clothing simulation is the first adapter on this generic infrastructure.

A complete approved profile starts immediately. An incomplete request asks only the next blocking field:

```text
food preference, when the requested food is still broad
→ fulfilment method
→ payment method alias
→ simulated execution
```

Existing marketplace preferences are migrated into the app-wide user-context record while the old profile shape remains readable for compatibility.

## Extension model

A new domain should provide an adapter, not another hard-coded form:

```text
natural-language compiler
+ context mapper
+ capability requirement contract
+ scoped task packet
+ completion receipt verifier
```

This preserves the core product rule:

> The app lets the person say less. The protocol makes sure the agents know enough before they act.
