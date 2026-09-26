# FreePass Estimate Development Branch Model

Status: ACTIVE
Date: 2026-09-26

## 1. Long-lived truth

`main` is the only long-lived product truth.

Until PR #17 is merged, `integration/canonical-20260926` is the single temporary consolidation line.
It is not a second main and must be retired after PR #17 is absorbed.

No page, device, AI vendor, prototype, audit, or historical branch may become a product authority.

## 2. Four development lanes

Product development has exactly four lanes.

### A. UI/UX — `work/ui-ux/<task>`

Owns presentation and interaction shell only.

Includes:
- layout, spacing, typography, color/tokens
- responsive web/mobile presentation
- component composition
- button placement, bottom action bar, cards, inputs
- accessibility, focus, loading/empty/error visual states
- animation/haptic/interaction feedback
- screenshots and visual regression

Must not change:
- QuoteRequest/QuoteResult semantics
- pricing/calculation formulas
- provider selection or adapter rules
- FreePass Data authority
- persistence behavior
- business state transitions

### B. Feature / Product Flow — `work/feature/<task>`

Owns estimator behavior and business workflow.

Includes:
- vehicle selection flow
- step navigation and state transitions
- requires/excludes/exclusive option rules
- conditions and validation
- staff/customer role behavior
- quote issue/send/share behavior
- cart/history restoration rules
- new-car / used-car product flow
- page-level behavior shared by web/mobile

Must not own:
- visual design tokens
- calculation formula internals
- provider implementation
- master data storage

### C. Engine — `work/engine/<task>`

Owns calculation truth and Quote core.

Includes:
- FreePass Standard calculation
- external provider adapters, including Welrix
- provider routing/fail-closed policy
- PriceBasis
- Quote v2 creation, hash/version/revision
- deterministic calculation
- term/scenario calculation
- engine/provider regression tests

Must not own:
- vehicle master
- UI layout
- persistence backend
- page-specific copies of calculation logic

### D. Integration / Data — `work/integration/<task>`

Owns system boundaries.

Includes:
- FreePass Data consumption
- authoritative vehicle/master projection
- API contracts and gateways
- Quote persistence
- RTDB/Firestore migration boundaries
- external service integration
- CI/release/deployment wiring
- import/export and downstream propagation

Must not create:
- a second vehicle master inside Estimate
- a second pricing engine
- a second UI token authority

## 3. Page rule

Pages are not branches.

Examples:

| Change | Lane |
| --- | --- |
| New-car mobile spacing/button layout | UI/UX |
| New-car vehicle step auto-advance rule | Feature |
| Result page monthly rental calculation | Engine |
| Result page saving issued Quote to FreePass Data | Integration |
| Used-car page card design | UI/UX |
| Used-car Rent/Subscription selection behavior | Feature |
| Welrix price calculation mapping | Engine |
| FreePass Data vehicle master loading | Integration |

If one task crosses multiple lanes, use one temporary integration task branch or sequence the lane PRs into the active integration line. Do not create page-specific parallel branches.

## 4. Concurrency rule

- At most one active product branch per lane.
- Normally 1–2 product branches should be active at the same time.
- Maximum regular active product branches: 4, one for each lane.
- Every branch starts from the current canonical line.
- Every branch must be merged back quickly; it is not a permanent home.
- QA/tests ship with the branch they verify. There is no permanent QA branch.
- AI vendor names are forbidden in branch names.
- No child branches from a work branch. Branch from canonical, merge to canonical, stop.

## 5. Governance exception

`work/canon/<task>` is allowed only for repository governance such as branch policy/registry cleanup.
It may not contain product functionality.

## 6. Current transition

Until PR #17 is merged:

```
main
  └─ integration/canonical-20260926   ← only active product integration line
```

Do not start the four product lanes from old branches.
After PR #17 is merged, new work starts from updated `main`.

