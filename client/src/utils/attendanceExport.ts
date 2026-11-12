import { apiService } from '../services/api';

export type AttendanceExportScope = 'trainer' | 'client' | 'group';

/** Период по умолчанию — текущий календарный месяц (YYYY-MM-DD, локальная дата). */
export function currentMonthDateRange(): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const pad = (n: number) => String(n).padStart(2, '0');
  const lastDay = new Date(y, m + 1, 0).getDate();
  return {
    from: `${y}-${pad(m + 1)}-01`,
    to: `${y}-${pad(m + 1)}-${pad(lastDay)}`,
  };
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
  const { downloadBlob } = await import('../capacitor/nativeDownload');
  await downloadBlob(blob, resolved);
}
