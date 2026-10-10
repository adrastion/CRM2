import { prisma } from '../lib/prisma';
import { FinanceOperationType, Prisma } from '@prisma/client';
import { badRequest, notFound } from '../utils/httpError';
import { applyPersonalDiscount } from '../utils/personalDiscount';

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

    const creatorIds = [
      ...new Set(items.map((op) => op.createdById).filter((id): id is string => Boolean(id))),
    ];
    const creators =
      creatorIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: creatorIds } },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              middleName: true,
              role: true,
              email: true,
            },
          })
        : [];
    const creatorMap = new Map(creators.map((u) => [u.id, u]));

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
        externalKey: op.externalKey,
        createdById: op.createdById,
        createdAt: op.createdAt,
        createdBy: op.createdById ? creatorMap.get(op.createdById) || null : null,
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
      /** Куда начислять для кастомных типов: accrued/paid (тренер), debit/credit (клиент). */
      allocation?: 'accrued' | 'paid' | 'debit' | 'credit' | null;
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

    const allocation = input.allocation || null;
    if (allocation && !['accrued', 'paid', 'debit', 'credit'].includes(allocation)) {
      throw badRequest('Некорректное значение allocation', 'allocation');
    }
    if ((allocation === 'accrued' || allocation === 'paid') && !input.trainerId) {
      throw badRequest('Выберите тренера', 'trainerId');
    }
    if ((allocation === 'debit' || allocation === 'credit') && !input.clientId) {
      throw badRequest('Выберите клиента', 'clientId');
    }

    // Кастомный тип (tenant-scoped): income+client без allocation тоже считаем пополнением
    const isTenantCustomType = Boolean(type.tenantId);

    const isBonusAccrual =
      (input.typeCode === 'bonus' && input.direction === 'expense' && Boolean(input.trainerId)) ||
      (allocation === 'accrued' && Boolean(input.trainerId));
    const isTrainerPayout = allocation === 'paid' && Boolean(input.trainerId);
    const isClientCredit =
      Boolean(input.clientId) &&
      (allocation === 'credit' ||
        (!allocation && isTenantCustomType && input.direction === 'income'));
    const isClientDebit =
      Boolean(input.clientId) &&
      (allocation === 'debit' ||
        (!allocation && isTenantCustomType && input.direction === 'expense'));

    // Ручное «начисление клиенту» (pending) — только системные «прочие» без allocation
    const autoPendingPaymentTypes = new Set([
      'other',
      'purchase',
      'advertising',
      'rent',
    ]);
    const isClientCharge =
      !allocation &&
      !isClientDebit &&
      input.direction === 'expense' &&
      Boolean(input.clientId) &&
      autoPendingPaymentTypes.has(input.typeCode);

    if (isBonusAccrual || isTrainerPayout) {
      const trainer = await prisma.trainer.findFirst({
        where: { id: input.trainerId!, tenantId },
      });
      if (!trainer) throw badRequest('Тренер не найден', 'trainerId');
    }

    if (isClientCharge || isClientDebit || isClientCredit || (input.clientId && input.direction === 'expense')) {
      if (input.clientId) {
      const client = await prisma.client.findFirst({
          where: { id: input.clientId, tenantId },
      });
      if (!client) throw badRequest('Клиент не найден', 'clientId');
      }
    }

    const allocationTag = isClientCredit
      ? '[allocation:credit]'
      : isClientDebit
        ? '[allocation:debit]'
        : isTrainerPayout
          ? '[allocation:paid]'
          : allocation === 'accrued'
            ? '[allocation:accrued]'
            : '';
    const notesWithTag = [input.notes?.trim() || '', allocationTag].filter(Boolean).join(' ').trim() || null;

    return prisma.$transaction(async (tx) => {
      let paymentId = input.paymentId || null;

      // Пополнение: платёж paid (для «Оплачено»/отмены) + баланс клиента.
      // Параллельно гасим pending/overdue (membership_charge уже списал их с баланса).
      if (isClientCredit && !paymentId) {
        const occurredAt = input.occurredAt ? new Date(input.occurredAt) : new Date();
        let leftover = amount;
        const pendingBills = await tx.payment.findMany({
          where: {
            tenantId,
            clientId: input.clientId!,
            status: { in: ['pending', 'overdue'] },
            amount: { gt: 0 },
          },
          orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
        });
        const settledIds: string[] = [];
        for (const bill of pendingBills) {
          if (leftover <= 0) break;
          const billAmt = Number(bill.amount);
          if (billAmt <= leftover) {
            await tx.payment.update({
              where: { id: bill.id },
              data: { status: 'paid', paidAt: occurredAt },
            });
            settledIds.push(bill.id);
            leftover -= billAmt;
          }
        }

        const settleTag =
          settledIds.length > 0 ? `[settled:${settledIds.join(',')}]` : '';
        const paymentNotes = [notesWithTag, settleTag].filter(Boolean).join(' ').trim();

        const payment = await tx.payment.create({
          data: {
            tenantId,
            clientId: input.clientId!,
            amount,
            type: 'membership',
            status: 'paid',
            paidAt: occurredAt,
            isMonthlyPayment: true,
            notes: paymentNotes || `Пополнение баланса / ${title}`,
          },
        });
        paymentId = payment.id;
      }

      // Ручное начисление: pending-счёт + дебет кошелька до создания op (paymentId на операции)
      if (isClientCharge && !paymentId) {
        const chargePay = await tx.payment.create({
          data: {
            tenantId,
            clientId: input.clientId!,
            amount,
            originalAmount: amount,
            type: 'membership',
            status: 'pending',
            isMonthlyPayment: true,
            branchId: input.branchId || null,
            groupId: input.groupId || null,
            notes: input.notes?.trim() || `Начисление: ${title}`,
            dueDate: input.occurredAt ? new Date(input.occurredAt) : new Date(),
          },
        });
        paymentId = chargePay.id;
        await tx.client.update({
          where: { id: input.clientId! },
          data: { balance: { decrement: amount } },
        });
      }

      // Списание с баланса — отдельная строка в сводке (как выдача абонемента): pending-счёт
      if (isClientDebit && !paymentId) {
        const occurredAt = input.occurredAt ? new Date(input.occurredAt) : new Date();
        const debitPay = await tx.payment.create({
          data: {
            tenantId,
            clientId: input.clientId!,
            amount,
            originalAmount: amount,
            type: 'membership',
            status: 'pending',
            isMonthlyPayment: true,
            branchId: input.branchId || null,
            groupId: input.groupId || null,
            dueDate: occurredAt,
            notes: notesWithTag || `Списание с баланса / ${title}`,
          },
        });
        // Уникальный период debit:{id} — своя строка в «Операции клиентов»
        await tx.payment.update({
          where: { id: debitPay.id },
          data: {
            periodKey: `debit:${debitPay.id}`,
            notes: [
              notesWithTag || `Списание с баланса / ${title}`,
              `clientDebitId=${debitPay.id}`,
            ]
              .filter(Boolean)
              .join(' / '),
          },
        });
        paymentId = debitPay.id;
      }

      const op = await tx.financeOperation.create({
        data: {
          tenantId,
          direction: input.direction,
          typeCode: input.typeCode,
          title,
          amount,
          occurredAt: input.occurredAt ? new Date(input.occurredAt) : new Date(),
          notes: notesWithTag,
          clientId: input.clientId || null,
          trainerId: input.trainerId || null,
          groupId: input.groupId || null,
          branchId: input.branchId || null,
          paymentId,
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
            comment: input.notes?.trim() || (allocation === 'accrued' ? 'начисление' : 'премия'),
          },
        });
      }

      if (isTrainerPayout) {
        await tx.trainer.update({
          where: { id: input.trainerId! },
          data: { balance: { decrement: amount } },
        });
        await tx.trainerSalaryLedger.create({
          data: {
            tenantId,
            trainerId: input.trainerId!,
            kind: 'payout',
            amount: -amount,
            occurredAt: input.occurredAt ? new Date(input.occurredAt) : new Date(),
            personName: null,
            title: title || 'Выплата',
            comment: input.notes?.trim() || 'выплата',
          },
        });
      }

      if (isClientDebit) {
        const client = await tx.client.findUnique({ where: { id: input.clientId! } });
        if (client) {
          await tx.client.update({
            where: { id: input.clientId! },
            data: { balance: Number(client.balance) - amount },
          });
        }
      }

      if (isClientCredit) {
        const client = await tx.client.findUnique({ where: { id: input.clientId! } });
        if (client) {
          await tx.client.update({
            where: { id: input.clientId! },
            data: { balance: Number(client.balance) + amount },
          });
        }
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
    membershipId?: string | null;
  }, clientName?: string) {
    if (payment.status !== 'paid') return null;

    const amount = Number(payment.amount);
    const isMembership = payment.type === 'membership' || payment.type === 'monthly' || payment.type === 'monthly_payment';
    const typeCode = isMembership ? 'membership' : 'client_payment';
    const title = clientName
      ? clientName
      : isMembership
        ? 'Оплата абонемента'
        : 'Принятие оплаты от клиента';

    // create + balance increment атомарно; при гонке unique на paymentId — без повторного increment
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.financeOperation.findUnique({
        where: { paymentId: payment.id },
      });
      if (existing) return { op: existing, created: false };

      try {
        const op = await tx.financeOperation.create({
          data: {
            tenantId: payment.tenantId,
      direction: 'income',
      typeCode,
      title,
            amount,
      occurredAt: payment.paidAt || new Date(),
            notes: payment.notes || null,
      clientId: payment.clientId,
            branchId: payment.branchId || null,
            groupId: payment.groupId || null,
      paymentId: payment.id,
          },
        });
        await tx.client.update({
          where: { id: payment.clientId },
          data: { balance: { increment: amount } },
        });
        return { op, created: true };
      } catch (e: any) {
        // unique violation на paymentId — параллельный вызов уже создал op
        if (e?.code === 'P2002') {
          const again = await tx.financeOperation.findUnique({
            where: { paymentId: payment.id },
          });
          if (again) return { op: again, created: false };
        }
        throw e;
      }
    });

    // Отложенная смена тарифа из ЛК (пакет активируется только после оплаты)
    if (result.created && payment.membershipId) {
      try {
        const { applyPaidMembershipCatalogIfNeeded } = await import('./clientMembershipService');
        await applyPaidMembershipCatalogIfNeeded({
          tenantId: payment.tenantId,
          clientId: payment.clientId,
          membershipCatalogId: payment.membershipId,
          paymentId: payment.id,
        });
      } catch (e) {
        console.error('applyPaidMembershipCatalogIfNeeded failed', e);
      }
    }

    return result.op;
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
      periodKey?: string | null;
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
      periodKey: string | null;
      notes: string | null;
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

    const packFromInput =
      typeof input.periodKey === 'string' && input.periodKey.startsWith('pack:')
        ? input.periodKey.slice('pack:'.length)
        : null;
    const packFromRef =
      ref?.notes?.match(/clientMembershipId=([a-zA-Z0-9_-]+)/)?.[1] || null;
    const packId = packFromInput || packFromRef;

    const debitFromInput =
      typeof input.periodKey === 'string' && input.periodKey.startsWith('debit:')
        ? input.periodKey.slice('debit:'.length)
        : null;
    const debitFromRef =
      ref?.notes?.match(/clientDebitId=([a-zA-Z0-9_-]+)/)?.[1] ||
      (ref?.periodKey?.startsWith('debit:') ? ref.periodKey.slice('debit:'.length) : null);
    const debitId = debitFromInput || debitFromRef;

    const periodKeyFilter =
      typeof input.periodKey === 'string' && /^\d{4}-\d{2}$/.test(input.periodKey)
        ? input.periodKey
        : ref?.periodKey && /^\d{4}-\d{2}$/.test(ref.periodKey)
          ? ref.periodKey
          : null;

    let paidPayments = await prisma.payment.findMany({
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
        ...(periodKeyFilter ? { periodKey: periodKeyFilter } : {}),
      },
    });
    if (packId) {
      const marker = `clientMembershipId=${packId}`;
      paidPayments = paidPayments.filter((p) => (p.notes || '').includes(marker));
    } else if (debitId) {
      const marker = `clientDebitId=${debitId}`;
      paidPayments = paidPayments.filter(
        (p) =>
          (p.notes || '').includes(marker) ||
          p.periodKey === `debit:${debitId}` ||
          p.id === debitId
      );
    }
    const currentPaid = paidPayments.reduce((s, p) => s + Number(p.amount), 0);
    if (currentPaid <= 0) {
      throw badRequest('Нечего уменьшать: выплачено уже 0');
    }

    const reduceBy = Math.min(requested, currentPaid);
    const clientName = `${client.lastName} ${client.firstName}`.trim();
    const packNote = packId ? `clientMembershipId=${packId}` : null;
    const debitNote = debitId ? `clientDebitId=${debitId}` : null;
    const scopedPeriodKey =
      periodKeyFilter ||
      (packId ? `pack:${packId}` : null) ||
      (debitId ? `debit:${debitId}` : null) ||
      (ref?.periodKey &&
      (/^\d{4}-\d{2}$/.test(ref.periodKey) ||
        ref.periodKey.startsWith('pack:') ||
        ref.periodKey.startsWith('debit:'))
        ? ref.periodKey
        : null);

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
        periodKey: scopedPeriodKey,
        notes: [
          packNote,
          debitNote,
          input.notes?.trim() ||
            `Корректировка выплачено −${reduceBy.toLocaleString('ru-RU')} ₽`,
        ]
          .filter(Boolean)
          .join(' / '),
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

  /** Выдача абонемента: списание с баланса клиента + операция (+ Payment для ЛК / Начислено). */
  static async recordMembershipIssue(params: {
    tenantId: string;
    clientId: string;
    clientMembershipId: string;
    amount: number;
    title: string;
    occurredAt?: Date;
    /** Каталожный Membership.id для связи Payment */
    membershipCatalogId?: string | null;
    /**
     * true — не создавать Payment (уже есть оплаченный платёж, из которого выдали абонемент).
     */
    skipPayment?: boolean;
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

    if (!params.skipPayment) {
      const noteMarker = `clientMembershipId=${params.clientMembershipId}`;
      const existingPay = await prisma.payment.findFirst({
        where: {
          tenantId: params.tenantId,
          clientId: params.clientId,
          notes: { contains: noteMarker },
        },
      });
      if (!existingPay) {
        const occurredAt = params.occurredAt || new Date();
        await prisma.payment.create({
          data: {
            tenantId: params.tenantId,
            clientId: params.clientId,
            membershipId: params.membershipCatalogId || null,
            amount,
            originalAmount: amount,
            type: 'membership',
            status: 'pending',
            dueDate: occurredAt,
            isMonthlyPayment: false,
            notes: `Выдача абонемента / ${noteMarker}`,
          },
        });
      }
    }

    return this.createOperation(params.tenantId, {
      direction: 'expense',
      typeCode: 'membership_issue',
      title: params.title,
      amount,
      occurredAt: params.occurredAt || new Date(),
      clientId: params.clientId,
      externalKey,
      notes: `Выдача абонемента / clientMembershipId=${params.clientMembershipId}`,
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
    let reverseSalaryPaymentId: string | null = null;

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
          const noteMarker = `clientMembershipId=${cmId}`;
          await tx.payment.updateMany({
            where: {
              tenantId,
              clientId: op.clientId,
              notes: { contains: noteMarker },
              status: { not: 'cancelled' },
            },
            data: { status: 'cancelled', paidAt: null },
          });
        }
      }

      // Ручное начисление (other/purchase/…): откат дебета + отмена pending
      const manualChargeTypes = new Set(['other', 'purchase', 'advertising', 'rent']);
      if (
        op.direction === 'expense' &&
        op.clientId &&
        manualChargeTypes.has(op.typeCode) &&
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
          reverseSalaryPaymentId = op.paymentId;
          await tx.payment.update({
            where: { id: op.paymentId },
            data: { status: 'cancelled', paidAt: null },
          });
        }
      }

      // Кастомное пополнение / списание по маркеру allocation
      const notes = op.notes || '';
      if (op.clientId && notes.includes('[allocation:credit]')) {
        const client = await tx.client.findUnique({ where: { id: op.clientId } });
        if (client) {
          await tx.client.update({
            where: { id: op.clientId },
            data: { balance: Number(client.balance) - amount },
          });
        }
        if (op.paymentId) {
          const creditPay = await tx.payment.findUnique({ where: { id: op.paymentId } });
          const settleMatch = (creditPay?.notes || '').match(/\[settled:([^\]]+)\]/);
          if (settleMatch) {
            const ids = settleMatch[1].split(',').map((s) => s.trim()).filter(Boolean);
            if (ids.length > 0) {
              await tx.payment.updateMany({
                where: { id: { in: ids }, tenantId },
                data: { status: 'pending', paidAt: null },
              });
            }
          }
          await tx.payment.update({
            where: { id: op.paymentId },
            data: { status: 'cancelled', paidAt: null },
          });
        }
      }
      if (op.clientId && notes.includes('[allocation:debit]')) {
        const client = await tx.client.findUnique({ where: { id: op.clientId } });
        if (client) {
          await tx.client.update({
            where: { id: op.clientId },
            data: { balance: Number(client.balance) + amount },
          });
        }
        if (op.paymentId) {
          await tx.payment.update({
            where: { id: op.paymentId },
            data: { status: 'cancelled', paidAt: null },
          });
        }
      }
      if (op.trainerId && notes.includes('[allocation:paid]')) {
        await tx.trainer.update({
          where: { id: op.trainerId },
          data: { balance: { increment: amount } },
        });
        const payout = await tx.trainerSalaryLedger.findFirst({
          where: {
            tenantId,
            trainerId: op.trainerId,
            kind: 'payout',
            amount: -amount,
          },
          orderBy: { occurredAt: 'desc' },
        });
        if (payout) await tx.trainerSalaryLedger.delete({ where: { id: payout.id } });
      }
      if (op.trainerId && notes.includes('[allocation:accrued]')) {
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

    if (reverseSalaryPaymentId) {
      try {
        const { reverseForPayment } = await import('./trainerSalaryService');
        await reverseForPayment({
          tenantId,
          paymentId: reverseSalaryPaymentId,
        });
      } catch (e) {
        console.error('reverseForPayment on income cancel failed', e);
      }
    }

    return { deleted: true, id: operationId };
  }

  /**
   * Удаляет зарплату и счета клиентов, которых уже нет в журнале «Все операции».
   * Старые начисления (до единого журнала) остаются в реестре зарплаты и платежах.
   */
  static async purgeUnlinkedSalaryAndClientHistory(tenantId: string) {
    const ops = await prisma.financeOperation.findMany({
      where: { tenantId },
      select: { id: true, typeCode: true, trainerId: true, clientId: true, paymentId: true, externalKey: true, notes: true },
    });

    const linkedPaymentIds = new Set<string>();
    const linkedLedgerIds = new Set<string>();
    const linkedAttendanceIds = new Set<string>();
    const salaryTrainerIds = new Set<string>();
    const clientOpClientIds = new Set<string>();

    const clientOpTypes = new Set([
      'membership',
      'membership_charge',
      'membership_issue',
      'client_payment',
    ]);
    const salaryOpTypes = new Set(['salary', 'salary_accrual', 'bonus']);

    for (const op of ops) {
      if (op.paymentId) linkedPaymentIds.add(op.paymentId);
      const notePay = op.notes?.match(/paymentId=([a-zA-Z0-9_-]+)/)?.[1];
      if (notePay) linkedPaymentIds.add(notePay);
      if (op.externalKey?.startsWith('salary_ledger:')) {
        linkedLedgerIds.add(op.externalKey.slice('salary_ledger:'.length));
      }
      if (op.externalKey?.startsWith('salary_accrual:attendance:')) {
        linkedAttendanceIds.add(op.externalKey.slice('salary_accrual:attendance:'.length));
      }
      if (op.externalKey?.startsWith('salary_accrual:payment:')) {
        const paymentId = op.externalKey.split(':')[2];
        if (paymentId) linkedPaymentIds.add(paymentId);
      }
      if (op.trainerId && salaryOpTypes.has(op.typeCode)) salaryTrainerIds.add(op.trainerId);
      if (op.clientId && clientOpTypes.has(op.typeCode)) clientOpClientIds.add(op.clientId);
    }

    const ledgers = await prisma.trainerSalaryLedger.findMany({
      where: { tenantId },
      select: { id: true, attendanceId: true, paymentId: true },
    });
    const orphanLedgerIds = ledgers
      .filter((row) => {
        if (linkedLedgerIds.has(row.id)) return false;
        if (row.attendanceId && linkedAttendanceIds.has(row.attendanceId)) return false;
        if (row.paymentId && linkedPaymentIds.has(row.paymentId)) return false;
        return true;
      })
      .map((row) => row.id);

    const deletedLedgers =
      orphanLedgerIds.length > 0
        ? await prisma.trainerSalaryLedger.deleteMany({ where: { id: { in: orphanLedgerIds } } })
        : { count: 0 };

    const trainers = await prisma.trainer.findMany({
      where: { tenantId },
      select: { id: true },
    });
    let trainersReset = 0;
    for (const trainer of trainers) {
      const rows = await prisma.trainerSalaryLedger.findMany({
        where: { tenantId, trainerId: trainer.id },
        select: { amount: true },
      });
      const balance = rows.reduce((s, r) => s + Number(r.amount), 0);
      await prisma.trainer.update({
        where: { id: trainer.id },
        data: { balance },
      });
      if (!salaryTrainerIds.has(trainer.id) && rows.length === 0) trainersReset += 1;
    }

    const payments = await prisma.payment.findMany({
      where: {
        tenantId,
        OR: [{ type: 'membership' }, { isMonthlyPayment: true }],
        status: { not: 'cancelled' },
      },
      select: { id: true },
    });
    const orphanPaymentIds = payments.filter((p) => !linkedPaymentIds.has(p.id)).map((p) => p.id);

    const cancelledPayments =
      orphanPaymentIds.length > 0
        ? (
            await prisma.payment.updateMany({
              where: { id: { in: orphanPaymentIds }, tenantId },
              data: { status: 'cancelled', paidAt: null },
            })
          ).count
        : 0;

    const clients = await prisma.client.findMany({
      where: { tenantId },
      select: { id: true },
    });
    let resetClientBalances = 0;
    for (const client of clients) {
      if (clientOpClientIds.has(client.id)) continue;
      await prisma.client.update({
        where: { id: client.id },
        data: { balance: 0 },
      });
      resetClientBalances += 1;
    }

    return {
      deletedSalaryLedgers: deletedLedgers.count,
      cancelledPayments,
      resetClientBalances,
      trainersReset,
    };
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

  /** Сводка абонементов: строка = клиент + период (periodKey). */
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
      /** YYYY-MM — если задан, только этот период */
      periodKey?: string;
    } = {}
  ) {
    const paymentPeriodKey = (p: {
      periodKey?: string | null;
      dueDate?: Date | null;
      createdAt: Date;
      notes?: string | null;
    }): string => {
      // Выдача абонемента / ручное списание — отдельная строка на каждое событие
      if (p.periodKey && (p.periodKey.startsWith('pack:') || p.periodKey.startsWith('debit:'))) {
        return p.periodKey;
      }
      const packMatch = p.notes?.match(/clientMembershipId=([a-zA-Z0-9_-]+)/);
      if (packMatch) return `pack:${packMatch[1]}`;
      const debitMatch = p.notes?.match(/clientDebitId=([a-zA-Z0-9_-]+)/);
      if (debitMatch) return `debit:${debitMatch[1]}`;
      if (p.periodKey && /^\d{4}-\d{2}$/.test(p.periodKey)) return p.periodKey;
      const d = p.dueDate || p.createdAt;
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      return `${y}-${m}`;
    };

    const fmtDate = (d: Date) =>
      `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;

    const formatPeriodLabel = (key: string): string => {
      if (key.startsWith('pack:')) return 'Абонемент';
      if (key.startsWith('debit:')) return 'Списание';
      const [yStr, mStr] = key.split('-');
      const y = Number(yStr);
      const m = Number(mStr);
      if (!y || !m) return key;
      const from = new Date(y, m - 1, 1);
      const to = new Date(y, m, 0);
      return `${fmtDate(from)} — ${fmtDate(to)}`;
    };

    const calendarMonthOf = (d: Date): string =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

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
            status: { not: 'cancelled' },
            OR: [{ type: 'membership' }, { isMonthlyPayment: true }],
          },
          orderBy: { createdAt: 'desc' },
          include: {
            membership: { select: { id: true, name: true } },
          },
        },
        groupMemberships: {
          where: { isActive: true },
          include: {
            group: {
              select: { id: true, name: true, trainerId: true, branchId: true, monthlyPaymentAmount: true },
            },
          },
        },
        clientMemberships: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            startDate: true,
            endDate: true,
            membership: { select: { name: true } },
          },
        },
      },
    });

    type PeriodAgg = {
      clientId: string;
      clientName: string;
      periodKey: string;
      periodLabel: string;
      membershipPrice: number;
      paidAmount: number;
      debt: number;
      remaining: number;
      status: 'paid' | 'unpaid' | 'partial';
      latestPaymentId: string | null;
      groups: Array<{ id: string; name: string; trainerId?: string | null; branchId?: string | null }>;
      interactive: boolean;
      sortAt: number;
    };

    const rows: PeriodAgg[] = [];

    for (const client of clients) {
      const clientName =
        `${client.lastName} ${client.firstName}${client.middleName ? ` ${client.middleName}` : ''}`.trim();
      const groups = client.groupMemberships.map((gm) => gm.group);
      const packMeta = new Map(
        client.clientMemberships.map((cm) => [
          cm.id,
          {
            name: cm.membership?.name || 'Абонемент',
            startDate: cm.startDate,
            endDate: cm.endDate,
          },
        ])
      );

      const byPeriod = new Map<string, typeof client.payments>();
      for (const p of client.payments) {
        const key = paymentPeriodKey(p);
        if (!byPeriod.has(key)) byPeriod.set(key, []);
        byPeriod.get(key)!.push(p);
      }

      const clientRows: PeriodAgg[] = [];

      const isWalletCredit = (p: { notes?: string | null }) =>
        (p.notes || '').includes('[allocation:credit]');
      const isExcessPay = (p: { notes?: string | null }) =>
        (p.notes || '').includes('[payment-excess]');

      // Клиент без платежей — строка текущего месяца; Баланс = кошелёк
      if (byPeriod.size === 0) {
        const now = new Date();
        const periodKey = calendarMonthOf(now);
        const membershipPrice = applyPersonalDiscount(
          Number(client.groupMemberships[0]?.group?.monthlyPaymentAmount || 0),
          client.personalDiscountType,
          client.personalDiscountValue != null ? Number(client.personalDiscountValue) : null
        ).amount;
        clientRows.push({
          clientId: client.id,
          clientName,
          periodKey,
          periodLabel: formatPeriodLabel(periodKey),
          membershipPrice,
          paidAmount: 0,
          debt: membershipPrice,
          remaining: Number(client.balance),
          status: membershipPrice > 0 ? 'unpaid' : 'paid',
          latestPaymentId: null,
          groups,
          interactive: true,
          sortAt: now.getTime(),
        });
      } else {
        const periodEntries = [...byPeriod.entries()].map(([periodKey, payments]) => {
          const sortAt = Math.max(...payments.map((p) => p.createdAt.getTime()));
          return { periodKey, payments, sortAt };
        });
        periodEntries.sort((a, b) => b.sortAt - a.sortAt);
        const latestPeriodKey = periodEntries[0]?.periodKey;

        for (const { periodKey, payments, sortAt } of periodEntries) {
          // Credit кошелька → Оплачено; списание (debit) — отдельный pending-счёт в периоде debit:…
          const walletCredits = payments.filter(
            (p) => !p.isAccrualAdjustment && isWalletCredit(p) && p.status === 'paid'
          );
          const walletCreditSum = walletCredits.reduce((s, p) => s + Number(p.amount), 0);

          const pending = payments.filter(
            (p) =>
              !p.isAccrualAdjustment &&
              !isWalletCredit(p) &&
              (p.status === 'pending' || p.status === 'overdue')
          );
          const paid = payments.filter(
            (p) =>
              !p.isAccrualAdjustment &&
              !isWalletCredit(p) &&
              p.status === 'paid'
          );
      const dueAmount = pending.reduce((s, p) => s + Number(p.amount), 0);
          const chargePaidAmount = paid.reduce((s, p) => s + Number(p.amount), 0);

          // Счета, погашенные этим credit, уже в chargePaidAmount — не дублировать
          let settledByCredit = 0;
          for (const c of walletCredits) {
            const settleMatch = (c.notes || '').match(/\[settled:([^\]]+)\]/);
            if (!settleMatch) continue;
            const ids = new Set(
              settleMatch[1]
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            );
            for (const p of paid) {
              if (ids.has(p.id)) settledByCredit += Number(p.amount);
            }
          }
          const paidAmount =
            Math.round((chargePaidAmount + walletCreditSum - settledByCredit) * 100) / 100;
          const latest =
            payments.find((p) => !p.isAccrualAdjustment) || payments[0] || null;

          const paidTowardCharge = paid
            .filter((p) => Number(p.amount) > 0 && !isExcessPay(p))
            .reduce((s, p) => s + Number(p.amount), 0);

          let membershipPrice = 0;
          if (pending.length > 0) {
            const allHaveOriginal = pending.every(
              (p) => p.originalAmount != null && Number.isFinite(Number(p.originalAmount))
            );
            if (allHaveOriginal) {
              membershipPrice =
                Math.round(
                  pending.reduce((s, p) => s + Number(p.originalAmount), 0) * 100
                ) / 100;
            } else {
              membershipPrice = Math.round((dueAmount + paidTowardCharge) * 100) / 100;
              if (pending.length === 1 && membershipPrice > 0) {
                const only = pending[0];
                if (only.originalAmount == null) {
                  await prisma.payment.update({
                    where: { id: only.id },
                    data: { originalAmount: membershipPrice },
                  });
                }
              }
            }
          } else if (paidTowardCharge > 0) {
            membershipPrice = Math.round(paidTowardCharge * 100) / 100;
          }

          // Не подставлять месячный тариф, если в периоде только credit или пусто
          const hasRealChargeActivity = pending.length > 0 || paidTowardCharge > 0;
          if (membershipPrice <= 0 && !hasRealChargeActivity && walletCreditSum <= 0) {
            membershipPrice = applyPersonalDiscount(
              Number(client.groupMemberships[0]?.group?.monthlyPaymentAmount || 0),
              client.personalDiscountType,
              client.personalDiscountValue != null
                ? Number(client.personalDiscountValue)
                : null
            ).amount;
          }

      let status: 'paid' | 'unpaid' | 'partial' = 'unpaid';
      if (dueAmount <= 0 && paidAmount > 0) status = 'paid';
      else if (dueAmount > 0 && paidAmount > 0) status = 'partial';
      else if (dueAmount <= 0 && paidAmount <= 0) status = 'paid';

          const hasUnpaid = dueAmount > 0;
          const interactive = hasUnpaid || periodKey === latestPeriodKey;

          const latestPaymentId =
            pending[0]?.id ||
            paid.find((p) => Number(p.amount) > 0)?.id ||
            walletCredits[0]?.id ||
            latest?.id ||
            null;

          let periodLabel = formatPeriodLabel(periodKey);
          if (periodKey.startsWith('pack:')) {
            const packId = periodKey.slice('pack:'.length);
            const meta = packMeta.get(packId);
            if (meta?.startDate) {
              periodLabel = meta.endDate
                ? `${fmtDate(meta.startDate)} — ${fmtDate(meta.endDate)}`
                : `${fmtDate(meta.startDate)} — …`;
            } else {
              const created = payments[0]?.createdAt || new Date();
              periodLabel = `${fmtDate(created)} — …`;
            }
          } else if (periodKey.startsWith('debit:')) {
            const created = payments[0]?.dueDate || payments[0]?.createdAt || new Date();
            periodLabel = `Списание · ${fmtDate(created)}`;
          }

          clientRows.push({
        clientId: client.id,
            clientName,
            periodKey,
            periodLabel,
        membershipPrice,
        paidAmount,
        debt: dueAmount,
            remaining: 0,
        status,
            latestPaymentId,
            groups,
            interactive,
            sortAt,
          });
        }
      }

      // Цепочка для истории; итоговый Баланс = фактический кошелёк (не перезаписываем Client.balance)
      clientRows.sort((a, b) => a.sortAt - b.sortAt || a.periodKey.localeCompare(b.periodKey));
      let running = 0;
      for (const row of clientRows) {
        running = running - Number(row.membershipPrice) + Number(row.paidAmount);
        row.remaining = Math.round(running * 100) / 100;
      }
      if (clientRows.length > 0) {
        clientRows[clientRows.length - 1].remaining =
          Math.round(Number(client.balance) * 100) / 100;
      }

      rows.push(...clientRows);
    }

    // Новые периоды / выдачи сверху
    rows.sort((a, b) => {
      const t = b.sortAt - a.sortAt;
      if (t !== 0) return t;
      return a.clientName.localeCompare(b.clientName, 'ru');
    });

    return rows
      .filter((r) => {
        if (filters.periodKey) {
          if (r.periodKey.startsWith('pack:') || r.periodKey.startsWith('debit:')) {
            if (calendarMonthOf(new Date(r.sortAt)) !== filters.periodKey) return false;
          } else if (r.periodKey !== filters.periodKey) {
            return false;
          }
        }
      if (filters.amountFrom != null && r.membershipPrice < filters.amountFrom) return false;
      if (filters.amountTo != null && r.membershipPrice > filters.amountTo) return false;
      return true;
      })
      .map(({ sortAt: _s, ...rest }) => rest);
  }

  /**
   * Append-only корректировка начисления абонемента.
   * Исходный Payment не меняется; создаётся signed adjustment + finance op.
   */
  static async correctMembershipAccrual(
    tenantId: string,
    input: {
      clientId: string;
      paymentId?: string | null;
      /** YYYY-MM — ограничить расчёт эффективной суммы периодом */
      periodKey?: string | null;
      newAmount: number;
      reason: string;
      userId: string;
      occurredAt?: Date;
    }
  ) {
    const reason = String(input.reason || '').trim();
    if (!reason) throw badRequest('Укажите причину корректировки', 'reason');
    const newAmount = Number(input.newAmount);
    if (!Number.isFinite(newAmount) || newAmount < 0) {
      throw badRequest('Некорректная новая сумма', 'newAmount');
    }

    const client = await prisma.client.findFirst({
      where: { id: input.clientId, tenantId },
    });
    if (!client) throw notFound('Клиент не найден');

    const resolvePeriodKey = (p: {
      periodKey?: string | null;
      dueDate?: Date | null;
      createdAt: Date;
      notes?: string | null;
    }): string => {
      if (p.periodKey && (p.periodKey.startsWith('pack:') || p.periodKey.startsWith('debit:'))) {
        return p.periodKey;
      }
      const packMatch = p.notes?.match(/clientMembershipId=([a-zA-Z0-9_-]+)/);
      if (packMatch) return `pack:${packMatch[1]}`;
      const debitMatch = p.notes?.match(/clientDebitId=([a-zA-Z0-9_-]+)/);
      if (debitMatch) return `debit:${debitMatch[1]}`;
      if (p.periodKey && /^\d{4}-\d{2}$/.test(p.periodKey)) return p.periodKey;
      const d = p.dueDate || p.createdAt;
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    };

    const membershipPayments = await prisma.payment.findMany({
      where: {
        tenantId,
        clientId: input.clientId,
        OR: [{ type: 'membership' }, { isMonthlyPayment: true }],
        status: { not: 'cancelled' },
      },
      orderBy: { createdAt: 'desc' },
    });

    const periodScoped = input.periodKey
      ? membershipPayments.filter((p) => resolvePeriodKey(p) === input.periodKey)
      : membershipPayments;

    let source = input.paymentId
      ? periodScoped.find((p) => p.id === input.paymentId && !p.isAccrualAdjustment)
      : null;
    if (!source && input.paymentId) {
      const byId = await prisma.payment.findFirst({
        where: {
          id: input.paymentId,
          tenantId,
          clientId: input.clientId,
          isAccrualAdjustment: false,
        },
      });
      if (byId) source = byId;
    }
    if (!source) {
      source =
        periodScoped.find(
          (p) => !p.isAccrualAdjustment && (p.status === 'pending' || p.status === 'overdue')
        ) ||
        periodScoped.find((p) => !p.isAccrualAdjustment) ||
        null;
    }
    if (!source) throw badRequest('Не найдено исходное начисление', 'paymentId');

    const effectivePool = input.periodKey ? periodScoped : membershipPayments;
    const currentEffective = effectivePool
      .filter(
        (p) =>
          !p.isAccrualAdjustment &&
          p.status !== 'cancelled' &&
          p.status !== 'adjustment' &&
          Number(p.amount) > 0
      )
      .reduce((s, p) => s + Number(p.amount), 0);
    const delta = newAmount - currentEffective;
    if (Math.abs(delta) < 0.005) {
      throw badRequest('Новая сумма совпадает с текущим начислением', 'newAmount');
    }

    const occurredAt = input.occurredAt || new Date();
    const absDelta = Math.abs(delta);
    const adjPeriodKey = input.periodKey || resolvePeriodKey(source);
    const periodFilter = (p: { periodKey?: string | null; dueDate?: Date | null; createdAt: Date }) =>
      !input.periodKey || resolvePeriodKey(p) === input.periodKey;

    const adjustment = await prisma.$transaction(async (tx) => {
      const adj = await tx.payment.create({
        data: {
          tenantId,
          clientId: input.clientId,
          membershipId: source!.membershipId,
          branchId: source!.branchId,
          groupId: source!.groupId,
          amount: delta,
          type: source!.type || 'membership',
          status: 'adjustment',
          isMonthlyPayment: source!.isMonthlyPayment,
          periodKey: adjPeriodKey,
          notes: `Корректировка начисления: ${reason}`,
          correctsPaymentId: source!.id,
          isAccrualAdjustment: true,
          adjustmentReason: reason,
          adjustedByUserId: input.userId,
          adjustedAt: occurredAt,
          dueDate: source!.dueDate,
        },
      });

      await tx.client.update({
        where: { id: input.clientId },
        data: { balance: { increment: -delta } },
      });

      const paidAmount = effectivePool
        .filter((p) => !p.isAccrualAdjustment && p.status === 'paid')
        .reduce((s, p) => s + Number(p.amount), 0);
      const effectiveAfter = currentEffective + delta;

      const pendings = await tx.payment.findMany({
        where: {
          tenantId,
          clientId: input.clientId,
          isAccrualAdjustment: false,
          status: { in: ['pending', 'overdue'] },
          OR: [{ type: 'membership' }, { isMonthlyPayment: true }],
        },
        orderBy: { createdAt: 'desc' },
      });
      const pendingsInScope = pendings.filter(periodFilter);

      if (effectiveAfter <= paidAmount + 0.005) {
        for (const pend of pendingsInScope) {
          await tx.payment.update({
            where: { id: pend.id },
            data: {
              status: 'cancelled',
              notes: 'Отменено после корректировки начисления',
            },
          });
        }
      } else if (delta < 0) {
        let remainingReduce = -delta;
        for (const pend of pendingsInScope) {
          if (remainingReduce <= 0.005) break;
          const amt = Number(pend.amount);
          if (amt <= remainingReduce + 0.005) {
            await tx.payment.update({
              where: { id: pend.id },
              data: {
                status: 'cancelled',
                notes: 'Отменено после корректировки начисления',
              },
            });
            remainingReduce -= amt;
          } else {
            await tx.payment.update({
              where: { id: pend.id },
              data: {
                originalAmount: pend.originalAmount ?? pend.amount,
                amount: amt - remainingReduce,
              },
            });
            remainingReduce = 0;
          }
        }
      } else if (delta > 0) {
        const existingPending = pendingsInScope[0] || null;
        if (existingPending) {
          await tx.payment.update({
            where: { id: existingPending.id },
            data: {
              originalAmount: existingPending.originalAmount ?? existingPending.amount,
              amount: Number(existingPending.amount) + delta,
            },
          });
        } else {
          await tx.payment.create({
            data: {
              tenantId,
              clientId: input.clientId,
              membershipId: source!.membershipId,
              branchId: source!.branchId,
              groupId: source!.groupId,
              amount: delta,
              type: source!.type || 'membership',
              status: 'pending',
              isMonthlyPayment: source!.isMonthlyPayment,
              periodKey: adjPeriodKey,
              notes: `Доп. начисление после корректировки: ${reason}`,
              dueDate: source!.dueDate || occurredAt,
            },
          });
        }
      }

      return adj;
    });

    await this.createOperation(tenantId, {
      direction: delta < 0 ? 'income' : 'expense',
      typeCode: 'membership_charge_adjustment',
      title: 'Корректировка начисления',
      amount: absDelta,
      occurredAt,
      clientId: input.clientId,
      groupId: source.groupId,
      branchId: source.branchId,
      paymentId: adjustment.id,
      externalKey: `membership_charge_adjustment:${adjustment.id}`,
      notes: reason,
      createdById: input.userId,
    });

    return {
      adjustment,
      sourcePaymentId: source.id,
      previousEffective: currentEffective,
      newEffective: currentEffective + delta,
      delta,
      periodKey: adjPeriodKey,
    };
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
        // Выплачено — расходы кассы type=salary за период (legacy / основной путь)
        financeOperations: {
          where: {
            typeCode: 'salary',
            direction: 'expense',
            occurredAt: { gte: dateFrom, lte: dateTo },
          },
        },
        // Начисления и выплаты в реестре за период (payout отдельно)
        salaryLedgers: {
          where: {
            occurredAt: { gte: dateFrom, lte: dateTo },
          },
        },
      },
    });

    return (trainers as TrainerSalarySummaryRow[])
      .map((t) => {
        const paidFromOps = t.financeOperations.reduce(
          (s: number, op) => s + Number(op.amount),
          0
        );
        const paidFromLedger = t.salaryLedgers
          .filter((row) => row.kind === 'payout')
          .reduce((s: number, row) => s + Math.abs(Number(row.amount)), 0);
        // Реестр payout покрывает и salary, и кастомные «выплачено»; ops — fallback для старых данных
        const paid = paidFromLedger > 0 ? paidFromLedger : paidFromOps;
        const accrualRows = t.salaryLedgers.filter((row) => row.kind !== 'payout');
        const ledgerAccrued = accrualRows.reduce(
          (s: number, row) => s + Number(row.amount),
          0
        );
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
        select: {
          id: true,
          firstName: true,
          lastName: true,
          middleName: true,
          phone: true,
          balance: true,
          groupMemberships: {
            where: { isActive: true },
            take: 1,
            select: { group: { select: { name: true } } },
          },
        },
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
    return {
      types,
      clients: clients.map((c) => ({
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        middleName: c.middleName,
        phone: c.phone,
        balance: Number(c.balance),
        groupName: c.groupMemberships[0]?.group?.name || null,
      })),
      trainers,
      groups,
      branches,
    };
  }
}
