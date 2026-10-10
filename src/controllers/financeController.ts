import { prisma } from '../lib/prisma';
import { Response } from 'express';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { asyncHandler } from '../middleware/errorHandler';
import { FinanceService, FinanceDirection } from '../services/financeService';
import { accrueForPayment } from '../services/trainerSalaryService';
import { badRequest, forbidden } from '../utils/httpError';
import {
  notifyClientDebt,
  notifyClientPaymentReceived,
  notifyFinanceChange,
  notifyTrainerSalary,
} from '../services/notificationDomainHooks';

function parseList(value: unknown): string[] | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return String(value)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** clientMembershipId / clientDebitId из notes — ключи периодов pack:… / debit:… */
function extractPackMembershipId(notes?: string | null): string | null {
  return notes?.match(/clientMembershipId=([a-zA-Z0-9_-]+)/)?.[1] || null;
}

function extractClientDebitId(notes?: string | null): string | null {
  return notes?.match(/clientDebitId=([a-zA-Z0-9_-]+)/)?.[1] || null;
}

/**
 * Склеивает notes оплаты со счётом: clientMembershipId / clientDebitId нельзя терять,
 * иначе оплата уезжает в календарный месяц и «Начислено» прыгает.
 */
function mergeChargeNotes(
  baseNotes: string | null | undefined,
  extraNotes?: string | null,
  flags: string[] = []
): string | null {
  const packId =
    extractPackMembershipId(baseNotes) || extractPackMembershipId(extraNotes);
  const debitId = extractClientDebitId(baseNotes) || extractClientDebitId(extraNotes);
  const seen = new Set<string>();
  const parts: string[] = [];
  const push = (s: string) => {
    const t = s.trim();
    if (!t || seen.has(t)) return;
    seen.add(t);
    parts.push(t);
  };
  if (packId) push(`clientMembershipId=${packId}`);
  if (debitId) push(`clientDebitId=${debitId}`);
  for (const raw of [baseNotes, extraNotes]) {
    for (const chunk of String(raw || '').split(' / ')) {
      const t = chunk.trim();
      if (
        !t ||
        t.startsWith('clientMembershipId=') ||
        t.startsWith('clientDebitId=') ||
        t === '[payment-excess]'
      ) {
        continue;
      }
      push(t);
    }
  }
  for (const f of flags) push(f);
  return parts.length ? parts.join(' / ') : null;
}

