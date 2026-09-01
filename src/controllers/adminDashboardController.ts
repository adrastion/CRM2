import { Response } from 'express';
import { Prisma, PrismaClient } from '@prisma/client';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { asyncHandler } from '../middleware/errorHandler';
import { PlanCatalogService } from '../services/planCatalogService';
import { breakdownPayment, sumPayments, calculateMrr } from '../utils/revenue';
import { createAuditLog, getIpAddress, getUserAgent } from '../utils/auditLogger';
import * as XLSX from 'xlsx';

const prisma = new PrismaClient();

type GrantLogWithAdmin = Prisma.SubscriptionGrantLogGetPayload<{
  include: {
    superAdmin: { select: { id: true; firstName: true; lastName: true; email: true } };
  };
}>;

/**
 * Карта «код тарифа → цена» из каталога.
 * Используется там, где нужна текущая цена (MRR, прогноз), но НЕ там,
 * где считается прошлая выручка: история берётся из снимков платежей.
 */
async function loadPriceMap(): Promise<{
  priceOf: (code: string) => number | null;
  nameOf: (code: string) => string;
  plans: Awaited<ReturnType<typeof PlanCatalogService.listAll>>;
}> {
  const plans = await PlanCatalogService.listAll();
  const byCode = new Map(plans.map((p) => [p.code, p]));
  return {
    priceOf: (code: string) => byCode.get(code)?.price ?? null,
    nameOf: (code: string) => byCode.get(code)?.name ?? code,
    plans,
  };
}

/**
 * Получение статистики по всем tenant'ам
 * Доступно только для суперадмина (проверка через специальный middleware)
 */
