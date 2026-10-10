import { prisma } from '../lib/prisma';

/** Рабочий TZ школы для periodKey / границ месяца. */
export const SCHOOL_BILLING_TIMEZONE = 'Europe/Moscow';

function zonedParts(
  date: Date,
  timeZone: string
): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = fmt.formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value || 0);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

/**
 * UTC-момент, соответствующий локальным y-m-d hh:mm:ss.ms в timeZone.
 */
export function zonedLocalToUtc(
  y: number,
  m: number,
  d: number,
  hh: number,
  mm: number,
  ss: number,
  ms: number,
  timeZone: string = SCHOOL_BILLING_TIMEZONE
): Date {
  let guess = new Date(Date.UTC(y, m - 1, d, hh, mm, ss, ms));
  for (let i = 0; i < 4; i++) {
    const p = zonedParts(guess, timeZone);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second, 0);
    const desired = Date.UTC(y, m - 1, d, hh, mm, ss, 0);
    guess = new Date(guess.getTime() + (desired - asUtc));
  }
  if (ms) guess = new Date(guess.getTime() + ms);
  return guess;
}

/** Ключ периода ежемесячного платежа: YYYY-MM в Europe/Moscow. */
export function monthlyPeriodKey(
  date: Date = new Date(),
  timeZone: string = SCHOOL_BILLING_TIMEZONE
): string {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, '0')}`;
}

/** Границы календарного месяца periodKey в TZ (включительно). */
export function periodKeyBounds(
  periodKey: string,
  timeZone: string = SCHOOL_BILLING_TIMEZONE
): { start: Date; end: Date } {
  const [yStr, mStr] = periodKey.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const start = zonedLocalToUtc(y, m, 1, 0, 0, 0, 0, timeZone);
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  const end = new Date(zonedLocalToUtc(nextY, nextM, 1, 0, 0, 0, 0, timeZone).getTime() - 1);
  return { start, end };
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

/** Месяцы от fromKey до toKey включительно. */
export function iteratePeriodKeys(fromKey: string, toKey: string): string[] {
  if (!/^\d{4}-\d{2}$/.test(fromKey) || !/^\d{4}-\d{2}$/.test(toKey)) return [];
  if (comparePeriodKeys(fromKey, toKey) > 0) return [];
  const keys: string[] = [];
  let y = Number(fromKey.slice(0, 4));
  let m = Number(fromKey.slice(5, 7));
  const endY = Number(toKey.slice(0, 4));
  const endM = Number(toKey.slice(5, 7));
  while (y < endY || (y === endY && m <= endM)) {
    keys.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return keys;
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
 * dueDate = paymentDueDay в месяце periodKey (YYYY-MM), конец дня (MSK).
 */
export function dueDateForPeriodKey(periodKey: string, paymentDueDay: number): Date {
  const [yStr, mStr] = periodKey.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const day = Math.min(Math.max(1, paymentDueDay || 1), 28);
  return zonedLocalToUtc(y, m, day, 23, 59, 59, 999);
}

/** Есть ли незакрытый ежемесячный счёт по клиенту+группе (опционально за тот же periodKey). */
export async function hasOpenMonthlyPayment(params: {
  tenantId: string;
  clientId: string;
  groupId: string;
  periodKey?: string | null;
}): Promise<boolean> {
  const existing = await prisma.payment.findFirst({
    where: {
      tenantId: params.tenantId,
      clientId: params.clientId,
      groupId: params.groupId,
      isMonthlyPayment: true,
      status: { in: ['pending', 'overdue'] },
      ...(params.periodKey ? { periodKey: params.periodKey } : {}),
    },
    select: { id: true },
  });
  return Boolean(existing);
}
