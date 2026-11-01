import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Drawer,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { Close, ContentCopy, LinkOutlined, LocalOfferOutlined } from '@mui/icons-material';
import { apiService } from '../../services/api';
import PasswordField from '../common/PasswordField';

type Props = {
  marketerId: string | null;
  open: boolean;
  onClose: () => void;
  formatCurrency: (n: number) => string;
  onChanged?: () => void;
};

const moneyShort = (n: number) =>
  new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(n || 0);

const SaMarketerDrawer: React.FC<Props> = ({
  marketerId,
  open,
  onClose,
  formatCurrency,
  onChanged,
}) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [detail, setDetail] = useState<any>(null);
  const [finance, setFinance] = useState<any>(null);

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    type: 'MARKETER',
    commissionPercentage: 10,
    isActive: true,
    password: '',
  });

  const [promoForm, setPromoForm] = useState({
    code: '',
    discountType: 'PERCENTAGE',
    discountValue: '',
    validFrom: new Date().toISOString().slice(0, 16),
    validUntil: '',
  });
  const [promoBusy, setPromoBusy] = useState(false);

  const personalPromo = useMemo(() => {
    const list = (detail?.promoCodes || []) as any[];
    return list.find((p) => p.isActive && p.marketerId === marketerId) || list.find((p) => p.isActive) || list[0] || null;
  }, [detail, marketerId]);

  const primaryRef = useMemo(() => {
    const list = (detail?.referralLinks || []) as any[];
    return list.find((l) => l.isActive) || list[0] || null;
  }, [detail]);

  const refUrl = primaryRef
    ? `${window.location.origin}/ref/${primaryRef.code}`
    : '';

  const load = useCallback(async () => {
    if (!marketerId) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const [m, fin] = await Promise.all([
        apiService.getPlatformMarketer(marketerId),
        apiService.getAdminMarketerStats(marketerId),
      ]);
      setDetail(m);
      setFinance(fin);
      setForm({
        name: m.name || '',
        email: m.email || '',
        phone: m.phone || '',
        type: m.type || 'MARKETER',
        commissionPercentage: Number(m.commissionPercentage ?? 10),
        isActive: m.isActive !== false,
        password: '',
      });
      if (m.promoCodes?.length) {
        const p = m.promoCodes.find((x: any) => x.isActive) || m.promoCodes[0];
        setPromoForm({
          code: p.code || '',
          discountType: p.discountType || 'PERCENTAGE',
          discountValue: String(p.discountValue ?? ''),
          validFrom: p.validFrom ? String(p.validFrom).slice(0, 16) : new Date().toISOString().slice(0, 16),
          validUntil: p.validUntil ? String(p.validUntil).slice(0, 16) : '',
        });
      } else {
        setPromoForm({
          code: '',
          discountType: 'PERCENTAGE',
          discountValue: '',
          validFrom: new Date().toISOString().slice(0, 16),
          validUntil: '',
        });
      }
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Не удалось загрузить карточку');
    } finally {
      setLoading(false);
    }
  }, [marketerId]);

  useEffect(() => {
    if (open && marketerId) void load();
  }, [open, marketerId, load]);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setSuccess('Скопировано');
    } catch {
      /* ignore */
    }
  };

  const saveProfile = async () => {
    if (!marketerId) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const payload: any = {
        name: form.name,
        email: form.email,
        phone: form.phone || undefined,
        type: form.type,
        commissionPercentage: Number(form.commissionPercentage),
        isActive: form.isActive,
      };
      if (form.password) payload.password = form.password;
      await apiService.updatePlatformMarketer(marketerId, payload);
      setSuccess('Профиль сохранён');
      setForm((f) => ({ ...f, password: '' }));
      await load();
      onChanged?.();
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  const ensureRefLink = async () => {
    if (!marketerId) return;
    setPromoBusy(true);
    setError('');
    try {
      await apiService.createPlatformReferralLink({
        name: 'Рекламная ссылка',
        description: 'Ссылка для школ',
        url: '/register',
        marketerId,
        isActive: true,
      });
      setSuccess('Ссылка создана');
      await load();
      onChanged?.();
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Не удалось создать ссылку');
    } finally {
      setPromoBusy(false);
    }
  };

  const savePersonalPromo = async () => {
    if (!marketerId) return;
    const code = promoForm.code.trim().toUpperCase();
    const discountValue = Number(promoForm.discountValue);
    if (!code || !Number.isFinite(discountValue) || discountValue <= 0) {
      setError('Укажите код и положительную скидку');
      return;
    }
    if (!promoForm.validFrom) {
      setError('Укажите дату начала действия');
      return;
    }
    setPromoBusy(true);
    setError('');
    setSuccess('');
    try {
      const payload = {
        code,
        discountType: promoForm.discountType,
        discountValue,
        validFrom: promoForm.validFrom,
        validUntil: promoForm.validUntil || undefined,
        marketerId,
        isActive: true,
        description: 'Личный промокод маркетолога',
      };
      if (personalPromo?.id) {
        await apiService.updatePlatformPromoCode(personalPromo.id, payload);
        setSuccess('Промокод обновлён');
      } else {
        await apiService.createPlatformPromoCode(payload);
        setSuccess('Промокод назначен');
      }
      await load();
      onChanged?.();
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Не удалось сохранить промокод');
    } finally {
      setPromoBusy(false);
    }
  };

  const unlinkPromo = async () => {
    if (!personalPromo?.id) return;
    if (!window.confirm('Отвязать промокод от маркетолога? Код останется на платформе без владельца.')) return;
    setPromoBusy(true);
    setError('');
    try {
      await apiService.updatePlatformPromoCode(personalPromo.id, { marketerId: null });
      setSuccess('Промокод отвязан');
      await load();
      onChanged?.();
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Не удалось отвязать');
    } finally {
      setPromoBusy(false);
    }
  };

  const stats = finance?.stats;
  const schools = finance?.referredTenants || [];

  return (
    <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: { xs: '100%', sm: 480, md: 560 } } }}>
      <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
          <Typography variant="h6" fontWeight={800}>
            Карточка маркетолога
          </Typography>
          <IconButton onClick={onClose} aria-label="Закрыть">
            <Close />
          </IconButton>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" sx={{ mb: 1.5 }} onClose={() => setSuccess('')}>
            {success}
          </Alert>
        )}

        {loading || !detail ? (
          <Box display="flex" justifyContent="center" py={6}>
            <CircularProgress />
          </Box>
        ) : (
          <Box sx={{ overflow: 'auto', flex: 1, pr: 0.5 }}>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
              <Chip
                size="small"
                label={form.isActive ? 'Активен' : 'Выкл'}
                color={form.isActive ? 'success' : 'default'}
              />
              <Chip size="small" label={`Баланс ${formatCurrency(Number(detail.balance || 0))}`} />
              {stats && (
                <>
                  <Chip size="small" variant="outlined" label={`Школ: ${stats.referredTenantsCount}`} />
                  <Chip
                    size="small"
                    variant="outlined"
                    label={`Доход ${moneyShort(stats.totalRevenue)} ₽`}
                  />
                  <Chip
                    size="small"
                    variant="outlined"
                    label={`Комиссия ${moneyShort(stats.totalCommission)} ₽`}
                  />
                </>
              )}
            </Stack>

            <Typography variant="subtitle2" fontWeight={700} gutterBottom>
              Профиль
            </Typography>
            <Grid container spacing={1.5} sx={{ mb: 2 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  label="Имя"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Телефон"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Тип</InputLabel>
                  <Select
                    label="Тип"
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                  >
                    <MenuItem value="MARKETER">Маркетолог</MenuItem>
                    <MenuItem value="MEDIA_PARTNER">Медиа-партнёр</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  label="Комиссия %"
                  value={form.commissionPercentage}
                  onChange={(e) => setForm({ ...form, commissionPercentage: Number(e.target.value) })}
                  inputProps={{ min: 0, max: 100 }}
                />
              </Grid>
              <Grid item xs={12}>
                <PasswordField
                  fullWidth
                  size="small"
                  label="Новый пароль (необязательно)"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
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
              <Grid item xs={12}>
                <Button variant="contained" disabled={saving} onClick={() => void saveProfile()} sx={{ textTransform: 'none' }}>
                  {saving ? 'Сохранение…' : 'Сохранить профиль'}
                </Button>
              </Grid>
            </Grid>

            <Divider sx={{ my: 2 }} />

            <Box display="flex" alignItems="center" gap={1} mb={1}>
              <LinkOutlined fontSize="small" color="primary" />
              <Typography variant="subtitle2" fontWeight={700}>
                Ссылка для школ
              </Typography>
            </Box>
            {refUrl ? (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  p: 1.25,
                  mb: 2,
                  borderRadius: 1,
                  border: '1px dashed',
                  borderColor: 'divider',
                  bgcolor: 'action.hover',
                }}
              >
                <Typography
                  component="code"
                  sx={{ flex: 1, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis' }}
                >
                  {refUrl.replace(/^https?:\/\//, '')}
                </Typography>
                <IconButton size="small" onClick={() => void copy(refUrl)}>
                  <ContentCopy fontSize="small" />
                </IconButton>
              </Box>
            ) : (
              <Button
                size="small"
                variant="outlined"
                disabled={promoBusy}
                onClick={() => void ensureRefLink()}
                sx={{ mb: 2, textTransform: 'none' }}
              >
                Создать ссылку /ref
              </Button>
            )}

            <Box display="flex" alignItems="center" gap={1} mb={1}>
              <LocalOfferOutlined fontSize="small" color="success" />
              <Typography variant="subtitle2" fontWeight={700}>
                Личный промокод
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
              Скидка % или ₽ + закрепление школы как по ссылке. В кабинете маркетолога блок виден
              только если код назначен.
            </Typography>
            <Grid container spacing={1.5} sx={{ mb: 1 }}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Код"
                  value={promoForm.code}
                  onChange={(e) => setPromoForm({ ...promoForm, code: e.target.value.toUpperCase() })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Тип скидки</InputLabel>
                  <Select
                    label="Тип скидки"
                    value={promoForm.discountType}
                    onChange={(e) => setPromoForm({ ...promoForm, discountType: e.target.value })}
                  >
                    <MenuItem value="PERCENTAGE">Процент (%)</MenuItem>
                    <MenuItem value="FIXED">Рубли (₽)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  size="small"
                  label={promoForm.discountType === 'PERCENTAGE' ? 'Скидка, %' : 'Скидка, ₽'}
                  value={promoForm.discountValue}
                  onChange={(e) => setPromoForm({ ...promoForm, discountValue: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  size="small"
                  type="datetime-local"
                  label="Действует с"
                  InputLabelProps={{ shrink: true }}
                  value={promoForm.validFrom}
                  onChange={(e) => setPromoForm({ ...promoForm, validFrom: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Button
                    variant="contained"
                    color="success"
                    disabled={promoBusy}
                    onClick={() => void savePersonalPromo()}
                    sx={{ textTransform: 'none' }}
                  >
                    {personalPromo ? 'Обновить промокод' : 'Назначить промокод'}
                  </Button>
                  {personalPromo && (
                    <>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<ContentCopy />}
                        onClick={() => void copy(personalPromo.code)}
                        sx={{ textTransform: 'none' }}
                      >
                        Копировать
                      </Button>
                      <Button
                        color="inherit"
                        size="small"
                        disabled={promoBusy}
                        onClick={() => void unlinkPromo()}
                        sx={{ textTransform: 'none' }}
                      >
                        Отвязать
                      </Button>
                    </>
                  )}
                </Stack>
              </Grid>
            </Grid>

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle2" fontWeight={700} gutterBottom>
              Привлечённые школы
            </Typography>
            {schools.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Пока нет закреплённых организаций
              </Typography>
            ) : (
              <Stack spacing={0.75}>
                {schools.map((s: any) => (
                  <Box
                    key={s.id}
                    sx={{
                      p: 1,
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Typography fontWeight={600} fontSize={13}>
                      {s.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {s.email || '—'} · {s.planType || '—'} · {s.subscriptionStatus || '—'}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            )}
          </Box>
        )}
      </Box>
    </Drawer>
  );
};

export default SaMarketerDrawer;
