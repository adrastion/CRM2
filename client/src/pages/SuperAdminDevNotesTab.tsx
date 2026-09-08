import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { Add, Delete, Edit, NoteAlt } from '@mui/icons-material';
import { apiService } from '../services/api';

export type DevNoteStatus = 'IDEA' | 'IN_PROGRESS' | 'DONE';

interface DevNote {
  id: string;
  title: string;
  description?: string | null;
  status: DevNoteStatus;
  createdAt: string;
  updatedAt: string;
  createdBy?: { id: string; firstName: string; lastName: string; email: string };
}

const STATUS_LABELS: Record<DevNoteStatus, string> = {
  IDEA: 'Идея',
  IN_PROGRESS: 'В работе',
  DONE: 'Готово',
};

const STATUS_COLORS: Record<DevNoteStatus, 'default' | 'info' | 'warning' | 'success'> = {
  IDEA: 'info',
  IN_PROGRESS: 'warning',
  DONE: 'success',
};

/**
 * Вкладка «Разработка»: общие заметки-задачи супер-админов.
 */
const SuperAdminDevNotesTab: React.FC = () => {
  const [notes, setNotes] = useState<DevNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DevNote | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<DevNoteStatus>('IDEA');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiService.getDevNotes(
        statusFilter === 'ALL' ? undefined : { status: statusFilter }
      );
      setNotes(data || []);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось загрузить заметки');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setTitle('');
    setDescription('');
    setStatus('IDEA');
    setDialogOpen(true);
  };

  const openEdit = (note: DevNote) => {
    setEditing(note);
    setTitle(note.title);
    setDescription(note.description || '');
    setStatus(note.status);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await apiService.updateDevNote(editing.id, {
          title: title.trim(),
          description: description.trim() || null,
          status,
        });
      } else {
        await apiService.createDevNote({
          title: title.trim(),
          description: description.trim() || null,
          status,
        });
      }
      setDialogOpen(false);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (note: DevNote, next: DevNoteStatus) => {
    try {
      await apiService.updateDevNote(note.id, { status: next });
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось обновить статус');
    }
  };

  const handleDelete = async (note: DevNote) => {
    if (!window.confirm(`Удалить заметку «${note.title}»?`)) return;
    try {
      await apiService.deleteDevNote(note.id);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось удалить');
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Typography variant="h5" fontWeight="bold" display="flex" alignItems="center" gap={1}>
          <NoteAlt /> Разработка
        </Typography>
        <Box display="flex" gap={2} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Статус</InputLabel>
            <Select
              label="Статус"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <MenuItem value="ALL">Все</MenuItem>
              <MenuItem value="IDEA">Идея</MenuItem>
              <MenuItem value="IN_PROGRESS">В работе</MenuItem>
              <MenuItem value="DONE">Готово</MenuItem>
            </Select>
          </FormControl>
          <Button variant="contained" startIcon={<Add />} onClick={openCreate}>
            Новая заметка
          </Button>
        </Box>
      </Box>

      {error && (
        <Typography color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress />
        </Box>
      ) : (
        <Paper>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Заголовок</TableCell>
                  <TableCell>Описание</TableCell>
                  <TableCell width={180}>Статус</TableCell>
                  <TableCell>Автор</TableCell>
                  <TableCell>Обновлено</TableCell>
                  <TableCell align="right">Действия</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {notes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Typography color="text.secondary" sx={{ py: 3 }}>
                        Нет заметок
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  notes.map((note) => (
                    <TableRow key={note.id}>
                      <TableCell>
                        <Typography fontWeight={600}>{note.title}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{
                            maxWidth: 360,
                            whiteSpace: 'pre-wrap',
                            overflow: 'hidden',
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical',
                          }}
                        >
                          {note.description || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <FormControl size="small" fullWidth>
                          <Select
                            value={note.status}
                            onChange={(e) =>
                              handleStatusChange(note, e.target.value as DevNoteStatus)
                            }
                            renderValue={(v) => (
                              <Chip
                                size="small"
                                label={STATUS_LABELS[v as DevNoteStatus]}
                                color={STATUS_COLORS[v as DevNoteStatus]}
                              />
                            )}
                          >
                            <MenuItem value="IDEA">Идея</MenuItem>
                            <MenuItem value="IN_PROGRESS">В работе</MenuItem>
                            <MenuItem value="DONE">Готово</MenuItem>
                          </Select>
                        </FormControl>
                      </TableCell>
                      <TableCell>
                        {note.createdBy
                          ? `${note.createdBy.lastName} ${note.createdBy.firstName}`.trim()
                          : '—'}
                      </TableCell>
                      <TableCell>
                        {new Date(note.updatedAt).toLocaleString('ru-RU')}
                      </TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={() => openEdit(note)} title="Редактировать">
                          <Edit fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDelete(note)}
                          title="Удалить"
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      <Dialog open={dialogOpen} onClose={() => !saving && setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? 'Редактировать заметку' : 'Новая заметка'}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Заголовок"
            fullWidth
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <TextField
            margin="dense"
            label="Описание"
            fullWidth
            multiline
            minRows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <FormControl fullWidth margin="dense">
            <InputLabel>Статус</InputLabel>
            <Select
              label="Статус"
              value={status}
              onChange={(e) => setStatus(e.target.value as DevNoteStatus)}
            >
              <MenuItem value="IDEA">Идея</MenuItem>
              <MenuItem value="IN_PROGRESS">В работе</MenuItem>
              <MenuItem value="DONE">Готово</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>
            Отмена
          </Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !title.trim()}>
            {saving ? <CircularProgress size={22} /> : 'Сохранить'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SuperAdminDevNotesTab;
