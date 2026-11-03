/**
 * Нативный FCM + локальные уведомления.
 *
 * FCM (системный push при убитом приложении) требует:
 *   android/app/google-services.json
 * и на сервере FIREBASE_SERVICE_ACCOUNT_JSON (или GOOGLE_APPLICATION_CREDENTIALS).
 *
 * Локальные уведомления работают без Firebase, пока процесс WebView жив.
 */

import { getApiBaseUrl, isNativeApp, nativePlatform } from './platform';
import { ensureLocalNotifyChannel, initLocalNotifyActions } from './localNotify';

const PUSH_ENABLED =
  process.env.REACT_APP_ENABLE_NATIVE_PUSH === 'true' ||
  process.env.REACT_APP_ENABLE_NATIVE_PUSH === '1';

function authBearer(): string | null {
  return (
    localStorage.getItem('superAdminToken') ||
    localStorage.getItem('token') ||
    localStorage.getItem('clientToken') ||
    localStorage.getItem('testerToken') ||
    null
  );
}

function accountType(): string | null {
  if (localStorage.getItem('superAdminToken')) return 'SUPER_ADMIN';
  if (localStorage.getItem('clientToken')) return 'CLIENT';
  if (localStorage.getItem('testerToken')) return 'TESTER';
  if (localStorage.getItem('token')) return 'SCHOOL';
  return null;
}

async function registerTokenOnServer(token: string): Promise<void> {
  const bearer = authBearer();
  if (!bearer) return;
  await fetch(`${getApiBaseUrl()}/mobile/fcm/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${bearer}`,
    },
    body: JSON.stringify({
      token,
      platform: nativePlatform(),
      accountType: accountType(),
    }),
  });
}

let fcmListenersBound = false;

export async function initNativePush(): Promise<void> {
  if (!isNativeApp()) return;

  // Локальный канал всегда — даже без google-services
  await initLocalNotifyActions();

  if (!PUSH_ENABLED) {
    console.info(
      '[capacitor] FCM выключен (нет REACT_APP_ENABLE_NATIVE_PUSH / google-services.json). Локальные уведомления активны.'
    );
    return;
  }

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    const perm = await PushNotifications.checkPermissions();
    let receive = perm.receive;
    if (receive === 'prompt' || receive === 'prompt-with-rationale') {
      const asked = await PushNotifications.requestPermissions();
      receive = asked.receive;
    }
    if (receive !== 'granted') return;

    if (!fcmListenersBound) {
      fcmListenersBound = true;
      PushNotifications.addListener('registration', (token) => {
        void registerTokenOnServer(token.value).catch((e) =>
          console.warn('[capacitor] FCM server register failed', e)
        );
      });
      PushNotifications.addListener('registrationError', (err) => {
        console.warn('[capacitor] push registrationError', err);
      });
      PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        const data = action.notification?.data as Record<string, string> | undefined;
        const path = data?.path || data?.url || data?.route;
        if (path && typeof path === 'string' && path.startsWith('/')) {
          window.history.pushState({}, '', path);
          window.dispatchEvent(new PopStateEvent('popstate'));
        }
      });
      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        // foreground: дублируем локальным баннером
        void import('./localNotify').then(({ showLocalNotification }) =>
          showLocalNotification({
            title: notification.title || 'ПРОФСПОРТСРМ',
            body: notification.body || '',
            path:
              (notification.data as Record<string, string> | undefined)?.url ||
              (notification.data as Record<string, string> | undefined)?.path,
          })
        );
      });
    }

    await PushNotifications.register();
  } catch (e) {
    console.warn('[capacitor] initNativePush skipped', e);
  }
}

export async function refreshNativePushRegistration(): Promise<void> {
  if (!isNativeApp()) return;
  await ensureLocalNotifyChannel();
  if (!PUSH_ENABLED) return;
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    const perm = await PushNotifications.checkPermissions();
    if (perm.receive !== 'granted') return;
    await PushNotifications.register();
  } catch (e) {
    console.warn('[capacitor] refreshNativePush skipped', e);
  }
}

export function isNativeFcmBuildEnabled(): boolean {
  return PUSH_ENABLED;
}
