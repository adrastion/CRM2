import { Competition, Training } from '../../types';
import {
  CALENDAR_LAYER_COLORS,
  CalendarItem,
  SchoolEventLike,
  StaffTaskLike,
} from './calendarTypes';

function hasClockTime(d: Date): boolean {
  return d.getHours() !== 0 || d.getMinutes() !== 0 || d.getSeconds() !== 0;
}

function trainerShort(training: Training): string {
  const u = training.substituteTrainer?.user || training.trainer?.user;
  if (!u) return '';
  const initial = u.firstName ? `${u.firstName.charAt(0)}.` : '';
  return `${u.lastName || ''} ${initial}`.trim();
}

export function trainingToCalendarItem(t: Training): CalendarItem {
  const enrolled = t.occupancy?.enrolled;
  const capacity = t.occupancy?.capacity;
  const hallName = t.hall?.name;
  const occupancyLabel =
    capacity != null && enrolled != null
      ? `${enrolled} из ${capacity} мест`
      : capacity != null
        ? `${capacity} мест`
        : undefined;
  const place = [hallName, occupancyLabel].filter(Boolean).join(' • ');
  const time = formatTimeRange(t.startTime, t.endTime);
  const coach = trainerShort(t);
  return {
    id: `training:${t.id}`,
    type: 'training',
    title: t.title || t.group?.name || 'Тренировка',
    start: new Date(t.startTime),
    end: new Date(t.endTime),
    color: CALENDAR_LAYER_COLORS.training,
    subtitle: time,
    meta: [place, coach].filter(Boolean).join(' · '),
    lines: [time, place, coach].filter(Boolean),
    source: t,
  };
}

export function competitionToCalendarItem(c: Competition): CalendarItem {
  const start = new Date(c.startDate);
  const end = new Date(c.endDate);
  const timed = hasClockTime(start) || hasClockTime(end);
  const endTimed = timed
    ? end
    : (() => {
        const e = new Date(end);
        e.setHours(23, 59, 59, 999);
        return e;
      })();
  return {
    id: `competition:${c.id}`,
    type: 'competition',
    title: c.name,
    start,
    end: endTimed,
    allDay: !timed,
    color: CALENDAR_LAYER_COLORS.competition,
    subtitle: timed ? formatTimeRange(c.startDate, c.endDate) : 'Весь день',
    meta: c.location || undefined,
    lines: [timed ? formatTimeRange(c.startDate, c.endDate) : 'Весь день', c.location || ''].filter(Boolean),
    source: c,
  };
}

export function eventToCalendarItem(e: SchoolEventLike): CalendarItem {
  return {
    id: `event:${e.id}`,
    type: 'event',
    title: e.title,
    start: new Date(e.startTime),
    end: new Date(e.endTime),
    color: CALENDAR_LAYER_COLORS.event,
    subtitle: formatTimeRange(e.startTime, e.endTime),
    meta: e.location || e.branch?.name || undefined,
    lines: [formatTimeRange(e.startTime, e.endTime), e.location || e.branch?.name || ''].filter(Boolean),
    source: e,
  };
}

export function taskToCalendarItem(task: StaffTaskLike, taskColor?: string): CalendarItem {
  const due = task.dueAt ? new Date(task.dueAt) : new Date();
  const end = new Date(due.getTime() + 60 * 60 * 1000);
  const assignee = task.assignees?.[0]?.user;
  const assigneeName = assignee
    ? `${assignee.lastName || ''} ${assignee.firstName?.[0] ? `${assignee.firstName[0]}.` : ''}`.trim()
    : undefined;
  const time = formatHm(due);
  return {
    id: `task:${task.id}`,
    type: 'task',
    title: task.title,
    start: due,
    end,
    color: taskColor || CALENDAR_LAYER_COLORS.task,
    subtitle: time,
    meta: assigneeName,
    lines: [time, assigneeName || ''].filter(Boolean),
    source: task,
  };
}

function formatHm(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function formatTimeRange(startIso: string, endIso: string): string {
  return `${formatHm(new Date(startIso))}–${formatHm(new Date(endIso))}`;
}

export function buildCalendarItems(params: {
  trainings: Training[];
  competitions: Competition[];
  events: SchoolEventLike[];
  tasks: StaffTaskLike[];
  layers: { trainings: boolean; competitions: boolean; tasks: boolean; events: boolean };
  taskColor?: string;
  filters?: {
    branchId?: string;
    hallId?: string;
    trainerId?: string;
    groupId?: string;
  };
}): CalendarItem[] {
  const { trainings, competitions, events, tasks, layers, taskColor, filters } = params;
  const items: CalendarItem[] = [];

  if (layers.trainings) {
    trainings
      .filter((t) => !t.isCancelled)
      .filter((t) => !filters?.branchId || t.branchId === filters.branchId)
      .filter((t) => !filters?.hallId || t.hallId === filters.hallId)
      .filter((t) => !filters?.trainerId || t.trainerId === filters.trainerId)
      .filter((t) => !filters?.groupId || t.groupId === filters.groupId)
      .forEach((t) => items.push(trainingToCalendarItem(t)));
  }

  if (layers.competitions) {
    competitions.forEach((c) => items.push(competitionToCalendarItem(c)));
  }

  if (layers.events) {
    events
      .filter((e) => !filters?.branchId || !e.branchId || e.branchId === filters.branchId)
      .forEach((e) => items.push(eventToCalendarItem(e)));
  }

  if (layers.tasks) {
    tasks.forEach((t) => items.push(taskToCalendarItem(t, taskColor)));
  }

  return items.sort((a, b) => a.start.getTime() - b.start.getTime());
}

export function sourceIdOf(item: CalendarItem): string {
  return item.source.id;
}
