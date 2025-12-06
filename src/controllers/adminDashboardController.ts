import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { asyncHandler } from '../middleware/errorHandler';
import { PLAN_PRICES } from '../services/subscriptionService';

const prisma = new PrismaClient();

/**
 * Получение статистики по всем tenant'ам
 * Доступно только для суперадмина (проверка через специальный middleware)
 */
export const getAdminDashboard = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  // Получаем всех tenant'ов с их подписками
  const tenants = await prisma.tenant.findMany({
    include: {
      subscription: true,
      referredBy: {
        include: {
          marketer: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  // Статистика по тарифам
  const planStats: Record<string, number> = {
    FREE: 0,
    STARTER: 0,
    BUSINESS: 0,
    PROFESSIONAL: 0,
    ENTERPRISE: 0,
  };

  // Активные подписки
  const activeSubscriptions = tenants.filter(t => 
    t.subscription && t.subscription.status === 'active'
  );

  activeSubscriptions.forEach(t => {
    if (t.subscription) {
      const planType = t.subscription.planType as keyof typeof planStats;
      if (planStats[planType] !== undefined) {
        planStats[planType]++;
      }
    }
  });

  // Получаем все успешные платежи за подписки
  const successfulPayments = await prisma.subscriptionPayment.findMany({
    where: {
      status: 'succeeded',
    },
    include: {
      subscription: {
        include: {
          tenant: true,
        },
      },
      promoCodeUsage: {
        include: {
          promoCode: true,
        },
      },
    },
    orderBy: {
      paidAt: 'desc',
    },
  });

  // Общая сумма заработанных денег (с учетом скидок - используем фактическую сумму платежа)
  const totalRevenue = successfulPayments.reduce((sum, payment) => {
    return sum + Number(payment.amount);
  }, 0);

  // Получаем всех маркетологов с их балансами
  const marketers = await prisma.marketer.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      balance: true,
      commissionPercentage: true,
      _count: {
        select: {
          referredTenants: true,
        },
      },
    },
    orderBy: {
      balance: 'desc',
    },
  });

  // Общая сумма невыплаченного маркетологам
  const totalUnpaidMarketers = marketers.reduce((sum, marketer) => {
    return sum + Number(marketer.balance);
  }, 0);

  // Получаем все расходы (транзакции типа 'expense')
  const expenses = await (prisma as any).adminTransaction.findMany({
    where: {
      type: 'expense',
    },
    select: {
      amount: true,
    },
  });

  // Общая сумма всех расходов
  const totalExpenses = expenses.reduce((sum: number, expense: any) => {
    return sum + Number(expense.amount);
  }, 0);

  // Получаем все выплаты маркетологам (транзакции типа 'marketer_payment')
  const marketerPayments = await (prisma as any).adminTransaction.findMany({
    where: {
      type: 'marketer_payment',
    },
    select: {
      amount: true,
    },
  });

  // Общая сумма всех выплат маркетологам
  const totalMarketerPayments = marketerPayments.reduce((sum: number, payment: any) => {
    return sum + Number(payment.amount);
  }, 0);

  // Получаем настройки суперадмина
  let adminSettings = await (prisma as any).superAdminSettings.findFirst();
  if (!adminSettings) {
    adminSettings = await (prisma as any).superAdminSettings.create({
      data: {},
    });
  }

  // Рассчитываем резерв
  let reserveAmount = 0;
  if (adminSettings.reserveAmount !== null) {
    reserveAmount = Number(adminSettings.reserveAmount);
  } else if (adminSettings.reservePercentage !== null) {
    reserveAmount = (totalRevenue * Number(adminSettings.reservePercentage)) / 100;
  }

  // Доступный бюджет (общая выручка - резерв - невыплаченное маркетологам - все расходы - все выплаты маркетологам)
  const availableBudget = totalRevenue - reserveAmount - totalUnpaidMarketers - totalExpenses - totalMarketerPayments;

  // Проверяем, достаточно ли средств
  const hasInsufficientFunds = availableBudget < 0;

  // Получаем подписки, которые скоро истекают (в течение 30 дней)
  const soonExpiringDate = new Date();
  soonExpiringDate.setDate(soonExpiringDate.getDate() + 30);

  const soonExpiring = tenants
    .filter(t => 
      t.subscription && 
      t.subscription.status === 'active' &&
      t.subscription.endDate &&
      t.subscription.endDate > new Date() &&
      t.subscription.endDate <= soonExpiringDate
    )
    .map(t => ({
      id: t.id,
      name: t.name,
      email: t.email,
      planType: t.subscription!.planType,
      endDate: t.subscription!.endDate!.toISOString(),
      daysUntilExpiry: Math.ceil((t.subscription!.endDate!.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)),
    }));

  // Получаем истекшие подписки
  const expired = tenants
    .filter(t => 
      t.subscription && 
      t.subscription.status === 'expired' &&
      t.subscription.endDate &&
      t.subscription.endDate < new Date()
    )
    .map(t => ({
      id: t.id,
      name: t.name,
      email: t.email,
      planType: t.subscription!.planType,
      endDate: t.subscription!.endDate!.toISOString(),
    }));

  // Последние платежи (первые 10)
  const recentPayments = successfulPayments.slice(0, 10).map(payment => {
    const planType = payment.subscription.planType as keyof typeof PLAN_PRICES;
    const originalPrice = PLAN_PRICES[planType] || Number(payment.amount);
    const discountAmount = payment.promoCodeUsage ? Number(payment.promoCodeUsage.discountAmount) : 0;
    
    // Если есть промокод, фактически оплаченная сумма = оригинальная цена - скидка
    // Если промокод на 100%, то фактически оплаченная сумма = 0
    // Но в БД может быть сохранена оригинальная цена в payment.amount (для промокодов на 100%)
    const actualAmount = payment.promoCodeUsage 
      ? Math.max(0, originalPrice - discountAmount)
      : Number(payment.amount);
    
    return {
      id: payment.id,
      tenantName: payment.subscription.tenant.name,
      amount: actualAmount, // Фактически оплаченная сумма
      originalAmount: originalPrice, // Оригинальная цена тарифа
      discountAmount: discountAmount,
      planType: payment.subscription.planType,
      paidAt: payment.paidAt?.toISOString() || payment.createdAt.toISOString(),
      hasDiscount: !!payment.promoCodeUsage,
    };
  });

  res.json({
    success: true,
    data: {
      tenants: {
        total: tenants.length,
        active: activeSubscriptions.length,
        expired: expired.length,
        soonExpiring: soonExpiring.length,
      },
      subscriptions: {
        byPlan: planStats,
        soonExpiring,
        expired,
      },
      revenue: {
        total: totalRevenue,
        currency: 'RUB',
      },
      marketers: {
        total: marketers.length,
        totalUnpaid: totalUnpaidMarketers,
        list: marketers.map(m => ({
          id: m.id,
          name: m.name,
          email: m.email,
          balance: Number(m.balance),
          commissionPercentage: Number(m.commissionPercentage),
          referredClientsCount: m._count.referredTenants,
        })),
      },
      budget: {
        totalRevenue,
        reserveAmount,
        totalUnpaidMarketers,
        totalExpenses,
        totalMarketerPayments,
        availableBudget,
        hasInsufficientFunds,
        settings: {
          reservePercentage: adminSettings.reservePercentage ? Number(adminSettings.reservePercentage) : null,
          reserveAmount: adminSettings.reserveAmount ? Number(adminSettings.reserveAmount) : null,
        },
      },
      recentPayments,
    },
  });
});

