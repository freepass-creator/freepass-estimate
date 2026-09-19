# FreePass Estimate

FreePass 제품군의 독립 견적기 저장소.

## 현재 단계

**UI BASELINE FIRST**

기능을 새로 상상해 만들기 전에 기존 검증 UI/UX를 정본으로 추출하고, 최신 FreePass 규격만 적용한 화면을 먼저 승인한다.

## 제품 구조

- `/new` — 신차 장기렌터카 견적
- `/new/cost` — 신차 전용 원가설정
- `/used` — 중고차 렌트·구독 견적
- `/used/cost` — 중고차 전용 원가설정
- `/quotes` — 견적 저장·공유·이력

## 확정 원칙

### 신차
- 장기렌터카만 제공한다.
- 렌트/구독 선택을 두지 않는다.
- 기존 Welrix 신차 견적 UI/UX를 화면 원형으로 사용한다.

### 중고차
- 렌트 / 구독이 있다.
- 기존 Sonogong 중고 견적 UI/UX를 화면 원형으로 사용한다.

### 모바일
PC 화면을 줄여 쓰지 않는다.

신차 차량 선택은 **한 화면 한 선택**이 기본이다.

`제조사 선택 → 자동으로 모델 → 자동으로 파워트레인 → 필요 시 인승/구동 → 트림 → 색상 → 옵션`

단일선택 단계는 선택 즉시 다음 화면으로 전진한다. 잘못 선택했을 때는 이전으로 돌아간다. 옵션 등 복수선택 단계와 여러 입력값이 있는 조건 화면만 명시적 다음 버튼을 사용한다.

### 디자인
새 UI를 창작하지 않는다.

- 기존 웹/모바일 정보 구조와 동선을 유지한다.
- FreePass Sales/Admin의 최신 시각 규격만 반영한다.
- 일반 버튼은 border 없이 면/글자 위계로 표현한다.
- 검색창·입력칸·실제 데이터 박스처럼 경계가 필요한 요소에만 border를 사용한다.
- 선택 상태는 옅은 면 + 글자 굵기로 표현한다.
- 의미 없는 카드 중첩과 선을 만들지 않는다.
- AI Core는 접근성·상태·포커스·반응형 검증 규격의 기준으로 사용한다.

## Reference repositories

- `freepass-creator/welrixtable` — 신차 UI/UX 및 계산 연결 Reference
- `freepass-creator/sonogong-estimator` — 중고 UI/UX 및 계산 Reference
- `freepass-creator/freepasserp4` — 기존 통합 견적 로직/회귀검사 Reference
- `freepass-creator/ai-core` — 공통 개발/디자인/검증 규격
- `freepass-creator/freepass-sales` — 최신 FreePass 모바일 UI 문법
- `freepass-creator/freepass-admin` — 최신 FreePass 웹/Admin UI 문법

기존 Reference 저장소는 이 프로젝트가 안정화되기 전까지 변경하거나 폐기하지 않는다.
