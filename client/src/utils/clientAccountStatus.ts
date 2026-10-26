import { Client, GroupMembership } from '../types';

export type ClientAccountStatusKey = 'lead' | 'unregistered' | 'pending' | 'registered';

export function hasPermanentGroup(client: Client): boolean {
  return (client.groupMemberships || []).some(
    (gm: GroupMembership) => gm.isActive && !gm.isTrial
  );
}

/**
 * Статус личного кабинета (колонка «Аккаунт»).
 * Не зависит от группы: «лид без группы» раньше ошибочно показывался
 * как «Не зарегистрирован», хотя пароль уже создан.
 */
export function getClientAccountStatus(client: Client): ClientAccountStatusKey {
  if (!client.hasPassword) return 'unregistered';
  if (!client.isAccountApproved) return 'pending';
  return 'registered';
}

/** Лид воронки: нет постоянной группы (отдельно от статуса ЛК). */
export function isClientLead(client: Client): boolean {
  return !hasPermanentGroup(client);
}

export function clientAccountStatusLabel(status: ClientAccountStatusKey): string {
  switch (status) {
    case 'lead':
      return 'Лид';
    case 'unregistered':
      return 'Не зарегистрирован';
    case 'pending':
      return 'Ожидает подтверждения';
    case 'registered':
      return 'Зарегистрирован';
  }
}
