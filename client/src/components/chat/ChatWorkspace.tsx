import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  Popover,
  TextField,
  Typography,
  Badge,
} from '@mui/material';
import {
  AttachFile,
  Close,
  Edit,
  EmojiEmotions,
  Mic,
  MoreVert,
  People,
  PushPin,
  Reply,
  Send,
  Stop,
  Videocam,
} from '@mui/icons-material';
import { apiService } from '../../services/api';
import { useChatSocket, ChatSocketMessage } from '../../hooks/useChatSocket';
import { dispatchChatUnreadRefresh } from '../../hooks/useChatUnreadBadge';
import { colors, radii, typography } from '../../theme/tokens';
import ChatMediaBubble from './ChatMediaBubble';
import {
  encodeMentionsForSend,
  extractMentionsFromText,
  formatMentionsForDisplay,
  MentionRef,
  pruneMentionsToDisplay,
  renderMentionNodes,
  renderMentionPlain,
} from './chatMentionUtils';

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
  };
}

/**
 * Двухколоночный UI чатов: список бесед + лента.
 */
const ChatWorkspace: React.FC<ChatWorkspaceProps> = ({ mode, socketToken, self, initialThreadId }) => {
  const [threads, setThreads] = useState<ChatThreadItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [error, setError] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLimitMinutes, setEditLimitMinutes] = useState(0);
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
  const [recording, setRecording] = useState<'voice' | 'video' | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordStartedAtRef = useRef(0);
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

  const stopMediaTracks = () => {
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
  };

  const openThread = async (item: ChatThreadItem) => {
    cancelEdit();
    setReplyTo(null);
    setActiveMentions([]);
    setSelectedKey(item.threadKey);
    setLoadingMessages(true);
    setMessages([]);
    setPins([]);
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
      setPins(data.pins || []);
      if (typeof data.chatMessageEditLimitMinutes === 'number') {
        setEditLimitMinutes(data.chatMessageEditLimitMinutes);
      } else if (mode === 'platform') {
        setEditLimitMinutes(0);
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
    } finally {
      setLoadingMessages(false);
    }
  };

  const initialOpenedRef = useRef(false);
  useEffect(() => {
    if (initialOpenedRef.current || loadingList || !initialThreadId || !threads.length) return;
    const target = threads.find((t) => t.id === initialThreadId);
    if (target) {
      initialOpenedRef.current = true;
      void openThread(target);
    }
  }, [initialThreadId, loadingList, threads]);

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
      const preview = previewLabel(msg.kind, msg.body);
      setMessages((prev) => {
        if (msg.threadId !== activeThreadId) return prev;
        return prev.map((m) => (m.id === msg.id ? { ...m, ...socketToItem(msg) } : m));
      });
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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  const startRecording = async (kind: 'voice' | 'video') => {
    if (recording || !activeThreadId) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: kind === 'video',
      });
      mediaStreamRef.current = stream;
      mediaChunksRef.current = [];
      const mime =
        kind === 'video'
          ? MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
            ? 'video/webm;codecs=vp9,opus'
            : 'video/webm'
          : MediaRecorder.isTypeSupported('audio/webm')
            ? 'audio/webm'
            : 'audio/ogg';
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) mediaChunksRef.current.push(ev.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(mediaChunksRef.current, { type: mime.split(';')[0] });
        const ext = kind === 'video' ? 'webm' : 'webm';
        const file = new File([blob], `chat-${kind}.${ext}`, { type: blob.type });
        const durationMs = Date.now() - recordStartedAtRef.current;
        stopMediaTracks();
        setRecording(null);
        void uploadMediaFile(file, kind, durationMs);
      };
      recordStartedAtRef.current = Date.now();
      recorder.start();
      setRecording(kind);
    } catch {
      setError('Нет доступа к микрофону/камере');
      stopMediaTracks();
      setRecording(null);
    }
  };

  const stopRecording = () => {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== 'inactive') rec.stop();
    else {
      stopMediaTracks();
      setRecording(null);
    }
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
        <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {categoryTabs.map((tab) => {
              const active = category === tab.id;
              return (
                <Chip
                  key={tab.id}
                  label={tab.label}
                  size="small"
                  onClick={() => setCategory(tab.id)}
                  sx={{
                    fontSize: typography.hint,
                    fontWeight: active ? 700 : 500,
                    bgcolor: active ? colors.primary : colors.surface,
                    color: active ? '#fff' : colors.text,
                    '&:hover': {
                      bgcolor: active ? colors.primary : colors.rowAlt,
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
                  sx={
                    t.type === 'STAFF_TASK'
                      ? {
                          borderLeft: `3px solid ${colors.primary}`,
                          bgcolor: selectedKey === t.threadKey ? undefined : 'rgba(25, 118, 210, 0.06)',
                        }
                      : undefined
                  }
                >
                  <ListItemText
                    primary={
                      <Box display="flex" alignItems="center" gap={1}>
                        {t.presenceStatus ? <PresenceDot status={t.presenceStatus} /> : null}
                        <Typography fontWeight={t.unreadCount ? 700 : 500} noWrap>
                          {t.title}
                        </Typography>
                        {t.type === 'STAFF_TASK' && (
                          <Chip size="small" label="Задача" color="primary" variant="outlined" />
                        )}
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
                            {formatMentionsForDisplay(t.lastMessagePreview)}
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
                  cancelEdit();
                }}
              >
                ← К списку
              </Button>
              <Box display="flex" alignItems="center" justifyContent="space-between" gap={1}>
                <Box display="flex" alignItems="center" gap={1} minWidth={0}>
                  {selected.presenceStatus ? <PresenceDot status={selected.presenceStatus} /> : null}
                  <Typography fontWeight={700} noWrap>
                    {selected.title}
                  </Typography>
                </Box>
                <IconButton size="small" onClick={() => void openParticipants()} title="Участники">
                  <People fontSize="small" />
                </IconButton>
              </Box>
              <Typography variant="caption" color="text.secondary">
                {selected.presenceStatus
                  ? `${PRESENCE_LABEL[selected.presenceStatus]} · ${selected.subtitle}`
                  : selected.subtitle}
              </Typography>
            </Box>

            {pins.length > 0 && (
              <Box
                sx={{
                  px: 1.5,
                  py: 1,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  bgcolor: 'action.hover',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <PushPin fontSize="small" color="primary" />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Закреплено
                  </Typography>
                  <Typography variant="body2" noWrap>
                    {pins[0].body}
                  </Typography>
                </Box>
              </Box>
            )}

            <Box sx={{ flex: 1, overflow: 'auto', p: 2, bgcolor: 'grey.50' }}>
              {loadingMessages ? (
                <Box display="flex" justifyContent="center" p={3}>
                  <CircularProgress size={28} />
                </Box>
              ) : (
                messages.map((m) => {
                  const own = isOwn(m);
                  const canEdit =
                    own &&
                    (m.kind || 'TEXT') === 'TEXT' &&
                    isWithinEditWindow(m.createdAt, editLimitMinutes, nowTick);
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
                          position: 'relative',
                          outline: editingId === m.id ? '2px solid' : 'none',
                          outlineColor: 'warning.main',
                        }}
                      >
                        {!own && (
                          <Typography variant="caption" sx={{ opacity: 0.85, display: 'block' }}>
                            {m.authorName}
                            {m.authorType === 'PARENT' ? ' (родитель)' : ''}
                          </Typography>
                        )}
                        {m.replyTo && (
                          <Box
                            sx={{
                              mb: 0.75,
                              pl: 1,
                              borderLeft: '3px solid',
                              borderColor: own ? 'rgba(255,255,255,0.5)' : 'primary.main',
                              opacity: 0.9,
                            }}
                          >
                            <Typography variant="caption" sx={{ fontWeight: 600, display: 'block' }}>
                              {m.replyTo.authorName}
                            </Typography>
                            <Typography variant="caption" sx={{ display: 'block' }} noWrap>
                              {formatMentionsForDisplay(m.replyTo.body)}
                            </Typography>
                          </Box>
                        )}
                        {(m.attachments || []).map((att) =>
                          activeThreadId ? (
                            <Box key={att.id} sx={{ mb: m.body ? 1 : 0 }}>
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
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                            {renderMentionNodes(m.body, m.id)}
                          </Typography>
                        ) : null}
                        <Box
                          display="flex"
                          alignItems="center"
                          justifyContent="flex-end"
                          gap={0.5}
                          mt={0.5}
                        >
                          {m.pinned && <PushPin sx={{ fontSize: 12, opacity: 0.8 }} />}
                          <IconButton
                            size="small"
                            onClick={(e) => setMenuAnchor({ el: e.currentTarget, msg: m })}
                            title="Действия"
                            sx={{
                              p: 0.25,
                              color: 'inherit',
                              opacity: 0.75,
                              '&:hover': { opacity: 1 },
                            }}
                          >
                            <MoreVert sx={{ fontSize: 14 }} />
                          </IconButton>
                          {canEdit && (
                            <IconButton
                              size="small"
                              onClick={() => startEdit(m)}
                              title="Редактировать"
                              sx={{
                                p: 0.25,
                                color: 'inherit',
                                opacity: 0.75,
                                '&:hover': { opacity: 1 },
                              }}
                            >
                              <Edit sx={{ fontSize: 14 }} />
                            </IconButton>
                          )}
                          <Typography variant="caption" sx={{ opacity: 0.7 }}>
                            {m.editedAt ? 'изм. · ' : ''}
                            {new Date(m.createdAt).toLocaleString('ru-RU', {
                              hour: '2-digit',
                              minute: '2-digit',
                              day: '2-digit',
                              month: '2-digit',
                            })}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  );
                })
              )}
              <div ref={bottomRef} />
            </Box>

            {(editingId || replyTo) && (
              <Box
                sx={{
                  px: 1.5,
                  pt: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  bgcolor: 'action.hover',
                }}
              >
                {editingId ? <Edit fontSize="small" color="action" /> : <Reply fontSize="small" color="action" />}
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

            {mentionSuggestions.length > 0 && (
              <Box
                sx={{
                  borderTop: '1px solid',
                  borderColor: 'divider',
                  maxHeight: 160,
                  overflow: 'auto',
                  bgcolor: 'background.paper',
                }}
              >
                {mentionSuggestions.map((p) => (
                  <ListItemButton key={`${p.type}:${p.id}`} dense onClick={() => insertMention(p)}>
                    <ListItemText primary={p.name} secondary={p.roleLabel} />
                  </ListItemButton>
                ))}
              </Box>
            )}

            <Box sx={{ p: 1.5, display: 'flex', gap: 0.5, borderTop: '1px solid', borderColor: 'divider', alignItems: 'flex-end' }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                hidden
                onChange={(e) => void onPickFile(e)}
              />
              <IconButton
                onClick={(e) => setEmojiAnchor(e.currentTarget)}
                disabled={sending || !activeThreadId}
                title="Смайлы"
              >
                <EmojiEmotions />
              </IconButton>
              <IconButton
                disabled={sending || !activeThreadId || Boolean(editingId)}
                title="Прикрепить фото/видео"
                onClick={() => fileInputRef.current?.click()}
              >
                <AttachFile />
              </IconButton>
              <IconButton
                disabled={sending || !activeThreadId || Boolean(editingId)}
                color={recording === 'voice' ? 'error' : 'default'}
                title={recording === 'voice' ? 'Остановить запись' : 'Голосовое'}
                onClick={() => (recording === 'voice' ? stopRecording() : void startRecording('voice'))}
              >
                {recording === 'voice' ? <Stop /> : <Mic />}
              </IconButton>
              <IconButton
                disabled={sending || !activeThreadId || Boolean(editingId)}
                color={recording === 'video' ? 'error' : 'default'}
                title={recording === 'video' ? 'Остановить запись' : 'Видеосообщение'}
                onClick={() => (recording === 'video' ? stopRecording() : void startRecording('video'))}
              >
                {recording === 'video' ? <Stop /> : <Videocam />}
              </IconButton>
              <TextField
                fullWidth
                size="small"
                placeholder={editingId ? 'Изменить сообщение…' : 'Сообщение… (@ — упомянуть)'}
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
              />
              <Button
                variant="contained"
                onClick={handleSend}
                disabled={sending || !draft.trim() || !activeThreadId}
                sx={{ minWidth: 48 }}
              >
                {sending ? <CircularProgress size={20} color="inherit" /> : editingId ? <Edit /> : <Send />}
              </Button>
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
      </Menu>

      <Dialog open={participantsOpen} onClose={() => setParticipantsOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Участники</DialogTitle>
        <DialogContent dividers>
          <List dense>
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
          </List>
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
