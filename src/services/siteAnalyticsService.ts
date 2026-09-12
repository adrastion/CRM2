import { prisma } from '../lib/prisma';

const IDLE_MS = 30 * 60 * 1000;
const ONLINE_MS = 90 * 1000;
const MIN_DURATION_SEC = 5;
const MAX_DURATION_SEC = 8 * 60 * 60;
const SESSION_RETENTION_DAYS = 90;
const DAILY_RETENTION_DAYS = 800;

const ACTOR_HINTS = new Set(['guest', 'school', 'client', 'parent']);

/** Calendar date string YYYY-MM-DD in Europe/Moscow */
export function mskDateString(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/** Start of MSK calendar day as UTC Date (midnight MSK) */
export function mskDayStartUtc(dateStr: string): Date {
  // dateStr YYYY-MM-DD interpreted as Moscow midnight
  return new Date(`${dateStr}T00:00:00+03:00`);
}

export function mskHour(d: Date): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Moscow',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(d);
  return Number(parts.find((p) => p.type === 'hour')?.value || 0);
}

function clampDurationSec(startedAt: Date, endedAt: Date): number | null {
  const sec = Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000);
  if (sec < MIN_DURATION_SEC || sec > MAX_DURATION_SEC) return null;
  return sec;
}

export async function pingSiteVisit(input: {
  visitorId: string;
  path?: string | null;
  actorHint?: string | null;
  closing?: boolean;
}): Promise<{ sessionId: string }> {
  const visitorId = String(input.visitorId || '').trim().slice(0, 64);
  if (!visitorId || visitorId.length < 8) {
    throw Object.assign(new Error('Invalid visitorId'), { statusCode: 400 });
  }

  const now = new Date();
  const path = input.path ? String(input.path).slice(0, 500) : null;
  const actorHint =
    input.actorHint && ACTOR_HINTS.has(String(input.actorHint))
      ? String(input.actorHint)
      : null;

  const idleSince = new Date(now.getTime() - IDLE_MS);
  const existing = await prisma.siteVisitSession.findFirst({
    where: {
      visitorId,
      endedAt: null,
      lastSeenAt: { gte: idleSince },
    },
    orderBy: { lastSeenAt: 'desc' },
  });

  if (existing) {
    const updated = await prisma.siteVisitSession.update({
      where: { id: existing.id },
      data: {
        lastSeenAt: now,
        lastPath: path ?? existing.lastPath,
        actorHint: actorHint ?? existing.actorHint,
        pingCount: { increment: 1 },
        ...(input.closing ? { endedAt: now } : {}),
      },
    });
    return { sessionId: updated.id };
  }

  const created = await prisma.siteVisitSession.create({
    data: {
      visitorId,
      startedAt: now,
      lastSeenAt: now,
      lastPath: path,
      actorHint,
      pingCount: 1,
      endedAt: input.closing ? now : null,
    },
  });
  return { sessionId: created.id };
}

export async function closeIdleSessions(): Promise<number> {
  const cutoff = new Date(Date.now() - IDLE_MS);
  const closed = await prisma.$executeRaw`
    UPDATE site_visit_sessions
    SET "endedAt" = "lastSeenAt"
    WHERE "endedAt" IS NULL
      AND "lastSeenAt" < ${cutoff}
  `;
  return Number(closed) || 0;
}

export async function cleanupOldSiteVisits(): Promise<{ sessions: number; daily: number }> {
  const sessionCutoff = new Date(Date.now() - SESSION_RETENTION_DAYS * 86400000);
  const dailyCutoff = new Date(Date.now() - DAILY_RETENTION_DAYS * 86400000);
  const sessions = await prisma.siteVisitSession.deleteMany({
    where: { startedAt: { lt: sessionCutoff } },
  });
  const daily = await prisma.siteVisitDaily.deleteMany({
    where: { date: { lt: dailyCutoff } },
  });
  return { sessions: sessions.count, daily: daily.count };
}

