import { Network } from '@capacitor/network';
import { getApiBaseUrl, isNativeApp } from '../capacitor/platform';
import {
  bumpOutboxError,
  enqueueMutation,
  listEntities,
  listOutbox,
  pendingOutboxCount,
  putEntities,
  removeOutbox,
  setMeta,
} from './repository';

export type OfflineStatus = {
  online: boolean;
  pending: number;
  lastSyncAt: string | null;
};

type Listener = (s: OfflineStatus) => void;

const listeners = new Set<Listener>();
let status: OfflineStatus = { online: typeof navigator !== 'undefined' ? navigator.onLine : true, pending: 0, lastSyncAt: null };
let flushing = false;

function emit() {
  listeners.forEach((l) => l(status));
}

export function subscribeOfflineStatus(listener: Listener): () => void {
  listeners.add(listener);
  listener(status);
  return () => listeners.delete(listener);
}

export function getOfflineStatus(): OfflineStatus {
  return status;
}

async function refreshPending() {
  status = { ...status, pending: await pendingOutboxCount() };
  emit();
}

function authHeaders(): HeadersInit {
  const token =
    localStorage.getItem('superAdminToken') ||
    localStorage.getItem('token') ||
    localStorage.getItem('clientToken') ||
    '';
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function tenantKey(): string {
  return (
    localStorage.getItem('tenantId') ||
    localStorage.getItem('currentTenantId') ||
    'default'
  );
}

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getApiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`, {
    ...init,
    headers: { ...authHeaders(), ...(init?.headers || {}) },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function asList(raw: unknown): any[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') {
    const m = raw as Record<string, unknown>;
    for (const k of ['items', 'rows', 'results', 'data', 'trainings', 'clients', 'trainers']) {
      if (Array.isArray(m[k])) return m[k] as any[];
    }
    if (Array.isArray((m.data as any)?.items)) return (m.data as any).items;
  }
  return [];
}

/** Pull calendar + contacts into IndexedDB */
export async function pullOfflineSnapshots(): Promise<void> {
  if (!status.online) return;
  const key = tenantKey();
  try {
    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - 14);
    const to = new Date(now);
    to.setDate(to.getDate() + 21);
    const q = `from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`;

    const [trainingsRes, clientsRes, trainersRes] = await Promise.allSettled([
      apiJson<any>(`/trainings?${q}`),
      apiJson<any>('/clients?limit=500'),
      apiJson<any>('/trainers'),
    ]);

    if (trainingsRes.status === 'fulfilled') {
      const list = asList(trainingsRes.value?.data ?? trainingsRes.value);
      await putEntities(
        key,
        'training',
        list
          .filter((t) => t?.id)
          .map((t) => ({ id: String(t.id), payload: t }))
      );
    }

    if (clientsRes.status === 'fulfilled') {
      const list = asList(clientsRes.value?.data ?? clientsRes.value);
      await putEntities(
        key,
        'contact',
        list
          .filter((c) => c?.id)
          .map((c) => ({
            id: `client:${c.id}`,
            payload: { ...c, contactKind: 'client' },
          }))
      );
    }

    if (trainersRes.status === 'fulfilled') {
      const list = asList(trainersRes.value?.data ?? trainersRes.value);
      await putEntities(
        key,
        'contact',
        list
          .filter((t) => t?.id)
          .map((t) => ({
            id: `trainer:${t.id}`,
            payload: { ...t, contactKind: 'trainer' },
          }))
      );
    }

    const ts = new Date().toISOString();
    await setMeta('lastSyncAt', ts);
    status = { ...status, lastSyncAt: ts };
    emit();
  } catch (e) {
    console.warn('[offline] pull failed', e);
  }
}

/** Flush outbox (attendance writes etc.) */
export async function flushOutbox(): Promise<void> {
  if (!status.online || flushing) return;
  flushing = true;
  try {
    const items = await listOutbox();
    for (const item of items) {
      try {
        await apiJson(item.path, {
          method: item.method,
          body: item.body != null ? JSON.stringify(item.body) : undefined,
        });
        await removeOutbox(item.id);
      } catch (e: any) {
        await bumpOutboxError(item.id, e?.message || String(e));
      }
    }
    await refreshPending();
  } finally {
    flushing = false;
  }
}

export async function queueAttendanceMark(input: {
  trainingId: string;
  clientId: string;
  status: string;
  path?: string;
  method?: 'POST' | 'PUT' | 'PATCH';
  body?: Record<string, unknown>;
}): Promise<void> {
  const path = input.path || '/attendances';
  const method = input.method || 'POST';
  const body = input.body || {
    trainingId: input.trainingId,
    clientId: input.clientId,
    status: input.status,
  };

  // Optimistic local cache row
  const key = tenantKey();
  await putEntities(key, 'attendance', [
    {
      id: `${input.trainingId}:${input.clientId}`,
      payload: { ...body, queuedAt: new Date().toISOString() },
    },
  ]);

  await enqueueMutation({
    kind: 'attendance',
    method,
    path,
    body,
  });
  await refreshPending();

  if (status.online) {
    void flushOutbox();
  }
}

export async function getCachedTrainings<T = unknown>(): Promise<T[]> {
  return listEntities<T>(tenantKey(), 'training');
}

export async function getCachedContacts<T = unknown>(): Promise<T[]> {
  return listEntities<T>(tenantKey(), 'contact');
}

export async function getCachedAttendances<T = unknown>(): Promise<T[]> {
  return listEntities<T>(tenantKey(), 'attendance');
}

let offlineLayerInitialized = false;

export async function initOfflineLayer(): Promise<void> {
  if (offlineLayerInitialized) return;
  offlineLayerInitialized = true;

  const updateOnline = async (online: boolean) => {
    status = { ...status, online };
    emit();
    if (online) {
      await flushOutbox();
      await pullOfflineSnapshots();
    }
  };

  if (isNativeApp()) {
    try {
      const n = await Network.getStatus();
      await updateOnline(n.connected);
      Network.addListener('networkStatusChange', (s) => {
        void updateOnline(s.connected);
      });
    } catch {
      window.addEventListener('online', () => void updateOnline(true));
      window.addEventListener('offline', () => void updateOnline(false));
    }
  } else {
    window.addEventListener('online', () => void updateOnline(true));
    window.addEventListener('offline', () => void updateOnline(false));
    await updateOnline(navigator.onLine);
  }

  await refreshPending();
  if (status.online) {
    void pullOfflineSnapshots();
  }
}