/**
 * Обновление настроек суперадмина
 */
export const updateAdminSettings = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const { reservePercentage, reserveAmount } = req.body;

  let settings = await (prisma as any).superAdminSettings.findFirst();
  
  if (!settings) {
    settings = await (prisma as any).superAdminSettings.create({
      data: {
        reservePercentage: reservePercentage ? parseFloat(reservePercentage) : null,
        reserveAmount: reserveAmount ? parseFloat(reserveAmount) : null,
      },
    });
  } else {
    settings = await (prisma as any).superAdminSettings.update({
      where: { id: settings.id },
      data: {
        reservePercentage: reservePercentage !== undefined ? (reservePercentage ? parseFloat(reservePercentage) : null) : undefined,
        reserveAmount: reserveAmount !== undefined ? (reserveAmount ? parseFloat(reserveAmount) : null) : undefined,
      },
    });
  }

  res.json({
    success: true,
    data: {
      reservePercentage: settings.reservePercentage ? Number(settings.reservePercentage) : null,
      reserveAmount: settings.reserveAmount ? Number(settings.reserveAmount) : null,
    },
  });
});

/**
 * Получение детальной информации о tenant'е
 */
export const getTenantDetails = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const { tenantId } = req.params;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      subscription: {
        include: {
          payments: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
      },
      referredBy: {
        include: {
          marketer: true,
        },
      },
      _count: {
        select: {
          users: true,
          clients: true,
          trainers: true,
          groups: true,
          branches: true,
        },
      },
    },
  });

  if (!tenant) {
    res.status(404).json({
      success: false,
      error: 'Tenant not found',
    });
    return;
  }

  res.json({
    success: true,
    data: tenant,
  });
});

