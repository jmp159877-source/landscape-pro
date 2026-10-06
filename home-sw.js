// 🏡 [패치 #131] 조경노트 홈(고객용) 바로가기 아이콘용 서비스워커 — 범위 /home 만
// 화면은 항상 인터넷에서 최신으로 받음. 아무것도 저장하지 않음 (업체 앱 sw.js 와 따로).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || e.request.mode !== 'navigate') return;
  e.respondWith(fetch(e.request).catch(() => new Response('<meta charset="utf-8"><meta name="viewport" content="width=device-width"><p style="font:18px sans-serif;padding:40px;text-align:center">인터넷 연결을 확인해 주세요.<br>조경노트 홈 · 1668-3936</p>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } })));
});
