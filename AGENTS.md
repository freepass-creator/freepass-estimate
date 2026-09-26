# AGENTS — FreePass Estimate

Read `PROJECT.md` and `docs/UI_BASELINE.md` before editing UI.

## Authority

FreePass Estimate is the **authoritative upstream source** for all estimator UI/UX, quote interaction rules, QuoteRequest/QuoteResult contracts, and quote-provider contracts.

Welrix, FreePass Sales, Sonogong, ERP4 and other repositories may be used as historical/reference inputs, but they are not allowed to become the source of truth again.

Default synchronization direction:

```
FreePass Estimate -> FreePass Sales / Welrix / partner-channel surfaces
```

If a downstream product needs an estimator change, implement and validate the canonical change here first, then propagate downstream.

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


## Branch discipline

Before starting any change, read `docs/DEVELOPMENT_BRANCH_MODEL.md` and `registry/branch-status.json`.

Regular product work has exactly four lanes:
- `work/ui-ux/<task>`
- `work/feature/<task>`
- `work/engine/<task>`
- `work/integration/<task>`

Rules:
1. `main` is the only long-lived product truth.
2. A page/device is never a branch authority. Do not create branches for new-car page, used-car page, result page, desktop, mobile, etc.
3. AI/vendor names are not branch roles.
4. At most one active product branch per lane.
5. Do not branch from a work branch. Start from the current canonical line and merge back to it.
6. Tests/QA belong to the branch being tested; do not create a permanent QA branch.
7. Any branch marked `DEPRECATED_*` or `ARCHIVE_*` in `registry/branch-status.json` is read-only history. Never continue product development there.
8. `work/canon/<task>` is repository-governance-only and may not contain product functionality.