function calendarPeriodKeyFromPayment(p: {
  periodKey?: string | null;
  dueDate?: Date | null;
  createdAt: Date;
}): string | null {
  if (p.periodKey && /^\d{4}-\d{2}$/.test(p.periodKey)) return p.periodKey;
  const d = p.dueDate || p.createdAt;
  if (!d) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Начисление тренеру (фикс % / фикс с ученика) после оплаты в разделе «Финансы». */
async function accrueTrainerFromPaidPayment(
  tenantId: string,
  payment: {
    id: string;
    clientId: string;
    amount: unknown;
    groupId?: string | null;
    isMonthlyPayment?: boolean | null;
    type?: string | null;
    paidAt?: Date | null;
    periodKey?: string | null;
  }
) {
  await accrueForPayment({
    tenantId,
    paymentId: payment.id,
    clientId: payment.clientId,
    amount: Number(payment.amount),
    groupId: payment.groupId,
    isMonthlyPayment: Boolean(payment.isMonthlyPayment),
    paymentType: payment.type || undefined,
    paidAt: payment.paidAt,
    periodKey: payment.periodKey,
  }).catch((err) => console.error('Trainer salary accrue on finance payment failed:', err));
}

/** Тренеры, доступные старшему по филиалам (null = без ограничений). */
async function resolveAllowedTrainerIdsForFinance(
  req: AuthenticatedRequest
): Promise<string[] | null> {
  if (!req.user || !req.tenant?.id) return [];
  if (req.user.role === 'OWNER' || req.user.role === 'ADMIN') return null;
  const { resolveAccessibleBranchIds } = await import('../utils/branchAccess');
  const access = await resolveAccessibleBranchIds(req.user, req.tenant.id);
  if (access.allAccess) return null;
  if (access.branchIds.length === 0) return [];
  const trainers = await prisma.trainer.findMany({
    where: {
      tenantId: req.tenant.id,
      isActive: true,
      OR: [
        { branches: { some: { branchId: { in: access.branchIds } } } },
        { groups: { some: { branchId: { in: access.branchIds }, isActive: true } } },
        { seniorBranches: { some: { id: { in: access.branchIds } } } },
      ],
    },
    select: { id: true },
  });
  return trainers.map((t) => t.id);
}

/** Senior может работать только с клиентами своих филиалов. */
async function assertSeniorCanAccessClient(
  req: AuthenticatedRequest,
  clientId: string
): Promise<void> {
  if (!req.user || !req.tenant?.id) throw badRequest('Требуется авторизация');
  if (req.user.role === 'OWNER' || req.user.role === 'ADMIN') return;
  if (req.user.role !== 'TRAINER') {
    throw badRequest('Недостаточно прав');
  }
  const { getSeniorBranchIds } = await import('../utils/branchAccess');
  const branchIds = await getSeniorBranchIds(req.user.id, req.tenant.id);
  if (branchIds.length === 0) {
    throw forbidden('Нет доступа');
  }
  const inGroup = await prisma.groupMembership.findFirst({
    where: {
      clientId,
      isActive: true,
      leftAt: null,
      group: { tenantId: req.tenant.id, branchId: { in: branchIds } },
    },
    select: { id: true },
  });
  if (inGroup) return;
  const pay = await prisma.payment.findFirst({
    where: {
      tenantId: req.tenant.id,
      clientId,
      branchId: { in: branchIds },
    },
    select: { id: true },
  });
  if (pay) return;
  throw forbidden('Клиент вне ваших филиалов');
}

async function assertSeniorCanAccessPayment(
  req: AuthenticatedRequest,
  paymentId: string
): Promise<{ clientId: string; branchId: string | null }> {
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, tenantId: req.tenant?.id },
    select: { id: true, clientId: true, branchId: true },
  });
  if (!payment) throw badRequest('Платёж не найден', 'paymentId');
  await assertSeniorCanAccessClient(req, payment.clientId);
  return payment;
}

export const listFinanceTypes = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  if (!req.tenant?.id) {
    res.status(400).json({ success: false, error: 'Tenant ID is required' });
    return;
  }
  const types = await FinanceService.listTypes(req.tenant.id);
  res.json({ success: true, data: types });
});

export const createFinanceType = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  if (!req.tenant?.id) {
    res.status(400).json({ success: false, error: 'Tenant ID is required' });
    return;
  }
  const type = await FinanceService.createType(req.tenant.id, {
    code: req.body.code,
    name: req.body.name,
    defaultDirection: req.body.defaultDirection,
  });
  res.status(201).json({ success: true, data: type });
});

export const listFinanceOperations = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  if (!req.tenant?.id) {
    res.status(400).json({ success: false, error: 'Tenant ID is required' });
    return;
  }

  const access = await (await import('../utils/branchAccess')).resolveAccessibleBranchIds(
    req.user!,
    req.tenant.id,
    parseList(req.query.branchIds)
  );
  if (req.user?.role === 'TRAINER' && access.branchIds.length === 0 && !access.allAccess) {
    res.json({ success: true, data: { items: [], total: 0 } });
    return;
  }

  const data = await FinanceService.listOperations(req.tenant.id, {
    dateFrom: parseDate(req.query.dateFrom),
    dateTo: parseDate(req.query.dateTo),
    datePreset: req.query.datePreset ? String(req.query.datePreset) : undefined,
    search: req.query.search ? String(req.query.search) : undefined,
    amountFrom: req.query.amountFrom != null ? Number(req.query.amountFrom) : undefined,
    amountTo: req.query.amountTo != null ? Number(req.query.amountTo) : undefined,
    typeCodes: parseList(req.query.typeCodes),
    groupIds: parseList(req.query.groupIds),
    branchIds: access.allAccess ? parseList(req.query.branchIds) : access.branchIds,
    clientIds: parseList(req.query.clientIds),
    trainerIds: parseList(req.query.trainerIds),
    direction: req.query.direction as FinanceDirection | undefined,
    sortBy: req.query.sortBy as any,
    sortDir: req.query.sortDir as any,
    limit: req.query.limit != null ? Number(req.query.limit) : undefined,
    offset: req.query.offset != null ? Number(req.query.offset) : undefined,
  });

  res.json({ success: true, data });
});

