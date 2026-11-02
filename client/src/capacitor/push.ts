/**
 * Нативный FCM.
 *
 * ВАЖНО: без `android/app/google-services.json` любой вызов
 * PushNotifications.register() роняет процесс:
 * "Default FirebaseApp is not initialized".
 *
 * Включать только после добавления google-services.json:
 *   REACT_APP_ENABLE_NATIVE_PUSH=true npm run build:mobile
 */

import { getApiBaseUrl, isNativeApp, nativePlatform } from './platform';

const PUSH_ENABLED = process.env.REACT_APP_ENABLE_NATIVE_PUSH === 'true';

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

export async function initNativePush(): Promise<void> {
  if (!PUSH_ENABLED || !isNativeApp()) return;

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    const perm = await PushNotifications.checkPermissions();
    let receive = perm.receive;
    if (receive === 'prompt' || receive === 'prompt-with-rationale') {
      const asked = await PushNotifications.requestPermissions();
      receive = asked.receive;
    }
    if (receive !== 'granted') return;

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

    await PushNotifications.register();
  } catch (e) {
    console.warn('[capacitor] initNativePush skipped', e);
  }
}

export async function refreshNativePushRegistration(): Promise<void> {
  if (!PUSH_ENABLED || !isNativeApp()) return;
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    const perm = await PushNotifications.checkPermissions();
    if (perm.receive !== 'granted') return;
    await PushNotifications.register();
  } catch (e) {
    console.warn('[capacitor] refreshNativePush skipped', e);
  }
}
