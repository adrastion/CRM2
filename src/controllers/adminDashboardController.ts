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
    },
    orderBy: {
      paidAt: 'desc',
    },
  });

  // Общая сумма заработанных денег
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

  // Доступный бюджет (общая выручка - резерв - невыплаченное маркетологам)
  const availableBudget = totalRevenue - reserveAmount - totalUnpaidMarketers;

  // Проверяем, достаточно ли средств
  const hasInsufficientFunds = availableBudget < 0;

  // Подписки, которые скоро истекают (в течение 7 дней)
  const soonExpiring = activeSubscriptions.filter(t => {
    if (!t.subscription?.endDate) return false;
    const daysUntilExpiry = Math.ceil(
      (new Date(t.subscription.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysUntilExpiry <= 7 && daysUntilExpiry > 0;
  });

  // Подписки, которые уже истекли
  const expired = tenants.filter(t => 
    t.subscription && 
    t.subscription.status === 'expired' &&
    t.subscription.endDate &&
    new Date(t.subscription.endDate) < new Date()
  );

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
        soonExpiring: soonExpiring.map(t => ({
          id: t.id,
          name: t.name,
          email: t.email,
          planType: t.subscription?.planType,
          endDate: t.subscription?.endDate,
          daysUntilExpiry: t.subscription?.endDate 
            ? Math.ceil((new Date(t.subscription.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
            : null,
        })),
        expired: expired.map(t => ({
          id: t.id,
          name: t.name,
          email: t.email,
          planType: t.subscription?.planType,
          endDate: t.subscription?.endDate,
        })),
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
          referredClientsCount: m._count?.referredTenants || 0,
        })),
      },
      budget: {
        totalRevenue,
        reserveAmount,
        totalUnpaidMarketers,
        availableBudget,
        hasInsufficientFunds,
        settings: {
          reservePercentage: adminSettings.reservePercentage ? Number(adminSettings.reservePercentage) : null,
          reserveAmount: adminSettings.reserveAmount ? Number(adminSettings.reserveAmount) : null,
        },
      },
      recentPayments: successfulPayments.slice(0, 10).map(p => ({
        id: p.id,
        tenantName: p.subscription.tenant.name,
        amount: Number(p.amount),
        planType: p.subscription.planType,
        paidAt: p.paidAt,
      })),
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
          clients: true,
          trainers: true,
          branches: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  const tenantsWithStats = tenants.map(tenant => ({
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
      clients: tenant._count.clients,
      trainers: tenant._count.trainers,
      branches: tenant._count.branches,
    },
  }));

  res.json({
    success: true,
    data: tenantsWithStats,
  });
});

/**
 * Получение истории транзакций
 */
export const getTransactionHistory = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const { type, limit = 100, offset = 0 } = req.query;

  const where: any = {};
  if (type && type !== 'all') {
    where.type = type;
  }

  const [transactions, total] = await Promise.all([
    prisma.adminTransaction.findMany({
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
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: Number(limit),
      skip: Number(offset),
    }),
    prisma.adminTransaction.count({ where }),
  ]);

  res.json({
    success: true,
    data: {
      transactions: transactions.map(t => ({
        id: t.id,
        type: t.type,
        amount: Number(t.amount),
        description: t.description,
        marketer: t.marketer,
        superAdmin: t.superAdmin,
        createdAt: t.createdAt,
      })),
      total,
      limit: Number(limit),
      offset: Number(offset),
    },
  });
});

/**
 * Создание расхода
 */
export const createExpense = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const { amount, description } = req.body;
  const superAdmin = (req as any).superAdmin;

  if (!amount || !description) {
    res.status(400).json({
      success: false,
      error: 'Amount and description are required',
    });
    return;
  }

  const transaction = await prisma.adminTransaction.create({
    data: {
      type: 'expense',
      amount: parseFloat(amount),
      description: description.trim(),
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

  // Проверяем, что маркетолог существует
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
      error: `Insufficient balance. Current balance: ${currentBalance}, requested: ${paymentAmount}`,
    });
    return;
  }

  // Создаем транзакцию и уменьшаем баланс маркетолога
  const [transaction, updatedMarketer] = await Promise.all([
    prisma.adminTransaction.create({
      data: {
        type: 'marketer_payment',
        amount: paymentAmount,
        description: description?.trim() || `Выплата маркетологу ${marketer.name}`,
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
    }),
    prisma.marketer.update({
      where: { id: marketerId },
      data: {
        balance: currentBalance - paymentAmount,
      },
    }),
  ]);

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

