# PROJECT — FreePass Estimate

## Mission
FreePass의 신차/중고 견적을 독립 제품으로 운영한다.

## Authority / SSOT

**FreePass Estimate is the authoritative upstream source for estimator UI, UX, quote contracts, calculation-provider contracts, and estimator interaction rules.**

현재 견적 기능의 정본은 이 저장소다.

- FreePass Estimate = 원본 / SSOT / Upstream
- FreePass Sales = 소비자 / Downstream
- Welrix = 소비자 / Downstream
- 향후 다른 채널/파트너 견적 화면 = 소비자 / Downstream

역사적으로 Welrix의 검증된 신차 견적 구조와 FreePass Sales의 최신 모바일 UI 문법을 가져와 정리했지만,
**이관이 완료된 뒤의 변경 방향은 항상 FreePass Estimate → Downstream** 이다.

Downstream에서 발생한 개선사항을 정본으로 삼아 직접 역수입하지 않는다.
필요한 개선은 먼저 FreePass Estimate에서 검토·반영·검증한 뒤 각 소비처로 배포한다.

## Product boundaries
- 신차: 장기렌터카만.
- 중고차: 렌트 / 구독.
- 신차와 중고는 별도 화면, 별도 원가 정책/엔진.
- 공통화는 견적 결과 계약, 숫자/포맷, snapshot, 접근성/디자인 품질 규격에 한정한다.

## Current phase
UI BASELINE / USER APPROVAL

현재는 기존 검증 구조를 FreePass Estimate 정본으로 고정하고 최신 FreePass 규격을 적용·검증하는 단계다.

## Historical references
- Welrix: 기존 신차 웹/모바일 견적 구조 및 기존 계산 연결의 역사적 Reference
- Sonogong: 기존 중고 견적 구조의 역사적 Reference
- FreePass ERP4: 기존 견적 계산/회귀 데이터 Reference
- AI Core: 공통 개발·접근성·상태·품질 기준 Reference
- FreePass Sales: 모바일 상호작용/버튼/선택 상태의 디자인 Reference
- FreePass Admin: 웹 작업면/밀도/패널 위계의 디자인 Reference

위 Reference들은 **FreePass Estimate의 정본 권한을 갖지 않는다.**

## Distribution rule

```
FreePass Estimate
  ├─ estimator UI/UX
  ├─ interaction rules
  ├─ QuoteRequest / QuoteResult contract
  ├─ provider contract
  └─ estimator design rules
          │
          ├──> FreePass Sales
          ├──> Welrix
          └──> partner/channel surfaces
```

동기화 방향은 기본적으로 단방향이다.

**FreePass Estimate → Downstream**

## Target routes
- /new
- /new/cost
- /used
- /used/cost
- /quotes