export const getAdminDashboard = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const { priceOf, nameOf, plans } = await loadPriceMap();

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

  // Статистика по тарифам строится по каталогу, а не по фиксированному списку,
  // иначе созданные супер-админом тарифы не попадали бы в сводку.
  const planStats: Record<string, number> = {};
  plans.forEach((p) => {
    planStats[p.code] = 0;
  });

  // Активные подписки
  const activeSubscriptions = tenants.filter(t => 
    t.subscription && t.subscription.status === 'active'
  );

  // Отдельно считаем выданные вручную подписки: они не приносят дохода.
  let grantedActiveCount = 0;

  activeSubscriptions.forEach(t => {
    if (t.subscription) {
      const planType = t.subscription.planType;
      planStats[planType] = (planStats[planType] || 0) + 1;
      if ((t.subscription as any).isGranted) {
        grantedActiveCount += 1;
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

  // Доход: фактически полученные суммы. Размер скидок — отдельная метрика.
  // Значения берутся из снимков платежей, поэтому правка цены в каталоге
  // не меняет прошлую выручку.
  const revenueTotals = sumPayments(successfulPayments);
  const totalRevenue = revenueTotals.netRevenue;

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

  // Последние платежи (первые 10). Суммы берём из снимка платежа.
  const recentPayments = successfulPayments.slice(0, 10).map(payment => {
    const b = breakdownPayment(payment);

    return {
      id: payment.id,
      tenantName: payment.subscription.tenant.name,
      amount: b.netAmount, // Фактически полученная сумма
      originalAmount: b.listPrice, // Цена тарифа на момент оплаты
      discountAmount: b.discountAmount,
      planType: b.planCode,
      planName: b.planCode ? nameOf(b.planCode) : null,
      paidAt: payment.paidAt?.toISOString() || payment.createdAt.toISOString(),
      hasDiscount: b.hasDiscount,
      promoCode: payment.promoCodeUsage?.promoCode?.code || null,
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
        /** Активные подписки, выданные вручную и не приносящие дохода. */
        granted: grantedActiveCount,
      },
      subscriptions: {
        byPlan: planStats,
        planNames: Object.fromEntries(plans.map((p) => [p.code, p.name])),
        soonExpiring,
        expired,
      },
      revenue: {
        // Фактически полученные деньги
        total: totalRevenue,
        // Сумма по прайсу без учёта скидок
        gross: revenueTotals.grossRevenue,
        // Сколько отдано скидками по промокодам — отдельная метрика
        discountsGiven: revenueTotals.discountsGiven,
        paymentsCount: revenueTotals.count,
        discountedPaymentsCount: revenueTotals.discountedCount,
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
  const { reservePercentage, reserveAmount, errorLogPath } = req.body;
  const superAdmin = (req as any).superAdmin;

  let settings = await (prisma as any).superAdminSettings.findFirst();
  const oldValue = settings ? { ...settings } : null;

  // Путь к файлу логов проверяем отдельно: он используется для чтения с диска.
  let normalizedLogPath: string | null | undefined;
  if (errorLogPath !== undefined) {
    const { LogFileService } = await import('../services/logFileService');
    normalizedLogPath = errorLogPath ? LogFileService.validatePath(errorLogPath) : null;
  }

  if (!settings) {
    settings = await (prisma as any).superAdminSettings.create({
      data: {
        reservePercentage: reservePercentage ? parseFloat(reservePercentage) : null,
        reserveAmount: reserveAmount ? parseFloat(reserveAmount) : null,
        errorLogPath: normalizedLogPath ?? null,
      },
    });
  } else {
    settings = await (prisma as any).superAdminSettings.update({
      where: { id: settings.id },
      data: {
        reservePercentage: reservePercentage !== undefined ? (reservePercentage ? parseFloat(reservePercentage) : null) : undefined,
        reserveAmount: reserveAmount !== undefined ? (reserveAmount ? parseFloat(reserveAmount) : null) : undefined,
        errorLogPath: normalizedLogPath,
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

  // Обновляем кэш пути: обработчик ошибок пишет в файл синхронно.
  if (normalizedLogPath !== undefined) {
    const { LogFileService } = await import('../services/logFileService');
    await LogFileService.refreshCachedPath();
  }

  res.json({
    success: true,
    data: {
      reservePercentage: settings.reservePercentage ? Number(settings.reservePercentage) : null,
      reserveAmount: settings.reserveAmount ? Number(settings.reserveAmount) : null,
      errorLogPath: settings.errorLogPath || null,
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

  // Выручка по аккаунту: фактически полученные суммы из снимков платежей.
  const tenantRevenue = sumPayments(allPayments as any[]);
  const totalRevenue = tenantRevenue.netRevenue;

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

  // История выдачи и продления тарифа этому аккаунту
  const { SubscriptionService } = await import('../services/subscriptionService');
  const grantHistory = await SubscriptionService.getGrantHistory(tenant.id);
  const plan = tenant.subscription
    ? await PlanCatalogService.findByCode(tenant.subscription.planType)
    : null;

  res.json({
    success: true,
    data: {
      ...tenant,
      planName: plan?.name || tenant.subscription?.planType || null,
      grantHistory: grantHistory.map((log: GrantLogWithAdmin) => ({
        id: log.id,
        action: log.action,
        planCode: log.planCode,
        oldPlanCode: log.oldPlanCode,
        oldEndDate: log.oldEndDate,
        newEndDate: log.newEndDate,
        comment: log.comment,
        createdAt: log.createdAt,
        superAdmin: log.superAdmin
          ? {
              id: log.superAdmin.id,
              name: [log.superAdmin.lastName, log.superAdmin.firstName].filter(Boolean).join(' '),
              email: log.superAdmin.email,
            }
          : null,
      })),
      stats: {
        ...tenant._count,
        activeClients,
        totalPaymentsAmount: Number(totalPayments._sum.amount || 0),
        totalRevenue,
        // Скидки по этому аккаунту — отдельной метрикой
        discountsGiven: tenantRevenue.discountsGiven,
        grossRevenue: tenantRevenue.grossRevenue,
        // Выдан ли текущий тариф вручную
        isGranted: (tenant.subscription as any)?.isGranted ?? false,
        lastPayment: lastPayment
          ? (() => {
              const b = breakdownPayment(lastPayment as any);
              return {
                amount: b.netAmount,
                originalAmount: b.listPrice,
                discountAmount: b.discountAmount,
                paidAt: lastPayment.paidAt,
                planType: b.planCode,
              };
            })()
          : null,
        lastActivity: lastActivity?.lastLogin,
      },
    },
  });
});

/**
 * Получение всех аккаунтов с детальной статистикой
 */
export const getAllTenants = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const { nameOf } = await loadPriceMap();

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

  // Количество клиентов считаем двумя групповыми запросами вместо запроса
  // на каждого тенанта: на списке из сотен школ это разница в разы.
  const [clientGroups, parentGroups] = await Promise.all([
    prisma.client.groupBy({ by: ['tenantId'], _count: { _all: true } }),
    prisma.parent.groupBy({ by: ['tenantId'], _count: { _all: true } }),
  ]);

  const clientsByTenant = new Map(clientGroups.map((g) => [g.tenantId, g._count._all]));
  const parentsByTenant = new Map(parentGroups.map((g) => [g.tenantId, g._count._all]));

  const tenantsWithStats = tenants.map((tenant) => {
    // Родители хранятся в отдельной таблице, но исторически могли попадать
    // в клиентов — вычитаем их, чтобы счётчик совпадал с интерфейсом школы.
    const clientsCount = Math.max(
      0,
      (clientsByTenant.get(tenant.id) || 0) - (parentsByTenant.get(tenant.id) || 0)
    );

    const sub = tenant.subscription as any;

    return {
      id: tenant.id,
      name: tenant.name,
      email: tenant.email,
      subdomain: tenant.subdomain,
      isActive: tenant.isActive,
      createdAt: tenant.createdAt,
      subscription: sub
        ? {
            planType: sub.planType,
            planName: nameOf(sub.planType),
            status: sub.status,
            startDate: sub.startDate,
            endDate: sub.endDate,
            // Запланированная смена тарифа: без этого поля интерфейс не мог
            // показать, что изменение отложено до конца оплаченного периода.
            nextPlanType: sub.nextPlanType,
            nextPlanName: sub.nextPlanType ? nameOf(sub.nextPlanType) : null,
            // Тариф выдан вручную супер-админом
            isGranted: sub.isGranted ?? false,
            grantedAt: sub.grantedAt ?? null,
            autoRenew: sub.autoRenew,
          }
        : null,
      stats: {
        admins: tenant._count.users,
        clients: clientsCount,
        trainers: tenant._count.trainers,
        branches: tenant._count.branches,
      },
    };
  });

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
  const { nameOf } = await loadPriceMap();

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

  // Платежи за подписки: применяем те же фильтры, что и к расходам.
  // Раньше фильтры к ним не применялись, из-за чего при выборе типа
  // «расход» в списке всё равно оставались все поступления.
  const includeSubscriptionIncome = !type || type === 'all' || type === 'income';

  const paymentWhere: any = { status: 'succeeded' };
  if (startDate || endDate) {
    paymentWhere.paidAt = {};
    if (startDate) {
      paymentWhere.paidAt.gte = new Date(startDate as string);
    }
    if (endDate) {
      const end = new Date(endDate as string);
      end.setHours(23, 59, 59, 999);
      paymentWhere.paidAt.lte = end;
    }
  }

  const [subscriptionPayments, subscriptionTotal] = includeSubscriptionIncome
    ? await Promise.all([
        prisma.subscriptionPayment.findMany({
          where: paymentWhere,
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
        }),
        prisma.subscriptionPayment.count({ where: paymentWhere }),
      ])
    : [[], 0];

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
      // Суммы берём из снимка платежа: цена в каталоге могла измениться,
      // но история выручки должна оставаться неизменной.
      const b = breakdownPayment(p);
      const planLabel = b.planCode ? nameOf(b.planCode) : 'тариф';

      return {
        id: p.id,
        type: 'income' as const,
        amount: b.netAmount, // Фактически полученная сумма
        originalAmount: b.listPrice, // Цена тарифа на момент оплаты
        discountAmount: b.discountAmount,
        description: `Платеж за подписку ${planLabel} от ${p.subscription.tenant.name}`,
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
      // Полное количество записей по фильтру, а не длина текущей страницы —
      // иначе пагинация на клиенте считала неверное число страниц.
      total: adminTotal + subscriptionTotal,
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

  // Запись в реестр и списание с баланса — одной транзакцией: иначе сбой
  // между операциями оставил бы выплату без списания или наоборот.
  const [transaction, updatedMarketer] = await prisma.$transaction([
    (prisma as any).adminTransaction.create({
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
    }),
    prisma.marketer.update({
      where: { id: marketerId },
      data: {
        balance: {
          decrement: paymentAmount,
        },
      },
    }),
  ]);

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
 * Выдача тарифа аккаунту супер-админом.
 *
 * В отличие от самостоятельной смены тарифа клиентом изменение применяется
 * сразу, независимо от уровня тарифа: раньше «понижение» лишь планировалось на
 * конец периода, из-за чего в интерфейсе тариф оставался прежним и казалось,
 * что изменения не сохранились.
 *
 * Подписка помечается как выданная (`isGranted`) и не попадает в финансовые
 * метрики; действие фиксируется в истории выдачи.
 */
export const updateTenantPlan = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const { tenantId } = req.params;
  const { planType, endDate, comment } = req.body;
  const superAdmin = (req as any).superAdmin;

  // Тариф проверяется по каталогу: список задаёт супер-админ.
  const plan = planType ? await PlanCatalogService.findByCode(planType) : null;
  if (!plan) {
    res.status(400).json({
      success: false,
      error: 'Тариф не найден',
    });
    return;
  }
  if (!plan.isActive) {
    res.status(400).json({
      success: false,
      error: `Тариф «${plan.name}» архивирован и не может быть выдан`,
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

  let parsedEndDate: Date | null = null;
  if (endDate) {
    parsedEndDate = new Date(endDate);
    if (Number.isNaN(parsedEndDate.getTime())) {
      res.status(400).json({ success: false, error: 'Некорректная дата окончания' });
      return;
    }
  }

  const { SubscriptionService } = await import('../services/subscriptionService');
  const updatedSubscription = await SubscriptionService.grantPlan({
    tenantId,
    planCode: planType,
    superAdminId: superAdmin?.id || null,
    endDate: parsedEndDate,
    comment: comment || null,
  });

  // Логируем действие
  await createAuditLog({
    superAdminId: superAdmin?.id,
    action: 'update_tenant_plan',
    entityType: 'tenant',
    entityId: tenantId,
    description: `Выдан тариф «${plan.name}» аккаунту ${tenant.name}${oldPlanType ? ` (был ${oldPlanType})` : ''}`,
    oldValue: { planType: oldPlanType, endDate: tenant.subscription?.endDate },
    newValue: { planType, endDate: updatedSubscription.endDate },
    ipAddress: getIpAddress(req),
    userAgent: getUserAgent(req),
  });

  res.json({
    success: true,
    data: {
      ...updatedSubscription,
      planName: plan.name,
    },
    message: `Тариф «${plan.name}» выдан аккаунту ${tenant.name}`,
  });
});

/**
 * Изменение срока действия тарифа аккаунта с записью в историю.
 */
export const updateTenantSubscriptionEndDate = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const { tenantId } = req.params;
    const { endDate, comment } = req.body;
    const superAdmin = (req as any).superAdmin;

    if (!endDate) {
      res.status(400).json({ success: false, error: 'Укажите новую дату окончания' });
      return;
    }

    const parsed = new Date(endDate);
    if (Number.isNaN(parsed.getTime())) {
      res.status(400).json({ success: false, error: 'Некорректная дата окончания' });
      return;
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { subscription: true },
    });

    if (!tenant || !tenant.subscription) {
      res.status(404).json({ success: false, error: 'Подписка аккаунта не найдена' });
      return;
    }

    const oldEndDate = tenant.subscription.endDate;

    const { SubscriptionService } = await import('../services/subscriptionService');
    const updated = await SubscriptionService.updateGrantedEndDate({
      tenantId,
      endDate: parsed,
      superAdminId: superAdmin?.id || null,
      comment: comment || null,
    });

    await createAuditLog({
      superAdminId: superAdmin?.id,
      action: 'update_subscription_end_date',
      entityType: 'tenant',
      entityId: tenantId,
      description: `Изменён срок тарифа аккаунта ${tenant.name}: ${
        oldEndDate ? oldEndDate.toISOString().slice(0, 10) : 'не задан'
      } → ${parsed.toISOString().slice(0, 10)}`,
      oldValue: { endDate: oldEndDate },
      newValue: { endDate: parsed },
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req),
    });

    res.json({ success: true, data: updated, message: 'Срок действия тарифа обновлён' });
  }
);

/** История выдачи и продления тарифов аккаунта. */
export const getTenantGrantHistory = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const { tenantId } = req.params;
    const { nameOf } = await loadPriceMap();

    const { SubscriptionService } = await import('../services/subscriptionService');
    const history = await SubscriptionService.getGrantHistory(tenantId);

    res.json({
      success: true,
      data: history.map((log: GrantLogWithAdmin) => ({
        id: log.id,
        action: log.action,
        planCode: log.planCode,
        planName: nameOf(log.planCode),
        oldPlanCode: log.oldPlanCode,
        oldPlanName: log.oldPlanCode ? nameOf(log.oldPlanCode) : null,
        oldEndDate: log.oldEndDate,
        newEndDate: log.newEndDate,
        comment: log.comment,
        createdAt: log.createdAt,
        superAdmin: log.superAdmin
          ? {
              id: log.superAdmin.id,
              name: [log.superAdmin.lastName, log.superAdmin.firstName].filter(Boolean).join(' '),
              email: log.superAdmin.email,
            }
          : null,
      })),
    });
  }
);

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
  const { priceOf } = await loadPriceMap();

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

  // Прогноз строим только по оплачиваемым подпискам: выданные вручную
  // и тарифы с договорной ценой денег не приносят.
  const billable = activeSubscriptions.filter((sub) => {
    if ((sub as any).isGranted) return false;
    const price = priceOf(sub.planType);
    return price !== null && price > 0;
  });

  const excludedGranted = activeSubscriptions.filter((sub) => (sub as any).isGranted).length;

  // Рассчитываем прогноз на основе текущих подписок
  const forecast: Record<string, number> = {};
  const today = new Date();
  const monthsAhead = 6; // Прогноз на 6 месяцев вперед

  for (let i = 0; i < monthsAhead; i++) {
    const monthDate = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
    forecast[monthKey] = 0;

    billable.forEach(sub => {
      const endDate = sub.endDate ? new Date(sub.endDate) : null;
      // Если подписка активна в этом месяце
      if (!endDate || endDate >= monthDate) {
        forecast[monthKey] += priceOf(sub.planType) || 0;
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
      /** Сколько активных подписок исключено как выданные вручную. */
      excludedGrantedCount: excludedGranted,
    },
  });
});

/**
 * Массовое обновление аккаунтов
 */
export const bulkUpdateTenants = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const { tenantIds, action, data } = req.body;
  const superAdmin = (req as any).superAdmin;

  if (!tenantIds || !Array.isArray(tenantIds) || tenantIds.length === 0) {
    res.status(400).json({
      success: false,
      error: 'Tenant IDs are required',
    });
    return;
  }

  const allowedActions = ['activate', 'deactivate', 'update_plan'];
  if (!allowedActions.includes(action)) {
    res.status(400).json({
      success: false,
      error: `Недопустимое действие. Доступны: ${allowedActions.join(', ')}`,
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
  } else if (action === 'update_plan') {
    // Тариф валидируем до применения: иначе часть аккаунтов успела бы
    // измениться, а остальные упали бы с ошибкой.
    const plan = data?.planType ? await PlanCatalogService.findByCode(data.planType) : null;
    if (!plan || !plan.isActive) {
      res.status(400).json({ success: false, error: 'Тариф не найден или архивирован' });
      return;
    }

    const { SubscriptionService } = await import('../services/subscriptionService');
    for (const tenantId of tenantIds) {
      await SubscriptionService.grantPlan({
        tenantId,
        planCode: plan.code,
        superAdminId: superAdmin?.id || null,
        endDate: data?.endDate ? new Date(data.endDate) : null,
        comment: data?.comment || 'Массовая выдача тарифа',
      });
    }
  }

  // Массовые операции тоже фиксируем в аудите.
  await createAuditLog({
    superAdminId: superAdmin?.id,
    action: `bulk_${action}`,
    entityType: 'tenant',
    description: `Массовое действие «${action}» для ${tenantIds.length} аккаунт(ов)`,
    newValue: { tenantIds, action, data: data || null },
    ipAddress: getIpAddress(req),
    userAgent: getUserAgent(req),
  });

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
  const { priceOf } = await loadPriceMap();

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

  // MRR (Monthly Recurring Revenue) — месячный повторяющийся доход.
  // Считаем только по оплачиваемым подпискам: выданные вручную тарифы
  // и тарифы с договорной ценой в MRR не входят.
  const activeSubscriptions = await prisma.subscription.findMany({
    where: {
      status: 'active',
    },
  });

  const mrrResult = calculateMrr(activeSubscriptions as any[], priceOf);
  const mrr = mrrResult.mrr;

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
      promoCodeUsage: true,
    },
  });

  // Фактически полученные деньги за период и отдельно — размер скидок.
  const periodTotals = sumPayments(paymentsInPeriod as any[]);
  const revenueInPeriod = periodTotals.netRevenue;

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

  // Конверсия в платные тарифы.
  // Платными считаем только реально оплаченные подписки: выданные вручную
  // тарифы конверсию не отражают.
  const [freeTenants, paidTenants] = await Promise.all([
    prisma.tenant.count({
      where: {
        subscription: {
          planType: 'FREE',
        },
      },
    }),
    prisma.tenant.count({
      where: {
        subscription: {
          planType: { not: 'FREE' },
          status: 'active',
          isGranted: false,
        },
      },
    }),
  ]);

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
      /** Сколько отдано скидками за период — отдельная метрика. */
      discountsInPeriod: periodTotals.discountsGiven,
      /** Сумма по прайсу без скидок за период. */
      grossRevenueInPeriod: periodTotals.grossRevenue,
      newTenants,
      churnRate: Number(churnRate.toFixed(2)),
      avgLTV: Number(avgLTV.toFixed(2)),
      cac: Number(cac.toFixed(2)),
      conversionRate: Number(conversionRate.toFixed(2)),
      totalActiveSubscriptions: activeSubscriptions.length,
      /** Из них оплачиваемых — они и формируют MRR. */
      billableSubscriptions: mrrResult.billableCount,
      /** Выданных вручную (в MRR не входят). */
      grantedSubscriptions: mrrResult.grantedCount,
      /** С договорной ценой (сумма неизвестна, в MRR не входят). */
      negotiableSubscriptions: mrrResult.negotiableCount,
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
        // Значения хранятся строкой; повреждённая запись не должна ломать
        // всю вкладку аудита, поэтому разбор защищён.
        oldValue: safeJsonParse(log.oldValue),
        newValue: safeJsonParse(log.newValue),
      })),
      total,
      limit: Number(limit),
      offset: Number(offset),
    },
  });
});