/** Recompute/upsert SiteVisitDaily for a Moscow calendar day */
export async function rollupSiteVisitDay(dateStr?: string): Promise<void> {
  const day = dateStr || mskDateString(new Date(Date.now() - 3600000)); // prefer previous hour's day
  const start = mskDayStartUtc(day);
  const end = new Date(start.getTime() + 86400000);

  const sessions = await prisma.siteVisitSession.findMany({
    where: {
      OR: [
        { startedAt: { gte: start, lt: end } },
        { lastSeenAt: { gte: start, lt: end } },
        {
          startedAt: { lt: start },
          OR: [{ endedAt: null }, { endedAt: { gt: start } }],
        },
      ],
    },
    select: {
      visitorId: true,
      startedAt: true,
      lastSeenAt: true,
      endedAt: true,
    },
  });

  const unique = new Set(sessions.map((s) => s.visitorId));
  let totalDuration = 0;
  let sessionCount = 0;
  for (const s of sessions) {
    const endAt = s.endedAt || (s.lastSeenAt < end ? s.lastSeenAt : end);
    const startAt = s.startedAt < start ? start : s.startedAt;
    const dur = clampDurationSec(startAt, endAt);
    if (dur != null) {
      totalDuration += dur;
      sessionCount += 1;
    }
  }

  // Approximate hourly concurrent: sample each hour midpoint
  const hourlyAvg: number[] = [];
  const hourlyMax: number[] = [];
  let peak = 0;
  for (let h = 0; h < 24; h++) {
    const hourStart = new Date(start.getTime() + h * 3600000);
    const hourEnd = new Date(hourStart.getTime() + 3600000);
    let concurrent = 0;
    for (const s of sessions) {
      const sEnd = s.endedAt || s.lastSeenAt;
      if (s.startedAt < hourEnd && sEnd >= hourStart) concurrent += 1;
    }
    hourlyAvg.push(concurrent);
    hourlyMax.push(concurrent);
    if (concurrent > peak) peak = concurrent;
  }

  await prisma.siteVisitDaily.upsert({
    where: { date: start },
    create: {
      date: start,
      uniqueVisitors: unique.size,
      sessionCount,
      totalDurationSec: totalDuration,
      peakConcurrent: peak,
      hourlyJson: JSON.stringify({ avg: hourlyAvg, max: hourlyMax }),
    },
    update: {
      uniqueVisitors: unique.size,
      sessionCount,
      totalDurationSec: totalDuration,
      peakConcurrent: peak,
      hourlyJson: JSON.stringify({ avg: hourlyAvg, max: hourlyMax }),
    },
  });
}

export async function getLiveTraffic() {
  const now = new Date();
  const onlineSince = new Date(now.getTime() - ONLINE_MS);
  const online = await prisma.siteVisitSession.findMany({
    where: { endedAt: null, lastSeenAt: { gte: onlineSince } },
    select: { actorHint: true, lastPath: true, lastSeenAt: true, visitorId: true },
  });

  const byActor: Record<string, number> = {
    guest: 0,
    school: 0,
    client: 0,
    parent: 0,
    unknown: 0,
  };
  const pathCounts = new Map<string, number>();
  for (const row of online) {
    const hint = row.actorHint && ACTOR_HINTS.has(row.actorHint) ? row.actorHint : 'unknown';
    byActor[hint] = (byActor[hint] || 0) + 1;
    const p = row.lastPath || '/';
    pathCounts.set(p, (pathCounts.get(p) || 0) + 1);
  }

  const topPaths = [...pathCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([path, count]) => ({ path, count }));

  // Last 24h hourly online peaks from sessions (approx)
  const dayAgo = new Date(now.getTime() - 86400000);
  const recent = await prisma.siteVisitSession.findMany({
    where: {
      OR: [{ lastSeenAt: { gte: dayAgo } }, { startedAt: { gte: dayAgo } }],
    },
    select: { startedAt: true, lastSeenAt: true, endedAt: true },
  });

  const hourly: Array<{ hour: string; online: number }> = [];
  for (let i = 23; i >= 0; i--) {
    const hourEnd = new Date(now.getTime() - i * 3600000);
    const hourStart = new Date(hourEnd.getTime() - 3600000);
    let c = 0;
    for (const s of recent) {
      const sEnd = s.endedAt || s.lastSeenAt;
      if (s.startedAt < hourEnd && sEnd >= hourStart) c += 1;
    }
    hourly.push({
      hour: hourStart.toISOString(),
      online: c,
    });
  }

  return {
    onlineNow: online.length,
    byActor,
    topPaths,
    hourly24h: hourly,
    asOf: now.toISOString(),
  };
}

