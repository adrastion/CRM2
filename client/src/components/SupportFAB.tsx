import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dialog,
  Box,
  Typography,
  TextField,
  Button,
  CircularProgress,
  MenuItem,
  IconButton,
  Badge,
  Chip,
} from '@mui/material';
import {
  Close,
  SupportAgent,
  Send,
  AttachFile,
  Bolt,
  AccessTime,
  ChevronRight,
  Add,
  GroupsOutlined,
  AccountBalanceWalletOutlined,
  BuildOutlined,
  BusinessOutlined,
  EventOutlined,
  CardMembershipOutlined,
  PersonOutline,
  SettingsOutlined,
} from '@mui/icons-material';
import { useLocation } from 'react-router-dom';
import { apiService } from '../services/api';
import { colors } from '../theme/tokens';
import SupportAttachmentBubble from './support/SupportAttachmentBubble';

function hasClientSession(): boolean {
  return !!localStorage.getItem('clientToken');
}

function hasSuperAdminSession(): boolean {
  return !!localStorage.getItem('superAdminToken');
}

function hasAnyNonSuperAdminSession(): boolean {
  return !!(
    localStorage.getItem('token') ||
    localStorage.getItem('marketerToken') ||
    localStorage.getItem('promoCodeAdminToken') ||
    localStorage.getItem('platformStaffToken') ||
    localStorage.getItem('clientToken')
  );
}

function isSuperAdminRoute(pathname: string): boolean {
  return pathname.startsWith('/admin/');
}

type SupportAudience = 'school' | 'marketer' | 'client';

type FaqItem = {
  title: string;
  hint: string;
  icon: React.ReactNode;
  topic: string;
};

const MARKETER_TOPICS = [
  'Как добавить организацию',
  'Как работать с командой',
  'Финансы и выплаты',
  'Технические вопросы',
  'Другое',
];

const CLIENT_TOPICS = [
  'Абонемент и занятия',
  'Расписание и посещения',
  'Оплата и счета',
  'Профиль и доступ',
  'Другое',
];

const SCHOOL_TOPICS = [
  'Настройка школы',
  'Сотрудники и группы',
  'Финансы и абонементы',
  'Технические вопросы',
  'Другое',
];

const MARKETER_FAQ: FaqItem[] = [
  {
    title: 'Как добавить организацию',
    hint: 'Пошаговая инструкция и ответы на частые вопросы',
    icon: <BusinessOutlined sx={{ fontSize: 18 }} />,
    topic: MARKETER_TOPICS[0],
  },
  {
    title: 'Как работать с командой',
    hint: 'Реферальная программа и начисления',
    icon: <GroupsOutlined sx={{ fontSize: 18 }} />,
    topic: MARKETER_TOPICS[1],
  },
  {
    title: 'Финансы и выплаты',
    hint: 'Вывод средств, документы, сроки',
    icon: <AccountBalanceWalletOutlined sx={{ fontSize: 18 }} />,
    topic: MARKETER_TOPICS[2],
  },
  {
    title: 'Технические вопросы',
    hint: 'Проблемы с доступом, ошибки и настройки',
    icon: <BuildOutlined sx={{ fontSize: 18 }} />,
    topic: MARKETER_TOPICS[3],
  },
];

const CLIENT_FAQ: FaqItem[] = [
  {
    title: 'Абонемент и занятия',
    hint: 'Продление, заморозка, смена тарифа, запись',
    icon: <CardMembershipOutlined sx={{ fontSize: 18 }} />,
    topic: CLIENT_TOPICS[0],
  },
  {
    title: 'Расписание и посещения',
    hint: 'Тренировки, переносы, отметки посещаемости',
    icon: <EventOutlined sx={{ fontSize: 18 }} />,
    topic: CLIENT_TOPICS[1],
  },
  {
    title: 'Оплата и счета',
    hint: 'Оплата онлайн, квитанции, задолженность',
    icon: <AccountBalanceWalletOutlined sx={{ fontSize: 18 }} />,
    topic: CLIENT_TOPICS[2],
  },
  {
    title: 'Профиль и доступ',
    hint: 'Данные ученика, вход в кабинет, уведомления',
    icon: <PersonOutline sx={{ fontSize: 18 }} />,
    topic: CLIENT_TOPICS[3],
  },
];

