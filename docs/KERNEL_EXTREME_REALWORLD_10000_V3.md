# Kernel Extreme Real-World Holdout v3 — 10,000 Cases

Date: 2026-09-02

This benchmark is a fresh independent holdout. The previous 2,000 adversarial cases remain frozen regression suites.

## Purpose

Attack the Task Kernel with malformed but plausible user input and absurd-but-realistic requests where the correct behavior is often to clarify, preserve uncertainty, revoke authority, reject malformed facts, or remain incomplete rather than inventing a successful state.

## Scale

- 20 failure families
- 500 deterministic scenarios per family
- 10,000 unique scenario ids
- 10,000 unique intent strings
- locales rotate across English, Traditional Chinese, and Japanese metadata
- domains rotate across retail, travel, finance, calendar, healthcare, government, hospitality, logistics, employment, home services, education, events, insurance, property, subscriptions, communications, mobility, food, professional services, and general coordination

## Families

1. obvious_typo_alias
2. code_switch_alias
3. impossible_date
4. impossible_time
5. ambiguous_date
6. malformed_contact
7. malformed_identity
8. negative_zero_quantity
9. fractional_discrete_quantity
10. malformed_money
11. mixed_currency_conflict
12. ambiguous_currency_symbol
13. unit_slot_mismatch
14. contradictory_fact
15. uncertain_fact
16. negated_fact
17. revoked_commitment
18. revoked_payment
19. noisy_compound_binding
20. absurd_feasibility_truthfulness

## Benchmark rule

The benchmark does not reward raw liveness. A case passes when the kernel preserves semantic truth and authority boundaries. An impossible date should remain unresolved; a same-turn revocation should remove action authority; two conflicting facts without a correction signal should not silently collapse to one; an absurd request should not receive fabricated feasibility evidence.

The first run records the current Kernel v2 baseline. It intentionally does not require a perfect score, because the purpose is to expose the next structural failure clusters without tuning the benchmark to the implementation.
