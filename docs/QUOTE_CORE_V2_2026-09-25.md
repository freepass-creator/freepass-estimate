# Quote Core v2 — 2026-09-25

Status: **DRAFT / P0 IMPLEMENTATION**

## Ownership

- **FreePass Estimate** owns calculation engines, Quote contracts, Quote snapshots, Quote version/revision rules and consumer delivery contracts.
- **FreePass Data** owns vehicle/master/policy Canonical data and release evidence.
- Firestore is a persistence adapter behind FreePass Data contracts. Estimate must not make Firestore collection paths part of its public contract.
- RTDB is not an allowed target for new Quote v2 writes.

## Pricing source of truth

Vehicle pricing authority is upstream of every calculation engine.

```
FreePass Data CANONICAL_ACTIVE master
  -> authoritative QuoteRequest price assembly
     -> FreePass Standard OR External Provider Adapter
        -> normalized result
           -> Quote v2
```

Rules:

- FreePass Data owns base/option/exterior/interior price facts.
- The browser may carry prices for display, but pricing APIs re-resolve the selected stable IDs against FreePass Data before calculation.
- Staff-entered commercial inputs such as an explicit discount remain request inputs; vehicle master facts do not.
- FreePass Standard receives the server-rebuilt canonical price components.
- An external provider is a **formula provider**, not a vehicle-price provider.
- For Welrix, `manualPrice` is populated from the FreePass canonical base plus provider-row absorbed option axes, while remaining option/color values are supplied separately.
- The adapter requires the provider to echo/honor that manual base price. A mismatch fails closed with `PROVIDER_PRICE_OVERRIDE_REJECTED`.
- Provider-returned vehicle/total-car prices never overwrite the canonical FreePass Data total. The normalized QuoteResult retains the FreePass canonical total.
- No silent fallback to provider-owned price, static feed price, RTDB, or another engine is allowed.

The price equation for an external row must preserve the canonical total:

`provider manual base + provider option/color input - discount = FreePass canonical configured vehicle price`

## Quote unit

One Quote represents exactly:

> one resolved vehicle configuration + one contract scenario + one calculated monthly rental

A document containing several vehicles or terms is a **Share Envelope**, not one Quote.
The Share Envelope should reference one or more immutable Quote IDs.

## Quote v2 identity

Contract: `freepass-quote/v2`

Required content includes:

- quoteId / quoteVersion / createdAt
- vehicleModelId / modelYearId / trimId / powertrainId
- selectedOptionIds
- exteriorColorId / interiorColorId
- contractTerm / mileageCondition
- deposit / prepayment
- depositRatePct / prepaymentRatePct
- vehiclePriceSnapshot / optionPriceSnapshot
- totalVehiclePrice / monthlyRental
- pricingEngineVersion / sourceRevision
- snapshotHash

`deposit` and `prepayment` are final KRW amounts.
The corresponding input rates are sealed separately as `depositRatePct` and `prepaymentRatePct`.

## Determinism

`snapshotHash` is SHA-256 over canonical Quote content excluding issuance-time metadata.

Rules:

- object keys use deterministic lexical ordering
- selected option IDs are deduplicated and sorted
- option price snapshots are keyed/sorted by stable optionId
- undefined/function/symbol/bigint and non-finite numbers are rejected
- createdAt does not affect snapshotHash
- sourceRevision does affect snapshotHash

Default quoteId is content-derived from snapshotHash.
A changed quote therefore gets a new default content identity.
A business revision may explicitly retain a logical quoteId while incrementing quoteVersion.

## FreePass Data evidence gate

Quote issuance requires a `CANONICAL_ACTIVE` FreePass Data release with:

- releaseId
- manifestId
- revision
- inputDigest
- dataDigest

`data_as_of` alone is not sourceRevision evidence.

Legacy Estimate canonical candidates currently expose fields such as:

- master_id
- powertrain_seq
- trim_seq
- trim_row_key

These are not automatically promoted into the Quote v2 stable entity IDs.
Quote issuance stays fail-closed until stable VehicleModel / ModelYear / Trim / Powertrain IDs are supplied.

## Persistence

New Quote v2 persistence uses:

`QuoteFactory -> QuoteRepository -> FreePass Data/server command endpoint -> receipt`

The browser does not write a Firestore collection directly.

Repository writes are idempotent using:

`quoteId : quoteVersion : snapshotHash`

A persistence operation succeeds only after a matching write receipt is returned.
A mismatched receipt is a conflict, not success.

## Legacy RTDB

Current legacy files still use Realtime Database for historical share/chat/contract features, including:

- `src/firebase/quotes.js`
- `src/firebase/chat.js`
- `src/firebase/contracts.js`

They are migration debt only.

The Quote v2 core and API boundary are guarded so RTDB/direct Firestore dependencies cannot enter the new quote core.
Legacy removal happens only after equivalent command/read contracts exist and old share URLs have a migration/expiry policy.

## Pricing defects fixed in this branch

Two pricing defects are now guarded.

### Paid interior color

Paid interior color was previously carried in the request but omitted from some price assembly paths.

Fixed paths:

- provider-neutral request calculated vehicle price
- FreePass Standard total vehicle price
- external/Welrix provider option price

### External provider price authority

Welrix previously received `manualPrice: 0`, which allowed the provider's own vehicle price to become the calculation basis.

The adapter now:

- rebuilds price facts from FreePass Data before the provider call,
- sends a non-zero canonical `manualPrice`,
- verifies that the provider honored that override,
- preserves the FreePass canonical configured vehicle price as `vehiclePrice` / `totalCarPrice`,
- fails closed if the override is rejected or ignored.

Regression checks cover the full canonical price equation and the rejection path.

## Current blockers before runtime cutover

1. FreePass Data PR #49 now defines the dedicated `estimate-newcar-master/v1` consumer contract, but it is still Draft and no production ACTIVE release exists.
2. The current legacy new-car feed and vehicle-trim master contain no model-year source field. The existing `year: 2026` value is a UI builder default and is explicitly rejected as Quote authority.
3. Current Estimate UI option IDs must be reconciled with FreePass Data stable Option IDs. Name/label guessing is not allowed.
4. FreePass Data currently has no `PUT_ISSUED_QUOTE` command endpoint/receipt implementation.
5. Legacy shared quote viewer still loads RTDB share payloads.
6. GitHub Actions runner allocation remains unavailable for the Estimate PR; observed runs end with `runner_id=0` and zero executed steps.

Until these are resolved, Quote v2 stays Draft and must not silently fall back to RTDB or static-feed pseudo revisions.


## FreePass Data master bridge

Estimate now has a server-only bridge:

`/api/freepass-data-master`

The browser never receives the FreePass Data service token.

Required server environment:
- `FREEPASS_DATA_CONSUMER_BASE_URL`
- `FREEPASS_DATA_ESTIMATE_TOKEN`

The proxy accepts only:
- contract = `estimate-newcar-master/v1`
- projectionId = `estimate-newcar-master`
- authority = `CANONICAL_ACTIVE`
- schemaVersion = `1.0.0`
- positive integer release revision
- valid input/data SHA-256 digests
- valid activation timestamp

Both pricing APIs resolve the selected product/options/colors against this master **before calculation**. Quote issuance independently re-checks the same evidence and rejects any master-price mismatch between the calculation request and the FreePass Data record.