export const createFinanceOperation = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  if (!req.tenant?.id) {
    res.status(400).json({ success: false, error: 'Tenant ID is required' });
    return;
  }

  if (req.user?.role === 'TRAINER') {
    const { canManageBranch, getSeniorBranchIds } = await import('../utils/branchAccess');
    const seniorIds = await getSeniorBranchIds(req.user.id, req.tenant.id);
    if (seniorIds.length > 0) {
      let branchId = req.body.branchId as string | undefined;
      // Диалог «Добавить операцию» не спрашивает филиал — берём первый доступный
      if (!branchId) {
        branchId = seniorIds[0];
        req.body.branchId = branchId;
      }
      if (!branchId || !(await canManageBranch(req.user, branchId, req.tenant.id))) {
        res.status(403).json({
          success: false,
          error: 'Укажите филиал, которым вы управляете',
        });
        return;
      }
      if (req.body.clientId) {
        await assertSeniorCanAccessClient(req, String(req.body.clientId));
      }
      if (req.body.trainerId) {
        const allowed = await resolveAllowedTrainerIdsForFinance(req);
        if (allowed && !allowed.includes(String(req.body.trainerId))) {
          throw forbidden('Тренер вне ваших филиалов');
        }
      }
    }
  }

  const op = await FinanceService.createOperation(req.tenant.id, {
    direction: req.body.direction,
    typeCode: req.body.typeCode,
    title: req.body.title,
    amount: req.body.amount,
    occurredAt: req.body.occurredAt,
    notes: req.body.notes,
    clientId: req.body.clientId,
    trainerId: req.body.trainerId,
    groupId: req.body.groupId,
    branchId: req.body.branchId,
    allocation: req.body.allocation || null,
    createdById: req.user?.id,
  });

  void notifyFinanceChange({
    tenantId: req.tenant.id,
    title: op.title || 'Финансовая операция',
    body: `${op.direction === 'income' ? '+' : '−'}${Number(op.amount).toLocaleString('ru-RU')}`,
    branchId: op.branchId,
    excludeUserId: req.user?.id,
  }).catch((err) => console.error('[Notifications] finance:', err));

  res.status(201).json({ success: true, data: op });
});

export const deleteFinanceOperation = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  if (!req.tenant?.id) {
    res.status(400).json({ success: false, error: 'Tenant ID is required' });
    return;
  }
  const { id } = req.params;
  if (!id) {
    throw badRequest('Укажите ID операции');
  }
  await FinanceService.deleteOperation(req.tenant.id, id);
  res.json({ success: true, data: { id }, message: 'Операция отменена' });
});

export const purgeUnlinkedFinanceHistory = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    if (!req.tenant?.id) {
      res.status(400).json({ success: false, error: 'Tenant ID is required' });
      return;
    }
    const data = await FinanceService.purgeUnlinkedSalaryAndClientHistory(req.tenant.id);
    res.json({
      success: true,
      data,
      message: 'Старые записи зарплаты и операций клиентов, которых нет в журнале, удалены',
    });
  }
);

export const payoutTrainerSalary = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  if (!req.tenant?.id) {
    res.status(400).json({ success: false, error: 'Tenant ID is required' });
    return;
  }

  const trainerId = String(req.body.trainerId || '');
  if (!trainerId) throw badRequest('Укажите trainerId', 'trainerId');
  const allowedTrainerIds = await resolveAllowedTrainerIdsForFinance(req);
  if (allowedTrainerIds && !allowedTrainerIds.includes(trainerId)) {
    res.status(403).json({ success: false, error: 'Нет доступа к выплате этому тренеру' });
    return;
  }

  const op = await FinanceService.payoutTrainerSalary(req.tenant.id, {
    trainerId,
    amount: req.body.amount,
    periodLabel: req.body.periodLabel,
    occurredAt: req.body.occurredAt,
    notes: req.body.notes,
    createdById: req.user?.id,
  });

  void notifyFinanceChange({
    tenantId: req.tenant.id,
    title: 'Выплата зарплаты тренеру',
    body: Number(req.body.amount).toLocaleString('ru-RU'),
    excludeUserId: req.user?.id,
  }).catch((err) => console.error('[Notifications] finance payout:', err));

  void notifyTrainerSalary({
    tenantId: req.tenant.id,
    trainerId,
    kind: 'payout',
    amount: Number(req.body.amount),
    title: req.body.periodLabel ? String(req.body.periodLabel) : undefined,
  }).catch((err) => console.error('[Notifications] salary payout:', err));

  res.status(201).json({ success: true, data: op });
});

