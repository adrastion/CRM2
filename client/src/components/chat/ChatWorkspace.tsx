import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Avatar,
  Box,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List as MuiList,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  Popover,
  TextField,
  Typography,
} from '@mui/material';
import {
  ArrowBack,
  AttachFile,
  Close,
  Done,
  DoneAll,
  Edit,
  EmojiEmotions,
  MoreVert,
  People,
  PushPin,
  Reply,
  Send,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import { apiService } from '../../services/api';
import { useChatSocket, ChatSocketMessage } from '../../hooks/useChatSocket';
import { dispatchChatUnreadRefresh } from '../../hooks/useChatUnreadBadge';
import { colors, radii, typography } from '../../theme/tokens';
import ChatMediaBubble from './ChatMediaBubble';
import ChatVoiceRecorder from './ChatVoiceRecorder';
import {
  chatInitials,
  chatTheme,
  dayKey,
  formatChatListTime,
  formatChatTime,
  formatDaySeparator,
} from './chatTheme';
import {
  encodeMentionsForSend,
  extractMentionsFromText,
  formatMentionsForDisplay,
  MentionRef,
  pruneMentionsToDisplay,
  renderMentionNodes,
  renderMentionPlain,
} from './chatMentionUtils';

const CHAT_MSG_PAGE = 50;
/** Intrinsic size hint for content-visibility virtualization of off-screen bubbles. */
const CHAT_MSG_ROW_EST = 96;

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
  staffTaskId?: string | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
  presenceStatus?: PresenceStatus | null;
  ensurePayload: {
    type: string;
    clientId?: string;
    trainerId?: string;
    groupId?: string;
    staffTaskId?: string;
  };
}

