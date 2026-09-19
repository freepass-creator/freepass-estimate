// 최소 service worker — PWA 설치 자격 충족용 (네트워크 first, 캐시 X)
// Vercel 의 Cache-Control 헤더가 캐시 정책을 담당하므로 SW 에서 별도 캐시 안 함.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => { /* pass-through */ });
