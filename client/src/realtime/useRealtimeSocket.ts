import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { getWsBaseUrl } from '../utils/getWsBaseUrl';
import { dispatchRealtimeEvent } from './dispatch';
import type { RealtimeEvent } from './types';
import { resolveRealtimeToken } from './resolveRealtimeToken';
import { isNativeApp } from '../capacitor/platform';
import { showLocalNotification } from '../capacitor/localNotify';

function maybeLocalNotify(payload: RealtimeEvent): void {
  if (!isNativeApp()) return;
  // Только когда экран не в фокусе — иначе шум
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') return;

  if (payload.entity === 'notifications') {
    const title =
      (typeof payload.meta?.title === 'string' && payload.meta.title) || 'Уведомление';
    const body = typeof payload.meta?.body === 'string' ? payload.meta.body : undefined;
    const path = typeof payload.meta?.url === 'string' ? payload.meta.url : undefined;
    void showLocalNotification({ title, body, path });
    return;
  }
  if (payload.entity === 'chat') {
    void showLocalNotification({
      title: 'Новое сообщение',
      body: typeof payload.meta?.preview === 'string' ? String(payload.meta.preview) : undefined,
      path: '/chats',
    });
  }
}

/**
 * Держит одно соединение /realtime и прокидывает события в window bus.
 */
export function useRealtimeSocket(opts?: {
  token?: string | null;
  enabled?: boolean;
}): void {
  const enabled = opts?.enabled !== false;
  const explicitToken = opts?.token;
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const token =
      explicitToken !== undefined ? explicitToken : resolveRealtimeToken();
    if (!token) return;

    const socket = io(`${getWsBaseUrl()}/realtime`, {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000,
    });
    socketRef.current = socket;

    socket.on('realtime:event', (payload: RealtimeEvent) => {
      if (payload?.entity) {
        dispatchRealtimeEvent(payload);
        maybeLocalNotify(payload);
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [enabled, explicitToken]);
}
