# PROJECT — FreePass Estimate

## Mission
FreePass의 신차/중고 견적을 독립 제품으로 운영한다.

## Product boundaries
- 신차: 장기렌터카만.
- 중고차: 렌트 / 구독.
- 신차와 중고는 별도 화면, 별도 원가 정책/엔진.
- 공통화는 견적 결과 계약, 숫자/포맷, snapshot, 접근성/디자인 품질 규격에 한정한다.

## Current phase
UI BASELINE / USER APPROVAL

현재는 기존 UI/UX 상속과 최신 FreePass 시각 규격 적용을 검증하는 단계다.
UI 승인 전 계산엔진을 이식하지 않는다.

## Authoritative references
- New UI/UX: freepass-creator/welrixtable
- Used UI/UX: freepass-creator/sonogong-estimator
- Existing estimate calculation/regression: freepass-creator/freepasserp4
- Design/quality baseline: freepass-creator/ai-core
- Current mobile visual language: freepass-creator/freepass-sales
- Current web/admin visual language: freepass-creator/freepass-admin

## Target routes
- /new
- /new/cost
- /used
- /used/cost
- /quotes
