import { prisma } from '../lib/prisma';
import { FinanceService } from './financeService';
import { clientHasGroupBilling } from './groupMembershipBillingService';

export type ActiveMembershipSummary = {
  id: string;
  membershipId: string;
  name: string;
  type: string;
  visitsUsed: number;
  visitsTotal: number | null;
  /** visitsTotal - visitsUsed; null если без лимита */
  remaining: number | null;
  endDate: Date | null;
  isActive: boolean;
};

export type ConsumeVisitResult = {
  coveredByMembership: boolean;
  membershipId?: string;
  /** Пакет только что ушёл в долг / истёк по дате */
  enteredDebt?: boolean;
  debt?: number;
  autoRenewed?: boolean;
};

export function visitsRemaining(visitsTotal: number | null | undefined, visitsUsed: number): number | null {
  if (visitsTotal == null) return null;
  return visitsTotal - visitsUsed;
}

export function visitDebt(visitsTotal: number | null | undefined, visitsUsed: number): number {
  if (visitsTotal == null) return 0;
  return Math.max(0, visitsUsed - visitsTotal);
}

export function toMembershipSummary(row: {
  id: string;
  membershipId: string;
  visitsUsed: number;
  visitsTotal: number | null;
  endDate: Date | null;
  isActive: boolean;
  membership: { name: string; type: string };
}): ActiveMembershipSummary {
  return {
    id: row.id,
    membershipId: row.membershipId,
    name: row.membership.name,
    type: row.membership.type,
    visitsUsed: row.visitsUsed,
    visitsTotal: row.visitsTotal,
    remaining: visitsRemaining(row.visitsTotal, row.visitsUsed),
    endDate: row.endDate,
    isActive: row.isActive,
  };
}

/** Выбрать текущий активный абонемент (visit-pack приоритетнее месячного). */
export function pickActiveMembershipSummary(
  rows: Array<{
    id: string;
    membershipId: string;
    visitsUsed: number;
    visitsTotal: number | null;
    endDate: Date | null;
    isActive: boolean;
    membership: { name: string; type: string };
  }>
): ActiveMembershipSummary | null {
  if (!rows?.length) return null;
  const visitPacks = rows.filter((r) => r.visitsTotal != null);
  const chosen = visitPacks[0] || rows[0];
  return toMembershipSummary(chosen);
}

/**
 * Активный visit-pack (в т.ч. в долгу) или duration-абонемент.
 * Долговые пакеты остаются isActive до выдачи нового.
 */
export async function findActiveClientMembership(clientId: string, tenantId: string) {
  const rows = await prisma.clientMembership.findMany({
    where: {
      clientId,
      tenantId,
      isActive: true,
    },
    include: { membership: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  if (rows.length === 0) return null;
  const visitPack = rows.find((r) => r.visitsTotal != null);
  return visitPack || rows[0];
}

export async function getActiveMembershipSummary(
  clientId: string,
  tenantId: string
): Promise<ActiveMembershipSummary | null> {
  const row = await findActiveClientMembership(clientId, tenantId);
  if (!row) return null;
  return toMembershipSummary(row);
}

/** Клиент на абонементной схеме (активный или долговой пакет) — monthly не начисляем. */
export async function clientHasMembershipBilling(
  clientId: string,
  tenantId: string
): Promise<boolean> {
  const active = await findActiveClientMembership(clientId, tenantId);
  return active != null;
}

/** Снять клиента со всех групп с ежемесячной оплатой. */
export async function removeClientFromMonthlyPaymentGroups(
  clientId: string,
  tenantId: string
): Promise<number> {
  const memberships = await prisma.groupMembership.findMany({
    where: {
      clientId,
      isActive: true,
      leftAt: null,
      group: {
        tenantId,
        isMonthlyPayment: true,
      },
    },
    select: { id: true },
  });
  if (memberships.length === 0) return 0;

  await prisma.groupMembership.updateMany({
    where: { id: { in: memberships.map((m) => m.id) } },
    data: { isActive: false, leftAt: new Date() },
  });
  return memberships.length;
}

/**
 * Есть ли «живое» покрытие (остаток > 0 или duration ещё не истёк).
 * В долгу / после expiry — false → клиент должен слететь с monthly-групп.
 */
export function hasLiveMembershipCoverage(row: {
  visitsTotal: number | null;
  visitsUsed: number;
  endDate: Date | null;
}): boolean {
  if (row.visitsTotal != null) {
    return row.visitsUsed < row.visitsTotal;
  }
  if (row.endDate) {
    return new Date() <= new Date(row.endDate);
  }
  // Безлимитный без даты окончания — считаем живым
  return true;
}

/**
 * Отменить pending/overdue ежемесячные платежи клиента и откатить membership_charge.
 */
export async function cancelPendingMonthlyPaymentsForClient(
  clientId: string,
  tenantId: string
): Promise<number> {
  const payments = await prisma.payment.findMany({
    where: {
      tenantId,
      clientId,
      isMonthlyPayment: true,
      status: { in: ['pending', 'overdue'] },
    },
    select: { id: true },
  });

  let cancelled = 0;
  for (const payment of payments) {
    const op = await prisma.financeOperation.findFirst({
      where: {
        tenantId,
        externalKey: `membership_charge:${payment.id}`,
      },
      select: { id: true },
    });
    if (op) {
      await FinanceService.deleteOperation(tenantId, op.id);
      cancelled += 1;
    } else {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'cancelled', paidAt: null },
      });
      cancelled += 1;
    }
  }
  return cancelled;
}

