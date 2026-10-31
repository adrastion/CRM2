import { prisma } from '../lib/prisma';
import { schoolLabelFromId } from '../utils/marketerMask';

const PERIOD_DAYS = 90;
const TARGET = 3;

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

function daysLeft(endsAt: Date, now = new Date()): number {
  const ms = endsAt.getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

export class MarketerActivityService {
  static async ensureOpenPeriod(marketerId: string) {
    await this.closeDuePeriodsForMarketer(marketerId);

    const open = await prisma.marketerActivityPeriod.findFirst({
      where: { marketerId, status: 'OPEN' },
      orderBy: { startsAt: 'desc' },
    });
    if (open) return open;

    const now = new Date();
    return prisma.marketerActivityPeriod.create({
      data: {
        marketerId,
        startsAt: now,
        endsAt: addDays(now, PERIOD_DAYS),
        targetCount: TARGET,
        qualifiedCount: 0,
        status: 'OPEN',
      },
    });
  }

  static async openNextPeriod(marketerId: string, from: Date = new Date()) {
    const existingOpen = await prisma.marketerActivityPeriod.findFirst({
      where: { marketerId, status: 'OPEN' },
    });
    if (existingOpen) return existingOpen;

    return prisma.marketerActivityPeriod.create({
      data: {
        marketerId,
        startsAt: from,
        endsAt: addDays(from, PERIOD_DAYS),
        targetCount: TARGET,
        qualifiedCount: 0,
        status: 'OPEN',
      },
    });
  }

  /**
   * Учитывает первую реальную оплату (amount > 0) школы в текущем OPEN-периоде.
   */
  static async recordFirstPaymentIfNeeded(params: {
    marketerId: string;
    tenantId: string;
    amount: number;
    paymentId?: string | null;
    paidAt?: Date;
  }) {
    if (!(params.amount > 0)) return null;

    const link = await prisma.tenantMarketer.findFirst({
      where: { marketerId: params.marketerId, tenantId: params.tenantId },
    });
    if (!link) return null;

    const paidAt = params.paidAt || new Date();

    if (!link.firstPaidAt) {
      await prisma.tenantMarketer.update({
        where: { id: link.id },
        data: { firstPaidAt: paidAt },
      });
    }

    const period = await this.ensureOpenPeriod(params.marketerId);
    if (period.status !== 'OPEN') return null;
    if (paidAt < period.startsAt || paidAt > period.endsAt) return null;

    // Уже квалифицировали эту школу в любом периоде — не дублируем
    const alreadyAny = await prisma.marketerActivityQualification.findFirst({
      where: { tenantId: params.tenantId, period: { marketerId: params.marketerId } },
    });
    if (alreadyAny) return null;

    try {
      await prisma.marketerActivityQualification.create({
        data: {
          periodId: period.id,
          tenantId: params.tenantId,
          paidAt,
          paymentId: params.paymentId || null,
        },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') return null;
      throw e;
    }

    const updated = await prisma.marketerActivityPeriod.update({
      where: { id: period.id },
      data: { qualifiedCount: { increment: 1 } },
    });

    if (updated.qualifiedCount >= updated.targetCount) {
      await prisma.marketerActivityPeriod.update({
        where: { id: period.id },
        data: { status: 'PASSED', closedAt: new Date() },
      });
      await this.openNextPeriod(params.marketerId, new Date());
    }

    return updated;
  }

  static async closeDuePeriodsForMarketer(marketerId: string) {
    const now = new Date();
    const due = await prisma.marketerActivityPeriod.findMany({
      where: { marketerId, status: 'OPEN', endsAt: { lt: now } },
    });
    for (const period of due) {
      await this.closePeriod(period.id);
    }
  }

  static async closeDuePeriods() {
    const now = new Date();
    const due = await prisma.marketerActivityPeriod.findMany({
      where: { status: 'OPEN', endsAt: { lt: now } },
      select: { id: true },
      take: 200,
    });
    for (const p of due) {
      await this.closePeriod(p.id);
    }
    return due.length;
  }

  static async closePeriod(periodId: string) {
    const period = await prisma.marketerActivityPeriod.findUnique({ where: { id: periodId } });
    if (!period || period.status !== 'OPEN') return null;

    const now = new Date();
    if (period.qualifiedCount >= period.targetCount) {
      await prisma.marketerActivityPeriod.update({
        where: { id: periodId },
        data: { status: 'PASSED', closedAt: now },
      });
      await this.openNextPeriod(period.marketerId, now);
      return { status: 'PASSED' as const };
    }

    // FAIL: исключить до 3 самых ранних клубов с активным правом
    const candidates = await prisma.tenantMarketer.findMany({
      where: {
        marketerId: period.marketerId,
        commissionRightActive: true,
        firstPaidAt: { not: null },
      },
      orderBy: [{ firstPaidAt: 'asc' }, { createdAt: 'asc' }, { tenantId: 'asc' }],
      take: 3,
    });

    await prisma.$transaction(async (tx) => {
      await tx.marketerActivityPeriod.update({
        where: { id: periodId },
        data: { status: 'FAILED', closedAt: now },
      });

      let rank = 1;
      for (const c of candidates) {
        await tx.marketerActivityExclusion.create({
          data: {
            periodId,
            tenantId: c.tenantId,
            rank,
            lostAt: now,
          },
        });
        await tx.tenantMarketer.update({
          where: { id: c.id },
          data: {
            commissionRightActive: false,
            commissionRightLostAt: now,
            commissionRightLostReason: 'ACTIVITY_PERIOD_FAIL',
          },
        });
        rank += 1;
      }
    });

    await this.openNextPeriod(period.marketerId, now);
    return { status: 'FAILED' as const, excluded: candidates.length };
  }

  /** Ранги 1..3 среди earliest paid с активным правом (пока период OPEN и цель не достигнута). */
  static async getRiskRanks(marketerId: string): Promise<Map<string, number>> {
    const period = await prisma.marketerActivityPeriod.findFirst({
      where: { marketerId, status: 'OPEN' },
      orderBy: { startsAt: 'desc' },
    });
    const map = new Map<string, number>();
    if (!period || period.qualifiedCount >= period.targetCount) return map;

    const candidates = await prisma.tenantMarketer.findMany({
      where: {
        marketerId,
        commissionRightActive: true,
        firstPaidAt: { not: null },
      },
      orderBy: [{ firstPaidAt: 'asc' }, { createdAt: 'asc' }, { tenantId: 'asc' }],
      take: 3,
    });
    candidates.forEach((c, i) => map.set(c.tenantId, i + 1));
    return map;
  }

  static async getCompactActivity(marketerId: string) {
    const period = await this.ensureOpenPeriod(marketerId);
    return {
      qualified: period.qualifiedCount,
      target: period.targetCount,
      endsAt: period.endsAt,
      startsAt: period.startsAt,
      daysLeft: daysLeft(period.endsAt),
      status: period.status,
    };
  }

  static async getActivity(marketerId: string) {
    const current = await this.ensureOpenPeriod(marketerId);
    const riskRanks = await this.getRiskRanks(marketerId);

    const [qualifications, links, history] = await Promise.all([
      prisma.marketerActivityQualification.findMany({
        where: { periodId: current.id },
        orderBy: { paidAt: 'asc' },
      }),
      prisma.tenantMarketer.findMany({
        where: { marketerId },
        include: { tenant: { select: { id: true, name: true, subdomain: true } } },
        orderBy: [{ firstPaidAt: 'asc' }, { createdAt: 'asc' }],
      }),
      prisma.marketerActivityPeriod.findMany({
        where: { marketerId },
        orderBy: { startsAt: 'desc' },
        take: 12,
        include: {
          exclusions: true,
          qualifications: { select: { tenantId: true } },
        },
      }),
    ]);

    const qualifiedTenantIds = new Set(qualifications.map((q) => q.tenantId));

    const schools = links.map((l) => {
      const riskRank = riskRanks.get(l.tenantId) || null;
      let state: 'at_risk' | 'counts' | 'lost' | 'linked' = 'linked';
      if (!l.commissionRightActive) state = 'lost';
      else if (qualifiedTenantIds.has(l.tenantId)) state = 'counts';
      else if (riskRank) state = 'at_risk';

      return {
        tenantId: l.tenantId,
        label: l.tenant?.name || schoolLabelFromId(l.tenantId),
        linkedAt: l.createdAt,
        firstPaidAt: l.firstPaidAt,
        commissionRightActive: l.commissionRightActive,
        commissionRightLostAt: l.commissionRightLostAt,
        commissionRightLostReason: l.commissionRightLostReason,
        riskRank,
        countsTowardPeriod: qualifiedTenantIds.has(l.tenantId),
        state,
      };
    });

    return {
      current: {
        id: current.id,
        startsAt: current.startsAt,
        endsAt: current.endsAt,
        targetCount: current.targetCount,
        qualifiedCount: current.qualifiedCount,
        status: current.status,
        daysLeft: daysLeft(current.endsAt),
      },
      metrics: {
        paidThisPeriod: current.qualifiedCount,
        target: current.targetCount,
        keepingRights: links.filter((l) => l.commissionRightActive).length,
        atRisk: [...riskRanks.keys()].length,
      },
      schools,
      history: history.map((h) => ({
        id: h.id,
        startsAt: h.startsAt,
        endsAt: h.endsAt,
        status: h.status,
        qualifiedCount: h.qualifiedCount,
        targetCount: h.targetCount,
        closedAt: h.closedAt,
        excludedCount: h.exclusions.length,
        qualificationCount: h.qualifications.length,
      })),
    };
  }
}
