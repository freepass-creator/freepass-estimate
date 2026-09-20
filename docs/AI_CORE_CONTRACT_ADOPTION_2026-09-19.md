# AI Core Core Contract Adoption — FreePass Estimate — 2026-09-19

상태: **SHADOW PILOT**

AI Core 기준:
- P0 Core Contract: PR #94
- P1 adoption registry: AI Core PR #96
- Core target: `core-adapter-result/v1`

Estimate 기준:
- source branch: `work/ui-baseline`
- baseline revision: `8df0fdfe5ce72ffbc17b3adffcc881c37164ed3a`
- existing execution contract: `freepass-quote-execution/v1`

## 원칙

Estimate의 견적 산식, Provider 선택, QuoteResult, 공유 Snapshot은 그대로 유지한다.

AI Core가 제품 정본을 가져가지 않는다.

이번 작업은 기존 quote execution proof를 병행해서 Core adapter result로 projection하고 의미가 같은지 확인하는 **SHADOW adoption**이다.

## 추가된 경계

### 1. execution request identity

실제 견적 실행마다 `request_id`를 생성한다.

같은 execution object 안에서:
- FreePass execution request_id
- Core correlation_id

가 동일한 값을 공유한다.

견적 결과/산식/Provider routing에는 영향을 주지 않는다.

### 2. Core shadow projection

`src/lib/quote/core-contract-shadow.js`

변환:
- `freepass-quote-execution/v1.status` → Core status
- provider → provider_id
- subject_revision → source_revision
- request_id → correlation_id
- evidence → evidence_refs
- blockers/check failure → issues
- provider retry policy → retryable

Provider-specific error code 자체는 Estimate Adapter 영역에 남긴다.

### 3. 실제 계산 검증

`scripts/check-ai-core-contract-shadow.mjs`

실제 `견적계산()`을 사용해 두 경로를 확인한다.

1. 성공
   - SUCCEEDED
   - provider evidence 보존
   - correlation 보존
   - retryable=false

2. Provider 장애
   - FAILED
   - PROVIDER_UNAVAILABLE 보존
   - retryable=true
   - failure correlation 보존

## CI

`.github/workflows/newcar-ci.yml`에 별도 step을 추가했다.

Package의 `verify`에도 포함하되, GitHub Actions가 개별 checker를 나열하는 현재 구조 때문에 workflow step도 명시적으로 유지한다.

## 아직 CUTOVER가 아닌 이유

- AI Core schema package를 Estimate runtime dependency로 직접 사용하지 않음
- Core receipt input/output digest는 아직 적용하지 않음
- scoped source authority instance는 아직 AI Core registry 쪽 shadow만 존재
- production deployment/revision proof가 아직 HOLD

따라서 현재 단계는 **SHADOW**, VALIDATED/CUTOVER가 아니다.

## 다음 gate

1. 이 branch CI 전체 PASS
2. AI Core adoption registry에 실제 project revision 갱신
3. Core receipt digest shadow
4. project verify에서 반복 PASS
5. 그 뒤 `core.adapter-result.v1`만 SHADOW → VALIDATED 판정 검토
