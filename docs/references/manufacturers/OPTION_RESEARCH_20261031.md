# 제조사 옵션·배타조건 재조사 — 2026-10-31

## 결론과 사용 범위

우리 FreePass Data 정본을 보존하고 제조사 공식 근거와 직접 대조한다. 카매치 카탈로그를 정본에 수입하지 않는다.
이 패킷은 **개발 반영 전 검토 자료와 읽기 전용 감사 코드**다. 운영 데이터 수정, release 활성화, UI 변경, 병합/배포는 하지 않았다.

- 고정 저장소: freepass-creator/freepass-estimate
- 기준 commit: d483fd46f8b3b0c9ee334cc45a47ba71b9b25f3d
- 검사 파일: apps/new/public/vehicle-db.js
- 파일 SHA256: ed7b0d4a3bf48f9371f06334844271d69b406cfd3e2106623eb45e18bfd3763d
- 파일 자체 메타: freepasserp4/new_car_trim / data_as_of 2026-09-18 / generated_at 2026-09-19T08:30:03.705Z
- **이 파일을 현재 FreePass Data 운영 정본 또는 ACTIVE release로 간주하지 않는다.** 동일 문제가 운영에도 있는지 별도 확인해야 한다.

## 검사 결과

| 검사 | 실제 범위/결과 |
|---|---|
| 저장소 스냅샷 구조 | 64모델, 106파워트레인 묶음, 535트림, 옵션 엔트리 4,474개 |
| 조건 참조 | 배타그룹 426개, 선행 참조 95개, 제외 참조 413개 |
| 공식 연구 조건 | 7개 모델의 35항목. 가격·선행·배타·기본 포함·색상/차체·세제 조건. 전 제조사/전 차종 검증은 아님 |
| 공식 조건 대비 관측 | 52행. 가격 차이 후보5, 선행/배타 관계 누락 후보4, 기본품목 별도선택 검토1, 번들 자식 상호차단 검토4 |
| 구조 진단 | 9개 진단: 비선택 선행항목7 + 동일 순환의 두 시작점2. 9개 독립 오류 또는 9대 오류라는 뜻이 아님 |
| 검사기 검증 | 신규8 + 기존 feature-options5 = 13 tests PASS |
| 운영 실측 | ACTIVE 데이터/운영 화면/API 미확보, 검증 완료 아님 |

이름만 맞는 후보 대조에서 발견한 가격 차이는 연식/세대/파워트레인/인승/용도/세제 기준/시행일이 모두 맞는지 확인해야 한다.
원 단위가 맞더라도 식별자와 조건이 다르면 반영 승인으로 세지 않는다.
카매치 45,072건 산식 parity와 제조사 데이터 정확성은 별개의 검사다.

## 확인한 핵심 사례

### 1. 옵션 금액은 트림별로 비교

공식 현재 자료와 저장소 스냅샷의 차이 후보:

| 범위 | 항목 | 저장소 스냅샷 | 공식 자료 |
|---|---|---:|---:|
| 스포티지 가솔린 프레스티지 | 스타일 | 890,000 | 690,000 |
| 카니발 가솔린 9인승 프레스티지 | 스타일 | 1,000,000 | 700,000 |
| 같은 카니발 | 드라이브 와이즈 | 1,200,000 | 750,000 |
| 같은 카니발 | 모니터링 팩 | 900,000 | 1,200,000 |
| 카니발 가솔린 9인승 노블레스 | 후석 엔터테인먼트 | 2,680,000 | 2,730,000 |

공식 PDF 지면/행은 동봉 JSON sourceId/page에 기록했다. 현 운영값 오류로 단정하지 않는다.
옵션 원가는 가격표의 세제 표기까지 보존한다. 차량가와 옵션가의 세전/감면 후 기준을 임의로 섞지 않는다.

### 2. 배타를 선행 필수로 잘못 해석한 순환

저장소 아이오닉 5 N의 빌트인 캠과 디지털 미러는 서로 requires로 연결돼 있다.
빈 선택 상태에서는 두 항목 모두 먼저 선택할 수 없게 된다.
2025 공식 문서는 둘의 동시선택 금지를 설명한다. 서로 필수라는 의미가 아니다.
2026 가격표는 별도 문서이고 트림 구성이 다르므로, 현재 운영 연식 확인 없이 2025 조건을 적용하지 않는다.

### 3. 번들 중복 방지는 자식들 전체 택일과 다름

G80의 2.5/3.5 × 2WD/AWD 네 스냅샷 트림에서
파퓰러, 드라이빙 어시스턴스 I, II, 빌트인 캠을 하나의 exclusive group에 넣었다.
기존 feature-options.js를 그대로 실행하면 I 선택 후 II 선택 시 I가 제거된다.
공식 BTO의 번들 구성 설명은 자식들끼리 모두 택일이라는 증거가 아니다.

수정 후보는 번들→포함 항목의 중복 방지와 개별 항목 상호배타를 분리하는 것이다.
**공식 BTO에서 개별 I+II 실제 동시선택과 연식/구성 조건을 최종 확인하기 전에는 후보로 유지한다.**
공식 BTO 구성 설명만으로 개별 조합 전체가 허용된다고 확정하지 않았다.

### 4. 선행 항목이 기본 사양이면 추가 구매로 요구하지 않음

쏘나타/코나 7개 진단에서 선행 옵션 ID는 존재하지만 해당 트림 선택목록에는 없다.
기본 포함 사양인지, 선행 참조가 다른 트림에서 유출됐는지 공식 트림 사양과 비교해야 한다.
일괄 requires 삭제나 숨은 유료 항목 추가로 해결하지 않는다.