const SCHOOL_FAQ: FaqItem[] = [
  {
    title: 'Настройка школы',
    hint: 'Филиалы, расписание, первые шаги в CRM',
    icon: <SettingsOutlined sx={{ fontSize: 18 }} />,
    topic: SCHOOL_TOPICS[0],
  },
  {
    title: 'Сотрудники и группы',
    hint: 'Тренеры, роли, группы и ученики',
    icon: <GroupsOutlined sx={{ fontSize: 18 }} />,
    topic: SCHOOL_TOPICS[1],
  },
  {
    title: 'Финансы и абонементы',
    hint: 'Оплаты, тарифы, отчёты',
    icon: <AccountBalanceWalletOutlined sx={{ fontSize: 18 }} />,
    topic: SCHOOL_TOPICS[2],
  },
  {
    title: 'Технические вопросы',
    hint: 'Проблемы с доступом, ошибки и настройки',
    icon: <BuildOutlined sx={{ fontSize: 18 }} />,
    topic: SCHOOL_TOPICS[3],
  },
];

function supportCatalog(audience: SupportAudience): { topics: string[]; faq: FaqItem[] } {
  if (audience === 'client') return { topics: CLIENT_TOPICS, faq: CLIENT_FAQ };
  if (audience === 'marketer') return { topics: MARKETER_TOPICS, faq: MARKETER_FAQ };
  return { topics: SCHOOL_TOPICS, faq: SCHOOL_FAQ };
}

function faqIconByKey(key?: string | null): React.ReactNode {
  switch (String(key || '').toLowerCase()) {
    case 'business':
      return <BusinessOutlined sx={{ fontSize: 18 }} />;
    case 'groups':
      return <GroupsOutlined sx={{ fontSize: 18 }} />;
    case 'wallet':
      return <AccountBalanceWalletOutlined sx={{ fontSize: 18 }} />;
    case 'build':
      return <BuildOutlined sx={{ fontSize: 18 }} />;
    case 'event':
      return <EventOutlined sx={{ fontSize: 18 }} />;
    case 'membership':
      return <CardMembershipOutlined sx={{ fontSize: 18 }} />;
    case 'person':
      return <PersonOutline sx={{ fontSize: 18 }} />;
    case 'settings':
    default:
      return <SettingsOutlined sx={{ fontSize: 18 }} />;
  }
}

function mapApiFaq(
  rows: Array<{ title?: string; hint?: string | null; topic?: string | null; iconKey?: string | null }>
): FaqItem[] {
  return (rows || [])
    .filter((r) => String(r.title || '').trim())
    .map((r) => ({
      title: String(r.title).trim(),
      hint: String(r.hint || '').trim() || ' ',
      topic: String(r.topic || r.title || '').trim(),
      icon: faqIconByKey(r.iconKey),
    }));
}

function isOwnMessage(authorType: string): boolean {
  const t = String(authorType || '').toLowerCase();
  return !['platform_staff', 'super_admin'].includes(t);
}

function formatTime(iso?: string | Date) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function formatListDate(iso?: string | Date) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return formatTime(d);
  return d.toLocaleDateString('ru-RU');
}

