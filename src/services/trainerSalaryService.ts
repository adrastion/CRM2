import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';

export const SALARY_SCHEMES = [
  'per_training_person',
  'fixed_per_student_month',
  'percent_month',
  'fixed_monthly',
] as const;

export type SalaryScheme = (typeof SALARY_SCHEMES)[number];

export const LEDGER_KINDS = [
  'training_visit',
  'membership_share',
  'membership_percent',
  'fixed_monthly',
  'bonus',
  'adjustment',
  'payout',
] as const;

export type LedgerKind = (typeof LEDGER_KINDS)[number];

const SCHEME_LABELS: Record<SalaryScheme, string> = {
  per_training_person: 'Фикс за тренировку с человека',
  fixed_per_student_month: 'Фикс с ученика в месяц',
  percent_month: 'Фикс % в месяц',
  fixed_monthly: 'Фикс плата в месяц',
};

/** Map new scheme → legacy salaryType for older code paths */
export function schemeToLegacyType(scheme: SalaryScheme): string {
  switch (scheme) {
    case 'percent_month':
      return 'percentage';
    case 'fixed_monthly':
      return 'fixed';
    case 'fixed_per_student_month':
      return 'per_student';
    case 'per_training_person':
    default:
      return 'per_student';
  }
}

export function resolveScheme(trainer: {
  salaryScheme?: string | null;
  salaryType?: string | null;
}): SalaryScheme {
  const s = trainer.salaryScheme;
  if (s && (SALARY_SCHEMES as readonly string[]).includes(s)) {
    return s as SalaryScheme;
  }
  switch (trainer.salaryType) {
    case 'percentage':
    case 'individual':
      return 'percent_month';
    case 'fixed':
      return 'fixed_monthly';
    case 'per_student':
    case 'per_training':
    default:
      return 'per_training_person';
  }
}

export function resolveRate(trainer: {
  salaryRate?: Prisma.Decimal | number | null;
  salaryAmount?: Prisma.Decimal | number | null;
  salaryPercentage?: Prisma.Decimal | number | null;
}): number {
  if (trainer.salaryRate != null) return Number(trainer.salaryRate);
  if (trainer.salaryAmount != null) return Number(trainer.salaryAmount);
  if (trainer.salaryPercentage != null) return Number(trainer.salaryPercentage);
  return 0;
}

function formatPersonName(client: {
  lastName?: string | null;
  firstName?: string | null;
  middleName?: string | null;
}): string {
  const last = (client.lastName || '').trim();
  const first = (client.firstName || '').trim();
  const middle = (client.middleName || '').trim();
  const initials = [first, middle]
    .filter(Boolean)
    .map((p) => `${p[0].toUpperCase()}.`)
    .join('');
  return [last, initials].filter(Boolean).join(' ') || 'Клиент';
}

function periodKeyFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

async function createLedgerAndUpdateBalance(params: {
  tenantId: string;
  trainerId: string;
  kind: LedgerKind;
  amount: number;
  occurredAt: Date;
  personName?: string | null;
  title: string;
  comment?: string;
  clientId?: string | null;
  trainingId?: string | null;
  groupId?: string | null;
  paymentId?: string | null;
  attendanceId?: string | null;
  periodKey?: string | null;
  /** If true, amount is added to balance; for payout pass negative amount or set updateBalance false and handle separately */
  updateBalance?: boolean;
}): Promise<{ created: boolean; amount: number }> {
  const amount = Number(params.amount);
  if (!Number.isFinite(amount) || amount === 0) {
    return { created: false, amount: 0 };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.trainerSalaryLedger.create({
        data: {
          tenantId: params.tenantId,
          trainerId: params.trainerId,
          kind: params.kind,
          amount,
          occurredAt: params.occurredAt,
          personName: params.personName ?? null,
          title: params.title,
          comment: params.comment ?? '',
          clientId: params.clientId ?? null,
          trainingId: params.trainingId ?? null,
          groupId: params.groupId ?? null,
          paymentId: params.paymentId ?? null,
          attendanceId: params.attendanceId ?? null,
          periodKey: params.periodKey ?? null,
        },
      });

      if (params.updateBalance !== false) {
        await tx.trainer.update({
          where: { id: params.trainerId },
          data: { balance: { increment: amount } },
        });
      }
    });
    return { created: true, amount };
  } catch (err: any) {
    // Unique constraint → already accrued (idempotent)
    if (err?.code === 'P2002') {
      return { created: false, amount: 0 };
    }
    throw err;
  }
}

/**
 * V1: фикс за тренировку с человека — при PRESENT / платном пропуске.
 */
