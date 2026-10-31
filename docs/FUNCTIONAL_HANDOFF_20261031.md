# 견적기 기능 인수 — 2026-10-31

코드 기준 브랜치: `work/integration/estimate-writer-runtime`. UI/UX 후속 작업은 이 통합 결과를 기준으로 진행한다. 별도로 생성된 요율 엔진·제조사 옵션 감사 브랜치도 이 브랜치에 병합했다.

## 수수료 입력 위치와 계산

- 모바일: 차량/색상/옵션 → 추가 조건 → **계약 조건**. 보증금·선납금 다음 **영업 수수료** 칸에서 입력한다.
- 데스크톱: 계약 조건의 동일한 **영업 수수료** 컴포넌트.
- 위/아래 버튼과 직접 입력을 함께 제공한다. 입력 범위 **0.0~5.0P**, **0.5P** 간격, 초기값 **풀피 5.0P**. 회사 고정 **1.0P**를 서버에서 합산한다. 예: 영업 2.5P → 적용 3.5P.
- 고객용 PNG/공유 스냅샷에는 숫자 수수료 대신 `참조 CF`처럼 두 글자만 보존한다. A=0~J=9, 정수/소수 첫째 자리 순이다. 0.0=AA, 2.5=CF, 5.0=FA.
- `FeeControl.vue`는 입력 UI, `commission-policy.js`는 공통 규칙이다. 공급사 어댑터도 서버에서 회사 1P를 재합산한다.

## 수도권 기준

신규 견적은 화면의 이전 지역값에 관계없이 수도권 기준이다. 기존 등록 요금표의 수도권 탁송비 **130,000원**을 사용한다. 별도 신설한 금액이 아니다.

`src/lib/quote/launch-region.js`가 기준을 정의한다. 화면 조립과 공개 API 모두 같은 기준을 적용하고, 탁송 별칭·준비비 합계도 함께 갱신한다. 모바일/데스크톱에서 다른 지역 선택은 잠시 닫았다. 기존에 발송된 스냅샷은 당시 금액과 지역을 유지한다.

## 견적·복사·공유

- 최종 결과는 신용 무관 / 소득 확인 / 신용 심사 3종을 자동 비교한다. 공급사 이름은 고객 화면·복사 이미지·공유 데이터에 내보내지 않는다.
- 차량 가격은 트림 가격 + 옵션·색상 추가금 = 신차 총가격 세 줄이다. 모델/파워트레인/트림/선택 옵션명/색상, 담당자 2줄, 만 26세 이상, 정비 제외를 보존한다.
- 이미지는 간결한 3종·36/48/60개월 비교, 상세 내용은 링크로 공유한다. 링크에는 발송 시점 금액을 저장해 재열기/재복사 시 금액이 바뀌지 않는다.
- 차량가격은 FreePass Data CANONICAL_ACTIVE master의 stable ID로 서버에서 다시 확인한다. 공급사 카탈로그는 가격 기준으로 사용하지 않는다.

## 계산 경로와 검증 증거

운영 카매치 어댑터는 Work가 검증한 **다기간 원본 화면 계산 경로** `api/_kamatch/calculate.js`를 호출한다. 과거 helper와 달리 표시 잔가/계산 잔가를 구분하고 할인 전 법인수수료 기준을 유지한다. `formula.js`의 과거 helper 포팅은 연구/회귀 테스트용이며 운영 어댑터가 호출하지 않는다.

실행한 검증:

- 실제 원본 화면 수집 39개 견적 × 월료/보증금/선납금/표시잔가율/잔존금액/취득가격: 오차 0원.
- 고정 digest 공개 원본 프로그램과 격리 산술 대조: 유효 939개 차량, 45,072개 월료 결과, 오차 0원. 원본 사이트에 45,072회 요청한 것이 아니다.
- 수수료 11개 값 전체 코드 왕복, 입력 범위/간격, 서버 고정 1P 합산.
- 공개 API의 수도권 정규화가 양쪽 어댑터 요청에 동일하게 도달함을 확인.
- 공급사 어댑터·표준 추론·옵션 감사·공유 스냅샷·가격 구성·provider/runtime 계약·조건 비용 검사 통과.
- Chromium 실제 브라우저: 차량/유료 옵션/색상 → 보증 10%/선납 5%/영업 2.5P → 3종 9개 월료 → PNG 클립보드 → 공유 링크 재열기/PNG 재복사 → 비교 화면 통과. 콘솔 오류 없음. 이 통합 실행은 명시적 합성 Data master/카매치 요율 fixture와 실제 웰릭스 API를 사용했다.
- 프로덕션 Vite 빌드 통과.

