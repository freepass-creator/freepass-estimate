// Existing operational self-quote store. Rules are owned by FreePass Sales.
// Extracted from welrixtable 1b4604d without retired RTDB dependencies.
import { getApps, initializeApp } from 'firebase/app';
import { initializeFirestore, connectFirestoreEmulator, doc, getDoc, setDoc } from 'firebase/firestore';
let database;
function db() {
  if (database) return database;
  const name = 'welrix-share';
  const app = getApps().find(a => a.name === name) || initializeApp({
    apiKey: 'AIzaSyDqPhVTIKLpoFmPySlPk9iAX_tJIcFIyZg',
    authDomain: 'welrixtable.firebaseapp.com', projectId: 'welrixtable',
    appId: '1:480591093407:web:abb3e592a618f1f5364caa',
  }, name);
  database = initializeFirestore(app, { ignoreUndefinedProperties: true });
  const emulator = globalThis.window?.__WELRIX_SHARE_EMULATOR__;
  if (emulator && /^(localhost|127\.0\.0\.1)$/.test(globalThis.location?.hostname || '')) {
    connectFirestoreEmulator(database, emulator.host || '127.0.0.1', emulator.port || 8080);
  }
  return database;
}
function randomId() {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  while (id.length < 8) {
    for (const byte of crypto.getRandomValues(new Uint8Array(8))) {
      if (byte < 252) id += alphabet[byte % 36];
      if (id.length === 8) break;
    }
  }
  return id;
}
export async function saveSelfQuote(bundle) {
  const payload = JSON.stringify(bundle);
  if (new TextEncoder().encode(payload).length > 20000) throw new Error('공유할 견적이 너무 큽니다.');
  const id = randomId(), now = Date.now();
  await setDoc(doc(db(), 'welrix_quote_shares', id), {
    quote_id: id, kind: 'self', created_at: now, expires_at: now + 30 * 86400000, payload,
  });
  return `https://welrixtable.vercel.app/s/${id}`;
}
export async function loadSelfQuote(id) {
  if (!/^[a-z0-9]{8}$/.test(id)) throw new Error('올바르지 않은 견적 링크입니다.');
  let snapshot;
  try { snapshot = await getDoc(doc(db(), 'welrix_quote_shares', id)); }
  catch (error) {
    if (error.code === 'permission-denied') throw new Error('견적 링크가 없거나 유효기간이 지났습니다.');
    throw new Error('견적을 불러오지 못했습니다. 연결을 확인하고 다시 열어주세요.');
  }
  const record = snapshot.data();
  if (!snapshot.exists() || record.kind !== 'self' || record.expires_at <= Date.now()) {
    throw new Error('견적 링크가 없거나 유효기간이 지났습니다.');
  }
  try { return JSON.parse(record.payload); }
  catch { throw new Error('저장된 견적을 읽을 수 없습니다.'); }
}
