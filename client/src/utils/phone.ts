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
