// freepasserp3 Firebase 프로젝트 공유 — Realtime DB (asia-southeast1)
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyA0q_6yo9YRkpNeNaawH1AFPZx1IMgj-dY',
  authDomain: 'freepasserp3.firebaseapp.com',
  databaseURL: 'https://freepasserp3-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'freepasserp3',
  storageBucket: 'freepasserp3.firebasestorage.app',
  messagingSenderId: '172664197996',
  appId: '1:172664197996:web:91b7219f22eb68b5005949',
  measurementId: 'G-GY06DRBR15',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
export const storage = getStorage(app);

// 견적 발송용 — 영업사원 로그인 안 한 상태에서도 익명으로 쓸 수 있도록.
// 로그인된 사용자가 있으면 그 권한으로, 없으면 익명.
let authReady = false;
const authReadyPromise = new Promise((resolve) => {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      try { await signInAnonymously(auth); } catch (e) { console.warn('[fb] 익명 로그인 실패:', e?.code); }
    }
    if (!authReady) { authReady = true; resolve(auth.currentUser); }
  });
});
export const waitAuth = () => authReadyPromise;

export default app;
