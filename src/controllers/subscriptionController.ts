import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { SubscriptionService, PlanType } from '../services/subscriptionService';
import { PlanCatalogService } from '../services/planCatalogService';
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

  const { planType, returnUrl, promoCode } = req.body;

  if (!planType || !(await PlanCatalogService.findByCode(String(planType)))) {
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
    returnUrl || defaultReturnUrl,
    promoCode
  );

  res.json({
    success: true,
    data: payment,
  });
});

/**
 * Получить статус использования промокодов для текущего tenant
 */
export const getPromoCodeStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.tenant?.id) {
    res.status(400).json({
      success: false,
      error: 'Tenant ID is required',
    });
    return;
  }

  const hasUsedMarketerPromo = await SubscriptionService.hasUsedMarketerPromoCode(req.tenant.id);
  const hasUsedNonMarketerPromo = await SubscriptionService.hasUsedNonMarketerPromoCode(req.tenant.id);

  res.json({
    success: true,
    data: {
      hasUsedMarketerPromo,
      hasUsedNonMarketerPromo,
      canUseMarketerPromo: !hasUsedMarketerPromo,
      canUseNonMarketerPromo: !hasUsedNonMarketerPromo,
    },
  });
});

/**
 * Валидация промокода для подписки
 */
export const validatePromoCode = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.tenant?.id) {
    res.status(400).json({
      success: false,
      error: 'Tenant ID is required',
    });
    return;
  }

  const { promoCode, planType } = req.body;

  if (!promoCode) {
    res.status(400).json({
      success: false,
      error: 'Promo code is required',
    });
    return;
  }

  if (!planType) {
    res.status(400).json({
      success: false,
      error: 'Invalid plan type',
    });
    return;
  }

  try {
    console.log('validatePromoCode controller called:', { tenantId: req.tenant?.id, promoCode, planType });
    const plan = await PlanCatalogService.findByCode(String(planType));
    if (!plan) {
      res.status(400).json({
        success: false,
        error: 'Тариф не найден',
      });
      return;
    }
    if (plan.price == null) {
      res.status(400).json({
        success: false,
        error: 'Для тарифа с договорной ценой промокод не применим',
      });
      return;
    }
    const planPrice = plan.price;
    console.log('Plan price:', planPrice);
    
    // Проверяем, использовал ли пользователь промокод маркетолога
    const hasUsedMarketerPromo = await SubscriptionService.hasUsedMarketerPromoCode(req.tenant.id);
    console.log('Has used marketer promo:', hasUsedMarketerPromo);
    
    const validatedPromoCode = await SubscriptionService.validatePromoCode(
      req.tenant.id,
      promoCode,
      planPrice
    );
    console.log('Promo code validated successfully:', validatedPromoCode.code);
    
    const discountAmount = SubscriptionService.calculateDiscount(validatedPromoCode, planPrice);
    const finalAmount = Math.max(0, planPrice - discountAmount);
    console.log('Discount calculated:', { discountAmount, finalAmount });

    res.json({
      success: true,
      data: {
        promoCode: validatedPromoCode.code,
        discountAmount,
        originalAmount: planPrice,
        finalAmount,
        discountType: validatedPromoCode.discountType,
        discountValue: Number(validatedPromoCode.discountValue),
        hasUsedMarketerPromo, // Информация для фронтенда
        isMarketerPromo: !!validatedPromoCode.marketerId,
        warning: hasUsedMarketerPromo && !validatedPromoCode.marketerId 
          ? 'Вы уже использовали стартовый промокод маркетолога. Этот промокод можно использовать только один раз.'
          : null,
      },
    });
  } catch (error: any) {
    console.error('Error validating promo code in controller:', error);
    // Проверяем статус использования промокодов для более информативного ответа
    const hasUsedMarketerPromo = await SubscriptionService.hasUsedMarketerPromoCode(req.tenant.id).catch(() => false);
    const hasUsedNonMarketerPromo = await SubscriptionService.hasUsedNonMarketerPromoCode(req.tenant.id).catch(() => false);
    
    res.status(400).json({
      success: false,
      error: error.message || 'Invalid promo code',
      hasUsedMarketerPromo, // Информация для фронтенда
      hasUsedNonMarketerPromo,
      canUseNonMarketerPromo: hasUsedMarketerPromo && !hasUsedNonMarketerPromo, // Можно использовать промокод без маркетолога, если использован промокод маркетолога
    });
  }
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

  if (!planType || !(await PlanCatalogService.findByCode(String(planType)))) {
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
 * Получить информацию о тарифе и использовании ресурсов
 */
export const getPlanUsage = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.tenant?.id) {
    res.status(400).json({
      success: false,
      error: 'Tenant ID is required',
    });
    return;
  }

  const planUsage = await SubscriptionService.getPlanUsage(req.tenant.id);

  res.json({
    success: true,
    data: planUsage,
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

