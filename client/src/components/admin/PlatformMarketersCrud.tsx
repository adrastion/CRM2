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
  const [publications, setPublications] = useState<any[]>([]);
  const [closingDocs, setClosingDocs] = useState<any[]>([]);
  const [pubForm, setPubForm] = useState({
    type: 'NEWS',
    title: '',
    body: '',
    imageFile: null as File | null,
    fileFile: null as File | null,
  });
  const [docForm, setDocForm] = useState({
    title: '',
    periodLabel: '',
    marketerId: '',
    file: null as File | null,
  });

  const load = useCallback(async () => {
    setError('');
    try {
      if (mode === 'sa') {
        const [m, p, r, pubs, docs] = await Promise.all([
          apiService.getPlatformMarketers(),
          apiService.getPlatformPromoCodes(),
          apiService.getPlatformReferralLinks(),
          apiService.adminListMarketerPublications(),
          apiService.adminListMarketerClosingDocs(),
        ]);
        setMarketers(m.data || []);
        setPromos(p.data || []);
        setLinks(r.data || []);
        setPublications(pubs || []);
        setClosingDocs(docs || []);
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
        {mode === 'sa' && <Tab label="Реклама и документы" />}
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
                setPromoForm(emptyPromo);
                setPromoDialog(true);
              }}
            >
              Добавить
            </Button>
          </Box>
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

      {mode === 'sa' && tab === 3 && (
        <Box>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Публикации для маркетологов
          </Typography>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} sm={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Тип</InputLabel>
                <Select
                  label="Тип"
                  value={pubForm.type}
                  onChange={(e) => setPubForm({ ...pubForm, type: e.target.value })}
                >
                  <MenuItem value="NEWS">Новость</MenuItem>
                  <MenuItem value="PROMO">Акция</MenuItem>
                  <MenuItem value="BANNER">Баннер</MenuItem>
                  <MenuItem value="POSTER">Афиша</MenuItem>
                  <MenuItem value="UPDATE">Обновление</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={9}>
              <TextField
                fullWidth
                size="small"
                label="Заголовок"
                value={pubForm.title}
                onChange={(e) => setPubForm({ ...pubForm, title: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                multiline
                minRows={2}
                label="Текст"
                value={pubForm.body}
                onChange={(e) => setPubForm({ ...pubForm, body: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Button variant="outlined" component="label" fullWidth sx={{ textTransform: 'none' }}>
                {pubForm.imageFile ? `Изображение: ${pubForm.imageFile.name}` : 'Загрузить изображение'}
                <input
                  type="file"
                  hidden
                  accept="image/*"
                  onChange={(e) =>
                    setPubForm({ ...pubForm, imageFile: e.target.files?.[0] || null })
                  }
                />
              </Button>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Button variant="outlined" component="label" fullWidth sx={{ textTransform: 'none' }}>
                {pubForm.fileFile ? `Файл: ${pubForm.fileFile.name}` : 'Загрузить файл'}
                <input
                  type="file"
                  hidden
                  onChange={(e) =>
                    setPubForm({ ...pubForm, fileFile: e.target.files?.[0] || null })
                  }
                />
              </Button>
            </Grid>
            <Grid item xs={12}>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={async () => {
                  try {
                    await apiService.adminCreateMarketerPublication({
                      type: pubForm.type,
                      title: pubForm.title,
                      body: pubForm.body,
                      image: pubForm.imageFile,
                      file: pubForm.fileFile,
                    });
                    setPubForm({
                      type: 'NEWS',
                      title: '',
                      body: '',
                      imageFile: null,
                      fileFile: null,
                    });
                    await load();
                  } catch (e: any) {
                    setError(e.response?.data?.error || e.message || 'Ошибка публикации');
                  }
                }}
              >
                Опубликовать
              </Button>
            </Grid>
          </Grid>
          <TableContainer component={Paper} sx={{ mb: 3 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Тип</TableCell>
                  <TableCell>Заголовок</TableCell>
                  <TableCell>Дата</TableCell>
                  <TableCell>Вложения</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {publications.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.type}</TableCell>
                    <TableCell>{p.title}</TableCell>
                    <TableCell>{new Date(p.publishedAt).toLocaleDateString('ru-RU')}</TableCell>
                    <TableCell>
                      {p.fileUrl ? (
                        <Button
                          size="small"
                          onClick={async () => {
                            const blob = await apiService.adminDownloadMarketerPublicationFileBlob(p.id);
                            const url = URL.createObjectURL(blob);
                            window.open(url, '_blank');
                          }}
                        >
                          Файл
                        </Button>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Typography variant="h6" sx={{ mb: 1 }}>
            Закрывающие документы
          </Typography>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                size="small"
                label="Название"
                value={docForm.title}
                onChange={(e) => setDocForm({ ...docForm, title: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                fullWidth
                size="small"
                label="Период"
                value={docForm.periodLabel}
                onChange={(e) => setDocForm({ ...docForm, periodLabel: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <Button variant="outlined" component="label" fullWidth sx={{ textTransform: 'none' }}>
                {docForm.file ? docForm.file.name : 'Выбрать файл'}
                <input
                  type="file"
                  hidden
                  onChange={(e) => setDocForm({ ...docForm, file: e.target.files?.[0] || null })}
                />
              </Button>
            </Grid>
            <Grid item xs={12} sm={2}>
              <Button
                fullWidth
                variant="contained"
                disabled={!docForm.file || !docForm.title.trim()}
                onClick={async () => {
                  try {
                    if (!docForm.file) return;
                    await apiService.adminCreateMarketerClosingDoc({
                      title: docForm.title,
                      periodLabel: docForm.periodLabel || undefined,
                      marketerId: docForm.marketerId || null,
                      file: docForm.file,
                    });
                    setDocForm({ title: '', periodLabel: '', marketerId: '', file: null });
                    await load();
                  } catch (e: any) {
                    setError(e.response?.data?.error || e.message || 'Ошибка документа');
                  }
                }}
              >
                Добавить
              </Button>
            </Grid>
          </Grid>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Название</TableCell>
                  <TableCell>Период</TableCell>
                  <TableCell>Файл</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {closingDocs.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>{d.title}</TableCell>
                    <TableCell>{d.periodLabel || '—'}</TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        onClick={async () => {
                          const blob = await apiService.adminDownloadMarketerClosingDocBlob(d.id);
                          const url = URL.createObjectURL(blob);
                          window.open(url, '_blank');
                        }}
                      >
                        Открыть
                      </Button>
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
              <TextField
                fullWidth
                type="password"
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
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Код" value={promoForm.code} onChange={(e) => setPromoForm({ ...promoForm, code: e.target.value.toUpperCase() })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Тип скидки</InputLabel>
                <Select label="Тип скидки" value={promoForm.discountType} onChange={(e) => setPromoForm({ ...promoForm, discountType: e.target.value })}>
                  <MenuItem value="PERCENTAGE">Процент</MenuItem>
                  <MenuItem value="FIXED">Фиксированная</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Значение" value={promoForm.discountValue} onChange={(e) => setPromoForm({ ...promoForm, discountValue: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Маркетолог</InputLabel>
                <Select label="Маркетолог" value={promoForm.marketerId} onChange={(e) => setPromoForm({ ...promoForm, marketerId: e.target.value })}>
                  <MenuItem value="">—</MenuItem>
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
