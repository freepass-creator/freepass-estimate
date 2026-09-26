# I-01 Integration / Data — Quote persistence cutover

Status: **IMPLEMENTATION / CUTOVER NOT YET ENABLED**

## Ownership boundary

- FreePass Data owns canonical vehicle/master/price/ID data and durable data services.
- FreePass Estimate owns Quote v2 creation and Quote contracts.
- I-01 owns the transport and persistence boundary between them.
- Browser code must not know Firestore collection paths or the FreePass Data service token.
- RTDB is not a valid target for new Quote v2 writes.

## New Quote v2 write path

```
QuoteFactory / Quote v2
  -> QuoteRepository
     -> /api/issued-quotes
        -> FreePass Data quote command endpoint
           -> durable store
              -> freepass-quote-write-receipt/v1
```

The Estimate gateway validates the Quote v2 identity and idempotency key before forwarding.
It validates the upstream receipt again before returning success to the browser.

Idempotency key:

```
quoteId:v<quoteVersion>:snapshotHash
```

## Server environment

Required:

- `FREEPASS_DATA_ESTIMATE_TOKEN`
- either `FREEPASS_DATA_QUOTE_COMMAND_URL`
- or `FREEPASS_DATA_CONSUMER_BASE_URL`

When only `FREEPASS_DATA_CONSUMER_BASE_URL` is provided, Estimate resolves:

```
/v1/commands/freepass-estimate/issued-quotes
```

Production URLs must use HTTPS.

## Legacy policy

The existing RTDB paths such as `welrix_quotes/*` remain compatibility debt only.
They must not be used by Quote v2 core or the new gateway.

Cutover order:

1. deploy the FreePass Data quote command endpoint,
2. verify matching `freepass-quote-write-receipt/v1` receipts,
3. wire Quote issuance to the new repository,
4. stop new legacy RTDB quote writes,
5. keep legacy readers for old links during the migration window,
6. migrate/expire legacy links,
7. remove the legacy writer and then the reader.

No silent fallback from Quote v2 persistence to RTDB is allowed.


## Runtime composition

`src/lib/quote/persistence-runtime.js` is the UI-independent cutover seam.

```
request + calculation
  + current selected vehicle stable IDs
  + FreePass Data CANONICAL_ACTIVE master
    -> masterContextFromSelection
       -> issueQuotesFromCalculation
          -> persistIssuedQuotes
             -> QuoteRepository
                -> /api/issued-quotes
```

Fail-closed rules:

- missing FreePass Data master => no repository call
- missing stable vehicle/option/color identity => no repository call
- master/request price mismatch => no repository call
- repository unavailable => error returned; no second repository is attempted
- receipt identity/hash mismatch => persistence is treated as failed
- RTDB is never a fallback for this runtime

This runtime does not itself replace the current legacy send UI. The F/U lanes may call this seam only after the upstream FreePass Data contracts are live and C approves runtime cutover.
