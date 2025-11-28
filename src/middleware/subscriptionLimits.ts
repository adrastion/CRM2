import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { SubscriptionService } from '../services/subscriptionService';
import { asyncHandler } from './errorHandler';

export type ResourceType = 'trainers' | 'clients' | 'groups' | 'branches' | 'trainings';

/**
 * Middleware to check if tenant has access to create a resource
 */
export const checkSubscriptionLimit = (resource: ResourceType) => {
  return asyncHandler(async (
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> => {
    if (!req.tenant?.id) {
      res.status(400).json({
        success: false,
        error: 'Tenant ID is required',
      });
      return;
    }

    const hasAccess = await SubscriptionService.checkLimit(req.tenant.id, resource);

    if (!hasAccess) {
      const subscription = await SubscriptionService.getSubscription(req.tenant.id);
      const limits = await SubscriptionService.getLimits(req.tenant.id);
      const limit = limits[resource];

      if (!subscription) {
        res.status(500).json({
          success: false,
          error: 'Subscription not found',
        });
        return;
      }

      res.status(403).json({
        success: false,
        error: `Лимит ${resource} превышен для тарифа ${subscription.planType}. Текущий лимит: ${limit === 'unlimited' ? 'безлимит' : limit}`,
        data: {
          limit,
          planType: subscription.planType,
        },
      });
      return;
    }

    next();
  });
};

/**
 * Middleware to check if subscription is active
 */
export const checkSubscriptionActive = asyncHandler(async (
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  if (!req.tenant?.id) {
    res.status(400).json({
      success: false,
      error: 'Tenant ID is required',
    });
    return;
  }

  const subscription = await SubscriptionService.getSubscription(req.tenant.id);

  if (!subscription) {
    res.status(500).json({
      success: false,
      error: 'Subscription not found',
    });
    return;
  }

  if (subscription.status !== 'active') {
    res.status(403).json({
      success: false,
      error: 'Подписка неактивна или истекла. Пожалуйста, обновите подписку для продолжения использования сервиса.',
      data: {
        status: subscription.status,
        planType: subscription.planType,
        endDate: subscription.endDate,
      },
    });
    return;
  }

  next();
});

