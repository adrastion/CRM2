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
      subscription = await prisma.subscription.create({
        data: {
          tenantId,
          planType,
          status: planType === 'FREE' ? 'active' : 'expired',
          startDate: new Date(),
          autoRenew: true,
        },
        include: { payments: true },
      });
    }

    return subscription;
  }

  /**
   * Получение текущей подписки тенанта
   */
  static async getSubscription(tenantId: string) {
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
      // Создаем бесплатную подписку по умолчанию
      return this.getOrCreateSubscription(tenantId, 'FREE');
    }

    // Проверка истечения подписки
    if (subscription.status === 'active' && subscription.endDate && subscription.endDate < new Date()) {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: 'expired' },
      });
      subscription.status = 'expired';
    }

    return subscription;
  }

  /**
   * Создание платежа через YooKassa
   */
  static async createPayment(
    tenantId: string,
    planType: PlanType,
    returnUrl: string
  ) {
    const subscription = await this.getOrCreateSubscription(tenantId);

    const amount = PLAN_PRICES[planType];
    if (amount === 0 && planType !== 'FREE') {
      throw new Error('Enterprise plan requires manual setup');
    }

    if (planType === 'FREE') {
      // Для бесплатного тарифа сразу активируем
      await this.activateSubscription(tenantId, planType);
      return {
        paymentId: null,
        paymentUrl: null,
        status: 'succeeded',
      };
    }

    // Создаем платеж в YooKassa через API
    const paymentData = {
      amount: {
        value: amount.toFixed(2),
        currency: 'RUB',
      },
      confirmation: {
        type: 'redirect',
        return_url: returnUrl,
      },
      description: `Подписка ${planType} для тенанта ${tenantId}`,
      metadata: {
        tenantId,
        planType,
        subscriptionId: subscription.id,
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
        amount: amount,
        currency: 'RUB',
        status: 'pending',
        paymentMethod: 'yookassa',
        yookassaPaymentId: payment.id,
        yookassaPaymentUrl: payment.confirmation?.confirmation_url || null,
        expiresAt: payment.expires_at ? new Date(payment.expires_at) : null,
      },
    });

    return {
      paymentId: subscriptionPayment.id,
      paymentUrl: payment.confirmation?.confirmation_url || null,
      status: 'pending',
    };
  }

  /**
   * Обработка webhook от YooKassa
   */
  static async handleYooKassaWebhook(event: any) {
    const paymentId = event.object?.id;

    if (!paymentId) {
      throw new Error('Payment ID is missing');
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

    const subscriptionPayment = await prisma.subscriptionPayment.findFirst({
      where: { yookassaPaymentId: paymentId },
      include: { subscription: true },
    });

    if (!subscriptionPayment) {
      throw new Error('Subscription payment not found');
    }

    // Обновляем статус платежа
    let status = 'pending';
    if (payment.status === 'succeeded') {
      status = 'succeeded';
    } else if (payment.status === 'canceled') {
      status = 'cancelled';
    } else if (payment.status === 'pending') {
      status = 'pending';
    }

    await prisma.subscriptionPayment.update({
      where: { id: subscriptionPayment.id },
      data: {
        status,
        paidAt: payment.status === 'succeeded' ? new Date() : null,
      },
    });

    // Если платеж успешен, активируем подписку
    if (payment.status === 'succeeded' && payment.metadata?.planType) {
      await this.activateSubscription(
        payment.metadata.tenantId,
        payment.metadata.planType as PlanType,
        subscriptionPayment.subscriptionId
      );
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

    const subscription = subscriptionId
      ? await prisma.subscription.update({
          where: { id: subscriptionId },
          data: {
            planType,
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
            status: 'active',
            startDate,
            endDate,
            autoRenew: true,
          },
          update: {
            planType,
            status: 'active',
            startDate,
            endDate,
            autoRenew: true,
          },
        });

    return subscription;
  }

  /**
   * Проверка лимитов подписки
   */
  static async checkLimit(tenantId: string, resource: keyof PlanLimits): Promise<boolean> {
    const subscription = await this.getSubscription(tenantId);

    if (subscription.status !== 'active') {
      return false;
    }

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
   * Обновление плана подписки
   */
  static async updatePlan(tenantId: string, newPlanType: PlanType) {
    const subscription = await this.getSubscription(tenantId);

    // Если переход на более дорогой план - сразу активируем
    const currentPrice = PLAN_PRICES[subscription.planType as PlanType];
    const newPrice = PLAN_PRICES[newPlanType];

    if (newPrice > currentPrice) {
      // Upgrade - активируем сразу
      return this.activateSubscription(tenantId, newPlanType, subscription.id);
    } else {
      // Downgrade - устанавливаем дату изменения на конец текущего периода
      return prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          planType: newPlanType,
          // План изменится в конце текущего периода
        },
      });
    }
  }
}

