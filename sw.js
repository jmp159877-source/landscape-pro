// 조경노트 PRO 서비스워커 (📲 패치 #25)
// 원칙: 화면은 항상 인터넷에서 최신 버전을 먼저 받는다 (옛 화면에 갇히는 문제 방지).
//       인터넷이 끊겼을 때만 마지막으로 저장해 둔 화면을 보여준다.
//       Firebase·AI·날씨 등 외부 서버 요청은 절대 가로채지 않는다.
const CACHE = 'jogyeongnote-v2'; // 🔔 패치 #33: 알림 기능 추가로 버전 올림
const SHELL = ['/', '/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 외부 서버 요청은 건드리지 않음

  // 화면(페이지) 요청: 인터넷 우선 → 실패하면 저장본
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && url.pathname === '/') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put('/', copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('/')))
    );
    return;
  }

  // 아이콘·설정 파일: 저장본 우선
  if (SHELL.includes(url.pathname)) {
    e.respondWith(caches.match(req).then((r) => r || fetch(req)));
  }
});

// 🔔 [패치 #33] 푸시 알림 받기 (앱을 닫아 두어도 휴대폰 위쪽에 표시)
self.addEventListener('push', (e) => {
  let p = {};
  try { p = e.data ? e.data.json() : {}; } catch (err) { p = { data: { body: e.data ? e.data.text() : '' } }; }
  const d = p.data || p;
  const n = p.notification || {};
  const title = d.title || n.title || '조경노트';
  const opts = {
    body: d.body || n.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: d.url || '/' },
    tag: d.tag || undefined,
    renotify: !!d.tag,
    vibrate: [120, 60, 120]
  };
  e.waitUntil(self.registration.showNotification(title, opts));
});

// 알림을 누르면 해당 화면으로 이동 (이미 열린 앱이 있으면 그 창을 사용)
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (new URL(c.url).origin === self.location.origin && 'focus' in c) {
          return c.navigate(url).then((w) => (w || c).focus()).catch(() => c.focus());
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