export type SummaryRange = 'day' | 'month' | 'quarter' | 'year';

function rangeBounds(range: SummaryRange): { start: Date; end: Date; label: string } {
  const now = new Date();
  const todayStr = mskDateString(now);
  const end = new Date(mskDayStartUtc(todayStr).getTime() + 86400000);
  let start: Date;
  if (range === 'day') {
    start = mskDayStartUtc(todayStr);
  } else if (range === 'month') {
    const [y, m] = todayStr.split('-').map(Number);
    start = mskDayStartUtc(`${y}-${String(m).padStart(2, '0')}-01`);
  } else if (range === 'quarter') {
    const [y, m] = todayStr.split('-').map(Number);
    const qStart = Math.floor((m - 1) / 3) * 3 + 1;
    start = mskDayStartUtc(`${y}-${String(qStart).padStart(2, '0')}-01`);
  } else {
    const y = Number(todayStr.split('-')[0]);
    start = mskDayStartUtc(`${y}-01-01`);
  }
  return { start, end, label: range };
}

export async function getTrafficSummary(range: SummaryRange) {
  const { start, end } = rangeBounds(range);

  // Prefer daily rollups when available (except partial today — merge with live)
  const dailies = await prisma.siteVisitDaily.findMany({
    where: { date: { gte: start, lt: end } },
    orderBy: { date: 'asc' },
  });

  const sessions = await prisma.siteVisitSession.findMany({
    where: {
      OR: [
        { startedAt: { gte: start, lt: end } },
        { lastSeenAt: { gte: start, lt: end } },
        {
          startedAt: { lt: start },
          OR: [{ endedAt: null }, { endedAt: { gt: start } }],
        },
      ],
    },
    select: {
      visitorId: true,
      startedAt: true,
      lastSeenAt: true,
      endedAt: true,
    },
  });

  const unique = new Set(sessions.map((s) => s.visitorId));
  let totalDuration = 0;
  let counted = 0;
  for (const s of sessions) {
    const endAt = s.endedAt || s.lastSeenAt;
    const startAt = s.startedAt < start ? start : s.startedAt;
    const cappedEnd = endAt > end ? end : endAt;
    const dur = clampDurationSec(startAt, cappedEnd);
    if (dur != null) {
      totalDuration += dur;
      counted += 1;
    }
  }

  const peakFromDaily = dailies.reduce((m, d) => Math.max(m, d.peakConcurrent), 0);
  let peak = peakFromDaily;
  // quick peak estimate from sessions if no rollup
  if (!dailies.length) {
    // sample every hour in range (cap 90 days worth → use daily max approx)
    const hours = Math.min(24 * 40, Math.ceil((end.getTime() - start.getTime()) / 3600000));
    for (let i = 0; i < hours; i++) {
      const hourStart = new Date(start.getTime() + i * 3600000);
      if (hourStart >= end) break;
      const hourEnd = new Date(hourStart.getTime() + 3600000);
      let c = 0;
      for (const s of sessions) {
        const sEnd = s.endedAt || s.lastSeenAt;
        if (s.startedAt < hourEnd && sEnd >= hourStart) c += 1;
      }
      if (c > peak) peak = c;
    }
  }

  let hourlyProfile: number[] | null = null;
  if (range === 'day') {
    const today = dailies.find((d) => d.date.getTime() === start.getTime());
    if (today?.hourlyJson) {
      try {
        const parsed = JSON.parse(today.hourlyJson);
        hourlyProfile = Array.isArray(parsed) ? parsed : parsed.avg || null;
      } catch {
        hourlyProfile = null;
      }
    }
    if (!hourlyProfile) {
      hourlyProfile = [];
      for (let h = 0; h < 24; h++) {
        const hourStart = new Date(start.getTime() + h * 3600000);
        const hourEnd = new Date(hourStart.getTime() + 3600000);
        let c = 0;
        for (const s of sessions) {
          const sEnd = s.endedAt || s.lastSeenAt;
          if (s.startedAt < hourEnd && sEnd >= hourStart) c += 1;
        }
        hourlyProfile.push(c);
      }
    }
  }

  return {
    range,
    start: start.toISOString(),
    end: end.toISOString(),
    uniqueVisitors: unique.size,
    sessionCount: counted || sessions.length,
    avgSessionDurationSec: counted ? Math.round(totalDuration / counted) : 0,
    peakConcurrent: peak,
    hourlyProfile,
    dailySeries: dailies.map((d) => ({
      date: d.date.toISOString().slice(0, 10),
      uniqueVisitors: d.uniqueVisitors,
      sessionCount: d.sessionCount,
      avgDurationSec:
        d.sessionCount > 0 ? Math.round(d.totalDurationSec / d.sessionCount) : 0,
      peakConcurrent: d.peakConcurrent,
    })),
  };
}

