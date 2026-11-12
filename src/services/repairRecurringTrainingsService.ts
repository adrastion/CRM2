import { prisma } from '../lib/prisma';

const TZ = process.env.TZ || 'Europe/Moscow';

type SeriesKey = string;

type ExistingTraining = {
  id: string;
  title: string;
  description: string | null;
  startTime: Date;
  endTime: Date;
  isRecurring: boolean;
  recurrence: string | null;
  tenantId: string;
  branchId: string;
  groupId: string | null;
  trainerId: string;
  hallId: string | null;
  substituteTrainerId: string | null;
  originalTrainerId: string | null;
};

export type RepairRecurringResult = {
  tenantsProcessed: number;
  seriesProcessed: number;
  createdCount: number;
  skippedSeries: number;
};

/** День недели 0–6 в таймзоне школы (как JS getDay). */
export function weekdayInTz(date: Date, timeZone = TZ): number {
  const wd = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(date);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[wd] ?? date.getDay();
}

/** YYYY-MM-DD в таймзоне школы. */
export function dateKeyInTz(date: Date, timeZone = TZ): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Парсит `weekly` / `weekly:1,3,5` → дни или null. */
export function parseRecurrenceDays(recurrence: string | null | undefined): number[] | null {
  if (!recurrence) return null;
  const m = String(recurrence).match(/^weekly(?::([\d,]+))?$/i);
  if (!m) return null;
  if (!m[1]) return null;
  const days = m[1]
    .split(',')
    .map((x) => Number(x.trim()))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  return days.length ? Array.from(new Set(days)).sort((a, b) => a - b) : null;
}

/** Кодирует дни в recurrence: `weekly:1,3,5`. */
export function encodeWeeklyRecurrence(daysOfWeek?: unknown): string {
  if (!Array.isArray(daysOfWeek) || daysOfWeek.length === 0) return 'weekly';
  const days = Array.from(
    new Set(
      daysOfWeek
        .map((d) => Number(d))
        .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
    )
  ).sort((a, b) => a - b);
  return days.length ? `weekly:${days.join(',')}` : 'weekly';
}

function parseGroupScheduleDays(schedule: string | null | undefined): Map<
  number,
  { startHm: string; endHm: string }
> {
  const out = new Map<number, { startHm: string; endHm: string }>();
  if (!schedule) return out;
  try {
    const raw = typeof schedule === 'string' ? JSON.parse(schedule) : schedule;
    if (!Array.isArray(raw)) return out;
    for (const item of raw) {
      const day = Number(item?.dayOfWeek);
      if (!Number.isInteger(day) || day < 0 || day > 6) continue;
      const startHm = String(item.startTime || '18:00');
      const endHm = String(item.endTime || '19:30');
      if (!out.has(day)) out.set(day, { startHm, endHm });
    }
  } catch {
    /* ignore */
  }
  return out;
}

function hmParts(hm: string): { h: number; m: number } {
  const [h, m] = hm.split(':').map(Number);
  return { h: Number.isFinite(h) ? h : 18, m: Number.isFinite(m) ? m : 0 };
}

/** Локальная дата YYYY-MM-DD + часы/минуты → Date в TZ школы (через Intl offset). */
function zonedDateTime(dateKey: string, hours: number, minutes: number, timeZone = TZ): Date {
  // Ищем UTC-момент, у которого в TZ получается нужная локальная дата/время
  const [y, mo, d] = dateKey.split('-').map(Number);
  const utcGuess = new Date(Date.UTC(y, mo - 1, d, hours, minutes, 0, 0));
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(utcGuess).map((p) => [p.type, p.value])
  ) as Record<string, string>;
  const asLocal = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    0,
    0
  );
  const offset = asLocal - utcGuess.getTime();
  return new Date(utcGuess.getTime() - offset);
}

function seriesKeyOf(t: ExistingTraining): SeriesKey {
  return `${t.title}|${t.groupId || ''}|${t.trainerId}|${t.branchId}`;
}

