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
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ru } from 'date-fns/locale';
import { apiService } from '../../services/api';

const MarketerTasks: React.FC = () => {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState('TASK');
  const [dueAt, setDueAt] = useState<Date | null>(new Date());
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      setTasks(await apiService.getMarketerTasks());
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Ошибка загрузки задач');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const create = async () => {
    try {
      setSaving(true);
      await apiService.createMarketerTask({
        title: title.trim(),
        kind,
        dueAt: dueAt?.toISOString() || null,
      });
      setOpen(false);
      setTitle('');
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось создать');
    } finally {
      setSaving(false);
    }
  };

  const toggleDone = async (task: any) => {
    await apiService.updateMarketerTask(task.id, {
      status: task.status === 'DONE' ? 'OPEN' : 'DONE',
    });
    await load();
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={6}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ru}>
      <Box>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Задачи
          </Typography>
          <Button variant="contained" onClick={() => setOpen(true)} sx={{ textTransform: 'none' }}>
            Новая задача
          </Button>
        </Stack>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Задача</TableCell>
              <TableCell>Тип</TableCell>
              <TableCell>Клиент</TableCell>
              <TableCell>Срок</TableCell>
              <TableCell>Статус</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {tasks.map((t) => (
              <TableRow key={t.id}>
                <TableCell>{t.title}</TableCell>
                <TableCell>{t.kind}</TableCell>
                <TableCell>{t.lead?.displayCode || (t.tenantId ? 'Школа' : '—')}</TableCell>
                <TableCell>{t.dueAt ? new Date(t.dueAt).toLocaleString('ru-RU') : '—'}</TableCell>
                <TableCell>
                  <Chip size="small" label={t.status} color={t.status === 'DONE' ? 'success' : 'default'} />
                </TableCell>
                <TableCell>
                  <Button size="small" onClick={() => void toggleDone(t)} sx={{ textTransform: 'none' }}>
                    {t.status === 'DONE' ? 'Открыть' : 'Готово'}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {tasks.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography color="text.secondary">Задач нет</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
          <DialogTitle>Новая задача</DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              label="Заголовок"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              sx={{ mt: 1, mb: 2 }}
            />
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Тип</InputLabel>
              <Select value={kind} label="Тип" onChange={(e) => setKind(e.target.value)}>
                <MenuItem value="TASK">Задача</MenuItem>
                <MenuItem value="CALL">Созвон</MenuItem>
                <MenuItem value="OTHER">Другое</MenuItem>
              </Select>
            </FormControl>
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
              onClick={create}
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

export default MarketerTasks;