export const getSalarySummary = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  if (!req.tenant?.id) {
    res.status(400).json({ success: false, error: 'Tenant ID is required' });
    return;
  }

  const requestedIds = parseList(req.query.trainerIds);
  const allowedTrainerIds = await resolveAllowedTrainerIdsForFinance(req);
  let trainerIds = requestedIds;
  if (allowedTrainerIds) {
    trainerIds = requestedIds?.length
      ? requestedIds.filter((id) => allowedTrainerIds.includes(id))
      : allowedTrainerIds;
    if (trainerIds.length === 0) {
      res.json({ success: true, data: [] });
      return;
    }
  }

  const data = await FinanceService.salarySummary(req.tenant.id, {
    trainerIds,
    dateFrom: parseDate(req.query.dateFrom),
    dateTo: parseDate(req.query.dateTo),
    amountFrom: req.query.amountFrom != null ? Number(req.query.amountFrom) : undefined,
    amountTo: req.query.amountTo != null ? Number(req.query.amountTo) : undefined,
    trainingsMode: req.query.trainingsMode === 'conducted' ? 'conducted' : 'all',
  });

  res.json({ success: true, data });
});

export const getMembershipFinanceSummary = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    if (!req.tenant?.id) {
      res.status(400).json({ success: false, error: 'Tenant ID is required' });
      return;
    }

    const access = await (await import('../utils/branchAccess')).resolveAccessibleBranchIds(
      req.user!,
      req.tenant.id,
      parseList(req.query.branchIds)
    );

    const data = await FinanceService.membershipSummary(req.tenant.id, {
      clientIds: parseList(req.query.clientIds),
      trainerIds: parseList(req.query.trainerIds),
      branchIds: access.allAccess ? parseList(req.query.branchIds) : access.branchIds,
      groupIds: parseList(req.query.groupIds),
      search: req.query.search ? String(req.query.search) : undefined,
      amountFrom: req.query.amountFrom != null ? Number(req.query.amountFrom) : undefined,
      amountTo: req.query.amountTo != null ? Number(req.query.amountTo) : undefined,
      periodKey:
        typeof req.query.periodKey === 'string' && /^\d{4}-\d{2}$/.test(req.query.periodKey)
          ? req.query.periodKey
          : undefined,
    });

    res.json({ success: true, data });
  }
);

