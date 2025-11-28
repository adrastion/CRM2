import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// YooKassa API базовый URL
const YOOKASSA_API_URL = 'https://api.yookassa.ru/v3';

export type PlanType = 'FREE' | 'STARTER' | 'BUSINESS' | 'PROFESSIONAL' | 'ENTERPRISE';

export interface PlanLimits {
  trainers: number | 'unlimited';
  clients: number | 'unlimited';
  groups: number | 'unlimited';
  branches: number | 'unlimited';
  trainings: number | 'unlimited';
}

export const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  FREE: {
    trainers: 1,
    clients: 30,
    groups: 3,
    branches: 1,
    trainings: 10, // в месяц
  },
  STARTER: {
    trainers: 3,
    clients: 90,
    groups: 9,
    branches: 2,
    trainings: 'unlimited',
  },
  BUSINESS: {
    trainers: 10,
    clients: 600,
    groups: 30,
    branches: 5,
    trainings: 'unlimited',
  },
  PROFESSIONAL: {
    trainers: 25,
    clients: 1500,
    groups: 50,
    branches: 10,
    trainings: 'unlimited',
  },
  ENTERPRISE: {
    trainers: 'unlimited',
    clients: 'unlimited',
    groups: 'unlimited',
    branches: 'unlimited',
    trainings: 'unlimited',
  },
};

export const PLAN_PRICES: Record<PlanType, number> = {
  FREE: 0,
  STARTER: 990,
  BUSINESS: 2490,
  PROFESSIONAL: 4990,
  ENTERPRISE: 0, // По запросу
};

export class SubscriptionService {
  /**
   * Проверка, использовал ли tenant промокод маркетолога
   */
  static async hasUsedMarketerPromoCode(tenantId: string): Promise<boolean> {
    // Проверяем использование промокодов маркетолога через subscription payments
    const subscriptionPaymentUsage = await prisma.promoCodeUsage.findFirst({
      where: {
        tenantId,
        promoCode: {
          marketerId: { not: null },
        },
        subscriptionPayment: {
          status: 'succeeded',
        },
      },
    });

    // Проверяем использование промокодов маркетолога через обычные payments
    const paymentUsage = await prisma.promoCodeUsage.findFirst({
      where: {
        tenantId,
        promoCode: {
          marketerId: { not: null },
        },
        payment: {
          status: 'paid',
        },
      },
    });

    return !!(subscriptionPaymentUsage || paymentUsage);
  }

  /**
   * Проверка, использовал ли tenant промокод без маркетолога
   */
  static async hasUsedNonMarketerPromoCode(tenantId: string): Promise<boolean> {
    // Проверяем использование промокодов без маркетолога через subscription payments
    const subscriptionPaymentUsage = await prisma.promoCodeUsage.findFirst({
      where: {
        tenantId,
        promoCode: {
          marketerId: null,
        },
        subscriptionPayment: {
          status: 'succeeded',
        },
      },
    });

    // Проверяем использование промокодов без маркетолога через обычные payments
    const paymentUsage = await prisma.promoCodeUsage.findFirst({
      where: {
        tenantId,
        promoCode: {
          marketerId: null,
        },
        payment: {
          status: 'paid',
        },
      },
    });

    return !!(subscriptionPaymentUsage || paymentUsage);
  }

