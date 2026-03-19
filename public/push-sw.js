self.addEventListener('push', (event) => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch (_error) {
    data = { title: 'Neue Benachrichtigung', body: event.data?.text?.() || '' };
  }

  const title = data.title || 'Neue Benachrichtigung';
  const options = {
    body: data.body || '',
    icon: data.icon || '/PlantDexIcon.png',
    badge: data.badge || '/PlantDexIcon.png',
    data: data.data || {},
    vibrate: data.vibrate || [200, 100, 200],
    tag: data.tag || 'floralog-notification',
    renotify: Boolean(data.renotify),
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetPath = event.notification.data?.actionUrl || '/Friends?tab=news';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(targetPath);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetPath);
      }
      return undefined;
    })
  );
});