export interface ChatMessageItem {
  id: string;
  threadId: string;
  kind?: string;
  body: string;
  authorType: string;
  authorClientId?: string | null;
  authorParentId?: string | null;
  authorUserId?: string | null;
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
    deleted?: boolean;
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

type ChatParticipant = {
  type: string;
  id: string;
  name: string;
  roleLabel: string;
};

type ChatPinItem = {
  messageId: string;
  pinnedAt: string;
  body: string;
  kind: string;
};

type ChatCategory = 'all' | 'personal' | 'groups' | 'tasks';

const PERSONAL_TYPES = new Set(['CLIENT_ADMIN', 'CLIENT_TRAINER', 'TRAINER_ADMIN']);
const GROUP_TYPES = new Set(['GROUP', 'TRAINERS']);
const TASK_TYPES = new Set(['STAFF_TASK']);

function isPersonalThread(type: string): boolean {
  return PERSONAL_TYPES.has(type);
}

function hasConversation(t: ChatThreadItem): boolean {
  return Boolean(t.lastMessageAt || (t.lastMessagePreview && t.lastMessagePreview.trim()));
}

function matchesCategory(type: string, category: ChatCategory): boolean {
  if (category === 'all') return true;
  if (category === 'personal') return PERSONAL_TYPES.has(type);
  if (category === 'groups') return GROUP_TYPES.has(type);
  if (category === 'tasks') return TASK_TYPES.has(type);
  return true;
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
  /** Открыть тред после загрузки списка (например ?threadId=). */
  initialThreadId?: string | null;
  /** Открыть/создать тред по ensure (кнопка чата с персоналом в ЛК). */
  initialEnsurePayload?: {
    type: string;
    clientId?: string;
    trainerId?: string;
    groupId?: string;
  } | null;
  /** На xs — на всю высоту экрана без нижней навигации кабинета. */
  immersiveMobile?: boolean;
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

const EMOJI_LIST = [
  '😀', '😁', '😂', '🤣', '😊', '😍', '😘', '😜', '🤔', '😎',
  '😢', '😭', '😡', '👍', '👎', '👏', '🙏', '🔥', '💪', '✅',
  '❌', '⭐', '🎉', '❤️', '💙', '💚', '💛', '💜', '🤝', '👋',
  '🏆', '🥇', '⚽', '🏀', '🥊', '🏋️', '🏃', '🎯', '📌', '💬',
];

/** 0 = без ограничения */
function isWithinEditWindow(createdAt: string, limitMinutes: number, nowMs: number): boolean {
  if (!limitMinutes || limitMinutes <= 0) return true;
  return nowMs <= new Date(createdAt).getTime() + limitMinutes * 60_000;
}

function PresenceDot({ status, size = 8 }: { status: PresenceStatus; size?: number }) {
  return (
    <Box
      component="span"
      title={PRESENCE_LABEL[status]}
      sx={{
        width: size,
        height: size,
        borderRadius: '50%',
        bgcolor: PRESENCE_COLOR[status],
        display: 'inline-block',
        flexShrink: 0,
        boxShadow: '0 0 0 2px #fff',
      }}
    />
  );
}

function ChatAvatar({ title, size = 44 }: { title: string; size?: number }) {
  return (
    <Avatar
      sx={{
        width: size,
        height: size,
        bgcolor: chatTheme.avatarBg,
        color: chatTheme.avatarText,
        fontSize: size > 40 ? 15 : 13,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {chatInitials(title)}
    </Avatar>
  );
}

function previewLabel(kind: string | undefined, body: string): string {
  const caption = formatMentionsForDisplay(String(body || '').trim());
  if (kind === 'IMAGE') return caption ? `Фото: ${caption}` : 'Фото';
  if (kind === 'VIDEO') return caption ? `Видео: ${caption}` : 'Видео';
  if (kind === 'VOICE') return caption ? `Голосовое: ${caption}` : 'Голосовое сообщение';
  return caption || '';
}

function socketToItem(msg: ChatSocketMessage): ChatMessageItem {
  return {
    id: msg.id,
    threadId: msg.threadId,
    kind: msg.kind || 'TEXT',
    body: msg.body,
    authorType: msg.authorType,
    authorClientId: msg.authorClientId,
    authorParentId: msg.authorParentId,
    authorUserId: msg.authorUserId,
    authorSuperAdminId: msg.authorSuperAdminId,
    authorTesterId: msg.authorTesterId,
    authorName: msg.authorName,
    createdAt: msg.createdAt,
    editedAt: msg.editedAt ?? null,
    replyToMessageId: msg.replyToMessageId ?? null,
    replyTo: msg.replyTo ?? null,
    attachments: msg.attachments || [],
    mentions: msg.mentions || [],
    pinned: Boolean(msg.pinned),
    deleted: Boolean(msg.deleted),
    deletedAt: msg.deletedAt ?? null,
    readBy: msg.readBy || [],
    readByPeer: Boolean(msg.readByPeer),
  };
}

/**
 * Двухколоночный UI чатов: список бесед + лента.
 */
const ChatWorkspace: React.FC<ChatWorkspaceProps> = ({
  mode,
  socketToken,
  self,
  initialThreadId,
  initialEnsurePayload = null,
  immersiveMobile = false,
}) => {
  const [threads, setThreads] = useState<ChatThreadItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [error, setError] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const loadingOlderRef = useRef(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLimitMinutes, setEditLimitMinutes] = useState(0);
  const [deleteLimitMinutes, setDeleteLimitMinutes] = useState(0);
  const [canViewDeleted, setCanViewDeleted] = useState(false);
  const [showDeletedContent, setShowDeletedContent] = useState(false);
  const [readByDialog, setReadByDialog] = useState<ChatMessageItem | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<ChatCategory>('all');
  const [emojiAnchor, setEmojiAnchor] = useState<HTMLElement | null>(null);
  const [replyTo, setReplyTo] = useState<ChatMessageItem | null>(null);
  const [pins, setPins] = useState<ChatPinItem[]>([]);
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [participants, setParticipants] = useState<ChatParticipant[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [activeMentions, setActiveMentions] = useState<MentionRef[]>([]);
  const [menuAnchor, setMenuAnchor] = useState<{ el: HTMLElement; msg: ChatMessageItem } | null>(
    null
  );
  const [recorderBusy, setRecorderBusy] = useState(false);
  const feedRef = useRef<HTMLDivElement | null>(null);
  const recordOverlayRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const selectedRef = useRef<ChatThreadItem | null>(null);
  const nearBottomRef = useRef(true);
  const pendingOpenScrollRef = useRef(false);
  const prevMessagesLenRef = useRef(0);
  const canViewDeletedRef = useRef(false);
  const activeThreadIdRef = useRef<string | null>(null);

  const scrollStorageKey = (threadId: string) => `crm-chat-scroll:${threadId}`;

  const persistFeedScroll = useCallback((threadId: string | null) => {
    const el = feedRef.current;
    if (!threadId || !el) return;
    const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = gap < 120;
    nearBottomRef.current = nearBottom;
    try {
      sessionStorage.setItem(
        scrollStorageKey(threadId),
        JSON.stringify({
          scrollTop: el.scrollTop,
          nearBottom,
          at: Date.now(),
        })
      );
    } catch {
      /* ignore quota */
    }
  }, []);

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
    if (mode === 'platform') {
      setEditLimitMinutes(0);
      return;
    }
    const timer = window.setInterval(() => setNowTick(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [mode]);

  useEffect(() => {
    selectedRef.current = threads.find((t) => t.threadKey === selectedKey) || null;
  }, [threads, selectedKey]);

  const showTasksTab = mode === 'staff' || threads.some((t) => TASK_TYPES.has(t.type));

  const categoryTabs = useMemo(() => {
    const tabs: Array<{ id: ChatCategory; label: string }> = [
      { id: 'all', label: 'Все' },
      { id: 'personal', label: 'Личные' },
      { id: 'groups', label: 'Группы' },
    ];
    if (showTasksTab) tabs.push({ id: 'tasks', label: 'Задачи' });
    return tabs;
  }, [showTasksTab]);

  useEffect(() => {
    if (category === 'tasks' && !showTasksTab) setCategory('all');
  }, [category, showTasksTab]);

  const filteredThreads = useMemo(() => {
    const q = search.trim().toLowerCase();
    const searching = Boolean(q);

    return threads.filter((t) => {
      if (!matchesCategory(t.type, category)) return false;

      if (searching) {
        const hay = [t.title, t.subtitle, t.lastMessagePreview || ''].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
        return true;
      }

      // Без поиска: в «Все» и «Личные» скрываем только личные без переписки.
      // Группы (GROUP / TRAINERS) и задачи всегда остаются в списке.
      if ((category === 'all' || category === 'personal') && isPersonalThread(t.type) && !hasConversation(t)) {
        return false;
      }

      return true;
    });
  }, [threads, search, category]);

  const cancelEdit = () => {
    setEditingId(null);
    setDraft('');
    setActiveMentions([]);
  };

  const openThread = async (item: ChatThreadItem) => {
    persistFeedScroll(activeThreadIdRef.current);
    cancelEdit();
    setReplyTo(null);
    setActiveMentions([]);
    setSelectedKey(item.threadKey);
    setLoadingMessages(true);
    setMessages([]);
    setPins([]);
    pendingOpenScrollRef.current = true;
    prevMessagesLenRef.current = 0;
    nearBottomRef.current = true;
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
        setThreads((prev) => {
          const idx = prev.findIndex((t) => t.threadKey === item.threadKey);
          if (idx >= 0) {
            return prev.map((t) => (t.threadKey === item.threadKey ? { ...t, id: threadId } : t));
          }
          return [
            {
              ...item,
              id: threadId,
              title: item.title || 'Чат',
            },
            ...prev,
          ];
        });
      }
      setActiveThreadId(threadId);
      activeThreadIdRef.current = threadId;
      const pageParams = { limit: CHAT_MSG_PAGE };
      const data =
        mode === 'staff'
          ? await apiService.getChatMessages(threadId!, pageParams)
          : mode === 'client'
            ? await apiService.clientGetChatMessages(threadId!, pageParams)
            : await apiService.getPlatformChatMessages(threadId!, pageParams);
      const viewDeleted = Boolean(data.canViewDeleted);
      setCanViewDeleted(viewDeleted);
      canViewDeletedRef.current = viewDeleted;
      const incoming = (data.messages || []) as ChatMessageItem[];
      const visible = viewDeleted ? incoming : incoming.filter((m) => !m.deleted);
      setMessages(visible);
      setHasMoreMessages(Boolean(data.hasMore) || incoming.length >= CHAT_MSG_PAGE);
      setPins(
        viewDeleted
          ? data.pins || []
          : (data.pins || []).filter((p: { deleted?: boolean }) => !p.deleted)
      );
      if (typeof data.chatMessageEditLimitMinutes === 'number') {
        setEditLimitMinutes(data.chatMessageEditLimitMinutes);
      } else if (mode === 'platform') {
        setEditLimitMinutes(0);
      }
      if (typeof data.chatMessageDeleteLimitMinutes === 'number') {
        setDeleteLimitMinutes(data.chatMessageDeleteLimitMinutes);
      }
      if (mode === 'staff') await apiService.markChatRead(threadId!);
      else if (mode === 'client') await apiService.clientMarkChatRead(threadId!);
      else await apiService.markPlatformChatRead(threadId!);
      setThreads((prev) =>
        prev.map((t) => (t.threadKey === item.threadKey ? { ...t, unreadCount: 0 } : t))
      );
      if (mode === 'staff' || mode === 'client') dispatchChatUnreadRefresh();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось открыть чат');
      setHasMoreMessages(false);
      pendingOpenScrollRef.current = false;
    } finally {
      setLoadingMessages(false);
    }
  };

  const loadOlderMessages = useCallback(async () => {
    if (!activeThreadId || !hasMoreMessages || loadingOlderRef.current) return;
    const oldest = messages[0];
    if (!oldest?.id) return;
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    const el = feedRef.current;
    const prevHeight = el?.scrollHeight || 0;
    const prevTop = el?.scrollTop || 0;
    try {
      const pageParams = { limit: CHAT_MSG_PAGE, before: oldest.id };
      const data =
        mode === 'staff'
          ? await apiService.getChatMessages(activeThreadId, pageParams)
          : mode === 'client'
            ? await apiService.clientGetChatMessages(activeThreadId, pageParams)
            : await apiService.getPlatformChatMessages(activeThreadId, pageParams);
      const incoming = (data.messages || []) as ChatMessageItem[];
      const visible = canViewDeletedRef.current
        ? incoming
        : incoming.filter((m) => !m.deleted);
      if (!visible.length) {
        setHasMoreMessages(false);
        return;
      }
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        const older = visible.filter((m) => !seen.has(m.id));
        return older.length ? [...older, ...prev] : prev;
      });
      setHasMoreMessages(Boolean(data.hasMore) || incoming.length >= CHAT_MSG_PAGE);
      requestAnimationFrame(() => {
        const feed = feedRef.current;
        if (!feed) return;
        feed.scrollTop = prevTop + (feed.scrollHeight - prevHeight);
      });
    } catch {
      /* ignore */
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  }, [activeThreadId, hasMoreMessages, messages, mode]);

  const initialOpenedRef = useRef(false);
  useEffect(() => {
    if (initialOpenedRef.current || loadingList) return;

    if (initialThreadId && threads.length) {
      const target = threads.find((t) => t.id === initialThreadId);
      if (target) {
        initialOpenedRef.current = true;
        void openThread(target);
        return;
      }
    }

    if (initialEnsurePayload) {
      const byEnsure = threads.find(
        (t) =>
          t.type === initialEnsurePayload.type &&
          (initialEnsurePayload.trainerId
            ? t.trainerId === initialEnsurePayload.trainerId
            : true) &&
          (initialEnsurePayload.clientId ? t.clientId === initialEnsurePayload.clientId : true) &&
          (initialEnsurePayload.groupId ? t.groupId === initialEnsurePayload.groupId : true)
      );
      if (byEnsure) {
        initialOpenedRef.current = true;
        void openThread(byEnsure);
        return;
      }
      // Треда ещё нет в списке (например, тренер вне групп) — создаём и открываем.
      initialOpenedRef.current = true;
      void openThread({
        id: null,
        type: initialEnsurePayload.type,
        threadKey: `ensure:${initialEnsurePayload.type}:${initialEnsurePayload.trainerId || ''}:${initialEnsurePayload.clientId || ''}`,
        title: 'Чат',
        subtitle: '',
        clientId: initialEnsurePayload.clientId || null,
        trainerId: initialEnsurePayload.trainerId || null,
        groupId: initialEnsurePayload.groupId || null,
        staffTaskId: null,
        lastMessageAt: null,
        lastMessagePreview: null,
        unreadCount: 0,
        ensurePayload: initialEnsurePayload,
        presenceStatus: null,
      });
    }
  }, [initialThreadId, initialEnsurePayload, loadingList, threads]);

  const onSocketMessage = useCallback(
    (msg: ChatSocketMessage) => {
      const preview = previewLabel(msg.kind, msg.body);
      if (msg.threadId !== activeThreadId) {
        setThreads((prev) =>
          prev.map((t) =>
            t.id === msg.threadId
              ? {
                  ...t,
                  lastMessageAt: msg.createdAt,
                  lastMessagePreview: preview,
                  unreadCount: t.unreadCount + 1,
                }
              : t
          )
        );
        return;
      }
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, socketToItem(msg)];
      });
      setThreads((prev) =>
        prev.map((t) =>
          t.id === msg.threadId
            ? { ...t, lastMessageAt: msg.createdAt, lastMessagePreview: preview }
            : t
        )
      );
    },
    [activeThreadId]
  );

