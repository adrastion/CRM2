import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { SubscriptionService, PlanType } from '../services/subscriptionService';
import { asyncHandler } from '../middleware/errorHandler';

/**
 * Получить текущую подписку
 */
export const getSubscription = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.tenant?.id) {
    res.status(400).json({
      success: false,
      error: 'Tenant ID is required',
    });
    return;
  }

  const subscription = await SubscriptionService.getSubscription(req.tenant.id);
  const limits = await SubscriptionService.getLimits(req.tenant.id);

  res.json({
    success: true,
    data: {
      subscription,
      limits,
    },
  });
});

/**
 * Создать платеж для подписки
 */
export const createPayment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.tenant?.id) {
    res.status(400).json({
      success: false,
      error: 'Tenant ID is required',
    });
    return;
  }

  const { planType, returnUrl } = req.body;

  if (!planType || !['FREE', 'STARTER', 'BUSINESS', 'PROFESSIONAL', 'ENTERPRISE'].includes(planType)) {
    res.status(400).json({
      success: false,
      error: 'Invalid plan type',
    });
    return;
  }

  const defaultReturnUrl = process.env.CORS_ORIGIN
    ? `${process.env.CORS_ORIGIN}/subscription/success`
    : 'http://localhost:3000/subscription/success';

  const payment = await SubscriptionService.createPayment(
    req.tenant.id,
    planType as PlanType,
    returnUrl || defaultReturnUrl
  );

  res.json({
    success: true,
    data: payment,
  });
});

/**
 * Webhook для обработки уведомлений от YooKassa
 * ВАЖНО: Этот роут не требует аутентификации, но должен быть защищен
 * IP-адресами YooKassa (185.71.76.0/27, 185.71.77.0/27, 77.75.153.0/25, 77.75.156.11, 77.75.156.35, 77.75.154.128/25)
 */
export const handleWebhook = asyncHandler(async (req: Request, res: Response) => {
  try {
    console.log('Webhook received:', {
      method: req.method,
      path: req.path,
      headers: {
        'user-agent': req.headers['user-agent'],
        'x-forwarded-for': req.headers['x-forwarded-for'],
        'x-real-ip': req.headers['x-real-ip'],
      },
      body: req.body
    });

    await SubscriptionService.handleYooKassaWebhook(req.body);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Webhook processing failed',
    });
  }
});

/**
 * Обновить план подписки
 */
export const updatePlan = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.tenant?.id) {
    res.status(400).json({
      success: false,
      error: 'Tenant ID is required',
    });
    return;
  }

  const { planType } = req.body;

  if (!planType || !['FREE', 'STARTER', 'BUSINESS', 'PROFESSIONAL', 'ENTERPRISE'].includes(planType)) {
    res.status(400).json({
      success: false,
      error: 'Invalid plan type',
    });
    return;
  }

  const subscription = await SubscriptionService.updatePlan(req.tenant.id, planType as PlanType);

  res.json({
    success: true,
    data: subscription,
    message: 'Subscription plan updated successfully',
  });
});

/**
 * Проверить доступность ресурса
 */
export const checkResourceLimit = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.tenant?.id) {
    res.status(400).json({
      success: false,
      error: 'Tenant ID is required',
    });
    return;
  }

  const { resource } = req.query;

  if (!resource || typeof resource !== 'string') {
    res.status(400).json({
      success: false,
      error: 'Resource type is required',
    });
    return;
  }

  const allowedResources = ['trainers', 'clients', 'groups', 'branches', 'trainings'];
  if (!allowedResources.includes(resource)) {
    res.status(400).json({
      success: false,
      error: 'Invalid resource type',
    });
    return;
  }

  const hasAccess = await SubscriptionService.checkLimit(
    req.tenant.id,
    resource as keyof import('../services/subscriptionService').PlanLimits
  );
  const limits = await SubscriptionService.getLimits(req.tenant.id);

  res.json({
    success: true,
    data: {
      hasAccess,
      limit: limits[resource as keyof typeof limits],
    },
  });
});

