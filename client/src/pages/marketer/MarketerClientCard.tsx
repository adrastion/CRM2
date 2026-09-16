import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ru } from 'date-fns/locale';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { apiService } from '../../services/api';

const MarketerClientCard: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [client, setClient] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [dueAt, setDueAt] = useState<Date | null>(new Date());
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await apiService.getMarketerClientCard(id);
      setClient(data.client);
      setTasks(data.tasks || []);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Клиент не найден');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [id]);

  const createTask = async () => {
    if (!client || !title.trim()) return;
    try {
      setSaving(true);
      await apiService.createMarketerTask({
        title: title.trim(),
        dueAt: dueAt?.toISOString() || null,
        kind: 'TASK',
        leadId: client.kind === 'lead' ? client.id : undefined,
        tenantId: client.kind === 'school' ? client.id : undefined,
      });
      setOpen(false);
      setTitle('');
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось создать задачу');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={6}>
        <CircularProgress />
      </Box>
    );
  }
  if (error && !client) return <Alert severity="error">{error}</Alert>;
  if (!client) return null;

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ru}>
      <Box>
        <Button component={RouterLink} to="/marketer/clients" sx={{ textTransform: 'none', mb: 1 }}>
          ← К клиентам
        </Button>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {client.displayCode}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap">
              <Chip size="small" label={client.kind === 'lead' ? 'Лид' : 'Школа'} />
              {client.kind === 'school' && (
                <Chip
                  size="small"
                  color={client.status === 'active' ? 'success' : 'default'}
                  label={client.status === 'active' ? 'Активное' : 'Бесплатное'}
                />
              )}
              {client.kind === 'lead' && <Chip size="small" label={client.status} />}
            </Stack>
          </Box>
          <Button variant="contained" onClick={() => setOpen(true)} sx={{ textTransform: 'none' }}>
            Создать задачу
          </Button>
        </Stack>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        <Typography sx={{ color: 'text.secondary', mb: 2 }}>
          {[client.maskedName, client.maskedEmail, client.maskedPhone].filter(Boolean).join(' · ') ||
            'Контакты скрыты'}
          {client.notes ? ` · ${client.notes}` : ''}
          {client.planType ? ` · тариф ${client.planType}` : ''}
        </Typography>

        <Typography sx={{ fontWeight: 600, mb: 1 }}>Задачи</Typography>
        <List dense>
          {tasks.map((t) => (
            <ListItem key={t.id}>
              <ListItemText
                primary={t.title}
                secondary={`${t.kind} · ${t.status}${t.dueAt ? ` · ${new Date(t.dueAt).toLocaleString('ru-RU')}` : ''}`}
              />
            </ListItem>
          ))}
          {tasks.length === 0 && <Typography color="text.secondary">Задач нет</Typography>}
        </List>

        <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
          <DialogTitle>Задача по клиенту</DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              label="Заголовок"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              sx={{ mt: 1, mb: 2 }}
            />
            <DateTimePicker
              label="Срок"
              value={dueAt}
              onChange={(v) => setDueAt(v)}
              slotProps={{ textField: { fullWidth: true } }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)} sx={{ textTransform: 'none' }}>
              Отмена
            </Button>
            <Button
              variant="contained"
              disabled={saving || !title.trim()}
              onClick={createTask}
              sx={{ textTransform: 'none' }}
            >
              Создать
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default MarketerClientCard;