/**
 * Получение всех аккаунтов с детальной статистикой
 */
export const getAllTenants = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const tenants = await prisma.tenant.findMany({
    include: {
      subscription: true,
      _count: {
        select: {
          users: {
            where: {
              role: { in: ['OWNER', 'ADMIN'] },
            },
          },
          trainers: true,
          branches: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  // Получаем количество клиентов для каждого tenant'а
  // Исключаем клиентов, которые являются родителями (если родители создаются как клиенты)
  const tenantsWithStats = await Promise.all(tenants.map(async (tenant) => {
    // Получаем всех родителей tenant'а
    const parents = await prisma.parent.findMany({
      where: {
        tenantId: tenant.id,
      },
      select: {
        id: true,
      },
    });

    const parentIds = parents.map(p => p.id);

    // Получаем количество клиентов, исключая родителей
    const clientsCount = await prisma.client.count({
      where: {
        tenantId: tenant.id,
        NOT: {
          id: { in: parentIds },
        },
      },
    });

    return {
      id: tenant.id,
      name: tenant.name,
      email: tenant.email,
      subdomain: tenant.subdomain,
      isActive: tenant.isActive,
      createdAt: tenant.createdAt,
      subscription: tenant.subscription ? {
        planType: tenant.subscription.planType,
        status: tenant.subscription.status,
        endDate: tenant.subscription.endDate,
      } : null,
      stats: {
        admins: tenant._count.users,
        clients: clientsCount,
        trainers: tenant._count.trainers,
        branches: tenant._count.branches,
      },
    };
  }));

  res.json({
    success: true,
    data: tenantsWithStats,
  });
});

/**
 * Получение категорий расходов
 */
export const getExpenseCategories = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const categories = await (prisma as any).expenseCategory.findMany({
    where: {
      isActive: true,
    },
    orderBy: {
      name: 'asc',
    },
  });

  res.json({
    success: true,
    data: categories,
  });
});

/**
 * Создание категории расходов
 */
export const createExpenseCategory = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const { name, description, color } = req.body;

  if (!name) {
    res.status(400).json({
      success: false,
      error: 'Name is required',
    });
    return;
  }

  const category = await (prisma as any).expenseCategory.create({
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      color: color || null,
    },
  });

  res.json({
    success: true,
    data: category,
  });
});

/**
 * Получение истории транзакций
 */
