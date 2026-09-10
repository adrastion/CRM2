/**
 * Хелперы для логов без PII.
 */

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /(?:\+?\d[\d\s\-()]{7,}\d)/g;
const JWT_RE = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
const BEARER_RE = /Bearer\s+[A-Za-z0-9._\-]+/gi;

const SENSITIVE_KEYS = new Set([
  'password',
  'currentpassword',
  'newpassword',
  'token',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'secret',
  'jwt',
  'cookie',
]);

export function redactString(input: string): string {
  return input
    .replace(BEARER_RE, 'Bearer [REDACTED]')
    .replace(JWT_RE, '[REDACTED_JWT]')
    .replace(EMAIL_RE, '[REDACTED_EMAIL]')
    .replace(PHONE_RE, '[REDACTED_PHONE]');
}

export function redactValue(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[Truncated]';
  if (value == null) return value;
  if (typeof value === 'string') return redactString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map((v) => redactValue(v, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(k.toLowerCase())) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = redactValue(v, depth + 1);
      }
    }
    return out;
  }
  return String(value);
}

export function safeLog(...args: unknown[]): void {
  const cleaned = args.map((a) =>
    typeof a === 'string' ? redactString(a) : redactValue(a)
  );
  console.log(...cleaned);
}

export function safeError(...args: unknown[]): void {
  const cleaned = args.map((a) =>
    typeof a === 'string' ? redactString(a) : redactValue(a)
  );
  console.error(...cleaned);
}
