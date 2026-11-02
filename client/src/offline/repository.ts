import {
  entityKey,
  getOfflineDb,
  type CachedEntity,
  type OfflineEntityKind,
  type OutboxMutation,
} from './db';

export async function putEntities(
  tenantKey: string,
  kind: OfflineEntityKind,
  items: Array<{ id: string; payload: unknown }>
): Promise<void> {
  const db = await getOfflineDb();
  const tx = db.transaction('entities', 'readwrite');
  const now = new Date().toISOString();
  await Promise.all(
    items.map((item) =>
      tx.store.put({
        id: entityKey(kind, item.id),
        kind,
        payload: item.payload,
        updatedAt: now,
        tenantKey,
      } satisfies CachedEntity)
    )
  );
  await tx.done;
}

export async function listEntities<T = unknown>(
  tenantKey: string,
  kind: OfflineEntityKind
): Promise<T[]> {
  const db = await getOfflineDb();
  const rows = await db.getAllFromIndex('entities', 'by-kind-tenant', [kind, tenantKey]);
  return rows.map((r) => r.payload as T);
}

export async function enqueueMutation(
  mutation: Omit<OutboxMutation, 'id' | 'createdAt' | 'attempts'>
): Promise<OutboxMutation> {
  const db = await getOfflineDb();
  const row: OutboxMutation = {
    ...mutation,
    id: `out_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    createdAt: new Date().toISOString(),
    attempts: 0,
  };
  await db.put('outbox', row);
  return row;
}

export async function listOutbox(): Promise<OutboxMutation[]> {
  const db = await getOfflineDb();
  return db.getAll('outbox');
}

export async function removeOutbox(id: string): Promise<void> {
  const db = await getOfflineDb();
  await db.delete('outbox', id);
}

export async function bumpOutboxError(id: string, error: string): Promise<void> {
  const db = await getOfflineDb();
  const row = await db.get('outbox', id);
  if (!row) return;
  row.attempts += 1;
  row.lastError = error;
  await db.put('outbox', row);
}

export async function setMeta(key: string, value: string): Promise<void> {
  const db = await getOfflineDb();
  await db.put('meta', { key, value });
}

export async function getMeta(key: string): Promise<string | null> {
  const db = await getOfflineDb();
  const row = await db.get('meta', key);
  return row?.value ?? null;
}

export async function pendingOutboxCount(): Promise<number> {
  const db = await getOfflineDb();
  return (await db.getAllKeys('outbox')).length;
}