/** Разбор JSON из журнала аудита без падения на повреждённых данных. */
function safeJsonParse(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return { raw: value, parseError: true };
  }
}

/* ------------------------------------------------------------------ */
/* Управление тарифами                                                */
/* ------------------------------------------------------------------ */

/**
 * Список тарифов из каталога.
 *
 * Доступен супер-админу и персоналу платформы; изменять тарифы может только
 * супер-админ (см. маршруты и `requireSuperAdminWrite`).
 */
export const getPlanPrices = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const plans = await PlanCatalogService.listAll();

  // Показываем, сколько аккаунтов использует тариф: без этого непонятно,
  // можно ли его архивировать.
  const usage = await prisma.subscription.groupBy({
    by: ['planType'],
    _count: { _all: true },
  });
  const usageByCode = new Map(usage.map((u) => [u.planType, u._count._all]));

  res.json({
    success: true,
    data: plans.map((plan) => ({
      // planType сохранён для совместимости с существующим интерфейсом
      planType: plan.code,
      code: plan.code,
      name: plan.name,
      description: plan.description,
      price: plan.price,
      isNegotiable: plan.isNegotiable,
      limits: plan.limits,
      isPublic: plan.isPublic,
      isActive: plan.isActive,
      sortOrder: plan.sortOrder,
      supportLevel: plan.supportLevel,
      subscriptionsCount: usageByCode.get(plan.code) || 0,
    })),
  });
});

