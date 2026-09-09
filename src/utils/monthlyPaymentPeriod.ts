import { prisma } from '../lib/prisma';

/** Ключ периода ежемесячного платежа: YYYY-MM (локальная дата / Europe/Moscow-friendly). */
export function monthlyPeriodKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function isMonthlyPaymentPayload(data: {
  isMonthlyPayment?: boolean;
  type?: string;
}): boolean {
  return Boolean(
    data.isMonthlyPayment ||
      data.type === 'monthly_payment' ||
      data.type === 'monthly'
  );
}

/** Prisma/Postgres unique violation */
export function isUniqueConstraintError(error: unknown): boolean {
  const e = error as { code?: string; meta?: { target?: string[] } };
  return e?.code === 'P2002';
}

/** Сравнить YYYY-MM: -1 / 0 / 1 */
export function comparePeriodKeys(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/**
 * Месяц первого занятия группы (YYYY-MM) по минимальному Training.startTime.
 * null — тренировок нет.
 */
export async function getGroupFirstTrainingMonth(groupId: string): Promise<string | null> {
  const first = await prisma.training.findFirst({
    where: { groupId },
    orderBy: { startTime: 'asc' },
    select: { startTime: true },
  });
  if (!first?.startTime) return null;
  return monthlyPeriodKey(new Date(first.startTime));
}

/**
 * Целевой periodKey для начисления: месяц «сегодня»/due, но не раньше месяца первого занятия.
 * null — создавать нельзя (нет тренировок или целевой месяц раньше старта).
 */
export function resolveMonthlyPeriodKey(params: {
  candidateDate: Date;
  firstTrainingMonth: string | null;
}): string | null {
  if (!params.firstTrainingMonth) return null;
  const candidate = monthlyPeriodKey(params.candidateDate);
  if (comparePeriodKeys(candidate, params.firstTrainingMonth) < 0) {
    return null;
  }
  return candidate;
}

/**
 * dueDate = paymentDueDay в месяце periodKey (YYYY-MM), конец дня.
 */
export function dueDateForPeriodKey(periodKey: string, paymentDueDay: number): Date {
  const [yStr, mStr] = periodKey.split('-');
  const y = Number(yStr);
  const m = Number(mStr) - 1;
  const day = Math.min(Math.max(1, paymentDueDay || 1), 28);
  const d = new Date(y, m, day, 23, 59, 59, 999);
  return d;
}

/** Есть ли незакрытый ежемесячный счёт по клиенту+группе. */
export async function hasOpenMonthlyPayment(params: {
  tenantId: string;
  clientId: string;
  groupId: string;
}): Promise<boolean> {
  const existing = await prisma.payment.findFirst({
    where: {
      tenantId: params.tenantId,
      clientId: params.clientId,
      groupId: params.groupId,
      isMonthlyPayment: true,
      status: { in: ['pending', 'overdue'] },
    },
    select: { id: true },
  });
  return Boolean(existing);
}
