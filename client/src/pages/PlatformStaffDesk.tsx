import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  List,
  ListItemButton,
  ListItemText,
  TextField,
  Button,
  Grid,
  Chip,
  CircularProgress,
  Alert,
  Divider,
} from '@mui/material';
import { usePlatformStaffAuth } from '../contexts/PlatformStaffAuthContext';
import { apiService } from '../services/api';
import { useDesignerVoiceCall } from '../hooks/useDesignerVoiceCall';

const PlatformStaffDesk: React.FC = () => {
  const { staff, logout } = usePlatformStaffAuth();
  const [tickets, setTickets] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [reply, setReply] = useState('');
  const [knowledge, setKnowledge] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const readOnly = staff?.role === 'SECURITY';

  const loadTickets = useCallback(async () => {
    const data = await apiService.platformStaffListTickets();
    setTickets(data.tickets || []);
  }, []);

  const loadKnowledge = useCallback(async () => {
    if (staff?.role === 'SUPPORT' || staff?.role === 'SECURITY') {
      const k = await apiService.platformStaffListKnowledge();
      setKnowledge(k.articles || []);
    }
  }, [staff?.role]);

  const selectTicket = useCallback(async (id: string) => {
    setSelectedId(id);
    const data = await apiService.platformStaffGetMessages(id);
    setMessages(data.messages || []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        await loadTickets();
        await loadKnowledge();
      } catch (e: any) {
        if (!cancelled) setError(e?.response?.data?.error || 'Ошибка загрузки');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [loadTickets, loadKnowledge]);

  const selectedTicket = tickets.find((t) => t.id === selectedId) ?? null;

  const staffToken = useMemo(() => localStorage.getItem('platformStaffToken'), [staff?.id]);

  const designerVoice = useDesignerVoiceCall({
    ticketId: selectedId,
    channel: selectedTicket?.channel ?? null,
    mode: 'callee',
    token: staffToken,
    enabled: staff?.role === 'DESIGNER' && !!selectedId && selectedTicket?.channel === 'DESIGNER',
    onRecordingReady: async () => {},
  });

  // У дизайнера по умолчанию открыт чат с супер-админами (не горячая линия)
  useEffect(() => {
    if (staff?.role !== 'DESIGNER' || tickets.length === 0 || selectedId) return;
    const liaison = tickets.find((t) => t.channel === 'DESIGNER_SUPERADMIN');
    if (liaison) void selectTicket(liaison.id);
  }, [staff?.role, tickets, selectedId, selectTicket]);

  useEffect(() => {
    if (!selectedId) return;
    const iv = setInterval(async () => {
      try {
        const data = await apiService.platformStaffGetMessages(selectedId);
        setMessages(data.messages || []);
      } catch {
        /* ignore */
      }
    }, 3000);
    return () => clearInterval(iv);
  }, [selectedId]);

  const claim = async () => {
    if (!selectedId || readOnly) return;
    try {
      await apiService.platformStaffClaimTicket(selectedId);
      await loadTickets();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось взять обращение');
    }
  };

  const send = async () => {
    if (!selectedId || !reply.trim() || readOnly) return;
    await apiService.platformStaffPostMessage(selectedId, reply.trim());
    setReply('');
    const data = await apiService.platformStaffGetMessages(selectedId);
    setMessages(data.messages || []);
  };

  const showEmptyQueue =
    !loading &&
    tickets.length === 0 &&
    (staff?.role === 'SUPPORT' || staff?.role === 'DESIGNER');

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5">
          {staff?.role === 'SUPPORT' && 'Техподдержка'}
          {staff?.role === 'DESIGNER' && 'Дизайнеры'}
          {staff?.role === 'SECURITY' && 'Служба безопасности (только просмотр)'}
          {' — '}{staff?.firstName} {staff?.lastName}
        </Typography>
        <Button onClick={logout}>Выйти</Button>
      </Box>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : showEmptyQueue ? (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <CircularProgress sx={{ mb: 2 }} />
          <Typography variant="h6" gutterBottom>Ожидаем обращений</Typography>
          <Typography color="text.secondary">
            {staff?.role === 'SUPPORT'
              ? 'Когда клиент напишет в техподдержку, обращение появится в списке слева.'
              : 'Чат с супер-админами создаётся при первом входе. Обращения клиентов в дизайн (горячая линия) появятся отдельно в списке.'}
          </Typography>
        </Paper>
      ) : (
        <Grid container spacing={2}>
          {(staff?.role === 'SUPPORT' || staff?.role === 'SECURITY') && (
            <Grid item xs={12} md={3}>
              <Paper sx={{ p: 2, maxHeight: 480, overflow: 'auto' }}>
                <Typography variant="subtitle2" gutterBottom>База знаний</Typography>
                <Divider sx={{ mb: 1 }} />
                {knowledge.length === 0 && (
                  <Typography variant="body2" color="text.secondary">Статьи не добавлены (суперадмин)</Typography>
                )}
                {knowledge.map((a) => (
                  <Box key={a.id} sx={{ mb: 2 }}>
                    <Typography variant="subtitle2">{a.title}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                      {a.body}
                    </Typography>
                  </Box>
                ))}
              </Paper>
            </Grid>
          )}
          <Grid item xs={12} md={staff?.role === 'DESIGNER' ? 4 : (staff?.role === 'SUPPORT' || staff?.role === 'SECURITY') ? 3 : 12}>
            <Paper sx={{ p: 0, maxHeight: 480, overflow: 'auto' }}>
              <Typography variant="subtitle2" sx={{ p: 2, pb: 0 }}>Обращения</Typography>
              <List dense>
                {tickets.map((t) => (
                  <ListItemButton key={t.id} selected={selectedId === t.id} onClick={() => selectTicket(t.id)}>
                    <ListItemText
                      primary={
                        t.channel === 'DESIGNER_SUPERADMIN'
                          ? 'Супер-администраторы'
                          : t.subject || t.tenant?.name || t.id.slice(0, 8)
                      }
                      secondary={
                        t.channel === 'DESIGNER_SUPERADMIN'
                          ? 'Внутренний чат · не горячая линия'
                          : `${t.channel} · ${t.status}`
                      }
                    />
                    <Chip size="small" label={t.status} />
                  </ListItemButton>
                ))}
              </List>
            </Paper>
          </Grid>
          <Grid item xs={12} md={staff?.role === 'DESIGNER' ? 8 : 6}>
            <Paper sx={{ p: 2, minHeight: 400 }}>
              {!selectedId ? (
                <Typography color="text.secondary">Выберите обращение</Typography>
              ) : (
                <>
                  {!readOnly && selectedTicket?.channel !== 'DESIGNER_SUPERADMIN' && (
                    <Button size="small" onClick={claim} sx={{ mb: 1 }}>Взять в работу</Button>
                  )}
                  <Box sx={{ maxHeight: 220, overflow: 'auto', mb: 2 }}>
                    {messages.map((m) => (
                      <Box key={m.id} sx={{ mb: 1, p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
                        <Typography variant="caption">{m.authorType}</Typography>
                        <Typography variant="body2">{m.body}</Typography>
                      </Box>
                    ))}
                  </Box>
                  {!readOnly && (
                    <>
                      <TextField
                        fullWidth
                        multiline
                        minRows={2}
                        value={reply}
                        onChange={(e) => setReply(e.target.value)}
                        placeholder="Ответ..."
                      />
                      <Button sx={{ mt: 1 }} variant="contained" onClick={send} disabled={!reply.trim()}>
                        Отправить
                      </Button>
                    </>
                  )}
                  {staff?.role === 'DESIGNER' && selectedTicket?.channel === 'DESIGNER' && (
                    <Box sx={{ mt: 3 }}>
                      <audio ref={designerVoice.remoteAudioRef} hidden />
                      <Typography variant="subtitle2" gutterBottom>
                        Входящий голосовой звонок от клиента
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        Когда пользователь нажмёт «Начать звонок», примите звонок в браузере (микрофон). Запись разговора сохраняется у клиента автоматически.
                      </Typography>
                      {designerVoice.error && (
                        <Alert severity="error" sx={{ mb: 1 }}>{designerVoice.error}</Alert>
                      )}
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => void designerVoice.endCall()}
                        disabled={!designerVoice.canEndCall}
                      >
                        Завершить звонок
                      </Button>
                    </Box>
                  )}
                </>
              )}
            </Paper>
          </Grid>
        </Grid>
      )}
    </Container>
  );
};

export default PlatformStaffDesk;