export const getTransactionHistory = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const { type, limit = 100, offset = 0, startDate, endDate, categoryId } = req.query;

  const where: any = {};
  if (type && type !== 'all') {
    where.type = type;
  }
  if (categoryId) {
    where.categoryId = categoryId;
  }
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      where.createdAt.gte = new Date(startDate as string);
    }
    if (endDate) {
      const end = new Date(endDate as string);
      end.setHours(23, 59, 59, 999);
      where.createdAt.lte = end;
    }
  }

  // Получаем транзакции из AdminTransaction
  const [adminTransactions, adminTotal] = await Promise.all([
    (prisma as any).adminTransaction.findMany({
      where,
      include: {
        marketer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        superAdmin: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: Number(limit),
      skip: Number(offset),
    }),
    (prisma as any).adminTransaction.count({ where }),
  ]);

  // Получаем платежи за подписки
  const subscriptionPayments = await prisma.subscriptionPayment.findMany({
    where: {
      status: 'succeeded',
    },
    include: {
      subscription: {
        include: {
          tenant: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
      promoCodeUsage: {
        include: {
          promoCode: {
            select: {
              code: true,
            },
          },
        },
      },
    },
    orderBy: {
      paidAt: 'desc',
    },
    take: Number(limit),
    skip: Number(offset),
  });

  // Объединяем транзакции и платежи за подписки
  const allTransactions = [
    ...adminTransactions.map((t: any) => ({
      id: t.id,
      type: t.type,
      amount: Number(t.amount),
      description: t.description,
      marketer: t.marketer,
      superAdmin: t.superAdmin,
      createdAt: t.createdAt,
      source: 'admin' as const,
    })),
    ...subscriptionPayments.map((p: any) => {
      const planType = p.subscription.planType as keyof typeof PLAN_PRICES;
      const originalPrice = PLAN_PRICES[planType] || Number(p.amount);
      const discountAmount = p.promoCodeUsage ? Number(p.promoCodeUsage.discountAmount) : 0;
      const actualAmount = p.promoCodeUsage 
        ? Math.max(0, originalPrice - discountAmount)
        : Number(p.amount);
      
      return {
        id: p.id,
        type: 'income' as const,
        amount: actualAmount, // Фактически оплаченная сумма
        originalAmount: originalPrice, // Оригинальная цена тарифа
        discountAmount: discountAmount,
        description: `Платеж за подписку ${p.subscription.planType} от ${p.subscription.tenant.name}`,
        promoCode: p.promoCodeUsage?.promoCode?.code || null,
        tenant: {
          id: p.subscription.tenant.id,
          name: p.subscription.tenant.name,
          email: p.subscription.tenant.email,
        },
        createdAt: p.paidAt || p.createdAt,
        source: 'subscription' as const,
      };
    }),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  res.json({
    success: true,
    data: {
      transactions: allTransactions.slice(0, Number(limit)),
      total: adminTotal + subscriptionPayments.length,
      limit: Number(limit),
      offset: Number(offset),
    },
  });
});

/**
 * Создание расхода
 */
export const createExpense = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const { amount, description, categoryId } = req.body;
  const superAdmin = (req as any).superAdmin;

  if (!amount || !description) {
    res.status(400).json({
      success: false,
      error: 'Amount and description are required',
    });
    return;
  }

  const transaction = await (prisma as any).adminTransaction.create({
    data: {
      type: 'expense',
      amount: parseFloat(amount),
      description: description.trim(),
      categoryId: categoryId || null,
      superAdminId: superAdmin?.id,
    },
    include: {
      superAdmin: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      category: {
        select: {
          id: true,
          name: true,
          color: true,
        },
      },
    },
  });

  res.json({
    success: true,
    data: {
      id: transaction.id,
      type: transaction.type,
      amount: Number(transaction.amount),
      description: transaction.description,
      superAdmin: transaction.superAdmin,
      createdAt: transaction.createdAt,
    },
  });
});

/**
 * Выплата маркетологу
 */
