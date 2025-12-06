import { apiService } from '../services/api';

/**
 * Запрос разрешения на уведомления и подписка
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
 * Подписка на push уведомления
 */
export async function subscribeToPushNotifications(): Promise<boolean> {
  try {
    // Проверяем поддержку Service Worker
    if (!('serviceWorker' in navigator)) {
      console.warn('Service Worker not supported');
      return false;
    }

    // Запрашиваем разрешение
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
      return false;
    }

    // Получаем VAPID ключ
    const publicKey = await apiService.getVapidKey();
    if (!publicKey) {
      console.error('VAPID key not available');
      return false;
    }

    // Регистрируем Service Worker
    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    // Подписываемся на push уведомления
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    });

    // Отправляем подписку на сервер
    await apiService.subscribeToPush(subscription.toJSON(), navigator.userAgent);

    console.log('Successfully subscribed to push notifications');
    return true;
  } catch (error) {
    console.error('Error subscribing to push notifications:', error);
    return false;
  }
}

/**
 * Отписка от push уведомлений
 */
export async function unsubscribeFromPushNotifications(): Promise<boolean> {
  try {
    if (!('serviceWorker' in navigator)) {
      return false;
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      await subscription.unsubscribe();
      await apiService.unsubscribeFromPush(subscription.endpoint);
      console.log('Successfully unsubscribed from push notifications');
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error unsubscribing from push notifications:', error);
    return false;
  }
}

/**
 * Проверка статуса подписки
 */
export async function checkPushSubscriptionStatus(): Promise<boolean> {
  try {
    if (!('serviceWorker' in navigator)) {
      return false;
    }

    // Проверяем разрешение на уведомления
    if (Notification.permission !== 'granted') {
      return false;
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return subscription !== null;
  } catch (error) {
    console.error('Error checking subscription status:', error);
    return false;
  }
}

/**
 * Проверка разрешения на уведомления
 */
export function checkNotificationPermission(): 'granted' | 'denied' | 'default' {
  if (!('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
}

/**
 * Конвертация VAPID ключа из base64 в Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

