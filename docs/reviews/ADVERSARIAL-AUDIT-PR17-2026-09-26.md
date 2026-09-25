# PR #17 적대적 감사 보고서

- 대상: `freepass-creator/freepass-estimate` · `integration/canonical-20260926` @ `523e34a` (PR #17, base `main`)
- 기준 문서: `AGENTS.md`, `docs/AUDIT_HANDOFF.md`, `docs/BRANCH_POLICY.md`, `docs/QUOTE_CORE_V2_2026-09-25.md`
- 방식: 읽기 전용 감사. 과거 브랜치는 정본 후보로 취급하지 않고, 정본 라인에 대한 "재유입/우회 경로"로만 조사했다.
- 원칙: 기능 삭제로 해결하는 제안은 하지 않는다. 모든 권고는 기존 기능을 정본 경로(Quote Core · FreePass Data · tokens.css)로 **흡수·통합**하는 방향이다.
- 분류: P0 = 두 번째 권위/데이터/엔진 경로 또는 견적 진실 훼손, P1 = UI/UX·provider 동작 재분기 가능, P2 = stale/dead/문서 모호성

## 0. 요약

| 감사 주장 (AUDIT_HANDOFF) | 판정 | 근거 |
|---|---|---|
| 1. 단일 활성 개발 라인 | **부분 반증** | CI push 트리거와 main의 스케줄 데이터 동기화 워크플로가 여전히 `work/ui-baseline`을 대상으로 한다 (G-1) |
| 2. web/mobile 계약 비분기 | **반증** | 부대비용 표, 신용등급, 주행거리, 보증금 범위, 역할 판정, 옵션 규칙이 표면별로 다르다 (P0-3, P0-9, P1-4) |
| 3. 토큰 단일 권위 | **반증** | 데스크톱 `index.html`은 `tokens.css`를 로드하지 않고, 같은 이름의 토큰을 다른 값으로 정의한다 (P1-1) |
| 4. Quote v2가 제2 마스터/저장소를 만들지 않음 | **Quote v2 코어는 성립, 제품 전체는 반증** | 차량 사실 소스 4개, 견적 저장 경로 5개가 공존하고, Quote v2 저장소는 UI에 연결돼 있지 않다 (P0-4, P0-7, P0-8) |
| 5. External이 가격 권위를 대체하지 못함 | **성립, 단 불일치를 숨김** | adapter가 provider 총액을 canonical 값으로 덮어써서 불일치 검출이 무력화된다 (P0-5) |
| 6. provider 실패 시 무음 fallback 없음 | **디스패처는 성립, 설정층은 반증** | 설정이 없거나 로드에 실패하면 Welrix external로 무음 전환된다 (P0-2) |
| 7. RTDB/Firestore 신규 유입 없음 | **성립 (신규 유입 없음)** | 다만 현재 UI의 유일한 발송 경로가 RTDB이고, 경계 검사로 우회를 막을 수 없다 (P0-8, G-3) |
| 8. 레거시 Welrix/prototype은 이력 전용 | **반증** | `src/lib/calc.js`(Welrix 엑셀 포팅)가 운영 화면 8곳에서 직접 호출되고, `/api/estimate`가 배포 상태다 (P0-1, P0-6). prototype은 도달 불가(성립) |
| 9. #14/#15/#16 superseded, #17만 활성 | **성립** | 세 PR 모두 closed. UI 브랜치 내용은 `a7c55d0`으로 squash 흡수되었다 |
| 10. CI 통과 | **성립하나 검사 신뢰도 낮음** | `verify`, `pricing-authority`, `visual-audit` 모두 success. 하지만 핵심 경계 검사는 문자열 grep이라 아래 결함을 잡지 못한다 (G-3) |

재현 결과 (정본 라인에서 node로 실행):

```
1a no config          -> external:excel:welrix
1b demo-rental        -> external:excel:welrix
2  provider-health    -> 200 external:excel:welrix CONFIGURED
3  desktop 수원 탁송   -> 120000 (UI 표시 77000) | 썬팅 레이노 S9 -> 0 | 블박 QXD8000 -> 0
4  아반떼 1.6 Smart 60M: client calc.js(표준 가격표) = 457,000 | server FreePass Standard = 492,000
5  같은 가격·PriceBasis에서 fuel=전기 -> 378,000 / cc=3500 -> 497,000 / brand=G90 -> 522,000 (기준 492,000)
```

---

## G. 거버넌스·브랜치 (정본 라인 주변)

### G-1 (P1). CI와 데이터 봇이 superseded 브랜치 `work/ui-baseline`을 여전히 정본처럼 다룬다

**근거**
- 정본 라인의 모든 push 트리거가 `work/ui-baseline`을 가리킨다: `.github/workflows/newcar-ci.yml:6`, `newcar-ui-screenshots.yml:5`, `newcar-standard-coverage.yml:4`, `audit-standard-coverage.yml:4`, `audit-gap-source-fields.yml:4`, `ai-core-qa-p0-shadow.yml:10`, `probe-welrix-manual-price.yml:4`.
  - 병합 후 `main` push에서는 CI가 돌지 않는다. PR 트리거만 있다.
- `main`에는 아직 `sync-freepass-newcar-source.yml`이 있다(`cron: '17 */6 * * *'`, `ref: work/ui-baseline`).
  - 이 봇이 superseded 브랜치에 계속 커밋하고 있다. 최근 커밋: `b64fcab` 2026-09-25 21:36Z, `573891a`, `d175630`.
  - 동기화 내용은 ERP4 `lib/domain/estimate/calc.js`를 `api/_standard/calc.js`로 복사하고, `welrixtable`의 `welrix-db.js`를 참조하는 것이다.
- 정본 라인은 이 워크플로 9개를 의도적으로 제거했다(`9892de3…98243c4`, "remove Estimate-owned vehicle master workflow"). 그러나 PR #17이 병합되기 전까지는 main 스케줄이 살아 있다.
- `docs/AI_CORE_*`에도 `work/ui-baseline`이 source branch로 남아 있다.

**영향**
- 병합 전까지 "차량 마스터/Standard 엔진 소스가 ERP4에서 Estimate의 과거 브랜치로 흘러드는" 두 번째 공급선이 운영 중이다.
- 병합 후에는 main 대상 CI 공백이 생긴다.

**통합 방향**
- push 트리거를 `main`(과 활성 `integration/*`)으로 재지정한다.
- 데이터 공급은 FreePass Data 릴리스 → Estimate 소비 계약(pull, read-only)으로 일원화한다.
- 병합 직후 main에서 해당 스케줄이 사라졌는지 확인하는 체크를 추가한다.

### G-2 (P2). 흡수 완료 브랜치 정리 표시

- `work/ui-admin-alignment-20260925`와 `automation/estimate-uiux-admin-sync-20260925-2108`은 `a7c55d0`에 squash 흡수되었다. 정본 쪽의 후속 차이는 의도된 수정(7개 파일)이다.
- `work/ui-baseline`에만 있는 커밋은 데이터 타임스탬프 갱신과 AI Core QA 섀도 커밋(`b9a2aea`, `ai-core-qa-p0-shadow.yml`)이다.
- `BRANCH_POLICY.md`에 superseded 목록과 "마지막 흡수 커밋"을 명시하면 부활 위험이 줄어든다.

### G-3 (P1). 경계 CI 검사가 문자열 grep이라 우회된다

| 검사 | 실제 동작 | 우회 |
|---|---|---|
| `check-quote-storage-boundary.mjs` | `src/lib/quote`와 `api`에서 4개 토큰(`firebase/database`, `getDatabase(`, `databaseURL`, `welrix_quotes/`)만 금지 | `src/lib/quote/x.js`에서 `../../firebase/quotes.js`의 `saveQuote`를 import하거나 `firebase/firestore`를 import해도 PASS (실측). 전이 import를 추적하지 않는다 |
| `check-authority-boundary.mjs` | API 파일에 `authoritativeQuoteRequest` 문자열이 있는지, `manualPrice: 0` 리터럴이 있는지 확인 | `api/estimate.js`, `engines/welrix.js`, UI의 `lib/calc.js` import를 검사하지 않는다. 가격 외 필드의 권위화 여부도 검사하지 않는다 |
| `check-quote-runtime-integrity.mjs`, `check-model-year-authority.mjs` | 빌더 **소스**에 특정 줄이 있는지 확인 | 커밋된 **산출물**이 낡아도 PASS (P0-7) |
| `test-provider-routing.mjs:109`, `check-provider-runtime-policy.mjs:183` | provider가 `totalCarPrice: 99999999`를 돌려줘도 성공해야 한다고 assert | 문서의 "다른 총액이면 reject"와 반대 동작을 고정한다 (P0-5) |
| `check-ui-parity.mjs` (CI) | `welrixtable@707a57f`와 템플릿 동일성을 강제 | Welrix를 구조 권위로 고정한다. 공유 컴포넌트를 추출하면 CI가 실패한다 (P1-6) |

**통합 방향:** import 그래프(esbuild metafile 등) 기반의 도달성 검사로 교체한다. 산출물을 로드해서 필드를 검증하고, 행위 테스트(설정 누락 시 throw, provider 총액 불일치 시 reject, 차량 사실 변조 시 정규화)를 추가한다.

---

## P0

### P0-1. 엔진 이중화: 브라우저 Welrix 엑셀 포팅 엔진이 "FreePass 표준"으로 고객 산출물을 만든다

**근거**
- `apps/new/src/lib/calc.js:1-3`: "welrix 견적 계산 엔진 v1.0, 엑셀 견적1 시트 포팅". 정본 Standard(`api/_standard/calc.js` + `standard-service.js`)와 다른 공식이다.
- Quote Core 디스패처(`lib/quote/calculate.js`)를 거치지 않고 직접 import하는 곳:
  - `src/components/StandardPriceTable.vue:7,83`: 웹 ERP 하단 "표준 가격표"(`index.html:808`). PDF, 미리보기, 이미지로 고객에게 나가며, 문서 제목은 `:201` "웰릭스 표준 가격표".
  - `home/QuoteWidget.vue:183`, `AiRecommender.vue:118`, `HeroBest.vue:57`, `Lineup.vue:57`, `HeroLineup.vue:32`, `VehicleIndex.vue:36`, `guide/GuideDetail.vue:49`. `vite.config.js` input의 home, vehicles, guide 페이지로 배포된다.
- 가격 입력은 `public/data/vehicles.json`이다. `vehicle-db.js`나 FreePass Data가 아니다.
- 회사 정책은 표면마다 다르다: `home.js:16`은 `welrix.json`, guide와 vehicles는 `DEFAULT_CFG`, 웹과 모바일은 `freepass.json`.
- PriceBasis, provider, 엔진 evidence가 없고 placeholder 라벨도 없다(AGENTS #17).

**재현:** 아반떼 1.6 가솔린 Smart, 60개월, 보증금 10% 조건에서 표준 가격표는 **457,000원**, 서버 FreePass Standard는 **492,000원**이다.

**운영 영향:** QUOTE_CORE 문서 blocker #1에 따라 운영 FreePass Data ACTIVE 릴리스가 없다. 그래서 디스패처 경로는 `FREEPASS_DATA_*`로 fail-closed되고, 운영에서 숫자를 내보내는 경로는 이 우회 엔진뿐이다.

**통합 방향 (기능 유지)**
1. Quote Core에 `quotePreview`/batch API를 추가한다. 서버 `/api/standard-quote`에 batch 모드를 두는 방식이다.
2. 가격표와 마케팅 위젯은 FreePass Data productId 기반의 공용 request builder로 이 API를 호출한다.
3. 결과에는 계약 필드로 `representative/placeholder` 라벨을 붙인다.
4. 서버가 준비되지 않은 상태는 화면에 "계산 불가"로 드러낸다.
5. `src/lib/calc.js`는 Welrix adapter 회귀 검산기(excel-cases fixture)로 격리하고, `src/**`에서 import하지 못하게 CI로 막는다.

### P0-2. provider 설정 누락 또는 로드 실패 시 Welrix external로 무음 전환

**근거**
- `src/lib/quote/provider-config.js:14-22`: `quote_provider`가 없으면 `LEGACY_WELRIX`를 반환한다.
- `quote.js:53-70`: `?c=<임의 id>`를 검증 없이 fetch하고, 실패하면 `catch {}`로 넘어간다.
- `mobile.js:17-24`: 실패 시 `console.warn`만 남긴다.
- `demo-rental.json`에는 `quote_provider`가 없다.
- `/api/provider-health?company=demo-rental`은 `200 CONFIGURED`를 반환한다.

**재현:** `/index.html?c=nope`(404)나 `?c=demo-rental`로 열면 Welrix 외부 계산이 적용된다.

**통합 방향**
- `공급자설정()`의 기본값을 `PROVIDER_CONFIG_MISSING` throw로 바꾼다.
- 모든 엔트리가 화이트리스트 기반의 `loadCompanyProfile()` 하나를 쓰게 한다.
- 레거시 Welrix 동작은 명시적인 `welrix.json` 프로필에만 둔다.
- health는 설정이 없을 때 `NOT_CONFIGURED`를 반환한다.
- 장기적으로 provider 결정은 서버 측 회사/채널 해석으로 옮긴다(P1-2).

### P0-3. 부대비용 표 4중 분기: 계산 요청 ≠ 화면 ≠ 견적서/장바구니/RTDB 스냅샷

**근거**
- 요청: `src/lib/quote/build-request.js:7,107-109`는 `welrix-rates.js`를 쓰고, 모르는 도시는 `?? 탁송['서울']`로 무음 폴백한다.
- 데스크톱 UI: `DeliverySection.vue`, `TintSection.vue`, `ExtrasAccordion.vue`는 `data/lookups.js`를 쓴다.
- 견적서와 장바구니: `quote.js:244-250,294-318`은 `FLAT_DELIVERY`, `TINT_PRICES`, `ACCESSORIES`를 쓴다.
- 모바일: `StepExtras.vue`는 welrix-rates를 쓰고, `StickyQuote.vue:39-41`의 compute-fees는 dead 코드다.
- 기본값: `store.js:110-111`의 '루마 일반', '파인뷰 SF500'은 lookups에 키가 없어 0원이 된다.

**재현**
- 수원(표시 77,000원)을 고르면 요청에는 120,000원이 실린다.
- 레이노 S9 썬팅과 QXD8000 블박은 요청에서 0원이다.
- 기본 상태에서 스냅샷은 탁송 99,000원, 썬팅과 블박 0원인데, 요청은 120,000원 / 105,000원 / 180,000원이다.

**통합 방향**
- `lib/quote/fee-catalog.js` 하나(stable ID와 금액)를 두고 UI, 요청, 스냅샷, 문서가 모두 여기서 읽게 한다.
- Welrix 권역과 상품 매핑은 `api/external-quote` adapter 안으로 옮긴다.
- 매핑되지 않은 값은 `QUOTE_FEE_UNMAPPED` 또는 `PROVIDER_UNSUPPORTED`로 fail-closed한다.
- 모든 선택 가능 값이 요청과 스냅샷에서 같은 금액인지 확인하는 교차 테스트를 추가한다.

### P0-4. 차량 마스터 이중화: 서버가 가격만 권위화하고, 월대여료를 좌우하는 나머지 차량 사실은 클라이언트나 Estimate 자체 데이터에서 온다

**근거**
- `api/_master/authoritative-request.js:184-217`은 가격, 옵션, 색상만 master 값으로 교체하고 나머지는 `...car`로 유지한다.
- `api/_standard/standard-service.js`가 클라이언트 값을 쓰는 곳:
  - `:177`: 연료(EV 개소세)
  - `:82-101,180`: `배기량`, `engine_cc`(자동차세)
  - `:103-123,198`: `master_id`(잔가 delta 키)
- FreePass Data `estimate-newcar-master/v1` 계약에는 연료, cc, 구동, 잔가 세그먼트 필드가 없다. 그래서 `engine-facts.json`, `residual-delta.json`, `vehicle-trim-master.json`이 사실상 두 번째 차량 마스터다.

**재현:** 가격과 PriceBasis는 정상으로 두고 fuel이나 cc, 브랜드만 바꾸면 월대여료가 378,000원에서 522,000원까지 변한다. `from-calculation.js`는 PriceBasis만 대조하므로 발행도 통과한다.

**통합 방향**
- FreePass Data 계약에 powertrain facts(fuelType, engineCc, drivetrain, seats)와 `residualSegmentId`를 추가한다.
- `canonicalizeQuoteRequestFromMaster`가 이 필드들도 master 값으로 덮어쓰고, 불일치하면 422를 반환한다.
- `engine-facts.json`과 `residual-delta.json`은 master ID를 키로 하는 "Estimate 정책 테이블"로 재정의한다. 차량 사실이 아니라 가격 정책으로 보는 것이다.
- Quote v2 snapshot에 `vehicleFactsSnapshot`을 봉인한다.

### P0-5. External adapter가 provider 총차량가 불일치를 덮어써서 숨긴다

**근거**
- `api/external-quote.js:248-259`: `totalCarPrice: canonicalTotal`로 provider 값을 무조건 교체한다. 검증하는 것은 `j.price === manualPrice` 하나뿐이다.
- 따라서 `from-calculation.js:222-227`의 `QUOTE_PRICE_BASIS_RESULT_MISMATCH` 검사는 발동할 수 없다.
- CI는 99999999를 성공으로 고정한다(G-3).
- `quote.js:218`의 `residualPct`는 provider 인수가를 canonical 총액으로 나눈 혼합값이다.

**통합 방향**
- provider의 `totalCarPrice`와 `consumerPrice`를 `canonicalTotal`과 비교하고, 다르면 `PROVIDER_PRICE_OVERRIDE_REJECTED`로 가시적으로 실패시킨다.
- 원래 값은 `diagnostics.providerReported`에 보존한다.
- 테스트 기대값을 반대로 바꾼다.

### P0-6. 레거시 Welrix 직통 proxy `/api/estimate`가 배포 상태로 가격 권위를 우회한다

**근거**
- `api/estimate.js:33-57`은 Vercel 함수로 배포된다.
- `authoritativeQuoteRequest`와 PriceBasis가 없고, `Access-Control-Allow-Origin: *`이며, `manualPrice`를 그대로 중계한다(0이면 provider 가격이 기준이 된다).
- 저장소 안의 호출처는 dead 모듈 `engines/welrix.js`뿐이다. 이 모듈은 `manualPrice: 차.차량가 || 0`이다.
- 외부 소비자(ERP4, Sales, 제3자)가 쓸 수 있는 두 번째 엔진 경로다. `vite.config.js:81`에 dev proxy도 남아 있다.

**통합 방향**
- `/api/estimate`를 `/api/external-quote`(adapter=welrix)에 위임하는 호환 shim으로 바꾼다.
- shim은 canonical 가격 재조회와 PriceBasis를 강제하고, CORS를 제한하며, Deprecation 헤더와 호출 로깅을 붙인다. 소비자 이전이 확인된 뒤에 은퇴시킨다.
- `engines/welrix.js`는 external engine에 흡수한다.

### P0-7. 커밋된 런타임 차량 DB가 빌더와 불일치하고, Estimate가 충돌하는 stable ID를 자체 발급한다

**근거**
- `scripts/build-freepass-vehicle-db.mjs:283,307,315`는 `_stable_option_id`, `_stable_color_id`, `year:null`을 생성한다.
- 그러나 `public/vehicle-db.js`와 `welrix-db.js`의 마지막 커밋은 `8d55226`(09-19)이다. stable ID는 **0건**이고 `"year":2026`은 **64건** 남아 있다(실측).
- 그래서 UI(`index.html:1586,1594`, `StepVehicle.vue:237,313`)는 항상 `colorExtId`/`stableId=null`을 보낸다. `authoritative-request.js:131,153`에서 모든 디스패처 견적이 `FREEPASS_DATA_SELECTION_INCOMPLETE`가 되어 runtime cutover가 불가능하다.
- 빌더가 합성하는 ID(`trimKey + '::opt:' + rawId`)도 문제다. trimKey가 `signature` 같은 공통값이라 옵션 ID 3,214개 중 334개가 서로 다른 이름이나 가격과 충돌한다(시뮬레이션). 이는 QUOTE_CORE의 "Do not synthesize IDs" 원칙에 반한다.
- ERP4 동기화 워크플로가 제거되어 이 산출물을 갱신할 공식 경로도 없다(G-1).

**통합 방향**
- ID 발급은 FreePass Data만 한다.
- Estimate에는 FreePass Data 릴리스에서 `productId → {optionId, colorId}` 매핑을 받아 UI 카탈로그에 주입하는 `catalog-adapter`만 둔다.
- 검사는 산출물을 로드해서 필드 존재, `year==null`, 파일 해시를 검증하도록 바꾼다.

### P0-8. Quote 저장소 이중화: Quote v2 저장소는 미연결이고, 실제 발송과 공유는 RTDB와 서명 없는 URL snapshot이다

**근거**
- 웹 발송: `quote.js:44,872-895`에서 `saveQuote`가 RTDB `welrix_quotes`에 쓴다(`src/firebase/quotes.js`, `company:'welrix'` 하드코딩). priceBasis, provider, engine, sourceRevision이 없다. `customer-view.js`는 재검증 없이 렌더한다.
- 모바일 공유: `src/lib/share-link.js:266`은 `?qs=` base64 JSON을 "정본"으로 취급한다. 서명과 quoteId가 없어서 monthly 값을 변조해도 그대로 표시된다.
- 장바구니: `store.js:160-176`의 `welrix_cart_v1`은 기한이 없다. provider나 config가 바뀐 뒤의 오래된 monthly가 `quote.js:880-892`에서 발송된다.
- 오늘 이력: `TodayHistory.vue:123`은 `state.vehicle`을 과거 값으로 교체하지만 `vehicleState.trim`은 현재 값이라 혼합 상태가 된다.
- `issueQuotesFromCalculation`과 `FreePassDataQuoteRepository`는 런타임 호출처가 0개다. 문서가 fail-closed라고 설명하는 발행 검사가 운영 경로에 없다.
- `home/LeadForm.vue`는 RTDB `/leads`에 직접 쓴다. 이번 PR로 새로 생긴 것은 아니다.

**통합 방향**
- 발송 버튼을 `issueQuotesFromCalculation → persistIssuedQuotes(FreePassDataQuoteRepository)`로 연결하고, 공유는 Share Envelope(quoteId 목록)로 한다.
- RTDB와 `?qs=`는 기존 링크를 읽기 전용으로 여는 `LegacyShareReader`로 축소하고, 새 쓰기는 막는다. 과도기에는 서버가 서명한 snapshot만 정본으로 인정한다.
- 장바구니와 이력에는 selection과 provider key, sourceRevision만 저장하고, 복원하거나 발송하기 전에 다시 계산한다.

### P0-9. 표면별 도메인값 분기로 표시·인쇄값과 계산값이 달라진다

**근거**
- 할인
  - 요청은 `build-request.js:37`에서 `담당자인가()`, 즉 localStorage `welrix_role`로 판정한다. 이 값을 설정하는 곳은 `mobile.js`뿐이다.
  - 데스크톱은 `index.html:787`에서 `sessionStorage.welrix_mode`만 설정한다.
  - 그래서 데스크톱에서 입력한 추가할인은 계산에서 빠지는데, `build-quote-html.js:119`는 공식 견적서에 "−N만원"으로 인쇄한다.
- 신용등급
  - 데스크톱 `ConditionsForm.vue:25`는 '신용'이다.
  - 모바일 `StepConditions.vue:12-16`은 '고신용'이다.
  - 서버 `standard-service.js:137-141`의 `creditKey`는 모르는 값을 '중신용'으로 무음 치환한다.
- 주행거리: 데스크톱은 [2,3]만km, 모바일은 [1,2,3,4]만km다.
- 보증금·선납 범위: `ConditionsForm`은 0–30%, `TermsGrid`/`StickyQuote`는 0–100%, `QuoteWidget`은 프리셋만 있다.
- 할인 자체도 서버가 역할을 검증하지 않고 받는다(`authoritative-request.js:161`). PIN 기본값은 `vite.config.js:11`의 '1234'다.

**통합 방향**
- `lib/quote/condition-domain.js`에 `CREDIT_GRADES`, `KM_OPTIONS`, 범위, `validateConditions()`를 둔다.
- `role.js`를 모든 표면이 공유하는 판정 API로 만든다.
- 서버 `creditKey`는 모르는 값에 대해 fail-closed한다.
- 할인은 서버가 검증한 staff claim과 상한 정책으로만 받는다.
- 문서에는 요청과 결과에 실제로 적용된 값만 인쇄한다.

---

## P1

### P1-1. 디자인 토큰 이중화: 데스크톱이 `tokens.css`를 로드하지 않는다

**근거**
- `index.html:51`은 `admin-desktop-alignment.css`만 링크한다.
- `index.html:55-135`에 자체 "Welrix Design Tokens" `:root`가 있다. 같은 이름의 토큰 값이 다르다:
  - `--font-size-base` 12.5px (tokens.css `--fs-base` 14px)
  - `--font-size-xs` 10px (tokens.css 11px)
- `--accent`, `--welrix-red`, `--sh-*`, `--t-*`는 데스크톱에만 있다.
- 데스크톱은 `--h-*`, `--r-panel`, `--focus-ring`을 쓰지 않는다.
- `admin-desktop-alignment.css`는 44px, 6px, 14px 같은 리터럴을 쓴다.
- 검사도 이를 잡지 못한다. `check-accessibility-baseline`은 tokens.css만 읽고, `check-control-design-reference`는 admin-alignment.css의 `:root`만 금지한다.

**통합 방향**
- 모든 엔트리 HTML이 `tokens.css`를 먼저 링크한다.
- 데스크톱 밀도는 `tokens.css`의 `[data-surface="desktop"]` 역할 override로 옮긴다.
- `index.html`의 `:root`는 값 없이 `var()`만 쓰는 레거시 별칭으로 축소한다.
- 검사에 "tokens.css 밖의 `:root`는 safe-area 허용 목록만"을 추가한다.

### P1-2. Welrix 레드와 네이비가 런타임 테마와 산출물에 남아 있다 (AGENTS #12)

**근거**
- `home.html:33-38`의 `--brand:#e1141e`, `guide.html`, `vehicles.html`, Welrix title과 favicon.
- `build-quote-html.js:119`의 인라인 `#e1141e`.
- `StandardPriceTable.vue:164-170`의 `QUOTE_DOC_VARS`(`#0D4E8B`, 사실과 다른 "index.html과 동일" 주석).
- `?c=welrix` 사용 시 네이비 테마.
- `lib/brand-theme.js`와 `quote.js applyCompanyTheme`(dead 코드)가 서로 다른 ramp를 하드코딩한다. 그래서 `?c=demo-rental`에서는 녹색 `--brand`에 네이비 ramp가 섞인다.

**통합 방향**
- 마케팅 페이지와 문서 빌더도 `tokens.css`에서 생성한 `doc-tokens`를 소비한다.
- ramp는 `color-mix()`로 `--brand`에서 파생한다.
- company-config 밖의 브랜드 hex 리터럴을 금지하는 검사를 추가한다.

### P1-3. provider 선택이 URL과 브라우저에 있다

**근거**
- `?c=<id>`로 데스크톱 provider와 브랜드를 전환할 수 있다.
- 서버 `external-quote.js:271-291`과 `standard-quote.js`는 브라우저가 보낸 `kind/adapterId`를 그대로 받는다.
- 채널별로 고정값이 다르다: 모바일은 freepass, home은 welrix.

**통합 방향:** 서버 측 company/channel 해석(host나 서명 토큰)으로 provider를 결정한다. 브라우저는 식별자를 보내지 않는다.

### P1-4. 선택 규칙과 오케스트레이터 이중화 (web vs mobile)

**근거**
- 옵션 규칙 3벌: `index.html:1201-1252` 인라인(`trim_prices` 지원), `StepVehicle.vue:140-190`(`trim_prices` 미지원), QuoteWidget(규칙 없음).
- 외장색 해석 분기: 104개 트림에서 데스크톱은 모델 색상을 보여 주고 모바일은 색상이 없다. `_paintUnavailable` 처리는 모바일에만 있다.
- vehicles.json 퍼지매칭 3벌.
- 데스크톱 인라인 state와 `syncToVueStore` 때문에 writer가 둘이다.
- 웹 `quote.js:225-287`은 `견적계산`을 직접 두 번 호출하고 `priceBasis`를 버린다. 모바일은 `견적상태`를 쓴다.

**통합 방향**
- `lib/newcar/selection-rules.js`와 `selection-actions.js`를 추출한다.
- 웹도 `다시계산`/`견적상태`를 쓰고, 기준 기간표는 한 요청의 scenario로 계산한다.
- 표시하고 공유하는 차량가는 `견적상태.priceBasis.totalVehiclePrice`만 쓴다.

### P1-5. 결과 표시와 문서 생성 중복

**근거**
- 결과→화면 매핑이 5곳에 있다: `quote.js:208`, `SendSheet.vue:28-53`, `StickyQuote`, `StepResult.vue:40-56`, `customer-view.js`.
- 모바일 문서는 부대비용 snapshot을 포함하지 않는다.
- `public/quote-doc.css`는 `index.html` 인라인 CSS의 사본이고, 이미 드리프트가 있다.

**통합 방향:** `lib/quote/view-model.js`와 공유 `buildQuoteSnapshot()`을 두고, `index.html`은 `/quote-doc.css`를 링크한다.

### P1-6. CI가 Welrix 저장소를 UI 구조 권위로 고정한다

**근거:** `newcar-ci.yml:65-75`는 `freepass-creator/welrixtable@707a57f`를 가져온 뒤 `check-ui-parity.mjs`로 템플릿 동일성을 강제한다. 이는 AGENTS의 "Welrix는 다시 정본이 될 수 없다"와 충돌한다. P1-4와 P1-5의 통합을 CI가 막게 된다.

**통합 방향:** FreePass 소유 구조 스냅샷(`contracts/ui-structure/*.json`)으로 교체한다.

### P1-7. 엔진 manifest digest 누락

**근거:** `api/_standard/pricing-engine-manifest.json`의 `source_files`/`policy_files`에 다음 파일이 없다. 이 파일들이 바뀌어도 같은 version, `verified:true`가 유지된다.
- `api/_standard/data/cost-config.js`
- `turnover-cost.js`
- `src/lib/quote/terms.js`
- `api/_master/authoritative-request.js`

**통합 방향:** `calc.js`의 import 그래프로 digest 대상을 자동 수집한다.

### P1-8. Welrix adapter 매핑이 레거시 산출물과 클라이언트 fallback에 의존한다

**근거**
- `api/external-quote.js:39-87`은 `product-index.json`(비권위)과 UI option `o.id`로 매핑한다. `p.baseAxes || 요청.기본축`은 클라이언트 값으로 fallback한다.
- `calculate.js:57`은 external 결과에 `requireVerified`를 적용하지 않는다.

**통합 방향**
- FreePass Data productId와 optionId를 키로 하는 adapter 소유 매핑 테이블을 둔다. 없으면 `PROVIDER_UNSUPPORTED`를 반환한다.
- 발행 전 표시에도 엔진 검증 상태를 노출한다.

---

## P2

1. **같은 DB 파일 두 벌:** `public/vehicle-db.js`와 `public/welrix-db.js`는 byte-identical인 3.8MB 파일이다. 모바일만 welrix-db를 로드하고 동일성 검사는 없다. → alias를 하나로 두거나 해시 assert를 추가한다.
2. **`vehicles.json` 두 벌:** `src/data/vehicles.json`과 `public/data/vehicles.json`은 동일하고, `vehicle-db`와는 가격 일치가 52/476행뿐이다(예: 그랜저 2.5 Premium 38.57M vs 42.45M). 이 파일의 지위가 문서에 정의되어 있지 않다.
3. **마스터 검증기 4벌:** `assertMasterResponse`, `normalizeEstimateMasterResponse`, `sourceRevisionFromFreePassData`, `assertReleaseMeta`의 기준이 서로 달라 "계산은 통과, 발행은 실패" 비대칭이 생긴다. → `master-contract.js` 하나로 통합한다.
4. **`check-sync.mjs`:** `welrix.json`과 `calc.js`를 "런타임 SSOT"로 관리한다. 실제로 로드되는 `freepass.json`은 검사하지 않고, 주석은 현재 코드와 다르다.
5. **dead 코드:**
   - `engines/welrix.js`
   - `public/data/welrix-residuals.json`
   - `build-multi-quote-html.js`
   - `quote.js applyCompanyTheme`
   - `quote.js` `VEHICLES` 로드
   - `_lastSentQuoteId`: 설정하는 곳이 없어 계약과 견적의 연결이 끊겨 있다
6. **모바일 Standard 결과 캐시:** TTL이 없고 sourceRevision이 키에 없다(`lib/quote/index.js:56-57`).
7. **`embed-bridge.js:57`:** parentOrigin이 null이면 모든 origin을 허용한다. 영향은 고객/담당자 prefill에 한정되고, 가격이나 차량은 바꿀 수 없다.
8. **Welrix 명칭 잔존:** `__welrix_companyConfig`, `welrix_cart_v1`, `welrix_role`, `welrix-rates.js`, 문서 제목 등. → 호환 alias를 두고 FreePass 명칭으로 이전한다.
9. **`prototype/new/*`:** vite input, vercel, CI 어디에서도 참조하지 않아 도달할 수 없다(성립). 자체 `:root`가 있으므로 README에 "런타임 비권위"를 명시한다.
10. **버튼 border 규칙:** 검사 범위 밖에서 위반된다(AGENTS #9). `index.html:3453 .ds-btn`, `.tint-chip`, `QuoteWidget .qw-brand-tab`.

---

## 반증을 시도했으나 성립한 주장

- `src/lib/quote/**`와 `api/**`에 RTDB나 Firestore의 직접 import는 없다. 이번 PR은 firebase, share-link, customer-view 파일을 바꾸지 않았다.
- 디스패처(`calculate.js`, `index.js`)는 오류가 나도 다른 계산기로 fallback하지 않는다. external 결과는 캐시하지 않는다. `계산기고르기`는 window에 노출되지 않는다.
- `/api/standard-quote`와 `/api/external-quote`는 계산 전에 항상 `authoritativeQuoteRequest`를 거친다. master가 없으면 fail-closed이고 product-index로 fallback하지 않는다.
- provider가 PriceBasis나 vehiclePrice를 덮어쓸 수 없다. 단, 불일치를 숨기는 문제가 있다(P0-5).
- 서버 master 토큰은 브라우저에 노출되지 않는다.
- 데스크톱과 모바일은 단일 `src/store.js`를 공유한다. 신차 경로에 렌트/구독 토글이 없다. 모바일 단일 선택은 즉시 전진하고, 뒤로가기 시 선택이 보존된다(같은 항목을 다시 누르면 하위 선택이 초기화되는 점은 예외).
- 모바일은 `tokens.css`를 링크하고, 자체 `:root`는 safe-area만 정의한다. `?c`는 무시한다.
- 기간 목록(`lib/quote/terms.js`)과 색상가 라벨은 공유 모듈 하나를 쓴다.
- PR #14, #15, #16은 closed이고, UI 브랜치 내용은 `a7c55d0`으로 흡수되었다. PR #17 CI 3개 job은 success다.

## 권장 통합 순서

1. **데이터와 거버넌스 정리 (G-1, P0-7):** CI 트리거를 main과 integration으로 옮기고, FreePass Data 소비 계약과 catalog-adapter를 두고, 산출물 검사를 추가한다. 이게 없으면 나머지 cutover가 불가능하다.
2. **provider 결정 fail-closed (P0-2, P1-3):** 설정 누락 시 throw, 프로필 화이트리스트, 서버 측 provider 해석.
3. **요청 도메인 단일화 (P0-3, P0-9, P1-4):** `fee-catalog`, `condition-domain`, `selection-rules`, 공유 role API.
4. **권위 확장 (P0-4, P0-5):** master 차량 사실까지 정규화하고, provider 총액 불일치는 reject.
5. **엔진 경로 단일화 (P0-1, P0-6):** batch preview API로 가격표와 마케팅 위젯을 흡수하고, `/api/estimate`는 shim으로 바꾼다.
6. **저장소 cutover (P0-8):** 발송을 Quote v2 저장소로 옮기고, RTDB와 `?qs=`는 읽기 전용 호환 경로로 둔다.
7. **토큰 단일화 (P1-1, P1-2):** 데스크톱과 마케팅 페이지가 `tokens.css`를 소비하게 하고, 문서 토큰은 생성한다.
8. **CI 행위 검사로 교체 (G-3, P1-6):** import 그래프, 산출물, 행위 테스트, FreePass 소유 UI 구조 스냅샷.

각 단계는 AGENTS의 Approval gate(web/mobile 스크린샷 비교)를 거친 뒤 downstream으로 전파한다.
