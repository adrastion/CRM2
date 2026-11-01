import React, { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { GetApp } from '@mui/icons-material';
import MarketerPayoutQueue from '../../components/admin/MarketerPayoutQueue';
import SaMarketersList, { type MarketerRow } from '../../components/admin/SaMarketersList';
import SaMarketerDrawer from '../../components/admin/SaMarketerDrawer';
import SaMarketerPromosPanel from '../../components/admin/SaMarketerPromosPanel';
import SaMarketerClosingDocsPanel from '../../components/admin/SaMarketerClosingDocsPanel';
import PasswordField from '../../components/common/PasswordField';
import { apiService } from '../../services/api';

export type SaMarketersTabProps = {
  marketerStats: any;
  marketerStatsLoading: boolean;
  formatCurrency: (amount: number) => string;
  onExportMarketers: () => void;
};

const emptyMarketer = {
  name: '',
  email: '',
  phone: '',
  type: 'MARKETER',
  password: '',
  isActive: true,
  commissionPercentage: 10,
};

const SaMarketersTab: React.FC<SaMarketersTabProps> = ({
  marketerStats,
  marketerStatsLoading,
  formatCurrency,
  onExportMarketers,
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [listKey, setListKey] = useState(0);
  const [promoKey, setPromoKey] = useState(0);

  const [marketerDialog, setMarketerDialog] = useState(false);
  const [editingMarketer, setEditingMarketer] = useState<MarketerRow | null>(null);
  const [marketerForm, setMarketerForm] = useState(emptyMarketer);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const statsById = useMemo(() => {
    const map: Record<string, { referredTenantsCount: number; totalRevenue: number; totalCommission: number }> = {};
    for (const m of marketerStats?.marketers || []) {
      map[m.id] = {
        referredTenantsCount: m.stats?.referredTenantsCount ?? 0,
        totalRevenue: m.stats?.totalRevenue ?? 0,
        totalCommission: m.stats?.totalCommission ?? 0,
      };
    }
    return map;
  }, [marketerStats]);

  const openCreate = () => {
    setEditingMarketer(null);
    setMarketerForm(emptyMarketer);
    setFormError('');
    setMarketerDialog(true);
  };

  const openEdit = (row: MarketerRow) => {
    setEditingMarketer(row);
    setMarketerForm({
      name: row.name,
      email: row.email,
      phone: row.phone || '',
      type: row.type,
      password: '',
      isActive: row.isActive,
      commissionPercentage: Number(row.commissionPercentage ?? 10),
    });
    setFormError('');
    setMarketerDialog(true);
  };

  const saveMarketer = async () => {
    setSaving(true);
    setFormError('');
    try {
      const payload: any = {
        name: marketerForm.name,
        email: marketerForm.email,
        phone: marketerForm.phone || undefined,
        type: marketerForm.type,
        isActive: marketerForm.isActive,
        commissionPercentage: Number(marketerForm.commissionPercentage),
      };
      if (marketerForm.password) payload.password = marketerForm.password;
      if (editingMarketer) {
        await apiService.updatePlatformMarketer(editingMarketer.id, payload);
      } else {
        if (!marketerForm.password) {
          setFormError('Укажите пароль');
          setSaving(false);
          return;
        }
        payload.password = marketerForm.password;
        await apiService.createPlatformMarketer(payload);
      }
      setMarketerDialog(false);
      setListKey((k) => k + 1);
    } catch (e: any) {
      setFormError(e?.response?.data?.error || e?.message || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const bump = () => {
    setListKey((k) => k + 1);
    setPromoKey((k) => k + 1);
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight="bold" mb={2}>
        Маркетологи
      </Typography>

      <MarketerPayoutQueue />

      <Paper sx={{ p: 2, mb: 3 }} variant="outlined">
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={1}>
          <Typography variant="subtitle1" fontWeight={700} color="text.secondary">
            Сводка
          </Typography>
          <Button variant="outlined" size="small" startIcon={<GetApp />} onClick={onExportMarketers} sx={{ textTransform: 'none' }}>
            Экспорт в Excel
          </Button>
        </Box>

        {marketerStatsLoading ? (
          <Box display="flex" justifyContent="center" py={2}>
            <CircularProgress size={28} />
          </Box>
        ) : marketerStats?.summary ? (
          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            <Grid item xs={6} md={3}>
              <Card variant="outlined">
                <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Typography variant="caption" color="text.secondary">
                    Всего маркетологов
                  </Typography>
                  <Typography variant="h6" fontWeight={800}>
                    {marketerStats.summary.totalMarketers}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} md={3}>
              <Card variant="outlined">
                <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Typography variant="caption" color="text.secondary">
                    Привлечено аккаунтов
                  </Typography>
                  <Typography variant="h6" fontWeight={800} color="success.main">
                    {marketerStats.summary.totalReferredTenants}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} md={3}>
              <Card variant="outlined">
                <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Typography variant="caption" color="text.secondary">
                    Общий доход
                  </Typography>
                  <Typography variant="h6" fontWeight={800} color="primary">
                    {formatCurrency(marketerStats.summary.totalRevenue)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} md={3}>
              <Card variant="outlined">
                <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Typography variant="caption" color="text.secondary">
                    Невыплачено
                  </Typography>
                  <Typography variant="h6" fontWeight={800} color="warning.main">
                    {formatCurrency(marketerStats.summary.totalUnpaid)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        ) : null}

        <SaMarketersList
          formatCurrency={formatCurrency}
          statsById={statsById}
          refreshKey={listKey}
          onOpen={(id) => {
            setSelectedId(id);
            setDrawerOpen(true);
          }}
          onCreate={openCreate}
          onEdit={openEdit}
        />
      </Paper>

      <Paper sx={{ p: 2, mb: 3 }} variant="outlined">
        <SaMarketerPromosPanel refreshKey={promoKey} />
      </Paper>

      <Paper sx={{ p: 2, mb: 2 }} variant="outlined">
        <SaMarketerClosingDocsPanel />
      </Paper>

      <SaMarketerDrawer
        open={drawerOpen}
        marketerId={selectedId}
        formatCurrency={formatCurrency}
        onClose={() => setDrawerOpen(false)}
        onChanged={bump}
      />

      <Dialog open={marketerDialog} onClose={() => setMarketerDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingMarketer ? 'Редактировать маркетолога' : 'Новый маркетолог'}</DialogTitle>
        <DialogContent>
          {formError && (
            <Typography color="error" variant="body2" sx={{ mt: 1 }}>
              {formError}
            </Typography>
          )}
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Имя"
                value={marketerForm.name}
                onChange={(e) => setMarketerForm({ ...marketerForm, name: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Email"
                value={marketerForm.email}
                onChange={(e) => setMarketerForm({ ...marketerForm, email: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Телефон"
                value={marketerForm.phone}
                onChange={(e) => setMarketerForm({ ...marketerForm, phone: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Тип</InputLabel>
                <Select
                  label="Тип"
                  value={marketerForm.type}
                  onChange={(e) => setMarketerForm({ ...marketerForm, type: e.target.value })}
                >
                  <MenuItem value="MARKETER">Маркетолог</MenuItem>
                  <MenuItem value="MEDIA_PARTNER">Медиа-партнёр</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="number"
                label="Комиссия %"
                value={marketerForm.commissionPercentage}
                onChange={(e) =>
                  setMarketerForm({ ...marketerForm, commissionPercentage: Number(e.target.value) })
                }
                inputProps={{ min: 0, max: 100 }}
              />
            </Grid>
            <Grid item xs={12}>
              <PasswordField
                fullWidth
                label={editingMarketer ? 'Новый пароль (необязательно)' : 'Пароль'}
                value={marketerForm.password}
                onChange={(e) => setMarketerForm({ ...marketerForm, password: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={marketerForm.isActive}
                    onChange={(e) => setMarketerForm({ ...marketerForm, isActive: e.target.checked })}
                  />
                }
                label="Активен"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMarketerDialog(false)}>Отмена</Button>
          <Button variant="contained" disabled={saving} onClick={() => void saveMarketer()}>
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
};

export default SaMarketersTab;
