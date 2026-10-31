// Read-only comparison: observations are evidence, never a vehicle master or live provider.
export const COMPARISON_TYPES = Object.freeze([
  Object.freeze({ id: 'standard-draft', label: '신용 무관', credit: '중신용', engine: '표준추정' }),
  Object.freeze({ id: 'kamatch-low', label: '소득 확인', credit: '저신용', engine: '카매치' }),
  Object.freeze({ id: 'welrix-medium', label: '신용 심사', credit: '중신용', engine: '외부' }),
]);

export function comparisonRequest(request, typeId, term) {
  const type = COMPARISON_TYPES.find((item) => item.id === typeId);
  if (!type?.engine || !request) throw new Error('선택한 차량의 계산 요청이 필요합니다.');
  const scenario = request.안들?.find((item) => item.기간 === term);
  if (!scenario) throw new Error('현재 견적에서 해당 기간을 선택해 주세요.');
  return {
    ...structuredClone(request),
    조건: { ...structuredClone(request.조건), 신용: type.credit },
    안들: [structuredClone(scenario)],
  };
}

export function observedComparison(evidence, observationId, term) {
  if (evidence?.schema !== 'kamatch-observations/v1' || evidence.status !== 'OBSERVED_REFERENCE_ONLY') {
    throw new Error('카매치 관찰 자료를 확인할 수 없습니다.');
  }
  const row = evidence.rows?.find((item) => item.id === observationId);
  const result = row?.results?.find((item) => item.termMonths === term);
  if (!row || !result) throw new Error('이 구성·기간의 카매치 관찰값이 없습니다.');
  return structuredClone({
    status: 'OBSERVATION_REPLAY_ONLY',
    observationId: row.id,
    observedDate: evidence.observedDate,
    input: row.input,
    result,
  });
}

export function observationLabel(row) {
  const input = row.input;
  const options = input.factoryOptions.map((item) => item.name).join(' + ');
  return `${input.model} ${input.trim} · ${input.vehiclePrice.toLocaleString('ko-KR')}원 · 보증금 ${input.depositPercent}% / 선납 ${input.prepayPercent}%${options ? ' · ' + options : ''} · ${row.id}`;
}
