// 차종별 콘텐츠: hook / review 블록 / 페르소나 / 스펙 / FAQ
// — 사람들이 궁금해할 만한 정보를 수기로 작성. 객관 데이터(연비/세금)는 공식 발표 기준.
// 비어있는 차종은 generic fallback.

const SPECS_TEMPLATE = (fuel, tax, insurance) => [
  { icon: 'ph-drop-half', label: '복합연비', value: fuel, note: '공인 연비 (대표 트림)' },
  { icon: 'ph-coin', label: '연간 자동차세', value: tax, note: '자가용 기준' },
  { icon: 'ph-shield-check', label: '연 보험료 예상', value: insurance, note: '30대 1인 종합보험' },
  { icon: 'ph-gas-pump', label: '월 유류비', value: '약 25-30만원', note: '월 1,500km 기준' },
];

export const STORIES = {
  // === 현대 ===
  casper: {
    hook: '도심에서 가장 잘 어울리는 경형 SUV. 1인·2인 가구의 첫 차로 가장 많이 선택되는 모델.',
    review: [
      { heading: '작지만 알찬 실내', body: '경차로 분류되지만 실내 공간 활용도는 동급 최고 수준. 풀폴딩 시트로 1인용 캠핑·차박까지 거뜬합니다. 트렁크 용량은 280L 정도로 평일 장보기·주말 캠핑 둘 다 무리 없음.' },
      { heading: '1.0 터보 + 4단 자동변속기', body: '동급 대비 가속력은 평범하지만 연비가 매우 우수합니다. 도심에서는 13km/L 후반, 고속에서는 16km/L도 가능. 출퇴근 비용 최소화가 목표라면 이 차가 답.' },
      { heading: '경차 혜택', body: '경차로 등록되므로 자동차세·공영주차장 50% 할인, 고속도로 통행료 50% 할인 등 혜택이 큽니다. 신차 장기렌터카로 가도 이 혜택은 그대로 적용됩니다.' },
    ],
    personas: [
      { icon: 'ph-user', title: '첫 차로 입문하는 분', desc: '운전이 익숙하지 않아도 작은 차체로 주차·골목길 부담이 적습니다.' },
      { icon: 'ph-heart', title: '2인 가구', desc: '평일 출퇴근 + 주말 데이트까지. 큰 차가 부담스러운 신혼·연인.' },
      { icon: 'ph-clock', title: '도심 출퇴근족', desc: '꽉 막히는 출근길, 좁은 주차장. 경형 SUV만의 자유.' },
    ],
    specs: SPECS_TEMPLATE('13.4km/L', '약 10만원', '약 60-80만원'),
  },
  avante: {
    hook: '국민 세단의 표준. 모든 운전자가 한 번쯤은 거쳐가는 가성비 끝판왕.',
    review: [
      { heading: '여전한 국민 세단', body: 'CN7 세대 + 페이스리프트로 완성도가 정점. 매끄러운 라인 + 최신 안전 패키지(SCC, LFA, FCA 등) 기본 적용으로 동급 외산 대비 우위.' },
      { heading: '하이브리드 옵션의 매력', body: '아반떼 Hybrid는 공인 연비 21.1km/L. 출퇴근거리가 긴 분이라면 연료비 절감만으로 월 5-10만원 차이가 납니다. 장기렌터카로 가는 경우 더 큰 메리트.' },
      { heading: '안전·편의 기본기', body: 'N라인·인스퍼레이션 등 트림이 다양해 취향대로 선택 가능. 베이스 트림이라도 후방 카메라·크루즈컨트롤 기본.' },
    ],
    personas: [
      { icon: 'ph-baby', title: '20대 사회초년생', desc: '월급 대비 부담 적은 입문 세단. 디자인도 무난해 어디든 어울립니다.' },
      { icon: 'ph-clock', title: '장거리 출퇴근', desc: 'Hybrid 트림은 연비가 압도적. 왕복 50km 이상이라면 이 차가 답.' },
    ],
    specs: SPECS_TEMPLATE('15.0km/L (Hybrid 21.1)', '약 28만원', '약 90-110만원'),
  },
  sonata: {
    hook: '국민 중형 세단. 비즈니스에도 가족 차로도 무난한 정석.',
    review: [
      { heading: '디 엣지 페이스리프트', body: 'DN8 후기형은 그릴 라인을 일자로 바꾼 호불호 디자인이지만, 실내 마감은 동급 최고 수준. H 로고 일루미네이션 + 듀얼 12.3" 디스플레이.' },
      { heading: '하이브리드 추천', body: '쏘나타 디 엣지 Hybrid는 20km/L 가까운 연비를 보여줍니다. 가솔린 2.0 모델 대비 출고가는 +200-300만원이지만 장기렌터카에선 월 차이 +3-5만원 수준.' },
    ],
    personas: [
      { icon: 'ph-briefcase', title: '30-40대 직장인', desc: '비즈니스 미팅·가족 외출 다 가능한 사이즈.' },
      { icon: 'ph-users-four', title: '4인 가족', desc: '뒷좌석이 넉넉해 장거리 가족 여행에 부담 없음.' },
    ],
    specs: SPECS_TEMPLATE('13.0km/L (Hybrid 20.0)', '약 40만원', '약 100-130만원'),
  },
  grandeur: {
    hook: '국산 플래그십 세단의 표준. 비즈니스·가족·임원 의전까지 만능.',
    review: [
      { heading: '7세대 GN7', body: '1986년 1세대 그랜저를 오마주한 디자인. 일자형 LED 라이트 + 호화로운 인테리어. 럭셔리 세단의 가격대를 한 단계 내린 모델.' },
      { heading: '왜 임원들이 그랜저인가', body: '체급 + 가격 + 유지비 + 신뢰성 — 어떤 축에서도 약점이 없는 차. 제네시스 G80 대비 출고가 1,500-2,000만원 저렴하면서 외관·실내 차이는 크지 않습니다.' },
    ],
    personas: [
      { icon: 'ph-briefcase', title: '40-50대 임원', desc: '비즈니스 의전 + 가족 차로 무난한 정중함.' },
      { icon: 'ph-handshake', title: '영업·비즈니스', desc: '미팅 자리에서 어디서든 통하는 차종.' },
    ],
    specs: SPECS_TEMPLATE('10.0km/L (Hybrid 18.0)', '약 65만원', '약 120-160만원'),
  },
  venue: {
    hook: '가성비 1순위 입문 SUV. 도심·교외 모두 무난한 컴팩트 사이즈.',
    review: [
      { heading: 'B세그먼트 SUV', body: '캐스퍼보다 한 체급 크고 코나보다는 작은 사이즈. 1.6 가솔린 + 6단 자동변속기. 트렁크 용량 350L 정도로 가족 일상도 OK.' },
    ],
    personas: [
      { icon: 'ph-user', title: '1-2인 가구', desc: '작지만 SUV의 시야 + 적재 공간을 원하시는 분.' },
    ],
    specs: SPECS_TEMPLATE('13.7km/L', '약 19만원', '약 80-100만원'),
  },
  kona: {
    hook: 'SX2 세대 코나. 도심형 준중형 SUV의 디자인 정점.',
    review: [
      { heading: '풀체인지 SX2', body: '2023년 출시. 전면부의 일자형 라이트가 시그니처. 휠베이스가 길어져 뒷좌석 거주성 대폭 개선.' },
      { heading: '하이브리드 추천', body: '코나 Hybrid 는 19.7km/L. 디젤이 없어진 만큼 Hybrid가 사실상 표준 선택. 장거리 출퇴근족에게 추천.' },
    ],
    personas: [
      { icon: 'ph-mountains', title: '주말 레저족', desc: '평일 출퇴근 + 주말 캠핑·낚시. 적재 공간이 SUV급.' },
      { icon: 'ph-baby', title: '20-30대 입문 SUV', desc: '세단보다 시야가 좋은 첫 SUV로.' },
    ],
    specs: SPECS_TEMPLATE('13.8km/L (Hybrid 19.7)', '약 30만원', '약 95-120만원'),
  },
  tucson: {
    hook: '중형 SUV의 베스트셀러. 가족용으로 무난, 디자인은 강렬.',
    review: [
      { heading: 'NX4 세대', body: '파라매트릭 그릴 + 히든 라이트. 디자인이 호불호 있지만 한 번 적응하면 가장 미래지향적. 4인 가족 기준으로 가장 균형 잡힌 사이즈.' },
    ],
    personas: [
      { icon: 'ph-users-four', title: '4인 가족 표준', desc: '국내에서 가장 많이 팔리는 가족용 SUV.' },
    ],
    specs: SPECS_TEMPLATE('12.5km/L (Hybrid 16.4)', '약 33만원', '약 110-130만원'),
  },
  santafe: {
    hook: '디 올 뉴 싼타페 (MX5). H 로고가 시그니처가 된 박스형 SUV.',
    review: [
      { heading: 'MX5 풀체인지', body: '2023년 출시. 박스형 외관 + 거대한 H 그릴. 외관만큼이나 실내도 완전히 새로 — 12.3" 듀얼 디스플레이 + 2열 USB-C 4개 + 3열 시트.' },
      { heading: '5인 vs 7인', body: '5인승은 트렁크가 1,000L 가까워 캠핑 풀로딩 가능. 7인승은 3열 어른 단거리 가능. 가족 구성원 따라 결정.' },
    ],
    personas: [
      { icon: 'ph-tent', title: '캠핑·차박 마니아', desc: '5인승 풀폴딩 시 트렁크가 침대 사이즈.' },
      { icon: 'ph-users-four', title: '4-5인 가족', desc: '장거리 가족 여행 표준.' },
    ],
    specs: SPECS_TEMPLATE('11.6km/L (Hybrid 14.0)', '약 39만원', '약 115-140만원'),
  },
  palisade: {
    hook: '국내 풀사이즈 SUV의 정점. 7·9인승 가족·임원 의전 표준.',
    review: [
      { heading: 'LX3 세대 페이스리프트', body: '2025년 1월 풀체인지급 페이스리프트. 그릴·라이트 일신 + 어드밴스드 안전 패키지 기본. 12.3" 듀얼 디스플레이 + 통풍·열선 시트 기본.' },
      { heading: '7인승 vs 9인승', body: '7인승은 2열 캡틴체어 + 통로 — 임원 의전·중대형 가족용. 9인승은 2열 벤치 — 식구 많은 가족용. 가격 차이는 적지만 성격이 다름.' },
    ],
    personas: [
      { icon: 'ph-users-three', title: '대가족 (5인+)', desc: '국내에서 가장 안전한 가족용 풀사이즈 SUV.' },
      { icon: 'ph-handshake', title: '임원 의전', desc: '7인승 캡틴 체어 + 통풍·열선. 격조 있는 비즈니스 차.' },
    ],
    specs: SPECS_TEMPLATE('9.4km/L (Hybrid 14.0)', '약 53만원', '약 130-170만원'),
  },
  porter: {
    hook: '국내 소상공인 1순위 트럭. 자영업·배달·공사현장에 진심.',
    review: [
      { heading: '디젤 → LPG 전환', body: '환경 규제로 디젤 단종, 현재는 LPG / 전기. LPG는 연료비 부담이 낮지만 출력이 약함. 짧은 단거리 위주면 LPG, 장거리·중량 적재면 전기 추천.' },
    ],
    personas: [
      { icon: 'ph-storefront', title: '자영업·소상공', desc: '배달·납품·이삿짐 등 운반업의 표준.' },
    ],
    specs: [
      { icon: 'ph-drop-half', label: '복합연비', value: '8.5km/L', note: 'LPG 1톤 기준' },
      { icon: 'ph-coin', label: '연간 자동차세', value: '약 6만원', note: '영업용 등록 시' },
      { icon: 'ph-shield-check', label: '연 보험료', value: '약 50-70만원', note: '영업용 종합' },
      { icon: 'ph-truck', label: '적재 정량', value: '1톤', note: '카고형 기준' },
    ],
  },

  // === 기아 ===
  morning: {
    hook: '경형 세단의 정석. 가장 저렴한 신차 옵션.',
    review: [
      { heading: '진정한 입문 차', body: '20대 첫 차로 가장 많이 선택되는 모델. 1.0 가솔린 + 4단 자동변속기. 도심에서 15km/L 이상 연비.' },
    ],
    personas: [{ icon: 'ph-baby', title: '20대 첫 차', desc: '월 부담을 최소화하면서 신차의 안심을 원하는 분.' }],
    specs: SPECS_TEMPLATE('15.0km/L', '약 10만원', '약 50-70만원'),
  },
  ray: {
    hook: '박스카의 정석. 좁은 공간 + 넓은 실내의 마법.',
    review: [
      { heading: '박스형 실내', body: '경차 사이즈인데 실내 천장이 매우 높아 적재 활용도가 1톤 트럭 못지 않음. B필러 없는 슬라이딩 도어로 좁은 골목·주차장 진출입이 자유.' },
    ],
    personas: [{ icon: 'ph-storefront', title: '소상공·배달', desc: '경차 혜택 + 큰 적재. 1인 자영업의 만능.' }],
    specs: SPECS_TEMPLATE('13.0km/L', '약 10만원', '약 55-75만원'),
  },
  k5: {
    hook: '쏘나타의 라이벌. 좀 더 스포티한 디자인 + 가성비.',
    review: [
      { heading: 'DL3 세대', body: '쏘나타보다 디자인이 더 날렵하고 젊은 느낌. 가격대도 비슷하지만 동급 옵션 대비 K5가 약간 우위.' },
    ],
    personas: [{ icon: 'ph-briefcase', title: '20-30대 직장인', desc: '쏘나타보다 좀 더 개성 있는 선택.' }],
    specs: SPECS_TEMPLATE('13.0km/L', '약 40만원', '약 95-115만원'),
  },
  k8: {
    hook: '준대형 세단의 신흥강자. 그랜저보다 한 단계 모던.',
    review: [
      { heading: 'GL3 세대', body: '그랜저보다 후발주자이지만 디자인 신선도는 우위. 비슷한 체급에 가격은 +100-200만원 정도. 임원 의전이라면 그랜저, 개성 있는 비즈니스라면 K8.' },
    ],
    personas: [{ icon: 'ph-handshake', title: '40-50대 비즈니스', desc: '그랜저와 차별화된 디자인을 원하는 임원.' }],
    specs: SPECS_TEMPLATE('11.0km/L (Hybrid 18.0)', '약 60만원', '약 115-145만원'),
  },
  k9: {
    hook: '기아 플래그십. 제네시스와 사이드 비교되는 럭셔리 세단.',
    review: [
      { heading: 'RJ2 페이스리프트', body: 'G80·G90과 동일 플랫폼이지만 가격은 한 단계 낮음. 3.8 V6 + AWD 표준. 시승해보면 V8 같은 무게감.' },
    ],
    personas: [{ icon: 'ph-armchair', title: '50대+ 임원', desc: '럭셔리는 원하지만 제네시스보다 합리적인 선택.' }],
    specs: SPECS_TEMPLATE('8.8km/L', '약 80만원', '약 150-180만원'),
  },
  seltos: {
    hook: '컴팩트 SUV의 인기 모델. 디자인이 단연 호평.',
    review: [
      { heading: 'SP2 페이스리프트', body: '코나의 직접 경쟁자. 디자인 호불호 더 적고 실용성은 더 높음. 1.6 터보 + 1.5 가솔린 두 가지 선택.' },
    ],
    personas: [{ icon: 'ph-bicycle', title: '20-30대 활동가', desc: '주말 자전거·캠핑·여행. 작지만 다 적재.' }],
    specs: SPECS_TEMPLATE('12.5km/L', '약 28만원', '약 90-115만원'),
  },
  sportage: {
    hook: '투싼의 영원한 라이벌. 디자인이 더 과감한 중형 SUV.',
    review: [
      { heading: 'NQ5 세대', body: '투싼과 같은 플랫폼이지만 디자인이 완전히 다름. 호불호가 더 갈리지만 한 번 적응하면 더 멋있다는 평. 옵션 구성은 투싼 대비 가성비 약간 우위.' },
    ],
    personas: [{ icon: 'ph-users-four', title: '디자인 중시 4인 가족', desc: '평범하지 않은 SUV를 원하는 가족.' }],
    specs: SPECS_TEMPLATE('12.5km/L (Hybrid 16.7)', '약 33만원', '약 105-130만원'),
  },
  sorento: {
    hook: '국내 중대형 SUV 베스트셀러. 7인승의 표준.',
    review: [
      { heading: 'MQ4 페이스리프트', body: '싼타페와 같은 체급이지만 더 모던하고 럭셔리 지향. 7인승 기준 3열 거주성은 동급 최고.' },
      { heading: 'Hybrid가 답', body: '쏘렌토 Hybrid는 압도적 인기. 14km/L 연비 + 가솔린 대비 부드러운 주행감. 신차 대기 줄이 가장 긴 트림.' },
    ],
    personas: [
      { icon: 'ph-users-four', title: '4-5인 가족', desc: '캠핑·여행 다 가능한 만능 가족차.' },
      { icon: 'ph-handshake', title: '비즈니스 SUV', desc: 'G80·그랜저보다 격식 덜한 임원용.' },
    ],
    specs: SPECS_TEMPLATE('11.0km/L (Hybrid 14.0)', '약 40만원', '약 120-145만원'),
  },
  carnival: {
    hook: '국내 미니밴 부동의 1위. 4세대 KA4의 위엄.',
    review: [
      { heading: 'KA4 페이스리프트', body: '풀사이즈 SUV처럼 보이는 미니밴. 9인승 풀로딩 시 짐 적재 공간이 부족할 수 있지만 2-3열 폴딩으로 해결.' },
      { heading: '하이리무진 옵션', body: '의전·VIP용으로 카니발 하이리무진(천장 높음)도 선택 가능. 일반 트림 + 1,500-2,000만원.' },
      { heading: '9인승 vs 7인승', body: '9인승은 2열 벤치, 7인승은 2열 캡틴체어. 영업·의전이라면 7인승, 가족이라면 9인승.' },
    ],
    personas: [
      { icon: 'ph-users-three', title: '대가족·다인원', desc: '시댁·처가 식구 다 태우는 가족차.' },
      { icon: 'ph-handshake', title: '의전·영업', desc: 'VIP 픽업·미팅 이동에 가장 무난.' },
    ],
    specs: SPECS_TEMPLATE('9.2km/L (Hybrid 13.0)', '약 53만원', '약 130-160만원'),
  },
  niro: {
    hook: '하이브리드 전용 SUV. 연비를 최우선하는 분께.',
    review: [
      { heading: 'SG2 세대', body: '코나·셀토스와 비슷한 체급이지만 하이브리드/EV만 출시. 연비 19km/L 이상. 친환경 차 보조금 적용 시 가격 매력 ↑.' },
    ],
    personas: [{ icon: 'ph-leaf', title: '연비 최우선', desc: '월 주행거리가 길고 연료비를 최소화하고 싶은 분.' }],
    specs: SPECS_TEMPLATE('19.1km/L', '약 28만원', '약 95-115만원'),
  },

  // === 제네시스 ===
  g70: {
    hook: '제네시스 엔트리 세단. 다이내믹한 주행감으로 입문 럭셔리.',
    review: [
      { heading: 'BMW 3시리즈 라이벌', body: 'RWD 기반 후륜구동. 스포티한 주행감이 동급 최고. 외관은 페이스리프트 후 더 차분해진 인상.' },
    ],
    personas: [{ icon: 'ph-briefcase', title: '30-40대 영 임원', desc: '비즈니스 + 드라이빙 즐거움을 동시에.' }],
    specs: SPECS_TEMPLATE('10.0km/L', '약 50만원', '약 130-160만원'),
  },
  g80: {
    hook: '제네시스 정통 럭셔리 세단. 임원·비즈니스의 표준.',
    review: [
      { heading: 'RG3 세대', body: '2025년 풀체인지. 라디에이터 그릴부터 인테리어까지 완전히 새로. 다이내믹한 주행감 + 정중한 디자인.' },
      { heading: '왜 G80인가', body: '체급 + 가격 + 유지비 + 가치 — 비즈니스 미팅·임원 의전에서 가장 많이 보이는 선택. 그랜저보다 +1,000-1,500만원이지만 격이 다름.' },
    ],
    personas: [
      { icon: 'ph-handshake', title: '40-50대 임원', desc: '비즈니스 미팅에서 격을 표현하는 선택.' },
      { icon: 'ph-briefcase', title: 'CEO·VIP', desc: '의전 차로 가장 무난. 운전기사 + 뒷좌석 거주성.' },
    ],
    specs: SPECS_TEMPLATE('10.0km/L', '약 75만원', '약 145-180만원'),
  },
  g90: {
    hook: '국산 최고급 세단. 진정한 의전 차로의 정점.',
    review: [
      { heading: 'RS4 세대', body: '롱휠베이스(LWB) 옵션으로 뒷좌석 공간이 압도적. 통풍·열선·마사지 시트 + 리어 모니터 기본. 운전기사가 있는 의전 사용 표준.' },
    ],
    personas: [{ icon: 'ph-armchair', title: '50대+ VIP', desc: '운전기사 동반 의전. 뒷좌석이 비행기 비즈니스석.' }],
    specs: SPECS_TEMPLATE('8.5km/L', '약 95만원', '약 180-220만원'),
  },
  gv70: {
    hook: '프리미엄 SUV의 정점. G80의 SUV 버전.',
    review: [
      { heading: '디자인 + 주행감', body: 'GV80보다 한 체급 작지만 디자인 완성도는 동급 최고. 도심형 + 비즈니스 SUV로 4-50대 임원 사이에서 가장 인기.' },
    ],
    personas: [{ icon: 'ph-handshake', title: '40대 임원·비즈니스', desc: 'SUV의 시야 + 프리미엄 라운지.' }],
    specs: SPECS_TEMPLATE('10.5km/L', '약 60만원', '약 140-170만원'),
  },
  gv80: {
    hook: '제네시스 플래그십 SUV. 임원 의전 + 가족 차 만능.',
    review: [
      { heading: '7인승 SUV', body: '풀사이즈 SUV의 위엄 + 럭셔리 인테리어. 팰리세이드보다 +2,000만원 이상 비싸지만 격이 완전 다름.' },
    ],
    personas: [{ icon: 'ph-handshake', title: '50대+ VIP', desc: '대형 SUV가 필요하지만 격조도 원하는 분.' }],
    specs: SPECS_TEMPLATE('8.9km/L', '약 85만원', '약 165-195만원'),
  },
};
