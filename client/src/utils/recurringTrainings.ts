import { apiService } from '../services/api';

export type DayScheduleLike = {
  dayOfWeek: number;
  startTime: Date | null;
  endTime: Date | null;
};

/** Нормализация дня недели (JS getDay: 0=вс … 6=сб). */
export function normalizeWeekday(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 6) return null;
  return n;
}

/**
 * Разворачивает регулярное расписание по дням недели в список ISO start/end.
 * Дата берётся из календаря периода; время — из daySchedules.
 */
export function expandRecurringByWeekdays(params: {
  startDate: Date;
  endDate: Date;
  daySchedules: DayScheduleLike[];
}): Array<{ startTime: string; endTime: string; dayOfWeek: number }> {
  const byDay = new Map<number, { startTime: Date; endTime: Date }>();
  for (const ds of params.daySchedules) {
    const day = normalizeWeekday(ds.dayOfWeek);
    if (day == null || !ds.startTime || !ds.endTime) continue;
    byDay.set(day, { startTime: ds.startTime, endTime: ds.endTime });
  }
  if (byDay.size === 0) return [];

  const startDate = new Date(params.startDate);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(params.endDate);
  endDate.setHours(23, 59, 59, 999);

  const out: Array<{ startTime: string; endTime: string; dayOfWeek: number }> = [];
  const cursor = new Date(startDate);
  while (cursor.getTime() <= endDate.getTime()) {
    const dayOfWeek = cursor.getDay();
    const schedule = byDay.get(dayOfWeek);
    if (schedule) {
      const start = new Date(cursor);
      start.setHours(schedule.startTime.getHours(), schedule.startTime.getMinutes(), 0, 0);
      const end = new Date(cursor);
      end.setHours(schedule.endTime.getHours(), schedule.endTime.getMinutes(), 0, 0);
      if (end.getTime() > start.getTime()) {
        out.push({
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          dayOfWeek,
        });
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

/** Загружает все тренировки серии (с пагинацией), чтобы не терять пн/ср при limit=1000. */
export async function fetchTrainingSeries(params: {
  title: string;
  groupId?: string | null;
  trainerId: string;
  branchId: string;
}): Promise<any[]> {
  const pageSize = 500;
  const collected: any[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const res = await apiService.getTrainings({
      limit: pageSize,
      page,
      ...(params.groupId ? { groupId: params.groupId } : {}),
    });
    const chunk = res.data || [];
    collected.push(...chunk);
    totalPages = res.pagination?.totalPages || 1;
    page += 1;
  } while (page <= totalPages && page <= 40);

  return collected.filter(
    (t) =>
      t.title === params.title &&
      (t.groupId || null) === (params.groupId || null) &&
      t.trainerId === params.trainerId &&
      t.branchId === params.branchId &&
      t.isRecurring &&
      !t.isCancelled
  );
}

/** Batch-создание с чанками по 50 (лимит API). */
export async function createTrainingsInChunks(
  trainings: any[],
  chunkSize = 50
): Promise<{ createdCount: number; failedCount: number; failed: any[] }> {
  let createdCount = 0;
  let failedCount = 0;
  const failed: any[] = [];

  for (let i = 0; i < trainings.length; i += chunkSize) {
    const chunk = trainings.slice(i, i + chunkSize);
    if (chunk.length === 1) {
      try {
        await apiService.createTraining(chunk[0]);
        createdCount += 1;
      } catch (err: any) {
        failedCount += 1;
        failed.push({
          training: chunk[0],
          error: err?.response?.data?.error || err?.message || 'Ошибка создания',
        });
      }
      continue;
    }
    try {
      const result = await apiService.createTrainingsBatch(chunk);
      createdCount += result.createdCount || 0;
      failedCount += result.failedCount || 0;
      if (result.failed?.length) failed.push(...result.failed);
    } catch (batchErr: any) {
      for (const training of chunk) {
        try {
          await apiService.createTraining(training);
          createdCount += 1;
          await new Promise((r) => setTimeout(r, 300));
        } catch (err: any) {
          failedCount += 1;
          failed.push({
            training,
            error: err?.response?.data?.error || err?.message || 'Ошибка создания',
          });
        }
      }
    }
  }

  return { createdCount, failedCount, failed };
}
