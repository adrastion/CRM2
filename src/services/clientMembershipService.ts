import { prisma } from '../lib/prisma';
import { FinanceService } from './financeService';

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

  return {
    coveredByMembership: true,
    membershipId: active.id,
    enteredDebt: enteredDebt || alreadyInDebt,
    debt: visitDebt(active.visitsTotal, visitsUsed),
  };
}

/**
 * Выдать абонемент клиенту: долг по старым visit-pack переносится в visitsUsed нового.
 * Pending monthly платежи отменяются (схема взаимоисключающая).
 */
export async function issueClientMembership(params: {
  tenantId: string;
  clientId: string;
  membershipId: string;
}) {
  const membership = await prisma.membership.findFirst({
    where: { id: params.membershipId, tenantId: params.tenantId },
  });
  if (!membership) {
    throw Object.assign(new Error('Membership not found'), { statusCode: 404 });
  }

  let endDate: Date | null = null;
  if (membership.type === 'monthly' && membership.duration) {
    endDate = new Date();
    endDate.setDate(endDate.getDate() + membership.duration);
  }

  const visitsTotal = membership.visits ?? null;

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

    const initialUsed = visitsTotal != null ? debt : 0;

    return tx.clientMembership.create({
      data: {
        clientId: params.clientId,
        membershipId: params.membershipId,
        startDate: new Date(),
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
