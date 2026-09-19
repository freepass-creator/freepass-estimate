차량 이미지 폴더
=================

파일명 규칙 (필수): /public/cars/{slug}.jpg
- 자동 매칭은 AiRecommender.vue 의 MODEL_META["image"] 경로로 연결
- 없으면 ph-car-profile 아이콘 fallback

[현재 보유 — 20/24]

기아 (10) — kia.com 공식 SSR 에서 자동 수집
  morning.jpg / ray.jpg / k5.jpg / k8.jpg / k9.jpg
  niro.jpg / seltos.jpg / sportage.jpg / sorento.jpg / carnival.jpg

제네시스 (5) — genesis.com 공식 SSR 에서 자동 수집
  g70.jpg / g80.jpg / g90.jpg / gv70.jpg / gv80.jpg

현대 (5) — KV 사용자 드롭 4종 + wikimedia 3종
  grandeur.jpg / kona.jpg / sonata.jpg / casper.jpg (KV — 사용자 제공)
  avante.jpg / venue.jpg / palisade.jpg (wikimedia)

[추가로 떨궈주실 3종 — Hyundai SPA 라 자동 수집 불가]

  tucson.jpg   ← hyundai.com 투싼 → NX4 페이지 KV
  santafe.jpg  ← hyundai.com 디 올 뉴 싼타페 → MX5 페이지 KV
  porter.jpg   ← hyundai.com 포터II 페이지 KV

수집 방법: 모델 페이지 들어가서 메인 KV 이미지 우클릭 → "이미지 저장"
포맷: AVIF / JPG / PNG 다 OK (브라우저는 다 지원)
권장 사이즈: 가로 1000px 이상

[수집 스크립트]
scripts/fetch-car-images.py — Wikimedia 일괄 (rate-limit 주의)
scripts/fetch-kia.py        — kia.com SSR 일괄 (10종)
scripts/fetch-genesis.py    — genesis.com SSR 일괄 (5종)