const SupportFAB: React.FC = () => {
  const location = useLocation();

  const isMarketerSession = useMemo(
    () => location.pathname.startsWith('/marketer/') || !!localStorage.getItem('marketerToken'),
    [location.pathname]
  );

  const hidden = useMemo(() => {
    if (hasSuperAdminSession()) return true;
    if (isSuperAdminRoute(location.pathname)) return true;
    if (!hasAnyNonSuperAdminSession()) return true;
    return false;
  }, [location.pathname]);

  /** ЛК ученика — только без сессии маркетолога (у маркетолога свой канал SUPPORT). */
  const isClientPortal = !hidden && hasClientSession() && !isMarketerSession;

  const audience: SupportAudience = isClientPortal ? 'client' : isMarketerSession ? 'marketer' : 'school';
  const catalog = useMemo(() => supportCatalog(audience), [audience]);
  const [faqItems, setFaqItems] = useState<FaqItem[]>(catalog.faq);
  const topicOptions = catalog.topics;

  useEffect(() => {
    setFaqItems(catalog.faq);
  }, [catalog]);

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'home' | 'chat'>('home');
  const [subject, setSubject] = useState('');
  const [firstMessage, setFirstMessage] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentTicket, setCurrentTicket] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [reply, setReply] = useState('');
  const [chatFiles, setChatFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [supportPromos, setSupportPromos] = useState<
    Array<{
      id: string;
      title: string;
      description: string;
      badgeLabel: string | null;
      buttonLabel: string;
      ticketKind: string;
      ticketSubject: string | null;
      defaultMessage: string | null;
    }>
  >([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatFileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selectedId;

  const loadConfig = useCallback(async () => {
    try {
      const cfg = isClientPortal
        ? await apiService.clientGetSupportConfig()
        : await apiService.requesterGetSupportConfig();
      setSupportPromos(Array.isArray(cfg?.promos) ? cfg.promos : []);
      const fromApi = mapApiFaq(Array.isArray(cfg?.faq) ? cfg.faq : []);
      setFaqItems(fromApi.length ? fromApi : catalog.faq);
    } catch {
      setSupportPromos([]);
      setFaqItems(catalog.faq);
    }
  }, [isClientPortal, catalog.faq]);

  const loadTickets = useCallback(async () => {
    try {
      const data = isClientPortal
        ? await apiService.clientListSupportTickets()
        : await apiService.requesterListSupportTickets();
      setTickets(data.tickets || data || []);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось загрузить обращения');
    }
  }, [isClientPortal]);

  const openTicket = useCallback(
    async (id: string) => {
      setSelectedId(id);
      setView('chat');
      setLoading(true);
      setError('');
      try {
        const data = isClientPortal
          ? await apiService.clientGetSupportTicketMessages(id)
          : await apiService.requesterGetSupportTicketMessages(id);
        setMessages(data.messages || []);
        setCurrentTicket(data.ticket);
        await loadTickets();
        window.dispatchEvent(new CustomEvent('crm:support-unread', { detail: { count: 0 } }));
        // точный пересчёт после пометки прочитанным на сервере
        setTimeout(() => {
          void (async () => {
            try {
              const sum = isClientPortal
                ? await apiService.clientSupportUnreadSummary()
                : await apiService.requesterSupportUnreadSummary();
              window.dispatchEvent(
                new CustomEvent('crm:support-unread', {
                  detail: { count: Number(sum?.unreadTotal) || 0 },
                })
              );
            } catch {
              /* ignore */
            }
          })();
        }, 400);
      } catch (e: any) {
        setError(e?.response?.data?.error || 'Ошибка загрузки чата');
      } finally {
        setLoading(false);
      }
    },
    [isClientPortal, loadTickets]
  );

  useEffect(() => {
    if (!(open && view === 'chat' && selectedId)) return;
    const pull = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      try {
        const data = isClientPortal
          ? await apiService.clientGetSupportTicketMessages(selectedId)
          : await apiService.requesterGetSupportTicketMessages(selectedId);
        const next = data.messages || [];
        setMessages((prev) => {
          if (prev.length === next.length && prev.every((m, i) => m.id === next[i]?.id)) return prev;
          return next;
        });
        if (data.ticket) setCurrentTicket(data.ticket);
      } catch {
        /* ignore */
      }
    };
    const t = window.setInterval(pull, 12_000);
    const onVis = () => {
      if (document.visibilityState === 'visible') void pull();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [open, view, selectedId, isClientPortal]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, view]);

  const handleOpen = useCallback(async () => {
    if (isClientPortal && localStorage.getItem('clientApproved') === 'false') return;
    setError('');
    setSubject('');
    setFirstMessage('');
    setPendingFiles([]);
    setOpen(true);
    setView('home');
    setSelectedId(null);
    setCurrentTicket(null);
    setMessages([]);
    try {
      const [ticketsRes] = await Promise.all([
        isClientPortal
          ? apiService.clientListSupportTickets()
          : apiService.requesterListSupportTickets(),
        loadConfig(),
      ]);
      const list: any[] = ticketsRes?.tickets || ticketsRes || [];
      setTickets(list);
      // Приоритет: непрочитанный ответ → любое незакрытое → иначе форма «новое»
      const withUnread = list.find((t) => Number(t.unreadCount) > 0);
      const openTicketRow =
        withUnread ||
        list.find((t) => String(t.status || '').toUpperCase() !== 'CLOSED');
      if (openTicketRow?.id) {
        await openTicket(openTicketRow.id);
      }
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось открыть поддержку');
    }
  }, [isClientPortal, loadConfig, openTicket]);

  // При смене кабинета сбрасываем тему, чтобы не тащить маркетологскую в ЛК клиента.
  useEffect(() => {
    setSubject('');
  }, [audience]);

  useEffect(() => {
    if (hidden) return;
    const onOpen = () => void handleOpen();
    window.addEventListener('crm:open-support', onOpen);
    return () => window.removeEventListener('crm:open-support', onOpen);
  }, [hidden, handleOpen]);

  const refreshUnreadBadge = useCallback(async () => {
    if (hidden) {
      window.dispatchEvent(new CustomEvent('crm:support-unread', { detail: { count: 0 } }));
      return;
    }
    try {
      const data = isClientPortal
        ? await apiService.clientSupportUnreadSummary()
        : await apiService.requesterSupportUnreadSummary();
      const count = Number(data?.unreadTotal) || 0;
      window.dispatchEvent(new CustomEvent('crm:support-unread', { detail: { count } }));
    } catch {
      /* ignore */
    }
  }, [hidden, isClientPortal]);

  useEffect(() => {
    if (hidden) return;
    void refreshUnreadBadge();
    const t = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      void refreshUnreadBadge();
    }, 30_000);
    const onVis = () => {
      if (document.visibilityState === 'visible') void refreshUnreadBadge();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [hidden, refreshUnreadBadge]);

  useEffect(() => {
    if (!open) void refreshUnreadBadge();
  }, [open, tickets, refreshUnreadBadge]);

  const createTicket = async (opts: {
    subject?: string;
    message: string;
    kind?: 'GENERAL' | 'QUICK_SETUP';
    promoId?: string;
    files?: File[];
  }) => {
    setLoading(true);
    setError('');
    try {
      const data = isClientPortal
        ? await apiService.clientCreateSupportTicket({
            channel: 'SUPPORT',
            subject: opts.subject,
            message: opts.message,
            kind: opts.kind,
            promoId: opts.promoId,
            files: opts.files,
          })
        : await apiService.requesterCreateSupportTicket({
            channel: 'SUPPORT',
            subject: opts.subject,
            message: opts.message,
            kind: opts.kind,
            promoId: opts.promoId,
            files: opts.files,
          });
      const id = data.ticket?.id;
      if (!id) throw new Error('no ticket');
      setPendingFiles([]);
      setFirstMessage('');
      setSubject('');
      await openTicket(id);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Ошибка создания обращения');
    } finally {
      setLoading(false);
    }
  };

  const submitNew = async () => {
    if (!firstMessage.trim() && pendingFiles.length === 0) {
      setError('Опишите вопрос или приложите файл');
      return;
    }
    await createTicket({
      subject: subject.trim() || undefined,
      message: firstMessage.trim() || 'Вложение',
      kind: 'GENERAL',
      files: pendingFiles,
    });
  };

  const submitPromo = async (promo: (typeof supportPromos)[number]) => {
    await createTicket({
      promoId: promo.id,
      subject: promo.ticketSubject || promo.title,
      message: promo.defaultMessage || promo.description || promo.title,
      kind: promo.ticketKind === 'QUICK_SETUP' ? 'QUICK_SETUP' : 'GENERAL',
    });
  };

  const sendReply = async () => {
    if (!selectedId) return;
    if (!reply.trim() && chatFiles.length === 0) return;
    setLoading(true);
    setError('');
    try {
      if (isClientPortal) {
        await apiService.clientPostSupportMessage(selectedId, reply.trim() || 'Вложение', chatFiles);
      } else {
        await apiService.requesterPostSupportMessage(selectedId, reply.trim() || 'Вложение', chatFiles);
      }
      setReply('');
      setChatFiles([]);
      const data = isClientPortal
        ? await apiService.clientGetSupportTicketMessages(selectedId)
        : await apiService.requesterGetSupportTicketMessages(selectedId);
      setMessages(data.messages || []);
      if (data.ticket) setCurrentTicket(data.ticket);
      await loadTickets();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось отправить');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setView('home');
    setSelectedId(null);
    setCurrentTicket(null);
    setMessages([]);
    setError('');
  };

  const addPendingFiles = (list: FileList | null, target: 'home' | 'chat') => {
    if (!list?.length) return;
    const arr = Array.from(list).slice(0, 10);
    if (target === 'home') setPendingFiles((prev) => [...prev, ...arr].slice(0, 10));
    else setChatFiles((prev) => [...prev, ...arr].slice(0, 10));
  };

  if (hidden) return null;

  const statusLabel = currentTicket?.statusLabel || 'Новое обращение';

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth={false}
      PaperProps={{
        sx: {
          width: { xs: '100%', md: view === 'chat' ? 920 : 980 },
          maxWidth: '96vw',
          height: { xs: '100%', md: 640 },
          maxHeight: '92vh',
          borderRadius: { xs: 0, md: '16px' },
          overflow: 'hidden',
          m: { xs: 0, md: 2 },
        },
      }}
    >
      {view === 'home' ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1.05fr 1fr' },
            height: '100%',
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              p: { xs: 2.5, md: 3 },
              bgcolor: '#f7f9fc',
              borderRight: { md: '1px solid #e6edf5' },
              display: { xs: 'none', md: 'flex' },
              flexDirection: 'column',
              minHeight: 0,
              overflowY: 'auto',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1 }}>
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: '10px',
                  bgcolor: '#2463ed',
                  display: 'grid',
                  placeItems: 'center',
                  color: '#fff',
                }}
              >
                <SupportAgent sx={{ fontSize: 20 }} />
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 800, fontSize: 18, color: '#13213a' }}>
                  Служба поддержки
                </Typography>
              </Box>
            </Box>
            <Typography sx={{ fontSize: 13, color: '#6b7c94', lineHeight: 1.5, mb: 2 }}>
              Мы всегда рядом и поможем решить любые вопросы по работе системы.
            </Typography>

            <Box
              sx={{
                display: 'flex',
                gap: 1.25,
                alignItems: 'center',
                bgcolor: '#eaf2ff',
                border: '1px solid #d7e6ff',
                borderRadius: '12px',
                px: 1.5,
                py: 1.25,
                mb: 2,
              }}
            >
              <SupportAgent sx={{ color: '#2463ed', fontSize: 22 }} />
              <Typography sx={{ fontSize: 12.5, color: '#2f4f86', fontWeight: 600, lineHeight: 1.4 }}>
                Отвечаем быстро. Среднее время ответа — 5–15 минут.
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, flex: 1, minHeight: 0 }}>
              {faqItems.map((item) => (
                <Box
                  key={item.title}
                  component="button"
                  type="button"
                  onClick={() => setSubject(item.topic)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.25,
                    width: '100%',
                    textAlign: 'left',
                    border: '1px solid #e6edf5',
                    bgcolor: '#fff',
                    borderRadius: '12px',
                    px: 1.5,
                    py: 1.25,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    '&:hover': { borderColor: '#c9daf8', bgcolor: '#f8fbff' },
                  }}
                >
                  <Box sx={{ color: '#2463ed', display: 'grid', placeItems: 'center' }}>{item.icon}</Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 750, fontSize: 13, color: '#13213a' }}>{item.title}</Typography>
                    <Typography sx={{ fontSize: 11.5, color: '#8392a8' }}>{item.hint}</Typography>
                  </Box>
                  <ChevronRight sx={{ color: '#a0adc2', fontSize: 20 }} />
                </Box>
              ))}
            </Box>

            {supportPromos.map((promo) => (
              <Box
                key={promo.id}
                sx={{
                  mt: 2,
                  p: 1.75,
                  borderRadius: '12px',
                  bgcolor: '#eef5ff',
                  border: '1px solid #d9e8ff',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75, flexWrap: 'wrap' }}>
                  <Bolt sx={{ color: '#2463ed', fontSize: 20 }} />
                  <Typography sx={{ fontWeight: 800, fontSize: 14, color: '#13213a' }}>
                    {promo.title}
                  </Typography>
                  {promo.badgeLabel && (
                    <Chip
                      size="small"
                      label={promo.badgeLabel}
                      sx={{
                        height: 22,
                        fontSize: 10,
                        fontWeight: 700,
                        bgcolor: '#fff3cd',
                        color: '#8a6d1d',
                      }}
                    />
                  )}
                </Box>
                <Typography sx={{ fontSize: 12, color: '#4d6a99', lineHeight: 1.5, mb: 1.25 }}>
                  {promo.description}
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<Bolt />}
                  onClick={() => void submitPromo(promo)}
                  disabled={loading}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 800,
                    borderRadius: '8px',
                    bgcolor: '#2463ed',
                    '&:hover': { bgcolor: '#124fcf' },
                  }}
                >
                  {promo.buttonLabel}
                </Button>
              </Box>
            ))}

            {tickets.length > 0 && (
              <Button
                onClick={() => void openTicket(tickets[0].id)}
                sx={{ mt: 1.5, textTransform: 'none', fontWeight: 700, alignSelf: 'flex-start' }}
              >
                Открыть историю обращений →
              </Button>
            )}
          </Box>

          <Box
            sx={{
              p: { xs: 2.5, md: 3 },
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              height: '100%',
              overflow: 'hidden',
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5, flexShrink: 0 }}>
              <Box sx={{ minWidth: 0, pr: 1 }}>
                <Typography sx={{ fontWeight: 800, fontSize: 18, color: '#13213a' }}>Написать сообщение</Typography>
                <Typography sx={{ fontSize: 13, color: '#6b7c94', mt: 0.5, lineHeight: 1.45 }}>
                  Опишите вопрос — ответим в личном кабинете. Другие каналы связи не используем.
                </Typography>
              </Box>
              <IconButton onClick={handleClose} size="small" aria-label="Закрыть" sx={{ flexShrink: 0 }}>
                <Close />
              </IconButton>
            </Box>

            <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', pr: 0.5 }}>
              {error && (
                <Typography color="error" variant="body2" sx={{ mb: 1.5 }}>
                  {error}
                </Typography>
              )}

              <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#53657f', mb: 0.75 }}>Тема обращения</Typography>
              <TextField
                select
                fullWidth
                size="small"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                SelectProps={{ displayEmpty: true }}
                sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
              >
                <MenuItem value="">
                  <em>Выберите тему</em>
                </MenuItem>
                {topicOptions.map((t) => (
                  <MenuItem key={t} value={t}>
                    {t}
                  </MenuItem>
                ))}
              </TextField>

              <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#53657f', mb: 0.75 }}>Ваше сообщение</Typography>
              <TextField
                fullWidth
                multiline
                minRows={3}
                maxRows={8}
                value={firstMessage}
                onChange={(e) => setFirstMessage(e.target.value)}
                placeholder="Опишите ваш вопрос..."
                sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
              />

              <Box
                component="button"
                type="button"
                onClick={() => fileInputRef.current?.click()}
                sx={{
                  border: '1px dashed #c9d6ea',
                  borderRadius: '10px',
                  bgcolor: '#f8fbff',
                  px: 1.5,
                  py: 1.5,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.25,
                  fontFamily: 'inherit',
                  textAlign: 'left',
                  mb: 1,
                  width: '100%',
                }}
              >
                <AttachFile sx={{ color: '#2463ed' }} />
                <Typography sx={{ fontSize: 12.5, color: '#52647d' }}>
                  Прикрепить файл (скриншот, документ). До 10 файлов, до 10 МБ
                </Typography>
              </Box>
              <input
                ref={fileInputRef}
                type="file"
                hidden
                multiple
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                onChange={(e) => {
                  addPendingFiles(e.target.files, 'home');
                  e.target.value = '';
                }}
              />
              {pendingFiles.length > 0 && (
                <Typography sx={{ fontSize: 12, color: '#52647d', mb: 1 }}>
                  Выбрано файлов: {pendingFiles.length}{' '}
                  <Button size="small" onClick={() => setPendingFiles([])} sx={{ textTransform: 'none' }}>
                    Очистить
                  </Button>
                </Typography>
              )}
            </Box>

            <Box sx={{ flexShrink: 0, pt: 1.75, borderTop: '1px solid #eef2f7', mt: 1 }}>
              <Button
                variant="contained"
                fullWidth
                endIcon={loading ? <CircularProgress size={16} color="inherit" /> : <Send />}
                onClick={() => void submitNew()}
                disabled={loading}
                sx={{
                  textTransform: 'none',
                  fontWeight: 800,
                  py: 1.35,
                  borderRadius: '8px',
                  bgcolor: '#2463ed',
                  '&:hover': { bgcolor: '#124fcf' },
                }}
              >
                Отправить сообщение
              </Button>
            </Box>
          </Box>
        </Box>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '300px 1fr' }, height: '100%' }}>
          <Box
            sx={{
              display: { xs: selectedId ? 'none' : 'flex', md: 'flex' },
              flexDirection: 'column',
              borderRight: { md: '1px solid #e6edf5' },
              bgcolor: '#f7f9fc',
              minHeight: 0,
            }}
          >
            <Box sx={{ p: 2.25, pb: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                <SupportAgent sx={{ color: '#2463ed' }} />
                <Typography sx={{ fontWeight: 800, fontSize: 17, color: '#13213a' }}>Техподдержка</Typography>
              </Box>
              <Typography sx={{ fontSize: 12, color: '#6b7c94', lineHeight: 1.45 }}>
                Здесь вы можете задать любой вопрос и получить помощь от нашей команды
              </Typography>
            </Box>

            <Box sx={{ px: 1.5, mb: 1 }}>
              <Button
                fullWidth
                startIcon={<Add />}
                onClick={() => {
                  setView('home');
                  setSelectedId(null);
                  setError('');
                }}
                sx={{
                  textTransform: 'none',
                  fontWeight: 750,
                  borderRadius: '8px',
                  bgcolor: '#fff',
                  border: '1px solid #e6edf5',
                  color: '#2463ed',
                }}
              >
                Новое обращение
              </Button>
            </Box>

            <Box sx={{ flex: 1, overflowY: 'auto', px: 1.25, pb: 1 }}>
              {tickets.map((t) => {
                const active = t.id === selectedId;
                return (
                  <Box
                    key={t.id}
                    component="button"
                    type="button"
                    onClick={() => void openTicket(t.id)}
                    sx={{
                      width: '100%',
                      display: 'flex',
                      gap: 1.1,
                      alignItems: 'flex-start',
                      border: 'none',
                      textAlign: 'left',
                      fontFamily: 'inherit',
                      cursor: 'pointer',
                      borderRadius: '12px',
                      px: 1.25,
                      py: 1.15,
                      mb: 0.5,
                      bgcolor: active ? '#eaf2ff' : 'transparent',
                      '&:hover': { bgcolor: active ? '#eaf2ff' : '#eef3fa' },
                    }}
                  >
                    <Box
                      sx={{
                        width: 34,
                        height: 34,
                        borderRadius: '10px',
                        bgcolor: active ? '#2463ed' : '#e8eef8',
                        color: active ? '#fff' : '#2463ed',
                        display: 'grid',
                        placeItems: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <SupportAgent sx={{ fontSize: 18 }} />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 0.75 }}>
                        <Typography
                          sx={{
                            fontWeight: 750,
                            fontSize: 13,
                            color: '#13213a',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {t.subject || (t.kind === 'QUICK_SETUP' ? 'Быстрая настройка' : 'Техподдержка ProfSport')}
                        </Typography>
                        <Typography sx={{ fontSize: 10.5, color: '#91a0b4', flexShrink: 0 }}>
                          {formatListDate(t.lastMessageAt || t.updatedAt)}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.35 }}>
                        <Typography
                          sx={{
                            fontSize: 11.5,
                            color: '#8392a8',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            flex: 1,
                          }}
                        >
                          {t.lastMessagePreview || t.statusLabel}
                        </Typography>
                        {t.unreadCount > 0 && (
                          <Badge
                            badgeContent={t.unreadCount > 9 ? '9+' : t.unreadCount}
                            color="primary"
                            sx={{ '& .MuiBadge-badge': { fontSize: 10, height: 18, minWidth: 18 } }}
                          />
                        )}
                      </Box>
                    </Box>
                  </Box>
                );
              })}
              {tickets.length === 0 && (
                <Typography sx={{ px: 1.5, py: 2, fontSize: 13, color: '#8392a8' }}>
                  Пока нет обращений
                </Typography>
              )}
            </Box>

            <Box
              sx={{
                m: 1.5,
                mt: 0.5,
                p: 1.25,
                borderRadius: '12px',
                bgcolor: '#eaf2ff',
                display: 'flex',
                gap: 1,
                alignItems: 'center',
              }}
            >
              <AccessTime sx={{ color: '#2463ed', fontSize: 18 }} />
              <Typography sx={{ fontSize: 11.5, color: '#2f4f86', fontWeight: 600 }}>
                Среднее время ответа: 5–15 минут
              </Typography>
            </Box>
          </Box>

          <Box
            sx={{
              display: { xs: selectedId ? 'flex' : 'none', md: 'flex' },
              flexDirection: 'column',
              minHeight: 0,
              minWidth: 0,
            }}
          >
            <Box
              sx={{
                px: 2.25,
                py: 1.5,
                borderBottom: '1px solid #e6edf5',
                display: 'flex',
                alignItems: 'center',
                gap: 1.25,
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 800, fontSize: 15, color: '#13213a' }}>
                  {currentTicket?.subject || 'Техподдержка ProfSport'}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.35 }}>
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor:
                        currentTicket?.status === 'CLOSED'
                          ? '#94a3b8'
                          : currentTicket?.status === 'ASSIGNED'
                            ? '#22c55e'
                            : '#2463ed',
                    }}
                  />
                  <Typography sx={{ fontSize: 12, color: '#6b7c94' }}>{statusLabel}</Typography>
                </Box>
              </Box>
              <Button
                size="small"
                sx={{ display: { md: 'none' }, textTransform: 'none' }}
                onClick={() => setSelectedId(null)}
              >
                К списку
              </Button>
              <IconButton onClick={handleClose} size="small" aria-label="Закрыть">
                <Close />
              </IconButton>
            </Box>

            {error && (
              <Typography color="error" variant="body2" sx={{ px: 2, pt: 1 }}>
                {error}
              </Typography>
            )}

            <Box sx={{ flex: 1, overflowY: 'auto', px: 2.25, py: 2, bgcolor: '#fafbfd' }}>
              {loading && !messages.length ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : (
                messages.map((m) => {
                  const mine = isOwnMessage(m.authorType);
                  return (
                    <Box
                      key={m.id}
                      sx={{
                        display: 'flex',
                        justifyContent: mine ? 'flex-end' : 'flex-start',
                        mb: 1.5,
                      }}
                    >
                      <Box sx={{ maxWidth: '78%' }}>
                        <Typography
                          sx={{
                            fontSize: 11,
                            color: '#8392a8',
                            mb: 0.4,
                            textAlign: mine ? 'right' : 'left',
                          }}
                        >
                          {mine ? 'Вы' : 'Техподдержка ProfSport'}
                        </Typography>
                        <Box
                          sx={{
                            px: 1.5,
                            py: 1.15,
                            borderRadius: mine ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                            bgcolor: mine ? '#2463ed' : '#fff',
                            color: mine ? '#fff' : '#13213a',
                            border: mine ? 'none' : '1px solid #e6edf5',
                            boxShadow: mine ? 'none' : '0 2px 8px rgba(29,59,105,.04)',
                          }}
                        >
                          <Typography sx={{ fontSize: 13.5, lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>
                            {m.body}
                          </Typography>
                          {(m.attachments || []).length > 0 && (
                            <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                              {m.attachments.map((a: any) => (
                                <SupportAttachmentBubble
                                  key={a.id}
                                  mode={isClientPortal ? 'client' : 'requester'}
                                  attachment={a}
                                  linkColor={mine ? '#dbe7ff' : '#2463ed'}
                                />
                              ))}
                            </Box>
                          )}
                        </Box>
                        <Typography
                          sx={{
                            fontSize: 10.5,
                            color: '#91a0b4',
                            mt: 0.4,
                            textAlign: mine ? 'right' : 'left',
                          }}
                        >
                          {formatTime(m.createdAt)}
                        </Typography>
                      </Box>
                    </Box>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </Box>

            <Box
              sx={{
                px: 2,
                py: 1.5,
                borderTop: '1px solid #e6edf5',
                display: 'flex',
                alignItems: 'flex-end',
                gap: 1,
                bgcolor: '#fff',
              }}
            >
              <IconButton
                onClick={() => chatFileInputRef.current?.click()}
                disabled={currentTicket?.status === 'CLOSED'}
                aria-label="Прикрепить файл"
              >
                <AttachFile />
              </IconButton>
              <input
                ref={chatFileInputRef}
                type="file"
                hidden
                multiple
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                onChange={(e) => {
                  addPendingFiles(e.target.files, 'chat');
                  e.target.value = '';
                }}
              />
              <TextField
                fullWidth
                multiline
                maxRows={4}
                size="small"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Напишите сообщение..."
                disabled={currentTicket?.status === 'CLOSED'}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void sendReply();
                  }
                }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
              />
              <IconButton
                color="primary"
                onClick={() => void sendReply()}
                disabled={loading || currentTicket?.status === 'CLOSED' || (!reply.trim() && !chatFiles.length)}
                sx={{
                  bgcolor: colors.primary,
                  color: '#fff',
                  '&:hover': { bgcolor: colors.primaryDark },
                  '&.Mui-disabled': { bgcolor: '#c5d0e0', color: '#fff' },
                }}
                aria-label="Отправить"
              >
                {loading ? <CircularProgress size={18} color="inherit" /> : <Send sx={{ fontSize: 18 }} />}
              </IconButton>
            </Box>
            {chatFiles.length > 0 && (
              <Typography sx={{ px: 2, pb: 1, fontSize: 12, color: '#52647d' }}>
                Файлов к отправке: {chatFiles.length}{' '}
                <Button size="small" onClick={() => setChatFiles([])} sx={{ textTransform: 'none' }}>
                  Очистить
                </Button>
              </Typography>
            )}
          </Box>
        </Box>
      )}
    </Dialog>
  );
};

export default SupportFAB;
