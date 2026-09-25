# Quote Core v2 — 2026-09-25

Status: **DRAFT / P0 IMPLEMENTATION**

## Ownership

- **FreePass Estimate** owns calculation engines, Quote contracts, Quote snapshots, Quote version/revision rules and consumer delivery contracts.
- **FreePass Data** owns vehicle/master/policy Canonical data and release evidence.
- Firestore is a persistence adapter behind FreePass Data contracts. Estimate must not make Firestore collection paths part of its public contract.
- RTDB is not an allowed target for new Quote v2 writes.

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

## Pricing defect fixed in this branch

Paid interior color was previously carried in the request but omitted from some price assembly paths.

Fixed paths:

- provider-neutral request calculated vehicle price
- FreePass Standard total vehicle price
- external/Welrix provider option price

Regression checks now require paid interior color to increase the calculation basis.

## Current blockers before runtime cutover

1. Estimate runtime is not yet consuming a FreePass Data CANONICAL_ACTIVE release contract with all Quote master IDs.
2. FreePass Data consumer registration currently does not expose an Estimate catalog capability.
3. FreePass Data currently has no `PUT_ISSUED_QUOTE` command endpoint/receipt implementation.
4. Legacy shared quote viewer still loads RTDB share payloads.
5. CI runner allocation is currently unavailable for the PR; workflow started with runner_id=0 and zero executed steps.

Until these are resolved, Quote v2 stays Draft and must not silently fall back to RTDB or static-feed pseudo revisions.
