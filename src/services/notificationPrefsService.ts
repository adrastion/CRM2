import { prisma } from '../lib/prisma';

export type NotificationActorType =
  | 'USER'
  | 'CLIENT'
  | 'PARENT'
  | 'SUPER_ADMIN'
  | 'TESTER';

export type NotificationEventType = 'chat_message' | 'platform_changelog';

export type ScheduleMode = 'ALWAYS' | 'WINDOW';

export type NotificationPrefsDTO = {
  actorType: NotificationActorType;
  actorId: string;
  chatMessagesEnabled: boolean;
  changelogEnabled: boolean;
  pushMasterEnabled: boolean;
  scheduleMode: ScheduleMode;
  windowStartMinutes: number | null;
  windowEndMinutes: number | null;
  daysOfWeek: string | null;
  timezone: string;
};

const DEFAULTS = {
  chatMessagesEnabled: true,
  changelogEnabled: true,
  pushMasterEnabled: true,
  scheduleMode: 'ALWAYS' as ScheduleMode,
  windowStartMinutes: null as number | null,
  windowEndMinutes: null as number | null,
  daysOfWeek: null as string | null,
  timezone: 'Europe/Moscow',
};

function toDto(row: {
  actorType: string;
  actorId: string;
  chatMessagesEnabled: boolean;
  changelogEnabled: boolean;
  pushMasterEnabled: boolean;
  scheduleMode: string;
  windowStartMinutes: number | null;
  windowEndMinutes: number | null;
  daysOfWeek: string | null;
  timezone: string;
}): NotificationPrefsDTO {
  return {
    actorType: row.actorType as NotificationActorType,
    actorId: row.actorId,
    chatMessagesEnabled: row.chatMessagesEnabled,
    changelogEnabled: row.changelogEnabled,
    pushMasterEnabled: row.pushMasterEnabled,
    scheduleMode: (row.scheduleMode === 'WINDOW' ? 'WINDOW' : 'ALWAYS') as ScheduleMode,
    windowStartMinutes: row.windowStartMinutes,
    windowEndMinutes: row.windowEndMinutes,
    daysOfWeek: row.daysOfWeek,
    timezone: row.timezone || 'Europe/Moscow',
  };
}

export async function getOrCreateNotificationPrefs(
  actorType: NotificationActorType,
  actorId: string
): Promise<NotificationPrefsDTO> {
  const row = await prisma.notificationPreference.upsert({
    where: { actorType_actorId: { actorType, actorId } },
    create: { actorType, actorId, ...DEFAULTS },
    update: {},
  });
  return toDto(row);
}

export type NotificationPrefsUpdate = Partial<{
  chatMessagesEnabled: boolean;
  changelogEnabled: boolean;
  pushMasterEnabled: boolean;
  scheduleMode: ScheduleMode;
  windowStartMinutes: number | null;
  windowEndMinutes: number | null;
  daysOfWeek: string | null;
  timezone: string;
}>;

function clampMinutes(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(1439, Math.round(n)));
}

function normalizeDays(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === '' || raw === '*') return null;
  if (Array.isArray(raw)) {
    const days = raw
      .map((d) => Number(d))
      .filter((d) => d >= 1 && d <= 7)
      .sort((a, b) => a - b);
    return days.length === 0 || days.length === 7 ? null : days.join(',');
  }
  const s = String(raw)
    .split(',')
    .map((x) => Number(x.trim()))
    .filter((d) => d >= 1 && d <= 7)
    .sort((a, b) => a - b);
  return s.length === 0 || s.length === 7 ? null : [...new Set(s)].join(',');
}

export async function updateNotificationPrefs(
  actorType: NotificationActorType,
  actorId: string,
  patch: NotificationPrefsUpdate,
  opts?: { allowSchedule?: boolean }
): Promise<NotificationPrefsDTO> {
  const allowSchedule = opts?.allowSchedule !== false;
  const data: Record<string, unknown> = {};

  if (typeof patch.chatMessagesEnabled === 'boolean') {
    data.chatMessagesEnabled = patch.chatMessagesEnabled;
  }
  if (typeof patch.changelogEnabled === 'boolean') {
    data.changelogEnabled = patch.changelogEnabled;
  }
  if (typeof patch.pushMasterEnabled === 'boolean') {
    data.pushMasterEnabled = patch.pushMasterEnabled;
  }

  if (allowSchedule) {
    if (patch.scheduleMode === 'ALWAYS' || patch.scheduleMode === 'WINDOW') {
      data.scheduleMode = patch.scheduleMode;
    }
    if ('windowStartMinutes' in patch) {
      data.windowStartMinutes = clampMinutes(patch.windowStartMinutes);
    }
    if ('windowEndMinutes' in patch) {
      data.windowEndMinutes = clampMinutes(patch.windowEndMinutes);
    }
    if ('daysOfWeek' in patch) {
      data.daysOfWeek = normalizeDays(patch.daysOfWeek);
    }
    if (typeof patch.timezone === 'string' && patch.timezone.trim()) {
      data.timezone = patch.timezone.trim().slice(0, 64);
    }
  }

  const row = await prisma.notificationPreference.upsert({
    where: { actorType_actorId: { actorType, actorId } },
    create: {
      actorType,
      actorId,
      ...DEFAULTS,
      ...data,
    },
    update: data,
  });
  return toDto(row);
}

/** Минуты от полуночи и день недели (1=пн … 7=вс) в timezone. */
export function localTimeParts(
  timezone: string,
  date: Date = new Date()
): { minutes: number; dayOfWeek: number } {
  try {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone || 'Europe/Moscow',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
      hour12: false,
    });
    const parts = fmt.formatToParts(date);
    const hour = Number(parts.find((p) => p.type === 'hour')?.value || '0');
    const minute = Number(parts.find((p) => p.type === 'minute')?.value || '0');
    const wd = parts.find((p) => p.type === 'weekday')?.value || 'Mon';
    const map: Record<string, number> = {
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
      Sun: 7,
    };
    return { minutes: hour * 60 + minute, dayOfWeek: map[wd] || 1 };
  } catch {
    const minutes = date.getHours() * 60 + date.getMinutes();
    // getDay: 0=Sun … 6=Sat → 1=Mon … 7=Sun
    const js = date.getDay();
    const dayOfWeek = js === 0 ? 7 : js;
    return { minutes, dayOfWeek };
  }
}

function isInWindow(minutes: number, start: number | null, end: number | null): boolean {
  if (start == null || end == null) return true;
  if (start === end) return true;
  if (start < end) return minutes >= start && minutes < end;
  // окно через полночь
  return minutes >= start || minutes < end;
}

export function canReceivePushNow(
  prefs: NotificationPrefsDTO,
  eventType: NotificationEventType,
  now: Date = new Date(),
  opts?: { applySchedule?: boolean }
): boolean {
  if (!prefs.pushMasterEnabled) return false;
  if (eventType === 'chat_message' && !prefs.chatMessagesEnabled) return false;
  if (eventType === 'platform_changelog' && !prefs.changelogEnabled) return false;

  const applySchedule = opts?.applySchedule === true;
  if (!applySchedule || prefs.scheduleMode !== 'WINDOW') return true;

  const { minutes, dayOfWeek } = localTimeParts(prefs.timezone, now);
  if (prefs.daysOfWeek) {
    const allowed = prefs.daysOfWeek.split(',').map((d) => Number(d.trim()));
    if (!allowed.includes(dayOfWeek)) return false;
  }
  return isInWindow(minutes, prefs.windowStartMinutes, prefs.windowEndMinutes);
}
