# FreePass Estimate UI Baseline

Status: **U-01 CANONICAL UI BASELINE**
Date: 2026-09-26

이 문서는 새로운 UI 기획서가 아니다. Estimate의 기존 견적 UX를 유지하면서 FreePass Admin PR #92 actual-route의 시각 언어를 정본으로 적용하기 위한 상속표다.

Visual authority:
- FreePass Admin PR #92
- inspected authority commit: `ac3ca6944012e43d8722a26024c5152a7e961ddb`
- local adoption contract: `docs/UI_ADMIN_PR92_ADOPTION.md`

과거 Welrix/Sales 화면은 구조·기능 이력 참고일 뿐 시각 정본이 아니다.

## 1. 화면 정본

### 신차 웹
Historical import reference only (현재 제품이나 브랜드가 아님):
- `freepass-creator/welrixtable/index.html`
- simple estimate mode: `28fr : 72fr`

유지:
- 상단 48px 계열 헤더
- 좌측 차량 구성
- 우측 조건 및 기간별 견적
- 좌/우 독립 스크롤
- 제조사 → 모델 → 파워트레인/세부모델 → 트림 → 색상 → 옵션
- 조건과 결과는 우측

변경 금지:
- 좌우 역할을 뒤집지 않는다.
- 카드형 대시보드로 재설계하지 않는다.
- 차량 선택을 별도 모달 중심으로 바꾸지 않는다.

### 신차 모바일
Historical import reference only (현재 제품이나 브랜드가 아님):
- `freepass-creator/welrixtable/src/components/mobile/MobileApp.vue`
- `StepVehicle.vue`
- `StickyQuote.vue`

정본 UX:
- **한 화면 한 선택**
- 단일 선택은 누르는 즉시 다음 화면으로 자동 전진
- 잘못 선택했을 때 `이전`으로 복귀
- 이전 이동 시 선택값 유지
- 복수선택인 옵션, 다중 입력인 조건 화면만 명시적 `다음`
- 결과는 별도 견적 화면
- 트림 선택 후에는 필요 시 `견적 보기`로 바로 이동 가능
- Sticky Quote는 기존 노출 시점을 따른다.

차량 흐름:
`제조사 → 모델 → 파워트레인 → (실제 분기 있을 때만 인승/구동) → 트림 → 색상 → 옵션`

## 2. 상품 규칙

### 신차
- 장기렌터카만.
- 렌트/구독 토글 없음.
- 신차 원가설정도 렌터카 전용.

### 중고
- 별도 페이지에서 렌트 / 구독.
- 신차 UI 승인 이후 별도 baseline을 만든다.

## 3. FreePass Admin PR #92 시각 규격 적용

Primary reference:
- `freepass-admin` PR #92 actual route: 전체 시각 언어·밀도·surface·interaction 정본
- `ai-core`: 접근성·focus·data state 기술 기준

핵심 문법:
- Minimal Operational UI
- Line-free UI
- Web: canvas 위 panel surface island
- Mobile: 현재 화면 자체가 panel surface
- Web standard control 36px / compact 32px
- Mobile control/action/touch 44px
- Typography 24 / 20 / 18 / 16 / 14 / 12
- Radius 4 / 6 / 8 / pill
- selected = tint/pressed surface, hover = elevation 변화

### 버튼
- 일반 버튼: `border: 0`
- 보조 행동: 투명 또는 연한 중립면
- 선택 상태: 옅은 tint + 굵은 글자
- 주 행동: 현재 단계에서 하나만 진한 면
- 장식용 outline 버튼 금지

### 입력
- 검색/입력/select처럼 실제 값을 담는 곳에만 경계 사용
- 기존 신차 웹의 밑줄형 select는 유지 가능
- label은 항상 보인다.

### 구분
- 섹션은 여백으로 나눈다.
- 의미 없는 카드 중첩 금지.
- 모든 섹션을 사각 테두리로 감싸지 않는다.
- visible border는 기본 위계 수단으로 쓰지 않는다.
- Web panel은 canvas + surface + gap + 얕은 elevation으로 구분한다.
- 입력/표처럼 의미상 필요한 곳도 먼저 surface/elevation으로 해결하고, 선은 최후 수단으로 제한한다.

### 선택 UI
- 알약(pill)을 기본 선택 표현으로 쓰지 않는다.
- 브랜드색으로 버튼 전체를 과하게 채우지 않는다.
- 일반 선택과 업무 상태 색을 구분한다.

### 숫자
- `font-variant-numeric: tabular-nums`
- 금액은 우측정렬 또는 열 정렬을 유지한다.

## 4. 승인 순서

1. 신차 웹 구조 캡처 확인
2. 신차 모바일 제조사 화면 확인
3. 모바일 자동전진 모델 화면 확인
4. 파워트레인 → 트림 → 색상 → 옵션 화면 확인
5. 조건 화면
6. 견적 결과 화면
7. UI 승인 이후 실제 데이터/계산 엔진 연결

**UI 승인 전 계산 엔진 이관을 시작하지 않는다.**
