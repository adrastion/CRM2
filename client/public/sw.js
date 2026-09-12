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

  const data = event.notification.data || {};
  let url = '/';

  if (data.url) {
    url = data.url;
  } else if (data.type === 'daily_training_notification' || data.type === 'training_reminder') {
    url = '/schedule';
  } else if (data.type === 'server_load_critical') {
    url = '/admin/dashboard';
  } else if (data.type === 'chat_message') {
    url = '/chats';
  } else if (data.type === 'platform_changelog') {
    url = '/admin/dashboard?section=changelog';
  }

  event.waitUntil(
    clients.openWindow(url)
  );
});

