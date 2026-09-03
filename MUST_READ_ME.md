# MUST READ — KL active directive

## Date
2026-08-28

## Priority
Highest

## Read this before changing feature code for the next step.

You are the Codex session currently running on KL's home machine for **Asympta World**.

### Coordination rule
Do **not** interrupt, reset, overwrite, or discard the work already in progress.
If you are in the middle of a task, first:

1. finish it safely, or create a safe checkpoint/commit;
2. fetch/rebase the latest `main`;
3. read this file fully;
4. then integrate this directive into your next implementation step.

If you have already read this file, acknowledge it before making the next feature change.

### Required acknowledgement
Before implementing this directive, do both:

1. Reply in your current Codex conversation with:

> Received. I will preserve the current work in progress and extend Asympta World into a multi-party real-world coordination demo with a more aesthetic, simple, elegant, product-grade visual language.

2. Create or update `HOME_CODEX_ACKNOWLEDGEMENT.md` at the repository root with:

```markdown
# Home Codex acknowledgement

Status: RECEIVED
Request: Multi-party coordination + product-grade visual refinement
Response: Received. I will preserve current work and implement the requested feature.
Acknowledged at: <actual UTC ISO-8601 timestamp>
```

Commit only that acknowledgement file with message:

`chore: acknowledge must-read directive`

Push that acknowledgement to `main` before continuing.

---

## Product direction
Asympta World must not show only the user/requester side.
It should show a believable **multi-party real-world coordination system**:

- customer / requester;
- personal agents;
- business / merchant;
- operations / service / sales agents;
- inventory / warehouse;
- supplier / procurement;
- materials / production;
- quality control;
- packing / fulfilment;
- payment / approval;
- logistics / shipping / delivery;
- after-sales / return / support when relevant.

The world should feel autonomous and alive, showing real handoffs, communications, dependencies, and exceptions.

## Visual / art direction — new requirement
The product must look more **aesthetic, simple, elegant, and product-grade**.
It should no longer feel like a rough demo.

### Desired visual standard
Aim for the feel of a **premium modern product website and product experience**:

- clean, calm, premium composition;
- strong spacing and hierarchy;
- elegant typography treatment;
- restrained palette;
- subtle depth and layering;
- minimal visual noise;
- refined cards, panels, and chips;
- smooth, intentional motion;
- polished onboarding/demo framing;
- coherent, presentation-ready interface.

### Important interpretation
Do **not** literally copy Apple branding, trademarks, logos, marketing assets, or website layouts.
Instead, interpret the direction as:

- premium;
- minimal;
- human;
- clear;
- elegant;
- product-focused;
- high-finish;
- believable for a real launch-quality website.

### Apply this refinement to
- world scene composition;
- agent styling;
- zone styling;
- order / materials / shipment / audit cards;
- message bubbles / dialogue packets;
- HUD / control surfaces;
- empty states;
- transitions and motion;
- landing/demo presentation;
- semantic DOM presentation for inspectability.

### Preserve
- the core Asympta World concept;
- calmness;
- clarity;
- self-propelled agent activity;
- inspectable process;
- accessibility / mobile / reduced-motion support;
- deterministic engine truth.

### Avoid
- cluttered enterprise dashboard feeling;
- toy-like placeholder UI;
- visually noisy pixel chaos;
- flat unfinished prototype look;
- fake “demo-only” staging that is disconnected from the real engine.

---

## Mandatory global localization contract — 2026-09-03

Read `LOCALIZATION_CONTRACT.md` before adding or adjusting any visible feature or UI/UX.

**Every current and future user-visible feature must always inherit the language selected by the existing global language control.** The source of truth is `document.documentElement.lang`.

This requirement includes static text and dynamic content: buttons, tabs, menus, cards, labels, placeholders, empty states, errors, validation, ARIA labels, titles, agent dialogue, approval text, statuses, and responsive/mobile variants.

- Do not add isolated feature-specific language state.
- Do not ship English-only UI while `zh-Hant` or `ja` is selected.
- New or adjusted features must switch language without a page reload.
- User/imported source data such as business names and product names should remain intact unless explicit translation is requested.
- Extend the shared Asympta localization runtime (`AsymptaCompleteLocale` / `AsymptaFeatureLocale`) and add regression coverage for the feature.
- A feature is **not complete** if its language can disagree with the global language selector.

---

## Required implementation outcome
The next visible iteration should make a person feel:

> “This is not just a simulation demo. This feels like a real product showing how an agent-powered economy could work.”

The business/supply/logistics/payment coordination and the upgraded product-grade visual direction should be visible together in the same release.

## Delivery rule
After implementation and verification, report:

1. what is visibly different;
2. which scenarios show the multi-party coordination;
3. how the art direction was upgraded;
4. exact test/build evidence;
5. the exact commit SHA pushed to `main`.
