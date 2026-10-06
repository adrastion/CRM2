import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  FormGroup,
  IconButton,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { Delete, Download, Edit } from '@mui/icons-material';
import ChatWorkspace from './chat/ChatWorkspace';
import { ROLE_LABELS_NEWS } from './PlatformNewsFeed';
import { apiService } from '../services/api';
import { useSuperAdminAuth } from '../contexts/SuperAdminAuthContext';

/** Роли аудитории новости (SUPER_ADMIN всегда видит всё — в выбор не входит). */
const AUDIENCE_OPTIONS = Object.keys(ROLE_LABELS_NEWS).filter((r) => r !== 'SUPER_ADMIN');

const DEFAULT_AUDIENCE = ['TESTER'];

function normalizeAudience(roles?: string[] | null): string[] {
  const filtered = (roles || []).filter((r) => r !== 'SUPER_ADMIN' && AUDIENCE_OPTIONS.includes(r));
  return filtered.length > 0 ? filtered : [...DEFAULT_AUDIENCE];
}

interface ChangelogEntry {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  audienceRoles?: string[];
  imageUrl?: string | null;
  fileUrl?: string | null;
  createdBy?: { firstName?: string; lastName?: string; email?: string };
}

const SaNewsImage: React.FC<{ id: string; hasImage: boolean }> = ({ id, hasImage }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!hasImage) return;
    let revoked: string | null = null;
    let cancelled = false;
    setFailed(false);
    setUrl(null);
    (async () => {
      try {
        const blob = await apiService.downloadPlatformNewsImageBlob(id, 'sa');
        if (cancelled) return;
        const u = URL.createObjectURL(blob);
        revoked = u;
        setUrl(u);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [id, hasImage]);
  if (!hasImage) return null;
  if (failed) {
    return (
      <Typography variant="caption" color="error" sx={{ mt: 1.5, display: 'block' }}>
        Не удалось загрузить изображение
      </Typography>
    );
  }
  if (!url) return null;
  return (
    <Box
      component="img"
      src={url}
      alt=""
      sx={{
        mt: 1.5,
        display: 'block',
        width: '100%',
        maxHeight: 360,
        objectFit: 'contain',
        borderRadius: 1,
        bgcolor: 'action.hover',
      }}
    />
  );
};

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

/** CRUD новостей платформы для супер-админа. */
export const SuperAdminPlatformChangelogTab: React.FC = () => {
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ChangelogEntry | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audienceRoles, setAudienceRoles] = useState<string[]>([...DEFAULT_AUDIENCE]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [clearImage, setClearImage] = useState(false);
  const [clearFile, setClearFile] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiService.listPlatformChangelog();
      setEntries(data || []);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось загрузить новости');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!imageFile) {
      setImagePreview(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const openCreate = () => {
    setEditing(null);
    setTitle('');
    setBody('');
    setAudienceRoles([...DEFAULT_AUDIENCE]);
    setImageFile(null);
    setDocFile(null);
    setClearImage(false);
    setClearFile(false);
    setDialogOpen(true);
  };

  const openEdit = (entry: ChangelogEntry) => {
    setEditing(entry);
    setTitle(entry.title);
    setBody(entry.body);
    setAudienceRoles(normalizeAudience(entry.audienceRoles));
    setImageFile(null);
    setDocFile(null);
    setClearImage(false);
    setClearFile(false);
    setDialogOpen(true);
  };

  const toggleRole = (role: string) => {
    setAudienceRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const selectAllRoles = () => setAudienceRoles([...AUDIENCE_OPTIONS]);
  const clearAllRoles = () => setAudienceRoles([]);

  const handleSave = async () => {
    if (!title.trim() || !body.trim() || audienceRoles.length === 0) return;
    setSaving(true);
    try {
      if (editing) {
        await apiService.updatePlatformChangelog(editing.id, {
          title: title.trim(),
          body: body.trim(),
          audienceRoles,
          image: imageFile,
          file: docFile,
          clearImage,
          clearFile,
        });
      } else {
        await apiService.createPlatformChangelog({
          title: title.trim(),
          body: body.trim(),
          audienceRoles,
          image: imageFile,
          file: docFile,
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
          Новости платформы
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
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="h6" fontWeight={700}>
                  {e.title}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {new Date(e.createdAt).toLocaleString('ru-RU')}
                  {e.createdBy
                    ? ` · ${
                        [e.createdBy.lastName, e.createdBy.firstName].filter(Boolean).join(' ') ||
                        e.createdBy.email
                      }`
                    : ''}
                </Typography>
                <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {(e.audienceRoles || [])
                    .filter((r) => r !== 'SUPER_ADMIN')
                    .map((r) => (
                      <Chip key={r} size="small" label={ROLE_LABELS_NEWS[r] || r} />
                    ))}
                </Box>
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
            <SaNewsImage id={e.id} hasImage={Boolean(e.imageUrl)} />
            {e.fileUrl && (
              <Button
                size="small"
                startIcon={<Download />}
                sx={{ mt: 1.5, textTransform: 'none' }}
                onClick={async () => {
                  const blob = await apiService.downloadPlatformNewsFileBlob(e.id, 'sa');
                  const url = URL.createObjectURL(blob);
                  window.open(url, '_blank');
                }}
              >
                Скачать файл
              </Button>
            )}
          </Paper>
        ))
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editing ? 'Редактировать новость' : 'Новая новость'}</DialogTitle>
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
            sx={{ mb: 2 }}
          />
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
            Аудитория
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
            Супер-админ всегда видит все новости и в выбор не входит.
          </Typography>
          <Box display="flex" gap={1} flexWrap="wrap" sx={{ mb: 1 }}>
            <Button size="small" variant="outlined" onClick={selectAllRoles} sx={{ textTransform: 'none' }}>
              Все роли
            </Button>
            <Button size="small" variant="text" onClick={clearAllRoles} sx={{ textTransform: 'none' }}>
              Снять все
            </Button>
          </Box>
          <FormControl component="fieldset" sx={{ mb: 2 }}>
            <FormGroup row>
              {AUDIENCE_OPTIONS.map((role) => (
                <FormControlLabel
                  key={role}
                  control={
                    <Checkbox
                      size="small"
                      checked={audienceRoles.includes(role)}
                      onChange={() => toggleRole(role)}
                    />
                  }
                  label={ROLE_LABELS_NEWS[role] || role}
                />
              ))}
            </FormGroup>
          </FormControl>
          <Box display="flex" gap={2} flexWrap="wrap" sx={{ mb: 1 }}>
            <Button variant="outlined" component="label" sx={{ textTransform: 'none' }}>
              {imageFile ? `Изображение: ${imageFile.name}` : 'Загрузить изображение'}
              <input
                type="file"
                hidden
                accept="image/*"
                onChange={(e) => {
                  setImageFile(e.target.files?.[0] || null);
                  setClearImage(false);
                }}
              />
            </Button>
            <Button variant="outlined" component="label" sx={{ textTransform: 'none' }}>
              {docFile ? `Файл: ${docFile.name}` : 'Загрузить файл'}
              <input
                type="file"
                hidden
                onChange={(e) => {
                  setDocFile(e.target.files?.[0] || null);
                  setClearFile(false);
                }}
              />
            </Button>
          </Box>
          {imagePreview && (
            <Box
              component="img"
              src={imagePreview}
              alt=""
              sx={{ maxWidth: '100%', maxHeight: 200, borderRadius: 1, mb: 1 }}
            />
          )}
          {editing?.imageUrl && !imageFile && (
            <FormControlLabel
              control={
                <Checkbox checked={clearImage} onChange={(_, v) => setClearImage(v)} />
              }
              label="Удалить текущее изображение"
            />
          )}
          {editing?.fileUrl && !docFile && (
            <FormControlLabel
              control={<Checkbox checked={clearFile} onChange={(_, v) => setClearFile(v)} />}
              label="Удалить текущий файл"
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Отмена</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || !title.trim() || !body.trim() || audienceRoles.length === 0}
          >
            {saving ? <CircularProgress size={20} /> : 'Сохранить'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
