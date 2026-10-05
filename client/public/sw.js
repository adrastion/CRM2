// Service Worker для push уведомлений
self.addEventListener('push', function (event) {
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
    silent: data.silent || false,
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Уведомление', options)
  );
});

function buildSwitchUrl(payload) {
  const data = payload || {};
  let next = '/';

  if (data.url) {
    next = data.url;
  } else if (data.type === 'daily_training_notification' || data.type === 'training_reminder') {
    next = '/schedule';
  } else if (data.type === 'server_load_critical') {
    next = '/admin/dashboard';
  } else if (data.type === 'chat_message') {
    next = '/chats';
  } else if (data.type === 'platform_changelog') {
    next = '/admin/dashboard?section=changelog';
  }

  const accountId = data.accountId ? String(data.accountId) : '';
  if (!accountId) return next;

  const params = new URLSearchParams();
  params.set('switchAccount', accountId);
  if (next && next !== '/') params.set('next', next);
  return `/?${params.toString()}`;
}

// Обработка клика по уведомлению
self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  const data = event.notification.data || {};
  const url = buildSwitchUrl(data);

  event.waitUntil(
    (async function () {
      const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of allClients) {
        if ('focus' in client) {
          await client.focus();
          client.postMessage({
            type: 'SWITCH_ACCOUNT_FROM_PUSH',
            switchAccount: data.accountId || null,
            next: data.url || url,
          });
          // Также навигируем через query, если вкладка на другом origin-path
          if (client.url && 'navigate' in client) {
            try {
              await client.navigate(url);
            } catch (e) {
              /* ignore */
            }
          }
          return;
        }
      }
      await clients.openWindow(url);
    })()
  );
});
