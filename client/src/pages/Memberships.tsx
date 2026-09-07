import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { Add } from '@mui/icons-material';
import { apiService } from '../services/api';
import { Membership } from '../types';
import { colors, typography } from '../theme/tokens';

type FormState = {
  name: string;
  description: string;
  price: string;
  type: 'visits' | 'monthly';
  visits: string;
  duration: string;
  isActive: boolean;
};

const emptyForm = (): FormState => ({
  name: '',
  description: '',
  price: '',
  type: 'visits',
  visits: '8',
  duration: '30',
  isActive: true,
});

/**
 * Каталог абонементов школы (шаблоны тарифов).
 */
const Memberships: React.FC = () => {
  const [items, setItems] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Membership | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await apiService.getMemberships({ limit: 200 });
      setItems(res.data || []);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Не удалось загрузить абонементы');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (m: Membership) => {
    setEditing(m);
    setForm({
      name: m.name || '',
      description: m.description || '',
      price: String(m.price ?? ''),
      type: m.type === 'monthly' ? 'monthly' : 'visits',
      visits: m.visits != null ? String(m.visits) : '',
      duration: m.duration != null ? String(m.duration) : '30',
      isActive: m.isActive !== false,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError('Укажите название');
      return;
    }
    const price = Number(form.price);
    if (!Number.isFinite(price) || price < 0) {
      setError('Укажите корректную цену');
      return;
    }

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      price,
      type: form.type,
      isActive: form.isActive,
    };
    if (form.type === 'visits') {
      const visits = parseInt(form.visits, 10);
      if (!Number.isFinite(visits) || visits <= 0) {
        setError('Укажите число посещений');
        return;
      }
      payload.visits = visits;
      payload.duration = null;
    } else {
      const duration = parseInt(form.duration, 10);
      if (!Number.isFinite(duration) || duration <= 0) {
        setError('Укажите срок в днях');
        return;
      }
      payload.duration = duration;
      payload.visits = null;
    }

    try {
      setSaving(true);
      setError('');
      if (editing) {
        await apiService.updateMembership(editing.id, payload);
      } else {
        await apiService.createMembership(payload);
      }
      setDialogOpen(false);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (m: Membership) => {
    if (!window.confirm(`Удалить абонемент «${m.name}»?`)) return;
    try {
      await apiService.deleteMembership(m.id);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Не удалось удалить (возможно, уже выдан клиентам)');
    }
  };

  return (
    <Box data-onboarding="memberships-page">
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          mb: 2,
        }}
      >
        <Typography
          component="h1"
          sx={{ fontWeight: 600, fontSize: typography.pageTitle, color: colors.text }}
        >
          Абонементы
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={openCreate}
          sx={{ textTransform: 'none', borderRadius: '19px' }}
        >
          Создать
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Typography color="text.secondary">Загрузка…</Typography>
      ) : items.length === 0 ? (
        <Box sx={{ bgcolor: colors.card, borderRadius: '12px', p: 4, textAlign: 'center' }}>
          <Typography sx={{ color: colors.textEmpty }}>
            Пока нет тарифов. Создайте абонемент на число занятий или на срок.
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {items.map((m) => (
            <Box
              key={m.id}
              sx={{
                bgcolor: colors.card,
                borderRadius: '12px',
                px: 2,
                py: 1.5,
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: '1.4fr 0.8fr 0.6fr 0.5fr auto' },
                gap: 1.5,
                alignItems: 'center',
                opacity: m.isActive ? 1 : 0.65,
              }}
            >
              <Box>
                <Typography sx={{ fontWeight: 600, fontSize: typography.label }}>
                  {m.name}
                  {!m.isActive && (
                    <Typography component="span" sx={{ ml: 1, color: colors.textHint, fontSize: 12 }}>
                      (неактивен)
                    </Typography>
                  )}
                </Typography>
                {m.description && (
                  <Typography sx={{ fontSize: typography.hint, color: colors.textMuted }}>
                    {m.description}
                  </Typography>
                )}
              </Box>
              <Typography sx={{ fontSize: typography.label }}>
                {m.type === 'monthly'
                  ? `Месячный · ${m.duration || '—'} дн.`
                  : `${m.visits ?? '—'} посещений`}
              </Typography>
              <Typography sx={{ fontWeight: 600 }}>
                {Number(m.price || 0).toLocaleString('ru-RU')} ₽
              </Typography>
              <Typography sx={{ fontSize: typography.hint, color: colors.textMuted }}>
                {m.type === 'visits' ? 'Занятия' : 'Срок'}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                <Button size="small" onClick={() => openEdit(m)} sx={{ textTransform: 'none' }}>
                  Изменить
                </Button>
                <Button
                  size="small"
                  color="error"
                  onClick={() => handleDelete(m)}
                  sx={{ textTransform: 'none' }}
                >
                  Удалить
                </Button>
              </Box>
            </Box>
          ))}
        </Box>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Редактировать абонемент' : 'Новый абонемент'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Название"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              fullWidth
              required
            />
            <TextField
              label="Описание"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              fullWidth
              multiline
              minRows={2}
            />
            <FormControl fullWidth>
              <InputLabel>Тип</InputLabel>
              <Select
                label="Тип"
                value={form.type}
                onChange={(e) =>
                  setForm((f) => ({ ...f, type: e.target.value as 'visits' | 'monthly' }))
                }
              >
                <MenuItem value="visits">На число занятий</MenuItem>
                <MenuItem value="monthly">На срок (дни)</MenuItem>
              </Select>
            </FormControl>
            {form.type === 'visits' ? (
              <TextField
                label="Число посещений"
                type="number"
                value={form.visits}
                onChange={(e) => setForm((f) => ({ ...f, visits: e.target.value }))}
                fullWidth
                inputProps={{ min: 1 }}
              />
            ) : (
              <TextField
                label="Срок (дни)"
                type="number"
                value={form.duration}
                onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))}
                fullWidth
                inputProps={{ min: 1 }}
              />
            )}
            <TextField
              label="Цена (₽)"
              type="number"
              value={form.price}
              onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              fullWidth
              inputProps={{ min: 0 }}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                />
              }
              label="Активен (доступен для выдачи)"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Отмена</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? 'Сохранение…' : 'Сохранить'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Memberships;