  /**
   * Валидация промокода для подписки
   */
  static async validatePromoCode(tenantId: string, promoCode: string, planPrice: number) {
    console.log('Validating promo code:', { tenantId, promoCode: promoCode.toUpperCase(), planPrice });
    
    const code = await prisma.promoCode.findFirst({
      where: {
        code: promoCode.toUpperCase(),
        tenantId,
        isActive: true,
      },
      include: {
        marketer: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    console.log('Promo code found:', code ? { id: code.id, code: code.code, usageLimit: code.usageLimit, usedCount: code.usedCount } : 'NOT FOUND');

    if (!code) {
      console.log('Promo code not found or inactive');
      throw new Error('Промокод не найден или неактивен');
    }

    // Проверка срока действия
    const now = new Date();
    if (new Date(code.validFrom) > now) {
      console.log('Promo code not yet valid:', { validFrom: code.validFrom, now });
      throw new Error('Промокод еще не действителен');
    }

    if (code.validUntil && new Date(code.validUntil) < now) {
      console.log('Promo code expired:', { validUntil: code.validUntil, now });
      throw new Error('Промокод истек');
    }

    // Проверка лимита использования
    // Используем фактическое количество использований из PromoCodeUsage для более точной проверки
    // Получаем реальное количество использований из базы данных
    const actualUsageCount = await prisma.promoCodeUsage.count({
      where: {
        promoCodeId: code.id,
      },
    });
    
    console.log('Promo code usage check:', { usageLimit: code.usageLimit, actualUsageCount, usedCount: code.usedCount });
    
    // Проверяем, не превысит ли использование лимит (учитываем, что будет создана новая запись)
    // Если usageLimit = 1, то можно использовать 1 раз (actualUsageCount должен быть 0)
    // Если actualUsageCount уже равен usageLimit, то промокод исчерпан
    if (code.usageLimit !== null && actualUsageCount >= code.usageLimit) {
      console.log('Promo code limit exceeded:', { usageLimit: code.usageLimit, actualUsageCount });
      throw new Error('Промокод исчерпан');
    }

    // Проверка минимальной суммы покупки
    if (code.minPurchase && planPrice < Number(code.minPurchase)) {
      throw new Error(`Минимальная сумма покупки для этого промокода: ${code.minPurchase} руб.`);
    }

    // Проверка использования промокодов маркетолога
    const hasUsedMarketerPromo = await this.hasUsedMarketerPromoCode(tenantId);
    console.log('Marketer promo check:', { hasUsedMarketerPromo, codeMarketerId: code.marketerId });
    
    if (code.marketerId) {
      // Если это промокод маркетолога и уже был использован промокод маркетолога
      if (hasUsedMarketerPromo) {
        console.log('Marketer promo already used');
        throw new Error('Вы уже использовали стартовый промокод маркетолога. Этот промокод недоступен.');
      }
    } else {
      // Если это промокод без маркетолога
      const hasUsedNonMarketerPromo = await this.hasUsedNonMarketerPromoCode(tenantId);
      console.log('Non-marketer promo check:', { hasUsedNonMarketerPromo });
      
      if (hasUsedNonMarketerPromo) {
        console.log('Non-marketer promo already used');
        throw new Error('Вы уже использовали промокод без маркетолога. Доступен только один такой промокод.');
      }
      
      // Если использован промокод маркетолога, разрешаем использовать промокод без маркетолога
      // (это уже проверено выше - если hasUsedNonMarketerPromo = false, то можно использовать)
    }

    console.log('Promo code validation successful:', { code: code.code, discountType: code.discountType, discountValue: code.discountValue });
    return code;
  }

  /**
   * Привязка tenant к маркетологу при использовании промокода
   */
  static async linkTenantToMarketer(tenantId: string, marketerId: string) {
    // Проверяем, не привязан ли уже tenant к маркетологу
    const existingLink = await prisma.tenantMarketer.findUnique({
      where: { tenantId },
    });

    if (existingLink) {
      console.log('Tenant already linked to marketer:', {
        tenantId,
        existingMarketerId: existingLink.marketerId,
        newMarketerId: marketerId,
      });
      return existingLink;
    }

    // Получаем маркетолога для получения процента комиссии
    const marketer = await prisma.marketer.findUnique({
      where: { id: marketerId },
    });

    if (!marketer) {
      throw new Error('Marketer not found');
    }

    // Создаем связь tenant -> marketer
    const tenantMarketer = await prisma.tenantMarketer.create({
      data: {
        tenantId,
        marketerId,
        commissionPercentage: marketer.commissionPercentage,
      },
    });

    console.log('Tenant linked to marketer:', {
      tenantId,
      marketerId,
      commissionPercentage: marketer.commissionPercentage,
    });

    return tenantMarketer;
  }

  /**
   * Начисление комиссии маркетологу за покупку подписки
   */
  static async addCommissionToMarketer(tenantId: string, paymentAmount: number) {
    // Находим связь tenant -> marketer
    const tenantMarketer = await prisma.tenantMarketer.findUnique({
      where: { tenantId },
      include: {
        marketer: true,
      },
    });

    if (!tenantMarketer) {
      console.log('No marketer linked to tenant:', tenantId);
      return null;
    }

    // Рассчитываем комиссию (используем процент из связи, если указан, иначе из маркетолога)
    const commissionPercentage = Number(tenantMarketer.commissionPercentage || tenantMarketer.marketer.commissionPercentage);
    const commissionAmount = (paymentAmount * commissionPercentage) / 100;

    // Начисляем комиссию маркетологу
    const updatedMarketer = await prisma.marketer.update({
      where: { id: tenantMarketer.marketerId },
      data: {
        balance: {
          increment: commissionAmount,
        },
      },
    });

    console.log('Commission added to marketer:', {
      marketerId: tenantMarketer.marketerId,
      tenantId,
      paymentAmount,
      commissionPercentage,
      commissionAmount,
      newBalance: Number(updatedMarketer.balance),
    });

    return {
      marketerId: tenantMarketer.marketerId,
      commissionAmount,
      commissionPercentage,
      newBalance: Number(updatedMarketer.balance),
    };
  }

  /**
   * Расчет скидки по промокоду
   */
  static calculateDiscount(promoCode: any, planPrice: number): number {
    let discount = 0;

    if (promoCode.discountType === 'PERCENTAGE') {
      discount = (planPrice * Number(promoCode.discountValue)) / 100;
      // Применяем максимальную скидку, если указана
      if (promoCode.maxDiscount && discount > Number(promoCode.maxDiscount)) {
        discount = Number(promoCode.maxDiscount);
      }
    } else if (promoCode.discountType === 'FIXED') {
      discount = Number(promoCode.discountValue);
      // Скидка не может быть больше стоимости
      if (discount > planPrice) {
        discount = planPrice;
      }
    }

    return Math.round(discount * 100) / 100; // Округляем до 2 знаков
  }

  /**
   * Получение Basic Auth заголовка для YooKassa API
   */
  private static getAuthHeader(): string {
    const shopId = process.env.YOOKASSA_SHOP_ID;
    const secretKey = process.env.YOOKASSA_SECRET_KEY;

    if (!shopId || !secretKey) {
      throw new Error('YooKassa credentials are not configured');
    }

    const credentials = `${shopId}:${secretKey}`;
    return `Basic ${Buffer.from(credentials).toString('base64')}`;
  }

  /**
   * Создание или получение подписки для тенанта
   */
  static async getOrCreateSubscription(tenantId: string, planType: PlanType = 'FREE') {
    let subscription = await prisma.subscription.findUnique({
      where: { tenantId },
      include: { payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });

    if (!subscription) {
      const startDate = new Date();
      let endDate: Date | null = null;
      
      // Для FREE тарифа устанавливаем дату окончания далеко в будущем
      if (planType === 'FREE') {
        endDate = new Date();
        endDate.setFullYear(endDate.getFullYear() + 100);
      }

      subscription = await prisma.subscription.create({
        data: {
          tenantId,
          planType,
          status: planType === 'FREE' ? 'active' : 'expired',
          startDate,
          endDate,
          autoRenew: true,
        },
        include: { payments: true },
      });
    }

    return subscription;
  }

  /**
   * Получение текущей подписки тенанта
   * Проверяет и применяет отложенные изменения тарифа
   */
  static async getSubscription(tenantId: string) {
    let subscription = await prisma.subscription.findUnique({
      where: { tenantId },
      include: {
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!subscription) {
      // Создаем бесплатную подписку по умолчанию
      subscription = await this.getOrCreateSubscription(tenantId, 'FREE');
    }

    // Применяем отложенное изменение тарифа, если нужно
    const updatedSubscription = await this.applyPendingPlanChange(tenantId);
    if (updatedSubscription) {
      subscription = { ...subscription, ...updatedSubscription };
    }

    // Проверка истечения подписки и применение отложенного изменения тарифа
    if (subscription && subscription.status === 'active' && subscription.endDate && subscription.endDate < new Date()) {
      // Если есть отложенное изменение тарифа, применяем его
      if (subscription.nextPlanType) {
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            planType: subscription.nextPlanType,
            nextPlanType: null,
            status: 'expired',
          },
        });
        subscription.planType = subscription.nextPlanType;
        subscription.nextPlanType = null;
        subscription.status = 'expired';
      } else {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: 'expired' },
      });
      subscription.status = 'expired';
      }
    }

    return subscription;
  }