/**
 * Создание тарифа.
 * `isPublic: false` создаёт индивидуальный тариф — он не показывается
 * на странице тарифов и выдаётся только вручную.
 */
export const createPlan = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const superAdmin = (req as any).superAdmin;
  const plan = await PlanCatalogService.create(req.body);

  await createAuditLog({
    superAdminId: superAdmin?.id,
    action: 'create_plan',
    entityType: 'plan',
    entityId: plan.code,
    description: `Создан тариф ${plan.name} (${plan.code})${plan.isPublic ? '' : ', индивидуальный'}`,
    newValue: plan,
    ipAddress: getIpAddress(req),
    userAgent: getUserAgent(req),
  });

  res.status(201).json({ success: true, data: plan, message: 'Тариф создан' });
});

/**
 * Изменение тарифа: название, описание, цена, лимиты, публичность.
 * Код тарифа изменить нельзя — он связывает тариф с историей платежей.
 */
export const updatePlan = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const superAdmin = (req as any).superAdmin;
  const code = req.params.code || req.body.planType || req.body.code;

  const { plan, before } = await PlanCatalogService.update(code, req.body);

  await createAuditLog({
    superAdminId: superAdmin?.id,
    action: 'update_plan',
    entityType: 'plan',
    entityId: plan.code,
    description: `Изменён тариф ${before.name} (${plan.code})`,
    oldValue: before,
    newValue: plan,
    ipAddress: getIpAddress(req),
    userAgent: getUserAgent(req),
  });

  res.json({ success: true, data: plan, message: 'Тариф обновлён' });
});