function addDaysKey(dateKey: string, delta: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function weekdayOfDateKey(dateKey: string, timeZone = TZ): number {
  // Полдень UTC≈локально для определения дня недели без DST-краёв
  const [y, m, d] = dateKey.split('-').map(Number);
  const noon = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return weekdayInTz(noon, timeZone);
}

/**
 * Дозаполняет пропущенные дни регулярных серий:
 * - дни из recurrence `weekly:1,3,5`
 * - дни из group.schedule
 * - объединение дней, которые уже встречались в серии (дыры по неделям)
 */
export async function repairIncompleteRecurringSeries(options?: {
  tenantId?: string;
}): Promise<RepairRecurringResult> {
  const result: RepairRecurringResult = {
    tenantsProcessed: 0,
    seriesProcessed: 0,
    createdCount: 0,
    skippedSeries: 0,
  };

  const tenants = options?.tenantId
    ? [{ id: options.tenantId }]
    : await prisma.tenant.findMany({ select: { id: true } });

  for (const tenant of tenants) {
    result.tenantsProcessed += 1;

    const groups = await prisma.group.findMany({
      where: { tenantId: tenant.id, isActive: true },
      select: { id: true, schedule: true },
    });
    const scheduleByGroup = new Map(
      groups.map((g) => [g.id, parseGroupScheduleDays(g.schedule)])
    );

    const trainings = (await prisma.training.findMany({
      where: {
        tenantId: tenant.id,
        isCancelled: false,
        isRecurring: true,
        groupId: { not: null },
      },
      orderBy: { startTime: 'asc' },
    })) as ExistingTraining[];

    const bySeries = new Map<SeriesKey, ExistingTraining[]>();
    for (const t of trainings) {
      const key = seriesKeyOf(t);
      if (!bySeries.has(key)) bySeries.set(key, []);
      bySeries.get(key)!.push(t);
    }

    for (const [, series] of bySeries) {
      if (series.length === 0) continue;
      result.seriesProcessed += 1;

      const template = series[0];
      const groupId = template.groupId!;
      const scheduleDays = scheduleByGroup.get(groupId) || new Map();

      const fromRecurrence = parseRecurrenceDays(template.recurrence);
      const observedDays = new Set(series.map((t) => weekdayInTz(t.startTime)));
      const intended = new Set<number>();
      if (fromRecurrence) fromRecurrence.forEach((d) => intended.add(d));
      for (const d of scheduleDays.keys()) intended.add(d);
      for (const d of observedDays) intended.add(d);

      if (intended.size <= 1) {
        // Одна пятница без графика/метаданных — нельзя угадать пн/ср
        result.skippedSeries += 1;
        continue;
      }

      // Время по дням: из существующих / из schedule / fallback с первого занятия
      const timeByDay = new Map<number, { startH: number; startM: number; endH: number; endM: number }>();
      for (const t of series) {
        const day = weekdayInTz(t.startTime);
        if (timeByDay.has(day)) continue;
        timeByDay.set(day, {
          startH: Number(
            new Intl.DateTimeFormat('en-US', {
              timeZone: TZ,
              hour: '2-digit',
              minute: '2-digit',
              hourCycle: 'h23',
            })
              .formatToParts(t.startTime)
              .find((p) => p.type === 'hour')?.value || '18'
          ),
          startM: Number(
            new Intl.DateTimeFormat('en-US', {
              timeZone: TZ,
              hour: '2-digit',
              minute: '2-digit',
              hourCycle: 'h23',
            })
              .formatToParts(t.startTime)
              .find((p) => p.type === 'minute')?.value || '0'
          ),
          endH: Number(
            new Intl.DateTimeFormat('en-US', {
              timeZone: TZ,
              hour: '2-digit',
              minute: '2-digit',
              hourCycle: 'h23',
            })
              .formatToParts(t.endTime)
              .find((p) => p.type === 'hour')?.value || '19'
          ),
          endM: Number(
            new Intl.DateTimeFormat('en-US', {
              timeZone: TZ,
              hour: '2-digit',
              minute: '2-digit',
              hourCycle: 'h23',
            })
              .formatToParts(t.endTime)
              .find((p) => p.type === 'minute')?.value || '30'
          ),
        });
      }

      const fallback = timeByDay.values().next().value || {
        startH: 18,
        startM: 0,
        endH: 19,
        endM: 30,
      };

      for (const [day, hm] of scheduleDays.entries()) {
        if (timeByDay.has(day)) continue;
        const s = hmParts(hm.startHm);
        const e = hmParts(hm.endHm);
        timeByDay.set(day, { startH: s.h, startM: s.m, endH: e.h, endM: e.m });
      }

      for (const day of intended) {
        if (!timeByDay.has(day)) timeByDay.set(day, { ...fallback });
      }

      const occupied = new Set(series.map((t) => dateKeyInTz(t.startTime)));
      const startKey = dateKeyInTz(series[0].startTime);
      const endKey = dateKeyInTz(series[series.length - 1].startTime);

      const encoded = encodeWeeklyRecurrence(Array.from(intended));
      const toCreate: Array<{
        title: string;
        description: string | null;
        trainerId: string;
        branchId: string;
        hallId: string | null;
        groupId: string;
        isRecurring: boolean;
        recurrence: string;
        tenantId: string;
        startTime: Date;
        endTime: Date;
        substituteTrainerId: string | null;
        originalTrainerId: string | null;
      }> = [];

      let cursor = startKey;
      while (cursor <= endKey) {
        const day = weekdayOfDateKey(cursor);
        if (intended.has(day) && !occupied.has(cursor)) {
          const tm = timeByDay.get(day) || fallback;
          const startTime = zonedDateTime(cursor, tm.startH, tm.startM);
          const endTime = zonedDateTime(cursor, tm.endH, tm.endM);
          if (endTime.getTime() > startTime.getTime()) {
            toCreate.push({
              title: template.title,
              description: template.description,
              trainerId: template.trainerId,
              branchId: template.branchId,
              hallId: template.hallId,
              groupId,
              isRecurring: true,
              recurrence: encoded,
              tenantId: template.tenantId,
              startTime,
              endTime,
              substituteTrainerId: template.substituteTrainerId,
              originalTrainerId: template.originalTrainerId,
            });
          }
        }
        cursor = addDaysKey(cursor, 1);
      }

      if (toCreate.length === 0) {
        result.skippedSeries += 1;
        continue;
      }

      // Обновляем recurrence у существующих, если дни известны
      if (encoded !== 'weekly') {
        await prisma.training.updateMany({
          where: { id: { in: series.map((t) => t.id) } },
          data: { recurrence: encoded },
        });
      }

      for (const row of toCreate) {
        const existing = await prisma.training.findFirst({
          where: {
            tenantId: row.tenantId,
            title: row.title,
            groupId: row.groupId,
            trainerId: row.trainerId,
            branchId: row.branchId,
            startTime: row.startTime,
            endTime: row.endTime,
            isCancelled: false,
          },
          select: { id: true },
        });
        if (existing) continue;
        await prisma.training.create({ data: row });
        result.createdCount += 1;
      }
    }
  }

  return result;
}
