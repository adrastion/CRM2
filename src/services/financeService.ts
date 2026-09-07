import { prisma } from '../lib/prisma';
import { FinanceOperationType, Prisma } from '@prisma/client';
import { badRequest, notFound } from '../utils/httpError';

type TrainerSalarySummaryRow = Prisma.TrainerGetPayload<{
  include: {
    user: { select: { firstName: true; lastName: true } };
    trainings: { select: { id: true } };
    financeOperations: true;
    salaryLedgers: true;
  };
}>;

type FinanceOperationListRow = Prisma.FinanceOperationGetPayload<{
  include: {
    client: { select: { id: true; firstName: true; lastName: true; middleName: true } };
    trainer: {
      select: { id: true; user: { select: { firstName: true; lastName: true } } };
    };
    group: { select: { id: true; name: true } };
    branch: { select: { id: true; name: true } };
  };
}>;

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
    const typeMap = new Map(types.map((t: FinanceOperationType) => [t.code, t.name]));

    return {
      items: items.map((op: FinanceOperationListRow) => ({
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
      externalKey?: string | null;
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

    if (input.externalKey) {
      const existing = await prisma.financeOperation.findFirst({
        where: { tenantId, externalKey: input.externalKey },
      });
      if (existing) return existing;
    }

    const isBonusAccrual =
      input.typeCode === 'bonus' && input.direction === 'expense' && Boolean(input.trainerId);
    // Ручное «начисление клиенту» из формы — только для прочих/кастомных expense, не системных списаний
    const autoPendingPaymentTypes = new Set([
      'other',
      'purchase',
      'advertising',
      'rent',
    ]);
    const isClientCharge =
      input.direction === 'expense' &&
      Boolean(input.clientId) &&
      autoPendingPaymentTypes.has(input.typeCode);

    if (isBonusAccrual) {
      const trainer = await prisma.trainer.findFirst({
        where: { id: input.trainerId!, tenantId },
      });
      if (!trainer) throw badRequest('Тренер не найден', 'trainerId');
    }

    if (isClientCharge || (input.clientId && input.direction === 'expense')) {
      if (input.clientId) {
        const client = await prisma.client.findFirst({
          where: { id: input.clientId, tenantId },
        });
        if (!client) throw badRequest('Клиент не найден', 'clientId');
      }
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
          externalKey: input.externalKey || null,
          createdById: input.createdById || null,
        },
      });

      if (isBonusAccrual) {
        await tx.trainer.update({
          where: { id: input.trainerId! },
          data: { balance: { increment: amount } },
        });
        await tx.trainerSalaryLedger.create({
          data: {
            tenantId,
            trainerId: input.trainerId!,
            kind: 'bonus',
            amount,
            occurredAt: input.occurredAt ? new Date(input.occurredAt) : new Date(),
            personName: null,
            title: title || 'Премия',
            comment: input.notes?.trim() || 'премия',
          },
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

  /** Идемпотентно создаёт приход при оплате абонемента/платежа клиента + пополняет баланс. */
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

    const isMembership = payment.type === 'membership' || payment.type === 'monthly' || payment.type === 'monthly_payment';
    const typeCode = isMembership ? 'membership' : 'client_payment';
    const title = clientName
      ? clientName
      : isMembership
        ? 'Оплата абонемента'
        : 'Принятие оплаты от клиента';

    const amount = Number(payment.amount);
    const op = await this.createOperation(payment.tenantId, {
      direction: 'income',
      typeCode,
      title,
      amount,
      occurredAt: payment.paidAt || new Date(),
      notes: payment.notes,
      clientId: payment.clientId,
      branchId: payment.branchId,
      groupId: payment.groupId,
      paymentId: payment.id,
    });

    // Пополнение кошелька клиента (идемпотентно через наличие income-op выше)
    await prisma.client.update({
      where: { id: payment.clientId },
      data: { balance: { increment: amount } },
    }).catch(() => undefined);

    return op;
  }

  /**
   * Уменьшить «выплачено» (ввод −N в диалоге).
   * Paid-платёж с отрицательной суммой + expense в реестре + откат баланса клиента.
   */
  static async reduceMembershipPaid(
    tenantId: string,
    input: {
      clientId?: string | null;
      paymentId?: string | null;
      amount: number;
      notes?: string | null;
      createdById?: string | null;
    }
  ) {
    const requested = Math.abs(Number(input.amount));
    if (!Number.isFinite(requested) || requested <= 0) {
      throw badRequest('Некорректная сумма', 'amount');
    }

    let clientId = input.clientId || null;
    let ref: {
      type: string;
      isMonthlyPayment: boolean;
      branchId: string | null;
      groupId: string | null;
      membershipId: string | null;
    } | null = null;

    if (input.paymentId) {
      const payment = await prisma.payment.findFirst({
        where: { id: input.paymentId, tenantId },
      });
      if (!payment) throw badRequest('Платёж не найден', 'paymentId');
      clientId = payment.clientId;
      ref = payment;
    }

    if (!clientId) throw badRequest('Укажите клиента', 'clientId');

    const client = await prisma.client.findFirst({
      where: { id: clientId, tenantId },
    });
    if (!client) throw badRequest('Клиент не найден', 'clientId');

    const paidPayments = await prisma.payment.findMany({
      where: {
        tenantId,
        clientId,
        status: 'paid',
        OR: [
          { type: 'membership' },
          { type: 'monthly' },
          { type: 'monthly_payment' },
          { isMonthlyPayment: true },
        ],
      },
    });
    const currentPaid = paidPayments.reduce((s, p) => s + Number(p.amount), 0);
    if (currentPaid <= 0) {
      throw badRequest('Нечего уменьшать: выплачено уже 0');
    }

    const reduceBy = Math.min(requested, currentPaid);
    const clientName = `${client.lastName} ${client.firstName}`.trim();

    const correction = await prisma.payment.create({
      data: {
        tenantId,
        clientId,
        amount: -reduceBy,
        type: ref?.type || 'membership',
        status: 'paid',
        paidAt: new Date(),
        isMonthlyPayment: ref?.isMonthlyPayment ?? true,
        branchId: ref?.branchId ?? null,
        groupId: ref?.groupId ?? null,
        membershipId: ref?.membershipId ?? null,
        notes:
          input.notes?.trim() ||
          `Корректировка выплачено −${reduceBy.toLocaleString('ru-RU')} ₽`,
      },
      include: { client: true },
    });

    await prisma.client.update({
      where: { id: clientId },
      data: { balance: { decrement: reduceBy } },
    });

    const isMembership =
      correction.type === 'membership' ||
      correction.type === 'monthly' ||
      correction.type === 'monthly_payment' ||
      correction.isMonthlyPayment;
    const op = await this.createOperation(tenantId, {
      direction: 'expense',
      typeCode: isMembership ? 'membership' : 'client_payment',
      title: `${clientName} — корректировка оплаты`,
      amount: reduceBy,
      occurredAt: new Date(),
      notes: correction.notes,
      clientId,
      branchId: correction.branchId,
      groupId: correction.groupId,
      paymentId: correction.id,
      createdById: input.createdById,
    });

    return {
      payment: correction,
      reducedBy: reduceBy,
      paidBefore: currentPaid,
      paidAfter: currentPaid - reduceBy,
      operation: op,
    };
  }

  /** Выдача абонемента: списание с баланса клиента + операция. */
  static async recordMembershipIssue(params: {
    tenantId: string;
    clientId: string;
    clientMembershipId: string;
    amount: number;
    title: string;
    occurredAt?: Date;
  }) {
    const amount = Number(params.amount);
    if (!Number.isFinite(amount) || amount <= 0) return null;

    const externalKey = `membership_issue:${params.clientMembershipId}`;
    const existing = await prisma.financeOperation.findFirst({
      where: { tenantId: params.tenantId, externalKey },
    });
    if (existing) return existing;

    await prisma.client.update({
      where: { id: params.clientId },
      data: { balance: { decrement: amount } },
    });

    return this.createOperation(params.tenantId, {
      direction: 'expense',
      typeCode: 'membership_issue',
      title: params.title,
      amount,
      occurredAt: params.occurredAt || new Date(),
      clientId: params.clientId,
      externalKey,
      notes: 'Выдача абонемента',
    });
  }

  /** Счёт / наступление оплаты: списание с баланса + операция. */
  static async recordMembershipCharge(params: {
    tenantId: string;
    clientId: string;
    paymentId: string;
    amount: number;
    title: string;
    occurredAt?: Date;
    groupId?: string | null;
    branchId?: string | null;
  }) {
    const amount = Number(params.amount);
    if (!Number.isFinite(amount) || amount <= 0) return null;

    const externalKey = `membership_charge:${params.paymentId}`;
    const existing = await prisma.financeOperation.findFirst({
      where: { tenantId: params.tenantId, externalKey },
    });
    if (existing) return existing;

    await prisma.client.update({
      where: { id: params.clientId },
      data: { balance: { decrement: amount } },
    });

    return this.createOperation(params.tenantId, {
      direction: 'expense',
      typeCode: 'membership_charge',
      title: params.title,
      amount,
      occurredAt: params.occurredAt || new Date(),
      clientId: params.clientId,
      groupId: params.groupId,
      branchId: params.branchId,
      externalKey,
      notes: `Выставлен счёт / paymentId=${params.paymentId}`,
    });
  }

  /**
   * Зеркало начисления тренеру в «Все операции» (баланс уже изменён через salary ledger).
   */
  static async recordSalaryAccrual(params: {
    tenantId: string;
    trainerId: string;
    amount: number;
    title: string;
    externalKey: string;
    occurredAt?: Date;
    clientId?: string | null;
    groupId?: string | null;
    notes?: string | null;
  }) {
    const amount = Number(params.amount);
    if (!Number.isFinite(amount) || amount <= 0) return null;

    return this.createOperation(params.tenantId, {
      direction: 'expense',
      typeCode: 'salary_accrual',
      title: params.title,
      amount,
      occurredAt: params.occurredAt || new Date(),
      trainerId: params.trainerId,
      clientId: params.clientId,
      groupId: params.groupId,
      externalKey: params.externalKey,
      notes: params.notes || 'Начисление зарплаты',
    });
  }

  /** Удаление операции = отмена с откатом связанных эффектов. */
  static async deleteOperation(tenantId: string, operationId: string) {
    const op = await prisma.financeOperation.findFirst({
      where: { id: operationId, tenantId },
    });
    if (!op) throw notFound('Операция не найдена');

    const amount = Number(op.amount);

    await prisma.$transaction(async (tx) => {
      if (op.typeCode === 'salary' && op.direction === 'expense' && op.trainerId) {
        await tx.trainer.update({
          where: { id: op.trainerId },
          data: { balance: { increment: amount } },
        });
        // Удаляем последнюю payout-запись на эту сумму около даты операции
        const payout = await tx.trainerSalaryLedger.findFirst({
          where: {
            tenantId,
            trainerId: op.trainerId,
            kind: 'payout',
            amount: -amount,
          },
          orderBy: { occurredAt: 'desc' },
        });
        if (payout) {
          await tx.trainerSalaryLedger.delete({ where: { id: payout.id } });
        }
      }

      if (op.typeCode === 'bonus' && op.trainerId) {
        await tx.trainer.update({
          where: { id: op.trainerId },
          data: { balance: { decrement: amount } },
        });
        const bonus = await tx.trainerSalaryLedger.findFirst({
          where: {
            tenantId,
            trainerId: op.trainerId,
            kind: 'bonus',
            amount,
          },
          orderBy: { occurredAt: 'desc' },
        });
        if (bonus) await tx.trainerSalaryLedger.delete({ where: { id: bonus.id } });
      }

      if (op.typeCode === 'salary_accrual' && op.trainerId) {
        await tx.trainer.update({
          where: { id: op.trainerId },
          data: { balance: { decrement: amount } },
        });
        if (op.externalKey?.startsWith('salary_accrual:attendance:')) {
          const attendanceId = op.externalKey.replace('salary_accrual:attendance:', '');
          await tx.trainerSalaryLedger.deleteMany({
            where: { tenantId, trainerId: op.trainerId, attendanceId },
          });
        } else if (op.externalKey?.startsWith('salary_accrual:payment:')) {
          // salary_accrual:payment:{paymentId}:{trainerId}
          const paymentId = op.externalKey.split(':')[2];
          if (paymentId) {
            await tx.trainerSalaryLedger.deleteMany({
              where: {
                tenantId,
                trainerId: op.trainerId,
                paymentId,
                kind: { in: ['membership_share', 'membership_percent'] },
              },
            });
          }
        } else if (op.externalKey?.startsWith('salary_accrual:fixed_monthly:')) {
          // salary_accrual:fixed_monthly:{trainerId}:{periodKey}
          const periodKey = op.externalKey.split(':').slice(3).join(':');
          if (periodKey) {
            await tx.trainerSalaryLedger.deleteMany({
              where: {
                tenantId,
                trainerId: op.trainerId,
                kind: 'fixed_monthly',
                periodKey,
              },
            });
          }
        } else if (op.externalKey?.startsWith('salary_ledger:')) {
          const ledgerId = op.externalKey.replace('salary_ledger:', '');
          await tx.trainerSalaryLedger.delete({ where: { id: ledgerId } }).catch(() => undefined);
        }
      }

      if (
        (op.typeCode === 'membership_issue' || op.typeCode === 'membership_charge') &&
        op.clientId
      ) {
        await tx.client.update({
          where: { id: op.clientId },
          data: { balance: { increment: amount } },
        });
        if (op.typeCode === 'membership_issue' && op.externalKey?.startsWith('membership_issue:')) {
          const cmId = op.externalKey.replace('membership_issue:', '');
          await tx.clientMembership.update({
            where: { id: cmId },
            data: { isActive: false },
          }).catch(() => undefined);
        }
      }

      if (
        (op.typeCode === 'membership' || op.typeCode === 'client_payment') &&
        op.direction === 'income' &&
        op.clientId
      ) {
        await tx.client.update({
          where: { id: op.clientId },
          data: { balance: { decrement: amount } },
        });
        if (op.paymentId) {
          await tx.payment.update({
            where: { id: op.paymentId },
            data: { status: 'cancelled', paidAt: null },
          });
        }
      }

      // Корректировка «выплачено» со знаком минус (expense + payment с отрицательной суммой)
      if (
        (op.typeCode === 'membership' || op.typeCode === 'client_payment') &&
        op.direction === 'expense' &&
        op.clientId &&
        op.paymentId
      ) {
        await tx.client.update({
          where: { id: op.clientId },
          data: { balance: { increment: amount } },
        });
        await tx.payment.update({
          where: { id: op.paymentId },
          data: { status: 'cancelled', paidAt: null },
        }).catch(() => undefined);
      }

      if (op.paymentId && op.typeCode === 'membership_charge') {
        await tx.payment.update({
          where: { id: op.paymentId },
          data: { status: 'cancelled' },
        }).catch(() => undefined);
      }

      if (op.typeCode === 'membership_charge' && op.notes?.includes('paymentId=')) {
        const pid = op.notes.split('paymentId=')[1]?.trim();
        if (pid) {
          await tx.payment.update({
            where: { id: pid },
            data: { status: 'cancelled' },
          }).catch(() => undefined);
        }
      }

      await tx.financeOperation.delete({ where: { id: op.id } });
    });

    return { deleted: true, id: operationId };
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

      await tx.trainerSalaryLedger.create({
        data: {
          tenantId,
          trainerId: trainer.id,
          kind: 'payout',
          amount: -amount,
          occurredAt: input.occurredAt ? new Date(input.occurredAt) : new Date(),
          personName: null,
          title: 'Выплата зарплаты',
          comment: input.notes?.trim() || input.periodLabel || 'выплата',
        },
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
      /** all — все тренировки в периоде; conducted — только проведённые (не отменены, уже закончились) */
      trainingsMode?: 'all' | 'conducted';
    } = {}
  ) {
    const dateFrom = filters.dateFrom || new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const dateTo = filters.dateTo || new Date();
    const trainingsMode = filters.trainingsMode === 'conducted' ? 'conducted' : 'all';
    const now = new Date();

    const trainingsWhere =
      trainingsMode === 'conducted'
        ? {
            startTime: { gte: dateFrom, lte: dateTo },
            isCancelled: false,
            endTime: { lte: now },
          }
        : {
            startTime: { gte: dateFrom, lte: dateTo },
          };

    const trainers = await prisma.trainer.findMany({
      where: {
        tenantId,
        isActive: true,
        ...(filters.trainerIds?.length ? { id: { in: filters.trainerIds } } : {}),
      },
      include: {
        user: { select: { firstName: true, lastName: true } },
        trainings: {
          where: trainingsWhere,
          select: { id: true },
        },
        // Выплачено — расходы кассы type=salary за период
        financeOperations: {
          where: {
            typeCode: 'salary',
            direction: 'expense',
            occurredAt: { gte: dateFrom, lte: dateTo },
          },
        },
        // Начисления и выплаты в реестре за период (payout отдельно отсекаем при суммировании)
        salaryLedgers: {
          where: {
            occurredAt: { gte: dateFrom, lte: dateTo },
          },
        },
      },
    });

    return (trainers as TrainerSalarySummaryRow[])
      .map((t) => {
        const paid = t.financeOperations.reduce(
          (s: number, op) => s + Number(op.amount),
          0
        );
        const accrualRows = t.salaryLedgers.filter((row) => row.kind !== 'payout');
        const ledgerAccrued = accrualRows.reduce(
          (s: number, row) => s + Number(row.amount),
          0
        );
        // Реестр — источник истины (выплата не уменьшает «начислено»).
        // Fallback на balance+paid, если за период ещё нет строк начисления
        // (старые данные / баланс вёлся без ledger).
        const accrued =
          accrualRows.length > 0 ? ledgerAccrued : Number(t.balance) + paid;
        const remaining = Number(t.balance);
        return {
          trainerId: t.id,
          trainerName: `${t.user.lastName} ${t.user.firstName}`.trim(),
          periodStart: dateFrom,
          periodEnd: dateTo,
          trainingsCount: t.trainings.length,
          trainingsMode,
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
