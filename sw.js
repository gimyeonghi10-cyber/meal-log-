/* ==========================================================================
   sw.js — 앱 셸 캐시 (오프라인에서도 기록 화면은 열린다)
   데이터는 localStorage / Firestore 가 담당하므로 여기서는 정적 파일만 캐시.
   ========================================================================== */
const CACHE = 'meal-log-v1.0.0';
const SHELL = [
  './',
  './index.html',
  './css/styles.css',
  './js/util.js',
  './js/store.js',
  './js/chart.js',
  './js/sync.js',
  './js/app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Firebase SDK·API 등 외부 요청은 네트워크에 그대로 맡긴다.
  if (url.origin !== self.location.origin) return;

  // 화면 이동은 네트워크 우선(새 버전 반영), 실패 시 캐시
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  // 정적 자산은 캐시 우선 + 백그라운드 갱신
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
