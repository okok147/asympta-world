# Adaptive Interaction Runtime

Asympta must be able to meet a case it has never seen before without requiring a new hand-written form for every domain.

The MVP runtime therefore separates **missing information** from **missing capability**.

## Missing information: schema, not new UI code

When an agent returns `waiting_input` with `missingFields`, the browser compiles those fields into a bounded runtime schema:

```text
agent detects a missing fact
  → asympta.adaptive-ui.v1
  → universal renderer
  → one next useful question
  → user-confirmed fact
  → continue the same task
```

The schema is ephemeral. It does not modify source code, deploy a component, or push to `main`.

Known field shapes can receive useful controls and suggestions. For example, a television request can turn `screen size` into 43 / 50 / 55 / 65 inch choices. A completely unseen field falls back to a normal text control, so a new domain remains usable before a dedicated adapter exists.

The renderer deliberately presents only `nextField`. The full missing-field list stays in the schema, but the person is not asked to complete a large form. This keeps the existing Asympta rule:

> Ask only for the next necessary information.

## Grounding rule

Runtime schema generation may infer **how to ask** for a fact. It may not invent the fact itself.

Every adaptive schema declares:

```text
factPolicy = unknown_until_user_confirmation
```

A selected or typed answer is carried forward as a user-confirmed clarification. Unanswered fields remain unknown. The agent then reevaluates the same task and either continues or asks the next necessary question.

## Missing capability: adapter forge, not production mutation

A genuinely missing capability is a different problem. The intended path is:

```text
capability gap
  → propose adapter contract
  → generate adapter in an isolated workspace
  → static validation + tests + sandbox execution
  → register a verified capability
  → continue the task
  → promote repeatedly verified adapters through normal source control
```

A runtime model must never write arbitrary UI or adapter code directly into production `main`. Source promotion remains a verified engineering action.

## Current MVP implementation

- `lib/asympta-adaptive-interaction.ts`
  - normalizes agent-reported missing fields;
  - compiles `asympta.adaptive-ui.v1` schemas;
  - supplies useful controls for common facts while retaining a generic unseen-field fallback;
  - merges only user-confirmed clarifications back into the original intent.
- `components/asympta-adaptive-interaction.tsx`
  - listens to the existing `asympta:activity` stream;
  - renders the next schema field immediately;
  - resumes the existing `window.__ASYMPTA_PROTOCOLS__.runIntent` task after confirmation;
  - preserves the existing action/approval/verification gates.

This makes the television case work without introducing a `TelevisionForm` component, while leaving the same mechanism available to future unseen task types.
