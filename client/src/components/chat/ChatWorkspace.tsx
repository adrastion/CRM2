import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  TextField,
  Typography,
  Badge,
} from '@mui/material';
import { Send } from '@mui/icons-material';
import { apiService } from '../../services/api';
import { useChatSocket, ChatSocketMessage } from '../../hooks/useChatSocket';
import { dispatchChatUnreadRefresh } from '../../hooks/useChatUnreadBadge';
import { colors, radii } from '../../theme/tokens';

export type PresenceStatus = 'unregistered' | 'offline' | 'online';

export interface ChatThreadItem {
  id: string | null;
  type: string;
  threadKey: string;
  title: string;
  subtitle: string;
  clientId: string | null;
  trainerId: string | null;
  groupId: string | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
  presenceStatus?: PresenceStatus | null;
  ensurePayload: {
    type: string;
    clientId?: string;
    trainerId?: string;
    groupId?: string;
  };
}

export interface ChatMessageItem {
  id: string;
  threadId: string;
  body: string;
  authorType: string;
  authorClientId?: string | null;
  authorParentId?: string | null;
  authorUserId?: string | null;
  authorSuperAdminId?: string | null;
  authorTesterId?: string | null;
  authorName: string;
  createdAt: string;
}

interface ChatWorkspaceProps {
  mode: 'staff' | 'client' | 'platform';
  /** JWT for socket (staff / client / SA / tester token). */
  socketToken: string | null;
  /** Current user id for aligning own bubbles. */
  self: {
    kind: 'USER' | 'CLIENT' | 'PARENT' | 'SUPER_ADMIN' | 'TESTER';
    id: string;
  };
}

const PRESENCE_LABEL: Record<PresenceStatus, string> = {
  unregistered: 'Не зарегистрирован',
  offline: 'Не в сети',
  online: 'В сети',
};

const PRESENCE_COLOR: Record<PresenceStatus, string> = {
  unregistered: '#9e9e9e',
  offline: '#bdbdbd',
  online: '#2e7d32',
};

function PresenceDot({ status }: { status: PresenceStatus }) {
  return (
    <Box
      component="span"
      title={PRESENCE_LABEL[status]}
      sx={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        bgcolor: PRESENCE_COLOR[status],
        display: 'inline-block',
        flexShrink: 0,
      }}
    />
  );
}

/**
 * Двухколоночный UI чатов: список бесед + лента.
 */
