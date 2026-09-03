# Asympta World localization contract

Status: **MANDATORY PRODUCT CONTRACT**

Every user-visible feature in Asympta World must inherit the language selected by the existing global language control. A feature must never create its own unrelated language state or leave newly added UI hard-coded in English.

## Source of truth

The active UI language is `document.documentElement.lang`.

Current supported product locales are:

- `en`
- `zh-Hant`
- `ja`

If the product adds another locale, every feature surface must inherit it through the same global language runtime before that locale is considered supported.

## Required coverage for every new or adjusted feature

Localization includes **all user-visible or assistive text**, not only headings:

- buttons, tabs, menus and cards;
- labels, descriptions and status text;
- placeholders and empty states;
- errors and validation messages;
- ARIA labels and titles;
- agent dialogue and dynamically generated status copy;
- approval / confirmation text;
- new business, customer, supplier, logistics, finance or other stakeholder UI;
- mobile / responsive variants of the same feature.

User-provided content, imported business names, product names, addresses and other source data should remain intact unless explicit translation is part of the product feature.

## Engineering rule

1. Reuse the global Asympta locale runtime and `document.documentElement.lang`.
2. Do not add a feature-specific language selector unless the product explicitly requires one.
3. Do not ship a new visible feature with English-only literals while `zh-Hant` or `ja` is selected.
4. Static copy, attributes and dynamic agent output must all switch when the global language changes **without a page reload**.
5. Any new UI feature must add localization regression coverage before merge/push is considered complete.
6. A feature is not complete if its language state can disagree with the global language selector.

## Current runtime

- `AsymptaCompleteLocale` handles the established global surfaces.
- `AsymptaFeatureLocale` extends the same global language source for newly added feature surfaces, currently including Business mode.

Future work should extend these shared localization surfaces rather than building isolated translation state.
