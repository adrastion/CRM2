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
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { Add, Delete, Edit } from '@mui/icons-material';
import { apiService } from '../../services/api';

const emptyPromo = {
  code: '',
  description: '',
  discountType: 'PERCENTAGE',
  discountValue: '',
  validFrom: '',
  validUntil: '',
  marketerId: '',
  isActive: true,
};

type Props = {
  refreshKey?: number;
};

const SaMarketerPromosPanel: React.FC<Props> = ({ refreshKey = 0 }) => {
  const [promos, setPromos] = useState<any[]>([]);
  const [marketers, setMarketers] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState(emptyPromo);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [res, m] = await Promise.all([
        apiService.getPlatformPromoCodes({ limit: 200 }),
        apiService.getPlatformMarketers({ limit: 200 }),
      ]);
      setPromos(res.data || []);
      setMarketers((m.data || []).map((x: any) => ({ id: x.id, name: x.name })));
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Не удалось загрузить промокоды');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...emptyPromo,
      validFrom: new Date().toISOString().slice(0, 16),
    });
    setDialog(true);
  };

  const openEdit = (p: any) => {
    setEditing(p);
    setForm({
      code: p.code,
      description: p.description || '',
      discountType: p.discountType,
      discountValue: String(p.discountValue),
      validFrom: p.validFrom ? String(p.validFrom).slice(0, 16) : '',
      validUntil: p.validUntil ? String(p.validUntil).slice(0, 16) : '',
      marketerId: p.marketerId || '',
      isActive: p.isActive,
    });
    setDialog(true);
  };

  const save = async () => {
    try {
      const payload: any = {
        code: form.code.trim().toUpperCase(),
        description: form.description || undefined,
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        validFrom: form.validFrom,
        validUntil: form.validUntil || undefined,
        marketerId: form.marketerId || null,
        isActive: form.isActive,
      };
      if (editing) await apiService.updatePlatformPromoCode(editing.id, payload);
      else await apiService.createPlatformPromoCode(payload);
      setDialog(false);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Ошибка сохранения промокода');
    }
  };

  const remove = async (p: any) => {
    if (!window.confirm(`Удалить промокод ${p.code}?`)) return;
    try {
      await apiService.deletePlatformPromoCode(p.id);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Ошибка удаления');
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5} flexWrap="wrap" gap={1}>
        <Box>
          <Typography variant="h6" fontWeight={700}>
            Промокоды платформы
          </Typography>
          <Typography variant="body2" color="text.secondary">
            С маркетологом — личный код (скидка + закрепление). Без маркетолога — общая акция.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={openCreate} sx={{ textTransform: 'none' }}>
          Добавить
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" py={3}>
          <CircularProgress size={28} />
        </Box>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Код</TableCell>
                <TableCell>Скидка</TableCell>
                <TableCell>Маркетолог</TableCell>
                <TableCell>Статус</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {promos.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.code}</TableCell>
                  <TableCell>
                    {p.discountType === 'PERCENTAGE' ? `${p.discountValue}%` : `${p.discountValue} ₽`}
                  </TableCell>
                  <TableCell>{p.marketer?.name || '—'}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={p.isActive ? 'Активен' : 'Выкл'}
                      color={p.isActive ? 'success' : 'default'}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => openEdit(p)}>
                      <Edit fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="error" onClick={() => void remove(p)}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {promos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Typography color="text.secondary" sx={{ py: 2 }}>
                      Промокодов пока нет
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={dialog} onClose={() => setDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Редактировать промокод' : 'Новый промокод'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Код"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Тип скидки</InputLabel>
                <Select
                  label="Тип скидки"
                  value={form.discountType}
                  onChange={(e) => setForm({ ...form, discountType: e.target.value })}
                >
                  <MenuItem value="PERCENTAGE">Процент (%)</MenuItem>
                  <MenuItem value="FIXED">Рубли (₽)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={form.discountType === 'PERCENTAGE' ? 'Скидка, %' : 'Скидка, ₽'}
                value={form.discountValue}
                onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Маркетолог (личный код)</InputLabel>
                <Select
                  label="Маркетолог (личный код)"
                  value={form.marketerId}
                  onChange={(e) => setForm({ ...form, marketerId: e.target.value })}
                >
                  <MenuItem value="">— без маркетолога —</MenuItem>
                  {marketers.map((m) => (
                    <MenuItem key={m.id} value={m.id}>
                      {m.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="datetime-local"
                label="Действует с"
                InputLabelProps={{ shrink: true }}
                value={form.validFrom}
                onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="datetime-local"
                label="Действует до"
                InputLabelProps={{ shrink: true }}
                value={form.validUntil}
                onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Описание"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  />
                }
                label="Активен"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(false)}>Отмена</Button>
          <Button variant="contained" onClick={() => void save()}>
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SaMarketerPromosPanel;
