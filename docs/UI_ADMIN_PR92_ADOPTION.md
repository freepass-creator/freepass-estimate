# FreePass Estimate — FreePass Admin PR #92 UI Adoption

Status: **U-01 CANONICAL VISUAL CONTRACT**  
Date: **2026-09-26**

## Authority

FreePass Estimate의 시각 디자인 기준은 FreePass Admin PR #92 actual-route 계보다.

- repository: `freepass-creator/freepass-admin`
- PR: `#92` — *FreePass Admin UI/UX normalization and visual QA*
- visual authority commit inspected by U-01: `ac3ca6944012e43d8722a26024c5152a7e961ddb`
- Admin SSOT: `docs/ui/ADMIN-UI-UX-SSOT.md`

Estimate는 Admin의 업무 구조를 복사하지 않는다.
Estimate가 소유한 견적 흐름·기능·계산·데이터 계약은 그대로 유지하고,
**시각 언어와 interaction grammar만 Admin #92에 수렴**한다.

## One-line design definition

**Minimal Operational UI + Line-free UI**

위계는 다음 순서로 만든다.

1. surface
2. elevation
3. spacing
4. typography
5. state color
6. interaction

visible border는 기본 위계 수단으로 사용하지 않는다.

## Estimate mapping

### Web

Admin의 multi-panel 원칙을 Estimate의 역할에 맞게 2-panel로 적용한다.

```
Topbar — information only
Workspace
  ├─ Vehicle configuration panel
  └─ Quote / conditions panel
Bottom action area
```

유지:
- 차량 선택은 왼쪽
- 조건/결과는 오른쪽
- 28:72 역할 비율
- 좌/우 독립 스크롤이 필요한 현재 견적 UX
- 상단 CTA 금지
- 하단 action boundary

적용:
- canvas 위 white panel surface
- panel gap + viewport gutter
- panel visible border 제거
- selected = tint/pressed surface
- hover = elevation change
- 금액은 우측 정렬 + tabular nums
- Web standard control 36px
- compact control 32px
- data row 40px
- Topbar 56px
- Panel/action foot 56px

### Mobile

Admin #92 원칙대로 모바일은 PC 축소판이 아니다.

```
Current estimate step = screen surface
Local bottom ActionBar
```

유지:
- 한 화면 한 선택
- single choice 자동 전진
- 이전 시 선택 유지
- 옵션/조건 같은 multi-input 단계만 명시적 다음
- 결과 별도 화면
- 44px action/touch minimum
- 3:7 / 3:3:4 action ratio

적용:
- screen 자체에는 panel border/shadow 없음
- child card/control에만 필요한 surface/elevation
- width >= 380: 16px gutter
- narrow mobile: 12px gutter
- selected와 success 의미 분리

## Canonical scales

### Color

- primary: `#1B2A4A`
- primary hover: `#24395F`
- primary weak: `#EEF3FA`
- canvas: `#F2F6FC`
- surface: `#FFFFFF`
- surface soft: `#F7F9FC`
- surface hover: `#F3F6FA`
- selected: `#EAF1FF`
- text: `#101828`
- text secondary: `#475467`
- text muted: `#667085`
- text support: `#98A2B3`

### Typography

`24 / 20 / 18 / 16 / 14 / 12`

- KPI 24
- Screen 20
- Panel 18
- Section 16
- Body 14
- Support 12

### Spacing

`4 / 8 / 12 / 16 / 20 / 24 / 32`

### Radius

`4 / 6 / 8 / pill`

- small structure 4
- control/card 6
- panel 8
- capsule only when semantically appropriate

## Line-free rules

Borderless by default:
- Panel
- Card / Tile / RowCard
- Button
- QuickFilter
- Search
- Dropdown / Popover shell
- selection control

Input/select/textarea는 입력 영역의 식별이 필요한 경우 geometry를 유지하되,
상시 강한 외곽선 대신 neutral surface + elevation을 우선한다.

Focus는 제거하지 않는다.
항상 보이는 사각 outline 대신 focus-visible halo로 표현한다.

## Interaction states

모든 interactive component는 필요한 범위에서 아래 상태를 가진다.

- default
- hover
- pressed
- selected
- focus-visible
- disabled
- loading/busy
- empty
- error
- readonly/stale/offline when applicable

selected는 hover보다 더 떠오르는 상태가 아니다.
**selected = 눌려 고정된 surface**다.

## Migration rule

과거 Welrix/Sales 값은 runtime compatibility alias로만 남길 수 있다.
새 numeric visual constant를 페이지 내부에 추가하지 않는다.

숫자의 정본은 `src/styles/tokens.css`에 둔다.

새 UI 작업은:
1. existing component reuse 확인
2. shared token 사용
3. PR #92 grammar 적용
4. browser screenshot / visual regression 확인

순서로 진행한다.

## Out of scope

U-01은 아래를 변경하지 않는다.

- Quote 계산
- provider / adapter
- FreePass Data master
- persistence / API schema
- business rule

발견 시 F/E/I로 handoff한다.
