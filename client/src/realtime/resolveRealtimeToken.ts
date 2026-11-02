/** Активный JWT для namespace /realtime (приоритет как у API). */
export function resolveRealtimeToken(): string | null {
  if (typeof localStorage === 'undefined') return null;
  return (
    localStorage.getItem('superAdminToken') ||
    localStorage.getItem('platformStaffToken') ||
    localStorage.getItem('testerToken') ||
    localStorage.getItem('token') ||
    localStorage.getItem('clientToken') ||
    localStorage.getItem('parentToken') ||
    localStorage.getItem('marketerToken') ||
    null
  );
}