  /**
   * Создание платежа через YooKassa
   */
  static async createPayment(
    tenantId: string,
    planType: PlanType,
    returnUrl: string,
    promoCode?: string
  ) {
    const subscription = await this.getOrCreateSubscription(tenantId);

    let amount = PLAN_PRICES[planType];
    if (amount === 0 && planType !== 'FREE') {
      throw new Error('Enterprise plan requires manual setup');
    }

    let validatedPromoCode = null;
    let discountAmount = 0;

    // Валидация и применение промокода, если указан
    if (promoCode) {
      try {
        validatedPromoCode = await this.validatePromoCode(tenantId, promoCode, amount);
        discountAmount = this.calculateDiscount(validatedPromoCode, amount);
        amount = Math.max(0, amount - discountAmount); // Итоговая сумма не может быть отрицательной
      } catch (error: any) {
        throw new Error(`Ошибка применения промокода: ${error.message}`);
      }
    }

    // Если итоговая стоимость 0 (бесплатный тариф или промокод на 100%), сразу активируем подписку
    if (amount === 0) {
      // Активируем подписку
      const activatedSubscription = await this.activateSubscription(tenantId, planType, subscription.id);

      // Сохраняем использование промокода, если был применен
      if (validatedPromoCode) {
        // Создаем запись о платеже для отслеживания использования промокода
        const subscriptionPayment = await prisma.subscriptionPayment.create({
          data: {
            subscriptionId: subscription.id,
            amount: PLAN_PRICES[planType], // Оригинальная сумма
            currency: 'RUB',
            status: 'succeeded',
            paymentMethod: 'promo_code',
            paidAt: new Date(),
          },
        });

        // Сохраняем использование промокода
        await prisma.promoCodeUsage.create({
          data: {
            promoCodeId: validatedPromoCode.id,
            subscriptionPaymentId: subscriptionPayment.id,
            discountAmount: discountAmount,
            tenantId: tenantId,
          },
        });

        // Увеличиваем счетчик использования промокода (для бесплатных подписок через промокод)
        await prisma.promoCode.update({
          where: { id: validatedPromoCode.id },
          data: { usedCount: { increment: 1 } },
        });

        // Если это промокод маркетолога, создаем связь tenant -> marketer
        if (validatedPromoCode.marketerId) {
          await this.linkTenantToMarketer(tenantId, validatedPromoCode.marketerId);
          
          // Начисляем комиссию маркетологу за бесплатную подписку через промокод
          const originalAmount = PLAN_PRICES[planType];
          await this.addCommissionToMarketer(tenantId, originalAmount);
        }
        
        console.log('Promo code applied for free subscription:', {
          promoCodeId: validatedPromoCode.id,
          code: validatedPromoCode.code,
          discountAmount,
          subscriptionId: subscription.id,
          marketerId: validatedPromoCode.marketerId
        });
      }

      return {
        paymentId: null,
        paymentUrl: null,
        status: 'succeeded',
        promoCodeApplied: !!validatedPromoCode,
        discountAmount: discountAmount,
        originalAmount: PLAN_PRICES[planType],
        finalAmount: 0,
      };
    }

    // Получаем данные tenant'а для чека
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        email: true,
        phone: true,
        name: true,
      },
    });

    // Формируем объект customer для чека (обязательно должен быть email или phone)
    const customer: any = {};
    if (tenant?.email) {
      customer.email = tenant.email;
    }
    if (tenant?.phone) {
      customer.phone = tenant.phone;
    }

    // Создаем платеж в YooKassa через API
    const paymentData: any = {
      amount: {
        value: amount.toFixed(2),
        currency: 'RUB',
      },
      confirmation: {
        type: 'redirect',
        return_url: returnUrl,
      },
      description: `Подписка ${planType} для тенанта ${tenantId}${validatedPromoCode ? ` (промокод: ${validatedPromoCode.code})` : ''}`,
      metadata: {
        tenantId,
        planType,
        subscriptionId: subscription.id,
        originalAmount: PLAN_PRICES[planType].toString(),
        discountAmount: discountAmount.toString(),
        ...(validatedPromoCode && {
          promoCodeId: validatedPromoCode.id,
          promoCode: validatedPromoCode.code,
          marketerId: validatedPromoCode.marketerId || '',
        }),
      },
      receipt: {
        customer: Object.keys(customer).length > 0 ? customer : { email: 'noreply@example.com' }, // Минимальные данные, если нет email/phone
        items: [
          {
            description: `Подписка ${planType}${validatedPromoCode ? ` (промокод: ${validatedPromoCode.code})` : ''}`,
            quantity: '1.00',
            amount: {
              value: amount.toFixed(2),
              currency: 'RUB',
            },
            vat_code: 1, // НДС не облагается (для услуг)
            payment_subject: 'service', // Предмет расчета: service (услуга)
            payment_mode: 'full_prepayment', // Способ расчета: full_prepayment (полная предоплата)
          },
        ],
      },
    };

    const response = await fetch(`${YOOKASSA_API_URL}/payments`, {
      method: 'POST',
      headers: {
        'Authorization': this.getAuthHeader(),
        'Content-Type': 'application/json',
        'Idempotence-Key': `${subscription.id}-${Date.now()}`, // Уникальный ключ для идемпотентности
      },
      body: JSON.stringify(paymentData),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`YooKassa API error: ${error}`);
    }

    const payment: any = await response.json();

    // Сохраняем платеж в БД
    const subscriptionPayment = await prisma.subscriptionPayment.create({
      data: {
        subscriptionId: subscription.id,
        amount: amount, // Итоговая сумма после скидки
        currency: 'RUB',
        status: 'pending',
        paymentMethod: 'yookassa',
        yookassaPaymentId: payment.id,
        yookassaPaymentUrl: payment.confirmation?.confirmation_url || null,
        expiresAt: payment.expires_at ? new Date(payment.expires_at) : null,
      },
    });

    // НЕ создаем PromoCodeUsage и НЕ связываем tenant с marketer здесь
    // Это будет сделано только после успешной оплаты через webhook
    // Информация о промокоде уже сохранена в metadata платежа YooKassa

    return {
      paymentId: subscriptionPayment.id,
      paymentUrl: payment.confirmation?.confirmation_url || null,
      status: 'pending',
      promoCodeApplied: !!validatedPromoCode,
      discountAmount: discountAmount,
      originalAmount: PLAN_PRICES[planType],
      finalAmount: amount,
    };
  }

  /**
   * Обработка webhook от YooKassa
   */
  static async handleYooKassaWebhook(event: any) {
    console.log('Received YooKassa webhook:', JSON.stringify(event, null, 2));

    // YooKassa отправляет webhook в формате:
    // { type: "notification", event: "payment.succeeded", object: { id: "...", status: "...", ... } }
    // Или может прийти напрямую объект платежа
    const paymentId = event.object?.id || event.id;
    const eventType = event.event || event.type;
    const paymentStatus = event.object?.status || event.status;

    if (!paymentId) {
      console.error('Payment ID is missing in webhook:', event);
      throw new Error('Payment ID is missing');
    }

    console.log('Processing YooKassa webhook:', {
      paymentId,
      eventType,
      paymentStatus,
      hasObject: !!event.object
    });

    // Обрабатываем только события об изменении статуса платежа
    if (eventType && !eventType.includes('payment')) {
      console.log('Ignoring non-payment event:', eventType);
      return { success: true, message: 'Non-payment event ignored' };
    }

    // Получаем информацию о платеже из YooKassa
    const response = await fetch(`${YOOKASSA_API_URL}/payments/${paymentId}`, {
      method: 'GET',
      headers: {
        'Authorization': this.getAuthHeader(),
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`YooKassa API error: ${error}`);
    }

    const payment: any = await response.json();
    console.log('Payment data from YooKassa API:', {
      id: payment.id,
      status: payment.status,
      amount: payment.amount,
      metadata: payment.metadata,
      paid: payment.paid
    });

    const subscriptionPayment = await prisma.subscriptionPayment.findFirst({
      where: { yookassaPaymentId: paymentId },
      include: { 
        subscription: true,
      },
    });

    if (!subscriptionPayment) {
      console.error('Subscription payment not found for YooKassa payment:', paymentId);
      throw new Error('Subscription payment not found');
    }

    console.log('Found subscription payment:', {
      id: subscriptionPayment.id,
      subscriptionId: subscriptionPayment.subscriptionId,
      currentStatus: subscriptionPayment.status,
      subscriptionPlan: subscriptionPayment.subscription.planType,
      subscriptionStatus: subscriptionPayment.subscription.status
    });

    // Определяем статус платежа
    // YooKassa может вернуть статус: pending, waiting_for_capture, succeeded, canceled
    // Также проверяем поле paid для надежности
    const isPaymentSucceeded = payment.status === 'succeeded' || payment.paid === true;
    let status = 'pending';
    if (isPaymentSucceeded) {
      status = 'succeeded';
    } else if (payment.status === 'canceled' || payment.status === 'cancelled') {
      status = 'cancelled';
    } else if (payment.status === 'pending' || payment.status === 'waiting_for_capture') {
      status = 'pending';
    }

    console.log('Determined payment status:', {
      yookassaStatus: payment.status,
      yookassaPaid: payment.paid,
      isPaymentSucceeded,
      ourStatus: status
    });

    // Проверяем, не был ли платеж уже обработан
    const wasAlreadyProcessed = subscriptionPayment.status === 'succeeded' && isPaymentSucceeded;

    await prisma.subscriptionPayment.update({
      where: { id: subscriptionPayment.id },
      data: {
        status,
        paidAt: isPaymentSucceeded ? new Date() : null,
      },
    });

    // Если платеж уже был обработан ранее, не активируем подписку повторно
    if (wasAlreadyProcessed) {
      console.log('Payment was already processed, skipping subscription activation');
      return { success: true, message: 'Payment already processed' };
    }

    // Если платеж успешен, активируем подписку
    if (isPaymentSucceeded) {
      // Получаем план из metadata платежа или из существующей подписки
      const planType = payment.metadata?.planType || subscriptionPayment.subscription.planType;
      const tenantId = payment.metadata?.tenantId || subscriptionPayment.subscription.tenantId;
      
      console.log('Activating subscription:', {
        tenantId,
        planType,
        subscriptionId: subscriptionPayment.subscriptionId,
        paymentMetadata: payment.metadata
      });
      
      // Обрабатываем промокод только при успешной оплате
      const promoCodeId = payment.metadata?.promoCodeId;
      const marketerId = payment.metadata?.marketerId;
      const discountAmount = payment.metadata?.discountAmount 
        ? parseFloat(payment.metadata.discountAmount) 
        : 0;

      if (promoCodeId) {
        // Создаем запись об использовании промокода только после успешной оплаты
        await prisma.promoCodeUsage.create({
          data: {
            promoCodeId: promoCodeId,
            subscriptionPaymentId: subscriptionPayment.id,
            discountAmount: discountAmount,
            tenantId: tenantId,
          },
        });

        // Увеличиваем счетчик использования промокода
        const promoCode = await prisma.promoCode.findUnique({
          where: { id: promoCodeId },
        });

        if (promoCode) {
          await prisma.promoCode.update({
            where: { id: promoCodeId },
            data: { usedCount: { increment: 1 } },
          });
          console.log('Promo code usage count incremented:', {
            promoCodeId: promoCode.id,
            code: promoCode.code,
            newCount: promoCode.usedCount + 1
          });
        }

        // Если это промокод маркетолога, создаем связь tenant -> marketer только после успешной оплаты
        if (marketerId) {
          await this.linkTenantToMarketer(tenantId, marketerId);
        }
      }
      
      if (planType && tenantId) {
        try {
          const updatedSubscription = await this.activateSubscription(
            tenantId,
            planType as PlanType,
        subscriptionPayment.subscriptionId
      );
          console.log('Subscription activated successfully:', updatedSubscription);

          // Начисляем комиссию маркетологу за успешную оплату подписки
          // Используем оригинальную сумму из metadata
          const originalAmount = payment.metadata?.originalAmount 
            ? parseFloat(payment.metadata.originalAmount) 
            : Number(subscriptionPayment.amount);
          
          await this.addCommissionToMarketer(tenantId, originalAmount);
        } catch (error) {
          console.error('Error activating subscription:', error);
          throw error;
        }
      } else {
        console.error('Missing planType or tenantId in webhook:', {
          paymentMetadata: payment.metadata,
          subscription: subscriptionPayment.subscription
        });
        throw new Error('Missing planType or tenantId for subscription activation');
      }
    }

    return { success: true };
  }

  /**
   * Активация подписки
   */
  static async activateSubscription(
    tenantId: string,
    planType: PlanType,
    subscriptionId?: string
  ) {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1); // Подписка на 1 месяц

    console.log('Activating subscription with params:', {
      tenantId,
      planType,
      subscriptionId,
      startDate,
      endDate
    });

    const subscription = subscriptionId
      ? await prisma.subscription.update({
          where: { id: subscriptionId },
          data: {
            planType,
            nextPlanType: null, // Очищаем отложенное изменение при активации нового тарифа
            status: 'active',
            startDate,
            endDate,
            autoRenew: true,
          },
        })
      : await prisma.subscription.upsert({
          where: { tenantId },
          create: {
            tenantId,
            planType,
            nextPlanType: null,
            status: 'active',
            startDate,
            endDate,
            autoRenew: true,
          },
          update: {
            planType,
            nextPlanType: null, // Очищаем отложенное изменение при активации нового тарифа
            status: 'active',
            startDate,
            endDate,
            autoRenew: true,
          },
        });

    console.log('Subscription activated:', {
      id: subscription.id,
      tenantId: subscription.tenantId,
      planType: subscription.planType,
      status: subscription.status,
      startDate: subscription.startDate,
      endDate: subscription.endDate
        });

    return subscription;
  }

  /**
   * Проверка лимитов подписки
   * Возвращает true, если можно создать ресурс, false - если лимит превышен
   */
  static async checkLimit(tenantId: string, resource: keyof PlanLimits): Promise<boolean> {
    const subscription = await this.getSubscription(tenantId);

    if (!subscription || subscription.status !== 'active') {
      return false;
    }

    // Используем текущий план (не nextPlanType), так как лимиты применяются к текущему тарифу
    const limits = PLAN_LIMITS[subscription.planType as PlanType];
    const limit = limits[resource];

    if (limit === 'unlimited') {
      return true;
    }

    // Подсчет текущего использования
    let currentUsage = 0;

    switch (resource) {
      case 'trainers':
        currentUsage = await prisma.trainer.count({
          where: { tenantId, isActive: true },
        });
        break;
      case 'clients':
        currentUsage = await prisma.client.count({
          where: { tenantId, isActive: true },
        });
        break;
      case 'groups':
        currentUsage = await prisma.group.count({
          where: { tenantId, isActive: true },
        });
        break;
      case 'branches':
        currentUsage = await prisma.branch.count({
          where: { tenantId, isActive: true },
        });
        break;
      case 'trainings':
        // Для тренировок считаем за текущий месяц
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        currentUsage = await prisma.training.count({
          where: {
            tenantId,
            startTime: { gte: startOfMonth },
            isCancelled: false,
          },
        });
        break;
    }

    return currentUsage < limit;
  }

  /**
   * Получение лимитов для тенанта
   */
  static async getLimits(tenantId: string): Promise<PlanLimits> {
    const subscription = await this.getSubscription(tenantId);
    return PLAN_LIMITS[subscription.planType as PlanType];
  }

  /**
   * Получение информации о тарифе и использовании ресурсов
   */
  static async getPlanUsage(tenantId: string) {
    const subscription = await this.getSubscription(tenantId);
    const limits = PLAN_LIMITS[subscription.planType as PlanType];

    // Подсчитываем текущее использование ресурсов
    const [trainersCount, clientsCount, groupsCount, branchesCount, trainingsCount] = await Promise.all([
      prisma.trainer.count({
        where: { tenantId, isActive: true },
      }),
      prisma.client.count({
        where: { tenantId, isActive: true },
      }),
      prisma.group.count({
        where: { tenantId, isActive: true },
      }),
      prisma.branch.count({
        where: { tenantId, isActive: true },
      }),
      // Для тренировок считаем за текущий месяц
      (async () => {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        return prisma.training.count({
          where: {
            tenantId,
            startTime: {
              gte: startOfMonth,
              lte: endOfMonth,
            },
          },
        });
      })(),
    ]);

    // Вычисляем оставшиеся ресурсы
    const calculateRemaining = (limit: number | 'unlimited', used: number): number | 'unlimited' => {
      if (limit === 'unlimited') {
        return 'unlimited';
      }
      return Math.max(0, limit - used);
    };

    const calculateUsagePercent = (limit: number | 'unlimited', used: number): number => {
      if (limit === 'unlimited') {
        return 0; // Для безлимитных ресурсов процент не имеет смысла
      }
      return Math.min(100, Math.round((used / limit) * 100));
    };

    return {
      subscription: {
        planType: subscription.planType,
        status: subscription.status,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        nextPlanType: subscription.nextPlanType,
      },
      limits: {
        trainers: limits.trainers,
        clients: limits.clients,
        groups: limits.groups,
        branches: limits.branches,
        trainings: limits.trainings,
      },
      usage: {
        trainers: trainersCount,
        clients: clientsCount,
        groups: groupsCount,
        branches: branchesCount,
        trainings: trainingsCount,
      },
      remaining: {
        trainers: calculateRemaining(limits.trainers, trainersCount),
        clients: calculateRemaining(limits.clients, clientsCount),
        groups: calculateRemaining(limits.groups, groupsCount),
        branches: calculateRemaining(limits.branches, branchesCount),
        trainings: calculateRemaining(limits.trainings, trainingsCount),
      },
      usagePercent: {
        trainers: calculateUsagePercent(limits.trainers, trainersCount),
        clients: calculateUsagePercent(limits.clients, clientsCount),
        groups: calculateUsagePercent(limits.groups, groupsCount),
        branches: calculateUsagePercent(limits.branches, branchesCount),
        trainings: calculateUsagePercent(limits.trainings, trainingsCount),
      },
    };
  }

  /**
   * Деактивация лишних ресурсов при переходе на меньший тариф
   */
  static async deactivateExcessResources(tenantId: string, oldPlanType: PlanType, newPlanType: PlanType) {
    const oldLimits = PLAN_LIMITS[oldPlanType];
    const newLimits = PLAN_LIMITS[newPlanType];

    console.log('Checking for excess resources after downgrade:', {
      tenantId,
      from: oldPlanType,
      to: newPlanType,
      oldLimits,
      newLimits,
    });

    // Проверяем каждый тип ресурса
    const resources: Array<{ type: keyof PlanLimits; model: any; where: any }> = [
      {
        type: 'trainers',
        model: prisma.trainer,
        where: { tenantId, isActive: true },
      },
      {
        type: 'clients',
        model: prisma.client,
        where: { tenantId, isActive: true },
      },
      {
        type: 'groups',
        model: prisma.group,
        where: { tenantId, isActive: true },
      },
      {
        type: 'branches',
        model: prisma.branch,
        where: { tenantId, isActive: true },
      },
    ];

    for (const resource of resources) {
      const oldLimit = oldLimits[resource.type];
      const newLimit = newLimits[resource.type];

      // Пропускаем, если новый лимит безлимитный или больше старого
      if (newLimit === 'unlimited' || (typeof oldLimit === 'number' && typeof newLimit === 'number' && newLimit >= oldLimit)) {
        continue;
      }

      // Если новый лимит - число, проверяем превышение
      if (typeof newLimit === 'number') {
        const currentCount = await resource.model.count({
          where: resource.where,
        });

        if (currentCount > newLimit) {
          const excessCount = currentCount - newLimit;
          console.log(`Deactivating ${excessCount} excess ${resource.type}:`, {
            currentCount,
            newLimit,
            excessCount,
          });

          // Получаем ресурсы, отсортированные по дате создания (старые первыми)
          const resourcesToDeactivate = await resource.model.findMany({
            where: resource.where,
            orderBy: { createdAt: 'asc' },
            take: excessCount,
            select: { id: true },
          });

          // Деактивируем лишние ресурсы
          if (resourcesToDeactivate.length > 0) {
            await resource.model.updateMany({
              where: {
                id: { in: resourcesToDeactivate.map((r: any) => r.id) },
              },
              data: { isActive: false },
            });

            console.log(`Deactivated ${resourcesToDeactivate.length} ${resource.type} resources`);
          }
        }
      }
    }

    // Для тренировок - деактивируем только будущие тренировки, превышающие лимит
    const oldTrainingLimit = oldLimits.trainings;
    const newTrainingLimit = newLimits.trainings;

    if (newTrainingLimit !== 'unlimited' && typeof newTrainingLimit === 'number') {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const currentMonthCount = await prisma.training.count({
        where: {
          tenantId,
          startTime: { gte: startOfMonth },
          isCancelled: false,
        },
      });

      if (currentMonthCount > newTrainingLimit) {
        // Для тренировок отменяем будущие тренировки, превышающие лимит
        const futureTrainings = await prisma.training.findMany({
          where: {
            tenantId,
            startTime: { gte: new Date() },
            isCancelled: false,
          },
          orderBy: { startTime: 'asc' },
          take: currentMonthCount - newTrainingLimit,
          select: { id: true },
        });

        if (futureTrainings.length > 0) {
          await prisma.training.updateMany({
            where: {
              id: { in: futureTrainings.map((t) => t.id) },
            },
            data: { isCancelled: true },
          });

          console.log(`Cancelled ${futureTrainings.length} future trainings`);
        }
      }
    }
  }

  /**
   * Обновление плана подписки
   * При переходе на более дорогой план - активируется сразу
   * При переходе на более дешевый план - активируется после окончания текущего периода
   */
  static async updatePlan(tenantId: string, newPlanType: PlanType) {
    const subscription = await this.getSubscription(tenantId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    // Если переход на более дорогой план - сразу активируем
    const currentPrice = PLAN_PRICES[subscription.planType as PlanType];
    const newPrice = PLAN_PRICES[newPlanType];

    if (newPrice > currentPrice) {
      // Upgrade - активируем сразу (лимиты увеличиваются, ничего не деактивируем)
      console.log('Upgrading subscription immediately:', {
        tenantId,
        from: subscription.planType,
        to: newPlanType
      });
      return this.activateSubscription(tenantId, newPlanType, subscription.id);
    } else if (newPrice < currentPrice) {
      // Downgrade - устанавливаем nextPlanType, план изменится после окончания текущего периода
      console.log('Scheduling subscription downgrade:', {
        tenantId,
        from: subscription.planType,
        to: newPlanType,
        endDate: subscription.endDate
      });
      return prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          nextPlanType: newPlanType,
          // План изменится в конце текущего периода, тогда деактивируем лишние ресурсы
        },
      });
    } else {
      // Переход на тариф с той же ценой - применяем сразу и деактивируем лишние ресурсы
      console.log('Changing to plan with same price, applying immediately:', {
        tenantId,
        from: subscription.planType,
        to: newPlanType
      });

      // Деактивируем лишние ресурсы перед изменением тарифа
      await this.deactivateExcessResources(
        tenantId,
        subscription.planType as PlanType,
        newPlanType
      );

      return this.activateSubscription(tenantId, newPlanType, subscription.id);
    }
    // Если тарифы одинаковые - просто возвращаем текущую подписку
    return subscription;
  }

  /**
   * Применение отложенного изменения тарифа (если есть nextPlanType)
   * ВАЖНО: Этот метод не должен вызывать getSubscription, чтобы избежать рекурсии
   */
  static async applyPendingPlanChange(tenantId: string) {
    const subscription = await prisma.subscription.findUnique({
      where: { tenantId },
      include: {
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
    
    if (!subscription) {
      return null;
    }
    
    // Если есть отложенное изменение тарифа и текущий период истек
    if (subscription.nextPlanType && subscription.endDate && new Date() >= new Date(subscription.endDate)) {
      console.log('Applying pending plan change:', {
        tenantId,
        from: subscription.planType,
        to: subscription.nextPlanType,
        endDate: subscription.endDate
      });

      // Деактивируем лишние ресурсы при переходе на меньший тариф
      await this.deactivateExcessResources(
        tenantId,
        subscription.planType as PlanType,
        subscription.nextPlanType as PlanType
      );
      
      return await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          planType: subscription.nextPlanType,
          nextPlanType: null,
        },
        include: {
          payments: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
      });
    }
    
    return subscription;
  }
}

