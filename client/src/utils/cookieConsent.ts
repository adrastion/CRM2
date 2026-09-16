/** Ключи и хелперы согласия на cookies / аналитику. */

export const COOKIE_CONSENT_KEY = 'cookieConsent';
export const COOKIE_CONSENT_AT_KEY = 'cookieConsentAt';

export type CookieConsentValue = 'accepted' | 'essential';

export function getCookieConsent(): CookieConsentValue | null {
  try {
    const v = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (v === 'accepted' || v === 'essential') return v;
  } catch {
    /* ignore */
  }
  return null;
}

export function setCookieConsent(value: CookieConsentValue): void {
  try {
    localStorage.setItem(COOKIE_CONSENT_KEY, value);
    localStorage.setItem(COOKIE_CONSENT_AT_KEY, new Date().toISOString());
    window.dispatchEvent(new CustomEvent('cookie-consent-changed', { detail: { value } }));
  } catch {
    /* ignore */
  }
}

export function hasAnalyticsConsent(): boolean {
  return getCookieConsent() === 'accepted';
}