/**
 * Списать одно посещение с активного абонемента.
 * Visit-pack: visitsUsed++ даже сверх лимита (долг), пакет не деактивируется.
 * Duration после endDate: перевод в долговой режим (visitsTotal=0) + покрытие в долг.
 */
export async function consumeVisitFromActivePack(
  clientId: string,
  tenantId: string
): Promise<ConsumeVisitResult> {
  const active = await findActiveClientMembership(clientId, tenantId);
  if (!active) return { coveredByMembership: false };

  // Duration / безлимит
  if (active.visitsTotal == null) {
    if (active.endDate && new Date() > new Date(active.endDate)) {
      const visitsUsed = (active.visitsUsed || 0) + 1;
      await prisma.clientMembership.update({
        where: { id: active.id },
        data: {
          visitsTotal: 0,
          visitsUsed,
          isActive: true,
        },
      });
      await removeClientFromMonthlyPaymentGroups(clientId, tenantId);
      return {
        coveredByMembership: true,
        membershipId: active.id,
        enteredDebt: true,
        debt: visitDebt(0, visitsUsed),
      };
    }
    return { coveredByMembership: true, membershipId: active.id };
  }

  const wasLive = active.visitsUsed < active.visitsTotal;
  const visitsUsed = active.visitsUsed + 1;
  const enteredDebt = wasLive && visitsUsed >= active.visitsTotal;
  const alreadyInDebt = active.visitsUsed >= active.visitsTotal;

  await prisma.clientMembership.update({
    where: { id: active.id },
    data: {
      visitsUsed,
      isActive: true,
    },
  });

  if (enteredDebt || alreadyInDebt) {
    await removeClientFromMonthlyPaymentGroups(clientId, tenantId);
  }

  // Автопродление клиентского пакета при превышении лимита занятий
  if (active.visitsTotal != null && visitsUsed > active.visitsTotal) {
    const pack = await prisma.clientMembership.findUnique({
      where: { id: active.id },
      include: { membership: true },
    });
    if (pack?.membership && pack.membership.category !== 'GROUP') {
      try {
        const renewed = await issueClientMembership({
          tenantId,
          clientId,
          membershipId: pack.membershipId,
          allowWhileGroupBilling: false,
          isAutoRenew: true,
        });
        const price = Number(pack.membership.price || 0);
        if (price > 0 && renewed) {
          await FinanceService.recordMembershipIssue({
            tenantId,
            clientId,
            amount: price,
            title: `Автопродление абонемента: ${pack.membership.name}`,
            clientMembershipId: renewed.id,
            membershipCatalogId: pack.membershipId,
          }).catch((e) => console.error('Auto-renew finance record failed', e));
        }
        return {
          coveredByMembership: true,
          membershipId: renewed.id,
          enteredDebt: true,
          debt: visitDebt(renewed.visitsTotal, renewed.visitsUsed),
          autoRenewed: true,
        };
      } catch (e) {
        console.error('Auto-renew membership failed', e);
      }
    }
  }

  return {
    coveredByMembership: true,
    membershipId: active.id,
    enteredDebt: enteredDebt || alreadyInDebt,
    debt: visitDebt(active.visitsTotal, visitsUsed),
  };
}

/**
 * Вернуть одно посещение на активный клиентский пакет (PRESENT → ABSENT и т.п.).
 * visitsUsed не уходит ниже 0.
 */
export async function restoreVisitToActivePack(
  clientId: string,
  tenantId: string
): Promise<boolean> {
  const active = await findActiveClientMembership(clientId, tenantId);
  if (!active) return false;

  const used = active.visitsUsed || 0;
  if (used <= 0) return false;

  await prisma.clientMembership.update({
    where: { id: active.id },
    data: { visitsUsed: used - 1 },
  });
  return true;
}

