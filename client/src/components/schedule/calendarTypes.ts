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

/** Grid hours 08:00–20:00 inclusive of 20:00 label row end. */
export const GRID_START_HOUR = 8;
export const GRID_END_HOUR = 20;
export const HOUR_HEIGHT_PX = 64;
