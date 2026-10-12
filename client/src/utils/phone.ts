/** Оставляет только цифры. */
export function onlyDigits(raw: string): string {
  return (raw || '').replace(/\D/g, '');
}

/**
 * Приводит номер к виду +7XXXXXXXXXX, если это возможно.
 * Принимает маски: 8 (999) 123-45-67, +7-999-..., 89991234567.
 */
export function normalizePhone(raw: string): string {
  const digits = onlyDigits(raw);
  if (digits.length === 11 && (digits.startsWith('7') || digits.startsWith('8'))) {
    return `+7${digits.slice(1)}`;
  }
  if (digits.length === 10) {
    return `+7${digits}`;
  }
  return digits ? `+${digits}` : '';
}

/**
 * Маска телефона при вводе: +7 (999) 999-99-99.
 * Поддерживает вставку 8…, 7…, +7…, со скобками и пробелами.
 */
export function maskPhoneInput(raw: string): string {
  const digits = onlyDigits(raw);
  const body = digits.startsWith('7') || digits.startsWith('8') ? digits.slice(1) : digits;
  const d = body.slice(0, 10);
  if (!d) return digits.startsWith('7') || digits.startsWith('8') || raw.trim().startsWith('+') ? '+7' : '';
  let out = '+7';
  if (d.length > 0) out += ` (${d.slice(0, 3)}`;
  if (d.length >= 3) out += ')';
  if (d.length > 3) out += ` ${d.slice(3, 6)}`;
  if (d.length > 6) out += `-${d.slice(6, 8)}`;
  if (d.length > 8) out += `-${d.slice(8, 10)}`;
  return out;
}

/**
 * Значение поля «email или телефон»: email как есть (lowercase),
 * иначе — маска телефона.
 */
export function formatContactInput(raw: string): string {
  const value = raw || '';
  if (value.includes('@') || /[a-zA-Zа-яА-ЯёЁ]/.test(value)) {
    return value.includes('@') ? value.toLowerCase() : value;
  }
  return maskPhoneInput(value);
}

const PHONE_HINT =
  'Введите корректный номер телефона (например: +7 999 123-45-67 или 8 (999) 123-45-67)';

/**
 * Валидация после нормализации. Возвращает текст ошибки или null.
 */
export function validatePhone(phone: string, required: boolean = false): string | null {
  if (!phone || phone.trim() === '') {
    if (required) {
      return 'Телефон обязателен для заполнения';
    }
    return null;
  }
  const normalized = normalizePhone(phone);
  if (/^\+7\d{10}$/.test(normalized)) return null;
  const digitCount = onlyDigits(normalized).length;
  if (/^\+[1-9]\d{7,14}$/.test(normalized) && digitCount >= 8) return null;
  return PHONE_HINT;
}
