import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { Delete, Edit } from '@mui/icons-material';
import ChatWorkspace from './chat/ChatWorkspace';
import { apiService } from '../services/api';
import { useSuperAdminAuth } from '../contexts/SuperAdminAuthContext';

interface ChangelogEntry {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  createdBy?: { firstName?: string; lastName?: string; email?: string };
}

/** Вкладка платформенных чатов в AdminDashboard. */
export const SuperAdminPlatformChatsTab: React.FC = () => {
  const { superAdmin } = useSuperAdminAuth();
  const token = localStorage.getItem('superAdminToken');
  if (!superAdmin) return null;
  return (
    <ChatWorkspace
      mode="platform"
      socketToken={token}
      self={{ kind: 'SUPER_ADMIN', id: superAdmin.id }}
    />
  );
};

/** CRUD списка изменений платформы для супер-админа. */
export const SuperAdminPlatformChangelogTab: React.FC = () => {
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ChangelogEntry | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiService.listPlatformChangelog();
      setEntries(data || []);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось загрузить изменения');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setTitle('');
    setBody('');
    setDialogOpen(true);
  };

  const openEdit = (entry: ChangelogEntry) => {
    setEditing(entry);
    setTitle(entry.title);
    setBody(entry.body);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!title.trim() || !body.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await apiService.updatePlatformChangelog(editing.id, { title: title.trim(), body: body.trim() });
      } else {
        await apiService.createPlatformChangelog({ title: title.trim(), body: body.trim() });
      }
      setDialogOpen(false);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Удалить запись?')) return;
    try {
      await apiService.deletePlatformChangelog(id);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось удалить');
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6" fontWeight={700}>
          Изменения платформы
        </Typography>
        <Button variant="contained" onClick={openCreate}>
          Добавить
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress />
        </Box>
      ) : entries.length === 0 ? (
        <Typography color="text.secondary">Пока нет записей</Typography>
      ) : (
        entries.map((e) => (
          <Paper key={e.id} sx={{ p: 2, mb: 2 }}>
            <Box display="flex" justifyContent="space-between" alignItems="flex-start">
              <Box>
                <Typography variant="h6" fontWeight={700}>
                  {e.title}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {new Date(e.createdAt).toLocaleString('ru-RU')}
                  {e.createdBy
                    ? ` · ${[e.createdBy.lastName, e.createdBy.firstName].filter(Boolean).join(' ') || e.createdBy.email}`
                    : ''}
                </Typography>
              </Box>
              <Box>
                <IconButton size="small" onClick={() => openEdit(e)} title="Редактировать">
                  <Edit fontSize="small" />
                </IconButton>
                <IconButton size="small" color="error" onClick={() => handleDelete(e.id)} title="Удалить">
                  <Delete fontSize="small" />
                </IconButton>
              </Box>
            </Box>
            <Divider sx={{ my: 1.5 }} />
            <Typography sx={{ whiteSpace: 'pre-wrap' }}>{e.body}</Typography>
          </Paper>
        ))
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Редактировать запись' : 'Новая запись'}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Заголовок"
            value={title}
            onChange={(ev) => setTitle(ev.target.value)}
            sx={{ mt: 1, mb: 2 }}
          />
          <TextField
            fullWidth
            label="Текст"
            value={body}
            onChange={(ev) => setBody(ev.target.value)}
            multiline
            minRows={4}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Отмена</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || !title.trim() || !body.trim()}
          >
            {saving ? <CircularProgress size={20} /> : 'Сохранить'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
