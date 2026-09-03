import { apiService } from '../services/api';

/**
 * Запрос разрешения на уведомления
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn('This browser does not support notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission === 'denied') {
    console.warn('Notification permission denied');
    return false;
  }

  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

/**
 * Подписка супер-админа на push о критической нагрузке сервера
 */
export async function subscribeSuperAdminPushNotifications(): Promise<boolean> {
  try {
    if (!('serviceWorker' in navigator)) {
      console.warn('Service Worker not supported');
      return false;
    }

    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
      return false;
    }

    const publicKey = await apiService.getServerMetricsVapidKey();
    if (!publicKey) {
      console.error('VAPID key not available');
      return false;
    }

    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    await apiService.subscribeSuperAdminPush(subscription.toJSON(), navigator.userAgent);
    return true;
  } catch (error) {
    console.error('Error subscribing super-admin push:', error);
    return false;
  }
}

/**
 * Отписка супер-админа от push
 */
export async function unsubscribeSuperAdminPushNotifications(): Promise<boolean> {
  try {
    if (!('serviceWorker' in navigator)) {
      return false;
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      return true;
    }

    await apiService.unsubscribeSuperAdminPush(subscription.endpoint);
    // Не отписываем pushManager полностью — могут быть другие типы уведомлений
    return true;
  } catch (error) {
    console.error('Error unsubscribing super-admin push:', error);
    return false;
  }
}

export function checkNotificationPermission(): 'granted' | 'denied' | 'default' {
  if (!('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