/**
 * Выдать абонемент клиенту: долг по старым visit-pack переносится в visitsUsed нового.
 * Pending monthly платежи отменяются (схема взаимоисключающая).
 */
export async function issueClientMembership(params: {
  tenantId: string;
  clientId: string;
  membershipId: string;
  /** С какого числа действует абонемент (по умолчанию — сегодня) */
  startDate?: Date | string | null;
  /** Разрешить выдачу даже при групповом биллинге (служебное) */
  allowWhileGroupBilling?: boolean;
  isAutoRenew?: boolean;
}) {
  const membership = await prisma.membership.findFirst({
    where: { id: params.membershipId, tenantId: params.tenantId },
  });
  if (!membership) {
    throw Object.assign(new Error('Membership not found'), { statusCode: 404 });
  }
  if (membership.category === 'GROUP') {
    throw Object.assign(new Error('Групповой абонемент нельзя выдать клиенту лично'), { statusCode: 400 });
  }
  if (!params.allowWhileGroupBilling && (await clientHasGroupBilling(params.clientId, params.tenantId))) {
    throw Object.assign(
      new Error('Клиент в группе с ежемесячной оплатой — клиентский абонемент недоступен'),
      { statusCode: 400 }
    );
  }

  const startDate = params.startDate ? new Date(params.startDate) : new Date();
  if (Number.isNaN(startDate.getTime())) {
    throw Object.assign(new Error('Некорректная дата начала абонемента'), { statusCode: 400 });
  }
  startDate.setHours(0, 0, 0, 0);

  let endDate: Date | null = null;
  const validityDays = membership.validityDays ?? membership.duration;
  if (membership.periodType === 'CALENDAR_PERIOD' && membership.periodMonths) {
    endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + membership.periodMonths);
  } else if ((membership.type === 'monthly' || membership.periodType === 'FIXED_DAYS') && validityDays) {
    endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + validityDays);
  } else if (membership.periodType === 'VISITS' && validityDays) {
    endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + validityDays);
  }

  const visitsTotal = membership.visits ?? null;

  // Занятия с даты начала абонемента до сейчас — сразу списываем с пакета
  let pastVisits = 0;
  if (visitsTotal != null) {
    const rangeEnd = endDate && endDate < new Date() ? endDate : new Date();
    pastVisits = await prisma.attendance.count({
      where: {
        tenantId: params.tenantId,
        clientId: params.clientId,
        status: 'PRESENT',
        training: {
          startTime: {
            gte: startDate,
            lte: rangeEnd,
          },
        },
      },
    });
  }

  const created = await prisma.$transaction(async (tx) => {
    const activeVisitPacks = await tx.clientMembership.findMany({
      where: {
        clientId: params.clientId,
        tenantId: params.tenantId,
        isActive: true,
        visitsTotal: { not: null },
      },
    });

    let debt = 0;
    for (const pack of activeVisitPacks) {
      debt += visitDebt(pack.visitsTotal, pack.visitsUsed);
    }

    await tx.clientMembership.updateMany({
      where: {
        clientId: params.clientId,
        tenantId: params.tenantId,
        isActive: true,
      },
      data: { isActive: false },
    });

    const initialUsed = visitsTotal != null ? debt + pastVisits : 0;

    return tx.clientMembership.create({
      data: {
        clientId: params.clientId,
        membershipId: params.membershipId,
        startDate,
        endDate,
        visitsTotal,
        visitsUsed: initialUsed,
        isActive: true,
        tenantId: params.tenantId,
      },
      include: {
        client: true,
        membership: true,
      },
    });
  });

  await cancelPendingMonthlyPaymentsForClient(params.clientId, params.tenantId).catch((err) => {
    console.error('Failed to cancel pending monthly payments after membership issue:', err);
  });

  return created;
}

/**
 * Задать остаток посещений вручную (remaining = visitsTotal - visitsUsed).
 * Отрицательный remaining = долг; пакет остаётся активным.
 */