  const onSocketMessageUpdated = useCallback(
    (msg: ChatSocketMessage) => {
      const preview = msg.deleted
        ? 'Сообщение удалено'
        : previewLabel(msg.kind, msg.body);
      setMessages((prev) => {
        if (msg.threadId !== activeThreadId) return prev;
        if (msg.deleted && !canViewDeletedRef.current) {
          return prev.filter((m) => m.id !== msg.id);
        }
        return prev.map((m) => (m.id === msg.id ? { ...m, ...socketToItem(msg) } : m));
      });
      if (msg.deleted && !canViewDeletedRef.current) {
        setPins((prev) => prev.filter((p) => p.messageId !== msg.id));
      }
      setThreads((prev) =>
        prev.map((t) => {
          if (t.id !== msg.threadId) return t;
          const isLatestPreview =
            !t.lastMessageAt ||
            new Date(msg.createdAt).getTime() >= new Date(t.lastMessageAt).getTime();
          return isLatestPreview ? { ...t, lastMessagePreview: preview } : t;
        })
      );
    },
    [activeThreadId]
  );

  useChatSocket({
    token: socketToken,
    threadId: activeThreadId,
    enabled: Boolean(socketToken),
    onMessage: onSocketMessage,
    onMessageUpdated: onSocketMessageUpdated,
    onPin: (payload) => {
      if (payload.threadId !== activeThreadId) return;
      setMessages((prev) => {
        const target = prev.find((m) => m.id === payload.messageId);
        if (payload.pinned && target) {
          setPins((pinsPrev) => [
            {
              messageId: target.id,
              pinnedAt: new Date().toISOString(),
              body: previewLabel(target.kind, target.body),
              kind: target.kind || 'TEXT',
            },
            ...pinsPrev.filter((p) => p.messageId !== target.id),
          ]);
        } else if (!payload.pinned) {
          setPins((pinsPrev) => pinsPrev.filter((p) => p.messageId !== payload.messageId));
        }
        return prev.map((m) =>
          m.id === payload.messageId ? { ...m, pinned: payload.pinned } : m
        );
      });
    },
    onRead: (payload) => {
      if (payload.threadId !== activeThreadId) return;
      const readAtMs = new Date(payload.lastReadAt).getTime();
      setMessages((prev) =>
        prev.map((m) => {
          if (!isOwn(m) || m.deleted) return m;
          if (new Date(m.createdAt).getTime() > readAtMs) return m;
          const key = `${payload.readerType}:${payload.readerId}`;
          const already = (m.readBy || []).some((r) => `${r.type}:${r.id}` === key);
          if (already) return m;
          const readBy = [
            ...(m.readBy || []),
            {
              type: payload.readerType,
              id: payload.readerId,
              readAt: payload.lastReadAt,
            },
          ];
          return { ...m, readBy, readByPeer: true };
        })
      );
    },
    onPresence: () => {
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

  useLayoutEffect(() => {
    if (loadingMessages) return;
    const el = feedRef.current;
    if (!el) return;

    if (pendingOpenScrollRef.current) {
      pendingOpenScrollRef.current = false;
      prevMessagesLenRef.current = messages.length;
      let restored = false;
      if (activeThreadId) {
        try {
          const raw = sessionStorage.getItem(scrollStorageKey(activeThreadId));
          if (raw) {
            const saved = JSON.parse(raw) as { scrollTop?: number; nearBottom?: boolean };
            if (saved.nearBottom !== false) {
              el.scrollTop = el.scrollHeight;
              nearBottomRef.current = true;
            } else if (typeof saved.scrollTop === 'number') {
              el.scrollTop = saved.scrollTop;
              nearBottomRef.current = false;
              restored = true;
            }
          }
        } catch {
          /* ignore */
        }
      }
      if (!restored) {
        el.scrollTop = el.scrollHeight;
        nearBottomRef.current = true;
      }
      return;
    }

    const grew = messages.length > prevMessagesLenRef.current;
    prevMessagesLenRef.current = messages.length;
    if (grew && nearBottomRef.current) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, loadingMessages, activeThreadId]);

  useEffect(() => {
    activeThreadIdRef.current = activeThreadId;
  }, [activeThreadId]);

  useEffect(() => {
    canViewDeletedRef.current = canViewDeleted;
  }, [canViewDeleted]);

  useEffect(() => {
    if (!editingId) return;
    const msg = messages.find((m) => m.id === editingId);
    if (msg && !isWithinEditWindow(msg.createdAt, editLimitMinutes, nowTick)) {
      cancelEdit();
      setError(
        editLimitMinutes > 0
          ? `Время редактирования истекло (${editLimitMinutes} мин.)`
          : 'Редактирование недоступно'
      );
    }
  }, [nowTick, editingId, messages, editLimitMinutes]);

  const isOwn = (m: ChatMessageItem) => {
    if (self.kind === 'USER') return m.authorType === 'USER' && m.authorUserId === self.id;
    if (self.kind === 'CLIENT') return m.authorType === 'CLIENT' && m.authorClientId === self.id;
    if (self.kind === 'PARENT') return m.authorType === 'PARENT' && m.authorParentId === self.id;
    if (self.kind === 'SUPER_ADMIN') {
      return m.authorType === 'SUPER_ADMIN' && m.authorSuperAdminId === self.id;
    }
    return m.authorType === 'TESTER' && m.authorTesterId === self.id;
  };

  const startEdit = (m: ChatMessageItem) => {
    if (!isWithinEditWindow(m.createdAt, editLimitMinutes, Date.now())) {
      setError(
        editLimitMinutes > 0
          ? `Редактирование доступно ${editLimitMinutes} мин. после отправки`
          : 'Редактирование недоступно'
      );
      return;
    }
    setEditingId(m.id);
    setDraft(renderMentionPlain(m.body));
    setActiveMentions(extractMentionsFromText(m.body));
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const insertEmoji = (emoji: string) => {
    const el = inputRef.current;
    if (el && typeof el.selectionStart === 'number') {
      const start = el.selectionStart;
      const end = el.selectionEnd ?? start;
      const next = draft.slice(0, start) + emoji + draft.slice(end);
      setDraft(next);
      setTimeout(() => {
        const pos = start + emoji.length;
        el.focus();
        el.setSelectionRange(pos, pos);
      }, 0);
    } else {
      setDraft((prev) => prev + emoji);
    }
    setEmojiAnchor(null);
  };

  const appendOutgoing = (msg: ChatMessageItem) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev;
      return [...prev, msg];
    });
    setThreads((prev) =>
      prev.map((t) =>
        t.id === activeThreadId
          ? {
              ...t,
              lastMessageAt: msg.createdAt,
              lastMessagePreview: previewLabel(msg.kind, msg.body),
            }
          : t
      )
    );
  };

  const handleSend = async () => {
    const display = draft.trim();
    if (!display || !activeThreadId || sending) return;
    const { body: text, mentions } = encodeMentionsForSend(display, activeMentions);
    setSending(true);
    try {
      if (editingId) {
        const msg =
          mode === 'staff'
            ? await apiService.editChatMessage(activeThreadId, editingId, text)
            : mode === 'client'
              ? await apiService.clientEditChatMessage(activeThreadId, editingId, text)
              : await apiService.editPlatformChatMessage(activeThreadId, editingId, text);
        setMessages((prev) => {
          const next = prev.map((m) =>
            m.id === msg.id
              ? {
                  ...m,
                  body: msg.body,
                  editedAt: msg.editedAt ?? null,
                }
              : m
          );
          const last = next[next.length - 1];
          if (last?.id === msg.id) {
            setThreads((threadsPrev) =>
              threadsPrev.map((t) =>
                t.id === activeThreadId
                  ? { ...t, lastMessagePreview: previewLabel(msg.kind, msg.body) }
                  : t
              )
            );
          }
          return next;
        });
        cancelEdit();
      } else {
        const payload = {
          body: text,
          replyToMessageId: replyTo?.id || null,
          mentions: mentions.map((m) => ({ type: m.type, id: m.id })),
        };
        const msg =
          mode === 'staff'
            ? await apiService.sendChatMessage(activeThreadId, payload)
            : mode === 'client'
              ? await apiService.clientSendChatMessage(activeThreadId, payload)
              : await apiService.sendPlatformChatMessage(activeThreadId, payload);
        setDraft('');
        setActiveMentions([]);
        setReplyTo(null);
        setMentionQuery(null);
        appendOutgoing(msg);
        if (mode === 'staff' || mode === 'client') dispatchChatUnreadRefresh();
      }
    } catch (e: any) {
      setError(e?.response?.data?.error || (editingId ? 'Не удалось сохранить' : 'Не удалось отправить'));
    } finally {
      setSending(false);
    }
  };

  const uploadMediaFile = async (
    file: File,
    kind?: 'image' | 'video' | 'voice',
    durationMs?: number | null
  ) => {
    if (!activeThreadId || sending) return;
    setSending(true);
    try {
      const display = draft.trim();
      const encoded = display
        ? encodeMentionsForSend(display, activeMentions)
        : { body: '', mentions: [] as MentionRef[] };
      const data = {
        file,
        kind,
        caption: encoded.body || undefined,
        replyToMessageId: replyTo?.id || null,
        mentions: encoded.mentions.map((m) => ({ type: m.type, id: m.id })),
        durationMs,
      };
      const msg =
        mode === 'staff'
          ? await apiService.sendChatMedia(activeThreadId, data)
          : mode === 'client'
            ? await apiService.clientSendChatMedia(activeThreadId, data)
            : await apiService.sendPlatformChatMedia(activeThreadId, data);
      setDraft('');
      setActiveMentions([]);
      setReplyTo(null);
      appendOutgoing(msg);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось отправить медиа');
    } finally {
      setSending(false);
    }
  };

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const mime = file.type || '';
    const kind = mime.startsWith('image/')
      ? 'image'
      : mime.startsWith('video/')
        ? 'video'
        : undefined;
    await uploadMediaFile(file, kind);
  };

