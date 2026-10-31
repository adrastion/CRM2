import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Typography,
  Tabs,
  Tab,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Button,
  TextField,
  Chip,
  FormControlLabel,
  Switch,
  Stack,
  List,
  ListItemButton,
  ListItemText,
  Badge,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  IconButton,
} from '@mui/material';
import {
  AttachFile,
  ArrowUpward,
  ArrowDownward,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { apiService } from '../services/api';
import SupportAttachmentBubble from '../components/support/SupportAttachmentBubble';

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type PromoForm = {
  title: string;
  description: string;
  buttonLabel: string;
  badgeLabel: string;
  audience: 'school' | 'marketer' | 'client' | 'all';
  ticketKind: 'GENERAL' | 'QUICK_SETUP';
  accountScope: 'ALL' | 'NEW';
  newAccountDays: number;
  autoReplyEnabled: boolean;
  autoReplyBody: string;
  isActive: boolean;
  sortOrder: number;
};

type AutoReplyAttachment = {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt?: string;
};

type KnowledgeForm = {
  title: string;
  body: string;
  audience: string;
  hint: string;
  topic: string;
  iconKey: string;
  sortOrder: number;
  isActive: boolean;
};

const emptyPromoForm = (): PromoForm => ({
  title: '',
  description: '',
  buttonLabel: '',
  badgeLabel: 'Только в рамках акции',
  audience: 'school',
  ticketKind: 'GENERAL',
  accountScope: 'ALL',
  newAccountDays: 30,
  autoReplyEnabled: false,
  autoReplyBody: '',
  isActive: true,
  sortOrder: 100,
});

const emptyKnowledgeForm = (): KnowledgeForm => ({
  title: '',
  body: '',
  audience: 'all',
  hint: '',
  topic: '',
  iconKey: 'settings',
  sortOrder: 0,
  isActive: true,
});

const AUTO_REPLY_ACCEPT = 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt';

function formatTime(iso?: string | null) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function ticketTitle(t: any): string {
  if (t.channel === 'DESIGNER_SUPERADMIN') return 'Дизайнер ↔ админы';
  if (t.subject) return t.subject;
  if (t.kind === 'QUICK_SETUP') return 'Быстрая настройка';
  return t.tenant?.name || 'Обращение';
}

function ticketSubtitle(t: any): string {
  if (t.marketer) {
    const name =
      [t.marketer.firstName, t.marketer.lastName].filter(Boolean).join(' ') || t.marketer.name;
    return `Маркетолог · ${name || t.marketer.email}`;
  }
  if (t.channel === 'DESIGNER_SUPERADMIN' && t.assignedStaff) {
    return `${t.assignedStaff.firstName} ${t.assignedStaff.lastName}`;
  }
  return t.tenant?.name || '—';
}

function AutoReplyFilesBlock({
  attachments,
  busy,
  onUpload,
  onDelete,
  onDownload,
}: {
  attachments: AutoReplyAttachment[];
  busy?: boolean;
  onUpload: (files: FileList | null) => void;
  onDelete: (id: string) => void;
  onDownload: (id: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <Box sx={{ mt: 1 }}>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
        Файлы автоответа (текст и/или файлы — достаточно для срабатывания)
      </Typography>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          accept={AUTO_REPLY_ACCEPT}
          onChange={(e) => {
            onUpload(e.target.files);
            e.target.value = '';
          }}
        />
        <Button
          size="small"
          startIcon={<AttachFile />}
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          Прикрепить файл
        </Button>
        {attachments.map((a) => (
          <Chip
            key={a.id}
            size="small"
            icon={<AttachFile fontSize="small" />}
            label={a.originalName}
            onClick={() => onDownload(a.id)}
            onDelete={busy ? undefined : () => onDelete(a.id)}
          />
        ))}
      </Stack>
    </Box>
  );
}

const SuperAdminSupportHub: React.FC = () => {
  const [tab, setTab] = useState(0);
  const [tickets, setTickets] = useState<any[]>([]);
  const [supportOnline, setSupportOnline] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [recordings, setRecordings] = useState<any[]>([]);
  const [articles, setArticles] = useState<any[]>([]);
  const [promos, setPromos] = useState<any[]>([]);
  const [canned, setCanned] = useState<any[]>([]);
  const [reply, setReply] = useState('');
  const [filterChannel, setFilterChannel] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterKind, setFilterKind] = useState('');
  const [filterQ, setFilterQ] = useState('');
  const [waitingReplyOnly, setWaitingReplyOnly] = useState(false);
  const [promoForm, setPromoForm] = useState<PromoForm>(emptyPromoForm());
  const [promoDialogOpen, setPromoDialogOpen] = useState(false);
  const [editingPromoId, setEditingPromoId] = useState<string | null>(null);
  const [promoError, setPromoError] = useState('');
  const [promoBusy, setPromoBusy] = useState(false);
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(false);
  const [autoReplyBody, setAutoReplyBody] = useState('');
  const [autoReplyAttachments, setAutoReplyAttachments] = useState<AutoReplyAttachment[]>([]);
  const [onlineMinutes, setOnlineMinutes] = useState(10);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [attachBusy, setAttachBusy] = useState(false);
  const [newPromoFiles, setNewPromoFiles] = useState<File[]>([]);
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const [replyBusy, setReplyBusy] = useState(false);
  const [replyError, setReplyError] = useState('');
  const [knowledgeForm, setKnowledgeForm] = useState<KnowledgeForm>(emptyKnowledgeForm());
  const [editingArticleId, setEditingArticleId] = useState<string | null>(null);
  const [kbBusy, setKbBusy] = useState(false);
  const [cannedTitle, setCannedTitle] = useState('');
  const [cannedBody, setCannedBody] = useState('');
  const replyFileRef = useRef<HTMLInputElement>(null);
  const newPromoFileRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadTickets = useCallback(async () => {
    const data = await apiService.superAdminListSupportTickets({
      channel: filterChannel || undefined,
      status: filterStatus || undefined,
      kind: filterKind || undefined,
      q: filterQ.trim() || undefined,
      waitingReply: waitingReplyOnly || undefined,
    });
    setTickets(data.tickets || []);
    setSupportOnline(!!data.supportOnline);
  }, [filterChannel, filterStatus, filterKind, filterQ, waitingReplyOnly]);

  const loadDetail = useCallback(async (id: string) => {
    const data = await apiService.superAdminGetSupportTicketDetail(id);
    setDetail(data);
    return data;
  }, []);

  const loadRecordings = async () => {
    const data = await apiService.superAdminListDesignerRecordings();
    setRecordings(data.recordings || []);
  };

  const loadKnowledge = async () => {
    const data = await apiService.superAdminListSupportKnowledge();
    setArticles(data.articles || []);
  };

  const loadPromos = async () => {
    const data = await apiService.superAdminListSupportPromos();
    setPromos(data.promos || []);
  };

  const loadCanned = async () => {
    const data = await apiService.superAdminListCannedReplies();
    setCanned(data.replies || []);
  };

  const loadAutoReplySettings = async () => {
    const data = await apiService.superAdminGetSupportAutoReplySettings();
    setAutoReplyEnabled(!!data.supportAutoReplyEnabled);
    setAutoReplyBody(data.supportAutoReplyBody || '');
    setOnlineMinutes(data.supportOnlineMinutes || 10);
    setAutoReplyAttachments(data.attachments || []);
  };

  useEffect(() => {
    if (tab === 0) {
      loadTickets().catch(() => undefined);
      loadCanned().catch(() => undefined);
    }
    if (tab === 1) loadRecordings().catch(() => undefined);
    if (tab === 2) {
      loadPromos().catch(() => undefined);
      loadAutoReplySettings().catch(() => undefined);
      loadCanned().catch(() => undefined);
    }
    if (tab === 3) loadKnowledge().catch(() => undefined);
  }, [tab, loadTickets]);

  useEffect(() => {
    if (tab !== 0) return undefined;
    const iv = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      void loadTickets();
    }, 15_000);
    return () => window.clearInterval(iv);
  }, [tab, loadTickets]);

  useEffect(() => {
    if (!selectedId || tab !== 0) return undefined;
    const pull = async () => {
      if (document.visibilityState === 'hidden') return;
      try {
        const data = await apiService.superAdminGetSupportTicketDetail(selectedId);
        setDetail((prev: any) => {
          const prevIds = (prev?.messages || []).map((m: any) => m.id).join(',');
          const nextIds = (data.messages || []).map((m: any) => m.id).join(',');
          if (prevIds === nextIds && prev?.status === data.status) return prev;
          return data;
        });
        void loadTickets();
      } catch {
        /* ignore */
      }
    };
    const iv = window.setInterval(pull, 12_000);
    return () => window.clearInterval(iv);
  }, [selectedId, tab, loadTickets]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [detail?.messages?.length]);

  const openTicket = async (id: string) => {
    setSelectedId(id);
    setReply('');
    setReplyFiles([]);
    setReplyError('');
    try {
      await loadDetail(id);
      void loadTickets();
    } catch (e: any) {
      setReplyError(e?.response?.data?.error || 'Не удалось открыть');
    }
  };

  const sendReply = async () => {
    if (!selectedId) return;
    if (!reply.trim() && !replyFiles.length) {
      setReplyError('Укажите сообщение или приложите файл');
      return;
    }
    setReplyBusy(true);
    setReplyError('');
    try {
      await apiService.superAdminPostSupportMessage(
        selectedId,
        reply.trim(),
        replyFiles.length ? replyFiles : undefined
      );
    setReply('');
      setReplyFiles([]);
      await loadDetail(selectedId);
      await loadTickets();
    } catch (e: any) {
      setReplyError(e?.response?.data?.error || 'Не удалось отправить');
    } finally {
      setReplyBusy(false);
    }
  };

  const closeTicket = async () => {
    if (!selectedId) return;
    try {
      await apiService.superAdminCloseSupportTicket(selectedId);
      await loadDetail(selectedId);
      await loadTickets();
    } catch (e: any) {
      setReplyError(e?.response?.data?.error || 'Не удалось закрыть');
    }
  };

  const reopenTicket = async () => {
    if (!selectedId) return;
    try {
      await apiService.superAdminReopenSupportTicket(selectedId);
      await loadDetail(selectedId);
      await loadTickets();
    } catch (e: any) {
      setReplyError(e?.response?.data?.error || 'Не удалось переоткрыть');
    }
  };

  const downloadRecording = async (id: string) => {
    const { blob, filename } = await apiService.superAdminDownloadDesignerRecording(id);
    triggerBlobDownload(blob, filename);
  };

  const downloadAutoReplyAttachment = async (id: string) => {
    try {
      const { blob, filename } = await apiService.superAdminDownloadAutoReplyAttachmentBlob(id);
      triggerBlobDownload(blob, filename);
    } catch {
      setPromoError('Не удалось скачать файл');
    }
  };

  const uploadAutoReplyAttachment = async (promoId: string | null, files: FileList | null) => {
    if (!files?.length) return;
    setAttachBusy(true);
    setPromoError('');
    try {
      for (const file of Array.from(files).slice(0, 10)) {
        await apiService.superAdminUploadAutoReplyAttachment(file, promoId);
      }
      if (promoId) await loadPromos();
      else await loadAutoReplySettings();
    } catch (e: any) {
      setPromoError(e?.response?.data?.error || 'Не удалось загрузить файл');
    } finally {
      setAttachBusy(false);
    }
  };

  const deleteAutoReplyAttachment = async (id: string, promoId: string | null) => {
    setAttachBusy(true);
    setPromoError('');
    try {
      await apiService.superAdminDeleteAutoReplyAttachment(id);
      if (promoId) await loadPromos();
      else await loadAutoReplySettings();
    } catch (e: any) {
      setPromoError(e?.response?.data?.error || 'Не удалось удалить файл');
    } finally {
      setAttachBusy(false);
    }
  };

  const saveGlobalAutoReply = async () => {
    setSettingsBusy(true);
    setPromoError('');
    try {
      const data = await apiService.superAdminUpdateSupportAutoReplySettings({
        supportAutoReplyEnabled: autoReplyEnabled,
        supportAutoReplyBody: autoReplyBody.trim() || null,
        supportOnlineMinutes: onlineMinutes,
      });
      setAutoReplyAttachments(data.attachments || []);
    } catch (e: any) {
      setPromoError(e?.response?.data?.error || 'Не удалось сохранить автоответ');
    } finally {
      setSettingsBusy(false);
    }
  };

  const openCreatePromo = () => {
    setEditingPromoId(null);
    setPromoForm(emptyPromoForm());
    setNewPromoFiles([]);
    setPromoDialogOpen(true);
  };

  const openEditPromo = (p: any) => {
    setEditingPromoId(p.id);
    setPromoForm({
      title: p.title || '',
      description: p.description || '',
      buttonLabel: p.buttonLabel || '',
      badgeLabel: p.badgeLabel || '',
      audience: p.audience || 'school',
      ticketKind: p.ticketKind === 'QUICK_SETUP' ? 'QUICK_SETUP' : 'GENERAL',
      accountScope: p.accountScope === 'NEW' ? 'NEW' : 'ALL',
      newAccountDays: p.newAccountDays || 30,
      autoReplyEnabled: !!p.autoReplyEnabled,
      autoReplyBody: p.autoReplyBody || '',
      isActive: !!p.isActive,
      sortOrder: p.sortOrder ?? 100,
    });
    setNewPromoFiles([]);
    setPromoDialogOpen(true);
  };

  const savePromoDialog = async () => {
    setPromoBusy(true);
    setPromoError('');
    try {
      const payload = {
        title: promoForm.title.trim(),
        description: promoForm.description.trim(),
        buttonLabel: promoForm.buttonLabel.trim(),
        badgeLabel: promoForm.badgeLabel.trim() || null,
        audience: promoForm.audience,
        ticketKind: promoForm.ticketKind,
        accountScope: promoForm.accountScope,
        newAccountDays: promoForm.newAccountDays,
        autoReplyEnabled: promoForm.autoReplyEnabled,
        autoReplyBody: promoForm.autoReplyBody.trim() || null,
        isActive: promoForm.isActive,
        sortOrder: promoForm.sortOrder,
        ticketSubject: promoForm.title.trim(),
        defaultMessage: promoForm.description.trim(),
      };
      if (editingPromoId) {
        await apiService.superAdminUpdateSupportPromo(editingPromoId, payload);
        for (const file of newPromoFiles.slice(0, 10)) {
          await apiService.superAdminUploadAutoReplyAttachment(file, editingPromoId);
        }
      } else {
        const created = await apiService.superAdminCreateSupportPromo(payload);
        const promoId = created?.promo?.id as string | undefined;
        if (promoId && newPromoFiles.length) {
          for (const file of newPromoFiles.slice(0, 10)) {
            await apiService.superAdminUploadAutoReplyAttachment(file, promoId);
          }
        }
      }
      setPromoDialogOpen(false);
      setNewPromoFiles([]);
      await loadPromos();
    } catch (e: any) {
      setPromoError(e?.response?.data?.error || 'Не удалось сохранить');
    } finally {
      setPromoBusy(false);
    }
  };

  const deletePromo = async (id: string) => {
    setPromoBusy(true);
    setPromoError('');
    try {
      await apiService.superAdminDeleteSupportPromo(id);
      await loadPromos();
    } catch (e: any) {
      setPromoError(e?.response?.data?.error || 'Не удалось удалить');
    } finally {
      setPromoBusy(false);
    }
  };

  const movePromo = async (id: string, dir: -1 | 1) => {
    const idx = promos.findIndex((p) => p.id === id);
    if (idx < 0) return;
    const j = idx + dir;
    if (j < 0 || j >= promos.length) return;
    const next = [...promos];
    const tmp = next[idx];
    next[idx] = next[j];
    next[j] = tmp;
    setPromoBusy(true);
    try {
      const data = await apiService.superAdminReorderSupportPromos(next.map((p) => p.id));
      setPromos(data.promos || next);
    } catch (e: any) {
      setPromoError(e?.response?.data?.error || 'Не удалось изменить порядок');
    } finally {
      setPromoBusy(false);
    }
  };

  const togglePromoActive = async (p: any) => {
    setPromoBusy(true);
    try {
      await apiService.superAdminUpdateSupportPromo(p.id, { isActive: !p.isActive });
      await loadPromos();
    } catch (e: any) {
      setPromoError(e?.response?.data?.error || 'Не удалось обновить');
    } finally {
      setPromoBusy(false);
    }
  };

  const saveKnowledge = async () => {
    setKbBusy(true);
    try {
      const payload = {
        title: knowledgeForm.title.trim(),
        body: knowledgeForm.body.trim(),
        audience: knowledgeForm.audience,
        hint: knowledgeForm.hint.trim() || null,
        topic: knowledgeForm.topic.trim() || null,
        iconKey: knowledgeForm.iconKey || null,
        sortOrder: knowledgeForm.sortOrder,
        isActive: knowledgeForm.isActive,
      };
      if (editingArticleId) {
        await apiService.superAdminUpdateSupportKnowledge(editingArticleId, payload);
      } else {
        await apiService.superAdminCreateSupportKnowledge(payload);
      }
      setKnowledgeForm(emptyKnowledgeForm());
      setEditingArticleId(null);
      await loadKnowledge();
    } catch (e: any) {
      setPromoError(e?.response?.data?.error || 'Не удалось сохранить статью');
    } finally {
      setKbBusy(false);
    }
  };

  const createCanned = async () => {
    if (!cannedTitle.trim() || !cannedBody.trim()) return;
    try {
      await apiService.superAdminCreateCannedReply({
        title: cannedTitle.trim(),
        body: cannedBody.trim(),
      });
      setCannedTitle('');
      setCannedBody('');
      await loadCanned();
    } catch (e: any) {
      setPromoError(e?.response?.data?.error || 'Не удалось создать шаблон');
    }
  };

  const editingPromoAttachments =
    editingPromoId
      ? ((promos.find((p) => p.id === editingPromoId)?.autoReplyAttachments ||
          []) as AutoReplyAttachment[])
      : [];

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }} flexWrap="wrap" useFlexGap>
        <Typography variant="h5">Support Hub</Typography>
        {tab === 0 && (
          <Chip
            size="small"
            color={supportOnline ? 'success' : 'warning'}
            label={supportOnline ? 'SUPPORT онлайн' : 'SUPPORT офлайн'}
          />
        )}
      </Stack>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Обращения" />
        <Tab label="Видеозаписи" />
        <Tab label="Настройки виджета" />
        <Tab label="База знаний" />
      </Tabs>

      {tab === 0 && (
        <Box>
          <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap alignItems="center">
            <TextField
              select
              size="small"
              label="Канал"
              value={filterChannel}
              onChange={(e) => setFilterChannel(e.target.value)}
              SelectProps={{ native: true }}
              sx={{ minWidth: 160 }}
            >
              <option value="">Все</option>
              <option value="SUPPORT">Техподдержка</option>
              <option value="DESIGNER">Дизайнеры</option>
              <option value="DESIGNER_SUPERADMIN">Дизайнер ↔ админы</option>
            </TextField>
            <TextField
              select
                      size="small"
              label="Статус"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              SelectProps={{ native: true }}
              sx={{ minWidth: 140 }}
            >
              <option value="">Все</option>
              <option value="WAITING">Ожидает</option>
              <option value="ASSIGNED">В работе</option>
              <option value="CLOSED">Закрыто</option>
            </TextField>
            <TextField
              select
              size="small"
              label="Тип"
              value={filterKind}
              onChange={(e) => setFilterKind(e.target.value)}
              SelectProps={{ native: true }}
              sx={{ minWidth: 140 }}
            >
              <option value="">Все</option>
              <option value="GENERAL">Обычное</option>
              <option value="QUICK_SETUP">Быстрая настройка</option>
            </TextField>
            <TextField
              size="small"
              label="Поиск"
              value={filterQ}
              onChange={(e) => setFilterQ(e.target.value)}
              sx={{ minWidth: 180 }}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={waitingReplyOnly}
                  onChange={(_, v) => setWaitingReplyOnly(v)}
                  size="small"
                />
              }
              label="Ждут ответа"
            />
            <Button onClick={() => void loadTickets()}>Обновить</Button>
          </Stack>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '380px 1fr' },
              gap: 2,
              minHeight: 560,
            }}
          >
            <Paper sx={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <Typography variant="subtitle2" sx={{ px: 2, pt: 1.5 }}>
                Очередь · {tickets.length}
              </Typography>
              <List dense sx={{ overflowY: 'auto', flex: 1, maxHeight: 620 }}>
                {tickets.map((t) => (
                  <ListItemButton
                    key={t.id}
                    selected={selectedId === t.id}
                    onClick={() => void openTicket(t.id)}
                    alignItems="flex-start"
                  >
                    <ListItemText
                      primary={
                        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                          <Typography variant="body2" fontWeight={700} noWrap sx={{ maxWidth: 200 }}>
                            {ticketTitle(t)}
                          </Typography>
                          {t.kind === 'QUICK_SETUP' && (
                            <Chip size="small" color="primary" label="Акция" />
                          )}
                          {(t.unreadCount > 0 || t.needsReply) && (
                            <Badge
                              badgeContent={t.unreadCount || '!'}
                              color="error"
                              sx={{ '& .MuiBadge-badge': { position: 'static', transform: 'none' } }}
                            />
                          )}
                        </Stack>
                      }
                      secondary={
                        <>
                          <Typography variant="caption" display="block" color="text.secondary">
                            {ticketSubtitle(t)} · {t.statusLabel || t.status}
                            {t.needsReply && t.waitingMinutes != null
                              ? ` · ждёт ${t.waitingMinutes} мин`
                              : ''}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            noWrap
                            display="block"
                            sx={{ maxWidth: 300 }}
                          >
                            {t.lastMessage?.body || 'Нет сообщений'}
                          </Typography>
                          <Typography variant="caption" color="text.disabled">
                            {formatTime(t.lastMessage?.createdAt || t.updatedAt)}
                          </Typography>
                        </>
                      }
                    />
                  </ListItemButton>
                ))}
                {!tickets.length && (
                  <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                    Нет обращений по фильтру
                  </Typography>
                )}
              </List>
            </Paper>

            <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', minHeight: 560 }}>
              {!selectedId || !detail ? (
                <Typography color="text.secondary">Выберите обращение слева</Typography>
              ) : (
                <>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="flex-start"
                    spacing={1}
                    sx={{ mb: 1 }}
                    flexWrap="wrap"
                    useFlexGap
                  >
                    <Box>
                      <Typography variant="h6">{ticketTitle(detail)}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {ticketSubtitle(detail)}
                        {detail.tenant?.createdAt
                          ? ` · школа с ${formatTime(detail.tenant.createdAt)}`
                          : ''}
              </Typography>
                      {detail.assignedStaff && (
                        <Typography variant="caption" color="text.secondary">
                          Назначен: {detail.assignedStaff.firstName} {detail.assignedStaff.lastName}
                        </Typography>
                      )}
                      {detail.tenant?.id && detail.channel !== 'DESIGNER_SUPERADMIN' && (
                        <Button
                          component={RouterLink}
                          to={`/admin/dashboard?section=tenants`}
                          size="small"
                          sx={{ mt: 0.5, display: 'inline-flex' }}
                        >
                          К тенантам
                        </Button>
                      )}
                </Box>
                    <Stack direction="row" spacing={1}>
                      {detail.status === 'CLOSED' ? (
                        <Button size="small" variant="outlined" onClick={() => void reopenTicket()}>
                          Переоткрыть
                        </Button>
                      ) : detail.channel !== 'DESIGNER_SUPERADMIN' ? (
                        <Button size="small" color="inherit" onClick={() => void closeTicket()}>
                          Закрыть
                        </Button>
                      ) : null}
                      <Chip size="small" label={detail.statusLabel || detail.status} />
                      {detail.needsReply && (
                        <Chip
                          size="small"
                          color="warning"
                          label={`Ждёт ${detail.waitingMinutes || 0} мин`}
                        />
                      )}
                    </Stack>
                  </Stack>

                  <Box
                    sx={{
                      flex: 1,
                      overflowY: 'auto',
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                      p: 1.5,
                      mb: 1.5,
                      maxHeight: 360,
                    }}
                  >
                    {(detail.messages || []).map((m: any) => {
                      const staff = m.authorType === 'platform_staff' || m.authorType === 'super_admin';
                      return (
                        <Box
                          key={m.id}
                          sx={{
                            my: 1,
                            p: 1.25,
                            borderRadius: 2,
                            maxWidth: '85%',
                            ml: staff ? 0 : 'auto',
                            bgcolor: staff ? 'action.hover' : 'primary.main',
                            color: staff ? 'text.primary' : 'primary.contrastText',
                          }}
                        >
                          <Typography
                            variant="caption"
                            sx={{ opacity: 0.8, display: 'block' }}
                            color={staff ? 'text.secondary' : 'inherit'}
                          >
                            {m.isAutoReply
                              ? 'Автоответ'
                              : staff
                                ? 'Поддержка'
                                : 'Клиент'}{' '}
                            · {formatTime(m.createdAt)}
                          </Typography>
                          {m.body && (
                            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 0.5 }}>
                              {m.body}
                            </Typography>
                          )}
                          {(m.attachments || []).length > 0 && (
                            <Stack spacing={1} sx={{ mt: 1 }}>
                              {m.attachments.map((a: any) => (
                                <SupportAttachmentBubble
                                  key={a.id}
                                  mode="superAdmin"
                                  attachment={a}
                                  linkColor={staff ? undefined : 'inherit'}
                                />
                              ))}
                            </Stack>
                          )}
                        </Box>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </Box>

                  {replyError && (
                    <Alert severity="error" sx={{ mb: 1 }} onClose={() => setReplyError('')}>
                      {replyError}
                    </Alert>
                  )}

                  {detail.status !== 'CLOSED' && (
                    <>
                      {canned.filter((c) => c.isActive).length > 0 && (
                        <Stack direction="row" spacing={0.75} sx={{ mb: 1 }} flexWrap="wrap" useFlexGap>
                          {canned
                            .filter((c) => c.isActive)
                            .map((c) => (
                              <Chip
                                key={c.id}
                                size="small"
                                label={c.title}
                                onClick={() =>
                                  setReply((prev) => (prev ? `${prev}\n${c.body}` : c.body))
                                }
                              />
                            ))}
                        </Stack>
                      )}
              <TextField
                fullWidth
                multiline
                minRows={2}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Ответ от администратора платформы"
                      />
                      <Stack
                        direction="row"
                        spacing={1}
                        alignItems="center"
                sx={{ mt: 1 }}
                        flexWrap="wrap"
                        useFlexGap
                      >
                        <input
                          ref={replyFileRef}
                          type="file"
                          multiple
                          hidden
                          accept={AUTO_REPLY_ACCEPT}
                          onChange={(e) => {
                            const list = Array.from(e.target.files || []).slice(0, 10);
                            setReplyFiles((prev) => [...prev, ...list].slice(0, 10));
                            e.target.value = '';
                          }}
                        />
                        <Button
                          size="small"
                          startIcon={<AttachFile />}
                          onClick={() => replyFileRef.current?.click()}
                          disabled={replyBusy}
                        >
                          Прикрепить
                        </Button>
                        {replyFiles.map((f, i) => (
                          <Chip
                            key={`${f.name}-${i}`}
                            size="small"
                            label={f.name}
                            onDelete={() =>
                              setReplyFiles((prev) => prev.filter((_, idx) => idx !== i))
                            }
                          />
                        ))}
                        <Button
                          variant="contained"
                          disabled={replyBusy}
                          onClick={() => void sendReply()}
                        >
                          Отправить
                        </Button>
                      </Stack>
                    </>
                  )}
                </>
          )}
        </Paper>
          </Box>
        </Box>
      )}

      {tab === 1 && (
        <Paper sx={{ p: 2 }}>
          <Button onClick={() => void loadRecordings()} sx={{ mb: 2 }}>
            Обновить
          </Button>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Начало</TableCell>
                <TableCell>Истекает</TableCell>
                <TableCell>Кто загрузил</TableCell>
                <TableCell>Файл</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {recordings.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{new Date(r.startedAt).toLocaleString()}</TableCell>
                  <TableCell>{new Date(r.expiresAt).toLocaleString()}</TableCell>
                  <TableCell>
                    {r.recordedBy?.email ??
                      (r.uploadedByRequesterKind
                        ? `Обращение (${r.uploadedByRequesterKind})`
                        : '—')}
                  </TableCell>
                  <TableCell>
                    <Button size="small" onClick={() => void downloadRecording(r.id)}>
                      Скачать
                    </Button>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="small"
                      color="error"
                      onClick={async () => {
                      await apiService.superAdminDeleteDesignerRecording(r.id);
                        void loadRecordings();
                      }}
                    >
                      Удалить
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {tab === 2 && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Настройки виджета поддержки
          </Typography>
          {promoError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setPromoError('')}>
              {promoError}
            </Alert>
          )}

          <Paper variant="outlined" sx={{ p: 2, mb: 3, maxWidth: 720 }}>
            <Typography fontWeight={700} gutterBottom>
              Глобальный автоответ
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={autoReplyEnabled}
                  onChange={(_, v) => setAutoReplyEnabled(v)}
                />
              }
              label="Включить глобальный автоответ"
            />
            <TextField
              fullWidth
              multiline
              minRows={3}
              size="small"
              label="Текст автоответа"
              value={autoReplyBody}
              onChange={(e) => setAutoReplyBody(e.target.value)}
              sx={{ mt: 1, mb: 1 }}
            />
            <AutoReplyFilesBlock
              attachments={autoReplyAttachments}
              busy={attachBusy || settingsBusy}
              onUpload={(files) => void uploadAutoReplyAttachment(null, files)}
              onDelete={(id) => void deleteAutoReplyAttachment(id, null)}
              onDownload={(id) => void downloadAutoReplyAttachment(id)}
            />
            <TextField
              type="number"
              size="small"
              label="Минут без активности = поддержка офлайн"
              value={onlineMinutes}
              onChange={(e) => setOnlineMinutes(Number(e.target.value) || 10)}
              sx={{ mt: 1.5, mb: 1.5, maxWidth: 320 }}
              inputProps={{ min: 1, max: 120 }}
            />
            <Button
              variant="contained"
              disabled={settingsBusy}
              onClick={() => void saveGlobalAutoReply()}
            >
              Сохранить автоответ и порог онлайна
            </Button>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2, mb: 3, maxWidth: 720 }}>
            <Typography fontWeight={700} gutterBottom>
              Быстрые ответы
            </Typography>
            <Stack spacing={1} sx={{ mb: 2 }}>
              {canned.map((c) => (
                <Stack
                  key={c.id}
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  justifyContent="space-between"
                >
                  <Box>
                    <Typography fontWeight={600}>{c.title}</Typography>
                    <Typography variant="caption" color="text.secondary" noWrap display="block">
                      {c.body}
                    </Typography>
                  </Box>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={async () => {
                      await apiService.superAdminDeleteCannedReply(c.id);
                      void loadCanned();
                    }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Stack>
              ))}
            </Stack>
            <Stack spacing={1} direction={{ xs: 'column', sm: 'row' }}>
              <TextField
                size="small"
                label="Название"
                value={cannedTitle}
                onChange={(e) => setCannedTitle(e.target.value)}
              />
              <TextField
                size="small"
                label="Текст"
                value={cannedBody}
                onChange={(e) => setCannedBody(e.target.value)}
                fullWidth
              />
              <Button variant="outlined" onClick={() => void createCanned()}>
                Добавить
              </Button>
            </Stack>
          </Paper>

          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography fontWeight={700}>Промо-кнопки</Typography>
            <Button variant="contained" onClick={openCreatePromo}>
              Создать кнопку
            </Button>
          </Stack>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Порядок</TableCell>
                <TableCell>Название</TableCell>
                <TableCell>Аудитория</TableCell>
                <TableCell>Автоответ</TableCell>
                <TableCell>Активна</TableCell>
                <TableCell align="right">Действия</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {promos.map((p, idx) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <IconButton
                      size="small"
                      disabled={promoBusy || idx === 0}
                      onClick={() => void movePromo(p.id, -1)}
                    >
                      <ArrowUpward fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      disabled={promoBusy || idx === promos.length - 1}
                      onClick={() => void movePromo(p.id, 1)}
                    >
                      <ArrowDownward fontSize="small" />
                    </IconButton>
                  </TableCell>
                  <TableCell>
                    <Typography fontWeight={700}>{p.title}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {p.ticketKind} · {(p.accountScope || 'ALL') === 'NEW'
                        ? `новые ≤${p.newAccountDays || 30}д`
                        : 'все'}
                    </Typography>
                  </TableCell>
                  <TableCell>{p.audience}</TableCell>
                  <TableCell>
                    {p.autoReplyEnabled ? (
                      <Chip
                        size="small"
                        color="success"
                        label={
                          (p.autoReplyAttachments || []).length
                            ? `Вкл · ${(p.autoReplyAttachments || []).length} файл.`
                            : 'Вкл'
                        }
                      />
                    ) : (
                      <Chip size="small" label="Выкл" variant="outlined" />
                    )}
                  </TableCell>
                  <TableCell>
                    <Switch
                      size="small"
                      checked={!!p.isActive}
                      disabled={promoBusy}
                      onChange={() => void togglePromoActive(p)}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => openEditPromo(p)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    {!p.key && (
                      <IconButton
                        size="small"
                        color="error"
                        disabled={promoBusy}
                        onClick={() => void deletePromo(p.id)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {tab === 3 && (
        <Paper sx={{ p: 2, maxWidth: 800 }}>
          <Typography variant="h6" gutterBottom>
            База знаний / FAQ виджета
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Активные статьи с аудиторией school/marketer/client попадают в FAQ SupportFAB. Если
            статей нет — виджет использует встроенные подсказки.
          </Typography>
          <Stack spacing={1.5} sx={{ mb: 3 }}>
            <TextField
              label="Заголовок"
              size="small"
              value={knowledgeForm.title}
              onChange={(e) => setKnowledgeForm((f) => ({ ...f, title: e.target.value }))}
              fullWidth
            />
            <TextField
              label="Текст статьи"
              size="small"
              multiline
              minRows={3}
              value={knowledgeForm.body}
              onChange={(e) => setKnowledgeForm((f) => ({ ...f, body: e.target.value }))}
              fullWidth
            />
            <TextField
              label="Подпись (hint)"
              size="small"
              value={knowledgeForm.hint}
              onChange={(e) => setKnowledgeForm((f) => ({ ...f, hint: e.target.value }))}
              fullWidth
            />
            <TextField
              label="Тема обращения"
              size="small"
              value={knowledgeForm.topic}
              onChange={(e) => setKnowledgeForm((f) => ({ ...f, topic: e.target.value }))}
              fullWidth
            />
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <TextField
                select
                size="small"
                label="Аудитория"
                value={knowledgeForm.audience}
                onChange={(e) => setKnowledgeForm((f) => ({ ...f, audience: e.target.value }))}
                SelectProps={{ native: true }}
                sx={{ minWidth: 160 }}
              >
                <option value="all">Все</option>
                <option value="school">Школа</option>
                <option value="marketer">Маркетолог</option>
                <option value="client">Клиент</option>
              </TextField>
              <TextField
                select
                size="small"
                label="Иконка"
                value={knowledgeForm.iconKey}
                onChange={(e) => setKnowledgeForm((f) => ({ ...f, iconKey: e.target.value }))}
                SelectProps={{ native: true }}
                sx={{ minWidth: 160 }}
              >
                <option value="settings">settings</option>
                <option value="groups">groups</option>
                <option value="wallet">wallet</option>
                <option value="build">build</option>
                <option value="business">business</option>
                <option value="event">event</option>
                <option value="membership">membership</option>
                <option value="person">person</option>
              </TextField>
              <FormControlLabel
                control={
                  <Switch
                    checked={knowledgeForm.isActive}
                    onChange={(_, v) => setKnowledgeForm((f) => ({ ...f, isActive: v }))}
                  />
                }
                label="Активна"
              />
            </Stack>
            <Stack direction="row" spacing={1}>
              <Button variant="contained" disabled={kbBusy} onClick={() => void saveKnowledge()}>
                {editingArticleId ? 'Сохранить' : 'Создать'}
              </Button>
              {editingArticleId && (
                <Button
                  onClick={() => {
                    setEditingArticleId(null);
                    setKnowledgeForm(emptyKnowledgeForm());
                  }}
                >
                  Отмена
                </Button>
              )}
            </Stack>
          </Stack>
          <Divider sx={{ mb: 2 }} />
          {articles.map((a) => (
            <Box key={a.id} sx={{ mb: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Box>
                  <Typography variant="subtitle1">
                    {a.title}{' '}
                    <Chip size="small" label={a.audience || 'all'} sx={{ ml: 0.5 }} />
                    {!a.isActive && (
                      <Chip size="small" label="выкл" variant="outlined" sx={{ ml: 0.5 }} />
                    )}
                  </Typography>
                  {a.hint && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      {a.hint}
                    </Typography>
                  )}
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 0.5 }}>
                    {a.body}
                  </Typography>
                </Box>
                <Stack direction="row">
                  <IconButton
                    size="small"
                    onClick={() => {
                      setEditingArticleId(a.id);
                      setKnowledgeForm({
                        title: a.title || '',
                        body: a.body || '',
                        audience: a.audience || 'all',
                        hint: a.hint || '',
                        topic: a.topic || '',
                        iconKey: a.iconKey || 'settings',
                        sortOrder: a.sortOrder || 0,
                        isActive: a.isActive !== false,
                      });
                    }}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={async () => {
                      await apiService.superAdminDeleteSupportKnowledge(a.id);
                      void loadKnowledge();
                    }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </Stack>
            </Box>
          ))}
        </Paper>
      )}

      <Dialog
        open={promoDialogOpen}
        onClose={() => setPromoDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>{editingPromoId ? 'Редактировать акцию' : 'Новая промо-кнопка'}</DialogTitle>
        <DialogContent dividers>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1fr 280px' },
              gap: 2,
            }}
          >
            <Stack spacing={1.5}>
              <TextField
                label="Название"
                size="small"
                value={promoForm.title}
                onChange={(e) => setPromoForm((f) => ({ ...f, title: e.target.value }))}
                fullWidth
              />
              <TextField
                label="Описание"
                size="small"
                multiline
                minRows={2}
                value={promoForm.description}
                onChange={(e) => setPromoForm((f) => ({ ...f, description: e.target.value }))}
                fullWidth
              />
              <TextField
                label="Текст кнопки"
                size="small"
                value={promoForm.buttonLabel}
                onChange={(e) => setPromoForm((f) => ({ ...f, buttonLabel: e.target.value }))}
                fullWidth
              />
              <TextField
                label="Бейдж"
                size="small"
                value={promoForm.badgeLabel}
                onChange={(e) => setPromoForm((f) => ({ ...f, badgeLabel: e.target.value }))}
                fullWidth
              />
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <TextField
                  select
                  size="small"
                  label="Аудитория"
                  value={promoForm.audience}
                  onChange={(e) =>
                    setPromoForm((f) => ({
                      ...f,
                      audience: e.target.value as PromoForm['audience'],
                    }))
                  }
                  SelectProps={{ native: true }}
                >
                  <option value="school">Школа</option>
                  <option value="marketer">Маркетолог</option>
                  <option value="client">Клиент</option>
                  <option value="all">Все</option>
                </TextField>
                <TextField
                  select
                  size="small"
                  label="Аккаунты"
                  value={promoForm.accountScope}
                  onChange={(e) =>
                    setPromoForm((f) => ({
                      ...f,
                      accountScope: e.target.value as PromoForm['accountScope'],
                    }))
                  }
                  SelectProps={{ native: true }}
                >
                  <option value="ALL">Всех</option>
                  <option value="NEW">Только новых</option>
                </TextField>
                {promoForm.accountScope === 'NEW' && (
                  <TextField
                    type="number"
                    size="small"
                    label="Дней «новый»"
                    value={promoForm.newAccountDays}
                    onChange={(e) =>
                      setPromoForm((f) => ({
                        ...f,
                        newAccountDays: Number(e.target.value) || 30,
                      }))
                    }
                    sx={{ width: 120 }}
                  />
                )}
                <TextField
                  select
                  size="small"
                  label="Тип заявки"
                  value={promoForm.ticketKind}
                  onChange={(e) =>
                    setPromoForm((f) => ({
                      ...f,
                      ticketKind: e.target.value as PromoForm['ticketKind'],
                    }))
                  }
                  SelectProps={{ native: true }}
                >
                  <option value="GENERAL">Обычное</option>
                  <option value="QUICK_SETUP">Быстрая настройка</option>
                </TextField>
              </Stack>
              <FormControlLabel
                control={
                  <Switch
                    checked={promoForm.autoReplyEnabled}
                    onChange={(_, v) => setPromoForm((f) => ({ ...f, autoReplyEnabled: v }))}
                  />
                }
                label="Автоответ акции"
              />
              {promoForm.autoReplyEnabled && (
                <TextField
                  label="Текст автоответа"
                  size="small"
                  multiline
                  minRows={2}
                  value={promoForm.autoReplyBody}
                  onChange={(e) => setPromoForm((f) => ({ ...f, autoReplyBody: e.target.value }))}
                  fullWidth
                />
              )}
              {(promoForm.autoReplyEnabled ||
                editingPromoAttachments.length > 0 ||
                newPromoFiles.length > 0) && (
                <Box>
                  {editingPromoId && (
                    <AutoReplyFilesBlock
                      attachments={editingPromoAttachments}
                      busy={attachBusy || promoBusy}
                      onUpload={(files) => void uploadAutoReplyAttachment(editingPromoId, files)}
                      onDelete={(id) => void deleteAutoReplyAttachment(id, editingPromoId)}
                      onDownload={(id) => void downloadAutoReplyAttachment(id)}
                    />
                  )}
                  <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
                    <input
                      ref={newPromoFileRef}
                      type="file"
                      multiple
                      hidden
                      accept={AUTO_REPLY_ACCEPT}
                      onChange={(e) => {
                        const list = Array.from(e.target.files || []).slice(0, 10);
                        setNewPromoFiles((prev) => [...prev, ...list].slice(0, 10));
                        e.target.value = '';
                      }}
                    />
                    <Button
                      size="small"
                      startIcon={<AttachFile />}
                      onClick={() => newPromoFileRef.current?.click()}
                    >
                      {editingPromoId ? 'Ещё файлы' : 'Файлы автоответа'}
                    </Button>
                    {newPromoFiles.map((f, i) => (
                      <Chip
                        key={`${f.name}-${i}`}
                        size="small"
                        label={f.name}
                        onDelete={() =>
                          setNewPromoFiles((prev) => prev.filter((_, idx) => idx !== i))
                        }
                      />
                    ))}
                  </Stack>
                </Box>
              )}
              <FormControlLabel
                control={
                  <Switch
                    checked={promoForm.isActive}
                    onChange={(_, v) => setPromoForm((f) => ({ ...f, isActive: v }))}
                  />
                }
                label="Активна"
              />
            </Stack>
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                bgcolor: 'grey.50',
                alignSelf: 'start',
              }}
            >
              <Typography variant="caption" color="text.secondary">
                Превью виджета
              </Typography>
              <Typography variant="subtitle1" fontWeight={800} sx={{ mt: 1 }}>
                Служба поддержки
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                FAQ · …
              </Typography>
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                }}
              >
                {promoForm.badgeLabel && (
                  <Chip
                    size="small"
                    label={promoForm.badgeLabel}
                    sx={{ mb: 1, bgcolor: 'rgba(255,255,255,0.2)', color: 'inherit' }}
                  />
                )}
                <Typography fontWeight={700}>{promoForm.title || 'Название акции'}</Typography>
                <Typography variant="body2" sx={{ mt: 0.5, opacity: 0.9 }}>
                  {promoForm.description || 'Описание…'}
                </Typography>
                <Button
                  size="small"
                  variant="contained"
                  color="inherit"
                  sx={{ mt: 1.5, color: 'primary.main' }}
                >
                  {promoForm.buttonLabel || 'Кнопка'}
                </Button>
              </Box>
            </Paper>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPromoDialogOpen(false)}>Отмена</Button>
          <Button variant="contained" disabled={promoBusy} onClick={() => void savePromoDialog()}>
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SuperAdminSupportHub;
