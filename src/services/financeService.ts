import { Prisma, PrismaClient } from '@prisma/client';
import { badRequest, notFound } from '../utils/httpError';

const prisma = new PrismaClient();

export type FinanceDirection = 'income' | 'expense';

export interface FinanceOperationFilters {
  dateFrom?: Date;
  dateTo?: Date;
  datePreset?: string;
  search?: string;
  amountFrom?: number;
  amountTo?: number;
  typeCodes?: string[];
  groupIds?: string[];
  branchIds?: string[];
  clientIds?: string[];
  trainerIds?: string[];
  direction?: FinanceDirection;
  sortBy?: 'title' | 'typeCode' | 'amount' | 'occurredAt';
  sortDir?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

function applyDatePreset(preset?: string): { from?: Date; to?: Date } {
  if (!preset) return {};
  const now = new Date();
  const startOfDay = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  };
  const endOfDay = (d: Date) => {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
  };

  switch (preset) {
    case 'today':
      return { from: startOfDay(now), to: endOfDay(now) };
    case 'yesterday': {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { from: startOfDay(y), to: endOfDay(y) };
    }
    case 'this_week': {
      const from = startOfDay(now);
      const day = from.getDay() || 7;
      from.setDate(from.getDate() - day + 1);
      return { from, to: endOfDay(now) };
    }
    case 'this_month': {
      const from = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
      return { from, to: endOfDay(now) };
    }
    case 'last_month': {
      const from = startOfDay(new Date(now.getFullYear(), now.getMonth() - 1, 1));
      const to = endOfDay(new Date(now.getFullYear(), now.getMonth(), 0));
      return { from, to };
    }
    default:
      return {};
  }
}

export class FinanceService {
  static async listTypes(tenantId: string) {
    const rows = await prisma.financeOperationType.findMany({
      where: {
        isActive: true,
        OR: [{ tenantId: null }, { tenantId }],
      },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });
    return rows;
  }

  static async createType(
    tenantId: string,
    input: { code?: string; name: string; defaultDirection?: FinanceDirection }
  ) {
    const name = (input.name || '').trim();
    if (name.length < 2) throw badRequest('Название типа должно содержать минимум 2 символа', 'name');

    const code =
      (input.code || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_]+/g, '_')
        .replace(/^_+|_+$/g, '') ||
      `custom_${Date.now().toString(36)}`;

    const existing = await prisma.financeOperationType.findFirst({
      where: {
        code,
        OR: [{ tenantId: null }, { tenantId }],
      },
    });
    if (existing) throw badRequest(`Тип с кодом «${code}» уже существует`, 'code');