주요 재검증 명령은 `apps/new`에서 실행한다:

```sh
npm run build
npm run check:commission
npm run check:kamatch
node scripts/check-kamatch-parity.mjs
# digest가 일치하는 원본 공개 JS 파일을 명시한 경우
node scripts/check-kamatch-source-parity.mjs /path/to/pinned-public-bundle.js
node --test scripts/public-offers.test.mjs scripts/audit-official-option-reference.test.mjs
npm run check:standard-inference
npm run check:snapshot
npm run check:comparison
npm run check:welrix-comparison
npm run check:provider
npm run check:runtime
npm run check:quote-preview
npm run check:condition-cost-authority
```

## 운영 연결 상태

이 업로드는 코드 통합과 검증 결과이며 운영 배포를 수행하지 않았다. 실행 환경에는 운영 Data master 접근 설정과 실제 stable product ID별 검토된 카매치 매핑이 연결되어 있지 않다. 현재 구현은 이 자료가 없거나 서로 버전이 다르면 해당 견적을 조회 불가로 표시한다. 합성 테스트 결과를 실제 전 차종 운영 견적 검증으로 취급하지 않는다.

운영 배포에는 기존 `.env.example`의 Data 소비 설정과 `KAMATCH_REFERENCE_FILE`/`KAMATCH_PROFILE_FILE`의 비공개 요율·검토 매핑 경로를 연결한다. 요율은 앱 digest/테이블 digest/수집시각을 검증한다. 설치 도구 `scripts/install-kamatch-reference.mjs`는 비밀 파일을 gitignored 경로에 보관한다. 수집된 원본 요율/카탈로그 연구 자료와 운영의 canonical stable ID 매핑은 별개다.

제조사 옵션 감사 결과는 참고 자료이며 Data 활성 master에 자동 승격하지 않았다. 관련 공식 기아 가격 파서 수정은 Data PR #834에 별도로 올려 두었다.

## UI 후속 작업의 접점

- 마지막 조건·수수료: `src/components/mobile/StepConditions.vue`, `src/components/ConditionsForm.vue`, `src/components/FeeControl.vue`
- 결과: `src/components/mobile/StepResult.vue`, `src/components/TermsGrid.vue`
- 비교: `src/components/QuoteComparison.vue`
- 고객 이미지: `src/lib/customer-conditions-image.js`, `src/lib/copy-quote-image.js`
- 공유 계약: `src/lib/share-link.js`
- 공개 API/응답: `api/public-quotes.js`, `api/_private/public-offers.js`

UI 수정 시 공급사 명칭 비노출, 동일 가격 기준, 회사 고정 1P, 고객 수수료 코드, 저장 견적 금액 불변 계약을 유지한다.


## 웹·모바일 통합 화면 (사용자 후속 요청)

웹의 신규 견적 진입도 이제 모바일과 같은 `MobileApp.vue`다. 화면 폭이 1100px 이상이면 왼쪽에 동일한 선택 흐름, 오른쪽에 선택 내역/가격 구성/계약 조건/3종 월료를 보조적으로 보여준다. 오른쪽은 공통 계산 결과를 읽는 표시 전용이며 추가 API 요청을 발생시키지 않는다. 1100px 미만에서는 한 열로 돌아오며 선택 상태와 단계가 유지된다.

화면 접점: `src/components/DesktopQuoteCompanion.vue`, `src/components/mobile/MobileApp.vue`. `index.html`과 `mobile.html`은 같은 앱을 시작한다. 과거 `?q=` 저장 견적과 관리자 URL은 `legacy-quote.html`에서 보존한다.

