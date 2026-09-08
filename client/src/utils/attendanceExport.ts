import { apiService } from '../services/api';

export type AttendanceExportScope = 'trainer' | 'client' | 'group';

/** Период по умолчанию — текущий календарный месяц (YYYY-MM-DD). */
export function currentMonthDateRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to) };
}

function formatDateRuFromIso(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  if (!y || !m || !d) return isoDate;
  return `${d}.${m}.${y}`;
}

function buildAttendanceFilename(entityName: string | undefined, from: string, to: string): string {
  const name = (entityName || 'выгрузка').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
  const period = `${formatDateRuFromIso(from)}-${formatDateRuFromIso(to)}`;
  return `Посещаемость ${name} ${period}.xlsx`;
}

export async function downloadAttendanceExcel(params: {
  scope: AttendanceExportScope;
  id: string;
  from: string;
  to: string;
  entityName?: string;
}): Promise<void> {
  const { blob, filename } = await apiService.exportAttendanceExcel(params);
  const fallback = buildAttendanceFilename(params.entityName, params.from, params.to);
  // ASCII fallback с сервера — attendance_…; UTF-8 имя содержит «Посещаемость»
  const resolved = filename && !/^attendance_/i.test(filename) ? filename : fallback;
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = resolved;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
