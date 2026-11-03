import { isNativeApp } from './platform';

let prepared = false;
let idSeq = 1000;

/**
 * Локальные уведомления в APK (пока приложение живо / в фоне).
 * Системный FCM для «убитого» процесса — отдельно (google-services.json).
 */
export async function ensureLocalNotifyChannel(): Promise<void> {
  if (!isNativeApp() || prepared) return;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const perm = await LocalNotifications.checkPermissions();
    let display = perm.display;
    if (display === 'prompt' || display === 'prompt-with-rationale') {
      const asked = await LocalNotifications.requestPermissions();
      display = asked.display;
    }
    if (display !== 'granted') return;

    await LocalNotifications.createChannel({
      id: 'profsport_default',
      name: 'ПРОФСПОРТСРМ',
      description: 'Уведомления CRM',
      importance: 5,
      visibility: 1,
      sound: 'default',
      vibration: true,
    });
    prepared = true;
  } catch (e) {
    console.warn('[capacitor] localNotify channel', e);
  }
}

export async function showLocalNotification(opts: {
  title: string;
  body?: string;
  path?: string;
}): Promise<void> {
  if (!isNativeApp()) return;
  try {
    await ensureLocalNotifyChannel();
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') return;

    idSeq += 1;
    await LocalNotifications.schedule({
      notifications: [
        {
          id: idSeq,
          title: opts.title,
          body: opts.body || '',
          channelId: 'profsport_default',
          extra: opts.path ? { path: opts.path } : undefined,
        },
      ],
    });
  } catch (e) {
    console.warn('[capacitor] showLocalNotification', e);
  }
}

export async function initLocalNotifyActions(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    await ensureLocalNotifyChannel();
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
      const path = (action.notification?.extra as { path?: string } | undefined)?.path;
      if (path && path.startsWith('/')) {
        window.history.pushState({}, '', path);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    });
  } catch (e) {
    console.warn('[capacitor] localNotify actions', e);
  }
}
