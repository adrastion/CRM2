export type RealtimeEntity =
  | 'clients'
  | 'finance'
  | 'notifications'
  | 'mobile-apk'
  | 'chat'
  | 'trainings'
  | 'groups'
  | 'memberships';

export type RealtimeEvent = {
  entity: RealtimeEntity;
  action: 'created' | 'updated' | 'deleted' | 'changed' | 'uploaded' | 'removed';
  tenantId?: string | null;
  id?: string;
  meta?: Record<string, unknown>;
  at: string;
};

export const REALTIME_EVENT = 'crm:realtime';
