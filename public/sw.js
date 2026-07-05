// PWA Service Worker for TikTok Live Reader
// Ensures offline/persistent background execution and displays notification fallbacks when closed or hidden.

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
  // Pass-through handler: ensures live WebSocket & SSE API routes function instantly without stale caching
  return;
});

// Push Notification listener to handle events when app is closed/hidden
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'TikTok Alerta en Vivo', body: event.data.text() };
    }
  }

  const title = data.title || 'Nueva Alerta de Regalo';
  const options = {
    body: data.body || '¡Se recibió un evento en tu transmisión en vivo!',
    icon: data.icon || 'https://adventure-8t03kq.fly.dev/img/logo.png',
    badge: data.badge || 'https://adventure-8t03kq.fly.dev/img/logo.png',
    vibrate: [200, 100, 200],
    tag: 'gift-alert',
    renotify: true,
    data: {
      url: self.registration.scope
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Focus or open application when user taps the notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const targetUrl = event.notification.data ? event.notification.data.url : '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