별도 최소 재현 시험에서 현재 vehicle-db-projection.js의 mergeOption이 동일 옵션 ID의
requires를 트림 간 합집합으로 합쳐, 하위 트림 선행 조건을 상위 트림에도 붙이는 경로를 확인했다.
동일 위험이 excludes/exclusive group에도 있는지 해당 소유자가 함께 확인해야 한다.
이 PR은 기존 projection 또는 UI 동작을 바꾸지 않는다.

## 개발에 반영할 의미 구분

| 제조사 조건 | 구현/검토 기준 |
|---|---|
| 선택품목 중 택1 | 미선택 허용 여부를 따로 보존. 6/7인승은 5인승 기본 상태도 허용한다. 강제 정확히 하나로 바꾸지 않는다 |
| A 선택 시 B 필요 | 해당 트림의 REQUIRES. B가 기본 포함이면 기본 충족 근거를 사용한다 |
| A와 B 동시 불가 | 상호 충돌로 모델링. requires로 넣지 않는다 |
| 번들에 A/B 포함 | 포함 항목 중복 청구 방지. A/B 상호배타는 별도 근거 필요 |
| A 또는 B 중 하나가 필요 | OR 조건. REQUIRES 배열의 AND와 바꾸어 쓰지 않는다. 지원 계약이 부족하면 HOLD |
| 특정 트림·연식·구동만 허용 | 적용 범위를 stable ID와 시행일로 고정. 모델 전역으로 확장하지 않는다 |
| 옵션 때문에 색상/세제/기본품목 변경 | 옵션-색상/차체 관계와 가격 기준을 같이 재검증. 단순 합산으로 처리하지 않는다 |

## 우리 기존 경로로 반영하는 순서

1. Data #833에서 현재 운영 차량/옵션 정본 및 Estimate가 소비하는 payload/release의 ID·revision·갱신일을 확인한다.
2. reference의 모델/연식/세대/엔진/구동/인승/용도/트림/가격 기준을 우리 canonical stable ID와 매칭한다. 명칭 정규화는 후보 탐색용이며 identity 증거가 아니다.
3. 기존 원천 capture → immutable RAW → parser → option graph proposal/review 경로로 공식 근거와 조건을 옮긴다.
   Data PR #834의 기아 가격 파서 수정과 겹치는 source parser 파일은 이 패킷에서 수정하지 않았다.
4. 기존 정정 경로에서 원래 값·제안 값·공식 sourceDocument/페이지/시행일·검토 결과를 남긴다. 이 JSON을 런타임 master 또는 자동 보정표로 읽지 않는다.
5. 최소 조합 검증: 무선택 / 각각 단독 / 금지쌍 / 선행 전후 / 선행 해제 / 번들↔개별 / 기본 포함 / 트림·색상·구동 전환 / 공유 견적 복원.
6. 기존 server canonicalizeQuoteRequestFromMaster에서 조작된 금지 조합도 거부되는지 확인한다. UI만 비활성화해서 완료로 세지 않는다.
7. 실제 적용 뒤 새 조회와 운영 UI/API에서 옵션 ID·금액·조건·합계가 일치해야 완료다. 이전 견적 스냅샷은 보존한다.

## 재현

apps/new에서:

    node scripts/audit-official-option-reference.mjs
    node --test scripts/audit-official-option-reference.test.mjs scripts/feature-options.test.mjs

외부 스냅샷 파일을 감사할 때는 --db /absolute/path/vehicle-db.js 를 지정한다.
감사기는 입력 파일을 읽고 JSON을 stdout으로만 출력한다. productionWrites=0이며 DB/시트/코드/입력 파일을 수정하지 않는다.
출력 verdict는 항상 REVIEW_REQUIRED_NOT_OPERATIONAL_VERIFICATION이다. 테스트 PASS는 탐지기가 작동한다는 의미이며 차량 데이터가 모두 맞다는 뜻이 아니다.

## 근거 목록

- [기아 K5 공식 가격표](https://www.kia.com/content/dam/kwp/kr/ko/vehicles/pdf/price/price_k5.pdf)
- [기아 쏘렌토 공식 가격표](https://www.kia.com/content/dam/kwp/kr/ko/vehicles/pdf/price/price_sorento.pdf)
- [기아 스포티지 공식 가격표](https://www.kia.com/content/dam/kwp/kr/ko/vehicles/pdf/price/price_sportage.pdf)
- [기아 카니발 공식 가격표](https://www.kia.com/content/dam/kwp/kr/ko/vehicles/pdf/price/price_carnival.pdf)
- [현대 아반떼 공식 가격](https://www.hyundai.com/kr/ko/e/vehicles/the-all-new-avante/price)
- [제네시스 G80 공식 BTO 패키지](https://www.genesis.com/kr/ko/models/luxury-sedan-genesis/g80/bto/packages?code=BDBBCGG&packages=PP1)
- [2025 아이오닉 5 N 공식 가격표](https://www.hyundai.com/contents/repn-car/catalog/ioniq5-n-price.pdf)
- [2026 아이오닉 5 N 공식 가격표 — 연식 대조 필요](https://www.hyundai.com/contents/repn-car/catalog/ioniq5n-2026-price.pdf)

현재 확인하지 않은 나머지 모델, 신규 공식 문서의 완전성, 실제 운영 release 및 G80 공식 동시선택 실측은 남아 있다.
