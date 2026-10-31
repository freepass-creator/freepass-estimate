// Run in the already signed-in https://kamatch.kr browser tab.
// Read-only: no quotes are saved, no applications or messages are submitted.
(async () => {
  if (location.origin !== 'https://kamatch.kr') throw new Error('카매치 탭에서 실행해 주세요.');
  const paths = ['/api/vehicles', '/api/fee-rates', '/api/commission-settings', '/api/model-fee-rates', '/api/commission-rates', '/api/residual-grade-rates', '/api/gaeso-reg-rates', '/api/residual-rates', '/api/supplies-prices'];
  const tables = {};
  for (const path of paths) {
    const response = await fetch(path, { credentials: 'include', cache: 'no-store' });
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}. 인증 또는 조회 권한을 확인해 주세요.`);
    const type = response.headers.get('content-type') || '';
    if (!type.includes('application/json')) throw new Error(`${path}: JSON 응답이 아닙니다.`);
    tables[path] = await response.json();
  }
  const script = [...document.scripts].find(node => /\/assets\/index-[\w-]+\.js/.test(node.src));
  if (!script || new URL(script.src).origin !== location.origin) throw new Error('현재 앱 버전을 확인하지 못했습니다.');
  const sourceResponse = await fetch(script.src, { cache: 'no-store' });
  if (!sourceResponse.ok) throw new Error('현재 앱 버전을 읽지 못했습니다.');
  const bytes = await sourceResponse.arrayBuffer();
  const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(v => v.toString(16).padStart(2, '0')).join('');
  const packet = { schema: 'kamatch-authenticated-reference/v1', capturedAt: new Date().toISOString(), source: location.origin, application: { url: script.src, sha256: digest }, tables };
  const url = URL.createObjectURL(new Blob([JSON.stringify(packet, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'kamatch-private-calculation-reference.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { downloaded: true, tableCount: paths.length, appDigest: digest };
})();
