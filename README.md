# FreePass Estimate

FreePass 제품군의 **견적 UI·견적 산식·Quote 계약 정본** 저장소.

> 차량/트림/옵션/색상/연식/기준가격의 정본은 **FreePass Data**다.  
> FreePass Estimate는 차종 마스터를 소유하거나 재구축하지 않는다.

## 권한과 데이터 흐름

역할은 아래처럼 분리한다.

- **FreePass Data** — Vehicle Master / 기준가격 / 옵션·색상 가격 / stable ID의 SSOT
- **FreePass Estimate** — 견적 UI/UX / 표준 산식 / 외부 산식 Adapter / Quote 계약의 SSOT
- **FreePass Standard** — FreePass Estimate가 소유하는 기본 견적 산식
- **Welrix 및 향후 외부사** — 연결 가능한 외부 계산 Provider. 산식은 제공할 수 있지만 차량가격의 권한은 갖지 않는다.
- **FreePass Sales / 파트너·채널 화면** — 견적 기능 소비자

```
FreePass Data
  └─ CANONICAL_ACTIVE Vehicle Master
       ├─ vehicle / trim / model-year stable ID
       ├─ base price
       ├─ option / exterior / interior color price
       └─ release evidence
            │
            v
FreePass Estimate
  ├─ FreePass Standard pricing engine
  ├─ External Provider Adapter
  │    ├─ Welrix formula
  │    └─ future partner formula
  └─ Quote / Snapshot / Version / Hash
            │
            ├──> FreePass Sales
            └──> Partner / Channel
```

**차가 무엇이고 얼마짜리인지는 FreePass Data가 결정한다.  
그 기준값을 어떤 산식으로 계산할지는 FreePass Estimate가 결정한다.**

## 가격 권한 규칙

모든 산식은 동일한 FreePass Data 기준값에서 시작한다.

1. 화면이 선택한 `productId + stable option/color ID`를 계산 서버로 보낸다.
2. 계산 서버가 FreePass Data의 `estimate-newcar-master/v1` CANONICAL_ACTIVE release를 다시 조회한다.
3. 트림/옵션/외장색/내장색 가격을 서버에서 재조립한다.
4. 그 가격을 FreePass Standard 또는 외부 Provider Adapter에 넣는다.
5. 외부 Provider가 자체 차량가격을 돌려줘도 master fact로 승격하지 않는다.
6. 외부 Provider가 FreePass 기준가격 override를 지원하지 않거나 무시하면 **계산을 중단한다.** 다른 가격이나 다른 엔진으로 조용히 fallback하지 않는다.

즉 브라우저가 들고 있는 가격 숫자와 외부 Provider의 차량가격은 권한값이 아니다.

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
- 차량 Master는 FreePass Data에서 읽는다.
- 현재 이 저장소에 이관·검증된 신차 UI/UX와 계산 Provider 계약을 정본으로 사용한다.

### 중고차
- 렌트 / 구독이 있다.
- 중고 차량 Master 역시 FreePass Data 소유를 원칙으로 한다.
- 중고 견적 산식과 Quote 계약은 안정화 후 이 저장소가 정본을 소유한다.

### 모바일
PC 화면을 줄여 쓰지 않는다.

신차 차량 선택은 **한 화면 한 선택**이 기본이다.

`제조사 선택 → 자동으로 모델 → 자동으로 파워트레인 → 필요 시 인승/구동 → 트림 → 색상 → 옵션`

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

## Historical / integration references

아래 저장소는 역할이 다르며 FreePass Data의 차량 Master 권한을 대체하지 않는다.

- `freepass-creator/freepass-data` — 차량 Master / 기준가격 SSOT
- `freepass-creator/welrixtable` — Welrix 외부 산식·기존 UI/UX 검증 Reference
- `freepass-creator/sonogong-estimator` — 기존 중고 UI/UX Reference
- `freepass-creator/freepasserp4` — 과거 견적 로직/회귀검사 Reference
- `freepass-creator/ai-core` — 공통 개발/디자인/검증 규격
- `freepass-creator/freepass-sales` — 모바일 UI 문법 Reference / downstream
- `freepass-creator/freepass-admin` — 웹/Admin UI 문법 Reference

## 변경 원칙

견적 관련 변경은 다음 순서를 따른다.

1. 차량/가격 fact가 바뀌는 문제라면 FreePass Data에서 수정한다.
2. 산식/Provider/Quote/UI 문제라면 FreePass Estimate에서 수정한다.
3. 자동·회귀·가격권한·시각 검증을 통과시킨다.
4. 정본 확정 후 FreePass Sales / 파트너 화면에 반영한다.

**FreePass Data는 차량 사실의 근원지이고, FreePass Estimate는 견적 계산의 근원지다.**
