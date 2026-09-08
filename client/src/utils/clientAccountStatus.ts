import { Client, GroupMembership } from '../types';

export type ClientAccountStatusKey = 'lead' | 'unregistered' | 'pending' | 'registered';

export function hasPermanentGroup(client: Client): boolean {
  return (client.groupMemberships || []).some(
    (gm: GroupMembership) => gm.isActive && !gm.isTrial
  );
}

export function getClientAccountStatus(client: Client): ClientAccountStatusKey {
  if (!hasPermanentGroup(client)) return 'lead';
  if (!client.hasPassword) return 'unregistered';
  if (!client.isAccountApproved) return 'pending';
  return 'registered';
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
