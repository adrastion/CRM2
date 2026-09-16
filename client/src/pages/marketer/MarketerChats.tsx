import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { apiService } from '../../services/api';

const CHANNELS: Array<{ id: 'SUPPORT' | 'ACCOUNTING'; label: string }> = [
  { id: 'SUPPORT', label: 'Техподдержка' },
  { id: 'ACCOUNTING', label: 'Бухгалтерия' },
];

const MarketerChats: React.FC = () => {
  const [channel, setChannel] = useState<'SUPPORT' | 'ACCOUNTING'>('SUPPORT');
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const openChannel = async (ch: 'SUPPORT' | 'ACCOUNTING') => {
    try {
      setLoading(true);
      setError('');
      setChannel(ch);
      const thread = await apiService.ensureMarketerChat(ch);
      setThreadId(thread.id);
      setMessages(await apiService.getMarketerChatMessages(thread.id));
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось открыть чат');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void openChannel('SUPPORT');
  }, []);

  const send = async () => {
    if (!threadId || !body.trim()) return;
    try {
      setSending(true);
      await apiService.postMarketerChatMessage(threadId, body.trim());
      setBody('');
      setMessages(await apiService.getMarketerChatMessages(threadId));
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не отправлено');
    } finally {
      setSending(false);
    }
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
        Чаты
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Доступны только техподдержка и бухгалтерия. Чатов с клиентами нет.
      </Typography>
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        {CHANNELS.map((c) => (
          <Button
            key={c.id}
            variant={channel === c.id ? 'contained' : 'outlined'}
            onClick={() => void openChannel(c.id)}
            sx={{ textTransform: 'none' }}
          >
            {c.label}
          </Button>
        ))}
      </Stack>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      <Paper variant="outlined" sx={{ p: 2, minHeight: 360, display: 'flex', flexDirection: 'column' }}>
        {loading ? (
          <Box display="flex" justifyContent="center" py={6}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Box sx={{ flex: 1, overflowY: 'auto', mb: 2, maxHeight: 420 }}>
              {messages.map((m) => (
                <Box
                  key={m.id}
                  sx={{
                    mb: 1.5,
                    textAlign: m.authorType === 'marketer' ? 'right' : 'left',
                  }}
                >
                  <Paper
                    sx={{
                      display: 'inline-block',
                      px: 1.5,
                      py: 1,
                      bgcolor: m.authorType === 'marketer' ? 'primary.main' : 'grey.100',
                      color: m.authorType === 'marketer' ? '#fff' : 'inherit',
                      maxWidth: '80%',
                    }}
                  >
                    <Typography variant="body2">{m.body}</Typography>
                    <Typography variant="caption" sx={{ opacity: 0.8 }}>
                      {new Date(m.createdAt).toLocaleString('ru-RU')}
                    </Typography>
                  </Paper>
                </Box>
              ))}
              {messages.length === 0 && (
                <Typography color="text.secondary">Напишите первое сообщение</Typography>
              )}
            </Box>
            <Stack direction="row" spacing={1}>
              <TextField
                fullWidth
                size="small"
                placeholder="Сообщение…"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
              />
              <Button
                variant="contained"
                disabled={sending || !body.trim()}
                onClick={() => void send()}
                sx={{ textTransform: 'none' }}
              >
                Отправить
              </Button>
            </Stack>
          </>
        )}
      </Paper>
    </Box>
  );
};

export default MarketerChats;
