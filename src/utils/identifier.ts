/**
 * Утилиты для работы с единым идентификатором входа (телефон ИЛИ email).
 *
 * Единая авторизация принимает одно поле, в которое пользователь вводит либо
 * номер телефона, либо адрес электронной почты. Здесь собрана вся логика
 * определения типа и нормализации, чтобы поиск по разным таблицам был
 * консистентным.
 */

export type IdentifierType = 'phone' | 'email';

/** Минимальное количество цифр, которое мы считаем номером телефона. */
const MIN_PHONE_DIGITS = 10;

/** Сколько последних цифр используем для сравнения номеров. */
export const PHONE_TAIL_LENGTH = 10;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Определяет, что ввёл пользователь: телефон или email.
 * Возвращает null, если значение не похоже ни на то, ни на другое.
 */
export function detectIdentifierType(raw: string): IdentifierType | null {
  const value = (raw || '').trim();
  if (!value) return null;

  if (value.includes('@')) {
    return EMAIL_REGEX.test(value) ? 'email' : null;
  }

  const digits = onlyDigits(value);
  if (digits.length >= MIN_PHONE_DIGITS && /^[\d\s()+\-.]+$/.test(value)) {
    return 'phone';
  }

  return null;
}

/** Оставляет только цифры. */
export function onlyDigits(raw: string): string {
  return (raw || '').replace(/\D/g, '');
}

export function normalizeEmail(raw: string): string {
  return (raw || '').trim().toLowerCase();
}

/**
 * Последние N цифр номера — устойчивое к формату представление.
 * +7 (999) 123-45-67, 79991234567 и 89991234567 дают один и тот же хвост.
 */
export function phoneTail(raw: string, length: number = PHONE_TAIL_LENGTH): string {
  const digits = onlyDigits(raw);
  return digits.length <= length ? digits : digits.slice(-length);
}

/** Приводит номер к виду +7XXXXXXXXXX, если это возможно. */
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

/** Форматирует номер для отображения: +7 (999) 123-45-67 */
export function formatPhoneForDisplay(raw: string): string {
  const digits = onlyDigits(raw);
  const tail = digits.length >= 10 ? digits.slice(-10) : '';
  if (!tail) return raw;
  return `+7 (${tail.slice(0, 3)}) ${tail.slice(3, 6)}-${tail.slice(6, 8)}-${tail.slice(8, 10)}`;
}

/** Два номера считаются одинаковыми, если совпадают последние 10 цифр. */
export function isSamePhone(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  const ta = phoneTail(a);
  const tb = phoneTail(b);
  return ta.length === PHONE_TAIL_LENGTH && ta === tb;
}

/**
 * Нормализует идентификатор в зависимости от его типа.
 * Для телефона возвращает +7XXXXXXXXXX, для email — lowercase.
 */
export function normalizeIdentifier(raw: string, type: IdentifierType): string {
  return type === 'email' ? normalizeEmail(raw) : normalizePhone(raw);
}