export const payMarketer = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const { marketerId, amount, description } = req.body;
  const superAdmin = (req as any).superAdmin;

  if (!marketerId || !amount) {
    res.status(400).json({
      success: false,
      error: 'Marketer ID and amount are required',
    });
    return;
  }

  const marketer = await prisma.marketer.findUnique({
    where: { id: marketerId },
  });

  if (!marketer) {
    res.status(404).json({
      success: false,
      error: 'Marketer not found',
    });
    return;
  }

  const paymentAmount = parseFloat(amount);
  const currentBalance = Number(marketer.balance);

  if (paymentAmount > currentBalance) {
    res.status(400).json({
      success: false,
      error: 'Payment amount exceeds marketer balance',
    });
    return;
  }

  // Создаем транзакцию
  const transaction = await (prisma as any).adminTransaction.create({
    data: {
      type: 'marketer_payment',
      amount: paymentAmount,
      description: description || `Выплата маркетологу ${marketer.name}`,
      marketerId: marketerId,
      superAdminId: superAdmin?.id,
    },
    include: {
      marketer: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      superAdmin: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  // Уменьшаем баланс маркетолога
  const updatedMarketer = await prisma.marketer.update({
    where: { id: marketerId },
    data: {
      balance: {
        decrement: paymentAmount,
      },
    },
  });

  res.json({
    success: true,
    data: {
      transaction: {
        id: transaction.id,
        type: transaction.type,
        amount: Number(transaction.amount),
        description: transaction.description,
        marketer: transaction.marketer,
        superAdmin: transaction.superAdmin,
        createdAt: transaction.createdAt,
      },
      marketer: {
        id: updatedMarketer.id,
        name: updatedMarketer.name,
        balance: Number(updatedMarketer.balance),
      },
    },
  });
});

/**
 * Обновление тарифа для tenant'а (только для суперадмина)
 */
export const updateTenantPlan = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const { tenantId } = req.params;
  const { planType } = req.body;

  if (!planType || !['FREE', 'STARTER', 'BUSINESS', 'PROFESSIONAL', 'ENTERPRISE'].includes(planType)) {
    res.status(400).json({
      success: false,
      error: 'Invalid plan type',
    });
    return;
  }

  const { SubscriptionService } = await import('../services/subscriptionService');
  const updatedSubscription = await SubscriptionService.updatePlan(tenantId, planType as any);

  res.json({
    success: true,
    data: updatedSubscription,
  });
});

/**
 * Расширенная аналитика по периодам
 */
export const getAnalyticsByPeriod = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const { period = 'month', startDate, endDate } = req.query;

  let start: Date;
  let end: Date = new Date();

  if (startDate && endDate) {
    start = new Date(startDate as string);
    end = new Date(endDate as string);
    end.setHours(23, 59, 59, 999);
  } else {
    // По умолчанию берем последний месяц
    start = new Date();
    start.setMonth(start.getMonth() - 1);
  }

  // Доходы по дням
  const subscriptionPayments = await prisma.subscriptionPayment.findMany({
    where: {
      status: 'succeeded',
      paidAt: {
        gte: start,
        lte: end,
      },
    },
    select: {
      amount: true,
      paidAt: true,
      subscription: {
        select: {
          planType: true,
        },
      },
    },
  });

  // Расходы по дням
  const expenses = await (prisma as any).adminTransaction.findMany({
    where: {
      type: 'expense',
      createdAt: {
        gte: start,
        lte: end,
      },
    },
    include: {
      category: true,
    },
  });

  // Выплаты маркетологам по дням
  const marketerPayments = await (prisma as any).adminTransaction.findMany({
    where: {
      type: 'marketer_payment',
      createdAt: {
        gte: start,
        lte: end,
      },
    },
  });

  // Группируем по дням
  const dailyData: Record<string, { date: string; income: number; expenses: number; marketerPayments: number; profit: number }> = {};
  
  subscriptionPayments.forEach((payment: any) => {
    const date = new Date(payment.paidAt!).toISOString().split('T')[0];
    if (!dailyData[date]) {
      dailyData[date] = { date, income: 0, expenses: 0, marketerPayments: 0, profit: 0 };
    }
    dailyData[date].income += Number(payment.amount);
  });

  expenses.forEach((expense: any) => {
    const date = new Date(expense.createdAt).toISOString().split('T')[0];
    if (!dailyData[date]) {
      dailyData[date] = { date, income: 0, expenses: 0, marketerPayments: 0, profit: 0 };
    }
    dailyData[date].expenses += Number(expense.amount);
  });

  marketerPayments.forEach((payment: any) => {
    const date = new Date(payment.createdAt).toISOString().split('T')[0];
    if (!dailyData[date]) {
      dailyData[date] = { date, income: 0, expenses: 0, marketerPayments: 0, profit: 0 };
    }
    dailyData[date].marketerPayments += Number(payment.amount);
  });

  // Рассчитываем прибыль
  Object.keys(dailyData).forEach(date => {
    dailyData[date].profit = dailyData[date].income - dailyData[date].expenses - dailyData[date].marketerPayments;
  });

  // Расходы по категориям
  const expensesByCategory: Record<string, number> = {};
  expenses.forEach((expense: any) => {
    const categoryName = expense.category?.name || 'Без категории';
    expensesByCategory[categoryName] = (expensesByCategory[categoryName] || 0) + Number(expense.amount);
  });

  // Доходы по тарифам
  const incomeByPlan: Record<string, number> = {};
  subscriptionPayments.forEach(payment => {
    const planType = payment.subscription.planType;
    incomeByPlan[planType] = (incomeByPlan[planType] || 0) + Number(payment.amount);
  });

  const chartData = Object.values(dailyData).sort((a, b) => a.date.localeCompare(b.date));

  res.json({
    success: true,
    data: {
      period: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
      chartData,
      expensesByCategory,
      incomeByPlan,
      summary: {
        totalIncome: chartData.reduce((sum, d) => sum + d.income, 0),
        totalExpenses: chartData.reduce((sum, d) => sum + d.expenses, 0),
        totalMarketerPayments: chartData.reduce((sum, d) => sum + d.marketerPayments, 0),
        totalProfit: chartData.reduce((sum, d) => sum + d.profit, 0),
      },
    },
  });
});

