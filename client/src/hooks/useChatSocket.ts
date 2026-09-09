import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { getWsBaseUrl } from '../utils/getWsBaseUrl';

export interface ChatSocketMessage {
  id: string;
  threadId: string;
  tenantId: string | null;
  body: string;
  authorType: string;
  authorClientId: string | null;
  authorParentId: string | null;
  authorUserId: string | null;
  authorSuperAdminId?: string | null;
  authorTesterId?: string | null;
  authorName: string;
  createdAt: string;
  editedAt?: string | null;
}

/**
 * Подключение к namespace /chat. При смене threadId — leave/join.
 */
export function useChatSocket(opts: {
  token: string | null;
  threadId: string | null;
  enabled?: boolean;
  onMessage: (msg: ChatSocketMessage) => void;
  onMessageUpdated?: (msg: ChatSocketMessage) => void;
  onPresence?: (payload: { key: string; online: boolean }) => void;
}): void {
  const { token, threadId, enabled = true, onMessage, onMessageUpdated, onPresence } = opts;
  const socketRef = useRef<Socket | null>(null);
  const onMessageRef = useRef(onMessage);
  const onMessageUpdatedRef = useRef(onMessageUpdated);
  const onPresenceRef = useRef(onPresence);
  onMessageRef.current = onMessage;
  onMessageUpdatedRef.current = onMessageUpdated;
  onPresenceRef.current = onPresence;
  const joinedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !token) return;

    const socket = io(`${getWsBaseUrl()}/chat`, {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('chat:message', (payload: ChatSocketMessage) => {
      onMessageRef.current(payload);
    });

    socket.on('chat:message:updated', (payload: ChatSocketMessage) => {
      onMessageUpdatedRef.current?.(payload);
    });

    socket.on('chat:presence', (payload: { key: string; online: boolean }) => {
      onPresenceRef.current?.(payload);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      joinedRef.current = null;
    };
  }, [token, enabled]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !enabled) return;

    const leavePrev = () => {
      if (joinedRef.current) {
        socket.emit('chat:leave', joinedRef.current);
        joinedRef.current = null;
      }
    };

    if (!threadId) {
      leavePrev();
      return;
    }

    const join = () => {
      leavePrev();
      socket.emit('chat:join', threadId, (r: { ok: boolean }) => {
        if (r?.ok) joinedRef.current = threadId;
      });
    };

    if (socket.connected) join();
    else socket.once('connect', join);

    return () => {
      leavePrev();
    };
  }, [threadId, enabled, token]);
}
