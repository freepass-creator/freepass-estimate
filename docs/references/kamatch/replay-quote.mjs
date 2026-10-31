// Development evidence replay only. Not a pricing formula or registered provider.
import { readFileSync } from 'node:fs';

const evidence = JSON.parse(readFileSync(new URL('./observations.json', import.meta.url), 'utf8'));

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function replayQuote(input, termMonths) {
  const row = evidence.rows.find(item => stable(item.input) === stable(input));
  const result = row?.results.find(item => item.termMonths === termMonths);
  if (!result) {
    const error = new Error('해당 입력·기간의 카매치 관찰값이 없습니다. 보간이나 추정 계산을 하지 않습니다.');
    error.code = 'KAMATCH_OBSERVATION_NOT_FOUND';
    throw error;
  }
  return {
    status: 'OBSERVATION_REPLAY_ONLY',
    observationId: row.id,
    observedDate: evidence.observedDate,
    source: evidence.source,
    result: structuredClone(result),
  };
}
