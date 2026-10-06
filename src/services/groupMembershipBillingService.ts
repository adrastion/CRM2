import { prisma } from '../lib/prisma';
import {
  periodKeyBounds,
  SCHOOL_BILLING_TIMEZONE,
  zonedLocalToUtc,
  monthlyPeriodKey,
} from '../utils/monthlyPaymentPeriod';

export type GroupBillingPlan = {
  membershipId: string;
  membershipName: string;
  price: number;
  paymentWindowStartDay: number;
  paymentWindowEndDay: number;
  recalcMode: 'PAY_ATTENDED' | 'MISS_THRESHOLD';
  missThresholdPercent: number;
  effectiveFrom: Date;
  groupId: string;
  tenantId: string;
};

/** Групповой абонемент, привязанный к группе (если есть). */
export async function getGroupBillingPlan(groupId: string): Promise<GroupBillingPlan | null> {
  const link = await prisma.membershipGroup.findUnique({
    where: { groupId },
    include: {
      membership: true,
      group: {
        select: {
          tenantId: true,
          isMonthlyPayment: true,
          monthlyPaymentAmount: true,
          paymentDueDay: true,
        },
      },
    },
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
}): Promise<{ scheduled: number; present: number }> {
  const { start, end } = periodKeyBounds(params.periodKey);

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
    return { scheduled: 0, present: 0 };
  }

  const attendance = await prisma.attendance.findMany({
    where: {
      clientId: params.clientId,
      trainingId: { in: trainings.map((t) => t.id) },
      status: 'PRESENT',
    },
  });

  return { scheduled, present: attendance.length };
}

/** Начало календарного дня joinDate в TZ школы (UTC Date). */
function startOfJoinDayUtc(joinDate: Date): Date {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: SCHOOL_BILLING_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = fmt.formatToParts(joinDate);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value || 0);
  return zonedLocalToUtc(get('year'), get('month'), get('day'), 0, 0, 0, 0);
}

/**
 * Пропорция при вступлении в середине месяца начисления:
 * price / N * R, где N — все занятия месяца, R — с даты назначения.
 */
async function computeJoinProration(params: {
  groupId: string;
  billPeriodKey: string;
  joinDate: Date;
  price: number;
}): Promise<{ baseAmount: number; reason: string | null }> {
  const { start, end } = periodKeyBounds(params.billPeriodKey);
  const joinStart = startOfJoinDayUtc(params.joinDate);

  // Назначен до начала месяца начисления — полная цена
  if (joinStart.getTime() <= start.getTime()) {
    return { baseAmount: params.price, reason: null };
  }

  // Назначен после конца месяца — нечего начислять
  if (joinStart.getTime() > end.getTime()) {
    return { baseAmount: 0, reason: 'Дата назначения после периода начисления' };
  }

  const trainings = await prisma.training.findMany({
    where: {
      groupId: params.groupId,
      startTime: { gte: start, lte: end },
      isCancelled: false,
    },
    select: { startTime: true },
    orderBy: { startTime: 'asc' },
  });

  const n = trainings.length;
  if (n === 0) {
    return { baseAmount: 0, reason: 'Нет занятий в периоде' };
  }

  const r = trainings.filter((t) => t.startTime.getTime() >= joinStart.getTime()).length;
  const baseAmount = Math.round(((params.price / n) * r) * 100) / 100;
  const dayFmt = new Intl.DateTimeFormat('ru-RU', {
    timeZone: SCHOOL_BILLING_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
  });
  return {
    baseAmount,
    reason: `Вступление с ${dayFmt.format(params.joinDate)}: ${r} из ${n} занятий`,
  };
}

/**
 * Рассчитать сумму группового начисления на periodKey.
 * 1) База: полная цена или пропорция при вступлении внутри месяца.
 * 2) Перерасчёт по посещаемости прошлого месяца (PAY_ATTENDED / MISS_THRESHOLD).
 */
export async function computeGroupMonthlyCharge(params: {
  plan: GroupBillingPlan;
  clientId: string;
  /** Период, за который выставляем счёт (YYYY-MM) */
  billPeriodKey: string;
}): Promise<{
  amount: number;
  originalAmount: number;
  recalcAppliedPercent: number;
  recalcReason: string | null;
}> {
  const { plan, clientId, billPeriodKey } = params;
  const originalAmount = plan.price;

  const membership = await prisma.groupMembership.findUnique({
    where: {
      clientId_groupId: { clientId, groupId: plan.groupId },
    },
    select: { billingEffectiveFrom: true, joinedAt: true },
  });
  const joinDate = membership?.billingEffectiveFrom || membership?.joinedAt || null;

  let baseAmount = originalAmount;
  let joinReason: string | null = null;
  if (joinDate) {
    const proration = await computeJoinProration({
      groupId: plan.groupId,
      billPeriodKey,
      joinDate,
      price: originalAmount,
    });
    baseAmount = proration.baseAmount;
    joinReason = proration.reason;
  }

  // Предыдущий месяц для перерасчёта посещаемости
  const [y, m] = billPeriodKey.split('-').map(Number);
  const prev = m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 };
  const statsPeriodKey = `${prev.y}-${String(prev.m).padStart(2, '0')}`;

  const stats = await getPeriodAttendanceStats({
    groupId: plan.groupId,
    clientId,
    periodKey: statsPeriodKey,
  });

  let percent = 100;
  let attendanceReason: string | null = null;

  if (stats.scheduled > 0) {
    const missRate = ((stats.scheduled - stats.present) / stats.scheduled) * 100;
    const attendRate = stats.present / stats.scheduled;

    if (plan.recalcMode === 'PAY_ATTENDED') {
      percent = Math.round(attendRate * 10000) / 100;
      attendanceReason = `Только посещённые: ${stats.present}/${stats.scheduled}`;
    } else if (plan.recalcMode === 'MISS_THRESHOLD' && missRate >= plan.missThresholdPercent) {
      percent = Math.round(attendRate * 10000) / 100;
      attendanceReason = `Пропуск ${missRate.toFixed(0)}% ≥ ${plan.missThresholdPercent}%: перерасчёт на посещённые`;
    }
  }

  const amount = Math.round(((baseAmount * percent) / 100) * 100) / 100;
  const recalcReason = [joinReason, attendanceReason].filter(Boolean).join('; ') || null;

  // percent относительно list price для отображения
  const displayPercent =
    originalAmount > 0 ? Math.round((amount / originalAmount) * 10000) / 100 : percent;

  return {
    amount,
    originalAmount,
    recalcAppliedPercent: displayPercent,
    recalcReason,
  };
}

export function isDayInPaymentWindow(day: number, start: number, end: number): boolean {
  if (start <= end) return day >= start && day <= end;
  return day >= start || day <= end;
}

export function unpaidNotifyDay(endDay: number): number {
  const d = endDay + 1;
  return d > 31 ? 1 : d;
}

/** Экспорт для тестов / отладки. */
export { monthlyPeriodKey };
