import { Capacitor } from '@capacitor/core';

/** true в Android/iOS WebView Capacitor */
export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function nativePlatform(): string {
  try {
    return Capacitor.getPlatform();
  } catch {
    return 'web';
  }
}

const PROD_API = 'https://profsportcrm.ru/api';

/**
 * Base URL API.
 * В APK относительный `/api` не работает — всегда прод (или REACT_APP_API_URL).
 */
export function getApiBaseUrl(): string {
  const fromEnv = (process.env.REACT_APP_API_URL || '').trim().replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  if (isNativeApp()) return PROD_API;
  // Capacitor WebView иногда ещё не готов на первом тике — подстраховка по hostname
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' && window.location.protocol === 'https:') {
      return PROD_API;
    }
  }
  return '/api';
}

/** Origin без /api — для Socket.IO */
export function getWsBaseUrlFromEnv(): string {
  const api = getApiBaseUrl();
  if (!api || api === '/api') {
    if (typeof window !== 'undefined') return window.location.origin;
    return '';
  }
  return api.replace(/\/api\/?$/, '');
}