/** Принять оплату абонемента: сумма добавляется к уже оплаченному. */
export const receiveMembershipPayment = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    if (!req.tenant?.id) {
      res.status(400).json({ success: false, error: 'Tenant ID is required' });
      return;
    }

    const tenantId = req.tenant.id;
    const notifyPaid = (paidClientId: string, paidAmount: number, branchId?: string | null) => {
      void notifyClientPaymentReceived({
        tenantId,
        clientId: paidClientId,
        amount: paidAmount,
      }).catch((err) => console.error('[Notifications] payment:', err));
      void notifyFinanceChange({
        tenantId,
        title: 'Оплата абонемента',
        body: Number(paidAmount).toLocaleString('ru-RU'),
        branchId,
        excludeUserId: req.user?.id,
      }).catch((err) => console.error('[Notifications] finance:', err));
    };

    const { paymentId, clientId, amount, notes, periodKey } = req.body;
    if (!paymentId && !clientId) {
      throw badRequest('Укажите paymentId или clientId', 'paymentId');
    }

    const increment = amount != null ? Number(amount) : NaN;
    if (!Number.isFinite(increment) || increment === 0) {
      throw badRequest('Некорректная сумма', 'amount');
    }

    const rawPeriodKey = typeof periodKey === 'string' && periodKey.trim() ? periodKey.trim() : null;
    const periodKeyStr =
      rawPeriodKey && /^\d{4}-\d{2}$/.test(rawPeriodKey) ? rawPeriodKey : null;
    const packIdFromPeriod =
      rawPeriodKey && rawPeriodKey.startsWith('pack:')
        ? rawPeriodKey.slice('pack:'.length)
        : null;
    const debitIdFromPeriod =
      rawPeriodKey && rawPeriodKey.startsWith('debit:')
        ? rawPeriodKey.slice('debit:'.length)
        : null;

    if (paymentId) {
      await assertSeniorCanAccessPayment(req, String(paymentId));
    } else if (clientId) {
      await assertSeniorCanAccessClient(req, String(clientId));
    }

    // Отрицательная сумма: уменьшить «выплачено» (4000 + (−3000) → 1000)
    if (increment < 0) {
      const result = await FinanceService.reduceMembershipPaid(req.tenant.id, {
        clientId: clientId || null,
        paymentId: paymentId || null,
        amount: increment,
        notes: notes ?? null,
        createdById: req.user?.id,
        // Важен pack:… — иначе корректировка уезжает в другой период сводки
        periodKey: rawPeriodKey,
      });
      const debtClientId = result.payment?.clientId || clientId;
      if (debtClientId) {
        void notifyClientDebt({
          tenantId: req.tenant.id,
          clientId: String(debtClientId),
          amount: Math.abs(result.reducedBy || increment),
          label: 'Корректировка оплаты',
        }).catch((err) => console.error('[Notifications] debt:', err));
        void notifyFinanceChange({
          tenantId: req.tenant.id,
          title: 'Корректировка оплаты абонемента',
          excludeUserId: req.user?.id,
        }).catch((err) => console.error('[Notifications] finance:', err));
      }
      res.json({ success: true, data: result, message: `Выплачено уменьшено на ${result.reducedBy}` });
      return;
    }

    type PayWithClient = {
      id: string;
      tenantId: string;
      clientId: string;
      amount: unknown;
      originalAmount: unknown;
      type: string;
      status: string;
      paidAt: Date | null;
      isMonthlyPayment: boolean;
      branchId: string | null;
      groupId: string | null;
      membershipId: string | null;
      periodKey: string | null;
      dueDate: Date | null;
      createdAt: Date;
      notes: string | null;
      client: { id: string; firstName: string; lastName: string; middleName?: string | null };
    };

    const findPendingInScope = async (
      scopeClientId: string,
      opts: {
        packId?: string | null;
        debitId?: string | null;
        calendarKey?: string | null;
        preferId?: string | null;
      }
    ): Promise<PayWithClient | null> => {
      const allPending = await prisma.payment.findMany({
        where: {
          tenantId,
          clientId: scopeClientId,
          status: { in: ['pending', 'overdue'] },
          OR: [{ type: 'membership' }, { isMonthlyPayment: true }],
        },
        orderBy: { dueDate: 'asc' },
        include: { client: true },
      });
      if (opts.preferId) {
        const byId = allPending.find((p) => p.id === opts.preferId);
        if (byId) return byId;
      }
      if (opts.debitId) {
        const marker = `clientDebitId=${opts.debitId}`;
        const byDebit =
          allPending.find((p) => (p.notes || '').includes(marker)) ||
          allPending.find((p) => p.periodKey === `debit:${opts.debitId}`) ||
          allPending.find((p) => p.id === opts.debitId);
        if (byDebit) return byDebit;
      }
      if (opts.packId) {
        const marker = `clientMembershipId=${opts.packId}`;
        const byPack = allPending.find((p) => (p.notes || '').includes(marker));
        if (byPack) return byPack;
      }
      if (opts.calendarKey) {
        const byMonth = allPending.find((p) => {
          if (p.periodKey === opts.calendarKey) return true;
          return calendarPeriodKeyFromPayment(p) === opts.calendarKey;
        });
        if (byMonth) return byMonth;
      }
      return allPending[0] || null;
    };

    let pendingPayment: PayWithClient | null = null;
    let paidReference: PayWithClient | null = null;

    if (paymentId) {
      const byId = await prisma.payment.findFirst({
        where: { id: paymentId, tenantId: req.tenant.id },
        include: { client: true },
      });
      if (byId && (byId.status === 'pending' || byId.status === 'overdue')) {
        pendingPayment = byId;
      } else if (byId) {
        paidReference = byId;
      }
    }

    const targetClientId =
      clientId || pendingPayment?.clientId || paidReference?.clientId || null;

    // После частичной оплаты latestPaymentId часто указывает на paid-слайс.
    // Нельзя создавать «orphan» оплату — сначала гасим оставшийся pending того же пакета/периода.
    if (!pendingPayment && targetClientId) {
      const packId =
        packIdFromPeriod ||
        extractPackMembershipId(paidReference?.notes) ||
        null;
      const debitId =
        debitIdFromPeriod ||
        extractClientDebitId(paidReference?.notes) ||
        (paidReference?.periodKey?.startsWith('debit:')
          ? paidReference.periodKey.slice('debit:'.length)
          : null);
      pendingPayment = await findPendingInScope(String(targetClientId), {
        packId,
        debitId,
        calendarKey:
          periodKeyStr ||
          (paidReference ? calendarPeriodKeyFromPayment(paidReference) : null),
        preferId: null,
      });
      // Если periodKey = pack:/debit:… и pending этого события нет — не хватать чужой счёт
      if (packId && pendingPayment) {
        const marker = `clientMembershipId=${packId}`;
        if (!(pendingPayment.notes || '').includes(marker)) {
          pendingPayment = null;
        }
      } else if (debitId && pendingPayment) {
        const marker = `clientDebitId=${debitId}`;
        const sameDebit =
          (pendingPayment.notes || '').includes(marker) ||
          pendingPayment.periodKey === `debit:${debitId}` ||
          pendingPayment.id === debitId;
        if (!sameDebit) pendingPayment = null;
      } else if (periodKeyStr && pendingPayment && !paidReference) {
        const key = calendarPeriodKeyFromPayment(pendingPayment);
        if (pendingPayment.periodKey !== periodKeyStr && key !== periodKeyStr) {
          pendingPayment = null;
        }
      }
    }

    if (!pendingPayment && paidReference?.status === 'paid' && targetClientId) {
      const clientName = `${paidReference.client.lastName} ${paidReference.client.firstName}`.trim();
      const yyyyMm =
        periodKeyStr ||
        (paidReference.periodKey && /^\d{4}-\d{2}$/.test(paidReference.periodKey)
          ? paidReference.periodKey
          : null);
      const extra = await prisma.payment.create({
        data: {
          tenantId: req.tenant.id,
          clientId: targetClientId,
          amount: increment,
          type: paidReference.type,
          status: 'paid',
          paidAt: new Date(),
          isMonthlyPayment: paidReference.isMonthlyPayment,
          branchId: paidReference.branchId,
          groupId: paidReference.groupId,
          membershipId: paidReference.membershipId,
          periodKey: yyyyMm,
          notes: mergeChargeNotes(paidReference.notes, notes, ['[payment-excess]']),
        },
        include: { client: true },
      });
      await FinanceService.recordPaymentIncome(extra, clientName);
      await accrueTrainerFromPaidPayment(req.tenant.id, extra);
      notifyPaid(targetClientId, increment, paidReference.branchId);
      res.json({ success: true, data: { payment: extra } });
      return;
    }

    if (!pendingPayment && targetClientId) {
      const client = await prisma.client.findFirst({
        where: { id: targetClientId, tenantId: req.tenant.id },
      });
      if (!client) throw badRequest('Клиент не найден', 'clientId');
      const clientName = `${client.lastName} ${client.firstName}`.trim();
      const packNote = packIdFromPeriod ? `clientMembershipId=${packIdFromPeriod}` : null;
      const extra = await prisma.payment.create({
        data: {
          tenantId: req.tenant.id,
          clientId: targetClientId,
          amount: increment,
          type: 'membership',
          status: 'paid',
          paidAt: new Date(),
          isMonthlyPayment: true,
          periodKey: periodKeyStr,
          notes: mergeChargeNotes(packNote, notes, ['[payment-excess]']),
        },
        include: { client: true },
      });
      await FinanceService.recordPaymentIncome(extra, clientName);
      await accrueTrainerFromPaidPayment(req.tenant.id, extra);
      notifyPaid(targetClientId, increment);
      res.json({ success: true, data: { payment: extra } });
      return;
    }

    if (!pendingPayment) {
      throw badRequest('Не найден неоплаченный платёж для зачисления', 'paymentId');
    }

    const clientName = `${pendingPayment.client.lastName} ${pendingPayment.client.firstName}`.trim();
    const pendingAmt = Number(pendingPayment.amount);
    let resultPayment = pendingPayment;
    const chargePeriodKey =
      pendingPayment.periodKey &&
      (/^\d{4}-\d{2}$/.test(pendingPayment.periodKey) ||
        pendingPayment.periodKey.startsWith('pack:') ||
        pendingPayment.periodKey.startsWith('debit:'))
        ? pendingPayment.periodKey
        : periodKeyStr;

    if (increment >= pendingAmt) {
      const chargeOriginal =
        pendingPayment.originalAmount != null
          ? Number(pendingPayment.originalAmount)
          : pendingAmt;
      resultPayment = await prisma.payment.update({
        where: { id: pendingPayment.id },
        data: {
          status: 'paid',
          paidAt: new Date(),
          amount: pendingAmt,
          originalAmount: chargeOriginal,
          notes: mergeChargeNotes(pendingPayment.notes, notes),
        },
        include: { client: true },
      });
      await FinanceService.recordPaymentIncome(resultPayment, clientName);
      await accrueTrainerFromPaidPayment(req.tenant.id, resultPayment);

      const excess = increment - pendingAmt;
      if (excess > 0) {
        const extra = await prisma.payment.create({
          data: {
            tenantId: req.tenant.id,
            clientId: pendingPayment.clientId,
            amount: excess,
            type: pendingPayment.type,
            status: 'paid',
            paidAt: new Date(),
            isMonthlyPayment: pendingPayment.isMonthlyPayment,
            branchId: pendingPayment.branchId,
            groupId: pendingPayment.groupId,
            membershipId: pendingPayment.membershipId,
            periodKey: chargePeriodKey,
            notes: mergeChargeNotes(pendingPayment.notes, notes, ['[payment-excess]']),
          },
          include: { client: true },
        });
        await FinanceService.recordPaymentIncome(extra, clientName);
        await accrueTrainerFromPaidPayment(req.tenant.id, extra);
        resultPayment = extra;
      }
    } else {
      const chargeOriginal =
        pendingPayment.originalAmount != null
          ? Number(pendingPayment.originalAmount)
          : pendingAmt;
      await prisma.payment.update({
        where: { id: pendingPayment.id },
        data: {
          amount: pendingAmt - increment,
          originalAmount: chargeOriginal,
        },
      });

      resultPayment = await prisma.payment.create({
        data: {
          tenantId: req.tenant.id,
          clientId: pendingPayment.clientId,
          amount: increment,
          type: pendingPayment.type,
          status: 'paid',
          paidAt: new Date(),
          isMonthlyPayment: pendingPayment.isMonthlyPayment,
          branchId: pendingPayment.branchId,
          groupId: pendingPayment.groupId,
          membershipId: pendingPayment.membershipId,
          periodKey: chargePeriodKey,
          dueDate: pendingPayment.dueDate,
          originalAmount: chargeOriginal,
          notes: mergeChargeNotes(pendingPayment.notes, notes),
        },
        include: { client: true },
      });
      await FinanceService.recordPaymentIncome(resultPayment, clientName);
      await accrueTrainerFromPaidPayment(req.tenant.id, resultPayment);
    }

    notifyPaid(pendingPayment.clientId, increment, pendingPayment.branchId);

    // Остаток долга после частичной оплаты
    if (increment < pendingAmt) {
      void notifyClientDebt({
        tenantId: req.tenant.id,
        clientId: pendingPayment.clientId,
        amount: pendingAmt - increment,
      }).catch((err) => console.error('[Notifications] debt:', err));
    }

    res.json({
      success: true,
      data: { payment: resultPayment },
    });
  }
);

