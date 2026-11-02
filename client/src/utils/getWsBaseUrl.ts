import { getWsBaseUrlFromEnv } from '../capacitor/platform';

/**
 * Origin for Socket.IO (strip trailing /api from API base).
 */
export function getWsBaseUrl(): string {
  return getWsBaseUrlFromEnv();
}