/**
 * Архивация тарифа. Физического удаления нет: на тариф ссылается история.
 */
export const archivePlan = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const superAdmin = (req as any).superAdmin;
  const { code } = req.params;

  const plan = await PlanCatalogService.archive(code);

  await createAuditLog({
    superAdminId: superAdmin?.id,
    action: 'archive_plan',
    entityType: 'plan',
    entityId: code,
    description: `Тариф ${plan.name} (${code}) архивирован`,
    ipAddress: getIpAddress(req),
    userAgent: getUserAgent(req),
  });

  res.json({ success: true, data: plan, message: 'Тариф архивирован' });
});

/** Возврат тарифа из архива. */
export const restorePlan = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const superAdmin = (req as any).superAdmin;
  const { code } = req.params;

  const plan = await PlanCatalogService.restore(code);

  await createAuditLog({
    superAdminId: superAdmin?.id,
    action: 'restore_plan',
    entityType: 'plan',
    entityId: code,
    description: `Тариф ${plan.name} (${code}) восстановлен из архива`,
    ipAddress: getIpAddress(req),
    userAgent: getUserAgent(req),
  });

  res.json({ success: true, data: plan, message: 'Тариф восстановлен' });
});

/**
 * Совместимость с прежним эндпоинтом обновления цены.
 * Теперь изменения сохраняются в БД, а не в памяти процесса.
 */
