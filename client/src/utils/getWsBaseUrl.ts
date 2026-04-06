/**
 * Origin for Socket.IO (strip trailing /api from REACT_APP_API_URL).
 */
export function getWsBaseUrl(): string {
  const raw = process.env.REACT_APP_API_URL || '';
  if (raw) {
    try {
      const trimmed = raw.replace(/\/api\/?$/, '');
      const u = new URL(trimmed);
      return u.origin;
    } catch {
      return typeof window !== 'undefined' ? window.location.origin : '';
    }
  }
  return typeof window !== 'undefined' ? window.location.origin : '';
}
