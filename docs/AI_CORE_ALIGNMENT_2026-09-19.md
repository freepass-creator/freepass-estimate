# FreePass Estimate ↔ AI Core Alignment — 2026-09-19

Status: ACTIVE

## 결론

FreePass Estimate와 AI Core는 상하 관계가 아니라 역할이 다르다.

- **FreePass Estimate**: 견적 Domain SSOT / 실제 제품 동작 / Quote Engine & Provider / 견적 UX 정본
- **AI Core**: 그룹 공통 개발·실행·증거·revision·release·접근성 규격

Estimate가 AI Core보다 앞선 부분은 AI Core 학습 후보로 올리고,
AI Core가 앞선 공통 운영 규격은 Estimate가 채택한다.

## Estimate가 앞선 부분

1. Provider-neutral QuoteRequest / QuoteResult
   - 화면은 계산 공급자를 모른다.
   - STANDARD와 EXTERNAL을 같은 UI에서 사용한다.
   - External은 Excel / ERP adapter로 확장한다.
   - 외부 공급자 장애 시 다른 계산기로 silent fallback하지 않는다.

2. 실제 도메인 Engine / Adapter 분리
   - FreePass Standard 계산 의미는 Estimate가 소유한다.
   - Welrix 계산 진실값은 external provider adapter가 소유한다.
   - 공급자별 단위·필드 변환은 adapter 내부에 가둔다.

3. UI 상태계약
   - 단일선택은 즉시 자동전진.
   - Back은 선택값을 보존한다.
   - Next 인프라는 DOM/공통 footer 계약에 유지하되 auto 단계에서는 숨긴다.
   - Top is informational / Bottom is actionable을 실제 제품 flow로 검증한다.

4. 도메인 회귀검사
   - 차량 구성 resolver
   - provider routing
   - standard engine regression
   - UI parity / action placement / mobile navigation contract
   - fail-closed 정책

## AI Core가 앞선 부분과 Estimate 채택 상태

### A. Revision / Production proof — ADOPTED P0
AI Core의 Shared Release Gate 원칙을 채택한다.

- Git merge != deploy
- deploy READY != production proof
- 실제 운영 주소가 expected revision을 서빙해야 완료
- `/api/version`을 revision proof endpoint로 추가
- rollback candidate와 runtime smoke를 release proof에 포함

### B. Execution result evidence — ADOPTED P0
AI Core adapter/result envelope 패턴을 견적 도메인에 맞게 축소 적용한다.

- schema
- SUCCEEDED / HOLD / FAILED
- provider / engine
- started_at / ended_at
- evidence
- checks
- blockers
- subject_revision

기존 QuoteResult payload는 깨지지 않으며 `실행` metadata를 추가하는 방식으로 호환성을 유지한다.

### C. Error taxonomy — ADOPTED P0
문자열 오류만 던지지 않고 안정적인 code를 병행한다.

예:
- QUOTE_REQUEST_INVALID
- QUOTE_ENGINE_UNSUPPORTED
- QUOTE_RESULT_INVALID
- PROVIDER_UNSUPPORTED
- PROVIDER_ERROR / PROVIDER_UNAVAILABLE

### D. Accessibility — ADOPTING P1
AI Core Screen Design Standard를 공통 최소선으로 채택한다.

- WCAG 2.2 AA target
- touch target 44px minimum
- persistent visible label
- visible focus
- keyboard semantics
- color-only meaning 금지
- loading/empty/error/populated 분리

Estimate의 견적 전용 동작 규격은 그대로 Estimate가 소유한다.

### E. Release / runtime evidence — ADOPTING P1
현재 CI의 build/provider/domain 검사에 더해 production observation과 revision proof를 별도 단계로 유지한다.
CI success 자체를 운영 완료로 표현하지 않는다.

## 발견된 실제 drift

모바일 본체는 이미 상단 CTA를 제거하고 하단 action footer로 이동했지만,
`scripts/e2e-mobile-ux.mjs`에는 과거 `.m-header .m-act` 공유 버튼 계약이 남아 있었다.

이는 “구현은 최신인데 검증기가 과거 규격”인 drift다.
E2E를 현재 하단 action contract로 수정하고, 이후 검증 규격 자체의 revision drift도 관리한다.

## Authority

견적 기능의 근원지는 FreePass Estimate다.
AI Core의 공통 규격을 채택하더라도 견적 업무 의미와 UI flow 소유권이 AI Core로 이동하는 것은 아니다.

```
AI Core common standards
        ↓ adoption
FreePass Estimate — estimator/domain SSOT
        ↓ distribution
FreePass Sales / Welrix / Partner Channels
```
