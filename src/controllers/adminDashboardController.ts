import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { asyncHandler } from '../middleware/errorHandler';
import { PLAN_PRICES, PLAN_LIMITS } from '../services/subscriptionService';
import { createAuditLog, getIpAddress, getUserAgent } from '../utils/auditLogger';
import * as XLSX from 'xlsx';

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
  const superAdmin = (req as any).superAdmin;

  let settings = await (prisma as any).superAdminSettings.findFirst();
  const oldValue = settings ? { ...settings } : null;
  
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

  // Логируем действие
  await createAuditLog({
    superAdminId: superAdmin?.id,
    action: 'update_settings',
    entityType: 'settings',
    description: 'Обновлены настройки супер-администратора',
    oldValue,
    newValue: settings,
    ipAddress: getIpAddress(req),
    userAgent: getUserAgent(req),
  });

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
            take: 50,
            include: {
              promoCodeUsage: {
                include: {
                  promoCode: true,
                },
              },
            },
          },
        },
      },
      referredBy: {
        include: {
          marketer: true,
        },
      },
      users: {
        where: {
          role: { in: ['OWNER', 'ADMIN'] },
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          lastLogin: true,
        },
      },
      trainers: {
        select: {
          id: true,
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
      _count: {
        select: {
          users: true,
          clients: true,
          trainers: true,
          groups: true,
          branches: true,
          trainings: true,
          payments: true,
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

  // Дополнительная статистика
  const activeClients = await prisma.client.count({
    where: {
      tenantId: tenant.id,
      isActive: true,
    },
  });

  const totalPayments = await prisma.payment.aggregate({
    where: {
      tenantId: tenant.id,
      status: 'paid',
    },
    _sum: {
      amount: true,
    },
  });

  const lastPayment = await prisma.subscriptionPayment.findFirst({
    where: {
      subscription: {
        tenantId: tenant.id,
      },
      status: 'succeeded',
    },
    include: {
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

  // Получаем все платежи для расчета totalRevenue
  const allPayments = await prisma.subscriptionPayment.findMany({
    where: {
      subscription: {
        tenantId: tenant.id,
      },
      status: 'succeeded',
    },
    include: {
      promoCodeUsage: {
        include: {
          promoCode: true,
        },
      },
    },
  });

  const totalRevenue = allPayments.reduce((sum: number, p: any) => {
    const planType = tenant.subscription?.planType as keyof typeof PLAN_PRICES;
    const originalPrice = PLAN_PRICES[planType] || Number(p.amount);
    const discountAmount = p.promoCodeUsage ? Number(p.promoCodeUsage.discountAmount) : 0;
    const actualAmount = p.promoCodeUsage 
      ? Math.max(0, originalPrice - discountAmount)
      : Number(p.amount);
    return sum + actualAmount;
  }, 0);

  // Статистика активности
  const lastActivity = await prisma.user.findFirst({
    where: {
      tenantId: tenant.id,
    },
    orderBy: {
      lastLogin: 'desc',
    },
    select: {
      lastLogin: true,
    },
  });

  res.json({
    success: true,
    data: {
      ...tenant,
      stats: {
        ...tenant._count,
        activeClients,
        totalPaymentsAmount: Number(totalPayments._sum.amount || 0),
        totalRevenue,
        lastPayment: lastPayment ? {
          amount: (() => {
            const planType = tenant.subscription?.planType as keyof typeof PLAN_PRICES;
            const originalPrice = PLAN_PRICES[planType] || Number(lastPayment.amount);
            const discountAmount = (lastPayment as any).promoCodeUsage ? Number((lastPayment as any).promoCodeUsage?.discountAmount || 0) : 0;
            return (lastPayment as any).promoCodeUsage 
              ? Math.max(0, originalPrice - discountAmount)
              : Number(lastPayment.amount);
          })(),
          paidAt: lastPayment.paidAt,
          planType: tenant.subscription?.planType,
        } : null,
        lastActivity: lastActivity?.lastLogin,
      },
    },
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
  const { amount, description, categoryId, documentUrl, isRecurring, recurringPeriod, nextDueDate } = req.body;
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
      documentUrl: documentUrl || null,
      isRecurring: isRecurring || false,
      recurringPeriod: recurringPeriod || null,
      nextDueDate: nextDueDate ? new Date(nextDueDate) : null,
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

  // Логируем действие
  await createAuditLog({
    superAdminId: superAdmin?.id,
    action: 'create_expense',
    entityType: 'expense',
    entityId: transaction.id,
    description: `Создан расход: ${description.trim()} на сумму ${amount} ₽`,
    newValue: transaction,
    ipAddress: getIpAddress(req),
    userAgent: getUserAgent(req),
  });

  res.json({
    success: true,
    data: {
      id: transaction.id,
      type: transaction.type,
      amount: Number(transaction.amount),
      description: transaction.description,
      category: transaction.category,
      superAdmin: transaction.superAdmin,
      createdAt: transaction.createdAt,
    },
  });
});

/**
 * Обновление расхода
 */
export const updateExpense = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const { id } = req.params;
  const { amount, description, categoryId, documentUrl, isRecurring, recurringPeriod, nextDueDate } = req.body;
  const superAdmin = (req as any).superAdmin;

  const existingExpense = await (prisma as any).adminTransaction.findUnique({
    where: { id },
    include: {
      category: true,
    },
  });

  if (!existingExpense || existingExpense.type !== 'expense') {
    res.status(404).json({
      success: false,
      error: 'Expense not found',
    });
    return;
  }

  const oldValue = { ...existingExpense };

  const updateData: any = {};
  if (amount !== undefined) updateData.amount = parseFloat(amount);
  if (description !== undefined) updateData.description = description.trim();
  if (categoryId !== undefined) updateData.categoryId = categoryId || null;
  if (documentUrl !== undefined) updateData.documentUrl = documentUrl || null;
  if (isRecurring !== undefined) updateData.isRecurring = isRecurring;
  if (recurringPeriod !== undefined) updateData.recurringPeriod = recurringPeriod || null;
  if (nextDueDate !== undefined) updateData.nextDueDate = nextDueDate ? new Date(nextDueDate) : null;

  const updatedExpense = await (prisma as any).adminTransaction.update({
    where: { id },
    data: updateData,
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

  // Логируем действие
  await createAuditLog({
    superAdminId: superAdmin?.id,
    action: 'update_expense',
    entityType: 'expense',
    entityId: id,
    description: `Обновлен расход: ${updatedExpense.description}`,
    oldValue,
    newValue: updatedExpense,
    ipAddress: getIpAddress(req),
    userAgent: getUserAgent(req),
  });

  res.json({
    success: true,
    data: updatedExpense,
  });
});

/**
 * Удаление расхода
 */
export const deleteExpense = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const { id } = req.params;
  const superAdmin = (req as any).superAdmin;

  const existingExpense = await (prisma as any).adminTransaction.findUnique({
    where: { id },
  });

  if (!existingExpense || existingExpense.type !== 'expense') {
    res.status(404).json({
      success: false,
      error: 'Expense not found',
    });
    return;
  }

  await (prisma as any).adminTransaction.delete({
    where: { id },
  });

  // Логируем действие
  await createAuditLog({
    superAdminId: superAdmin?.id,
    action: 'delete_expense',
    entityType: 'expense',
    entityId: id,
    description: `Удален расход: ${existingExpense.description} на сумму ${existingExpense.amount} ₽`,
    oldValue: existingExpense,
    ipAddress: getIpAddress(req),
    userAgent: getUserAgent(req),
  });

  res.json({
    success: true,
    message: 'Expense deleted successfully',
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

  // Логируем действие
  await createAuditLog({
    superAdminId: superAdmin?.id,
    action: 'pay_marketer',
    entityType: 'marketer',
    entityId: marketerId,
    description: `Выплата маркетологу ${marketer.name} на сумму ${paymentAmount} ₽`,
    newValue: { transaction, marketer: updatedMarketer },
    ipAddress: getIpAddress(req),
    userAgent: getUserAgent(req),
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
  const superAdmin = (req as any).superAdmin;

  if (!planType || !['FREE', 'STARTER', 'BUSINESS', 'PROFESSIONAL', 'ENTERPRISE'].includes(planType)) {
    res.status(400).json({
      success: false,
      error: 'Invalid plan type',
    });
    return;
  }

  // Получаем текущий тариф
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      subscription: true,
    },
  });

  if (!tenant) {
    res.status(404).json({
      success: false,
      error: 'Tenant not found',
    });
    return;
  }

  const oldPlanType = tenant.subscription?.planType;

  const { SubscriptionService } = await import('../services/subscriptionService');
  const updatedSubscription = await SubscriptionService.updatePlan(tenantId, planType as any);

  // Логируем действие
  await createAuditLog({
    superAdminId: superAdmin?.id,
    action: 'update_tenant_plan',
    entityType: 'tenant',
    entityId: tenantId,
    description: `Изменен тариф аккаунта ${tenant.name} с ${oldPlanType} на ${planType}`,
    oldValue: { planType: oldPlanType },
    newValue: { planType },
    ipAddress: getIpAddress(req),
    userAgent: getUserAgent(req),
  });

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

/**
 * KPI метрики
 */
export const getKPIMetrics = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const { period = 'month' } = req.query;

  // Определяем период
  const now = new Date();
  let startDate: Date;
  let endDate = new Date();

  switch (period) {
    case 'week':
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 7);
      break;
    case 'month':
      startDate = new Date(now);
      startDate.setMonth(startDate.getMonth() - 1);
      break;
    case 'quarter':
      startDate = new Date(now);
      startDate.setMonth(startDate.getMonth() - 3);
      break;
    case 'year':
      startDate = new Date(now);
      startDate.setFullYear(startDate.getFullYear() - 1);
      break;
    default:
      startDate = new Date(now);
      startDate.setMonth(startDate.getMonth() - 1);
  }

  // MRR (Monthly Recurring Revenue) - месячный повторяющийся доход
  const activeSubscriptions = await prisma.subscription.findMany({
    where: {
      status: 'active',
    },
  });

  const mrr = activeSubscriptions.reduce((sum, sub) => {
    const planPrice = PLAN_PRICES[sub.planType as keyof typeof PLAN_PRICES] || 0;
    return sum + planPrice;
  }, 0);

  // ARR (Annual Recurring Revenue) - годовой повторяющийся доход
  const arr = mrr * 12;

  // Доходы за период
  const paymentsInPeriod = await prisma.subscriptionPayment.findMany({
    where: {
      status: 'succeeded',
      paidAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      subscription: {
        include: {
          tenant: true,
        },
      },
    },
  });

  const revenueInPeriod = paymentsInPeriod.reduce((sum, payment) => {
    const planType = payment.subscription.planType as keyof typeof PLAN_PRICES;
    const originalPrice = PLAN_PRICES[planType] || Number(payment.amount);
    const actualAmount = Number(payment.amount);
    return sum + actualAmount;
  }, 0);

  // Новые аккаунты за период
  const newTenants = await prisma.tenant.count({
    where: {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  // Истекшие подписки за период
  const expiredSubscriptions = await prisma.subscription.findMany({
    where: {
      status: 'expired',
      endDate: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  // Churn rate (отток) - процент истекших подписок
  const totalActiveAtStart = activeSubscriptions.length + expiredSubscriptions.length;
  const churnRate = totalActiveAtStart > 0 
    ? (expiredSubscriptions.length / totalActiveAtStart) * 100 
    : 0;

  // LTV (Lifetime Value) - средняя стоимость клиента за весь период
  const tenantsWithPayments = await prisma.tenant.findMany({
    include: {
      subscription: {
        include: {
          payments: {
            where: {
              status: 'succeeded',
            },
          },
        },
      },
    },
  });

  const ltvData = tenantsWithPayments
    .filter(t => t.subscription && t.subscription.payments.length > 0)
    .map(t => {
      const totalPaid = t.subscription!.payments.reduce((sum, p) => {
        return sum + Number(p.amount);
      }, 0);
      return totalPaid;
    });

  const avgLTV = ltvData.length > 0 
    ? ltvData.reduce((sum, val) => sum + val, 0) / ltvData.length 
    : 0;

  // CAC (Customer Acquisition Cost) - стоимость привлечения клиента
  const marketingExpenses = await (prisma as any).adminTransaction.findMany({
    where: {
      type: 'expense',
      category: {
        name: 'Маркетинг и реклама',
      },
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  const totalMarketingExpenses = marketingExpenses.reduce((sum: number, exp: any) => {
    return sum + Number(exp.amount);
  }, 0);

  const cac = newTenants > 0 ? totalMarketingExpenses / newTenants : 0;

  // Конверсия из FREE в платные тарифы
  const freeTenants = await prisma.tenant.count({
    where: {
      subscription: {
        planType: 'FREE',
      },
    },
  });

  const paidTenants = await prisma.tenant.count({
    where: {
      subscription: {
        planType: { not: 'FREE' },
        status: 'active',
      },
    },
  });

  const conversionRate = (freeTenants + paidTenants) > 0
    ? (paidTenants / (freeTenants + paidTenants)) * 100
    : 0;

  res.json({
    success: true,
    data: {
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        type: period,
      },
      mrr,
      arr,
      revenueInPeriod,
      newTenants,
      churnRate: Number(churnRate.toFixed(2)),
      avgLTV: Number(avgLTV.toFixed(2)),
      cac: Number(cac.toFixed(2)),
      conversionRate: Number(conversionRate.toFixed(2)),
      totalActiveSubscriptions: activeSubscriptions.length,
      totalTenants: await prisma.tenant.count(),
    },
  });
});

/**
 * Получение логов аудита
 */
export const getAuditLogs = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const { limit = 100, offset = 0, action, entityType, startDate, endDate } = req.query;

  const where: any = {};
  if (action) {
    where.action = action;
  }
  if (entityType) {
    where.entityType = entityType;
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

  const [logs, total] = await Promise.all([
    (prisma as any).adminAuditLog.findMany({
      where,
      include: {
        superAdmin: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: Number(limit),
      skip: Number(offset),
    }),
    (prisma as any).adminAuditLog.count({ where }),
  ]);

  res.json({
    success: true,
    data: {
      logs: logs.map((log: any) => ({
        ...log,
        oldValue: log.oldValue ? JSON.parse(log.oldValue) : null,
        newValue: log.newValue ? JSON.parse(log.newValue) : null,
      })),
      total,
      limit: Number(limit),
      offset: Number(offset),
    },
  });
});

/**
 * Управление тарифами - получение текущих цен
 */
export const getPlanPrices = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const plans = Object.keys(PLAN_PRICES).map((planType) => ({
    planType,
    price: PLAN_PRICES[planType as keyof typeof PLAN_PRICES],
    limits: PLAN_LIMITS[planType as keyof typeof PLAN_LIMITS],
  }));
  
  res.json({
    success: true,
    data: plans,
  });
});

/**
 * Управление тарифами - обновление тарифа (цена + лимиты)
 */
export const updatePlanPrice = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const { planType, price, limits } = req.body;
  const superAdmin = (req as any).superAdmin;

  if (!planType || !['FREE', 'STARTER', 'BUSINESS', 'PROFESSIONAL', 'ENTERPRISE'].includes(planType)) {
    res.status(400).json({
      success: false,
      error: 'Invalid plan type',
    });
    return;
  }

  const oldPrice = PLAN_PRICES[planType as keyof typeof PLAN_PRICES];
  const oldLimits = PLAN_LIMITS[planType as keyof typeof PLAN_LIMITS];

  // Обновляем цену
  if (price !== undefined) {
    if (price < 0) {
      res.status(400).json({
        success: false,
        error: 'Price must be non-negative',
      });
      return;
    }
    (PLAN_PRICES as any)[planType] = price;
  }

  // Обновляем лимиты
  if (limits) {
    Object.keys(limits).forEach((key) => {
      if (limits[key] !== undefined) {
        (PLAN_LIMITS as any)[planType][key] = limits[key];
      }
    });
  }
  
  // Логируем действие
  await createAuditLog({
    superAdminId: superAdmin?.id,
    action: 'update_plan',
    entityType: 'plan',
    entityId: planType,
    description: `Обновлен тариф ${planType}`,
    oldValue: { planType, price: oldPrice, limits: oldLimits },
    newValue: { planType, price: price !== undefined ? price : oldPrice, limits: limits || oldLimits },
    ipAddress: getIpAddress(req),
    userAgent: getUserAgent(req),
  });

  res.json({
    success: true,
    data: {
      planType,
      price: price !== undefined ? price : oldPrice,
      limits: limits || oldLimits,
      newPrice: price,
      message: 'Price updated (requires server restart to apply)',
    },
  });
});

/**
 * Расширенная статистика маркетологов
 */
export const getMarketerStats = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const { marketerId } = req.query;

  if (marketerId) {
    // Статистика по конкретному маркетологу
    const marketer = await prisma.marketer.findUnique({
      where: { id: marketerId as string },
      include: {
        referredTenants: {
          include: {
            tenant: {
              include: {
                subscription: {
                  include: {
                    payments: {
                      where: {
                        status: 'succeeded',
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!marketer) {
      res.status(404).json({
        success: false,
        error: 'Marketer not found',
      });
      return;
    }

    // Рассчитываем метрики
    const referredTenants = marketer.referredTenants;
    const totalRevenue = referredTenants.reduce((sum, rt) => {
      const payments = rt.tenant.subscription?.payments || [];
      return sum + payments.reduce((pSum, p) => {
        return pSum + Number(p.amount);
      }, 0);
    }, 0);

    const totalCommission = (totalRevenue * Number(marketer.commissionPercentage)) / 100;
    const avgRevenuePerTenant = referredTenants.length > 0 ? totalRevenue / referredTenants.length : 0;
    const conversionRate = referredTenants.length > 0 ? 100 : 0;

    res.json({
      success: true,
      data: {
        marketer: {
          id: marketer.id,
          name: marketer.name,
          email: marketer.email,
          commissionPercentage: Number(marketer.commissionPercentage),
          balance: Number(marketer.balance),
        },
        stats: {
          referredTenantsCount: referredTenants.length,
          totalRevenue,
          totalCommission,
          avgRevenuePerTenant,
          conversionRate,
          unpaidCommission: Number(marketer.balance),
        },
        referredTenants: referredTenants.map(rt => ({
          id: rt.tenant.id,
          name: rt.tenant.name,
          email: rt.tenant.email,
          planType: rt.tenant.subscription?.planType,
          subscriptionStatus: rt.tenant.subscription?.status,
        })),
      },
    });
  } else {
    // Общая статистика по всем маркетологам
    const marketers = await prisma.marketer.findMany({
      include: {
        referredTenants: {
          include: {
            tenant: {
              include: {
                subscription: {
                  include: {
                    payments: {
                      where: {
                        status: 'succeeded',
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const marketersStats = marketers.map(marketer => {
      const referredTenants = marketer.referredTenants;
      const totalRevenue = referredTenants.reduce((sum, rt) => {
        const payments = rt.tenant.subscription?.payments || [];
        return sum + payments.reduce((pSum, p) => {
          return pSum + Number(p.amount);
        }, 0);
      }, 0);

      const totalCommission = (totalRevenue * Number(marketer.commissionPercentage)) / 100;
      const avgRevenuePerTenant = referredTenants.length > 0 ? totalRevenue / referredTenants.length : 0;

      return {
        id: marketer.id,
        name: marketer.name,
        email: marketer.email,
        commissionPercentage: Number(marketer.commissionPercentage),
        balance: Number(marketer.balance),
        stats: {
          referredTenantsCount: referredTenants.length,
          totalRevenue,
          totalCommission,
          avgRevenuePerTenant,
          unpaidCommission: Number(marketer.balance),
        },
      };
    });

    res.json({
      success: true,
      data: {
        marketers: marketersStats,
        summary: {
          totalMarketers: marketers.length,
          totalReferredTenants: marketersStats.reduce((sum, m) => sum + m.stats.referredTenantsCount, 0),
          totalRevenue: marketersStats.reduce((sum, m) => sum + m.stats.totalRevenue, 0),
          totalCommission: marketersStats.reduce((sum, m) => sum + m.stats.totalCommission, 0),
          totalUnpaid: marketersStats.reduce((sum, m) => sum + m.stats.unpaidCommission, 0),
        },
      },
    });
  }
});

/**
 * Экспорт транзакций в Excel
 */
export const exportTransactions = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { type, startDate, endDate, categoryId } = req.query;

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

  // Получаем все транзакции
  const adminTransactions = await (prisma as any).adminTransaction.findMany({
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
  });

  // Получаем платежи за подписки
  const subscriptionPayments = await prisma.subscriptionPayment.findMany({
    where: {
      status: 'succeeded',
      ...(startDate || endDate ? {
        paidAt: {
          ...(startDate ? { gte: new Date(startDate as string) } : {}),
          ...(endDate ? {
            lte: (() => {
              const end = new Date(endDate as string);
              end.setHours(23, 59, 59, 999);
              return end;
            })()
          } : {}),
        },
      } : {}),
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
    },
    orderBy: {
      paidAt: 'desc',
    },
  });

  // Подготавливаем данные для Excel
  const excelData = [
    ...adminTransactions.map((t: any) => ({
      'Дата': new Date(t.createdAt).toLocaleString('ru-RU'),
      'Тип': t.type === 'expense' ? 'Расход' : t.type === 'marketer_payment' ? 'Выплата маркетологу' : t.type,
      'Сумма': Number(t.amount),
      'Описание': t.description,
      'Категория': t.category?.name || '',
      'Маркетолог': t.marketer?.name || '',
      'Супер-админ': t.superAdmin ? `${t.superAdmin.firstName} ${t.superAdmin.lastName}` : '',
    })),
    ...subscriptionPayments.map((p: any) => {
      const planType = p.subscription.planType as keyof typeof PLAN_PRICES;
      const originalPrice = PLAN_PRICES[planType] || Number(p.amount);
      const actualAmount = Number(p.amount);
      return {
        'Дата': p.paidAt ? new Date(p.paidAt).toLocaleString('ru-RU') : new Date(p.createdAt).toLocaleString('ru-RU'),
        'Тип': 'Доход',
        'Сумма': actualAmount,
        'Описание': `Платеж за подписку ${p.subscription.planType} от ${p.subscription.tenant.name}`,
        'Категория': '',
        'Маркетолог': '',
        'Супер-админ': '',
        'Аккаунт': p.subscription.tenant.name,
        'Тариф': p.subscription.planType,
      };
    }),
  ].sort((a, b) => new Date(b['Дата']).getTime() - new Date(a['Дата']).getTime());

  // Создаем Excel файл
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(excelData);

  // Устанавливаем ширину колонок
  worksheet['!cols'] = [
    { wch: 20 }, // Дата
    { wch: 20 }, // Тип
    { wch: 15 }, // Сумма
    { wch: 40 }, // Описание
    { wch: 20 }, // Категория
    { wch: 25 }, // Маркетолог
    { wch: 25 }, // Супер-админ
    { wch: 25 }, // Аккаунт
    { wch: 15 }, // Тариф
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Транзакции');

  // Генерируем буфер
  const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  // Устанавливаем заголовки
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=transactions_${new Date().toISOString().split('T')[0]}.xlsx`);

  res.send(excelBuffer);
});

/**
 * Экспорт аккаунтов в Excel
 */
export const exportTenants = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const tenants = await prisma.tenant.findMany({
    include: {
      subscription: true,
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
    orderBy: {
      createdAt: 'desc',
    },
  });

  // Подготавливаем данные для Excel
  const excelData = tenants.map((tenant) => ({
    'ID': tenant.id,
    'Название': tenant.name,
    'Email': tenant.email,
    'Телефон': tenant.phone || '',
    'Адрес': tenant.address || '',
    'Тариф': tenant.subscription?.planType || 'FREE',
    'Статус подписки': tenant.subscription?.status || 'inactive',
    'Дата начала': tenant.subscription?.startDate ? new Date(tenant.subscription.startDate).toLocaleDateString('ru-RU') : '',
    'Дата окончания': tenant.subscription?.endDate ? new Date(tenant.subscription.endDate).toLocaleDateString('ru-RU') : '',
    'Активен': tenant.isActive ? 'Да' : 'Нет',
    'Пользователей': tenant._count.users,
    'Клиентов': tenant._count.clients,
    'Тренеров': tenant._count.trainers,
    'Групп': tenant._count.groups,
    'Филиалов': tenant._count.branches,
    'Маркетолог': tenant.referredBy?.marketer?.name || '',
    'Дата регистрации': new Date(tenant.createdAt).toLocaleDateString('ru-RU'),
  }));

  // Создаем Excel файл
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(excelData);

  // Устанавливаем ширину колонок
  worksheet['!cols'] = [
    { wch: 30 }, // ID
    { wch: 30 }, // Название
    { wch: 30 }, // Email
    { wch: 18 }, // Телефон
    { wch: 40 }, // Адрес
    { wch: 15 }, // Тариф
    { wch: 18 }, // Статус подписки
    { wch: 15 }, // Дата начала
    { wch: 15 }, // Дата окончания
    { wch: 10 }, // Активен
    { wch: 12 }, // Пользователей
    { wch: 12 }, // Клиентов
    { wch: 12 }, // Тренеров
    { wch: 12 }, // Групп
    { wch: 12 }, // Филиалов
    { wch: 25 }, // Маркетолог
    { wch: 15 }, // Дата регистрации
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Аккаунты');

  // Генерируем буфер
  const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  // Устанавливаем заголовки
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=tenants_${new Date().toISOString().split('T')[0]}.xlsx`);

  res.send(excelBuffer);
});

/**
 * Экспорт маркетологов в Excel
 */
export const exportMarketers = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const marketers = await prisma.marketer.findMany({
    include: {
      referredTenants: {
        include: {
          tenant: {
            include: {
              subscription: {
                include: {
                  payments: {
                    where: {
                      status: 'succeeded',
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: {
      balance: 'desc',
    },
  });

  // Подготавливаем данные для Excel
  const excelData = marketers.map((marketer) => {
    const referredTenants = marketer.referredTenants;
    const totalRevenue = referredTenants.reduce((sum, rt) => {
      const payments = rt.tenant.subscription?.payments || [];
      return sum + payments.reduce((pSum, p) => {
        return pSum + Number(p.amount);
      }, 0);
    }, 0);

    const totalCommission = (totalRevenue * Number(marketer.commissionPercentage)) / 100;

    return {
      'ID': marketer.id,
      'Имя': marketer.name,
      'Email': marketer.email,
      'Процент комиссии': `${marketer.commissionPercentage}%`,
      'Баланс': Number(marketer.balance),
      'Привлечено аккаунтов': referredTenants.length,
      'Общий доход': totalRevenue,
      'Общая комиссия': totalCommission,
      'Средний доход на аккаунт': referredTenants.length > 0 ? totalRevenue / referredTenants.length : 0,
    };
  });

  // Создаем Excel файл
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(excelData);

  // Устанавливаем ширину колонок
  worksheet['!cols'] = [
    { wch: 30 }, // ID
    { wch: 25 }, // Имя
    { wch: 30 }, // Email
    { wch: 18 }, // Процент комиссии
    { wch: 15 }, // Баланс
    { wch: 20 }, // Привлечено аккаунтов
    { wch: 15 }, // Общий доход
    { wch: 18 }, // Общая комиссия
    { wch: 25 }, // Средний доход на аккаунт
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Маркетологи');

  // Генерируем буфер
  const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  // Устанавливаем заголовки
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=marketers_${new Date().toISOString().split('T')[0]}.xlsx`);

  res.send(excelBuffer);
});

/**
 * Получение пресетов дашборда
 */
export const getDashboardPresets = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const superAdmin = (req as any).superAdmin;

  if (!superAdmin) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized',
    });
    return;
  }

  const presets = await (prisma as any).dashboardPreset.findMany({
    where: {
      superAdminId: superAdmin.id,
    },
    orderBy: {
      isDefault: 'desc',
    },
  });

  res.json({
    success: true,
    data: presets.map((preset: any) => ({
      ...preset,
      widgetOrder: JSON.parse(preset.widgetOrder),
      widgetVisibility: JSON.parse(preset.widgetVisibility),
    })),
  });
});

/**
 * Создание/обновление пресета дашборда
 */
export const saveDashboardPreset = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const superAdmin = (req as any).superAdmin;
  const { id, name, isDefault, widgetOrder, widgetVisibility } = req.body;

  if (!superAdmin) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized',
    });
    return;
  }

  if (!name || !widgetOrder || !widgetVisibility) {
    res.status(400).json({
      success: false,
      error: 'Name, widgetOrder and widgetVisibility are required',
    });
    return;
  }

  // Если это пресет по умолчанию, снимаем флаг с других пресетов
  if (isDefault) {
    await (prisma as any).dashboardPreset.updateMany({
      where: {
        superAdminId: superAdmin.id,
        isDefault: true,
      },
      data: {
        isDefault: false,
      },
    });
  }

  let preset;
  if (id) {
    // Обновление существующего пресета
    preset = await (prisma as any).dashboardPreset.update({
      where: { id },
      data: {
        name,
        isDefault: isDefault || false,
        widgetOrder: JSON.stringify(widgetOrder),
        widgetVisibility: JSON.stringify(widgetVisibility),
      },
    });
  } else {
    // Создание нового пресета
    preset = await (prisma as any).dashboardPreset.create({
      data: {
        superAdminId: superAdmin.id,
        name,
        isDefault: isDefault || false,
        widgetOrder: JSON.stringify(widgetOrder),
        widgetVisibility: JSON.stringify(widgetVisibility),
      },
    });
  }

  // Логируем действие
  await createAuditLog({
    superAdminId: superAdmin.id,
    action: id ? 'update_dashboard_preset' : 'create_dashboard_preset',
    entityType: 'dashboard_preset',
    entityId: preset.id,
    description: `${id ? 'Обновлен' : 'Создан'} пресет дашборда: ${name}`,
    newValue: { name, isDefault, widgetOrder, widgetVisibility },
    ipAddress: getIpAddress(req),
    userAgent: getUserAgent(req),
  });

  res.json({
    success: true,
    data: {
      ...preset,
      widgetOrder: JSON.parse(preset.widgetOrder),
      widgetVisibility: JSON.parse(preset.widgetVisibility),
    },
  });
});

/**
 * Удаление пресета дашборда
 */
export const deleteDashboardPreset = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const superAdmin = (req as any).superAdmin;
  const { id } = req.params;

  if (!superAdmin) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized',
    });
    return;
  }

  const preset = await (prisma as any).dashboardPreset.findUnique({
    where: { id },
  });

  if (!preset || preset.superAdminId !== superAdmin.id) {
    res.status(404).json({
      success: false,
      error: 'Preset not found',
    });
    return;
  }

  await (prisma as any).dashboardPreset.delete({
    where: { id },
  });

  // Логируем действие
  await createAuditLog({
    superAdminId: superAdmin.id,
    action: 'delete_dashboard_preset',
    entityType: 'dashboard_preset',
    entityId: id,
    description: `Удален пресет дашборда: ${preset.name}`,
    oldValue: preset,
    ipAddress: getIpAddress(req),
    userAgent: getUserAgent(req),
  });

  res.json({
    success: true,
    message: 'Preset deleted successfully',
  });
});
