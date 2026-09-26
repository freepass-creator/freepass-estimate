# PROJECT — FreePass Estimate

## Mission

FreePass의 신차/중고 견적을 독립 제품으로 운영한다.

## Authority / SSOT

권한은 둘로 분리한다.

### FreePass Data

**FreePass Data is authoritative for vehicle/master facts.**

- VehicleModel / ModelYear / Trim / Powertrain stable ID
- 옵션 / 외장색 / 내장색 stable ID
- 기준 차량가격
- 옵션·색상 가격
- 차종 상태와 canonical release evidence

FreePass Estimate는 위 데이터를 복제해 별도 차종 Master를 만들지 않는다.

### FreePass Estimate

**FreePass Estimate is authoritative for estimator UI/UX, pricing engines, provider adapters, Quote contracts, snapshots, and estimator interaction rules.**

- FreePass Standard pricing engine
- 외부 Pricing Provider Adapter
- QuoteRequest / QuoteResult
- Quote Snapshot / Version / Hash
- 견적기 UI/UX
- 견적 결과·공유 규칙

외부 Provider는 산식을 제공할 수 있지만 차량가격의 source of truth가 아니다.

## Pricing flow

```
FreePass Data CANONICAL_ACTIVE Master
        │
        v
authoritative vehicle price assembly
        │
        ├──> FreePass Standard
        │
        └──> External Provider Adapter
                 └──> Welrix / future provider formula
        │
        v
normalized QuoteResult
        │
        v
immutable Quote
```

모든 계산기는 **동일한 FreePass Data 기준가격**에서 시작한다.

외부 Provider가 별도의 차량가격을 가지고 있어도 이를 기준값으로 사용하지 않는다.
Provider Adapter가 FreePass 기준가격 override를 전달할 수 없거나 Provider가 이를 적용하지 않으면 fail-closed 한다.

## Product boundaries

- 신차: 장기렌터카만.
- 중고차: 렌트 / 구독.
- 신차와 중고는 별도 화면, 별도 원가 정책/엔진.
- 공통화는 견적 결과 계약, 숫자/포맷, snapshot, 접근성/디자인 품질 규격에 한정한다.
- 차종 Master의 수집·정규화·보정·release는 FreePass Data의 범위다.

## Current phase

UI BASELINE + QUOTE/MASTER BOUNDARY HARDENING

현재는 기존 검증 구조를 FreePass Estimate 정본으로 고정하면서,
FreePass Data의 `estimate-newcar-master/v1` CANONICAL_ACTIVE read boundary와 Quote v2를 연결하는 단계다.

현재 `셀프견적` 화면은 UI 구조와 디자인을 확인하기 위한 껍데기일 수 있다.
운영 가능한 Quote 발행은 FreePass Data ACTIVE master release, pricing-engine evidence,
Quote persistence receipt 등 필요한 gate가 모두 충족된 경우에만 허용한다.

## Historical / integration references

- FreePass Data: 차량/가격 Canonical SSOT
- Welrix: 외부 계산 산식 및 기존 신차 UI/UX 검증 Reference
- Sonogong: 기존 중고 견적 구조의 역사적 Reference
- FreePass ERP4: 과거 견적 계산/회귀 데이터 Reference
- AI Core: 공통 개발·접근성·상태·품질 기준 Reference
- FreePass Sales: 모바일 상호작용/버튼/선택 상태의 디자인 Reference / downstream
- FreePass Admin: 웹 작업면/밀도/패널 위계의 디자인 Reference

Reference 저장소의 차량가격이나 임시 DB를 FreePass Data Master보다 우선하지 않는다.

## Distribution rule

```
FreePass Data
  └─ vehicle/master facts
          │
          v
FreePass Estimate
  ├─ estimator UI/UX
  ├─ interaction rules
  ├─ pricing engine / adapter
  ├─ QuoteRequest / QuoteResult contract
  └─ Quote snapshot / delivery rules
          │
          ├──> FreePass Sales
          └──> partner/channel surfaces
```

## Target routes

- /new
- /new/cost
- /used
- /used/cost
- /quotes