/** Корректировка начисления (append-only). */
export const correctMembershipAccrual = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    if (!req.tenant?.id) {
      res.status(400).json({ success: false, error: 'Tenant ID is required' });
      return;
    }
    if (!req.user?.id) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { clientId, paymentId, newAmount, reason, occurredAt, periodKey } = req.body;
    if (!clientId) throw badRequest('Укажите clientId', 'clientId');
    await assertSeniorCanAccessClient(req, String(clientId));

    const result = await FinanceService.correctMembershipAccrual(req.tenant.id, {
      clientId: String(clientId),
      paymentId: paymentId ? String(paymentId) : null,
      periodKey: periodKey ? String(periodKey) : null,
      newAmount: Number(newAmount),
      reason: String(reason || ''),
      userId: req.user.id,
      occurredAt: occurredAt ? new Date(occurredAt) : undefined,
    });

    res.json({ success: true, data: result });
  }
);

/** Изменить стоимость абонемента / пересчитать долг. */
export const updateMembershipAmount = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    if (!req.tenant?.id) {
      res.status(400).json({ success: false, error: 'Tenant ID is required' });
      return;
    }

    const { paymentId, amount, notes } = req.body;
    if (!paymentId) throw badRequest('Укажите paymentId', 'paymentId');
    const newAmount = Number(amount);
    if (!Number.isFinite(newAmount) || newAmount < 0) {
      throw badRequest('Некорректная сумма', 'amount');
    }

    const payment = await prisma.payment.findFirst({
      where: { id: paymentId, tenantId: req.tenant.id },
    });
    if (!payment) throw badRequest('Платёж не найден', 'paymentId');
    await assertSeniorCanAccessClient(req, payment.clientId);

    const oldAmt = Number(payment.amount);
    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        // Намеренная смена начисления: originalAmount = новая сумма счёта
        originalAmount: newAmount,
        amount: newAmount,
        notes: notes ?? payment.notes,
      },
    });

    // Начисление pending влияет на остаток/баланс: Δ = new − old → decrement
    if (
      (payment.status === 'pending' || payment.status === 'overdue') &&
      Math.abs(newAmount - oldAmt) > 0.005
    ) {
      await prisma.client.update({
        where: { id: payment.clientId },
        data: { balance: { decrement: newAmount - oldAmt } },
      });
    }

    if (
      (payment.status === 'pending' || payment.status === 'overdue') &&
      newAmount > 0
    ) {
      void notifyClientDebt({
        tenantId: req.tenant.id,
        clientId: payment.clientId,
        amount: newAmount,
        label: 'Обновлена сумма к оплате',
      }).catch((err) => console.error('[Notifications] debt:', err));
      void notifyFinanceChange({
        tenantId: req.tenant.id,
        title: 'Изменена сумма абонемента',
        body: Number(newAmount).toLocaleString('ru-RU'),
        excludeUserId: req.user?.id,
      }).catch((err) => console.error('[Notifications] finance:', err));
    }

    res.json({ success: true, data: updated });
  }
);

