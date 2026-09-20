# FreePass Estimate — Manual Release

기준일: 2026-09-20 KST

FreePass Estimate는 견적 기능의 canonical upstream이다. GitHub Actions는 릴리스 판정이나 배포의 필수 경로로 사용하지 않는다.

## 범위

- 신차 앱 배포 루트: `apps/new`
- canonical repo: `freepass-creator/freepass-estimate`
- Sales Self Quote UI authority: FreePass Estimate
- Sales Self Quote calculation/catalog authority: Welrix 443-trim provider catalog
- downstream: FreePass Sales / Promotion / Welrix / Partner channels

## 로컬 검증

```bash
cd apps/new
npm ci
npm run verify:local
```

`verify:local`은 기존 계약·provider·runtime·snapshot·navigation·accessibility·build 검사를 하나의 진입점으로 실행한다.

## 로컬 미리보기

```bash
npm run preview -- --host 127.0.0.1 --port 4173
```

확인 대상:

- `/mobile.html?force=mobile` 진입
- 제조사 → 모델 → 파워트레인 → 트림 → 색상 → 옵션 흐름
- `b/m/t` 딥링크로 같은 차종/트림에서 시작
- 견적 계산 성공/실패 상태
- 공유 링크 snapshot 재현
- 360/390px 모바일과 넓은 화면에서 레이아웃 파손 없음

## Production 배포 후 smoke test

1. production deployment URL과 배포 revision을 기록한다.
2. `/mobile.html?force=mobile`을 직접 연다.
3. 대표 차종 3개 이상에서 견적을 끝까지 계산한다.
4. Sales profile에서 `sales-welrix-db.js` 443-trim catalog가 로드되는지 확인한다.
5. Promotion에서 넘어오는 `b/m/t` 딥링크를 확인한다.
6. 공유 링크를 새 세션에서 열어 snapshot 금액을 확인한다.
7. API/provider 오류 시 사용자에게 실패 상태가 노출되고 잘못된 금액을 확정하지 않는지 확인한다.

## Sales Promotion cutover

위 smoke test가 모두 통과한 뒤에만 `freepass-sales/손님/runtime-config.js`의 `selfQuote.runtimeUrl`을 canonical production URL로 바꾼다.

배포가 없거나 revision을 확인할 수 없으면 기존 `welrixtable.vercel.app` runtime을 유지한다.

## Rollback

- 기능 정본은 이 저장소에 남긴다.
- production 회귀가 발생하면 runtime URL만 직전 정상 배포로 되돌린다.
- 실패한 revision을 production proof로 기록하지 않는다.
