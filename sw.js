// 조경노트 PRO 서비스워커 (📲 패치 #25)
// 원칙: 화면은 항상 인터넷에서 최신 버전을 먼저 받는다 (옛 화면에 갇히는 문제 방지).
//       인터넷이 끊겼을 때만 마지막으로 저장해 둔 화면을 보여준다.
//       Firebase·AI·날씨 등 외부 서버 요청은 절대 가로채지 않는다.
const CACHE = 'jogyeongnote-v3'; // 🔔 패치 #33: 알림 기능 추가로 버전 올림 · #108: 알림 누르면 맞는 창으로
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

// 🔔 [패치 #108] 알림을 누르면 '맞는 창'으로 이동
//  - 관리자 알림(master.html) → 열린 관리자 창에 메시지만 보냄 (관리자 창은 새로 불러오면 로그아웃되므로 이동하지 않음)
//  - 업체 알림(/?open=…)     → 열린 업체 앱 창에 메시지만 보냄 (관리자 창·고객 화면은 건드리지 않음)
//  - 맞는 창이 없으면 새 창으로 열기
function jnKind(path) { return /^\/master/.test(path) ? 'master' : (path === '/' || path === '/index.html') ? 'app' : 'other'; }
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  const target = new URL(url, self.location.origin);
  const want = jnKind(target.pathname);
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const mine = list.filter((c) => { try { const u = new URL(c.url); return u.origin === self.location.origin && jnKind(u.pathname) === want; } catch (x) { return false; } });
      const c = mine.find((x) => x.focused) || mine.find((x) => x.visibilityState === 'visible') || mine[0];
      if (c && want !== 'other') {
        try { c.postMessage({ type: 'jn-open', url: target.pathname + target.search }); } catch (x) {}
        return 'focus' in c ? c.focus() : undefined;
      }
      return self.clients.openWindow(target.pathname + target.search);
    })
  );
});
