# FreePass Estimate

FreePass 제품군의 **견적 기능 정본(SSOT / Upstream)** 저장소.

## 소유권

현재 견적 기능의 원본은 FreePass Estimate다.

- **FreePass Estimate** — 정본 / Upstream
- **FreePass Sales** — 소비자 / Downstream
- **Welrix** — 소비자 / Downstream
- **향후 파트너·채널 견적 화면** — 소비자 / Downstream

Welrix에서 검증된 신차 견적 구조와 FreePass Sales의 모바일 UI 문법을 가져와 정리했지만,
이제 견적 기능의 변경은 **FreePass Estimate에서 먼저 발생하고 downstream으로 전달**되어야 한다.

```
FreePass Estimate
   ├──> FreePass Sales
   ├──> Welrix
   └──> Partner / Channel
```

Downstream에서 별도 진화한 견적 기능을 그대로 정본으로 삼지 않는다.
필요한 개선은 이 저장소에 반영·검증한 뒤 다시 배포한다.

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
- 현재 이 저장소에 이관·검증된 신차 UI/UX를 정본으로 사용한다.

### 중고차
- 렌트 / 구독이 있다.
- 중고 견적도 안정화 후 이 저장소가 정본을 소유한다.

### 모바일
PC 화면을 줄여 쓰지 않는다.

신차 차량 선택은 **한 화면 한 선택**이 기본이다.

`제조사 선택 → 자동으로 모델 → 파워트레인(연료·배기량 + 필요 시 인승·구동 포함) → 트림 → 색상 → 옵션`

단일선택 단계는 선택 즉시 다음 화면으로 전진한다. 잘못 선택했을 때는 이전으로 돌아간다. 옵션 등 복수선택 단계와 여러 입력값이 있는 조건 화면만 명시적 다음 버튼을 사용한다.

### 액션 배치
- 상단은 정보 영역이다.
- 주요 업무 액션은 하단에 둔다.
- 단일 선택 자동전진 단계에서도 하단 Navigation 구조는 준비된 상태로 유지한다.
- 필요 단계에서만 `다음`을 노출한다.

### 디자인
- 견적기의 현재 정본 구조를 기준으로 개선한다.
- FreePass 공통 규격과 충돌하지 않는 범위에서 견적기 전용 상호작용을 이 저장소가 소유한다.
- 일반 버튼은 border 없이 면/글자 위계로 표현한다.
- 검색창·입력칸·실제 데이터 박스처럼 경계가 필요한 요소에만 border를 사용한다.
- 선택 상태는 옅은 면 + 글자 굵기로 표현한다.
- 의미 없는 카드 중첩과 선을 만들지 않는다.
- AI Core는 접근성·상태·포커스·반응형 검증 규격의 기준으로 사용한다.

## Historical / design references

아래 저장소는 참고자료이거나 소비처다. 견적 정본 권한은 없다.

- `freepass-creator/welrixtable` — 기존 신차 UI/UX 및 계산 연결 Reference / downstream
- `freepass-creator/sonogong-estimator` — 기존 중고 UI/UX Reference
- `freepass-creator/freepasserp4` — 기존 견적 로직/회귀검사 Reference
- `freepass-creator/ai-core` — 공통 개발/디자인/검증 규격
- `freepass-creator/freepass-sales` — 모바일 UI 문법 Reference / downstream
- `freepass-creator/freepass-admin` — 웹/Admin UI 문법 Reference

## 운영·배포 원칙

- GitHub Actions는 현재 릴리스 게이트로 사용하지 않는다.
- 신차 견적 앱의 배포 루트는 `apps/new`다.
- 로컬 정본 검증은 `cd apps/new && npm ci && npm run verify:local`로 수행한다.
- production 배포 후에는 실제 배포 revision, `/mobile.html?force=mobile`, `b/m/t` 딥링크, 견적 계산·공유 링크를 수동 smoke test한다.
- production 배포가 확인되기 전에는 FreePass Sales Promotion의 현재 runtime URL을 바꾸지 않는다.

자세한 절차는 `docs/MANUAL-RELEASE.md`를 따른다.

## 변경 원칙

견적 관련 변경은 다음 순서를 따른다.

1. FreePass Estimate에서 변경
2. 로컬/회귀/시각 검증
3. 정본 확정
4. FreePass Sales / Welrix / 파트너 화면에 반영

**견적 기능의 근원지는 이 저장소다.**
