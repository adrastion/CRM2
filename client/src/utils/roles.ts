/**
 * Роли школьного кабинета — единые проверки для UI.
 *
 * OWNER — полный доступ, в т.ч. отмена финансовых операций и управление подпиской.
 * ADMIN — операционное управление; финансы доступны, кроме отмены операций;
 *         может создавать только тренеров (не других администраторов).
 * TRAINER — ограниченный доступ к своим разделам.
 * Старший тренер — TRAINER с seniorBranchIds: права ≈ ADMIN в рамках своих филиалов.
 */

import type { User } from '../types';

export type SchoolRole = 'OWNER' | 'ADMIN' | 'TRAINER';

export function isOwner(role?: string | null): boolean {
  return role === 'OWNER';
}

export function isOwnerOrAdmin(role?: string | null): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}

export function isSeniorTrainerUser(user?: Pick<User, 'role' | 'isSeniorTrainer' | 'seniorBranchIds'> | null): boolean {
  if (!user || user.role !== 'TRAINER') return false;
  if (user.isSeniorTrainer) return true;
  return Array.isArray(user.seniorBranchIds) && user.seniorBranchIds.length > 0;
}

/** OWNER/ADMIN или старший тренер (доступ к admin-разделам с ограничением по филиалу). */
export function canAccessAdminNav(user?: Pick<User, 'role' | 'isSeniorTrainer' | 'seniorBranchIds'> | null): boolean {
  return isOwnerOrAdmin(user?.role) || isSeniorTrainerUser(user);
}

export function canAssignSeniorTrainer(user?: Pick<User, 'role'> | null): boolean {
  return isOwnerOrAdmin(user?.role);
}

export function canCreateBranches(user?: Pick<User, 'role'> | null): boolean {
  return isOwnerOrAdmin(user?.role);
}

export function canManageBranchUi(
  user: Pick<User, 'role' | 'isSeniorTrainer' | 'seniorBranchIds'> | null | undefined,
  branchId: string
): boolean {
  if (isOwnerOrAdmin(user?.role)) return true;
  if (!isSeniorTrainerUser(user)) return false;
  return (user?.seniorBranchIds || []).includes(branchId);
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

/** Редактирование QR и ссылок оплаты. */
export function canEditPaymentMethods(role?: string | null): boolean {
  return isOwner(role);
}

/** Подтверждение чеков об оплате. */
export function canConfirmPaymentReceipts(role?: string | null): boolean {
  return isOwnerOrAdmin(role);
}
