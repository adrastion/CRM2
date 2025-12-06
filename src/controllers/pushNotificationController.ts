import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import {
  savePushSubscription,
  removePushSubscription,
  getUserSubscriptions,
  getVapidPublicKey
} from '../services/pushNotificationService';

/**
 * Получить публичный VAPID ключ
 */
export const getVapidKey = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const publicKey = getVapidPublicKey();
    
    if (!publicKey) {
      return res.status(503).json({
        success: false,
        error: 'Push notifications not configured'
      });
    }

    return res.json({
      success: true,
      data: { publicKey }
    });
  } catch (error) {
    console.error('Get VAPID key error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get VAPID key'
    });
  }
};

/**
 * Подписаться на push уведомления
 */
export const subscribeToPush = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    const { subscription, userAgent } = req.body;

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({
        success: false,
        error: 'Invalid subscription data'
      });
    }

    await savePushSubscription(
      userId,
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth
        }
      },
      userAgent
    );

    return res.json({
      success: true,
      message: 'Successfully subscribed to push notifications'
    });
  } catch (error) {
    console.error('Subscribe to push error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to subscribe to push notifications'
    });
  }
};

/**
 * Отписаться от push уведомлений
 */
export const unsubscribeFromPush = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    const { endpoint } = req.body;

    if (!endpoint) {
      return res.status(400).json({
        success: false,
        error: 'Endpoint is required'
      });
    }

    await removePushSubscription(userId, endpoint);

    return res.json({
      success: true,
      message: 'Successfully unsubscribed from push notifications'
    });
  } catch (error) {
    console.error('Unsubscribe from push error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to unsubscribe from push notifications'
    });
  }
};

/**
 * Получить подписки пользователя
 */
export const getUserPushSubscriptions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    const subscriptions = await getUserSubscriptions(userId);

    return res.json({
      success: true,
      data: subscriptions
    });
  } catch (error) {
    console.error('Get user subscriptions error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get subscriptions'
    });
  }
};

