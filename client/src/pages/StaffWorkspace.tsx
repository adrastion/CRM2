import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { Add, Chat, Delete, Edit } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { colors } from '../theme/tokens';

type StaffUser = {
  id: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  role: string;
  email?: string;
};

type StaffNote = {
  id: string;
  title: string;
  body: string;
  visibility: 'PERSONAL' | 'SHARED';
  authorUserId: string;
  author: StaffUser;
  updatedAt: string;
};

type StaffTask = {
  id: string;
  title: string;
  body: string;
  dueAt: string | null;
  status: string;
  createdByUserId: string;
  createdBy: StaffUser;
  assignees: Array<{ userId: string; user: StaffUser }>;
  chatThread: { id: string; threadKey: string; type: string } | null;
};

function personLabel(u: Pick<StaffUser, 'lastName' | 'firstName' | 'middleName' | 'role'>) {
  const name = [u.lastName, u.firstName, u.middleName].filter(Boolean).join(' ');
  const role =
    u.role === 'OWNER' ? 'Владелец' : u.role === 'ADMIN' ? 'Админ' : u.role === 'TRAINER' ? 'Тренер' : u.role;
  return `${name} (${role})`;
}

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const StaffWorkspace: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isOwner = user?.role === 'OWNER';
  const [tab, setTab] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<StaffNote[]>([]);
  const [tasks, setTasks] = useState<StaffTask[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [noteFilter, setNoteFilter] = useState<'ALL' | 'PERSONAL' | 'SHARED'>('ALL');
  const [taskStatus, setTaskStatus] = useState<'ALL' | 'OPEN' | 'DONE'>('OPEN');

  const [noteDialog, setNoteDialog] = useState(false);
  const [editingNote, setEditingNote] = useState<StaffNote | null>(null);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [noteVisibility, setNoteVisibility] = useState<'PERSONAL' | 'SHARED'>('PERSONAL');

  const [taskDialog, setTaskDialog] = useState(false);
  const [editingTask, setEditingTask] = useState<StaffTask | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskBody, setTaskBody] = useState('');
  const [taskDueAt, setTaskDueAt] = useState('');
  const [taskAssignees, setTaskAssignees] = useState<StaffUser[]>([]);
  const [createChat, setCreateChat] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadNotes = useCallback(async () => {
    const data = await apiService.listStaffNotes(
      noteFilter === 'ALL' ? undefined : noteFilter
    );
    setNotes(data);
  }, [noteFilter]);

  const loadTasks = useCallback(async () => {
    const data = await apiService.listStaffTasks(
      taskStatus === 'ALL' ? undefined : taskStatus
    );
    setTasks(data);
  }, [taskStatus]);

  const load = useCallback(async () => {
    setError(null);
    try {
      await Promise.all([
        loadNotes(),
        loadTasks(),
        apiService.listStaffWorkspaceUsers().then(setStaffUsers),
      ]);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось загрузить данные');
    }
  }, [loadNotes, loadTasks]);

  useEffect(() => {
    void load();
  }, [load]);

  const openNewNote = () => {
    setEditingNote(null);
    setNoteTitle('');
    setNoteBody('');
    setNoteVisibility('PERSONAL');
    setNoteDialog(true);
  };

  const openEditNote = (n: StaffNote) => {
    setEditingNote(n);
    setNoteTitle(n.title);
    setNoteBody(n.body);
    setNoteVisibility(n.visibility);
    setNoteDialog(true);
  };

  const saveNote = async () => {
    setSaving(true);
    setError(null);
    try {
      if (editingNote) {
        await apiService.updateStaffNote(editingNote.id, {
          title: noteTitle,
          body: noteBody,
          visibility: noteVisibility,
        });
      } else {
        await apiService.createStaffNote({
          title: noteTitle,
          body: noteBody,
          visibility: noteVisibility,
        });
      }
      setNoteDialog(false);
      await loadNotes();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось сохранить заметку');
    } finally {
      setSaving(false);
    }
  };

  const removeNote = async (id: string) => {
    if (!window.confirm('Удалить заметку?')) return;
    try {
      await apiService.deleteStaffNote(id);
      await loadNotes();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось удалить');
    }
  };

  const openNewTask = () => {
    setEditingTask(null);
    setTaskTitle('');
    setTaskBody('');
    setTaskDueAt('');
    setTaskAssignees([]);
    setCreateChat(true);
    setTaskDialog(true);
  };

  const openEditTask = (t: StaffTask) => {
    setEditingTask(t);
    setTaskTitle(t.title);
    setTaskBody(t.body);
    setTaskDueAt(toLocalInput(t.dueAt));
    setTaskAssignees(t.assignees.map((a) => a.user));
    setCreateChat(false);
    setTaskDialog(true);
  };

  const saveTask = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title: taskTitle,
        body: taskBody,
        dueAt: taskDueAt ? new Date(taskDueAt).toISOString() : null,
        assigneeIds: taskAssignees.map((u) => u.id),
        createChat,
      };
      if (editingTask) {
        await apiService.updateStaffTask(editingTask.id, payload);
      } else {
        await apiService.createStaffTask(payload);
      }
      setTaskDialog(false);
      await loadTasks();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось сохранить задачу');
    } finally {
      setSaving(false);
    }
  };

  const setTaskDone = async (t: StaffTask, status: string) => {
    try {
      await apiService.updateStaffTaskStatus(t.id, status);
      await loadTasks();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось обновить статус');
    }
  };

  const openTaskChat = async (t: StaffTask) => {
    try {
      const thread = await apiService.ensureStaffTaskChat(t.id);
      navigate(`/chats?threadId=${thread.id}`);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось открыть чат');
    }
  };

  const filteredNotes = useMemo(() => notes, [notes]);

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Заметки" />
        <Tab label="Задачи" />
      </Tabs>

      {tab === 0 && (
        <Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 2 }} alignItems="center">
            <TextField
              select
              size="small"
              label="Показать"
              value={noteFilter}
              onChange={(e) => setNoteFilter(e.target.value as any)}
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="ALL">Все</MenuItem>
              <MenuItem value="PERSONAL">Личные</MenuItem>
              <MenuItem value="SHARED">Общие</MenuItem>
            </TextField>
            <Box flex={1} />
            <Button variant="contained" startIcon={<Add />} onClick={openNewNote} sx={{ textTransform: 'none' }}>
              Новая заметка
            </Button>
          </Stack>

          <Stack spacing={1.5}>
            {filteredNotes.map((n) => (
              <Paper key={n.id} sx={{ p: 2 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
                  <Box>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                      <Typography fontWeight={700}>{n.title}</Typography>
                      <Chip
                        size="small"
                        label={n.visibility === 'PERSONAL' ? 'Личная' : 'Общая'}
                        color={n.visibility === 'PERSONAL' ? 'default' : 'primary'}
                      />
                    </Stack>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mb: 1 }}>
                      {n.body || '—'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {personLabel(n.author)} · {new Date(n.updatedAt).toLocaleString('ru-RU')}
                    </Typography>
                  </Box>
                  <Stack direction="row">
                    {(n.authorUserId === user?.id || (isOwner && n.visibility === 'SHARED')) && (
                      <>
                        <IconButton size="small" onClick={() => openEditNote(n)} aria-label="Изменить">
                          <Edit fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => void removeNote(n.id)} aria-label="Удалить">
                          <Delete fontSize="small" />
                        </IconButton>
                      </>
                    )}
                  </Stack>
                </Stack>
              </Paper>
            ))}
            {!filteredNotes.length && (
              <Typography color="text.secondary">Пока нет заметок</Typography>
            )}
          </Stack>
        </Box>
      )}

      {tab === 1 && (
        <Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 2 }} alignItems="center">
            <TextField
              select
              size="small"
              label="Статус"
              value={taskStatus}
              onChange={(e) => setTaskStatus(e.target.value as any)}
              sx={{ minWidth: 160 }}
            >
              <MenuItem value="OPEN">Открытые</MenuItem>
              <MenuItem value="DONE">Выполненные</MenuItem>
              <MenuItem value="ALL">Все</MenuItem>
            </TextField>
            <Box flex={1} />
            {isOwner && (
              <Button variant="contained" startIcon={<Add />} onClick={openNewTask} sx={{ textTransform: 'none' }}>
                Новая задача
              </Button>
            )}
          </Stack>

          <Stack spacing={1.5}>
            {tasks.map((t) => {
              const overdue =
                t.status === 'OPEN' && t.dueAt && new Date(t.dueAt).getTime() < Date.now();
              return (
                <Paper
                  key={t.id}
                  sx={{
                    p: 2,
                    borderLeft: overdue ? `4px solid ${colors.danger}` : undefined,
                  }}
                >
                  <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2}>
                    <Box flex={1}>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ mb: 0.5 }}>
                        <Typography fontWeight={700}>{t.title}</Typography>
                        <Chip size="small" label={t.status === 'OPEN' ? 'Открыта' : t.status === 'DONE' ? 'Готово' : t.status} />
                        {overdue && <Chip size="small" color="error" label="Просрочена" />}
                      </Stack>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mb: 1 }}>
                        {t.body || '—'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        Дедлайн:{' '}
                        {t.dueAt ? new Date(t.dueAt).toLocaleString('ru-RU') : 'не указан'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        Исполнители:{' '}
                        {t.assignees.map((a) => personLabel(a.user)).join(', ') || '—'}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="flex-start">
                      <Button
                        size="small"
                        startIcon={<Chat />}
                        onClick={() => void openTaskChat(t)}
                        sx={{ textTransform: 'none' }}
                      >
                        {t.chatThread ? 'Открыть чат' : 'Создать чат'}
                      </Button>
                      {t.status === 'OPEN' && (
                        <Button size="small" onClick={() => void setTaskDone(t, 'DONE')} sx={{ textTransform: 'none' }}>
                          Готово
                        </Button>
                      )}
                      {t.status === 'DONE' && (
                        <Button size="small" onClick={() => void setTaskDone(t, 'OPEN')} sx={{ textTransform: 'none' }}>
                          Открыть снова
                        </Button>
                      )}
                      {isOwner && (
                        <IconButton size="small" onClick={() => openEditTask(t)}>
                          <Edit fontSize="small" />
                        </IconButton>
                      )}
                      {isOwner && (
                        <IconButton
                          size="small"
                          onClick={async () => {
                            if (!window.confirm('Удалить задачу?')) return;
                            try {
                              await apiService.deleteStaffTask(t.id);
                              await loadTasks();
                            } catch (e: any) {
                              setError(e?.response?.data?.error || 'Не удалось удалить');
                            }
                          }}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      )}
                    </Stack>
                  </Stack>
                </Paper>
              );
            })}
            {!tasks.length && (
              <Typography color="text.secondary">Пока нет задач</Typography>
            )}
          </Stack>
        </Box>
      )}

      <Dialog open={noteDialog} onClose={() => setNoteDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingNote ? 'Редактировать заметку' : 'Новая заметка'}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Заголовок"
            value={noteTitle}
            onChange={(e) => setNoteTitle(e.target.value)}
            sx={{ mt: 1, mb: 2 }}
          />
          <TextField
            fullWidth
            multiline
            minRows={5}
            label="Текст"
            value={noteBody}
            onChange={(e) => setNoteBody(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            select
            fullWidth
            label="Видимость"
            value={noteVisibility}
            onChange={(e) => setNoteVisibility(e.target.value as any)}
          >
            <MenuItem value="PERSONAL">Личная</MenuItem>
            <MenuItem value="SHARED">Общая (для сотрудников школы)</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNoteDialog(false)}>Отмена</Button>
          <Button variant="contained" onClick={() => void saveNote()} disabled={saving || !noteTitle.trim()}>
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={taskDialog} onClose={() => setTaskDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle>{editingTask ? 'Редактировать задачу' : 'Новая задача'}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Назначьте задачу администратору или тренеру, укажите дедлайн и при необходимости создайте чат по задаче.
          </Typography>
          <TextField
            fullWidth
            label="Заголовок"
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            multiline
            minRows={10}
            label="Описание задачи"
            value={taskBody}
            onChange={(e) => setTaskBody(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            type="datetime-local"
            label="Дедлайн"
            value={taskDueAt}
            onChange={(e) => setTaskDueAt(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ mb: 2 }}
          />
          <Autocomplete
            multiple
            options={staffUsers}
            value={taskAssignees}
            onChange={(_, v) => setTaskAssignees(v)}
            getOptionLabel={(o) => personLabel(o)}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            filterOptions={(options, state) => {
              const q = state.inputValue.trim().toLowerCase();
              if (!q) return options;
              return options.filter((o) => personLabel(o).toLowerCase().includes(q));
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Исполнители"
                helperText="Выберите из списка или начните вводить ФИО"
              />
            )}
            sx={{ mb: 2 }}
          />
          <FormControlLabel
            control={<Switch checked={createChat} onChange={(_, v) => setCreateChat(v)} />}
            label="Создать чат по этой задаче"
          />
          <Divider sx={{ my: 1 }} />
          <Typography variant="caption" color="text.secondary">
            Если исполнителей несколько, будет создан групповой чат с пометкой «Задача» в списке чатов.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTaskDialog(false)}>Отмена</Button>
          <Button
            variant="contained"
            onClick={() => void saveTask()}
            disabled={saving || !taskTitle.trim() || taskAssignees.length === 0}
          >
            {editingTask ? 'Сохранить' : 'Создать задачу'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default StaffWorkspace;
