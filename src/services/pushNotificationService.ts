import { prisma } from '../lib/prisma';
import webpush from 'web-push';

// Инициализация VAPID ключей (должны быть в .env)
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || process.env.CORS_ORIGIN || 'mailto:admin@example.com';

if (vapidPublicKey && vapidPrivateKey) {
  try {
    webpush.setVapidDetails(
      vapidSubject,
      vapidPublicKey,
      vapidPrivateKey
    );
    console.log('[Push Notifications] VAPID keys configured successfully');
  } catch (error) {
    console.error('[Push Notifications] Error setting VAPID details:', error);
  }
} else {
  console.warn('[Push Notifications] VAPID keys not configured. Push notifications will not work.');
  console.warn('[Push Notifications] Generate keys with: npx web-push generate-vapid-keys');
}

interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

/**
 * Сохранение подписки на push уведомления
 */
export async function savePushSubscription(
  userId: string,
  subscription: PushSubscriptionData,
  userAgent?: string
): Promise<void> {
  try {
    await prisma.pushSubscription.upsert({
      where: {
        userId_endpoint: {
          userId,
          endpoint: subscription.endpoint
        }
      },
      update: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent: userAgent || null,
        updatedAt: new Date()
      },
      create: {
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent: userAgent || null
      }
    });
  } catch (error) {
    console.error('[Push Notifications] Error saving subscription:', error);
    throw error;
  }
}

/**
 * Удаление подписки на push уведомления
 */
export async function removePushSubscription(
  userId: string,
  endpoint: string
): Promise<void> {
  try {
    await prisma.pushSubscription.deleteMany({
      where: {
        userId,
        endpoint
      }
    });
  } catch (error) {
    console.error('[Push Notifications] Error removing subscription:', error);
    throw error;
  }
}

/**
 * Получение всех подписок пользователя
 */
export async function getUserSubscriptions(userId: string): Promise<any[]> {
  try {
    return await prisma.pushSubscription.findMany({
      where: { userId }
    });
  } catch (error) {
    console.error('[Push Notifications] Error getting subscriptions:', error);
    return [];
  }
}

/**
 * Отправка push уведомления пользователю
 */
export async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  data?: any
): Promise<void> {
  try {
    const subscriptions = await getUserSubscriptions(userId);

    if (subscriptions.length === 0) {
      console.log(`[Push Notifications] No subscriptions found for user ${userId}`);
      return;
    }

    const payload = JSON.stringify({
      title,
      body,
      icon: '/logo192.png',
      badge: '/logo192.png',
      data: data || {},
      requireInteraction: false,
      silent: false
    });

    const sendPromises = subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth
            }
          },
          payload
        );
        console.log(`[Push Notifications] Notification sent to user ${userId}`);
      } catch (error: any) {
        // Если подписка недействительна, удаляем её
        if (error.statusCode === 410 || error.statusCode === 404) {
          console.log(`[Push Notifications] Subscription expired, removing: ${subscription.endpoint}`);
          await removePushSubscription(userId, subscription.endpoint);
        } else {
          console.error(`[Push Notifications] Error sending notification:`, error);
        }
      }
    });

    await Promise.allSettled(sendPromises);
  } catch (error) {
    console.error('[Push Notifications] Error in sendPushNotification:', error);
  }
}

/**
 * Получение публичного VAPID ключа
 */
export function getVapidPublicKey(): string | null {
  return vapidPublicKey || null;
}

