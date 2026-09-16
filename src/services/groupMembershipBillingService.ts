import { prisma } from '../lib/prisma';

export type GroupBillingPlan = {
  membershipId: string;
  membershipName: string;
  price: number;
  paymentWindowStartDay: number;
  paymentWindowEndDay: number;
  recalcMode: 'PAY_ATTENDED' | 'MISS_THRESHOLD';
  missThresholdPercent: number;
  midMonthHalfChargeEnabled: boolean;
  effectiveFrom: Date;
  groupId: string;
  tenantId: string;
};

/** Групповой абонемент, привязанный к группе (если есть). */
export async function getGroupBillingPlan(groupId: string): Promise<GroupBillingPlan | null> {
  const link = await prisma.membershipGroup.findUnique({
    where: { groupId },
    include: { membership: true, group: { select: { tenantId: true, isMonthlyPayment: true, monthlyPaymentAmount: true, paymentDueDay: true } } },
  });

  if (link?.membership?.category === 'GROUP' && link.membership.isActive) {
    const m = link.membership;
    return {
      membershipId: m.id,
      membershipName: m.name,
      price: Number(m.price),
      paymentWindowStartDay: m.paymentWindowStartDay ?? 1,
      paymentWindowEndDay: m.paymentWindowEndDay ?? 6,
      recalcMode: (m.recalcMode as GroupBillingPlan['recalcMode']) || 'MISS_THRESHOLD',
      missThresholdPercent: m.missThresholdPercent != null ? Number(m.missThresholdPercent) : 50,
      midMonthHalfChargeEnabled: m.midMonthHalfChargeEnabled !== false,
      effectiveFrom: link.effectiveFrom,
      groupId,
      tenantId: link.group.tenantId,
    };
  }

  // Legacy fallback
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (group?.isMonthlyPayment && group.monthlyPaymentAmount != null) {
    return {
      membershipId: '',
      membershipName: group.name,
      price: Number(group.monthlyPaymentAmount),
      paymentWindowStartDay: 1,
      paymentWindowEndDay: group.paymentDueDay ?? 6,
      recalcMode: 'MISS_THRESHOLD',
      missThresholdPercent: 50,
      midMonthHalfChargeEnabled: true,
      effectiveFrom: group.createdAt,
      groupId,
      tenantId: group.tenantId,
    };
  }
  return null;
}

/** Клиент состоит в группе с групповым абонементом. */
export async function clientHasGroupBilling(clientId: string, tenantId: string): Promise<boolean> {
  const rows = await prisma.groupMembership.findMany({
    where: { clientId, isActive: true, isTrial: false, group: { tenantId } },
    select: { groupId: true },
  });
  for (const row of rows) {
    const plan = await getGroupBillingPlan(row.groupId);
    if (plan) return true;
  }
  return false;
}

/** Запланированные и посещённые занятия клиента в группе за periodKey YYYY-MM. */
export async function getPeriodAttendanceStats(params: {
  groupId: string;
  clientId: string;
  periodKey: string;
}): Promise<{ scheduled: number; present: number; firstPresentDay: number | null }> {
  const [y, m] = params.periodKey.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, 0, 23, 59, 59));

  const trainings = await prisma.training.findMany({
    where: {
      groupId: params.groupId,
      startTime: { gte: start, lte: end },
      isCancelled: false,
    },
    select: { id: true, startTime: true },
  });
  const scheduled = trainings.length;
  if (scheduled === 0) {
    return { scheduled: 0, present: 0, firstPresentDay: null };
  }

  const attendance = await prisma.attendance.findMany({
    where: {
      clientId: params.clientId,
      trainingId: { in: trainings.map((t) => t.id) },
      status: 'PRESENT',
    },
    include: { training: { select: { startTime: true } } },
    orderBy: { training: { startTime: 'asc' } },
  });

  const present = attendance.length;
  const firstPresentDay =
    attendance.length > 0 ? new Date(attendance[0].training.startTime).getUTCDate() : null;

  return { scheduled, present, firstPresentDay };
}

/**
 * Рассчитать сумму группового начисления на periodKey с учётом прошлого периода (перерасчёт).
 * Перерасчёт применяется к СЛЕДУЮЩЕМУ месяцу относительно statsPeriodKey (предыдущий месяц).
 */
export async function computeGroupMonthlyCharge(params: {
  plan: GroupBillingPlan;
  clientId: string;
  /** Период, за который выставляем счёт (YYYY-MM) */
  billPeriodKey: string;
}): Promise<{ amount: number; originalAmount: number; recalcAppliedPercent: number; recalcReason: string | null }> {
  const { plan, clientId, billPeriodKey } = params;
  const originalAmount = plan.price;

  // Предыдущий месяц для перерасчёта
  const [y, m] = billPeriodKey.split('-').map(Number);
  const prev = m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 };
  const statsPeriodKey = `${prev.y}-${String(prev.m).padStart(2, '0')}`;

  const stats = await getPeriodAttendanceStats({
    groupId: plan.groupId,
    clientId,
    periodKey: statsPeriodKey,
  });

  let percent = 100;
  let reason: string | null = null;

  if (stats.scheduled > 0) {
    const missRate = ((stats.scheduled - stats.present) / stats.scheduled) * 100;
    const attendRate = stats.present / stats.scheduled;

    if (plan.recalcMode === 'PAY_ATTENDED') {
      percent = Math.round(attendRate * 10000) / 100;
      reason = `Только посещённые: ${stats.present}/${stats.scheduled}`;
    } else if (plan.recalcMode === 'MISS_THRESHOLD' && missRate >= plan.missThresholdPercent) {
      percent = Math.round(attendRate * 10000) / 100;
      reason = `Пропуск ${missRate.toFixed(0)}% ≥ ${plan.missThresholdPercent}%: перерасчёт на посещённые`;
    }

    // Mid-month: первая отметка после середины месяца и пропуск >50% → 50% на следующий счёт
    if (plan.midMonthHalfChargeEnabled && stats.firstPresentDay != null) {
      const daysInPrev = new Date(prev.y, prev.m, 0).getDate();
      const mid = Math.ceil(daysInPrev / 2);
      if (stats.firstPresentDay > mid && missRate > 50) {
        percent = Math.min(percent, 50);
        reason = [
          reason,
          `Первое посещение после середины месяца (день ${stats.firstPresentDay}): 50%`,
        ]
          .filter(Boolean)
          .join('; ');
      }
    }
  }

  const amount = Math.round(((originalAmount * percent) / 100) * 100) / 100;
  return {
    amount,
    originalAmount,
    recalcAppliedPercent: percent,
    recalcReason: reason,
  };
}

export function isDayInPaymentWindow(day: number, start: number, end: number): boolean {
  if (start <= end) return day >= start && day <= end;
  // окно через конец месяца (редко): 28–3
  return day >= start || day <= end;
}

export function unpaidNotifyDay(endDay: number): number {
  const d = endDay + 1;
  return d > 31 ? 1 : d;
}
