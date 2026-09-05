import { ClientStandard } from '../../types';
import { AthleteCardData, AthleteCalendarEvent } from './athleteCardTypes';

export function fullName(c: {
  lastName?: string | null;
  firstName?: string | null;
  middleName?: string | null;
}): string {
  return [c.lastName, c.firstName, c.middleName].filter(Boolean).join(' ').trim();
}

export function calcAge(dateOfBirth?: string | null): number | null {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age -= 1;
  return age >= 0 ? age : null;
}

export function formatDateRu(value?: string | Date | null): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('ru-RU');
}

export function formatResult(s?: ClientStandard | null): string {
  if (!s) return '—';
  if (s.resultText) return s.resultText;
  if (s.result != null) return String(s.result);
  return '—';
}

/** Группировка нормативов: последний и предыдущий по standardId. */
export function buildStandardsRows(standards: ClientStandard[]) {
  const byId = new Map<string, ClientStandard[]>();
  standards.forEach((s) => {
    const key = s.standardId;
    if (!byId.has(key)) byId.set(key, []);
    byId.get(key)!.push(s);
  });

  return Array.from(byId.entries()).map(([standardId, list]) => {
    const sorted = [...list].sort(
      (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
    );
    const current = sorted[0];
    const previous = sorted[1] || null;
    const unit = current.standard?.unit || '';
    const target = current.standard?.targetValue;
    let dynamics: 'up' | 'down' | 'same' | 'none' = 'none';
    if (current.result != null && previous?.result != null) {
      const cur = Number(current.result);
      const prev = Number(previous.result);
      if (cur > prev) dynamics = 'up';
      else if (cur < prev) dynamics = 'down';
      else dynamics = 'same';
    }
    return {
      standardId,
      name: current.standard?.name || 'Норматив',
      target: target != null ? `${target}${unit ? ` ${unit}` : ''}` : '—',
      current: formatResult(current),
      previous: formatResult(previous),
      date: formatDateRu(current.completedAt),
      dynamics,
      history: sorted,
    };
  });
}

export function deriveSecondaryMeta(data: AthleteCardData) {
  const memberships = (data.groupMemberships || []).filter((gm: any) => gm.isActive !== false);
  const groups = memberships.map((gm: any) => gm.group).filter(Boolean);
  const groupNames = groups.map((g: any) => g.name).filter(Boolean);
  const trainers = groups
    .map((g: any) => {
      const u = g.trainer?.user;
      if (!u) return null;
      return [u.lastName, u.firstName, u.middleName].filter(Boolean).join(' ');
    })
    .filter(Boolean) as string[];
  const branches = groups.map((g: any) => g.branch?.name).filter(Boolean) as string[];
  return {
    groupLabel: groupNames.length ? groupNames.join(', ') : '—',
    trainerLabel: trainers.length ? Array.from(new Set(trainers)).join(', ') : '—',
    branchLabel: branches.length ? Array.from(new Set(branches)).join(', ') : '—',
  };
}

export function buildCalendarEvents(data: AthleteCardData): AthleteCalendarEvent[] {
  const trainings: AthleteCalendarEvent[] = (data.calendar?.trainings || []).map((t: any) => ({
    id: t.id,
    title: t.title || t.group?.name || 'Тренировка',
    startTime: t.startTime,
    endTime: t.endTime,
    type: 'training' as const,
    groupName: t.group?.name || null,
    location: t.branch?.name || t.hall?.name || null,
  }));
  const competitions: AthleteCalendarEvent[] = (data.calendar?.competitions || []).map((c: any) => ({
    id: c.id,
    name: c.name,
    title: c.name,
    startDate: c.startDate,
    endDate: c.endDate,
    type: 'competition' as const,
    location: c.location || null,
  }));
  return [...trainings, ...competitions].sort((a, b) => {
    const da = new Date(a.startTime || a.startDate || 0).getTime();
    const db = new Date(b.startTime || b.startDate || 0).getTime();
    return da - db;
  });
}

export function trainerUserName(user?: {
  lastName?: string;
  firstName?: string;
  middleName?: string;
} | null): string {
  if (!user) return '—';
  return [user.lastName, user.firstName, user.middleName].filter(Boolean).join(' ') || '—';
}