export const updatePlanPrice = updatePlan;

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
  const { nameOf } = await loadPriceMap();

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

  // Подготавливаем данные для Excel.
  // Сортируем по исходной дате, а не по отформатированной строке:
  // локализованный вид даты не сортируется как дата.
  const excelRows: Array<{ sortKey: number; row: Record<string, unknown> }> = [
    ...adminTransactions.map((t: any) => ({
      sortKey: new Date(t.createdAt).getTime(),
      row: {
        'Дата': new Date(t.createdAt).toLocaleString('ru-RU'),
        'Тип': t.type === 'expense' ? 'Расход' : t.type === 'marketer_payment' ? 'Выплата маркетологу' : t.type,
        'Сумма': Number(t.amount),
        'Скидка': 0,
        'Описание': t.description,
        'Категория': t.category?.name || '',
        'Маркетолог': t.marketer?.name || '',
        'Супер-админ': t.superAdmin ? `${t.superAdmin.firstName} ${t.superAdmin.lastName}` : '',
        'Аккаунт': '',
        'Тариф': '',
      },
    })),
    ...subscriptionPayments.map((p: any) => {
      // Значения из снимка платежа: правка цены в каталоге не должна
      // менять уже выгруженную историю.
      const b = breakdownPayment(p);
      const planLabel = b.planCode ? nameOf(b.planCode) : '';
      const date = p.paidAt ? new Date(p.paidAt) : new Date(p.createdAt);

      return {
        sortKey: date.getTime(),
        row: {
          'Дата': date.toLocaleString('ru-RU'),
          'Тип': 'Доход',
          'Сумма': b.netAmount,
          'Скидка': b.discountAmount,
          'Описание': `Платеж за подписку ${planLabel} от ${p.subscription.tenant.name}`,
          'Категория': '',
          'Маркетолог': '',
          'Супер-админ': '',
          'Аккаунт': p.subscription.tenant.name,
          'Тариф': planLabel,
        },
      };
    }),
  ].sort((a, b) => b.sortKey - a.sortKey);

  const excelData = excelRows.map((r) => r.row);

  // Создаем Excel файл
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(excelData);

  // Устанавливаем ширину колонок
  worksheet['!cols'] = [
    { wch: 20 }, // Дата
    { wch: 20 }, // Тип
    { wch: 15 }, // Сумма
    { wch: 12 }, // Скидка
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
