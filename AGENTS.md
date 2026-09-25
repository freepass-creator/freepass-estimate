# AGENTS — FreePass Estimate

Read `PROJECT.md` and `docs/UI_BASELINE.md` before editing UI.

## Authority

Authority is deliberately split.

- **FreePass Data** is the sole source of truth for vehicle/master identity, model year, trim/powertrain, option/color identity, and authoritative vehicle/option/color prices.
- **FreePass Estimate** is the authoritative source for estimator UI/UX, pricing engines, provider adapters, QuoteRequest/QuoteResult contracts, snapshots, and quote interaction rules.
- **Welrix and future external providers** may supply a calculation formula. They are never vehicle-price authority.

Default flow:

```
FreePass Data master -> FreePass Estimate pricing engine/adapter -> Quote -> Sales / partner-channel surfaces
```

If a vehicle fact or master price is wrong, fix FreePass Data. If a formula, adapter, Quote contract, or estimator behavior is wrong, fix FreePass Estimate.

## Hard rules

1. Do not invent a new estimator layout without explicit approval.
2. New-car web uses the verified imported information architecture now owned by FreePass Estimate.
3. New-car mobile uses the verified one-screen-one-choice flow now owned by FreePass Estimate.
4. A single-choice vehicle step advances immediately after selection.
5. Back navigation must preserve prior selection.
6. Multi-select/options and multi-field conditions may use an explicit Next action.
7. New car has no Rent/Subscription toggle. It is long-term rental only.
8. Used car owns Rent/Subscription selection and is developed separately.
9. Ordinary buttons have no visible border unless the current FreePass standard explicitly requires one.
10. Use borders for inputs/search/data containers where boundaries are meaningful.
11. Do not wrap every section in cards. Use spacing and surfaces first.
12. Do not port Welrix red or Sonogong teal as the FreePass product theme.
13. Treat Welrix, FreePass Sales, ERP4 and Sonogong as references/downstreams, not canonical estimator owners.
14. Never patch a downstream estimator first and then leave FreePass Estimate behind.
15. Quote-provider differences must not fork the shared estimator UI without explicit approval.
16. External provider failure must fail visibly; do not silently fall back to another calculator.
17. Representative prototype prices must be labeled as placeholders unless produced by an approved provider.
18. Do not create, reconstruct, or silently maintain a second vehicle master inside FreePass Estimate.
19. Browser/display prices are not calculation authority. Server-side pricing must resolve the selected product/options/colors against a CANONICAL_ACTIVE FreePass Data Estimate master.
20. Every pricing engine starts from FreePass Data authoritative price components.
21. External providers supply formulas only. Their own vehicle price must never overwrite FreePass Data master values.
22. When an external provider requires a vehicle-price input, the adapter must send the FreePass canonical price in the provider's required shape.
23. If an external provider cannot accept or demonstrably ignores the FreePass canonical price override, fail closed. Do not calculate with the provider's own price and do not silently fall back.
24. Provider-specific model keys/mappings may live in adapters, but they are mappings only; they must not become a shadow vehicle master.

## Change rule

For estimator behavior, UI structure, action placement, quote contracts, provider interfaces, share/result behavior, or estimator-specific design rules:

1. change FreePass Estimate,
2. test here,
3. approve here,
4. propagate to consumers.

A downstream hotfix may exist temporarily only when operationally unavoidable. It must be back-ported to FreePass Estimate immediately and the downstream copy must be reconciled to the canonical implementation.

## Approval gate

Before material structural changes:
- capture web and mobile screenshots from the current branch,
- compare against the canonical FreePass Estimate baseline,
- obtain user approval where required,
- then propagate downstream.
