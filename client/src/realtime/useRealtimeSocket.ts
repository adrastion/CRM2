import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { getWsBaseUrl } from '../utils/getWsBaseUrl';
import { dispatchRealtimeEvent } from './dispatch';
import type { RealtimeEvent } from './types';
import { resolveRealtimeToken } from './resolveRealtimeToken';

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
      if (payload?.entity) dispatchRealtimeEvent(payload);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [enabled, explicitToken]);
}