const ChatWorkspace: React.FC<ChatWorkspaceProps> = ({ mode, socketToken, self }) => {
  const [threads, setThreads] = useState<ChatThreadItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [error, setError] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const selectedRef = useRef<ChatThreadItem | null>(null);

  const loadThreads = useCallback(async () => {
    setLoadingList(true);
    setError('');
    try {
      const data =
        mode === 'staff'
          ? await apiService.listChatThreads()
          : mode === 'client'
            ? await apiService.clientListChatThreads()
            : await apiService.listPlatformChatThreads();
      setThreads(data || []);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось загрузить чаты');
    } finally {
      setLoadingList(false);
    }
  }, [mode]);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  useEffect(() => {
    selectedRef.current = threads.find((t) => t.threadKey === selectedKey) || null;
  }, [threads, selectedKey]);

  const filteredThreads = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((t) => {
      const hay = [t.title, t.subtitle, t.lastMessagePreview || ''].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [threads, search]);

  const openThread = async (item: ChatThreadItem) => {
    setSelectedKey(item.threadKey);
    setLoadingMessages(true);
    setMessages([]);
    try {
      let threadId = item.id;
      if (!threadId) {
        const ensured =
          mode === 'staff'
            ? await apiService.ensureChatThread(item.ensurePayload)
            : mode === 'client'
              ? await apiService.clientEnsureChatThread(item.ensurePayload)
              : await apiService.ensurePlatformChatThread(item.ensurePayload);
        threadId = ensured.id;
        setThreads((prev) =>
          prev.map((t) => (t.threadKey === item.threadKey ? { ...t, id: threadId } : t))
        );
      }
      setActiveThreadId(threadId);
      const data =
        mode === 'staff'
          ? await apiService.getChatMessages(threadId!)
          : mode === 'client'
            ? await apiService.clientGetChatMessages(threadId!)
            : await apiService.getPlatformChatMessages(threadId!);
      setMessages(data.messages || []);
      if (mode === 'staff') await apiService.markChatRead(threadId!);
      else if (mode === 'client') await apiService.clientMarkChatRead(threadId!);
      else await apiService.markPlatformChatRead(threadId!);
      setThreads((prev) =>
        prev.map((t) => (t.threadKey === item.threadKey ? { ...t, unreadCount: 0 } : t))
      );
      if (mode === 'staff' || mode === 'client') dispatchChatUnreadRefresh();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось открыть чат');
    } finally {
      setLoadingMessages(false);
    }
  };

  const onSocketMessage = useCallback(
    (msg: ChatSocketMessage) => {
      if (msg.threadId !== activeThreadId) {
        setThreads((prev) =>
          prev.map((t) =>
            t.id === msg.threadId
              ? {
                  ...t,
                  lastMessageAt: msg.createdAt,
                  lastMessagePreview: msg.body,
                  unreadCount: t.unreadCount + 1,
                }
              : t
          )
        );
        return;
      }
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [
          ...prev,
          {
            id: msg.id,
            threadId: msg.threadId,
            body: msg.body,
            authorType: msg.authorType,
            authorClientId: msg.authorClientId,
            authorParentId: msg.authorParentId,
            authorUserId: msg.authorUserId,
            authorSuperAdminId: msg.authorSuperAdminId,
            authorTesterId: msg.authorTesterId,
            authorName: msg.authorName,
            createdAt: msg.createdAt,
          },
        ];
      });
      setThreads((prev) =>
        prev.map((t) =>
          t.id === msg.threadId
            ? { ...t, lastMessageAt: msg.createdAt, lastMessagePreview: msg.body }
            : t
        )
      );
    },
    [activeThreadId]
  );

  useChatSocket({
    token: socketToken,
    threadId: activeThreadId,
    enabled: Boolean(socketToken),
    onMessage: onSocketMessage,
    onPresence: () => {
      // Обновить статусы без полного лоадера
      (async () => {
        try {
          const data =
            mode === 'staff'
              ? await apiService.listChatThreads()
              : mode === 'client'
                ? await apiService.clientListChatThreads()
                : await apiService.listPlatformChatThreads();
          setThreads((prev) => {
            const byKey = new Map((data || []).map((t: ChatThreadItem) => [t.threadKey, t]));
            return prev.map((t) => {
              const fresh = byKey.get(t.threadKey);
              return fresh
                ? { ...t, presenceStatus: fresh.presenceStatus, unreadCount: fresh.unreadCount }
                : t;
            });
          });
        } catch {
          /* ignore */
        }
      })();
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const isOwn = (m: ChatMessageItem) => {
    if (self.kind === 'USER') return m.authorType === 'USER' && m.authorUserId === self.id;
    if (self.kind === 'CLIENT') return m.authorType === 'CLIENT' && m.authorClientId === self.id;
    if (self.kind === 'PARENT') return m.authorType === 'PARENT' && m.authorParentId === self.id;
    if (self.kind === 'SUPER_ADMIN') {
      return m.authorType === 'SUPER_ADMIN' && m.authorSuperAdminId === self.id;
    }
    return m.authorType === 'TESTER' && m.authorTesterId === self.id;
  };

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || !activeThreadId || sending) return;
    setSending(true);
    try {
      const msg =
        mode === 'staff'
          ? await apiService.sendChatMessage(activeThreadId, text)
          : mode === 'client'
            ? await apiService.clientSendChatMessage(activeThreadId, text)
            : await apiService.sendPlatformChatMessage(activeThreadId, text);
      setDraft('');
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      setThreads((prev) =>
        prev.map((t) =>
          t.id === activeThreadId
            ? { ...t, lastMessageAt: msg.createdAt, lastMessagePreview: msg.body }
            : t
        )
      );
      if (mode === 'staff' || mode === 'client') dispatchChatUnreadRefresh();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось отправить');
    } finally {
      setSending(false);
    }
  };

  const selected = threads.find((t) => t.threadKey === selectedKey);

  return (
    <Box
      sx={{
        display: 'flex',
        height: { xs: 'calc(100vh - 160px)', md: 'calc(100vh - 140px)' },
        minHeight: 420,
        border: `1px solid ${colors.border}`,
        borderRadius: `${radii.panel}px`,
        overflow: 'hidden',
        bgcolor: 'background.paper',
        position: 'relative',
      }}
    >
      <Box
        sx={{
          width: { xs: selected ? 0 : '100%', sm: 320 },
          display: { xs: selected ? 'none' : 'flex', sm: 'flex' },
          flexDirection: 'column',
          borderRight: '1px solid',
          borderColor: 'divider',
          minWidth: { sm: 280 },
        }}
      >
        <Box sx={{ p: 1.5 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Поиск"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Box>
        <Divider />
        {loadingList ? (
          <Box display="flex" justifyContent="center" p={3}>
            <CircularProgress size={28} />
          </Box>
        ) : (
          <List dense sx={{ overflow: 'auto', flex: 1 }}>
            {filteredThreads.length === 0 ? (
              <Typography color="text.secondary" sx={{ p: 2 }}>
                Нет доступных бесед
              </Typography>
            ) : (
              filteredThreads.map((t) => (
                <ListItemButton
                  key={t.threadKey}
                  selected={t.threadKey === selectedKey}
                  onClick={() => openThread(t)}
                >
                  <ListItemText
                    primary={
                      <Box display="flex" alignItems="center" gap={1}>
                        {t.presenceStatus ? <PresenceDot status={t.presenceStatus} /> : null}
                        <Typography fontWeight={t.unreadCount ? 700 : 500} noWrap>
                          {t.title}
                        </Typography>
                        {t.unreadCount > 0 && (
                          <Badge badgeContent={t.unreadCount} color="primary" />
                        )}
                      </Box>
                    }
                    secondary={
                      <>
                        <Typography variant="caption" color="text.secondary" display="block">
                          {t.presenceStatus
                            ? `${PRESENCE_LABEL[t.presenceStatus]} · ${t.subtitle}`
                            : t.subtitle}
                        </Typography>
                        {t.lastMessagePreview && (
                          <Typography variant="body2" noWrap color="text.secondary">
                            {t.lastMessagePreview}
                          </Typography>
                        )}
                      </>
                    }
                  />
                </ListItemButton>
              ))
            )}
          </List>
        )}
      </Box>

      <Box
        sx={{
          flex: 1,
          display: { xs: selected ? 'flex' : 'none', sm: 'flex' },
          flexDirection: 'column',
          minWidth: 0,
        }}
      >
        {!selected ? (
          <Box flex={1} display="flex" alignItems="center" justifyContent="center" p={3}>
            <Typography color="text.secondary">Выберите беседу</Typography>
          </Box>
        ) : (
          <>
            <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Button
                size="small"
                sx={{ display: { sm: 'none' }, mb: 1 }}
                onClick={() => {
                  setSelectedKey(null);
                  setActiveThreadId(null);
                  setMessages([]);
                }}
              >
                ← К списку
              </Button>
              <Box display="flex" alignItems="center" gap={1}>
                {selected.presenceStatus ? <PresenceDot status={selected.presenceStatus} /> : null}
                <Typography fontWeight={700}>{selected.title}</Typography>
              </Box>
              <Typography variant="caption" color="text.secondary">
                {selected.presenceStatus
                  ? `${PRESENCE_LABEL[selected.presenceStatus]} · ${selected.subtitle}`
                  : selected.subtitle}
              </Typography>
            </Box>

            <Box sx={{ flex: 1, overflow: 'auto', p: 2, bgcolor: 'grey.50' }}>
              {loadingMessages ? (
                <Box display="flex" justifyContent="center" p={3}>
                  <CircularProgress size={28} />
                </Box>
              ) : (
                messages.map((m) => {
                  const own = isOwn(m);
                  return (
                    <Box
                      key={m.id}
                      sx={{
                        display: 'flex',
                        justifyContent: own ? 'flex-end' : 'flex-start',
                        mb: 1.5,
                      }}
                    >
                      <Box
                        sx={{
                          maxWidth: '75%',
                          px: 1.5,
                          py: 1,
                          borderRadius: 2,
                          bgcolor: own ? 'primary.main' : 'background.paper',
                          color: own ? 'primary.contrastText' : 'text.primary',
                          boxShadow: 1,
                        }}
                      >
                        {!own && (
                          <Typography variant="caption" sx={{ opacity: 0.85, display: 'block' }}>
                            {m.authorName}
                            {m.authorType === 'PARENT' ? ' (родитель)' : ''}
                          </Typography>
                        )}
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                          {m.body}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{ opacity: 0.7, display: 'block', mt: 0.5, textAlign: 'right' }}
                        >
                          {new Date(m.createdAt).toLocaleString('ru-RU', {
                            hour: '2-digit',
                            minute: '2-digit',
                            day: '2-digit',
                            month: '2-digit',
                          })}
                        </Typography>
                      </Box>
                    </Box>
                  );
                })
              )}
              <div ref={bottomRef} />
            </Box>

            <Box sx={{ p: 1.5, display: 'flex', gap: 1, borderTop: '1px solid', borderColor: 'divider' }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Сообщение…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                multiline
                maxRows={4}
                disabled={sending || !activeThreadId}
              />
              <Button
                variant="contained"
                onClick={handleSend}
                disabled={sending || !draft.trim() || !activeThreadId}
                sx={{ minWidth: 48 }}
              >
                {sending ? <CircularProgress size={20} color="inherit" /> : <Send />}
              </Button>
            </Box>
          </>
        )}
      </Box>

      {error && (
        <Chip
          label={error}
          color="error"
          onDelete={() => setError('')}
          sx={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)' }}
        />
      )}
    </Box>
  );
};

export default ChatWorkspace;
