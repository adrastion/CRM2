import React, { useState, useEffect, useCallback } from 'react';
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
import { SupportAgent, Brush, Close } from '@mui/icons-material';
import { apiService } from '../services/api';

type Channel = 'SUPPORT' | 'DESIGNER';

const ClientSupportFAB: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'menu' | 'new' | 'chat'>('menu');
  const [channel, setChannel] = useState<Channel | null>(null);
  const [subject, setSubject] = useState('');
  const [firstMessage, setFirstMessage] = useState('');
  const [tickets, setTickets] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadTickets = useCallback(async () => {
    try {
      const data = await apiService.clientListSupportTickets();
      setTickets(data.tickets || []);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось загрузить обращения');
    }
  }, []);

  useEffect(() => {
    if (open && step === 'chat' && selectedId) {
      const t = setInterval(async () => {
        try {
          const data = await apiService.clientGetSupportTicketMessages(selectedId);
          setMessages(data.messages || []);
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
      const data = await apiService.clientCreateSupportTicket({
        channel,
        subject: subject.trim() || undefined,
        message: firstMessage.trim(),
      });
      setSelectedId(data.ticket.id);
      setStep('chat');
      const m = await apiService.clientGetSupportTicketMessages(data.ticket.id);
      setMessages(m.messages || []);
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
      const data = await apiService.clientGetSupportTicketMessages(id);
      setMessages(data.messages || []);
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
      await apiService.clientPostSupportMessage(selectedId, reply.trim());
      setReply('');
      const data = await apiService.clientGetSupportTicketMessages(selectedId);
      setMessages(data.messages || []);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось отправить');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setStep('menu');
    setChannel(null);
    setSelectedId(null);
    setMessages([]);
  };

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
                Выберите, кому вы хотите написать, или откройте существующее обращение.
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
              {loading && !messages.length ? (
                <CircularProgress size={32} />
              ) : (
                <Box sx={{ maxHeight: 320, overflow: 'auto', mb: 2 }}>
                  {messages.map((m) => (
                    <Box
                      key={m.id}
                      sx={{
                        mb: 1,
                        p: 1,
                        borderRadius: 1,
                        bgcolor: m.authorType === 'client' || m.authorType === 'parent' ? 'action.hover' : 'primary.dark',
                        color: m.authorType === 'client' || m.authorType === 'parent' ? 'text.primary' : 'primary.contrastText',
                        alignSelf: m.authorType === 'client' || m.authorType === 'parent' ? 'flex-start' : 'flex-end',
                      }}
                    >
                      <Typography variant="caption" display="block" sx={{ opacity: 0.8 }}>
                        {m.authorType}
                      </Typography>
                      <Typography variant="body2">{m.body}</Typography>
                    </Box>
                  ))}
                </Box>
              )}
              <TextField
                label="Ваше сообщение"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                fullWidth
                multiline
                minRows={2}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {step === 'new' && (
            <>
              <Button onClick={() => setStep('menu')}>Назад</Button>
              <Button variant="contained" onClick={submitNew} disabled={loading}>
                Отправить
              </Button>
            </>
          )}
          {step === 'chat' && (
            <>
              <Button onClick={() => { setStep('menu'); loadTickets(); }}>К списку</Button>
              <Button variant="contained" onClick={sendReply} disabled={loading || !reply.trim()}>
                Отправить
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ClientSupportFAB;
