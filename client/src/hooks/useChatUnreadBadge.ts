import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { getWsBaseUrl } from '../utils/getWsBaseUrl';
import { apiService } from '../services/api';

export const CHAT_UNREAD_REFRESH_EVENT = 'chat:unread-refresh';

/**
 * Суммарный unread для бейджа в сайдбаре.
 * Начальный снимок с API + live `chat:unread` из personal room.
 */
export function useChatUnreadBadge(opts: {
  mode: 'staff' | 'client';
  token: string | null;
  enabled?: boolean;
}): number {
  const { mode, token, enabled = true } = opts;
  const [total, setTotal] = useState(0);
  const socketRef = useRef<Socket | null>(null);

  const refetch = useCallback(async () => {
    if (!token || !enabled) {
      setTotal(0);
      return;
    }
    try {
      const data =
        mode === 'staff'
          ? await apiService.getChatUnreadTotal()
          : await apiService.clientGetChatUnreadTotal();
      setTotal(Math.max(0, Number(data?.total) || 0));
    } catch {
      /* ignore */
    }
  }, [mode, token, enabled]);

  useEffect(() => {
    if (!enabled || !token) {
      setTotal(0);
      return;
    }
    void refetch();
  }, [enabled, token, refetch]);

  useEffect(() => {
    if (!enabled || !token) return;

    const socket = io(`${getWsBaseUrl()}/chat`, {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('chat:unread', (payload: { threadId?: string; unreadDelta?: number }) => {
      const delta = Number(payload?.unreadDelta) || 0;
      if (delta !== 0) {
        setTotal((t) => Math.max(0, t + delta));
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, enabled]);

  useEffect(() => {
    if (!enabled) return;
    const onRefresh = () => {
      void refetch();
    };
    const onFocus = () => {
      void refetch();
    };
    window.addEventListener(CHAT_UNREAD_REFRESH_EVENT, onRefresh);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener(CHAT_UNREAD_REFRESH_EVENT, onRefresh);
      window.removeEventListener('focus', onFocus);
    };
  }, [enabled, refetch]);

  return total;
}

export function dispatchChatUnreadRefresh(): void {
  window.dispatchEvent(new Event(CHAT_UNREAD_REFRESH_EVENT));
}
