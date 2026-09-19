# AGENTS — FreePass Estimate

Read `PROJECT.md` and `docs/UI_BASELINE.md` before editing UI.

## Hard rules

1. Do not invent a new estimator layout.
2. New-car web inherits Welrix web information architecture.
3. New-car mobile inherits Welrix one-screen-one-choice flow.
4. A single-choice vehicle step advances immediately after selection.
5. Back navigation must preserve prior selection.
6. Multi-select/options and multi-field conditions may use an explicit Next action.
7. New car has no Rent/Subscription toggle. It is long-term rental only.
8. Used car owns Rent/Subscription selection and is developed after new-car UI approval.
9. Ordinary buttons have no visible border unless the current FreePass standard explicitly requires one.
10. Use borders for inputs/search/data containers where boundaries are meaningful.
11. Do not wrap every section in cards. Use spacing and surfaces first.
12. Do not port Welrix red or Sonogong teal as the FreePass product theme.
13. Do not change legacy reference repositories while this project is being established.
14. Do not connect/migrate calculation engines before UI approval.
15. Representative prototype prices are placeholders only and must be labeled as such.

## Approval gate

Before implementation beyond prototype:
- capture web and mobile screenshots from the current branch,
- compare against the reference UI,
- obtain user approval,
- then connect real data/calculation adapters.
