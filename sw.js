const CACHE_NAME = 'smc-signals-v1';
const ASSETS = ['./index.html', './manifest.json'];

// ── Install & cache ──────────────────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

// ── Serve from cache, fall back to network ───────────────────────────────────
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});

// ── Receive push messages from the main thread ───────────────────────────────
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SIGNAL_NOTIFY') {
    const { pair, signal, confidence, price, sl, tp1 } = e.data.payload;

    // Emoji + title based on signal strength
    const emoji =
      signal === 'BUY'       ? '🟢' :
      signal === 'SELL'      ? '🔴' :
      signal === 'WEAK BUY'  ? '🟡' :
      signal === 'WEAK SELL' ? '🟠' : '⚪';

    const strength =
      (signal === 'BUY' || signal === 'SELL') ? '⚡ STRONG' : '〰 WEAK';

    const title = `${emoji} ${strength} ${signal} — ${pair}`;

    const body = [
      `Price: ${price}`,
      `Confidence: ${confidence}%`,
      sl  ? `SL: ${sl}` : '',
      tp1 ? `TP1: ${tp1}` : '',
    ].filter(Boolean).join('  |  ');

    const options = {
      body,
      icon: './icon-192.png',
      badge: './icon-192.png',
      tag: pair,                    // replaces previous notif for same pair
      renotify: true,
      vibrate: signal === 'BUY' || signal === 'SELL'
        ? [200, 100, 200, 100, 400]  // strong double-buzz
        : [100, 50, 100],            // soft single-buzz
      data: { pair, signal },
      actions: [
        { action: 'view', title: '📊 View Chart' },
        { action: 'dismiss', title: 'Dismiss' },
      ],
      silent: false,
    };

    e.waitUntil(self.registration.showNotification(title, options));
  }

  // ── Invalidated / expired limit-trade alerts ──────────────────────────────
  if (e.data && e.data.type === 'SIGNAL_INVALID') {
    const { pair, signal, entry, reason } = e.data.payload;

    const title = `⛔ Signal Invalidated — ${pair}`;
    const body = `${signal} setup from ${entry} ${reason}`;

    const options = {
      body,
      icon: './icon-192.png',
      badge: './icon-192.png',
      tag: pair + '-invalid',
      renotify: true,
      vibrate: [80, 60, 80],   // short flat buzz — distinct from trade alerts
      data: { pair, signal, invalid: true },
      actions: [
        { action: 'view', title: '📊 View Chart' },
        { action: 'dismiss', title: 'Dismiss' },
      ],
      silent: false,
    };

    e.waitUntil(self.registration.showNotification(title, options));
  }
});

// ── Notification click ────────────────────────────────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action !== 'dismiss') {
    e.waitUntil(clients.openWindow('./index.html'));
  }
});
