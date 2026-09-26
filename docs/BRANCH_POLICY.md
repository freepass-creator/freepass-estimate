# FreePass Estimate Branch Policy

Status: ACTIVE
Date: 2026-09-26

## Canonical development model

- `main`: stable baseline / merge destination.
- One active integration branch at a time for changes that cross UI, engine, adapter, Quote, or data-contract boundaries.
- Specialist branches are temporary workspaces only. They do not own product truth.

Current consolidation line:

```
main
  └─ integration/canonical-20260926
       ├─ latest FreePass Admin-aligned UI/UX
       └─ Quote Core v2 / FreePass Data authority boundary
```

## What must remain single-source

The following must never be maintained as parallel implementations:

- design tokens and shared visual roles
- vehicle-selection/domain rules
- QuoteRequest / QuoteResult / Quote v2 contracts
- calculation dispatcher and provider policy
- external provider adapter contract
- FreePass Data authority boundary
- quote persistence boundary

Web and mobile may have different presentation components because their interaction models differ, but they must consume the same shared rules and contracts.

## Provider rule

Canonical route:

```
Quote Core
  ├─ FreePass Standard
  └─ External
       └─ adapter (Welrix / future Excel / ERP/API)
```

Legacy Welrix-direct engine/proxy files are compatibility/migration debt. They are not a second canonical provider architecture and must not receive new feature work.

## UI rule

- `src/styles/tokens.css` is the target shared token authority.
- Desktop and mobile may differ in layout and component composition, not in competing token definitions or business rules.
- Prototype files are historical visual references only and must not be treated as runtime authority.

## Branch lifecycle

1. Create specialist work from the current canonical integration line when one exists; otherwise from `main`.
2. Keep the change scoped to its lane.
3. Merge/reconcile into the canonical integration line.
4. Stop work on the specialist branch after absorption.
5. Validate the integrated state, then merge the single integration PR to `main`.
6. Start the next cycle from the updated `main`; do not revive superseded branches.

## Superseded lines in this consolidation

The following lines are no longer independent canonical candidates once their work is absorbed into the integration branch:

- `work/ui-admin-alignment-20260925`
- `automation/estimate-uiux-admin-sync-20260925-2108`
- `work/gpt/quote-core-v2-20260925`
- older UI baseline, provider-refactor, AI Core shadow, and manual-release branches

They may remain temporarily for audit/history, but new product work must not continue on them.