검증: 브라우저에서 선택 요약 즉시 반영, 양쪽 9개 월료 일치, 화면 폭 변경 후 상태/금액 보존, 오른쪽으로 인한 추가 계산 없음, PNG 복사/상세 링크 재열기/재복사, 공급사 명칭 비노출을 확인했다. 실 API를 포함한 실행의 차량/카매치 자료는 기존과 같이 합성 fixture이며 웰릭스는 실제 요청이었다. 별도 UI 회귀 검사 `npm run test:workspace`는 명시적인 합성 응답을 사용한다. Playwright 설치 환경에서 실행하고, 기존 실행 환경의 모듈을 쓸 경우 `PLAYWRIGHT_MODULE`/`CHROMIUM_PATH`/`BASE_URL`을 지정할 수 있다.

[통합 웹 선택 화면 캡처](assets/unified-estimate-desktop.png): UI 회귀 테스트의 합성 차량과 금액이며 운영 견적 증거가 아니다.

## 영업 수수료 기본값 후속 확정

새 견적은 영업 풀피 5.0P로 시작하며 회사 고정 1.0P를 더해 총 6.0P를 적용한다. 이전 견적에서 낮춘 수수료를 새 견적의 기본값으로 자동 가져오지 않는다. 보증금·선납금·영업 수수료는 같은 계약 조건 화면에 있고 영업자가 조정한 뒤 견적 보기로 최종 견적 페이지에 진입한다. 오른쪽 보조 영역은 현재 조건을 미리 보여주는 공통 결과 표시다. 확정 견적/PNG/공유는 조정 후의 동일한 입력과 금액을 사용한다. 저장된 공유 금액은 유지하며 공유 견적에서 새 계산을 시작할 때 수수료는 다시 풀피로 설정한다.


## 동선 단축 및 기본 선택 (최신 사용자 요청)

제조사/모델/파워트레인/트림의 누르는 즉시 이동은 유지한다. 트림 선택 시 외장·내장색은 선택 가능한 추가금 없는 색상을 우선 선택한다. 무료 색상이 없는 경우 확인된 최저가 색상을 source 순서로 선택하며 유료 색상 금액을 숨기거나 무료로 만들지 않는다. 사용자가 고른 색상은 뒤로 이동해도 유지하고 트림 변경 시 해당 트림 색상으로 다시 설정한다.

옵션은 비워 둔 채 다음으로 진행할 수 있다. 원래 배타그룹·선행조건·종속 해제와 서버 stable-ID 검증을 유지했다. 별도 추가 조건 페이지를 제거해 옵션 다음은 곧바로 계약 조건이다. 맨 위 한 줄에 **보증금 / 선납금 / 영업 수수료**를 배치한다. 수수료 초기값 풀피 5P, 0.5P 조정, 회사 1P 고정은 그대로다. 기간·주행은 그 아래, 수도권·보험·기본 용품은 접힌 기본 조건, 담당자 정보는 접힌 수정 영역이다. 최종 견적 진입은 이 화면의 견적 보기 버튼이다. 웹도 동일 컴포넌트를 사용한다.

기본 용품 선택은 각 공급사의 검토된 기본 구성으로 연결한다. 카매치 어댑터는 수도권 기본 탁송/기본 선팅/기본 블랙박스 선택에 다른 공급사의 단가 차이를 추가하지 않는다. 임의의 원가를 새로 만들지 않고 검토된 profile.baselines를 사용한다. 기존 명시적 용품 변경/제외 요청의 차액 경로는 유지했다. 고객 화면에는 기본 선팅/기본 블랙박스로 표시한다.

검증: 기본 무료 색상 자동 선택, 옵션 미선택 진행/뒤로 복귀, 상단 세 입력의 배치와 풀피 기본값, 기본 조건 접힘, 배타/선행/종속 해제, 트림별 master 규칙, 원본 단가와 기본 용품의 추가금 중복 방지 검사 통과. 실제 브라우저의 3종 9개 금액/수수료 조정/PNG/공유 재열기·재복사도 통과했다. 실 API 통합 실행은 합성 Data·카매치 fixture와 실제 웰릭스 응답의 조합이며, 별도 UI 회귀 실행은 전체 합성 fixture다.

## 별도 비교 동선 제거 (최신)

사용자 요청에 따라 웹·모바일의 견적 비교 버튼과 비교 모달 진입을 제거했다. 결과의 3종·기간별 금액 표와 웹 오른쪽 보조 표시만 유지한다. 최종 액션은 견적 이미지 복사와 상세 링크 공유다. 내부 공급사 계산·검증 경로는 유지하며 별도 비교 화면을 실행하지 않는다.
