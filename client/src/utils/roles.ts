/**
 * Роли школьного кабинета — единые проверки для UI.
 *
 * OWNER — полный доступ, в т.ч. отмена финансовых операций и управление подпиской.
 * ADMIN — операционное управление; финансы доступны, кроме отмены операций;
 *         может создавать только тренеров (не других администраторов).
 * TRAINER — ограниченный доступ к своим разделам.
 */

export type SchoolRole = 'OWNER' | 'ADMIN' | 'TRAINER';

export function isOwner(role?: string | null): boolean {
  return role === 'OWNER';
}

export function isOwnerOrAdmin(role?: string | null): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}

/** Отмена / удаление операций в «Финансы → Все операции». */
export function canCancelFinanceOperations(role?: string | null): boolean {
  return isOwner(role);
}

/** Оплата и смена тарифа школы. */
export function canManageSubscription(role?: string | null): boolean {
  return isOwner(role);
}

/** Создание учётных записей администраторов. */
export function canCreateAdminUsers(role?: string | null): boolean {
  return isOwner(role);
}

/** Школьные финансовые настройки (день зарплаты, сброс членских). */
export function canEditSchoolFinanceSettings(role?: string | null): boolean {
  return isOwner(role);
}