/**
 * Прогноз доходов
 */
export const getRevenueForecast = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  // Получаем активные подписки
  const activeSubscriptions = await prisma.subscription.findMany({
    where: {
      status: 'active',
      endDate: {
        gte: new Date(),
      },
    },
    include: {
      tenant: {
        select: {
          name: true,
        },
      },
    },
  });

  // Рассчитываем прогноз на основе текущих подписок
  const forecast: Record<string, number> = {};
  const today = new Date();
  const monthsAhead = 6; // Прогноз на 6 месяцев вперед

  for (let i = 0; i < monthsAhead; i++) {
    const monthDate = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
    forecast[monthKey] = 0;

    activeSubscriptions.forEach(sub => {
      const endDate = sub.endDate ? new Date(sub.endDate) : null;
      // Если подписка активна в этом месяце
      if (!endDate || endDate >= monthDate) {
        const planPrice = PLAN_PRICES[sub.planType as keyof typeof PLAN_PRICES] || 0;
        forecast[monthKey] += planPrice;
      }
    });
  }

  res.json({
    success: true,
    data: {
      forecast: Object.entries(forecast).map(([month, amount]) => ({
        month,
        amount,
      })),
    },
  });
});

/**
 * Массовое обновление аккаунтов
 */
export const bulkUpdateTenants = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const { tenantIds, action, data } = req.body;

  if (!tenantIds || !Array.isArray(tenantIds) || tenantIds.length === 0) {
    res.status(400).json({
      success: false,
      error: 'Tenant IDs are required',
    });
    return;
  }

  if (action === 'deactivate') {
    await prisma.tenant.updateMany({
      where: {
        id: { in: tenantIds },
      },
      data: {
        isActive: false,
      },
    });
  } else if (action === 'activate') {
    await prisma.tenant.updateMany({
      where: {
        id: { in: tenantIds },
      },
      data: {
        isActive: true,
      },
    });
  } else if (action === 'update_plan' && data?.planType) {
    const { SubscriptionService } = await import('../services/subscriptionService');
    for (const tenantId of tenantIds) {
      await SubscriptionService.updatePlan(tenantId, data.planType);
    }
  }

  res.json({
    success: true,
    message: `Successfully ${action} ${tenantIds.length} tenant(s)`,
  });
});
