# FreePass Sales Self Quote — Existing Implementation Audit

기준일: 2026-09-20 KST

이 문서는 새 견적기를 설계한 기록이 아니다. 이미 존재하던 FreePass Estimate / Welrix / FreePass Sales Promotion 구현을 대조해 Sales Self Quote의 실제 정본을 복원한 감사 기록이다.

## 결론

FreePass Sales Self Quote는 다음 조합으로 고정한다.

- 범위: **신차 장기렌터카만**
- UI/UX authority: **FreePass Estimate**
- 차량/provider catalog: **Welrix 검증 443-trim catalog**
- calculation authority: **Welrix**
- provider: `external:excel:welrix`
- fallback: 없음 / fail-closed
- Promotion deep link: `b/m/t` 유지
- GitHub Actions: 릴리스/운영 게이트에서 제외

FreePass Standard engine은 저장소 capability로 보존하지만 Sales Self Quote의 활성 산출 엔진이 아니다.

## 확인된 기존 구현

### 계산 로직

- `freepass-estimate/apps/new/api/estimate.js`와 `welrixtable/api/estimate.js`는 동일 blob SHA였다.
- 기존 주석에도 같은 조건이면 Welrix와 금액이 정확히 같아야 하며 로컬 fallback을 금지한다는 결정이 남아 있었다.
- `store.js`, `welrix-rates.js`, `compute-fees.js`, 모바일 계약조건 화면은 FreePass Estimate와 Welrix가 동일 SHA다.
- 기존 Welrix 신차 요청 생성기는 `차량가: 0`으로 두고 `trim_id`/model key로 Welrix 서버가 차량가를 찾는다.

### UI

- 현재 화면 정본은 `apps/new/src/**`와 FreePass token/theme이다.
- Welrix UI는 최초 이관 lineage/reference이며 현재 UI authority가 아니다.
- 기존 `check-ui-parity.mjs`의 Welrix byte-parity 전제는 현재 정책과 충돌해 FreePass UI authority 검사로 교체했다.

### Promotion ↔ Self Quote 링크

- Promotion 모델 딥링크 map: **25/25**가 Welrix 원본 manufacturer/model ID와 일치.
- Promotion 고유 트림: **443개**.
- Welrix 원본 `public/welrix-db.js` 고유 trim_id: **443개**.
- 두 집합은 **443/443 완전 일치**.

## 발견한 드리프트

FreePass Estimate의 `public/welrix-db.js`는 이름과 달리 현재 FreePass 535개 신차 마스터에서 재생성되고 있었다.

- FreePass catalog 총 항목: 535
- 당시 생성 provider api_model 고유값: 232
- Promotion/Welrix 기존 443 중 직접 일치: 232
- 기존 Promotion 링크 중 canonical generated provider map 미매핑: 211

이는 Welrix 계산엔진 결함이 아니라 catalog identity/mapping drift다. Sales Self Quote의 검증된 443을 새 535 catalog에 억지로 추론 매핑하는 것은 기존 운영 계약을 훼손한다.

## 반영한 정상화

### Sales 전용 provider catalog

- Welrix 원본 blob `2b2731fefe34facd9c16ff8295d4cefd1ac30437`을 `public/sales-welrix-db.js`로 고정.
- 443 trim_id를 `sales-welrix-trim-ids.json` server allowlist로 고정.
- 기본 `freepass` 모바일 프로필은 이 catalog를 로드.
- FreePass 전체 canonical `vehicle-db.js`는 별도 capability로 보존.

### 산출 라우팅

- `freepass.json` 기본 quote provider를 `external/excel/welrix`로 수정.
- Sales 443 provider-native trim_id는 remap 없이 그대로 Welrix API `model`로 전달.
- server allowlist에 없는 direct key는 허용하지 않음.
- 일반 FreePass canonical catalog는 기존 providerCandidates 기반 fail-closed mapping을 계속 사용.

### 요청 parity

Sales direct route는 기존 Welrix와 같은 의미/단위를 유지한다.

- model
- old=false
- manualPrice=0
- credit
- termMonths
- mileage
- optionPrice (옵션 + 외장색)
- stockDiscount
- deliveryFee
- tintFee
- dashcamFee
- deposit_pct
- prepay_pct
- liability
- extraDriver
- maintenance
- feeRate

`test-sales-welrix-direct-routing.mjs`가 비영 테스트 값으로 이 전체 body를 검증한다.

### UI authority

- 기본 모바일 title/theme/meta를 FreePass로 변경.
- `c=welrix`일 때는 company config에 따라 Welrix 브랜딩으로 전환.
- 담당자 PIN gate도 FreePass profile에서는 FreePass wordmark 사용.
- FreePass용 manifest 추가.

## 로컬 검증 계약

- `npm run check:sales-self-quote` — UI authority / provider / 443 catalog fingerprint / allowlist
- `npm run test:sales-welrix-routing` — provider-native ID 직접 라우팅 + Welrix request body parity
- `npm run check:ui-authority` — FreePass UI 정본과 historical Welrix lineage 경계
- 위 검사는 `npm run verify` / `npm run verify:local`에 포함

## Production cutover 전 남은 증거

GitHub connector 환경에서는 실제 `npm ci`, Vite build, Playwright, 외부 Welrix live API 443회 검수, production deployment를 실행하지 않았다. 실행하지 않은 것은 통과로 기록하지 않는다.

Cutover 전 필수:

1. `cd apps/new && npm ci && npm run verify:local`
2. canonical production 배포 revision 확보
3. `/mobile.html?force=mobile` FreePass identity 확인
4. Promotion 대표 링크 + 전체 `b/m/t` contract 확인
5. 실제 견적 계산/공유 snapshot 확인
6. FreePass Sales에서 `npm run verify:promotion-prices`로 배포 Promotion 443개를 Welrix live 결과와 대조
7. 성공한 뒤에만 Sales `runtime-config.js`의 runtimeUrl을 canonical production URL로 변경

조건 미충족 시 현재 Welrix production runtime을 유지한다.