export async function accrueForAttendance(params: {
  tenantId: string;
  trainerId: string;
  trainingId: string;
  attendanceId: string;
  clientId: string;
  trainingTitle?: string;
  trainingStart?: Date;
  isMissed?: boolean;
}): Promise<number> {
  const trainer = await prisma.trainer.findFirst({
    where: { id: params.trainerId, tenantId: params.tenantId },
  });
  if (!trainer || !trainer.isActive) return 0;

  const scheme = resolveScheme(trainer);
  if (scheme !== 'per_training_person') return 0;

  const rate = resolveRate(trainer);
  if (rate <= 0) return 0;

  const client = await prisma.client.findFirst({
    where: { id: params.clientId, tenantId: params.tenantId },
  });
  if (!client) return 0;

  const personName = formatPersonName(client);
  const comment = params.isMissed
    ? 'посещение тренировки (пропуск со списанием)'
    : 'посещение тренировки';
  const title = personName;

  const result = await createLedgerAndUpdateBalance({
    tenantId: params.tenantId,
    trainerId: params.trainerId,
    kind: 'training_visit',
    amount: rate,
    occurredAt: params.trainingStart || new Date(),
    personName,
    title,
    comment,
    clientId: params.clientId,
    trainingId: params.trainingId,
    attendanceId: params.attendanceId,
  });

  // Keep legacy transaction for finance history compatibility
  if (result.created) {
    await prisma.transaction.create({
      data: {
        type: 'trainer_earnings',
        amount: rate,
        description: `Заработок: ${title}${params.trainingTitle ? ` — ${params.trainingTitle}` : ''}`,
        trainerId: params.trainerId,
        trainingId: params.trainingId,
        attendanceId: params.attendanceId,
        clientId: params.clientId,
        tenantId: params.tenantId,
      },
    }).catch(() => undefined);
  }

  return result.amount;
}

/**
 * V2/V3: при оплате абонемента / месячного платежа клиентом группы тренера.
 */
export async function accrueForPayment(params: {
  tenantId: string;
  paymentId: string;
  clientId: string;
  amount: number;
  groupId?: string | null;
  isMonthlyPayment?: boolean;
  paymentType?: string;
  paidAt?: Date | null;
}): Promise<number> {
  const paymentAmount = Number(params.amount);
  if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) return 0;

  // Find groups where client is active member and trainer is primary
  const memberships = await prisma.groupMembership.findMany({
    where: {
      clientId: params.clientId,
      isActive: true,
      leftAt: null,
      ...(params.groupId ? { groupId: params.groupId } : {}),
      group: {
        tenantId: params.tenantId,
        isActive: true,
      },
    },
    include: {
      group: {
        include: { trainer: true },
      },
      client: true,
    },
  });

  if (memberships.length === 0) return 0;

  const client = memberships[0].client;
  const personName = formatPersonName(client);
  const isMembership =
    params.isMonthlyPayment ||
    params.paymentType === 'membership' ||
    params.paymentType === 'monthly';
  const comment = params.isMonthlyPayment
    ? 'оплата месяца тренировок'
    : isMembership
      ? 'оплата абонемента'
      : 'оплата';

  let total = 0;

  // Prefer unique trainers (client may be in multiple groups of same trainer)
  const byTrainer = new Map<string, (typeof memberships)[0]>();
  for (const m of memberships) {
    const tid = m.group.trainerId;
    if (!byTrainer.has(tid)) byTrainer.set(tid, m);
  }

  for (const [, m] of byTrainer) {
    const trainer = m.group.trainer;
    if (!trainer?.isActive) continue;

    const scheme = resolveScheme(trainer);
    const rate = resolveRate(trainer);

    if (scheme === 'fixed_per_student_month') {
      if (rate <= 0) continue;
      const result = await createLedgerAndUpdateBalance({
        tenantId: params.tenantId,
        trainerId: trainer.id,
        kind: 'membership_share',
        amount: rate,
        occurredAt: params.paidAt || new Date(),
        personName,
        title: personName,
        comment,
        clientId: params.clientId,
        groupId: m.groupId,
        paymentId: params.paymentId,
      });
      total += result.amount;
    } else if (scheme === 'percent_month') {
      if (rate <= 0) continue;
      const amount = Math.round(((paymentAmount * rate) / 100) * 100) / 100;
      if (amount <= 0) continue;
      const result = await createLedgerAndUpdateBalance({
        tenantId: params.tenantId,
        trainerId: trainer.id,
        kind: 'membership_percent',
        amount,
        occurredAt: params.paidAt || new Date(),
        personName,
        title: personName,
        comment,
        clientId: params.clientId,
        groupId: m.groupId,
        paymentId: params.paymentId,
      });
      total += result.amount;
    }
  }

  return total;
}

