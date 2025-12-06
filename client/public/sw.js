// Service Worker для push уведомлений
self.addEventListener('push', function(event) {
  let data = {};
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'Уведомление', body: event.data.text() };
    }
  }

  const options = {
    title: data.title || 'Уведомление',
    body: data.body || 'Новое уведомление',
    icon: data.icon || '/logo192.png',
    badge: data.badge || '/logo192.png',
    data: data.data || {},
    requireInteraction: data.requireInteraction || false,
    silent: data.silent || false
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Уведомление', options)
  );
});

// Обработка клика по уведомлению
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  const data = event.notification.data;
  let url = '/';

  if (data && data.type === 'daily_training_notification') {
    url = '/schedule';
  } else if (data && data.type === 'training_reminder') {
    url = '/schedule';
  }

  event.waitUntil(
    clients.openWindow(url)
  );
});

