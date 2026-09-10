import { apiService } from '../services/api';

export type ActorPushChannel = 'school' | 'portal' | 'superAdmin' | 'tester';

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

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  return (await Notification.requestPermission()) === 'granted';
}

export function browserNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

async function getVapidKey(channel: ActorPushChannel): Promise<string | null> {
  if (channel === 'school') return apiService.getVapidKey();
  if (channel === 'portal') return apiService.getPortalPushVapidKey();
  if (channel === 'tester') return apiService.getTesterPushVapidKey();
  return apiService.getServerMetricsVapidKey();
}

async function postSubscribe(
  channel: ActorPushChannel,
  subscription: PushSubscriptionJSON,
  userAgent?: string
): Promise<void> {
  if (channel === 'school') {
    await apiService.subscribeToPush(subscription, userAgent);
  } else if (channel === 'portal') {
    await apiService.subscribePortalPush(subscription, userAgent);
  } else if (channel === 'tester') {
    await apiService.subscribeTesterPush(subscription, userAgent);
  } else {
    await apiService.subscribeSuperAdminPush(subscription, userAgent);
  }
}

async function postUnsubscribe(channel: ActorPushChannel, endpoint: string): Promise<void> {
  if (channel === 'school') {
    await apiService.unsubscribeFromPush(endpoint);
  } else if (channel === 'portal') {
    await apiService.unsubscribePortalPush(endpoint);
  } else if (channel === 'tester') {
    await apiService.unsubscribeTesterPush(endpoint);
  } else {
    await apiService.unsubscribeSuperAdminPush(endpoint);
  }
}

export async function checkActorPushStatus(channel: ActorPushChannel): Promise<boolean> {
  try {
    if (channel === 'school') {
      const subs = await apiService.getUserPushSubscriptions();
      return Array.isArray(subs) && subs.length > 0;
    }
    if (channel === 'portal') {
      const s = await apiService.getPortalPushStatus();
      return Boolean(s?.subscribed);
    }
    if (channel === 'tester') {
      const s = await apiService.getTesterPushStatus();
      return Boolean(s?.subscribed);
    }
    const s = await apiService.getSuperAdminPushStatus();
    return Boolean(s?.subscribed);
  } catch {
    return false;
  }
}

export async function subscribeActorPush(channel: ActorPushChannel): Promise<boolean> {
  try {
    if (!('serviceWorker' in navigator)) return false;
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) return false;

    const publicKey = await getVapidKey(channel);
    if (!publicKey) return false;

    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
    }

    await postSubscribe(channel, subscription.toJSON(), navigator.userAgent);
    return true;
  } catch (e) {
    console.error('[actorPush] subscribe failed', e);
    return false;
  }
}

export async function unsubscribeActorPush(channel: ActorPushChannel): Promise<boolean> {
  try {
    if (!('serviceWorker' in navigator)) return false;
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return true;
    await postUnsubscribe(channel, subscription.endpoint);
    await subscription.unsubscribe();
    return true;
  } catch (e) {
    console.error('[actorPush] unsubscribe failed', e);
    return false;
  }
}