export async function setClientMembershipRemaining(params: {
  tenantId: string;
  clientMembershipId: string;
  remaining: number;
}) {
  const row = await prisma.clientMembership.findFirst({
    where: { id: params.clientMembershipId, tenantId: params.tenantId },
    include: { membership: true },
  });
  if (!row) {
    throw Object.assign(new Error('Client membership not found'), { statusCode: 404 });
  }
  if (row.visitsTotal == null) {
    throw Object.assign(new Error('У месячного абонемента нет лимита посещений'), {
      statusCode: 400,
    });
  }
  if (!Number.isFinite(params.remaining)) {
    throw Object.assign(new Error('Некорректный остаток'), { statusCode: 400 });
  }

  const remaining = Math.trunc(params.remaining);
  const visitsUsed = row.visitsTotal - remaining;
  const wasLive = row.visitsUsed < row.visitsTotal;
  const nowLive = remaining > 0;

  const updated = await prisma.clientMembership.update({
    where: { id: row.id },
    data: {
      visitsUsed,
      isActive: true,
    },
    include: { client: true, membership: true },
  });

  if (wasLive && !nowLive) {
    await removeClientFromMonthlyPaymentGroups(row.clientId, params.tenantId);
  }

  return {
    ...updated,
    remaining: visitsRemaining(updated.visitsTotal, updated.visitsUsed),
    summary: toMembershipSummary(updated),
  };
}

/**
 * Cron: клиенты без живого покрытия абонемента, но ещё в monthly-группах → слет.
 */
/** Деактивировать клиентские пакеты при вступлении в группу с GROUP-биллингом. */
export async function deactivateActiveClientPacks(clientId: string, tenantId: string): Promise<number> {
  const result = await prisma.clientMembership.updateMany({
    where: { clientId, tenantId, isActive: true },
    data: { isActive: false },
  });
  return result.count;
}

/**
 * Смена клиентского тарифа (Finance / ЛК): выдача нового пакета с переносом долга
 * и пересчёт суммы начисления (цена нового тарифа).
 */
export async function changeClientMembershipPack(params: {
  tenantId: string;
  clientId: string;
  membershipId: string;
  /** Не создавать повторное finance-начисление (если вызывающий сам обновит Payment) */
  skipFinanceRecord?: boolean;
}) {
  const previous = await findActiveClientMembership(params.clientId, params.tenantId);
  const previousDebt =
    previous && previous.visitsTotal != null
      ? visitDebt(previous.visitsTotal, previous.visitsUsed)
      : 0;

  const renewed = await issueClientMembership({
    tenantId: params.tenantId,
    clientId: params.clientId,
    membershipId: params.membershipId,
  });

  const newPrice = Number(renewed.membership?.price || 0);

  // Обновить незакрытый счёт на цену нового тарифа (учёт сверхлимитного занятия уже в visitsUsed)
  const pending = await prisma.payment.findFirst({
    where: {
      tenantId: params.tenantId,
      clientId: params.clientId,
      status: { in: ['pending', 'overdue'] },
      OR: [{ type: 'membership' }, { isMonthlyPayment: true }],
    },
    orderBy: { createdAt: 'desc' },
  });
  if (pending && newPrice >= 0) {
    await prisma.payment.update({
      where: { id: pending.id },
      data: {
        originalAmount: pending.originalAmount ?? pending.amount,
        amount: newPrice,
        notes: [
          pending.notes,
          `Смена тарифа → ${renewed.membership?.name || params.membershipId}`,
          previousDebt > 0 ? `перенесён долг посещений: ${previousDebt}` : null,
        ]
          .filter(Boolean)
          .join(' / '),
      },
    });
  }

  if (!params.skipFinanceRecord && newPrice > 0) {
    const clientName = `${renewed.client.lastName} ${renewed.client.firstName}`.trim();
    await FinanceService.recordMembershipIssue({
      tenantId: params.tenantId,
      clientId: params.clientId,
      amount: newPrice,
      title: `Смена абонемента: ${clientName} — ${renewed.membership?.name}`,
      clientMembershipId: renewed.id,
      membershipCatalogId: params.membershipId,
    }).catch((e) => console.error('change pack finance record failed', e));
  }

  return {
    membership: renewed,
    previousDebt,
    newPrice,
    updatedPaymentId: pending?.id || null,
  };
}

export async function cleanupExpiredMembershipMonthlyGroups(): Promise<number> {
  const activeRows = await prisma.clientMembership.findMany({
    where: { isActive: true },
    select: {
      id: true,
      clientId: true,
      tenantId: true,
      visitsTotal: true,
      visitsUsed: true,
      endDate: true,
    },
  });

  let removed = 0;
  const seen = new Set<string>();

  for (const row of activeRows) {
    if (hasLiveMembershipCoverage(row)) continue;
    const key = `${row.tenantId}:${row.clientId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    removed += await removeClientFromMonthlyPaymentGroups(row.clientId, row.tenantId);
  }

  return removed;
}
