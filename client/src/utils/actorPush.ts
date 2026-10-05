import { apiService } from '../services/api';
import {
  getSlotBearerToken,
  listUsableSavedAccounts,
  type SavedAccountSlot,
} from './accountSwitcher';

export type ActorPushChannel = 'school' | 'portal' | 'superAdmin' | 'tester';

const API_BASE = process.env.REACT_APP_API_URL || '/api';

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

/** Сколько school/portal слотов ещё в реестре (им нужен общий browser endpoint). */
function remainingInboxPushSlots(excludeId?: string): number {
  return listUsableSavedAccounts().filter(
    (a) =>
      a.id !== excludeId &&
      (a.accountType === 'TENANT_USER' ||
        a.accountType === 'CLIENT' ||
        a.accountType === 'PARENT')
  ).length;
}

export async function unsubscribeActorPush(channel: ActorPushChannel): Promise<boolean> {
  try {
    if (!('serviceWorker' in navigator)) return false;
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return true;
    await postUnsubscribe(channel, subscription.endpoint);
    // Не снимаем browser subscription, если другие аккаунты ещё на устройстве
    if (remainingInboxPushSlots() === 0) {
      await subscription.unsubscribe();
    }
    return true;
  } catch (e) {
    console.error('[actorPush] unsubscribe failed', e);
    return false;
  }
}

function channelForSlot(slot: SavedAccountSlot): ActorPushChannel | null {
  if (slot.accountType === 'TENANT_USER') return 'school';
  if (slot.accountType === 'CLIENT' || slot.accountType === 'PARENT') return 'portal';
  return null;
}

/**
 * Отписать только актёра удалённого слота (Bearer из снимка), без смены активной сессии.
 * Browser PushSubscription не трогаем, если остались другие inbox-аккаунты.
 */
export async function unsubscribePushForRemovedSlot(slot: SavedAccountSlot): Promise<void> {
  const channel = channelForSlot(slot);
  const token = getSlotBearerToken(slot);
  if (!channel || !token) return;
  if (!('serviceWorker' in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;

    const path =
      channel === 'school'
        ? '/push-notifications/unsubscribe'
        : '/client-auth/push/unsubscribe';

    await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });

    if (remainingInboxPushSlots(slot.id) === 0) {
      await subscription.unsubscribe();
    }
  } catch (e) {
    console.warn('[actorPush] unsubscribe for removed slot failed', e);
  }
}

/**
 * Если разрешение уже granted — подписать текущий school/portal аккаунт
 * (не отписывая других актёров с тем же endpoint).
 */
export async function maybeAutoSubscribeActivePush(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const hasSchool = Boolean(localStorage.getItem('token') && localStorage.getItem('user'));
  const hasPortal = Boolean(localStorage.getItem('clientToken') && localStorage.getItem('client'));

  try {
    if (hasSchool) {
      await subscribeActorPush('school');
    } else if (hasPortal) {
      await subscribeActorPush('portal');
    }
  } catch {
    /* ignore */
  }
}
