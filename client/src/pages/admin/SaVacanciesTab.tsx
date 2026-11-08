import React, { useCallback, useEffect, useState } from 'react';
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
  FormControlLabel,
  MenuItem,
  Paper,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { apiService } from '../../services/api';

const ROLE_OPTIONS = [
  { value: 'MARKETER', label: 'Маркетолог (регистрация)' },
  { value: 'DESIGNER', label: 'Дизайнер (заявка)' },
  { value: 'PROMOTER', label: 'Промоутер (заявка)' },
  { value: 'OTHER', label: 'Другое (заявка)' },
];

type Vacancy = {
  id: string;
  title: string;
  slug: string;
  roleType: string;
  description: string;
  requirements?: string | null;
  isActive: boolean;
  sortOrder: number;
  _count?: { applications: number };
};

type Application = {
  id: string;
  name: string;
  contacts: string;
  message: string;
  status: string;
  createdAt: string;
  vacancy?: { id: string; title: string; roleType: string };
};

const emptyForm = {
  title: '',
  slug: '',
  roleType: 'DESIGNER',
  description: '',
  requirements: '',
  isActive: true,
  sortOrder: 0,
};

/** CRUD вакансий и очередь заявок. */
const SaVacanciesTab: React.FC = () => {
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [apps, setApps] = useState<Application[]>([]);
  const [appFilter, setAppFilter] = useState<'NEW' | 'READ' | 'ARCHIVED' | ''>('NEW');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Vacancy | null>(null);
  const [form, setForm] = useState(emptyForm);

  const loadVacancies = useCallback(async () => {
    setVacancies((await apiService.adminListVacancies()) || []);
  }, []);

  const loadApps = useCallback(async () => {
    setApps(
      (await apiService.adminListVacancyApplications(
        appFilter ? { status: appFilter } : undefined
      )) || []
    );
  }, [appFilter]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await Promise.all([loadVacancies(), loadApps()]);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось загрузить');
    } finally {
      setLoading(false);
    }
  }, [loadApps, loadVacancies]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (tab === 1) void loadApps().catch(() => undefined);
  }, [appFilter, loadApps, tab]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (v: Vacancy) => {
    setEditing(v);
    setForm({
      title: v.title,
      slug: v.slug,
      roleType: v.roleType,
      description: v.description,
      requirements: v.requirements || '',
      isActive: v.isActive,
      sortOrder: v.sortOrder,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.title.trim() || !form.description.trim()) return;
    setBusy(true);
    setError('');
    try {
      const payload = {
        title: form.title.trim(),
        slug: form.slug.trim() || undefined,
        roleType: form.roleType,
        description: form.description.trim(),
        requirements: form.requirements.trim() || null,
        isActive: form.isActive,
        sortOrder: Number(form.sortOrder) || 0,
      };
      if (editing) await apiService.adminUpdateVacancy(editing.id, payload);
      else await apiService.adminCreateVacancy(payload);
      setDialogOpen(false);
      await loadVacancies();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось сохранить');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Удалить вакансию и все заявки по ней?')) return;
    setBusy(true);
    try {
      await apiService.adminDeleteVacancy(id);
      await loadVacancies();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось удалить');
    } finally {
      setBusy(false);
    }
  };

  const setAppStatus = async (id: string, status: string) => {
    setBusy(true);
    try {
      await apiService.adminUpdateVacancyApplication(id, status);
      await loadApps();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось обновить заявку');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Вакансии
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 720 }}>
        Маркетолог ведёт на регистрацию; дизайнер и промоутер — форма заявки на сайте.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Список вакансий" />
        <Tab label="Заявки" />
      </Tabs>

      {tab === 0 && (
        <Box>
          <Button variant="contained" sx={{ mb: 2 }} onClick={openCreate}>
            Создать вакансию
          </Button>
          {vacancies.length === 0 ? (
            <Typography color="text.secondary">Вакансий пока нет</Typography>
          ) : (
            vacancies.map((v) => (
              <Paper key={v.id} sx={{ p: 2, mb: 1.5 }}>
                <Box display="flex" justifyContent="space-between" gap={1} flexWrap="wrap">
                  <Box>
                    <Box display="flex" gap={1} alignItems="center" flexWrap="wrap" mb={0.5}>
                      <Typography fontWeight={800}>{v.title}</Typography>
                      <Chip size="small" label={v.roleType} />
                      {!v.isActive && <Chip size="small" label="Скрыта" color="warning" />}
                      <Chip size="small" variant="outlined" label={`Заявок: ${v._count?.applications || 0}`} />
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      /{v.slug} · порядок {v.sortOrder}
                    </Typography>
                    <Typography sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>{v.description}</Typography>
                  </Box>
                  <Box>
                    <Button size="small" onClick={() => openEdit(v)}>
                      Изменить
                    </Button>
                    <Button size="small" color="error" disabled={busy} onClick={() => void remove(v.id)}>
                      Удалить
                    </Button>
                  </Box>
                </Box>
              </Paper>
            ))
          )}
        </Box>
      )}

      {tab === 1 && (
        <Box>
          <Tabs value={appFilter} onChange={(_, v) => setAppFilter(v)} sx={{ mb: 2 }}>
            <Tab value="NEW" label="Новые" />
            <Tab value="READ" label="Прочитанные" />
            <Tab value="ARCHIVED" label="Архив" />
            <Tab value="" label="Все" />
          </Tabs>
          {apps.length === 0 ? (
            <Typography color="text.secondary">Заявок нет</Typography>
          ) : (
            apps.map((a) => (
              <Paper key={a.id} sx={{ p: 2, mb: 1.5 }}>
                <Typography fontWeight={700}>
                  {a.name} · {a.contacts}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {a.vacancy?.title || 'Вакансия'} · {new Date(a.createdAt).toLocaleString('ru-RU')}
                </Typography>
                <Typography sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>{a.message}</Typography>
                <Box display="flex" gap={1} mt={1.5}>
                  {a.status !== 'READ' && (
                    <Button size="small" disabled={busy} onClick={() => void setAppStatus(a.id, 'READ')}>
                      Прочитано
                    </Button>
                  )}
                  {a.status !== 'ARCHIVED' && (
                    <Button
                      size="small"
                      disabled={busy}
                      onClick={() => void setAppStatus(a.id, 'ARCHIVED')}
                    >
                      В архив
                    </Button>
                  )}
                </Box>
              </Paper>
            ))
          )}
        </Box>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Редактировать вакансию' : 'Новая вакансия'}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Название"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            sx={{ mt: 1, mb: 2 }}
          />
          <TextField
            fullWidth
            label="Slug (необязательно)"
            value={form.slug}
            onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
            sx={{ mb: 2 }}
          />
          <TextField
            select
            fullWidth
            label="Тип"
            value={form.roleType}
            onChange={(e) => setForm((f) => ({ ...f, roleType: e.target.value }))}
            sx={{ mb: 2 }}
          >
            {ROLE_OPTIONS.map((o) => (
              <MenuItem key={o.value} value={o.value}>
                {o.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            fullWidth
            label="Описание"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            multiline
            minRows={3}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Требования"
            value={form.requirements}
            onChange={(e) => setForm((f) => ({ ...f, requirements: e.target.value }))}
            multiline
            minRows={2}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            type="number"
            label="Порядок"
            value={form.sortOrder}
            onChange={(e) => setForm((f) => ({ ...f, sortOrder: Number(e.target.value) || 0 }))}
            sx={{ mb: 1 }}
          />
          <FormControlLabel
            control={
              <Switch
                checked={form.isActive}
                onChange={(_, v) => setForm((f) => ({ ...f, isActive: v }))}
              />
            }
            label="Активна на сайте"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Отмена</Button>
          <Button
            variant="contained"
            disabled={busy || !form.title.trim() || !form.description.trim()}
            onClick={() => void save()}
          >
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SaVacanciesTab;