/** Сменить клиентский тариф и пересчитать начисление. */
export const changeMembershipPack = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    if (!req.tenant?.id) {
      res.status(400).json({ success: false, error: 'Tenant ID is required' });
      return;
    }
    const { clientId, membershipId } = req.body;
    if (!clientId) throw badRequest('Укажите clientId', 'clientId');
    if (!membershipId) throw badRequest('Укажите membershipId', 'membershipId');
    await assertSeniorCanAccessClient(req, String(clientId));

    const { changeClientMembershipPack } = await import('../services/clientMembershipService');
    try {
      const result = await changeClientMembershipPack({
        tenantId: req.tenant.id,
        clientId,
        membershipId,
      });
      res.json({ success: true, data: result });
    } catch (err: any) {
      const status = err?.statusCode || 500;
      res.status(status).json({ success: false, error: err?.message || 'Не удалось сменить абонемент' });
    }
  }
);

/** Расшифровка начислений за месяц (для tooltip в Финансах). */
export const getMonthChargesBreakdown = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    if (!req.tenant?.id) {
      res.status(400).json({ success: false, error: 'Tenant ID is required' });
      return;
    }
    const clientId = typeof req.query.clientId === 'string' ? req.query.clientId : undefined;
    const month = typeof req.query.month === 'string' ? req.query.month : undefined; // YYYY-MM
    let dateFrom = parseDate(req.query.dateFrom);
    let dateTo = parseDate(req.query.dateTo);

    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [y, m] = month.split('-').map(Number);
      dateFrom = new Date(y, m - 1, 1, 0, 0, 0, 0);
      dateTo = new Date(y, m, 0, 23, 59, 59, 999);
    }

    const data = await FinanceService.listOperations(req.tenant.id, {
      clientIds: clientId ? [clientId] : undefined,
      dateFrom,
      dateTo,
      typeCodes: [
        'membership_charge',
        'membership_charge_adjustment',
        'membership_issue',
        'training_payment',
        'membership',
        'client_payment',
      ],
      limit: 100,
      sortBy: 'occurredAt',
      sortDir: 'desc',
    });

    res.json({ success: true, data: data.items || [] });
  }
);

export const getFinanceRefs = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  if (!req.tenant?.id) {
    res.status(400).json({ success: false, error: 'Tenant ID is required' });
    return;
  }
  const data = await FinanceService.getRefs(req.tenant.id);
  res.json({ success: true, data });
});
