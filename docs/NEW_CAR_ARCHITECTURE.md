# New-car Quote Architecture

Status: ACTIVE / CANONICAL
Date: 2026-09-19

## 1. Ownership

**FreePass Estimate owns the canonical new-car estimator UI/UX, interaction rules, quote contract, and quote-provider contract.**

This repository is the estimator upstream / SSOT.

Welrix and FreePass Sales are not estimator owners.

- Welrix supplied a previously verified estimator structure during migration.
- FreePass Sales supplied current FreePass mobile interaction/design language.
- Those inputs have now been absorbed into FreePass Estimate.
- From this point forward, canonical estimator changes originate here and propagate outward.

```
FreePass Estimate (canonical upstream)
      │
      ├──> FreePass Sales
      ├──> Welrix
      └──> Partner / Channel surfaces
```

A downstream implementation must not become the long-term source of truth by accident.

## 2. One UI, configurable calculation provider

The customer/staff screen does not change by provider.

```
Canonical New-car UI
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
   - Requires regression and policy approval before production changes.

2. **External**
   - The external company owns the calculation truth for that configured channel.
   - FreePass Sales Self Quote는 이 모드를 사용하며 Welrix가 계산 truth를 소유한다.
   - FreePass sends the normalized quote request to an adapter.
   - Adapter kinds:
     - Excel
     - ERP/API
   - No silent fallback to FreePass Standard. If the authoritative external calculator is unavailable, the quote fails visibly.

An external provider may own its **calculation truth**, but it does not own the shared estimator UI/UX or quote contract.

## 4. FreePass Sales Self Quote profile — ACTIVE

FreePass Sales에서 사용하는 셀프견적은 **신차 장기렌터카 전용**이다.

- UI/UX authority: FreePass Estimate의 현재 canonical UI
- calculation authority: Welrix
- active provider: `external:excel:welrix`
- product scope: `신차`
- silent fallback: 금지
- Welrix provider mapping이 없는 트림: 고객 선택면에서 제외

```json
{
  "quote_provider": {
    "mode": "external",
    "kind": "excel",
    "adapter_id": "welrix"
  }
}
```

Welrix external adapter는 기존 authoritative Welrix estimate API를 호출하고 응답을 FreePass result contract로 normalize한다.

FreePass Standard 엔진은 별도 capability로 보존하지만 **FreePass Sales Self Quote의 활성 산출엔진이 아니다**.

이 관계는 provider integration이며 UI 소유권이 아니다.

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

## 7. Canonical change flow

All estimator-specific structural changes follow this order:

1. Implement in FreePass Estimate.
2. Run contract/regression/UI verification.
3. Establish the new canonical baseline.
4. Propagate to FreePass Sales, Welrix, and other consumers.

If an emergency downstream hotfix is unavoidable:
1. patch operationally,
2. immediately back-port the intended behavior here,
3. validate here,
4. reconcile the downstream implementation to this canonical source.

## 8. Historical migration lineage

The canonical implementation was built using:
- verified Welrix web/mobile estimator structure,
- FreePass Sales mobile UI conventions,
- FreePass Admin web density/hierarchy conventions,
- AI Core technical design/accessibility standards,
- existing FreePass/ERP calculation regression assets.

These are lineage/reference sources. They are not competing canonical owners.

## 9. Migration completion direction

The architectural end state is:

1. FreePass Estimate remains authoritative.
2. FreePass Sales consumes the estimator capability instead of maintaining a divergent copy.
3. Welrix consumes the estimator capability while retaining its configured external calculation provider where required.
4. New partner/channel surfaces consume the same canonical contracts and interaction rules.