/**
 * V4: фикс в месяц — начисление в день выплаты (идемпотентно по periodKey).
 */
export async function accrueFixedMonthlyForTenant(
  tenantId: string,
  forDate: Date = new Date()
): Promise<number> {
  const trainers = await prisma.trainer.findMany({
    where: { tenantId, isActive: true },
  });

  const periodKey = periodKeyFromDate(forDate);
  let count = 0;

  for (const trainer of trainers) {
    if (resolveScheme(trainer) !== 'fixed_monthly') continue;
    const rate = resolveRate(trainer);
    if (rate <= 0) continue;

    const result = await createLedgerAndUpdateBalance({
      tenantId,
      trainerId: trainer.id,
      kind: 'fixed_monthly',
      amount: rate,
      occurredAt: forDate,
      personName: null,
      title: 'Фиксированная зарплата',
      comment: `начисление за ${periodKey}`,
      periodKey,
    });
    if (result.created) count += 1;
  }

  return count;
}

export async function accrueFixedMonthlyForAllTenants(forDate: Date = new Date()): Promise<void> {
  const settings = await prisma.tenantSettings.findMany({
    select: { tenantId: true, salaryPayoutDay: true },
  });
  const day = forDate.getDate();

  for (const s of settings) {
    const payoutDay = s.salaryPayoutDay ?? 25;
    if (day === payoutDay) {
      await accrueFixedMonthlyForTenant(s.tenantId, forDate);
    }
  }

  // Tenants without settings — default day 25
  const tenantsWithSettings = new Set(settings.map((s) => s.tenantId));
  if (day === 25) {
    const tenants = await prisma.tenant.findMany({
      where: { isActive: true },
      select: { id: true },
    });
    for (const t of tenants) {
      if (!tenantsWithSettings.has(t.id)) {
        await accrueFixedMonthlyForTenant(t.id, forDate);
      }
    }
  }
}

/**
 * Ручная премия / корректировка.
 */
export async function addManualLedgerEntry(params: {
  tenantId: string;
  trainerId: string;
  kind?: 'bonus' | 'adjustment';
  amount: number;
  title?: string;
  comment?: string;
  occurredAt?: Date;
  personName?: string | null;
}): Promise<{ id: string; amount: number }> {
  const amount = Number(params.amount);
  if (!Number.isFinite(amount) || amount === 0) {
    throw new Error('Сумма должна быть ненулевой');
  }

  const trainer = await prisma.trainer.findFirst({
    where: { id: params.trainerId, tenantId: params.tenantId },
  });
  if (!trainer) throw new Error('Тренер не найден');

  const kind = params.kind || 'bonus';
  const title = params.title?.trim() || (kind === 'bonus' ? 'Премия' : 'Корректировка');
  const occurredAt = params.occurredAt || new Date();

  const row = await prisma.$transaction(async (tx) => {
    const ledger = await tx.trainerSalaryLedger.create({
      data: {
        tenantId: params.tenantId,
        trainerId: params.trainerId,
        kind,
        amount,
        occurredAt,
        personName: params.personName ?? null,
        title,
        comment: params.comment?.trim() || (kind === 'bonus' ? 'премия' : 'корректировка'),
      },
    });
    await tx.trainer.update({
      where: { id: params.trainerId },
      data: { balance: { increment: amount } },
    });
    return ledger;
  });

  return { id: row.id, amount };
}

/**
 * Выплата: отрицательная строка реестра (баланс уже мог быть списан вызывающим).
 */
export async function recordPayout(params: {
  tenantId: string;
  trainerId: string;
  amount: number;
  occurredAt?: Date;
  comment?: string;
  updateBalance?: boolean;
}): Promise<void> {
  const amount = Math.abs(Number(params.amount));
  if (!Number.isFinite(amount) || amount <= 0) return;

  await createLedgerAndUpdateBalance({
    tenantId: params.tenantId,
    trainerId: params.trainerId,
    kind: 'payout',
    amount: -amount,
    occurredAt: params.occurredAt || new Date(),
    personName: null,
    title: 'Выплата зарплаты',
    comment: params.comment || 'выплата',
    updateBalance: params.updateBalance === true,
  });
}