    return prisma.financeOperationType.create({
      data: {
        tenantId,
        code,
        name,
        defaultDirection: input.defaultDirection === 'income' ? 'income' : 'expense',
        isSystem: false,
        isActive: true,
      },
    });
  }

  static async listOperations(tenantId: string, filters: FinanceOperationFilters = {}) {
    const preset = applyDatePreset(filters.datePreset);
    const dateFrom = filters.dateFrom || preset.from;
    const dateTo = filters.dateTo || preset.to;

    const where: Prisma.FinanceOperationWhereInput = {
      tenantId,
      ...(filters.direction ? { direction: filters.direction } : {}),
      ...(filters.typeCodes?.length ? { typeCode: { in: filters.typeCodes } } : {}),
      ...(filters.groupIds?.length ? { groupId: { in: filters.groupIds } } : {}),
      ...(filters.branchIds?.length ? { branchId: { in: filters.branchIds } } : {}),
      ...(filters.clientIds?.length ? { clientId: { in: filters.clientIds } } : {}),
      ...(filters.trainerIds?.length ? { trainerId: { in: filters.trainerIds } } : {}),
      ...(dateFrom || dateTo
        ? {
            occurredAt: {
              ...(dateFrom ? { gte: dateFrom } : {}),
              ...(dateTo ? { lte: dateTo } : {}),
            },
          }
        : {}),
      ...(filters.amountFrom != null || filters.amountTo != null
        ? {
            amount: {
              ...(filters.amountFrom != null ? { gte: filters.amountFrom } : {}),
              ...(filters.amountTo != null ? { lte: filters.amountTo } : {}),
            },
          }
        : {}),
      ...(filters.search
        ? {
            OR: [
              { title: { contains: filters.search, mode: 'insensitive' } },
              { notes: { contains: filters.search, mode: 'insensitive' } },
              { typeCode: { contains: filters.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const sortBy = filters.sortBy || 'occurredAt';
    const sortDir = filters.sortDir === 'asc' ? 'asc' : 'desc';
    const orderBy: Prisma.FinanceOperationOrderByWithRelationInput = { [sortBy]: sortDir };

    const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500);
    const offset = Math.max(filters.offset ?? 0, 0);

    const [items, total] = await Promise.all([
      prisma.financeOperation.findMany({
        where,
        orderBy,
        take: limit,
        skip: offset,
        include: {
          client: { select: { id: true, firstName: true, lastName: true, middleName: true } },
          trainer: {
            select: {
              id: true,
              user: { select: { firstName: true, lastName: true } },
            },
          },
          group: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true } },
        },
      }),
      prisma.financeOperation.count({ where }),
    ]);

    const types = await this.listTypes(tenantId);
    const typeMap = new Map(types.map((t) => [t.code, t.name]));

    return {
      items: items.map((op) => ({
        id: op.id,
        direction: op.direction,
        typeCode: op.typeCode,
        typeName: typeMap.get(op.typeCode) || op.typeCode,
        title: op.title,
        amount: Number(op.amount),
        occurredAt: op.occurredAt,
        notes: op.notes,
        clientId: op.clientId,
        trainerId: op.trainerId,
        groupId: op.groupId,
        branchId: op.branchId,
        paymentId: op.paymentId,
        client: op.client,
        trainer: op.trainer
          ? {
              id: op.trainer.id,
              firstName: op.trainer.user.firstName,
              lastName: op.trainer.user.lastName,
            }
          : null,
        group: op.group,
        branch: op.branch,
      })),
      total,
      limit,
      offset,
    };
  }

  static async createOperation(
    tenantId: string,
    input: {
      direction: FinanceDirection;
      typeCode: string;
      title: string;
      amount: number;
      occurredAt?: Date | string;
      notes?: string | null;
      clientId?: string | null;
      trainerId?: string | null;
      groupId?: string | null;
      branchId?: string | null;
      paymentId?: string | null;
      createdById?: string | null;
    }
  ) {
    const title = (input.title || '').trim();
    if (!title) throw badRequest('Укажите наименование операции', 'title');
    if (!input.typeCode) throw badRequest('Укажите тип операции', 'typeCode');
    if (!['income', 'expense'].includes(input.direction)) {
      throw badRequest('Тип движения: income или expense', 'direction');
    }
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw badRequest('Сумма должна быть больше 0', 'amount');
    }

    const type = await prisma.financeOperationType.findFirst({
      where: {
        code: input.typeCode,
        isActive: true,
        OR: [{ tenantId: null }, { tenantId }],
      },
    });
    if (!type) throw badRequest(`Неизвестный тип операции «${input.typeCode}»`, 'typeCode');

    if (input.paymentId) {
      const existing = await prisma.financeOperation.findUnique({
        where: { paymentId: input.paymentId },
      });
      if (existing) return existing;
    }

    const isBonusAccrual =
      input.typeCode === 'bonus' && input.direction === 'expense' && Boolean(input.trainerId);
    const isClientCharge =
      input.direction === 'expense' && Boolean(input.clientId) && input.typeCode !== 'bonus';

    if (isBonusAccrual) {
      const trainer = await prisma.trainer.findFirst({
        where: { id: input.trainerId!, tenantId },
      });
      if (!trainer) throw badRequest('Тренер не найден', 'trainerId');
    }

    if (isClientCharge) {
      const client = await prisma.client.findFirst({
        where: { id: input.clientId!, tenantId },
      });
      if (!client) throw badRequest('Клиент не найден', 'clientId');
    }

    return prisma.$transaction(async (tx) => {
      const op = await tx.financeOperation.create({
        data: {
          tenantId,
          direction: input.direction,
          typeCode: input.typeCode,
          title,
          amount,
          occurredAt: input.occurredAt ? new Date(input.occurredAt) : new Date(),
          notes: input.notes?.trim() || null,
          clientId: input.clientId || null,
          trainerId: input.trainerId || null,
          groupId: input.groupId || null,
          branchId: input.branchId || null,
          paymentId: input.paymentId || null,
          createdById: input.createdById || null,
        },
      });

      if (isBonusAccrual) {
        await tx.trainer.update({
          where: { id: input.trainerId! },
          data: { balance: { increment: amount } },
        });
      }

      if (isClientCharge) {
        await tx.payment.create({
          data: {
            tenantId,
            clientId: input.clientId!,
            amount,
            type: 'membership',
            status: 'pending',
            isMonthlyPayment: true,
            notes: input.notes?.trim() || `Начисление: ${title}`,
            dueDate: input.occurredAt ? new Date(input.occurredAt) : new Date(),
          },
        });
      }

      return op;
    });
  }

  /** Идемпотентно создаёт приход при оплате абонемента/платежа клиента. */
  static async recordPaymentIncome(payment: {
    id: string;
    amount: any;
    status: string;
    type: string;
    clientId: string;
    branchId?: string | null;
    groupId?: string | null;
    tenantId: string;
    paidAt?: Date | null;
    notes?: string | null;
  }, clientName?: string) {
    if (payment.status !== 'paid') return null;

    const existing = await prisma.financeOperation.findUnique({
      where: { paymentId: payment.id },
    });
    if (existing) return existing;

    const isMembership = payment.type === 'membership' || payment.type === 'monthly';
    const typeCode = isMembership ? 'membership' : 'client_payment';
    const title = clientName
      ? clientName
      : isMembership
        ? 'Оплата абонемента'
        : 'Принятие оплаты от клиента';

    return this.createOperation(payment.tenantId, {
      direction: 'income',
      typeCode,
      title,
      amount: Number(payment.amount),
      occurredAt: payment.paidAt || new Date(),
      notes: payment.notes,
      clientId: payment.clientId,
      branchId: payment.branchId,
      groupId: payment.groupId,
      paymentId: payment.id,
    });
  }

  static async payoutTrainerSalary(
    tenantId: string,
    input: {
      trainerId: string;
      amount: number;
      periodLabel?: string;
      occurredAt?: Date | string;
      notes?: string | null;
      createdById?: string | null;
    }
  ) {
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw badRequest('Сумма выплаты должна быть больше 0', 'amount');
    }

    const trainer = await prisma.trainer.findFirst({
      where: { id: input.trainerId, tenantId },
      include: { user: true },
    });
    if (!trainer) throw notFound('Тренер не найден', 'trainerId');

    const name = `${trainer.user.lastName} ${trainer.user.firstName}`.trim();
    const title = input.periodLabel ? `${name} — ${input.periodLabel}` : name;

    const operation = await prisma.$transaction(async (tx) => {
      const op = await tx.financeOperation.create({
        data: {
          tenantId,
          direction: 'expense',
          typeCode: 'salary',
          title,
          amount,
          occurredAt: input.occurredAt ? new Date(input.occurredAt) : new Date(),
          notes: input.notes?.trim() || null,
          trainerId: trainer.id,
          createdById: input.createdById || null,
        },
      });

      await tx.trainer.update({
        where: { id: trainer.id },
        data: { balance: { decrement: amount } },
      });

      return op;
    });

    return operation;
  }

  /** Сводка абонементов: клиент / стоимость / оплачено / долг. */
  static async membershipSummary(
    tenantId: string,
    filters: {
      clientIds?: string[];
      trainerIds?: string[];
      branchIds?: string[];
      groupIds?: string[];
      search?: string;
      amountFrom?: number;
      amountTo?: number;
    } = {}
  ) {
    const clients = await prisma.client.findMany({
      where: {
        tenantId,
        isActive: true,
        ...(filters.clientIds?.length ? { id: { in: filters.clientIds } } : {}),
        ...(filters.search
          ? {
              OR: [
                { firstName: { contains: filters.search, mode: 'insensitive' } },
                { lastName: { contains: filters.search, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(filters.groupIds?.length || filters.trainerIds?.length || filters.branchIds?.length
          ? {
              groupMemberships: {
                some: {
                  isActive: true,
                  ...(filters.groupIds?.length ? { groupId: { in: filters.groupIds } } : {}),
                  group: {
                    ...(filters.trainerIds?.length ? { trainerId: { in: filters.trainerIds } } : {}),
                    ...(filters.branchIds?.length ? { branchId: { in: filters.branchIds } } : {}),
                  },
                },
              },
            }
          : {}),
      },
      include: {
        payments: {
          where: {
            OR: [{ type: 'membership' }, { isMonthlyPayment: true }],
          },
          orderBy: { createdAt: 'desc' },
        },
        groupMemberships: {
          where: { isActive: true },
          include: {
            group: {
              select: { id: true, name: true, trainerId: true, branchId: true, monthlyPaymentAmount: true },
            },
          },
        },
      },
    });

    const rows = clients.map((client) => {
      const pending = client.payments.filter((p) => p.status === 'pending' || p.status === 'overdue');
      const paid = client.payments.filter((p) => p.status === 'paid');
      const dueAmount = pending.reduce((s, p) => s + Number(p.amount), 0);
      const paidAmount = paid.reduce((s, p) => s + Number(p.amount), 0);
      const latest = client.payments[0];
      const membershipPrice = latest
        ? Number(latest.originalAmount ?? latest.amount)
        : Number(client.groupMemberships[0]?.group?.monthlyPaymentAmount || 0);

      let status: 'paid' | 'unpaid' | 'partial' = 'unpaid';
      if (dueAmount <= 0 && paidAmount > 0) status = 'paid';
      else if (dueAmount > 0 && paidAmount > 0) status = 'partial';
      else if (dueAmount <= 0 && paidAmount <= 0) status = 'paid';

      return {
        clientId: client.id,
        clientName: `${client.lastName} ${client.firstName}${client.middleName ? ` ${client.middleName}` : ''}`.trim(),
        membershipPrice,
        paidAmount,
        debt: dueAmount,
        remaining: membershipPrice - paidAmount,
        status,
        latestPaymentId: latest?.id || null,
        groups: client.groupMemberships.map((gm) => gm.group),
      };
    });

    return rows.filter((r) => {
      if (filters.amountFrom != null && r.membershipPrice < filters.amountFrom) return false;
      if (filters.amountTo != null && r.membershipPrice > filters.amountTo) return false;
      return true;
    });
  }

  /** Сводка зарплат тренеров за период. */
  static async salarySummary(
    tenantId: string,
    filters: {
      trainerIds?: string[];
      dateFrom?: Date;
      dateTo?: Date;
      amountFrom?: number;
      amountTo?: number;
    } = {}
  ) {
    const dateFrom = filters.dateFrom || new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const dateTo = filters.dateTo || new Date();

    const trainers = await prisma.trainer.findMany({
      where: {
        tenantId,
        isActive: true,
        ...(filters.trainerIds?.length ? { id: { in: filters.trainerIds } } : {}),
      },
      include: {
        user: { select: { firstName: true, lastName: true } },
        trainings: {
          where: {
            startTime: { gte: dateFrom, lte: dateTo },
          },
          select: { id: true },
        },
        financeOperations: {
          where: {
            typeCode: 'salary',
            direction: 'expense',
            occurredAt: { gte: dateFrom, lte: dateTo },
          },
        },
      },
    });

    return trainers
      .map((t) => {
        const paid = t.financeOperations.reduce((s, op) => s + Number(op.amount), 0);
        const accrued = Number(t.balance) + paid;
        const remaining = accrued - paid;
        return {
          trainerId: t.id,
          trainerName: `${t.user.lastName} ${t.user.firstName}`.trim(),
          periodStart: dateFrom,
          periodEnd: dateTo,
          trainingsCount: t.trainings.length,
          accrued,
          paid,
          remaining,
        };
      })
      .filter((r) => {
        if (filters.amountFrom != null && r.accrued < filters.amountFrom) return false;
        if (filters.amountTo != null && r.accrued > filters.amountTo) return false;
        return true;
      });
  }

  /** Справочники для фильтров и форм — один запрос вместо пяти. */
  static async getRefs(tenantId: string) {
    const [types, clients, trainers, groups, branches] = await Promise.all([
      this.listTypes(tenantId),
      prisma.client.findMany({
        where: { tenantId },
        select: { id: true, firstName: true, lastName: true, middleName: true },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        take: 500,
      }),
      prisma.trainer.findMany({
        where: { tenantId, isActive: true },
        include: { user: { select: { firstName: true, lastName: true, middleName: true } } },
        take: 200,
      }),
      prisma.group.findMany({
        where: { tenantId, isActive: true },
        select: { id: true, name: true, branchId: true },
        orderBy: { name: 'asc' },
        take: 200,
      }),
      prisma.branch.findMany({
        where: { tenantId, isActive: true },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
        take: 100,
      }),
    ]);
    return { types, clients, trainers, groups, branches };
  }
}
