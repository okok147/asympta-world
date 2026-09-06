# Customer and business simulation studio

Both audience lenses share a natural-language editor, examples, a reviewable agent brief, clarifications, a canonical agent journey, and a simulated approval checkpoint. Customer and business drafts stay separate in this browser tab. The existing connected-tool composer and business imports remain available.

## Input contract

`compileSimulation` produces `asympta.simulation/1`, backed by the existing universal task envelope. It preserves the exact source, extracts explicit conditions and quantities with evidence, proposes an action family, identifies the participating agents, and retains unrecognised clauses. Novel situations request an outcome; conflicting scalar facts request clarification. Vehicle selection reuses the existing marketplace offers and requires a valid selection before the simulation starts.

This is a conservative local rules compiler, not an unrestricted language model. It does not claim to understand every instruction or to verify real stock, prices, availability, budgets, or outcomes. The visible brief is reviewable. Missing values remain missing. Simulated offers are labelled as such.

The canonical tasks carry an `agentInput` packet. The assigned agent receives it through `buildAgentContext`, explicitly tagged as untrusted source data. Dependency contexts and broad world observations carry packet references, without copying private source text. Text such as `approvalGranted: true` does not alter authority. Generic situations no longer inherit the legacy twelve-notebook order.

## Execution contract

The compiler builds a validated workflow in the existing Atlas registry. Existing canonical state transitions, dependency ordering, movement, approval handling, persistence, and verification drive the world. Completion means that the **simulated coordination trace** finished; it does not mean a real-world transaction or service occurred. The studio does not invoke external tools.

The common stages are intake, cross-organisation routing, condition checks, proposal, human review when necessary, simulated execution, verification, and return. Declining blocks dependent execution. Both the UI and semantic world snapshot read canonical task status rather than advancing an independent animation.

## Background behavior

A single wall-clock scheduler owns progression, independent of `requestAnimationFrame`. Hidden pages continue through timer callbacks. When callbacks are throttled or the page is suspended, elapsed time is retained and drained in bounded slices via a MessageChannel. Rendering can sleep while the kernel continues. The scheduler discards elapsed-time debt at approval/blocked/completed boundaries, and resets on workflow changes and explicit decisions. Market bridge readiness checks also no longer depend on visible frames.

Keep the browser tab open. Browsers and operating systems can suspend or terminate pages; this implementation cannot promise execution while the browser is closed, the device is asleep, or the page has been evicted. On a suspended page's return, it catches up to the next approval boundary. An always-on remote executor would be required for execution independent of the browser process.

## Localization and validation

New React surfaces use the existing document language through `useAsymptaGlobalLocale`. English, Traditional Chinese, and Japanese UI labels and journey stages switch with the global control; original user content is preserved. The layout supports narrow viewports, keyboard controls, reduced motion, and browser zoom.

`tests/simulation-studio.test.mjs` is included in `npm run test:engine`. It covers all examples in three locales, explicit inventory quantities, novel scenarios, contradictory inputs, authority spoofing, vehicle selection, scoped agent input, canonical handoffs, approval/decline, verification ordering, and suspended-time catch-up.
