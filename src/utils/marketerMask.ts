/** Маскирование ПДн для кабинета маркетолога */

export function maskName(value?: string | null): string | null {
  if (!value || !value.trim()) return null;
  const t = value.trim();
  if (t.length <= 1) return '*';
  return `${t[0]}***`;
}

export function maskEmail(value?: string | null): string | null {
  if (!value || !value.trim()) return null;
  const t = value.trim();
  const at = t.indexOf('@');
  if (at <= 0) return '***@***.***';
  return `${t[0]}***@***.***`;
}

export function maskPhone(value?: string | null): string | null {
  if (!value || !value.trim()) return null;
  const digits = value.replace(/\D/g, '');
  if (digits.length < 4) return '+***';
  return `+***${digits.slice(-4)}`;
}

export function schoolLabelFromId(tenantId: string): string {
  const short = tenantId.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase() || 'XXXXXX';
  return `Школа #${short}`;
}

export function makeLeadDisplayCode(): string {
  const part = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `L-${part}`;
}
