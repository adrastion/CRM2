import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Fab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  TextField,
  List,
  ListItemButton,
  ListItemText,
  Chip,
  CircularProgress,
  Divider,
} from '@mui/material';
import { SupportAgent, Brush, Close, PhoneInTalk } from '@mui/icons-material';
import { useLocation } from 'react-router-dom';
import ClientSupportFAB from './ClientSupportFAB';
import { apiService } from '../services/api';
import { useDesignerVoiceCall } from '../hooks/useDesignerVoiceCall';
import { getSupportRequesterToken } from '../utils/supportAuthToken';
import { isClientApproved } from '../utils/authSession';

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

const SupportFAB: React.FC = () => {
  const location = useLocation();

  const hidden = useMemo(() => {
    if (hasSuperAdminSession()) return true;
    if (isSuperAdminRoute(location.pathname)) return true;
    // На публичных страницах (например /auth) кнопку не показываем, чтобы не было запросов без токена
    if (!hasAnyNonSuperAdminSession()) return true;
    // Клиенту без подтверждения школой кабинет ещё не доступен — скрываем и поддержку.
    if (hasClientSession() && !isClientApproved()) return true;
    return false;
  }, [location.pathname]);

  const showClientSupportFab = !hidden && hasClientSession();

  type Channel = 'SUPPORT' | 'DESIGNER';

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'menu' | 'new' | 'chat'>('menu');
  const [channel, setChannel] = useState<Channel | null>(null);
  const [subject, setSubject] = useState('');
  const [firstMessage, setFirstMessage] = useState('');
  const [tickets, setTickets] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentTicket, setCurrentTicket] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [callRecordings, setCallRecordings] = useState<any[]>([]);
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const supportToken = useMemo(() => getSupportRequesterToken(), []);
  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selectedId;

  const voice = useDesignerVoiceCall({
    ticketId: selectedId,
    channel: currentTicket?.channel ?? null,
    mode: 'caller',
    token: supportToken,
    enabled: open && step === 'chat' && !!selectedId && !showClientSupportFab,
    onRecordingReady: async (blob, startedAt) => {
      const id = selectedIdRef.current;
      if (!id) return;
      const fd = new FormData();
      fd.append('file', blob, 'call.webm');
      fd.append('startedAt', startedAt.toISOString());
      await apiService.requesterUploadDesignerRecording(id, fd);
      const data = await apiService.requesterGetSupportTicketMessages(id);
      setCallRecordings(data.callRecordings || []);
    },
  });

  const loadTickets = useCallback(async () => {
    try {
      const data = await apiService.requesterListSupportTickets();
      setTickets(data.tickets || []);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось загрузить обращения');
    }
  }, []);

  useEffect(() => {
    if (open && step === 'chat' && selectedId) {
      const t = setInterval(async () => {
        try {
          const data = await apiService.requesterGetSupportTicketMessages(selectedId);
          setMessages(data.messages || []);
          if (data.ticket) setCurrentTicket(data.ticket);
          setCallRecordings(data.callRecordings || []);
        } catch {
          /* ignore poll errors */
        }
      }, 3000);
      return () => clearInterval(t);
    }
  }, [open, step, selectedId]);

  const handleOpenMenu = () => {
    setError('');
    setStep('menu');
    setChannel(null);
    setOpen(true);
    loadTickets();
  };

  const startNew = (ch: Channel) => {
    setChannel(ch);
    setStep('new');
    setSubject('');
    setFirstMessage('');
    setError('');
  };

  const submitNew = async () => {
    if (!channel || !firstMessage.trim()) {
      setError('Введите текст сообщения');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await apiService.requesterCreateSupportTicket({
        channel,
        subject: subject.trim() || undefined,
        message: firstMessage.trim(),
      });
      setSelectedId(data.ticket.id);
      setCurrentTicket(data.ticket);
      setStep('chat');
      const m = await apiService.requesterGetSupportTicketMessages(data.ticket.id);
      setMessages(m.messages || []);
      setCallRecordings(m.callRecordings || []);
      await loadTickets();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Ошибка создания обращения');
    } finally {
      setLoading(false);
    }
  };

  const openTicket = async (id: string) => {
    setSelectedId(id);
    setStep('chat');
    setLoading(true);
    try {
      const data = await apiService.requesterGetSupportTicketMessages(id);
      setMessages(data.messages || []);
      setCurrentTicket(data.ticket);
      setCallRecordings(data.callRecordings || []);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Ошибка загрузки чата');
    } finally {
      setLoading(false);
    }
  };

  const sendReply = async () => {
    if (!selectedId || !reply.trim()) return;
    setLoading(true);
    try {
      await apiService.requesterPostSupportMessage(selectedId, reply.trim());
      setReply('');
      const data = await apiService.requesterGetSupportTicketMessages(selectedId);
      setMessages(data.messages || []);
      if (data.ticket) setCurrentTicket(data.ticket);
      setCallRecordings(data.callRecordings || []);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось отправить');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    void voice.endCall();
    setOpen(false);
    setStep('menu');
    setChannel(null);
    setSelectedId(null);
    setCurrentTicket(null);
    setMessages([]);
    setCallRecordings([]);
  };

  if (hidden) return null;
  if (showClientSupportFab) {
    return <ClientSupportFAB />;
  }

  return (
    <>
      <Fab
        color="primary"
        aria-label="Поддержка и дизайн"
        onClick={handleOpenMenu}
        sx={{ position: 'fixed', bottom: 24, left: 24, zIndex: (t) => t.zIndex.drawer + 2 }}
      >
        <SupportAgent />
      </Fab>
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {step === 'menu' && 'Поддержка и дизайн'}
          {step === 'new' && (channel === 'SUPPORT' ? 'Написать в техподдержку' : 'Написать дизайнерам')}
          {step === 'chat' && 'Чат'}
          <Button size="small" onClick={handleClose}><Close /></Button>
        </DialogTitle>
        <DialogContent dividers>
          {error && (
            <Typography color="error" variant="body2" sx={{ mb: 1 }}>{error}</Typography>
          )}
          {step === 'menu' && (
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Выберите, кому написать, или откройте существующее обращение.
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <Button
                  variant="contained"
                  startIcon={<SupportAgent />}
                  onClick={() => startNew('SUPPORT')}
                  fullWidth
                >
                  Техподдержка
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<Brush />}
                  onClick={() => startNew('DESIGNER')}
                  fullWidth
                >
                  Дизайнеры
                </Button>
              </Box>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" gutterBottom>Мои обращения</Typography>
              <List dense>
                {tickets.length === 0 && (
                  <Typography variant="body2" color="text.secondary">Пока нет обращений</Typography>
                )}
                {tickets.map((t) => (
                  <ListItemButton key={t.id} onClick={() => openTicket(t.id)}>
                    <ListItemText
                      primary={t.subject || (t.channel === 'SUPPORT' ? 'Техподдержка' : 'Дизайн')}
                      secondary={`${t.channel} · ${t.status}`}
                    />
                    <Chip size="small" label={t.channel} />
                  </ListItemButton>
                ))}
              </List>
            </Box>
          )}
          {step === 'new' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              <TextField
                label="Тема (необязательно)"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                fullWidth
              />
              <TextField
                label="Сообщение"
                value={firstMessage}
                onChange={(e) => setFirstMessage(e.target.value)}
                multiline
                minRows={4}
                fullWidth
                required
              />
            </Box>
          )}
          {step === 'chat' && (
            <Box>
              <Box sx={{ maxHeight: 320, overflow: 'auto' }}>
                {loading && !messages.length ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress size={20} /></Box>
                ) : (
                  messages.map((m) => (
                    <Box key={m.id} sx={{ my: 1, p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
                      <Typography variant="caption">{m.authorType}</Typography>
                      <Typography variant="body2">{m.body}</Typography>
                    </Box>
                  ))
                )}
              </Box>
              {currentTicket?.channel === 'DESIGNER' && (
                <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                  <audio ref={voice.remoteAudioRef} hidden />
                  <Typography variant="subtitle2" gutterBottom>
                    Голосовой звонок дизайнерам
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {voice.designerOnline
                      ? 'Дизайнер в этом чате — будет голосовая связь через браузер. После завершения запись сохранится автоматически (14 дней).'
                      : 'Дизайнер пока не открыл чат — запишется только ваш голос. Когда дизайнер подключится, можно звонить снова.'}
                  </Typography>
                  {voice.error && (
                    <Typography color="error" variant="body2" sx={{ mb: 1 }}>{voice.error}</Typography>
                  )}
                  {callRecordings.length > 0 && (
                    <Box sx={{ mb: 1 }}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Сохранённые записи: {callRecordings.length}
                      </Typography>
                      {callRecordings.map((r) => (
                        <Typography key={r.id} variant="caption" display="block" color="text.secondary">
                          {new Date(r.startedAt).toLocaleString()}
                          {r.durationSec != null ? ` · ${r.durationSec} с` : ''}
                        </Typography>
                      ))}
                    </Box>
                  )}
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<PhoneInTalk />}
                      onClick={() => void voice.startCall()}
                      disabled={!voice.canStartCall || loading}
                    >
                      Начать звонок
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      color="secondary"
                      onClick={() => void voice.endCall()}
                      disabled={!voice.canEndCall}
                    >
                      Завершить
                    </Button>
                    {voice.phase === 'uploading' && <CircularProgress size={22} />}
                    {(voice.phase === 'connecting' || voice.phase === 'active') && (
                      <Chip size="small" label={voice.phase === 'connecting' ? 'Соединение…' : 'Звонок'} color="primary" />
                    )}
                  </Box>
                </Box>
              )}
              <TextField
                fullWidth
                multiline
                minRows={2}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Ваш ответ..."
                sx={{ mt: 1 }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {step === 'new' && (
            <>
              <Button onClick={() => { setStep('menu'); setChannel(null); }}>Назад</Button>
              <Button variant="contained" onClick={submitNew} disabled={loading}>
                {loading ? 'Отправка...' : 'Отправить'}
              </Button>
            </>
          )}
          {step === 'chat' && (
            <>
              <Button onClick={() => setStep('menu')}>К списку</Button>
              <Button variant="contained" onClick={sendReply} disabled={loading || !reply.trim()}>
                Отправить
              </Button>
            </>
          )}
          {step === 'menu' && <Button onClick={handleClose}>Закрыть</Button>}
        </DialogActions>
      </Dialog>
    </>
  );
};

export default SupportFAB;

