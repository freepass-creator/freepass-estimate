# 견적 결과 UI 점검 — 2026-09-25

상태: **PR #14 / Draft / 운영 배포 안 함 / 전체 CI 미통과**

## 기준과 범위

- 디자인 언어: FreePass Admin `src/app/_design/admin-final.css`, 확인 blob `e60d29b327ee82b51833d8823230481454321833`.
- 견적기의 기존 정보구조·단계 흐름 유지. Admin의 3단 패널을 가져오지 않음.
- 최초 점검 revision: `e19969d63694fac823e53a525fc8d77b32b9d05a`.
- 진행 중 들어온 `e4df71126ec8dae8ee0b5b5ef58e0a0f26e88395`의 결과 카드 라운드 수정은 보존했다. 기존 SHA 쓰기는 409로 거절되어 최신 변경을 확인한 후 재적용했다.

## 이번에 실제 변경한 코드

### 결과 화면

Commit: `e497b080a27d9fe9e09d4be58e1fef2c9325ce8e`

`apps/new/src/components/mobile/StepResult.vue`의 `<style scoped>`만 수정했다. 커밋 diff에서 script 및 template 변경이 없음을 확인했다.

- 긴 조건값의 ellipsis/overflow hidden을 제거하고 줄바꿈으로 전체 내용을 표시.
- 기간 설명과 월 금액이 좁은 폭에서 겹치지 않도록 flex-wrap, min-width, overflow-wrap 적용.
- 월 금액·총액 오른쪽 정렬 및 tabular-nums 유지.
- 카드 패딩 12px, 카드 라운드 6px을 공통 토큰으로 사용.
- 차량가 장식 구분선과 조건 요약 격자선을 제거하고 8px 간격으로 구획.
- 본문/보조 글과 안내문의 색 대비를 정리.

계산식, 금액 조회, Snapshot 우선순위, 조건 문구, 화면 전환은 변경하지 않았다.

### 규격 검사 오류 수정

Commit: `63e1ee8efff5f772619cb0a781cea30c74c8434f`

`apps/new/scripts/check-control-design-reference.mjs`:

- 기존 검사에 잘못 들어간 이중 이스케이프를 수정. 공백을 의미해야 하는 정규식이 문자 그대로의 역슬래시를 찾고 있었다.
- 실제 모바일 select의 12px 패딩과 검사값 14px의 불일치를 수정.
- 6px 라운드/44px 높이의 정상 표본과 과거 규격의 반례를 검사기에 추가.
- 결과 카드 줄바꿈, 공통 토큰, 금액 정렬, 조건값 잘림 방지 검사를 추가.
- 검사 출력에서 소스 검사와 브라우저 적합성 검증을 구분.
- 데스크톱의 기존 검사는 삭제하거나 우회하지 않음. 실제 데스크톱 최종 스타일은 별도 확인 대상.

## 실행한 검증과 한계

### 로컬 소스 검사

Node 22에서 수정 검사 파일의 `node --check` 통과.
검사기의 순수 정규식 부분을 분리 실행하여 정상/과거 토큰 6개 사례 통과.
결과 CSS 검사 통과 및 말줄임표 재도입, 금액 왼쪽 정렬, 16px 패딩 재도입의 3개 반례 거부 확인.

**전체 check-control-design 명령을 모든 실제 앱 파일 대상으로 로컬 실행했다는 의미는 아니다.**

### 브라우저 레이아웃 검사

시스템 Chromium + Python Playwright로 실제 변경 CSS를 넣은 template-shaped 정적 fixture를 렌더링했다. 금액·차량·조건은 UI 검사용 가상값이며, 실제 견적이나 계산 결과가 아니다.

- 폭: 320 / 360 / 390 / 412 / 768px.
- 글자 토큰 배율: 100% / 200% 모의 확대.
- 상태 fixture: 계산 완료 / 공유 견적 / 계산 중 / 오류.
- 5 × 2 × 4 = 40개 변경 후 사례에서 조건 잘림 없음, 페이지 가로 넘침 없음, 기간 설명과 금액 겹침 없음, 금액 우측정렬, 12px 패딩/6px 라운드를 확인.
- 비교용 변경 전 fixture는 조건 잘림 36개, 페이지 가로 넘침 24개 사례를 재현.
- 390px 공유 견적 fixture 스크린샷 육안 확인.

**이는 Vue 앱 전체 E2E, 실제 기기의 OS 글자 확대, safe-area/키보드, 라이브 API 또는 전체 웹 화면 적합성 검증이 아니다.**

### GitHub Actions

공개 전환 후 실패 작업을 재실행했다. Run `36114076465`의 재시도 job `108013003434`에서 runner 및 두 저장소 checkout 성공을 확인했다.

실패 로그:

```
Historical UI structure parity failed:
component structure changed mobile/StepResult.vue
component structure changed mobile/StepVehicle.vue
```

수정 후 revision `63e1ee8efff5f772619cb0a781cea30c74c8434f`에서도 run `36117563973`, job `108015129752`가 실제 실행되었으나 `Historical UI structure reference`에서 실패했다. 후속 규격 검사·엔진 검사·build는 SKIPPED다.

따라서 Actions 실행 가능은 확인했지만 전체 CI PASS 또는 빌드 성공을 주장하지 않는다.

## 다음 작업

1. `check-ui-parity.mjs`의 역사적 참조와 현행 FreePass 템플릿 차이를 정확히 비교한다. 해당 정규식은 첫 중첩 template 닫힘에서 끝날 수 있으므로 비교 범위도 점검한다. 실패 컴포넌트를 무조건 제외하거나 검사 단계를 끄지 않는다.
2. StickyQuote의 22px 발송 체크 버튼 및 키보드로 접근되지 않는 펼침 영역을 UI 범위에서 개선한다. 이번 커밋은 StickyQuote를 수정하지 않았다.
3. 전체 앱 브라우저 테스트와 모바일 하단바/키보드/safe-area, 데스크톱 최종 computed style을 확인한 뒤에만 병합·배포 여부를 판단한다.
