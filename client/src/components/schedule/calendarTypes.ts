import { Competition, Training } from '../../types';

export type CalendarItemType = 'training' | 'competition' | 'task' | 'event';

export type CalendarViewMode = 'day' | 'week' | 'month';

export const CALENDAR_LAYER_COLORS = {
  training: '#2F6BFF',
  competition: '#F97316',
  task: '#A855F7',
  event: '#06B6D4',
} as const;

export interface CalendarItem {
  id: string;
  type: CalendarItemType;
  title: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  color: string;
  subtitle?: string;
  meta?: string;
  /** Строки карточки в сетке: время, место, тренер. */
  lines?: string[];
  /** Raw source entity */
  source: Training | Competition | SchoolEventLike | StaffTaskLike;
}

export interface SchoolEventLike {
  id: string;
  title: string;
  description?: string | null;
  type?: string;
  startTime: string;
  endTime: string;
  location?: string | null;
  branchId?: string | null;
  branch?: { id: string; name: string } | null;
}

export interface StaffTaskLike {
  id: string;
  title: string;
  body?: string;
  dueAt?: string | null;
  status?: string;
  assignees?: Array<{
    user?: { firstName?: string; lastName?: string; id?: string };
  }>;
  relatedTrainingId?: string | null;
  relatedSchoolEventId?: string | null;
}

export interface ScheduleFilters {
  branchId: string;
  hallId: string;
  trainerId: string;
  groupId: string;
}

export interface ScheduleLayers {
  trainings: boolean;
  competitions: boolean;
  tasks: boolean;
  events: boolean;
}

export interface ScheduleSummaryCounts {
  trainings: { count: number; delta: number };
  competitions: { count: number; delta: number };
  tasks: { count: number; delta: number };
  events: { count: number; delta: number };
}

/** Fallback, если в периоде нет timed-событий. */
export const GRID_START_HOUR = 8;
export const GRID_END_HOUR = 20;
export const HOUR_HEIGHT_PX = 64;

/** Диапазон часов сетки по фактическому времени занятий пользователя. endHour — исключительная граница (как Date#setHours). */
export function computeScheduleGridRange(
  spans: Array<{ start: Date; end: Date }>,
  options?: {
    fallbackStart?: number;
    fallbackEnd?: number;
    padHours?: number;
    minStart?: number;
    maxEnd?: number;
  }
): { startHour: number; endHour: number } {
  const fallbackStart = options?.fallbackStart ?? GRID_START_HOUR;
  const fallbackEnd = options?.fallbackEnd ?? GRID_END_HOUR;
  const pad = options?.padHours ?? 1;
  const minStart = options?.minStart ?? 6;
  const maxEnd = options?.maxEnd ?? 23;

  if (!spans.length) {
    return { startHour: fallbackStart, endHour: fallbackEnd };
  }

  let minH = 24;
  let maxH = 0;
  for (const { start, end } of spans) {
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
    const sh = start.getHours() + start.getMinutes() / 60 + start.getSeconds() / 3600;
    let eh = end.getHours() + end.getMinutes() / 60 + end.getSeconds() / 3600;
    if (eh <= sh) eh = sh + 0.5;
    minH = Math.min(minH, sh);
    maxH = Math.max(maxH, eh);
  }

  if (minH >= 24 && maxH <= 0) {
    return { startHour: fallbackStart, endHour: fallbackEnd };
  }

  let startHour = Math.max(minStart, Math.floor(minH) - pad);
  let endHour = Math.min(maxEnd, Math.ceil(maxH) + pad);
  if (endHour <= startHour) endHour = Math.min(maxEnd, startHour + 1);
  return { startHour, endHour };
}
