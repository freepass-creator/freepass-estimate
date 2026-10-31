# User-requested Estimate deployment — 2026-10-31

- Project: `freepass-estimator` / `prj_udO3Y62bU2dFLQqy3Tfc2Tj4dgDd`
- Owner account confirmed: `team_eoE14CYgDqL324ULjloyMzm5` (`freepass-projects`).
- Deployed source: `c9761972c2d0aa1a729e40bd4b7730282657e47d` (integration branch, not a main merge).
- Environment: production, explicitly requested by the user for testing.
- Deployment: `dpl_EuRgeqMt6rFnwWt5MT9jt5rcQL4L`, READY.
- Public link: https://freepass-estimator.vercel.app/
- Immutable build URL: https://freepass-estimator-4utvl3g05-freepass-projects.vercel.app/
- Existing production domain bindings retained; no protection/IAM/credentials were changed.

## Post-deployment readback

`GET /` returns HTTP 200 and the unified mobile app entry. `GET /api/freepass-data-master` returns HTTP 503 with `NO_ACTIVE_RELEASE`. This same upstream failure was present immediately before this deployment. The existing production Data credentials reach the service; the response indicates no active release, not missing browser data or a UI-selection defect.

The new quote picker intentionally stops before quoting when the canonical active master is unavailable. The deployment must not be described as a successful live quotation test. No synthetic catalog was substituted, no provider price catalog was promoted to vehicle-price authority, and no Data release activation/Firebase/IAM mutation was performed as a workaround. Actual Kamatch stable-ID mapping/rate installation also remains an operational dependency documented in FUNCTIONAL_HANDOFF_20261031.md.

GitHub UI structure guard currently expects removed credit/service selector markup and an old one-offer loop, so verify jobs fail that historical guard. Pricing-authority and quote-integration jobs passed for the deployed commit. The scoped build, current UI fixture flow, source parity and adapter tests were previously run as recorded in the functional handoff. This release does not claim all legacy verify checks passed.

Rollback build retained: `dpl_2yjYZnuw9Qar8MR3Qgj8cerbPRtB`.
