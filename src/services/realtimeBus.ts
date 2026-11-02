import type { Namespace } from 'socket.io';

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

let nsp: Namespace | null = null;

export function setRealtimeNamespace(namespace: Namespace): void {
  nsp = namespace;
}

export function tenantRoom(tenantId: string): string {
  return `rt:tenant:${tenantId}`;
}

export function platformRoom(): string {
  return 'rt:platform';
}

export function actorRoom(actorType: string, actorId: string): string {
  return `rt:actor:${actorType}:${actorId}`;
}

/** Событие всем сокетам школы */
export function emitTenantRealtime(
  tenantId: string | null | undefined,
  event: Omit<RealtimeEvent, 'at' | 'tenantId'> & { tenantId?: string | null }
): void {
  if (!nsp || !tenantId) return;
  const payload: RealtimeEvent = {
    ...event,
    tenantId,
    at: new Date().toISOString(),
  };
  nsp.to(tenantRoom(tenantId)).emit('realtime:event', payload);
}

/** Платформенные события (SA) */
export function emitPlatformRealtime(
  event: Omit<RealtimeEvent, 'at'>
): void {
  if (!nsp) return;
  const payload: RealtimeEvent = {
    ...event,
    at: new Date().toISOString(),
  };
  nsp.to(platformRoom()).emit('realtime:event', payload);
}

/** Точечно акторам (колокольчик) */
export function emitActorRealtime(
  actors: Array<{ actorType: string; actorId: string }>,
  event: Omit<RealtimeEvent, 'at'>
): void {
  if (!nsp || actors.length === 0) return;
  const payload: RealtimeEvent = {
    ...event,
    at: new Date().toISOString(),
  };
  const seen = new Set<string>();
  for (const a of actors) {
    const key = `${a.actorType}:${a.actorId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    nsp.to(actorRoom(a.actorType, a.actorId)).emit('realtime:event', payload);
  }
}
