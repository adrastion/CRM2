/** Presence для namespace /chat: presenceKey → set of socket ids. */

const presence = new Map<string, Set<string>>();

export function presenceKeyUser(userId: string): string {
  return `USER:${userId}`;
}

export function presenceKeyClient(clientId: string): string {
  return `CLIENT:${clientId}`;
}

export function presenceKeyParent(parentId: string): string {
  return `PARENT:${parentId}`;
}

export function presenceKeySuperAdmin(id: string): string {
  return `SUPER_ADMIN:${id}`;
}

export function presenceKeyTester(id: string): string {
  return `TESTER:${id}`;
}

export function markPresenceOnline(key: string, socketId: string): void {
  let set = presence.get(key);
  if (!set) {
    set = new Set();
    presence.set(key, set);
  }
  set.add(socketId);
}

export function markPresenceOffline(key: string, socketId: string): void {
  const set = presence.get(key);
  if (!set) return;
  set.delete(socketId);
  if (set.size === 0) presence.delete(key);
}

export function isPresenceOnline(key: string): boolean {
  const set = presence.get(key);
  return Boolean(set && set.size > 0);
}

export type PresenceStatus = 'unregistered' | 'offline' | 'online';

export function statusFromOnline(online: boolean): PresenceStatus {
  return online ? 'online' : 'offline';
}
