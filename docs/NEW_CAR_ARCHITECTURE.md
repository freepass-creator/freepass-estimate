# New-car Quote Architecture

Status: ACTIVE DESIGN
Date: 2026-09-19

## 1. Ownership

**FreePass Estimate owns the new-car estimator UI/UX and quote contract.**

Welrix is no longer the long-term architectural owner. Its current app is the migration baseline because that UI/UX is already verified. After parity is proven, partner/channel apps should consume FreePass Estimate rather than fork its UI.

## 2. One UI, configurable calculation provider

The customer/staff screen does not change by provider.

```
New-car UI
  │
  ├─ vehicle selection
  ├─ conditions
  └─ normalized QuoteRequest v1
          │
          ▼
    Quote Provider
      ├─ STANDARD
      │    └─ freepass-standard
      │
      └─ EXTERNAL
           ├─ excel:welrix
           ├─ excel:<partner>
           └─ erp:<partner>
```

Provider selection belongs to company/channel configuration. It is not shown as a quote-screen toggle.

## 3. Top-level business choice

There are two business modes:

1. **FreePass Standard**
   - FreePass owns cost policy and calculation rules.
   - Uses the FreePass standard engine.
   - Requires its own regression and policy approval before becoming production default.

2. **External**
   - The external company owns the calculation truth.
   - FreePass sends the normalized quote request to an adapter.
   - Adapter kinds:
     - Excel
     - ERP/API
   - No silent fallback to FreePass Standard. If the authoritative external calculator is unavailable, the quote fails visibly.

## 4. Current Welrix mapping

```json
{
  "quote_provider": {
    "mode": "external",
    "kind": "excel",
    "adapter_id": "welrix"
  }
}
```

Welrix external adapter currently calls the existing authoritative Welrix estimate API and normalizes the response into the FreePass result contract.

## 5. Security boundary

Browser receives:
- company/channel display config
- provider mode/kind/adapter id
- quote result

Browser must NOT receive:
- partner Excel files containing proprietary formulas unless explicitly intended as public assets
- ERP credentials
- API secrets
- service-account credentials

External execution and credentials stay server-side.

## 6. UI parity rule

Changing quote provider must not require changes to:
- web vehicle selection
- mobile one-screen-one-choice flow
- conditions UI
- result UI
- quote sharing UI

If a provider needs extra private parameters, those belong to its server adapter/config, not a provider-specific customer UI unless the user explicitly approves a new shared quote field.

## 7. Migration order

1. Import current verified Welrix UI/UX as pinned baseline.
2. Make both web and mobile use the same Quote Provider Contract.
3. Keep Welrix mapped to external Excel so existing outputs remain authoritative.
4. Verify UI parity and Welrix output parity.
5. Harden FreePass Standard with regression coverage.
6. Add partner Excel/ERP adapters as needed.
7. Make FreePass Estimate authoritative.
8. Change Welrix/partner surfaces to consume FreePass Estimate instead of maintaining cloned UI code.
