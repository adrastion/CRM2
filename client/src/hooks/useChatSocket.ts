import { useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { acquireChatSocket, releaseChatSocket } from './chatSocketShared';

export interface ChatSocketMessage {
  id: string;
  threadId: string;
  tenantId: string | null;
  kind?: string;
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
  replyToMessageId?: string | null;
  replyTo?: {
    id: string;
    body: string;
    kind: string;
    authorName: string;
  } | null;
  attachments?: Array<{
    id: string;
    kind: string;
    mimeType: string;
    originalName: string;
    sizeBytes: number;
    durationMs: number | null;
    width: number | null;
    height: number | null;
  }>;
  mentions?: Array<{ type: string; id: string; name?: string }>;
  pinned?: boolean;
  deleted?: boolean;
  deletedAt?: string | null;
  readBy?: Array<{ type: string; id: string; name?: string; readAt: string }>;
  readByPeer?: boolean;
}

/**
 * Подключение к namespace /chat. При смене threadId — leave/join.
 * Использует общий socket с бейджем непрочитанных.
 */
export function useChatSocket(opts: {
  token: string | null;
  threadId: string | null;
  enabled?: boolean;
  onMessage: (msg: ChatSocketMessage) => void;
  onMessageUpdated?: (msg: ChatSocketMessage) => void;
  onPresence?: (payload: { key: string; online: boolean }) => void;
  onPin?: (payload: { threadId: string; messageId: string; pinned: boolean }) => void;
  onRead?: (payload: {
    threadId: string;
    readerType: string;
    readerId: string;
    lastReadAt: string;
  }) => void;
  onThreadActivity?: (payload: { threadId: string }) => void;
}): void {
  const {
    token,
    threadId,
    enabled = true,
    onMessage,
    onMessageUpdated,
    onPresence,
    onPin,
    onRead,
    onThreadActivity,
  } = opts;
  const socketRef = useRef<Socket | null>(null);
  const onMessageRef = useRef(onMessage);
  const onMessageUpdatedRef = useRef(onMessageUpdated);
  const onPresenceRef = useRef(onPresence);
  const onPinRef = useRef(onPin);
  const onReadRef = useRef(onRead);
  const onThreadActivityRef = useRef(onThreadActivity);
  onMessageRef.current = onMessage;
  onMessageUpdatedRef.current = onMessageUpdated;
  onPresenceRef.current = onPresence;
  onPinRef.current = onPin;
  onReadRef.current = onRead;
  onThreadActivityRef.current = onThreadActivity;
  const joinedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !token) return;

    const socket = acquireChatSocket(token);
    socketRef.current = socket;

    const onMsg = (payload: ChatSocketMessage) => onMessageRef.current(payload);
    const onMsgUpdated = (payload: ChatSocketMessage) => onMessageUpdatedRef.current?.(payload);
    const onPresenceEvt = (payload: { key: string; online: boolean }) =>
      onPresenceRef.current?.(payload);
    const onPinEvt = (payload: { threadId: string; messageId: string; pinned: boolean }) =>
      onPinRef.current?.(payload);
    const onReadEvt = (payload: {
      threadId: string;
      readerType: string;
      readerId: string;
      lastReadAt: string;
    }) => onReadRef.current?.(payload);
    const onActivity = (payload: { threadId: string }) => onThreadActivityRef.current?.(payload);

    socket.on('chat:message', onMsg);
    socket.on('chat:message:updated', onMsgUpdated);
    socket.on('chat:presence', onPresenceEvt);
    socket.on('chat:pin', onPinEvt);
    socket.on('chat:read', onReadEvt);
    socket.on('chat:thread-activity', onActivity);

    return () => {
      socket.off('chat:message', onMsg);
      socket.off('chat:message:updated', onMsgUpdated);
      socket.off('chat:presence', onPresenceEvt);
      socket.off('chat:pin', onPinEvt);
      socket.off('chat:read', onReadEvt);
      socket.off('chat:thread-activity', onActivity);
      releaseChatSocket(socket);
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
      socket.off('connect', join);
      leavePrev();
    };
  }, [threadId, enabled, token]);
}
