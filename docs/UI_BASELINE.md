# FreePass Estimate UI Baseline

Status: **UI approval gate**
Date: 2026-09-19

이 문서는 새로운 UI 기획서가 아니다. 기존 견적기 UI/UX를 정본으로 두고 최신 FreePass 규격만 적용하기 위한 상속표다.

## 1. 화면 정본

### 신차 웹
Current canonical source:
- `apps/new/index.html`
- `apps/new/src/**`
- simple estimate mode: `28fr : 72fr`

Historical lineage:
- 최초 검증 기준은 `freepass-creator/welrixtable`에서 이관했지만, 현재 화면 정본은 FreePass Estimate다.

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
Current canonical source:
- `apps/new/src/components/mobile/MobileApp.vue`
- `apps/new/src/components/mobile/StepVehicle.vue`
- `apps/new/src/components/mobile/StickyQuote.vue`
- `apps/new/src/styles/tokens.css`

Welrix UI는 historical reference이며 앞으로 화면을 Welrix에서 다시 복사하지 않는다.

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

## 3. 최신 FreePass 시각 규격 적용

Reference:
- `freepass-sales`: 모바일 상호작용/버튼/선택 상태
- `freepass-admin`: 웹 작업면/밀도/패널 위계
- `ai-core`: 접근성·focus·data state의 기술 기준

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
- hairline은 구조상 필요한 패널 경계/행 구분에만 쓴다.

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


## 5. FreePass Sales Self Quote 범위

- Sales에서 소비하는 Self Quote는 신차 장기렌터카만 사용한다.
- 외형/상호작용은 이 문서의 FreePass Estimate canonical UI를 따른다.
- 산출방식은 `freepass.json → external/excel/welrix` provider를 통해 Welrix calculation truth를 사용한다.
- Welrix mapping이 없는 차량/트림은 Self Quote 선택 목록에서 노출하지 않는다.
- 중고 견적은 Sales Self Quote 범위에 포함하지 않는다.


## FreePass Suite UI Profile — 2026-09-21

Self Quote는 독립 디자인 시스템이 아니다. FreePass Sales의 Sales App / Promotion과 함께 AI Core 기반 `freepass-product-ui/v1.1`을 소비한다.

Binding:
- local: `.ai-core/freepass-product-ui.json`
- AI Core: `freepass-creator/ai-core@01e6bb7e0cd08e6390b452892516fd204ed64090`
- authorities: `SCREEN_DESIGN_STANDARD`, `FREEPASS_PRODUCT_UI_PROFILE`, `UI_UX_CONSTITUTION`, interaction contract

공통 grammar:
- FreePass 기본 테마: primary `#1b2a4a`, strong `#0f1b35`, soft `#e6ecf5`
- Welrix co-brand 테마: primary `#c81e2a`, strong `#a3131d`, soft `#fdecee`
- company config의 `ui_theme`가 브랜드 컬러를 선택하며 semantic status color는 변경하지 않음
- card 12px / control 10px / touch minimum 44px
- single-choice commit 160ms → auto-advance
- step entry 160ms
- pressed scale 0.965 / minimum hold 72ms
- haptic 7 / 12 / 18ms
- top informational / bottom actionable
- selected / pressed / focus-visible 분리
- reduced-motion / safe-area / bounded scroll owner

검증:
`npm run check:freepass-suite-ui`

Welrix는 계산 provider/calc authority이며 FreePass Sales Self Quote의 UI authority를 소유하지 않는다.
