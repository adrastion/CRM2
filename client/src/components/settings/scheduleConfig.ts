export type ScheduleEventColorKey =
  | 'training'
  | 'competition'
  | 'task'
  | 'event'
  | 'personal'
  | 'unavailable';

export interface ScheduleConfigTemplate {
  id: string;
  name: string;
  config: Omit<ScheduleConfig, 'templates'>;
}

export interface ScheduleConfig {
  defaultStartTime: string;
  /** 1=Пн … 7=Вс */
  trainingWeekdays: number[];
  workHours: {
    weekdays: [string, string];
    weekends: [string, string];
  };
  showWeekends: boolean;
  autoRescheduleHolidays: boolean;
  eventColors: Record<ScheduleEventColorKey, string>;
  timezone: string;
  dateFormat: 'DD.MM.YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
  timeFormat: '24h' | '12h';
  showLessonNumber: boolean;
  limitWhenFull: boolean;
  considerHolidays: boolean;
  templates: ScheduleConfigTemplate[];
}

export const DEFAULT_SCHEDULE_CONFIG: ScheduleConfig = {
  defaultStartTime: '09:00',
  trainingWeekdays: [1, 2, 3, 4, 5],
  workHours: {
    weekdays: ['08:00', '22:00'],
    weekends: ['09:00', '20:00'],
  },
  showWeekends: true,
  autoRescheduleHolidays: false,
  eventColors: {
    training: '#2F6BFF',
    competition: '#F93C65',
    task: '#6A1B9A',
    event: '#F97316',
    personal: '#12B981',
    unavailable: '#9AA3B5',
  },
  timezone: 'Europe/Moscow',
  dateFormat: 'DD.MM.YYYY',
  timeFormat: '24h',
  showLessonNumber: true,
  limitWhenFull: true,
  considerHolidays: true,
  templates: [
    {
      id: 'base',
      name: 'Базовые настройки',
      config: {
        defaultStartTime: '09:00',
        trainingWeekdays: [1, 2, 3, 4, 5],
        workHours: {
          weekdays: ['08:00', '22:00'],
          weekends: ['09:00', '20:00'],
        },
        showWeekends: true,
        autoRescheduleHolidays: false,
        eventColors: {
          training: '#2F6BFF',
          competition: '#F93C65',
          task: '#6A1B9A',
          event: '#F97316',
          personal: '#12B981',
          unavailable: '#9AA3B5',
        },
        timezone: 'Europe/Moscow',
        dateFormat: 'DD.MM.YYYY',
        timeFormat: '24h',
        showLessonNumber: true,
        limitWhenFull: true,
        considerHolidays: true,
      },
    },
  ],
};

export const WEEKDAY_LABELS: Array<{ day: number; label: string }> = [
  { day: 1, label: 'Понедельник' },
  { day: 2, label: 'Вторник' },
  { day: 3, label: 'Среда' },
  { day: 4, label: 'Четверг' },
  { day: 5, label: 'Пятница' },
  { day: 6, label: 'Суббота' },
  { day: 7, label: 'Воскресенье' },
];

export const EVENT_COLOR_LABELS: Array<{ key: ScheduleEventColorKey; label: string }> = [
  { key: 'training', label: 'Тренировка' },
  { key: 'competition', label: 'Соревнование' },
  { key: 'task', label: 'Задача' },
  { key: 'event', label: 'Событие' },
  { key: 'personal', label: 'Личное' },
  { key: 'unavailable', label: 'Недоступность' },
];

export const TIMEZONE_OPTIONS = [
  { value: 'Europe/Moscow', label: 'Москва (UTC +3)' },
  { value: 'Europe/Samara', label: 'Самара (UTC +4)' },
  { value: 'Asia/Yekaterinburg', label: 'Екатеринбург (UTC +5)' },
  { value: 'Asia/Novosibirsk', label: 'Новосибирск (UTC +7)' },
  { value: 'Asia/Vladivostok', label: 'Владивосток (UTC +10)' },
  { value: 'UTC', label: 'UTC' },
];

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function mergeScheduleConfig(raw: unknown, staffTaskColor?: string | null): ScheduleConfig {
  const base = structuredClone(DEFAULT_SCHEDULE_CONFIG);
  if (!raw || typeof raw !== 'object') {
    if (staffTaskColor && /^#[0-9A-Fa-f]{6}$/.test(staffTaskColor)) {
      base.eventColors.task = staffTaskColor.toUpperCase();
    }
    return base;
  }
  const src = raw as Partial<ScheduleConfig>;
  if (typeof src.defaultStartTime === 'string' && TIME_RE.test(src.defaultStartTime)) {
    base.defaultStartTime = src.defaultStartTime;
  }
  if (Array.isArray(src.trainingWeekdays)) {
    base.trainingWeekdays = src.trainingWeekdays
      .map(Number)
      .filter((d) => d >= 1 && d <= 7);
  }
  if (src.workHours?.weekdays?.length === 2) {
    base.workHours.weekdays = [String(src.workHours.weekdays[0]), String(src.workHours.weekdays[1])];
  }
  if (src.workHours?.weekends?.length === 2) {
    base.workHours.weekends = [String(src.workHours.weekends[0]), String(src.workHours.weekends[1])];
  }
  if (typeof src.showWeekends === 'boolean') base.showWeekends = src.showWeekends;
  if (typeof src.autoRescheduleHolidays === 'boolean') {
    base.autoRescheduleHolidays = src.autoRescheduleHolidays;
  }
  if (src.eventColors && typeof src.eventColors === 'object') {
    (Object.keys(base.eventColors) as ScheduleEventColorKey[]).forEach((k) => {
      const v = (src.eventColors as any)[k];
      if (typeof v === 'string' && /^#[0-9A-Fa-f]{6}$/.test(v)) {
        base.eventColors[k] = v.toUpperCase();
      }
    });
  }
  if (staffTaskColor && /^#[0-9A-Fa-f]{6}$/.test(staffTaskColor)) {
    base.eventColors.task = staffTaskColor.toUpperCase();
  }
  if (typeof src.timezone === 'string' && src.timezone) base.timezone = src.timezone;
  if (src.dateFormat === 'DD.MM.YYYY' || src.dateFormat === 'MM/DD/YYYY' || src.dateFormat === 'YYYY-MM-DD') {
    base.dateFormat = src.dateFormat;
  }
  if (src.timeFormat === '24h' || src.timeFormat === '12h') base.timeFormat = src.timeFormat;
  if (typeof src.showLessonNumber === 'boolean') base.showLessonNumber = src.showLessonNumber;
  if (typeof src.limitWhenFull === 'boolean') base.limitWhenFull = src.limitWhenFull;
  if (typeof src.considerHolidays === 'boolean') base.considerHolidays = src.considerHolidays;
  if (Array.isArray(src.templates) && src.templates.length) {
    base.templates = src.templates.filter((t) => t && t.id && t.name) as ScheduleConfigTemplate[];
  }
  return base;
}

export function scheduleConfigWithoutTemplates(cfg: ScheduleConfig): Omit<ScheduleConfig, 'templates'> {
  const { templates: _t, ...rest } = cfg;
  return rest;
}

export function formatNowInTimezone(timezone: string): string {
  try {
    return new Intl.DateTimeFormat('ru-RU', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date());
  } catch {
    return new Date().toLocaleString('ru-RU');
  }
}
