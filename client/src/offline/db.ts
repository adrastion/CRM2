import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export type OfflineEntityKind = 'training' | 'attendance' | 'contact';

export type OutboxMutation = {
  id: string;
  kind: OfflineEntityKind;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  body?: unknown;
  createdAt: string;
  attempts: number;
  lastError?: string;
};

export type CachedEntity = {
  id: string;
  kind: OfflineEntityKind;
  payload: unknown;
  updatedAt: string;
  tenantKey: string;
};

interface OfflineDb extends DBSchema {
  entities: {
    key: string;
    value: CachedEntity;
    indexes: { 'by-kind-tenant': [string, string]; 'by-tenant': string };
  };
  outbox: {
    key: string;
    value: OutboxMutation;
  };
  meta: {
    key: string;
    value: { key: string; value: string };
  };
}

const DB_NAME = 'profsport-offline-v1';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<OfflineDb>> | null = null;

export function getOfflineDb() {
  if (!dbPromise) {
    dbPromise = openDB<OfflineDb>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const entities = db.createObjectStore('entities', { keyPath: 'id' });
        entities.createIndex('by-kind-tenant', ['kind', 'tenantKey']);
        entities.createIndex('by-tenant', 'tenantKey');
        db.createObjectStore('outbox', { keyPath: 'id' });
        db.createObjectStore('meta', { keyPath: 'key' });
      },
    });
  }
  return dbPromise;
}

export function entityKey(kind: OfflineEntityKind, id: string) {
  return `${kind}:${id}`;
}