  const openParticipants = async () => {
    if (!activeThreadId) return;
    setParticipantsOpen(true);
    try {
      const list =
        mode === 'staff'
          ? await apiService.getChatParticipants(activeThreadId)
          : mode === 'client'
            ? await apiService.clientGetChatParticipants(activeThreadId)
            : await apiService.getPlatformChatParticipants(activeThreadId);
      setParticipants(list || []);
    } catch {
      setParticipants([]);
    }
  };

  const canDeleteMessage = (m: ChatMessageItem) => {
    if (m.deleted) return false;
    if (canViewDeleted) return true; // OWNER / SA
    if (!isOwn(m)) return false;
    return isWithinEditWindow(m.createdAt, deleteLimitMinutes, nowTick);
  };

  const handleDeleteMessage = async (msg: ChatMessageItem) => {
    if (!activeThreadId) return;
    setMenuAnchor(null);
    try {
      const data =
        mode === 'staff'
          ? await apiService.deleteChatMessage(activeThreadId, msg.id)
          : mode === 'client'
            ? await apiService.clientDeleteChatMessage(activeThreadId, msg.id)
            : await apiService.deletePlatformChatMessage(activeThreadId, msg.id);
      if (!canViewDeleted) {
        setMessages((prev) => prev.filter((m) => m.id !== msg.id));
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msg.id
              ? {
                  ...m,
                  ...data,
                  deleted: true,
                  body: showDeletedContent ? data.body || m.body : '',
                  attachments: showDeletedContent
                    ? data.attachments || m.attachments
                    : [],
                }
              : m
          )
        );
      }
      setPins((prev) => prev.filter((p) => p.messageId !== msg.id));
      if (mode === 'staff' || mode === 'client') dispatchChatUnreadRefresh();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось удалить');
    }
  };

  const togglePin = async (msg: ChatMessageItem) => {
    if (!activeThreadId) return;
    setMenuAnchor(null);
    try {
      if (msg.pinned) {
        if (mode === 'staff') await apiService.unpinChatMessage(activeThreadId, msg.id);
        else if (mode === 'client') await apiService.clientUnpinChatMessage(activeThreadId, msg.id);
        else await apiService.unpinPlatformChatMessage(activeThreadId, msg.id);
        setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, pinned: false } : m)));
        setPins((prev) => prev.filter((p) => p.messageId !== msg.id));
      } else {
        if (mode === 'staff') await apiService.pinChatMessage(activeThreadId, msg.id);
        else if (mode === 'client') await apiService.clientPinChatMessage(activeThreadId, msg.id);
        else await apiService.pinPlatformChatMessage(activeThreadId, msg.id);
        setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, pinned: true } : m)));
        setPins((prev) => [
          {
            messageId: msg.id,
            pinnedAt: new Date().toISOString(),
            body: previewLabel(msg.kind, msg.body),
            kind: msg.kind || 'TEXT',
          },
          ...prev.filter((p) => p.messageId !== msg.id),
        ]);
      }
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось изменить закрепление');
    }
  };

  const insertMention = (p: ChatParticipant) => {
    const displayName = String(p.name || 'Участник').replace(/[\[\]]/g, '');
    const el = inputRef.current;
    let nextDraft = draft;
    let caretPos = draft.length;
    if (el && typeof el.selectionStart === 'number') {
      const start = el.selectionStart;
      const before = draft.slice(0, start);
      const at = before.lastIndexOf('@');
      const prefix = at >= 0 ? before.slice(0, at) : before;
      nextDraft = `${prefix}${displayName} ${draft.slice(start)}`;
      caretPos = prefix.length + displayName.length + 1;
    } else {
      nextDraft = `${draft}${displayName} `;
      caretPos = nextDraft.length;
    }
    setDraft(nextDraft);
    setActiveMentions((prev) =>
      pruneMentionsToDisplay(nextDraft, [
        ...prev,
        { type: p.type, id: p.id, name: displayName },
      ])
    );
    setMentionQuery(null);
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(caretPos, caretPos);
    }, 0);
  };

  const onDraftChange = (value: string) => {
    setDraft(value);
    setActiveMentions((prev) => pruneMentionsToDisplay(value, prev));
    const el = inputRef.current;
    const caret = el?.selectionStart ?? value.length;
    const before = value.slice(0, caret);
    const match = before.match(/@([^\s@[\]]*)$/);
    if (match) {
      setMentionQuery(match[1].toLowerCase());
      if (!participants.length && activeThreadId) {
        void (async () => {
          try {
            const list =
              mode === 'staff'
                ? await apiService.getChatParticipants(activeThreadId)
                : mode === 'client'
                  ? await apiService.clientGetChatParticipants(activeThreadId)
                  : await apiService.getPlatformChatParticipants(activeThreadId);
            setParticipants(list || []);
          } catch {
            /* ignore */
          }
        })();
      }
    } else {
      setMentionQuery(null);
    }
  };

  const mentionSuggestions =
    mentionQuery == null
      ? []
      : participants
          .filter((p) => p.name.toLowerCase().includes(mentionQuery))
          .slice(0, 8);

  const selected = threads.find((t) => t.threadKey === selectedKey);

  return (
    <Box
      sx={{
        display: 'flex',
        flex: immersiveMobile ? { xs: 1, md: 'none' } : undefined,
        height: immersiveMobile
          ? { xs: 'calc(100dvh - 56px)', md: 'calc(100vh - 140px)' }
          : { xs: 'calc(100vh - 160px)', md: 'calc(100vh - 140px)' },
        maxHeight: immersiveMobile ? { xs: 'calc(100dvh - 56px)', md: 'none' } : undefined,
        minHeight: immersiveMobile ? { xs: 0, md: 420 } : 420,
        border: {
          xs: immersiveMobile ? 'none' : `1px solid ${colors.divider}`,
          md: `1px solid ${colors.divider}`,
        },
        borderRadius: {
          xs: immersiveMobile ? 0 : `${radii.panel}px`,
          md: `${radii.panel}px`,
        },
        overflow: 'hidden',
        bgcolor: colors.card,
        position: 'relative',
      }}
    >
      <Box
        sx={{
          width: { xs: selected ? 0 : '100%', sm: 340 },
          display: { xs: selected ? 'none' : 'flex', sm: 'flex' },
          flexDirection: 'column',
          borderRight: `1px solid ${colors.divider}`,
          minWidth: { sm: 300 },
          bgcolor: colors.card,
        }}
      >
        <Box sx={{ px: 1.5, pt: 1.25, pb: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {categoryTabs.map((tab) => {
              const active = category === tab.id;
              return (
                <Chip
                  key={tab.id}
                  label={tab.label}
                  size="small"
                  onClick={() => setCategory(tab.id)}
                  sx={{
                    height: 26,
                    fontSize: typography.hint,
                    fontWeight: active ? 700 : 500,
                    bgcolor: active ? colors.primary : colors.surface,
                    color: active ? '#fff' : colors.text,
                    '&:hover': {
                      bgcolor: active ? colors.primaryDark : colors.rowAlt,
                    },
                  }}
                />
              );
            })}
          </Box>
          <TextField
            fullWidth
            size="small"
            placeholder={
              category === 'all' || category === 'personal'
                ? 'Поиск (в т.ч. без переписки)'
                : 'Поиск'
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 999,
                bgcolor: colors.surface,
                fontSize: 14,
              },
            }}
          />
        </Box>
        <Divider />
        {loadingList ? (
          <Box display="flex" justifyContent="center" p={3}>
            <CircularProgress size={28} />
          </Box>
        ) : (
          <MuiList dense disablePadding sx={{ overflow: 'auto', flex: 1 }}>
            {filteredThreads.length === 0 ? (
              <Typography color="text.secondary" sx={{ p: 2 }}>
                Нет доступных бесед
              </Typography>
            ) : (
              filteredThreads.map((t, index) => {
                const active = t.threadKey === selectedKey;
                const pastel = ['#EEF4FF', '#F3EEFF', '#EEF9F6', '#FFF4F0', '#F5F6FA'][index % 5];
                return (
                  <ListItemButton
                    key={t.threadKey}
                    selected={active}
                    onClick={() => openThread(t)}
                    sx={{
                      alignItems: 'flex-start',
                      gap: 1.25,
                      py: 1.15,
                      px: 1.5,
                      mx: 1,
                      my: 0.5,
                      borderRadius: `${radii.panel}px`,
                      borderLeft: t.type === 'STAFF_TASK' ? `3px solid ${colors.primary}` : '3px solid transparent',
                      bgcolor: active ? colors.primarySoft : pastel,
                      '&.Mui-selected': { bgcolor: colors.primarySoft },
                      '&.Mui-selected:hover': { bgcolor: colors.primarySoft },
                      '&:hover': { bgcolor: active ? colors.primarySoft : colors.card },
                    }}
                  >
                    <Box sx={{ position: 'relative', mt: 0.25 }}>
                      <ChatAvatar title={t.title} />
                      {t.presenceStatus ? (
                        <Box sx={{ position: 'absolute', right: 0, bottom: 0 }}>
                          <PresenceDot status={t.presenceStatus} size={10} />
                        </Box>
                      ) : null}
                    </Box>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Box display="flex" alignItems="center" gap={0.75} justifyContent="space-between">
                        <Typography
                          fontWeight={t.unreadCount ? 700 : 600}
                          noWrap
                          sx={{ fontSize: 14.5, flex: 1, minWidth: 0 }}
                        >
                          {t.title}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{ color: colors.textHint, flexShrink: 0, fontSize: 11.5 }}
                        >
                          {formatChatListTime(t.lastMessageAt)}
                        </Typography>
                      </Box>
                      <Box display="flex" alignItems="center" gap={0.75} mt={0.25}>
                        <Typography
                          noWrap
                          sx={{
                            flex: 1,
                            minWidth: 0,
                            fontSize: 13,
                            color: t.unreadCount ? colors.text : colors.textHint,
                            fontWeight: t.unreadCount ? 500 : 400,
                          }}
                        >
                          {t.lastMessagePreview
                            ? formatMentionsForDisplay(t.lastMessagePreview)
                            : t.subtitle || 'Нет сообщений'}
                        </Typography>
                        {t.type === 'STAFF_TASK' && (
                          <Chip
                            size="small"
                            label="Задача"
                            sx={{
                              height: 20,
                              fontSize: 10,
                              bgcolor: colors.primarySoft,
                              color: colors.primaryDark,
                            }}
                          />
                        )}
                        {t.unreadCount > 0 && (
                          <Box
                            sx={{
                              minWidth: 20,
                              height: 20,
                              px: 0.6,
                              borderRadius: 999,
                              bgcolor: chatTheme.unreadPill,
                              color: '#fff',
                              fontSize: 11,
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            {t.unreadCount > 99 ? '99+' : t.unreadCount}
                          </Box>
                        )}
                      </Box>
                    </Box>
                  </ListItemButton>
                );
              })
            )}
          </MuiList>
              )}
            </Box>

      <Box
        sx={{
          flex: 1,
          display: { xs: selected ? 'flex' : 'none', sm: 'flex' },
          flexDirection: 'column',
          minWidth: 0,
          minHeight: 0,
          overflow: 'hidden',
          bgcolor: chatTheme.feedBg,
        }}
      >
        {!selected ? (
          <Box
            flex={1}
            display="flex"
            alignItems="center"
            justifyContent="center"
            p={3}
            sx={{ background: chatTheme.feedPattern }}
          >
            <Typography sx={{ color: colors.textMuted, fontSize: 15 }}>
              Выберите беседу, чтобы начать переписку
            </Typography>
          </Box>
        ) : (
          <>
            <Box
              sx={{
                px: 1.5,
                py: 1,
                borderBottom: `1px solid ${colors.divider}`,
                bgcolor: colors.card,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                minHeight: 64,
                boxShadow: '0 1px 0 rgba(32, 34, 36, 0.04)',
              }}
            >
              <IconButton
                size="small"
                sx={{ display: { sm: 'none' } }}
                onClick={() => {
                  persistFeedScroll(activeThreadId);
                  setSelectedKey(null);
                  setActiveThreadId(null);
                  activeThreadIdRef.current = null;
                  setMessages([]);
                  cancelEdit();
                }}
                title="К списку"
              >
                <ArrowBack fontSize="small" />
              </IconButton>
              <Box sx={{ position: 'relative' }}>
                <ChatAvatar title={selected.title} size={40} />
                {selected.presenceStatus ? (
                  <Box sx={{ position: 'absolute', right: 0, bottom: 0 }}>
                    <PresenceDot status={selected.presenceStatus} size={10} />
                  </Box>
                ) : null}
              </Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography fontWeight={700} noWrap sx={{ fontSize: 15, lineHeight: 1.25 }}>
                  {selected.title}
                </Typography>
                <Typography variant="caption" noWrap sx={{ color: colors.textHint, display: 'block' }}>
                  {selected.presenceStatus
                    ? PRESENCE_LABEL[selected.presenceStatus]
                    : selected.subtitle}
                </Typography>
              </Box>
              {canViewDeleted && (
                <IconButton
                  size="small"
                  title={showDeletedContent ? 'Скрыть удалённые' : 'Показать удалённые'}
                  onClick={() => setShowDeletedContent((v) => !v)}
                  color={showDeletedContent ? 'primary' : 'default'}
                >
                  {showDeletedContent ? <Visibility fontSize="small" /> : <VisibilityOff fontSize="small" />}
                </IconButton>
              )}
              <IconButton size="small" onClick={() => void openParticipants()} title="Участники">
                <People fontSize="small" />
              </IconButton>
            </Box>

            {pins.length > 0 && (
              <Box
                sx={{
                  px: 1.5,
                  py: 0.75,
                  borderBottom: `1px solid ${colors.divider}`,
                  bgcolor: chatTheme.pinBarBg,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <PushPin sx={{ fontSize: 16, color: colors.primary }} />
                <Box sx={{ minWidth: 0, flex: 1, borderLeft: `3px solid ${colors.primary}`, pl: 1 }}>
                  <Typography variant="caption" sx={{ color: colors.primary, fontWeight: 700, display: 'block', lineHeight: 1.2 }}>
                    Закреплённое сообщение
                  </Typography>
                  <Typography variant="body2" noWrap sx={{ fontSize: 13 }}>
                    {formatMentionsForDisplay(pins[0].body)}
                  </Typography>
                </Box>
              </Box>
            )}

            <Box sx={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>
            <Box
              ref={feedRef}
              onScroll={() => {
                const el = feedRef.current;
                if (!el || !activeThreadId) return;
                const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
                nearBottomRef.current = gap < 120;
                persistFeedScroll(activeThreadId);
                if (el.scrollTop < 80 && hasMoreMessages && !loadingOlderRef.current) {
                  void loadOlderMessages();
                }
              }}
              sx={{
                flex: 1,
                overflow: 'auto',
                px: { xs: 1.25, sm: 2.5 },
                pt: 1.5,
                pb: immersiveMobile ? { xs: '88px', md: 1.5 } : 1.5,
                background: chatTheme.feedPattern,
              }}
            >
              {loadingMessages ? (
                <Box display="flex" justifyContent="center" p={3}>
                  <CircularProgress size={28} />
                </Box>
              ) : (
                <>
                {(loadingOlder || hasMoreMessages) && (
                  <Box display="flex" justifyContent="center" py={1}>
                    {loadingOlder ? (
                      <CircularProgress size={18} />
                    ) : (
                      <Typography
                        variant="caption"
                        sx={{ color: colors.textHint, cursor: 'pointer' }}
                        onClick={() => void loadOlderMessages()}
                      >
                        Загрузить раньше
                      </Typography>
                    )}
                  </Box>
                )}
                {messages
                  .filter((m) => canViewDeleted || !m.deleted)
                  .map((m, idx, list) => {
                  const own = isOwn(m);
                  const deleted = Boolean(m.deleted);
                  const showDeletedFull = deleted && canViewDeleted && showDeletedContent;
                  const canEdit =
                    own &&
                    !deleted &&
                    (m.kind || 'TEXT') === 'TEXT' &&
                    isWithinEditWindow(m.createdAt, editLimitMinutes, nowTick);
                  const prev = idx > 0 ? list[idx - 1] : null;
                  const showDay =
                    !prev || dayKey(prev.createdAt) !== dayKey(m.createdAt);
                  const mentionColor = own ? 'rgba(255,255,255,0.95)' : chatTheme.mention;
                  const bubbleOwn = own && !deleted;
                  return (
                    <React.Fragment key={m.id}>
                      {showDay && (
                        <Box display="flex" justifyContent="center" my={1.25}>
                          <Box
                            sx={{
                              px: 1.25,
                              py: 0.35,
                              borderRadius: 999,
                              bgcolor: chatTheme.dateChipBg,
                              color: chatTheme.dateChipText,
                              fontSize: 12,
                              fontWeight: 600,
                            }}
                          >
                            {formatDaySeparator(m.createdAt)}
                          </Box>
                        </Box>
                      )}
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: own ? 'flex-end' : 'flex-start',
                          mb: 0.75,
                          contentVisibility: 'auto',
                          containIntrinsicSize: `auto ${CHAT_MSG_ROW_EST}px`,
                        }}
                      >
                        <Box
                          sx={{
                            maxWidth: { xs: '88%', sm: '72%' },
                            px: 1.35,
                            pt: 0.85,
                            pb: 0.55,
                            borderRadius: own
                              ? '14px 14px 4px 14px'
                              : '14px 14px 14px 4px',
                            bgcolor: deleted
                              ? colors.rowAlt
                              : bubbleOwn
                                ? chatTheme.outgoingBubble
                                : chatTheme.incomingBubble,
                            color: deleted
                              ? colors.textHint
                              : bubbleOwn
                                ? chatTheme.outgoingText
                                : chatTheme.incomingText,
                            fontStyle: deleted && !showDeletedFull ? 'italic' : 'normal',
                            boxShadow: deleted
                              ? 'none'
                              : bubbleOwn
                                ? '0 1px 2px rgba(13, 75, 215, 0.25)'
                                : '0 1px 2px rgba(0,0,0,0.08)',
                            position: 'relative',
                            outline: editingId === m.id ? '2px solid' : 'none',
                            outlineColor: 'warning.main',
                          }}
                        >
                          {deleted && (
                            <Typography
                              variant="caption"
                              sx={{
                                display: 'block',
                                fontWeight: 700,
                                color: colors.danger,
                                mb: 0.35,
                              }}
                            >
                              Удалено
                            </Typography>
                          )}
                          {!own && (
                            <Typography
                              variant="caption"
                              sx={{
                                color: colors.primary,
                                fontWeight: 700,
                                display: 'block',
                                mb: 0.25,
                              }}
                            >
                              {m.authorName}
                              {m.authorType === 'PARENT' ? ' (родитель)' : ''}
                            </Typography>
                          )}
                          {m.replyTo && !deleted && (
                            <Box
                              sx={{
                                mb: 0.65,
                                px: 0.85,
                                py: 0.4,
                                borderLeft: '3px solid',
                                borderColor: own ? 'rgba(255,255,255,0.65)' : colors.primary,
                                bgcolor: own ? 'rgba(255,255,255,0.12)' : 'rgba(72,128,255,0.08)',
                                borderRadius: '0 6px 6px 0',
                              }}
                            >
                              <Typography
                                variant="caption"
                                sx={{ fontWeight: 700, display: 'block', lineHeight: 1.2 }}
                              >
                                {m.replyTo.deleted ? 'Удалено' : m.replyTo.authorName}
                              </Typography>
                              <Typography
                                variant="caption"
                                sx={{
                                  display: 'block',
                                  opacity: 0.9,
                                  fontStyle: m.replyTo.deleted ? 'italic' : 'normal',
                                }}
                                noWrap
                              >
                                {m.replyTo.deleted
                                  ? 'Сообщение удалено'
                                  : formatMentionsForDisplay(m.replyTo.body)}
                              </Typography>
                            </Box>
                          )}
                          {deleted && canViewDeleted && !showDeletedFull ? (
                            <Typography variant="body2" sx={{ fontSize: 14.5, fontStyle: 'italic' }}>
                              Сообщение удалено
                            </Typography>
                          ) : (
                            <>
                              {(m.attachments || []).map((att) =>
                                activeThreadId ? (
                                  <Box key={att.id} sx={{ mb: m.body ? 0.75 : 0.25 }}>
                                    <ChatMediaBubble
                                      mode={mode}
                                      threadId={activeThreadId}
                                      messageId={m.id}
                                      attachment={att}
                                    />
                                  </Box>
                                ) : null
                              )}
                              {m.body ? (
                                <Typography
                                  variant="body2"
                                  sx={{ whiteSpace: 'pre-wrap', fontSize: 14.5, lineHeight: 1.4 }}
                                >
                                  {renderMentionNodes(
                                    m.body,
                                    m.id,
                                    deleted ? colors.textMuted : mentionColor
                                  )}
                                </Typography>
                              ) : null}
                            </>
                          )}
                          <Box
                            display="flex"
                            alignItems="center"
                            justifyContent="flex-end"
                            gap={0.35}
                            mt={0.35}
                          >
                            {m.pinned && !deleted && (
                              <PushPin
                                sx={{
                                  fontSize: 12,
                                  opacity: 0.8,
                                  color: own ? chatTheme.timeMutedOwn : colors.primary,
                                }}
                              />
                            )}
                            {!deleted && (
                              <IconButton
                                size="small"
                                onClick={(e) => setMenuAnchor({ el: e.currentTarget, msg: m })}
                                title="Действия"
                                sx={{
                                  p: 0.2,
                                  color: 'inherit',
                                  opacity: 0.55,
                                  '&:hover': { opacity: 1 },
                                }}
                              >
                                <MoreVert sx={{ fontSize: 14 }} />
                              </IconButton>
                            )}
                            {canEdit && (
                              <IconButton
                                size="small"
                                onClick={() => startEdit(m)}
                                title="Редактировать"
                                sx={{
                                  p: 0.2,
                                  color: 'inherit',
                                  opacity: 0.55,
                                  '&:hover': { opacity: 1 },
                                }}
                              >
                                <Edit sx={{ fontSize: 14 }} />
                              </IconButton>
                            )}
                            <Typography
                              variant="caption"
                              sx={{
                                opacity: 1,
                                color: deleted
                                  ? colors.textHint
                                  : own
                                    ? chatTheme.timeMutedOwn
                                    : chatTheme.timeMutedOther,
                                fontSize: 11,
                                lineHeight: 1,
                              }}
                            >
                              {m.editedAt ? 'изм. ' : ''}
                              {formatChatTime(m.createdAt)}
                            </Typography>
                            {own && !deleted && (
                              <Box
                                component="span"
                                onClick={() => {
                                  if ((m.readBy || []).length > 1) setReadByDialog(m);
                                }}
                                sx={{
                                  display: 'inline-flex',
                                  cursor: (m.readBy || []).length > 1 ? 'pointer' : 'default',
                                  ml: 0.15,
                                }}
                                title={
                                  m.readByPeer
                                    ? (m.readBy || []).length > 1
                                      ? `Прочитали: ${(m.readBy || []).length}`
                                      : 'Прочитано'
                                    : 'Доставлено'
                                }
                              >
                                {m.readByPeer ? (
                                  <DoneAll
                                    sx={{
                                      fontSize: 15,
                                      color: own ? 'rgba(255,255,255,0.95)' : colors.primary,
                                    }}
                                  />
                                ) : (
                                  <Done
                                    sx={{
                                      fontSize: 15,
                                      color: own ? chatTheme.timeMutedOwn : colors.textHint,
                                    }}
                                  />
                                )}
                              </Box>
                            )}
                          </Box>
                        </Box>
                      </Box>
                    </React.Fragment>
                  );
                })}
                </>
              )}
              <div ref={bottomRef} />
            </Box>
            <Box
              ref={recordOverlayRef}
              sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 3 }}
            />
            </Box>

            <Box
              sx={
                immersiveMobile
                  ? {
                      position: { xs: 'fixed', md: 'static' },
                      left: { xs: 0, md: 'auto' },
                      right: { xs: 0, md: 'auto' },
                      bottom: { xs: 0, md: 'auto' },
                      zIndex: { xs: 40, md: 'auto' },
                      bgcolor: chatTheme.composerBg,
                      flexShrink: 0,
                    }
                  : { flexShrink: 0 }
              }
            >
            {!recorderBusy && (editingId || replyTo) && (
              <Box
                sx={{
                  px: 1.5,
                  py: 0.65,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  bgcolor: chatTheme.composerBg,
                  borderTop: `1px solid ${colors.divider}`,
                }}
              >
                <Box
                  sx={{
                    width: 3,
                    alignSelf: 'stretch',
                    borderRadius: 2,
                    bgcolor: colors.primary,
                    flexShrink: 0,
                  }}
                />
                {editingId ? (
                  <Edit fontSize="small" sx={{ color: colors.primary }} />
                ) : (
                  <Reply fontSize="small" sx={{ color: colors.primary }} />
                )}
                <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }} noWrap>
                  {editingId
                    ? 'Редактирование сообщения'
                    : `Ответ: ${replyTo?.authorName} — ${previewLabel(replyTo?.kind, replyTo?.body || '')}`}
                </Typography>
                <IconButton
                  size="small"
                  onClick={() => {
                    if (editingId) cancelEdit();
                    else setReplyTo(null);
                  }}
                  title="Отмена"
                >
                  <Close fontSize="small" />
                </IconButton>
              </Box>
            )}

            {!recorderBusy && mentionSuggestions.length > 0 && (
              <Box
                sx={{
                  borderTop: `1px solid ${colors.divider}`,
                  maxHeight: 168,
                  overflow: 'auto',
                  bgcolor: colors.card,
                  boxShadow: '0 -4px 12px rgba(0,0,0,0.06)',
                }}
              >
                {mentionSuggestions.map((p) => (
                  <ListItemButton key={`${p.type}:${p.id}`} dense onClick={() => insertMention(p)}>
                    <ChatAvatar title={p.name} size={32} />
                    <ListItemText
                      sx={{ ml: 1.25 }}
                      primary={p.name}
                      secondary={p.roleLabel}
                      primaryTypographyProps={{ fontSize: 14, fontWeight: 600 }}
                      secondaryTypographyProps={{ fontSize: 12 }}
                    />
                  </ListItemButton>
                ))}
              </Box>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              hidden
              onChange={(e) => void onPickFile(e)}
            />

            <Box
              sx={{
                px: recorderBusy ? 0 : 0.75,
                pt: recorderBusy ? 0 : 0.5,
                pb: recorderBusy
                  ? 0
                  : immersiveMobile
                    ? { xs: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))', md: 0.5 }
                    : 0.5,
                display: 'flex',
                gap: 0.5,
                alignItems: 'center',
                width: '100%',
                flexShrink: 0,
                bgcolor: chatTheme.composerBg,
                borderTop: recorderBusy ? 'none' : `1px solid ${colors.divider}`,
                '& > *:last-child': recorderBusy ? { width: '100%' } : undefined,
              }}
            >
              {!recorderBusy && (
                <>
                  <IconButton
                    disabled={sending || !activeThreadId || Boolean(editingId)}
                    title="Фото или видео"
                    onClick={() => fileInputRef.current?.click()}
                    sx={{ color: colors.textHint, width: 32, height: 32 }}
                  >
                    <AttachFile sx={{ fontSize: 20 }} />
                  </IconButton>
                  <Box
                    sx={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.25,
                      minWidth: 0,
                      minHeight: 36,
                      bgcolor: colors.surface,
                      borderRadius: 999,
                      border: `1px solid ${colors.divider}`,
                      pl: 1.5,
                      pr: 0.25,
                    }}
                  >
                    <TextField
                      fullWidth
                      variant="standard"
                      placeholder={editingId ? 'Изменить сообщение…' : 'Сообщение...'}
                      value={draft}
                      onChange={(e) => onDraftChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape' && editingId) {
                          e.preventDefault();
                          cancelEdit();
                          return;
                        }
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      multiline
                      maxRows={4}
                      disabled={sending || !activeThreadId}
                      inputRef={inputRef}
                      sx={{
                        '& .MuiInputBase-root': {
                          padding: 0,
                          alignItems: 'center',
                        },
                        '& .MuiInputBase-input': {
                          padding: '2px 0 !important',
                          lineHeight: '20px',
                          fontSize: 14.5,
                          minHeight: '20px !important',
                        },
                      }}
                      InputProps={{ disableUnderline: true }}
                    />
                    <IconButton
                      onClick={(e) => setEmojiAnchor(e.currentTarget)}
                      disabled={sending || !activeThreadId}
                      title="Смайлы"
                      sx={{ color: colors.textHint, width: 28, height: 28 }}
                    >
                      <EmojiEmotions sx={{ fontSize: 20 }} />
                    </IconButton>
                  </Box>
                  {(draft.trim() || editingId) && (
                    <IconButton
                      onClick={handleSend}
                      disabled={sending || !draft.trim() || !activeThreadId}
                      sx={{
                        bgcolor: colors.primary,
                        color: '#fff',
                        width: 32,
                        height: 32,
                        flexShrink: 0,
                        '&:hover': { bgcolor: colors.primaryDark },
                        '&.Mui-disabled': {
                          bgcolor: colors.borderDisabled,
                          color: colors.textHint,
                        },
                      }}
                    >
                      {sending ? (
                        <CircularProgress size={16} color="inherit" />
                      ) : editingId ? (
                        <Edit sx={{ fontSize: 18 }} />
                      ) : (
                        <Send sx={{ fontSize: 18 }} />
                      )}
                    </IconButton>
                  )}
                </>
              )}
              <ChatVoiceRecorder
                disabled={sending || !activeThreadId || Boolean(editingId)}
                hideTrigger={Boolean(draft.trim() || editingId) && !recorderBusy}
                overlayHostRef={recordOverlayRef}
                onBusyChange={setRecorderBusy}
                onError={(msg) => setError(msg)}
                onSend={(file, kind, durationMs) => {
                  void uploadMediaFile(file, kind, durationMs);
                }}
              />
            </Box>
            </Box>
          </>
        )}
      </Box>

      <Popover
        open={Boolean(emojiAnchor)}
        anchorEl={emojiAnchor}
        onClose={() => setEmojiAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Box
          sx={{
            p: 1,
            display: 'grid',
            gridTemplateColumns: 'repeat(8, 1fr)',
            gap: 0.5,
            maxWidth: 280,
          }}
        >
          {EMOJI_LIST.map((emoji) => (
            <IconButton
              key={emoji}
              size="small"
              onClick={() => insertEmoji(emoji)}
              sx={{ fontSize: 20, lineHeight: 1 }}
            >
              {emoji}
            </IconButton>
          ))}
        </Box>
      </Popover>

      <Menu
        anchorEl={menuAnchor?.el || null}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
      >
        <MenuItem
          onClick={() => {
            if (!menuAnchor) return;
            setReplyTo(menuAnchor.msg);
            setMenuAnchor(null);
            setTimeout(() => inputRef.current?.focus(), 0);
          }}
        >
          Ответить
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuAnchor) void togglePin(menuAnchor.msg);
          }}
        >
          {menuAnchor?.msg.pinned ? 'Открепить' : 'Закрепить'}
        </MenuItem>
        {menuAnchor && canDeleteMessage(menuAnchor.msg) && (
          <MenuItem
            onClick={() => {
              if (menuAnchor) void handleDeleteMessage(menuAnchor.msg);
            }}
            sx={{ color: colors.danger }}
          >
            Удалить
          </MenuItem>
        )}
      </Menu>

      <Dialog open={Boolean(readByDialog)} onClose={() => setReadByDialog(null)} fullWidth maxWidth="xs">
        <DialogTitle>Прочитали</DialogTitle>
        <DialogContent dividers>
          <MuiList dense>
            {(readByDialog?.readBy || []).map((r) => (
              <ListItemButton key={`${r.type}:${r.id}`} disableRipple>
                <ListItemText
                  primary={r.name || `${r.type}:${r.id}`}
                  secondary={new Date(r.readAt).toLocaleString('ru-RU')}
                />
              </ListItemButton>
            ))}
          </MuiList>
        </DialogContent>
      </Dialog>

      <Dialog open={participantsOpen} onClose={() => setParticipantsOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Участники</DialogTitle>
        <DialogContent dividers>
          <MuiList dense>
            {participants.map((p) => (
              <ListItemButton
                key={`${p.type}:${p.id}`}
                onClick={() => {
                  insertMention(p);
                  setParticipantsOpen(false);
                }}
              >
                <ListItemText primary={p.name} secondary={p.roleLabel} />
              </ListItemButton>
            ))}
            {participants.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                Нет участников
              </Typography>
            )}
          </MuiList>
        </DialogContent>
      </Dialog>

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
