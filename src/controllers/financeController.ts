import { Response } from 'express';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { asyncHandler } from '../middleware/errorHandler';
import { FinanceService, FinanceDirection } from '../services/financeService';
import { PrismaClient } from '@prisma/client';
import { badRequest } from '../utils/httpError';

const prisma = new PrismaClient();

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

  const data = await FinanceService.listOperations(req.tenant.id, {
    dateFrom: parseDate(req.query.dateFrom),
    dateTo: parseDate(req.query.dateTo),
    datePreset: req.query.datePreset ? String(req.query.datePreset) : undefined,
    search: req.query.search ? String(req.query.search) : undefined,
    amountFrom: req.query.amountFrom != null ? Number(req.query.amountFrom) : undefined,
    amountTo: req.query.amountTo != null ? Number(req.query.amountTo) : undefined,
    typeCodes: parseList(req.query.typeCodes),
    groupIds: parseList(req.query.groupIds),
    branchIds: parseList(req.query.branchIds),
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
    createdById: req.user?.id,
  });

  res.status(201).json({ success: true, data: op });
});

export const payoutTrainerSalary = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  if (!req.tenant?.id) {
    res.status(400).json({ success: false, error: 'Tenant ID is required' });
    return;
  }

  const op = await FinanceService.payoutTrainerSalary(req.tenant.id, {
    trainerId: req.body.trainerId,
    amount: req.body.amount,
    periodLabel: req.body.periodLabel,
    occurredAt: req.body.occurredAt,
    notes: req.body.notes,
    createdById: req.user?.id,
  });

  res.status(201).json({ success: true, data: op });
});

export const getSalarySummary = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  if (!req.tenant?.id) {
    res.status(400).json({ success: false, error: 'Tenant ID is required' });
    return;
  }

  const data = await FinanceService.salarySummary(req.tenant.id, {
    trainerIds: parseList(req.query.trainerIds),
    dateFrom: parseDate(req.query.dateFrom),
    dateTo: parseDate(req.query.dateTo),
    amountFrom: req.query.amountFrom != null ? Number(req.query.amountFrom) : undefined,
    amountTo: req.query.amountTo != null ? Number(req.query.amountTo) : undefined,
  });

  res.json({ success: true, data });
});

export const getMembershipFinanceSummary = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    if (!req.tenant?.id) {
      res.status(400).json({ success: false, error: 'Tenant ID is required' });
      return;
    }

    const data = await FinanceService.membershipSummary(req.tenant.id, {
      clientIds: parseList(req.query.clientIds),
      trainerIds: parseList(req.query.trainerIds),
      branchIds: parseList(req.query.branchIds),
      groupIds: parseList(req.query.groupIds),
      search: req.query.search ? String(req.query.search) : undefined,
      amountFrom: req.query.amountFrom != null ? Number(req.query.amountFrom) : undefined,
      amountTo: req.query.amountTo != null ? Number(req.query.amountTo) : undefined,
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

    const { paymentId, clientId, amount, notes } = req.body;
    if (!paymentId && !clientId) {
      throw badRequest('Укажите paymentId или clientId', 'paymentId');
    }

    const increment = amount != null ? Number(amount) : NaN;
    if (!Number.isFinite(increment) || increment <= 0) {
      throw badRequest('Некорректная сумма', 'amount');
    }

    let pendingPayment = paymentId
      ? await prisma.payment.findFirst({
          where: { id: paymentId, tenantId: req.tenant.id, status: { in: ['pending', 'overdue'] } },
          include: { client: true },
        })
      : await prisma.payment.findFirst({
          where: {
            tenantId: req.tenant.id,
            clientId,
            status: { in: ['pending', 'overdue'] },
          },
          orderBy: { dueDate: 'asc' },
          include: { client: true },
        });

    let paidReference: (typeof pendingPayment) = null;
    if (!pendingPayment && paymentId) {
      paidReference = await prisma.payment.findFirst({
        where: { id: paymentId, tenantId: req.tenant.id },
        include: { client: true },
      });
    }

    const targetClientId = clientId || pendingPayment?.clientId || paidReference?.clientId;
    if (!pendingPayment && paidReference?.status === 'paid' && targetClientId) {
      const clientName = `${paidReference.client.lastName} ${paidReference.client.firstName}`.trim();
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
          notes: notes ?? null,
        },
        include: { client: true },
      });
      await FinanceService.recordPaymentIncome(extra, clientName);
      res.json({ success: true, data: { payment: extra } });
      return;
    }

    if (!pendingPayment && targetClientId) {
      const client = await prisma.client.findFirst({
        where: { id: targetClientId, tenantId: req.tenant.id },
      });
      if (!client) throw badRequest('Клиент не найден', 'clientId');
      const clientName = `${client.lastName} ${client.firstName}`.trim();
      const extra = await prisma.payment.create({
        data: {
          tenantId: req.tenant.id,
          clientId: targetClientId,
          amount: increment,
          type: 'membership',
          status: 'paid',
          paidAt: new Date(),
          isMonthlyPayment: true,
          notes: notes ?? null,
        },
        include: { client: true },
      });
      await FinanceService.recordPaymentIncome(extra, clientName);
      res.json({ success: true, data: { payment: extra } });
      return;
    }

    if (!pendingPayment) {
      throw badRequest('Не найден неоплаченный платёж для зачисления', 'paymentId');
    }

    const clientName = `${pendingPayment.client.lastName} ${pendingPayment.client.firstName}`.trim();
    const pendingAmt = Number(pendingPayment.amount);
    let resultPayment = pendingPayment;

    if (increment >= pendingAmt) {
      resultPayment = await prisma.payment.update({
        where: { id: pendingPayment.id },
        data: {
          status: 'paid',
          paidAt: new Date(),
          amount: pendingAmt,
          notes: notes ?? pendingPayment.notes,
        },
        include: { client: true },
      });
      await FinanceService.recordPaymentIncome(resultPayment, clientName);

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
            notes: notes ?? null,
          },
          include: { client: true },
        });
        await FinanceService.recordPaymentIncome(extra, clientName);
        resultPayment = extra;
      }
    } else {
      await prisma.payment.update({
        where: { id: pendingPayment.id },
        data: { amount: pendingAmt - increment },
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
          dueDate: pendingPayment.dueDate,
          originalAmount: pendingPayment.originalAmount,
          notes: notes ?? null,
        },
        include: { client: true },
      });
      await FinanceService.recordPaymentIncome(resultPayment, clientName);
    }

    res.json({
      success: true,
      data: { payment: resultPayment },
    });
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

    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        originalAmount: payment.originalAmount ?? payment.amount,
        amount: newAmount,
        notes: notes ?? payment.notes,
      },
    });

    res.json({ success: true, data: updated });
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
