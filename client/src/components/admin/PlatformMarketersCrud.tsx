import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
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
  Select,
  Switch,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Paper,
} from '@mui/material';
import { Add, ContentCopy, Delete, Edit } from '@mui/icons-material';
import { apiService } from '../../services/api';
import PasswordField from '../common/PasswordField';

type Mode = 'sa' | 'pca';

interface Props {
  mode: Mode;
}

const emptyMarketer = {
  name: '',
  email: '',
  phone: '',
  type: 'MARKETER',
  password: '',
  isActive: true,
  commissionPercentage: 10,
};

const emptyPromo = {
  code: '',
  description: '',
  discountType: 'PERCENTAGE',
  discountValue: '',
  minPurchase: '',
  maxDiscount: '',
  usageLimit: '',
  validFrom: '',
  validUntil: '',
  marketerId: '',
  isActive: true,
};

const emptyLink = {
  name: '',
  description: '',
  url: typeof window !== 'undefined' ? `${window.location.origin}/` : '/',
  marketerId: '',
  isActive: true,
};

/** CRUD маркетологов / промо / рефералок для SA (platform) или PCA (school APIs). */
const PlatformMarketersCrud: React.FC<Props> = ({ mode }) => {
  const [tab, setTab] = useState(0);
  const [error, setError] = useState('');
  const [marketers, setMarketers] = useState<any[]>([]);
  const [promos, setPromos] = useState<any[]>([]);
  const [links, setLinks] = useState<any[]>([]);
  const [marketerDialog, setMarketerDialog] = useState(false);
  const [promoDialog, setPromoDialog] = useState(false);
  const [linkDialog, setLinkDialog] = useState(false);
  const [editingMarketer, setEditingMarketer] = useState<any | null>(null);
  const [editingPromo, setEditingPromo] = useState<any | null>(null);
  const [editingLink, setEditingLink] = useState<any | null>(null);
  const [marketerForm, setMarketerForm] = useState(emptyMarketer);
  const [promoForm, setPromoForm] = useState(emptyPromo);
  const [linkForm, setLinkForm] = useState(emptyLink);
  const load = useCallback(async () => {
    setError('');
    try {
      if (mode === 'sa') {
        const [m, p, r] = await Promise.all([
          apiService.getPlatformMarketers(),
          apiService.getPlatformPromoCodes(),
          apiService.getPlatformReferralLinks(),
        ]);
        setMarketers(m.data || []);
        setPromos(p.data || []);
        setLinks(r.data || []);
      } else {
        const [m, p, r] = await Promise.all([
          apiService.getMarketers(),
          apiService.getPromoCodes(),
          apiService.getReferralLinks(),
        ]);
        setMarketers(m.data || []);
        setPromos(p.data || []);
        setLinks(r.data || []);
      }
    } catch (e: any) {
      setError(e.response?.data?.error || e.message || 'Ошибка загрузки');
    }
  }, [mode]);

  useEffect(() => {
    load();
  }, [load]);

  const publicRefUrl = (code: string) => `${window.location.origin}/ref/${code}`;

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  };

  const saveMarketer = async () => {
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
        if (mode === 'sa') await apiService.updatePlatformMarketer(editingMarketer.id, payload);
        else await apiService.updateMarketer(editingMarketer.id, payload);
      } else {
        if (!marketerForm.password) {
          setError('Укажите пароль');
          return;
        }
        payload.password = marketerForm.password;
        if (mode === 'sa') await apiService.createPlatformMarketer(payload);
        else await apiService.createMarketer(payload);
      }
      setMarketerDialog(false);
      setEditingMarketer(null);
      setMarketerForm(emptyMarketer);
      await load();
    } catch (e: any) {
      setError(e.response?.data?.error || e.message || 'Ошибка сохранения маркетолога');
    }
  };

  const savePromo = async () => {
    try {
      const payload: any = {
        code: promoForm.code,
        description: promoForm.description || undefined,
        discountType: promoForm.discountType,
        discountValue: Number(promoForm.discountValue),
        minPurchase: promoForm.minPurchase ? Number(promoForm.minPurchase) : undefined,
        maxDiscount: promoForm.maxDiscount ? Number(promoForm.maxDiscount) : undefined,
        usageLimit: promoForm.usageLimit ? Number(promoForm.usageLimit) : undefined,
        validFrom: promoForm.validFrom,
        validUntil: promoForm.validUntil || undefined,
        marketerId: promoForm.marketerId || undefined,
        isActive: promoForm.isActive,
      };
      if (editingPromo) {
        if (mode === 'sa') await apiService.updatePlatformPromoCode(editingPromo.id, payload);
        else await apiService.updatePromoCode(editingPromo.id, payload);
      } else if (mode === 'sa') {
        await apiService.createPlatformPromoCode(payload);
      } else {
        await apiService.createPromoCode(payload);
      }
      setPromoDialog(false);
      setEditingPromo(null);
      setPromoForm(emptyPromo);
      await load();
    } catch (e: any) {
      setError(e.response?.data?.error || e.message || 'Ошибка сохранения промокода');
    }
  };

  const saveLink = async () => {
    try {
      const payload: any = {
        name: linkForm.name,
        description: linkForm.description || undefined,
        url: linkForm.url,
        marketerId: linkForm.marketerId || undefined,
        isActive: linkForm.isActive,
      };
      if (editingLink) {
        if (mode === 'sa') await apiService.updatePlatformReferralLink(editingLink.id, payload);
        else await apiService.updateReferralLink(editingLink.id, payload);
      } else if (mode === 'sa') {
        await apiService.createPlatformReferralLink(payload);
      } else {
        await apiService.createReferralLink(payload);
      }
      setLinkDialog(false);
      setEditingLink(null);
      setLinkForm(emptyLink);
      await load();
    } catch (e: any) {
      setError(e.response?.data?.error || e.message || 'Ошибка сохранения ссылки');
    }
  };

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Маркетологи" />
        <Tab label="Промокоды" />
        <Tab label="Реферальные ссылки" />
      </Tabs>

      {tab === 0 && (
        <Box>
          <Box display="flex" justifyContent="flex-end" mb={1}>
            <Button
              startIcon={<Add />}
              variant="contained"
              onClick={() => {
                setEditingMarketer(null);
                setMarketerForm(emptyMarketer);
                setMarketerDialog(true);
              }}
            >
              Добавить
            </Button>
          </Box>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Имя</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Тип</TableCell>
                  <TableCell>Комиссия %</TableCell>
                  <TableCell>Статус</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {marketers.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>{m.name}</TableCell>
                    <TableCell>{m.email}</TableCell>
                    <TableCell>{m.type === 'MEDIA_PARTNER' ? 'Медиа' : 'Маркетолог'}</TableCell>
                    <TableCell>{Number(m.commissionPercentage)}%</TableCell>
                    <TableCell>
                      <Chip size="small" label={m.isActive ? 'Активен' : 'Выкл'} color={m.isActive ? 'success' : 'default'} />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={() => {
                          setEditingMarketer(m);
                          setMarketerForm({
                            name: m.name,
                            email: m.email,
                            phone: m.phone || '',
                            type: m.type,
                            password: '',
                            isActive: m.isActive,
                            commissionPercentage: Number(m.commissionPercentage ?? 10),
                          });
                          setMarketerDialog(true);
                        }}
                      >
                        <Edit fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={async () => {
                          if (!window.confirm('Удалить маркетолога?')) return;
                          if (mode === 'sa') await apiService.deletePlatformMarketer(m.id);
                          else await apiService.deleteMarketer(m.id);
                          await load();
                        }}
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {tab === 1 && (
        <Box>
          <Box display="flex" justifyContent="flex-end" mb={1}>
            <Button
              startIcon={<Add />}
              variant="contained"
              onClick={() => {
                setEditingPromo(null);
                setPromoForm({
                  ...emptyPromo,
                  validFrom: new Date().toISOString().slice(0, 16),
                });
                setPromoDialog(true);
              }}
            >
              Добавить личный / акцию
            </Button>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Личный промокод = выбран маркетолог + скидка. Он видит код в своём кабинете; без назначения
            блок промокода у маркетолога скрыт.
          </Typography>
          <TableContainer component={Paper}>
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
                      <Chip size="small" label={p.isActive ? 'Активен' : 'Выкл'} color={p.isActive ? 'success' : 'default'} />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={() => {
                          setEditingPromo(p);
                          setPromoForm({
                            code: p.code,
                            description: p.description || '',
                            discountType: p.discountType,
                            discountValue: String(p.discountValue),
                            minPurchase: p.minPurchase != null ? String(p.minPurchase) : '',
                            maxDiscount: p.maxDiscount != null ? String(p.maxDiscount) : '',
                            usageLimit: p.usageLimit != null ? String(p.usageLimit) : '',
                            validFrom: p.validFrom ? String(p.validFrom).slice(0, 16) : '',
                            validUntil: p.validUntil ? String(p.validUntil).slice(0, 16) : '',
                            marketerId: p.marketerId || '',
                            isActive: p.isActive,
                          });
                          setPromoDialog(true);
                        }}
                      >
                        <Edit fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={async () => {
                          if (!window.confirm('Удалить промокод?')) return;
                          if (mode === 'sa') await apiService.deletePlatformPromoCode(p.id);
                          else await apiService.deletePromoCode(p.id);
                          await load();
                        }}
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {tab === 2 && (
        <Box>
          <Box display="flex" justifyContent="flex-end" mb={1}>
            <Button
              startIcon={<Add />}
              variant="contained"
              onClick={() => {
                setEditingLink(null);
                setLinkForm(emptyLink);
                setLinkDialog(true);
              }}
            >
              Добавить
            </Button>
          </Box>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Название</TableCell>
                  <TableCell>Публичный URL</TableCell>
                  <TableCell>Клики / конверсии</TableCell>
                  <TableCell>Маркетолог</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {links.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>{l.name}</TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={0.5}>
                        <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                          {publicRefUrl(l.code)}
                        </Typography>
                        <IconButton size="small" onClick={() => copy(publicRefUrl(l.code))}>
                          <ContentCopy fontSize="small" />
                        </IconButton>
                      </Box>
                    </TableCell>
                    <TableCell>
                      {l.stats?.totalClicks ?? l._count?.clicks ?? 0} / {l.stats?.conversions ?? 0}
                    </TableCell>
                    <TableCell>{l.marketer?.name || '—'}</TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={() => {
                          setEditingLink(l);
                          setLinkForm({
                            name: l.name,
                            description: l.description || '',
                            url: l.url,
                            marketerId: l.marketerId || '',
                            isActive: l.isActive,
                          });
                          setLinkDialog(true);
                        }}
                      >
                        <Edit fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={async () => {
                          if (!window.confirm('Удалить ссылку?')) return;
                          if (mode === 'sa') await apiService.deletePlatformReferralLink(l.id);
                          else await apiService.deleteReferralLink(l.id);
                          await load();
                        }}
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}


      <Dialog open={marketerDialog} onClose={() => setMarketerDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingMarketer ? 'Редактировать маркетолога' : 'Новый маркетолог'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField fullWidth label="Имя" value={marketerForm.name} onChange={(e) => setMarketerForm({ ...marketerForm, name: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Email" value={marketerForm.email} onChange={(e) => setMarketerForm({ ...marketerForm, email: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Телефон" value={marketerForm.phone} onChange={(e) => setMarketerForm({ ...marketerForm, phone: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Тип</InputLabel>
                <Select label="Тип" value={marketerForm.type} onChange={(e) => setMarketerForm({ ...marketerForm, type: e.target.value })}>
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
                onChange={(e) => setMarketerForm({ ...marketerForm, commissionPercentage: Number(e.target.value) })}
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
                control={<Switch checked={marketerForm.isActive} onChange={(e) => setMarketerForm({ ...marketerForm, isActive: e.target.checked })} />}
                label="Активен"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMarketerDialog(false)}>Отмена</Button>
          <Button variant="contained" onClick={saveMarketer}>
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={promoDialog} onClose={() => setPromoDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingPromo ? 'Редактировать промокод' : 'Новый промокод'}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 0.5 }}>
            Укажите маркетолога — получится его личный промокод: скидка (% или ₽) и закрепление школы
            как по реферальной ссылке. Без маркетолога — обычная акция платформы. Маркетолог увидит
            код в кабинете только если он назначен ему.
          </Typography>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Код" value={promoForm.code} onChange={(e) => setPromoForm({ ...promoForm, code: e.target.value.toUpperCase() })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Тип скидки</InputLabel>
                <Select label="Тип скидки" value={promoForm.discountType} onChange={(e) => setPromoForm({ ...promoForm, discountType: e.target.value })}>
                  <MenuItem value="PERCENTAGE">Процент (%)</MenuItem>
                  <MenuItem value="FIXED">Рубли (₽)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={promoForm.discountType === 'PERCENTAGE' ? 'Скидка, %' : 'Скидка, ₽'}
                value={promoForm.discountValue}
                onChange={(e) => setPromoForm({ ...promoForm, discountValue: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Маркетолог (личный код)</InputLabel>
                <Select
                  label="Маркетолог (личный код)"
                  value={promoForm.marketerId}
                  onChange={(e) => setPromoForm({ ...promoForm, marketerId: e.target.value })}
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
                value={promoForm.validFrom}
                onChange={(e) => setPromoForm({ ...promoForm, validFrom: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="datetime-local"
                label="Действует до"
                InputLabelProps={{ shrink: true }}
                value={promoForm.validUntil}
                onChange={(e) => setPromoForm({ ...promoForm, validUntil: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Описание" value={promoForm.description} onChange={(e) => setPromoForm({ ...promoForm, description: e.target.value })} />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={<Switch checked={promoForm.isActive} onChange={(e) => setPromoForm({ ...promoForm, isActive: e.target.checked })} />}
                label="Активен"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPromoDialog(false)}>Отмена</Button>
          <Button variant="contained" onClick={savePromo}>
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={linkDialog} onClose={() => setLinkDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingLink ? 'Редактировать ссылку' : 'Новая реферальная ссылка'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField fullWidth label="Название" value={linkForm.name} onChange={(e) => setLinkForm({ ...linkForm, name: e.target.value })} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="URL редиректа" value={linkForm.url} onChange={(e) => setLinkForm({ ...linkForm, url: e.target.value })} helperText="Куда вести после /ref/:code" />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Маркетолог</InputLabel>
                <Select label="Маркетолог" value={linkForm.marketerId} onChange={(e) => setLinkForm({ ...linkForm, marketerId: e.target.value })}>
                  <MenuItem value="">—</MenuItem>
                  {marketers.map((m) => (
                    <MenuItem key={m.id} value={m.id}>
                      {m.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={<Switch checked={linkForm.isActive} onChange={(e) => setLinkForm({ ...linkForm, isActive: e.target.checked })} />}
                label="Активна"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLinkDialog(false)}>Отмена</Button>
          <Button variant="contained" onClick={saveLink}>
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PlatformMarketersCrud;
