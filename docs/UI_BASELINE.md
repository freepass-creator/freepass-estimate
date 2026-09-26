# FreePass Estimate UI Baseline

Status: **U-01 CANONICAL UI BASELINE**  
Date: **2026-09-26**

FreePass Estimate의 시각 정본은 하나다.

- Design authority: **FreePass Admin PR #92 actual-route lineage**
- Local adoption contract: `docs/UI_ADMIN_PR92_ADOPTION.md`
- Canonical tokens: `apps/new/src/styles/tokens.css`
- Active UI lane: `work/ui-ux/canonical-hardening`

과거 프로젝트·mockup·reference 화면은 시각 정본으로 사용하지 않는다.

## 1. 제품 구조

### Web

Estimate의 업무 구조는 Admin을 복사하지 않는다.
견적기의 역할을 유지하면서 Admin #92의 시각 문법을 사용한다.

```
Information Topbar — 56px

[ Vehicle configuration ] [ Quote / conditions ]
          28                      72

Bottom action area — 56px
```

원칙:
- 차량 구성은 왼쪽
- 견적 조건과 결과는 오른쪽
- 두 작업면의 context를 동시에 유지
- 필요 시 각 Panel 독립 스크롤
- 상단은 정보만 표시
- 업무 액션은 하단 action boundary
- Web standard control 36px
- compact control 32px

### Mobile

모바일은 Web 축소판이 아니다.

```
Current estimate step = screen surface
Local bottom ActionBar
```

정본 UX:
- 한 화면 한 선택
- 단일 선택은 선택 즉시 다음 단계로 전진
- 이전 이동 시 기존 선택 유지
- 복수 선택/다중 입력 단계만 명시적 다음 버튼 사용
- 결과는 별도 화면
- 터치/action minimum 44px
- 버튼 2개 = 3:7
- 버튼 3개 = 3:3:4
- Primary는 action boundary당 1개

차량 흐름:
`제조사 → 모델 → 파워트레인 → 필요한 경우 인승/구동 → 트림 → 색상 → 옵션`

## 2. Responsive boundary

단일 경계만 사용한다.

- `<= 1024px` → Mobile shell
- `>= 1025px` → Web shell

별도의 tablet/hybrid shell을 만들지 않는다.

## 3. Visual grammar

**Minimal Operational UI + Line-free UI**

위계:
1. surface
2. elevation
3. spacing
4. typography
5. semantic state color
6. interaction

visible border는 기본 위계 수단으로 사용하지 않는다.

### Typography

`24 / 20 / 18 / 16 / 14 / 12`

- KPI 24
- Screen 20
- Panel 18
- Section 16
- Body 14
- Support 12

런타임 Estimate UI에 별도 10/11/13/15/17/22/30px typography scale을 만들지 않는다.
출력용 견적 문서는 별도 document layout contract를 따른다.

### Geometry

Spacing:
`4 / 8 / 12 / 16 / 20 / 24 / 32`

Radius:
`4 / 6 / 8 / pill`

Desktop:
- compact 32
- standard 36
- data row 40
- topbar 56
- panel/action foot 56

Mobile:
- control 44
- action 44
- touch minimum 44

## 4. Component semantics

### Entity / content card selected
- selected tint
- shallow inset/pressed surface
- 과도한 outline 없음

### Compact selection selected
- solid FreePass navy
- white text

### Result / output card
- neutral surface
- 선택 상태처럼 보이면 안 됨

### Status / Badge
- semantic signal color
- hover/press 없음

### Input / Select / Search
- neutral surface
- base elevation
- focus-visible halo
- 상시 visible outline/border에 의존하지 않음

## 5. Action placement

- Topbar: 정보/상태
- Page/Panel 업무 실행: 하단
- Primary action: 1개
- Secondary: neutral soft surface
- 위험 action: warning/error semantic tone

## 6. States

필요한 화면은 같은 문법으로 아래 상태를 표현한다.

- loading
- empty
- error
- disabled
- readonly
- busy
- offline/stale when applicable

Empty = neutral surface  
Error = semantic error surface + 접근성 role  
Loading 중 중복 실행 금지

## 7. Ownership boundary

U-01이 소유:
- Web/Mobile UI
- responsive composition
- tokens / typography / spacing / surfaces
- interaction states
- accessibility/focus
- visual regression

U-01이 변경하지 않음:
- Quote 계산
- Provider / Adapter
- FreePass Data master
- API / persistence schema
- business rule

문제 발견 시:
- Function → F
- Engine → E
- Integration/Data → I

## 8. Verification

UI 변경은 다음을 모두 만족해야 한다.

1. static UI authority guards
2. accessibility guards
3. production build
4. mobile screenshots: 360 / 390 / 412
5. responsive boundary: 834 / 1024 / 1025
6. desktop screenshots: 1280 / 1440
7. expanded live quote visual audit
8. no horizontal overflow
9. no stale topbar action
10. no off-scale runtime typography

새 화면은 새 디자인을 만드는 일이 아니다.
**현재 canonical component와 PR #92 visual grammar를 조합하는 일로 시작한다.**