export async function getQuietHours(days = 30) {
  const n = Math.min(90, Math.max(7, days));
  const todayStr = mskDateString();
  const end = mskDayStartUtc(todayStr);
  const start = new Date(end.getTime() - n * 86400000);

  const dailies = await prisma.siteVisitDaily.findMany({
    where: { date: { gte: start, lt: end } },
  });

  const sum = new Array(24).fill(0);
  const cnt = new Array(24).fill(0);
  for (const d of dailies) {
    try {
      const parsed = JSON.parse(d.hourlyJson || '[]');
      const avg: number[] = Array.isArray(parsed) ? parsed : parsed.avg || [];
      for (let h = 0; h < 24; h++) {
        if (typeof avg[h] === 'number') {
          sum[h] += avg[h];
          cnt[h] += 1;
        }
      }
    } catch {
      /* ignore */
    }
  }

  // Fallback from sessions if no rollups
  if (!dailies.length) {
    const sessions = await prisma.siteVisitSession.findMany({
      where: { lastSeenAt: { gte: start } },
      select: { startedAt: true, lastSeenAt: true, endedAt: true },
    });
    for (let dayOffset = 0; dayOffset < n; dayOffset++) {
      const dayStart = new Date(start.getTime() + dayOffset * 86400000);
      for (let h = 0; h < 24; h++) {
        const hourStart = new Date(dayStart.getTime() + h * 3600000);
        const hourEnd = new Date(hourStart.getTime() + 3600000);
        let c = 0;
        for (const s of sessions) {
          const sEnd = s.endedAt || s.lastSeenAt;
          if (s.startedAt < hourEnd && sEnd >= hourStart) c += 1;
        }
        sum[h] += c;
        cnt[h] += 1;
      }
    }
  }

  const hours = sum.map((s, h) => ({
    hour: h,
    avgConcurrent: cnt[h] ? Math.round((s / cnt[h]) * 10) / 10 : 0,
  }));
  const sorted = [...hours].sort((a, b) => a.avgConcurrent - b.avgConcurrent);
  const best = sorted.slice(0, 3);

  return {
    days: n,
    hours,
    bestWindows: best.map((b) => ({
      hourMsk: b.hour,
      label: `${String(b.hour).padStart(2, '0')}:00–${String((b.hour + 1) % 24).padStart(2, '0')}:00 MSK`,
      avgConcurrent: b.avgConcurrent,
    })),
  };
}
