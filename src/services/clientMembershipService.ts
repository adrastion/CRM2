import { prisma } from '../lib/prisma';

export type ActiveMembershipSummary = {
  id: string;
  membershipId: string;
  name: string;
  type: string;
  visitsUsed: number;
  visitsTotal: number | null;
  /** visitsTotal - visitsUsed; для visit-pack может быть < 0 */
  remaining: number | null;
  endDate: Date | null;
  isActive: boolean;
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

/** Активный visit-pack или месячный (для отображения / списания). */
export async function findActiveClientMembership(clientId: string, tenantId: string) {
  const rows = await prisma.clientMembership.findMany({
    where: {
      clientId,
      tenantId,
      isActive: true,
      OR: [
        { visitsTotal: { not: null } },
        { visitsTotal: null, endDate: { gte: new Date() } },
        { visitsTotal: null, endDate: null },
      ],
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

/**
 * Списать одно посещение с активного visit-pack.
 * visitsUsed может превысить visitsTotal (минус); пак остаётся активным.
 * @returns true если списали с абонемента (клиенту не нужно списывать баланс за визит)
 */
export async function consumeVisitFromActivePack(
  clientId: string,
  tenantId: string
): Promise<{ coveredByMembership: boolean; membershipId?: string }> {
  const active = await findActiveClientMembership(clientId, tenantId);
  if (!active) return { coveredByMembership: false };

  // Месячный без лимита посещений — покрывает визит без инкремента visits
  if (active.visitsTotal == null) {
    if (active.endDate && new Date() > new Date(active.endDate)) {
      await prisma.clientMembership.update({
        where: { id: active.id },
        data: { isActive: false },
      });
      return { coveredByMembership: false };
    }
    return { coveredByMembership: true, membershipId: active.id };
  }

  await prisma.clientMembership.update({
    where: { id: active.id },
    data: {
      visitsUsed: active.visitsUsed + 1,
      isActive: true,
    },
  });

  return { coveredByMembership: true, membershipId: active.id };
}

/**
 * Выдать абонемент клиенту: долг по старым visit-pack переносится в visitsUsed нового.
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

  return prisma.$transaction(async (tx) => {
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

    // Закрываем ВСЕ активные абонементы клиента (visit + monthly), иначе ЛК может
    // продолжать показывать старый пакет.
    await tx.clientMembership.updateMany({
      where: {
        clientId: params.clientId,
        tenantId: params.tenantId,
        isActive: true,
      },
      data: { isActive: false },
    });

    const initialUsed = visitsTotal != null ? debt : 0;

    const created = await tx.clientMembership.create({
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

    return created;
  });
}

/**
 * Задать остаток посещений вручную (remaining = visitsTotal - visitsUsed).
 * remaining может быть отрицательным.
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

  const visitsUsed = row.visitsTotal - Math.trunc(params.remaining);
  const updated = await prisma.clientMembership.update({
    where: { id: row.id },
    data: {
      visitsUsed,
      isActive: true,
    },
    include: { client: true, membership: true },
  });

  return {
    ...updated,
    remaining: visitsRemaining(updated.visitsTotal, updated.visitsUsed),
    summary: toMembershipSummary(updated),
  };
}