export async function getTrainerLedger(
  tenantId: string,
  trainerId: string,
  from?: Date,
  to?: Date
) {
  const where: Prisma.TrainerSalaryLedgerWhereInput = {
    tenantId,
    trainerId,
    ...(from || to
      ? {
          occurredAt: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {}),
  };

  const rows = await prisma.trainerSalaryLedger.findMany({
    where,
    orderBy: { occurredAt: 'desc' },
  });

  const accruals = rows.filter((r) => r.kind !== 'payout');
  const totalEarnings = accruals.reduce((s, r) => s + Number(r.amount), 0);

  return {
    items: rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      amount: Number(r.amount),
      occurredAt: r.occurredAt,
      personName: r.personName,
      title: r.title,
      comment: r.comment,
      clientId: r.clientId,
      trainingId: r.trainingId,
      groupId: r.groupId,
      paymentId: r.paymentId,
      attendanceId: r.attendanceId,
    })),
    totalEarnings,
    entryCount: accruals.length,
  };
}

export async function getSalaryLedgerSummary(
  tenantId: string,
  from?: Date,
  to?: Date
) {
  const trainers = await prisma.trainer.findMany({
    where: { tenantId, isActive: true },
    include: { user: true },
  });

  const dateFilter =
    from || to
      ? {
          occurredAt: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {};

  const results = await Promise.all(
    trainers.map(async (trainer) => {
      const rows = await prisma.trainerSalaryLedger.findMany({
        where: {
          tenantId,
          trainerId: trainer.id,
          kind: { not: 'payout' },
          ...dateFilter,
        },
      });
      const totalEarnings = rows.reduce((s, r) => s + Number(r.amount), 0);
      const scheme = resolveScheme(trainer);
      return {
        trainerId: trainer.id,
        trainerName: `${trainer.user?.lastName} ${trainer.user?.firstName} ${trainer.user?.middleName || ''}`.trim(),
        salaryScheme: scheme,
        salarySchemeLabel: SCHEME_LABELS[scheme],
        salaryRate: resolveRate(trainer),
        // legacy aliases for UI
        salaryType: scheme,
        salaryAmount: resolveRate(trainer),
        trainingCount: rows.filter((r) => r.kind === 'training_visit').length,
        entryCount: rows.length,
        totalEarnings,
        balance: Number(trainer.balance || 0),
      };
    })
  );

  return {
    trainers: results,
    totalEarnings: results.reduce((s, t) => s + t.totalEarnings, 0),
  };
}

/**
 * Баннер напоминания: окно [payoutDay-5 … payoutDay], есть ненулевой баланс.
 */
export async function getPayoutReminder(tenantId: string, today: Date = new Date()) {
  const settings = await prisma.tenantSettings.findUnique({ where: { tenantId } });
  const payoutDay = settings?.salaryPayoutDay ?? 25;
  const day = today.getDate();
  const windowStart = Math.max(1, payoutDay - 5);

  if (day < windowStart || day > payoutDay) {
    return { show: false as const, daysLeft: 0, payoutDay, totalBalance: 0 };
  }

  const agg = await prisma.trainer.aggregate({
    where: { tenantId, isActive: true, balance: { gt: 0 } },
    _sum: { balance: true },
  });
  const totalBalance = Number(agg._sum.balance || 0);
  if (totalBalance <= 0) {
    return { show: false as const, daysLeft: 0, payoutDay, totalBalance: 0 };
  }

  return {
    show: true as const,
    daysLeft: Math.max(0, payoutDay - day),
    payoutDay,
    totalBalance,
  };
}

/**
 * Доначисление за уже отмеченные PRESENT (идемпотентно по attendanceId).
 * Нужно после исправления путей, где bulk-посещения не писали в реестр.
 */
export async function backfillTrainingVisitAccruals(tenantId: string): Promise<{
  processed: number;
  accruedCount: number;
  accruedTotal: number;
}> {
  const rows = await prisma.attendance.findMany({
    where: { tenantId, status: 'PRESENT' },
    include: {
      training: {
        select: {
          id: true,
          title: true,
          startTime: true,
          trainerId: true,
          substituteTrainerId: true,
        },
      },
    },
  });

  let accruedCount = 0;
  let accruedTotal = 0;

  for (const a of rows) {
    if (!a.training) continue;
    const trainerId = a.training.substituteTrainerId || a.training.trainerId;
    const amount = await accrueForAttendance({
      tenantId,
      trainerId,
      trainingId: a.trainingId,
      attendanceId: a.id,
      clientId: a.clientId,
      trainingTitle: a.training.title,
      trainingStart: a.training.startTime,
    });
    if (amount > 0) {
      accruedCount += 1;
      accruedTotal += amount;
    }
  }

  return { processed: rows.length, accruedCount, accruedTotal };
}

export { SCHEME_LABELS };
