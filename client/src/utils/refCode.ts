export const REF_CODE_KEY = 'refCode';

function readCookie(name: string): string | null {
  try {
    const match = document.cookie.match(
      new RegExp('(?:^|; )' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)')
    );
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

/** Рекламный код маркетолога: localStorage, иначе cookie. */
export function getStoredRefCode(): string | undefined {
  try {
    const fromLs = localStorage.getItem(REF_CODE_KEY);
    if (fromLs && fromLs.trim()) return fromLs.trim();
  } catch {
    /* ignore */
  }
  const fromCookie = readCookie(REF_CODE_KEY);
  if (fromCookie && fromCookie.trim()) return fromCookie.trim();
  return undefined;
}

export function clearStoredRefCode(): void {
  try {
    localStorage.removeItem(REF_CODE_KEY);
  } catch {
    /* ignore */
  }
  try {
    document.cookie = `${REF_CODE_KEY}=;path=/;max-age=0;SameSite=Lax`;
  } catch {
    /* ignore */
  }
}

export function adLinkUrl(code: string): string {
  return `${window.location.origin}/ref/${code}`;
}
