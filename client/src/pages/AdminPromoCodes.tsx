import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tabs,
  Tab,
  Switch,
  FormControlLabel,
} from '@mui/material';
import { Add, Edit, Delete, ContentCopy, CheckCircle, Logout, BarChart } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import { usePromoCodeAdminAuth } from '../contexts/PromoCodeAdminAuthContext';
import { PromoCode, ReferralLink, Marketer, MarketerStatsSummary } from '../types';

const AdminPromoCodes: React.FC = () => {
  const { admin, logout } = usePromoCodeAdminAuth();
  const navigate = useNavigate();
  const [tabValue, setTabValue] = useState(0);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [referralLinks, setReferralLinks] = useState<ReferralLink[]>([]);
  const [marketers, setMarketers] = useState<Marketer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [openPromoDialog, setOpenPromoDialog] = useState(false);
  const [openLinkDialog, setOpenLinkDialog] = useState(false);
  const [openMarketerDialog, setOpenMarketerDialog] = useState(false);
  const [editingPromo, setEditingPromo] = useState<PromoCode | null>(null);
  const [editingLink, setEditingLink] = useState<ReferralLink | null>(null);
  const [editingMarketer, setEditingMarketer] = useState<Marketer | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [marketerStats, setMarketerStats] = useState<Record<string, MarketerStatsSummary>>({});
  const [statsDialog, setStatsDialog] = useState<{ open: boolean; marketerId: string | null }>({ open: false, marketerId: null });
  const [statsLoading, setStatsLoading] = useState(false);

  const [promoFormData, setPromoFormData] = useState({
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
  });

  const [linkFormData, setLinkFormData] = useState({
    name: '',
    description: '',
    url: '',
    marketerId: '',
    isActive: true,
  });

  const [marketerFormData, setMarketerFormData] = useState({
    name: '',
    email: '',
    phone: '',
    type: 'MARKETER',
    password: '',
    isActive: true,
  });

  const loadMarketers = async (loadStats = false) => {
    try {
      const response = await apiService.getMarketers();
      setMarketers(response.data);
      if (loadStats) {
        await loadMarketerStatsBatch(response.data);
      }
    } catch (err: any) {
      setError('Не удалось загрузить маркетологов');
    }
  };

  const loadMarketerStatsBatch = async (list: Marketer[]) => {
    try {
      const statsEntries = await Promise.all(
        list.map(async (marketer) => {
          try {
            const stats = await apiService.getMarketerStats(marketer.id);
            return [marketer.id, stats] as [string, MarketerStatsSummary];
          } catch (error) {
            console.error('Failed to load marketer stats', error);
            return null;
          }
        })
      );
      const entries = statsEntries.filter(Boolean) as [string, MarketerStatsSummary][];
      if (entries.length > 0) {
        setMarketerStats((prev) => ({
          ...prev,
          ...Object.fromEntries(entries)
        }));
      }
    } catch (error) {
      console.error('Failed to load marketer stats batch:', error);
    }
  };

  const handleViewMarketerStats = async (marketerId: string) => {
    setStatsDialog({ open: true, marketerId });
    if (marketerStats[marketerId]) {
      return;
    }
    try {
      setStatsLoading(true);
      const stats = await apiService.getMarketerStats(marketerId);
      setMarketerStats((prev) => ({
        ...prev,
        [marketerId]: stats
      }));
    } catch (err: any) {
      setError('Не удалось загрузить статистику маркетолога');
      setStatsDialog({ open: false, marketerId: null });
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      if (tabValue === 0) {
        const response = await apiService.getPromoCodes();
        setPromoCodes(response.data);
      } else if (tabValue === 1) {
        const response = await apiService.getReferralLinks();
        setReferralLinks(response.data);
      } else if (tabValue === 2) {
        await loadMarketers(true);
      }
    } catch (err: any) {
      setError('Не удалось загрузить данные');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchData on tab change
  }, [tabValue]);

  useEffect(() => {
    if (marketers.length === 0) {
      loadMarketers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadMarketers once on mount
  }, []);

  const handleCreatePromoCode = async () => {
    try {
      const data = {
        ...promoFormData,
        discountValue: parseFloat(promoFormData.discountValue),
        minPurchase: promoFormData.minPurchase ? parseFloat(promoFormData.minPurchase) : undefined,
        maxDiscount: promoFormData.maxDiscount ? parseFloat(promoFormData.maxDiscount) : undefined,
        usageLimit: promoFormData.usageLimit ? parseInt(promoFormData.usageLimit) : undefined,
        marketerId: promoFormData.marketerId || undefined,
      };
      await apiService.createPromoCode(data);
      await fetchData();
      setOpenPromoDialog(false);
      resetPromoForm();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка создания промокода');
    }
  };

  const handleUpdatePromoCode = async () => {
    if (!editingPromo) return;
    try {
      const data = {
        ...promoFormData,
        discountValue: parseFloat(promoFormData.discountValue),
        minPurchase: promoFormData.minPurchase ? parseFloat(promoFormData.minPurchase) : undefined,
        maxDiscount: promoFormData.maxDiscount ? parseFloat(promoFormData.maxDiscount) : undefined,
        usageLimit: promoFormData.usageLimit ? parseInt(promoFormData.usageLimit) : undefined,
        marketerId: promoFormData.marketerId || undefined,
      };
      await apiService.updatePromoCode(editingPromo.id, data);
      await fetchData();
      setOpenPromoDialog(false);
      setEditingPromo(null);
      resetPromoForm();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка обновления промокода');
    }
  };

  const handleDeletePromoCode = async (id: string) => {
    if (window.confirm('Вы уверены, что хотите удалить этот промокод?')) {
      try {
        await apiService.deletePromoCode(id);
        await fetchData();
      } catch (err: any) {
        setError(err.response?.data?.error || 'Ошибка удаления промокода');
      }
    }
  };

  const handleCreateReferralLink = async () => {
    try {
      const data = {
        ...linkFormData,
        marketerId: linkFormData.marketerId || undefined,
      };
      await apiService.createReferralLink(data);
      await fetchData();
      setOpenLinkDialog(false);
      resetLinkForm();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка создания реферальной ссылки');
    }
  };

  const handleUpdateReferralLink = async () => {
    if (!editingLink) return;
    try {
      const data = {
        ...linkFormData,
        marketerId: linkFormData.marketerId || undefined,
      };
      await apiService.updateReferralLink(editingLink.id, data);
      await fetchData();
      setOpenLinkDialog(false);
      setEditingLink(null);
      resetLinkForm();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка обновления реферальной ссылки');
    }
  };

  const handleDeleteReferralLink = async (id: string) => {
    if (window.confirm('Вы уверены, что хотите удалить эту реферальную ссылку?')) {
      try {
        await apiService.deleteReferralLink(id);
        await fetchData();
      } catch (err: any) {
        setError(err.response?.data?.error || 'Ошибка удаления реферальной ссылки');
      }
    }
  };

  const handleCreateMarketer = async () => {
    try {
      await apiService.createMarketer(marketerFormData);
      await fetchData();
      setOpenMarketerDialog(false);
      resetMarketerForm();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка создания маркетолога');
    }
  };

  const handleUpdateMarketer = async () => {
    if (!editingMarketer) return;
    try {
      const { password, ...updateData } = marketerFormData;
      await apiService.updateMarketer(editingMarketer.id, updateData);
      await fetchData();
      setOpenMarketerDialog(false);
      setEditingMarketer(null);
      resetMarketerForm();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка обновления маркетолога');
    }
  };

  const handleDeleteMarketer = async (id: string) => {
    if (window.confirm('Вы уверены, что хотите удалить этого маркетолога?')) {
      try {
        await apiService.deleteMarketer(id);
        await fetchData();
      } catch (err: any) {
        setError(err.response?.data?.error || 'Ошибка удаления маркетолога');
      }
    }
  };

  const handleEditPromo = (promo: PromoCode) => {
    setEditingPromo(promo);
    setPromoFormData({
      code: promo.code,
      description: promo.description || '',
      discountType: promo.discountType,
      discountValue: promo.discountValue.toString(),
      minPurchase: promo.minPurchase?.toString() || '',
      maxDiscount: promo.maxDiscount?.toString() || '',
      usageLimit: promo.usageLimit?.toString() || '',
      validFrom: promo.validFrom.split('T')[0],
      validUntil: promo.validUntil ? promo.validUntil.split('T')[0] : '',
      marketerId: promo.marketerId || '',
      isActive: promo.isActive,
    });
    setOpenPromoDialog(true);
  };

  const handleEditLink = (link: ReferralLink) => {
    setEditingLink(link);
    setLinkFormData({
      name: link.name,
      description: link.description || '',
      url: link.url,
      marketerId: link.marketerId || '',
      isActive: link.isActive,
    });
    setOpenLinkDialog(true);
  };

  const handleEditMarketer = (marketer: Marketer) => {
    setEditingMarketer(marketer);
    setMarketerFormData({
      name: marketer.name,
      email: marketer.email,
      phone: marketer.phone || '',
      type: marketer.type,
      password: '',
      isActive: marketer.isActive,
    });
    setOpenMarketerDialog(true);
  };

  const resetPromoForm = () => {
    setPromoFormData({
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
    });
  };

  const resetLinkForm = () => {
    setLinkFormData({
      name: '',
      description: '',
      url: '',
      marketerId: '',
      isActive: true,
    });
  };

  const resetMarketerForm = () => {
    setMarketerFormData({
      name: '',
      email: '',
      phone: '',
      type: 'MARKETER',
      password: '',
      isActive: true,
    });
  };

  const copyToClipboard = (text: string, code: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const getFullReferralUrl = (link: ReferralLink) => {
    return `${window.location.origin}/ref/${link.code}`;
  };

  if (loading && promoCodes.length === 0 && referralLinks.length === 0 && marketers.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  const selectedStats = statsDialog.marketerId ? marketerStats[statsDialog.marketerId] : null;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" component="h1" sx={{ fontWeight: 'bold' }}>
          Управление промокодами и реферальными ссылками
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {admin && (
            <Typography variant="body2" color="textSecondary">
              {admin.name} (Администратор промокодов)
            </Typography>
          )}
          <Button
            variant="outlined"
            startIcon={<Logout />}
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            Выйти
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Card>
        <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
          <Tab label="Промокоды" />
          <Tab label="Реферальные ссылки" />
          <Tab label="Маркетологи и медиа-партнеры" />
        </Tabs>

        <CardContent>
          {/* Promo Codes Tab */}
          {tabValue === 0 && (
            <>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={() => {
                    setEditingPromo(null);
                    resetPromoForm();
                    setOpenPromoDialog(true);
                  }}
                >
                  Добавить промокод
                </Button>
              </Box>
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Код</TableCell>
                      <TableCell>Описание</TableCell>
                      <TableCell>Скидка</TableCell>
                      <TableCell>Использований</TableCell>
                      <TableCell>Маркетолог</TableCell>
                      <TableCell>Статус</TableCell>
                      <TableCell>Действия</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {promoCodes.map((promo) => (
                      <TableRow key={promo.id}>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                              {promo.code}
                            </Typography>
                            <IconButton
                              size="small"
                              onClick={() => copyToClipboard(promo.code, promo.id)}
                            >
                              {copiedCode === promo.id ? (
                                <CheckCircle fontSize="small" color="success" />
                              ) : (
                                <ContentCopy fontSize="small" />
                              )}
                            </IconButton>
                          </Box>
                        </TableCell>
                        <TableCell>{promo.description || '-'}</TableCell>
                        <TableCell>
                          {promo.discountType === 'PERCENTAGE'
                            ? `${promo.discountValue}%`
                            : `${promo.discountValue} руб.`}
                        </TableCell>
                        <TableCell>
                          {promo.usedCount} / {promo.usageLimit || '∞'}
                        </TableCell>
                        <TableCell>{promo.marketer?.name || '-'}</TableCell>
                        <TableCell>
                          <Chip
                            label={promo.isActive ? 'Активен' : 'Неактивен'}
                            color={promo.isActive ? 'success' : 'default'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <IconButton size="small" color="primary" onClick={() => handleEditPromo(promo)}>
                            <Edit />
                          </IconButton>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeletePromoCode(promo.id)}
                          >
                            <Delete />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}

          {/* Referral Links Tab */}
          {tabValue === 1 && (
            <>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={() => {
                    setEditingLink(null);
                    resetLinkForm();
                    setOpenLinkDialog(true);
                  }}
                >
                  Добавить реферальную ссылку
                </Button>
              </Box>
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Название</TableCell>
                      <TableCell>Ссылка</TableCell>
                      <TableCell>Клики</TableCell>
                      <TableCell>Конверсии</TableCell>
                      <TableCell>Маркетолог</TableCell>
                      <TableCell>Статус</TableCell>
                      <TableCell>Действия</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {referralLinks.map((link) => (
                      <TableRow key={link.id}>
                        <TableCell>{link.name}</TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                              {getFullReferralUrl(link)}
                            </Typography>
                            <IconButton
                              size="small"
                              onClick={() => copyToClipboard(getFullReferralUrl(link), link.id)}
                            >
                              {copiedCode === link.id ? (
                                <CheckCircle fontSize="small" color="success" />
                              ) : (
                                <ContentCopy fontSize="small" />
                              )}
                            </IconButton>
                          </Box>
                        </TableCell>
                        <TableCell>{link.stats?.totalClicks || 0}</TableCell>
                        <TableCell>
                          {link.stats?.conversions || 0} (
                          {link.stats?.conversionRate ? `${link.stats.conversionRate.toFixed(1)}%` : '0%'})
                        </TableCell>
                        <TableCell>{link.marketer?.name || '-'}</TableCell>
                        <TableCell>
                          <Chip
                            label={link.isActive ? 'Активна' : 'Неактивна'}
                            color={link.isActive ? 'success' : 'default'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <IconButton size="small" color="primary" onClick={() => handleEditLink(link)}>
                            <Edit />
                          </IconButton>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteReferralLink(link.id)}
                          >
                            <Delete />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}

          {/* Marketers Tab */}
          {tabValue === 2 && (
            <>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={() => {
                    setEditingMarketer(null);
                    resetMarketerForm();
                    setOpenMarketerDialog(true);
                  }}
                >
                  Добавить маркетолога
                </Button>
              </Box>
            <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Имя</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Телефон</TableCell>
                      <TableCell>Тип</TableCell>
                      <TableCell>Промокодов</TableCell>
                    <TableCell>Использований</TableCell>
                      <TableCell>Ссылок</TableCell>
                      <TableCell>Статус</TableCell>
                      <TableCell>Действия</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {marketers.map((marketer) => (
                      <TableRow key={marketer.id}>
                        <TableCell>{marketer.name}</TableCell>
                        <TableCell>{marketer.email}</TableCell>
                        <TableCell>{marketer.phone || '-'}</TableCell>
                        <TableCell>
                          <Chip
                            label={marketer.type === 'MARKETER' ? 'Маркетолог' : 'Медиа-партнер'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{marketer.promoCodes?.length || 0}</TableCell>
                      <TableCell>{marketerStats[marketer.id]?.promoCodes.totalUsages ?? '—'}</TableCell>
                        <TableCell>{marketer.referralLinks?.length || 0}</TableCell>
                        <TableCell>
                          <Chip
                            label={marketer.isActive ? 'Активен' : 'Неактивен'}
                            color={marketer.isActive ? 'success' : 'default'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                        <IconButton size="small" color="info" onClick={() => handleViewMarketerStats(marketer.id)} title="Статистика">
                          <BarChart />
                        </IconButton>
                          <IconButton size="small" color="primary" onClick={() => handleEditMarketer(marketer)}>
                            <Edit />
                          </IconButton>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteMarketer(marketer.id)}
                          >
                            <Delete />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </CardContent>
      </Card>

      {/* Promo Code Dialog */}
      <Dialog open={openPromoDialog} onClose={() => setOpenPromoDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingPromo ? 'Редактировать промокод' : 'Создать промокод'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Код промокода"
                value={promoFormData.code}
                onChange={(e) => setPromoFormData({ ...promoFormData, code: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Тип скидки</InputLabel>
                <Select
                  value={promoFormData.discountType}
                  onChange={(e) => setPromoFormData({ ...promoFormData, discountType: e.target.value })}
                >
                  <MenuItem value="PERCENTAGE">Процент</MenuItem>
                  <MenuItem value="FIXED">Фиксированная сумма</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Значение скидки"
                type="number"
                value={promoFormData.discountValue}
                onChange={(e) => setPromoFormData({ ...promoFormData, discountValue: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Минимальная покупка"
                type="number"
                value={promoFormData.minPurchase}
                onChange={(e) => setPromoFormData({ ...promoFormData, minPurchase: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Максимальная скидка"
                type="number"
                value={promoFormData.maxDiscount}
                onChange={(e) => setPromoFormData({ ...promoFormData, maxDiscount: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Лимит использований"
                type="number"
                value={promoFormData.usageLimit}
                onChange={(e) => setPromoFormData({ ...promoFormData, usageLimit: e.target.value })}
                helperText="Оставьте пустым для неограниченного использования"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Действителен с"
                type="date"
                value={promoFormData.validFrom}
                onChange={(e) => setPromoFormData({ ...promoFormData, validFrom: e.target.value })}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Действителен до"
                type="date"
                value={promoFormData.validUntil}
                onChange={(e) => setPromoFormData({ ...promoFormData, validUntil: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Описание"
                value={promoFormData.description}
                onChange={(e) => setPromoFormData({ ...promoFormData, description: e.target.value })}
                multiline
                rows={2}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Маркетолог</InputLabel>
                <Select
                  value={promoFormData.marketerId}
                  onChange={(e) => setPromoFormData({ ...promoFormData, marketerId: e.target.value })}
                >
                  <MenuItem value="">Без маркетолога</MenuItem>
                  {marketers.map((m) => (
                    <MenuItem key={m.id} value={m.id}>
                      {m.name} ({m.type === 'MARKETER' ? 'Маркетолог' : 'Медиа-партнер'})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={promoFormData.isActive}
                    onChange={(e) => setPromoFormData({ ...promoFormData, isActive: e.target.checked })}
                  />
                }
                label="Активен"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenPromoDialog(false)}>Отмена</Button>
          <Button
            onClick={editingPromo ? handleUpdatePromoCode : handleCreatePromoCode}
            variant="contained"
          >
            {editingPromo ? 'Сохранить' : 'Создать'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Referral Link Dialog */}
      <Dialog open={openLinkDialog} onClose={() => setOpenLinkDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingLink ? 'Редактировать реферальную ссылку' : 'Создать реферальную ссылку'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Название"
                value={linkFormData.name}
                onChange={(e) => setLinkFormData({ ...linkFormData, name: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="URL"
                value={linkFormData.url}
                onChange={(e) => setLinkFormData({ ...linkFormData, url: e.target.value })}
                required
                helperText="URL, на который будет вести реферальная ссылка"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Описание"
                value={linkFormData.description}
                onChange={(e) => setLinkFormData({ ...linkFormData, description: e.target.value })}
                multiline
                rows={2}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Маркетолог</InputLabel>
                <Select
                  value={linkFormData.marketerId}
                  onChange={(e) => setLinkFormData({ ...linkFormData, marketerId: e.target.value })}
                >
                  <MenuItem value="">Без маркетолога</MenuItem>
                  {marketers.map((m) => (
                    <MenuItem key={m.id} value={m.id}>
                      {m.name} ({m.type === 'MARKETER' ? 'Маркетолог' : 'Медиа-партнер'})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={linkFormData.isActive}
                    onChange={(e) => setLinkFormData({ ...linkFormData, isActive: e.target.checked })}
                  />
                }
                label="Активна"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenLinkDialog(false)}>Отмена</Button>
          <Button
            onClick={editingLink ? handleUpdateReferralLink : handleCreateReferralLink}
            variant="contained"
          >
            {editingLink ? 'Сохранить' : 'Создать'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Marketer Dialog */}
      <Dialog open={openMarketerDialog} onClose={() => setOpenMarketerDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingMarketer ? 'Редактировать маркетолога' : 'Создать маркетолога'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Имя"
                value={marketerFormData.name}
                onChange={(e) => setMarketerFormData({ ...marketerFormData, name: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Тип</InputLabel>
                <Select
                  value={marketerFormData.type}
                  onChange={(e) => setMarketerFormData({ ...marketerFormData, type: e.target.value })}
                >
                  <MenuItem value="MARKETER">Маркетолог</MenuItem>
                  <MenuItem value="MEDIA_PARTNER">Медиа-партнер</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={marketerFormData.email}
                onChange={(e) => setMarketerFormData({ ...marketerFormData, email: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Пароль"
                type="password"
                value={marketerFormData.password}
                onChange={(e) => setMarketerFormData({ ...marketerFormData, password: e.target.value })}
                required={!editingMarketer}
                helperText={editingMarketer ? 'Заполните, чтобы сменить пароль' : undefined}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Телефон"
                value={marketerFormData.phone}
                onChange={(e) => setMarketerFormData({ ...marketerFormData, phone: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={marketerFormData.isActive}
                    onChange={(e) => setMarketerFormData({ ...marketerFormData, isActive: e.target.checked })}
                  />
                }
                label="Активен"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenMarketerDialog(false)}>Отмена</Button>
          <Button
            onClick={editingMarketer ? handleUpdateMarketer : handleCreateMarketer}
            variant="contained"
          >
            {editingMarketer ? 'Сохранить' : 'Создать'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Marketer Stats Dialog */}
      <Dialog
        open={statsDialog.open}
        onClose={() => setStatsDialog({ open: false, marketerId: null })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Статистика маркетолога</DialogTitle>
        <DialogContent>
          {statsLoading && (
            <Box display="flex" justifyContent="center" py={3}>
              <CircularProgress />
            </Box>
          )}
          {!statsLoading && selectedStats && (
            <Box>
              <Typography variant="h6" gutterBottom>
                {selectedStats.marketer.name}
              </Typography>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Email: {selectedStats.marketer.email}
              </Typography>
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Промокоды
                </Typography>
                <Typography>Всего: {selectedStats.promoCodes.total}</Typography>
                <Typography>Активных: {selectedStats.promoCodes.active}</Typography>
                <Typography>Использований: {selectedStats.promoCodes.totalUsages}</Typography>
                <Typography>
                  Сумма скидок: {selectedStats.promoCodes.totalDiscountGiven.toFixed(2)} руб.
                </Typography>
              </Box>
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Реферальные ссылки
                </Typography>
                <Typography>Всего: {selectedStats.referralLinks.total}</Typography>
                <Typography>Активных: {selectedStats.referralLinks.active}</Typography>
                <Typography>Всего кликов: {selectedStats.referralLinks.totalClicks}</Typography>
                <Typography>
                  Конверсий: {selectedStats.referralLinks.totalConversions} (
                  {selectedStats.referralLinks.conversionRate.toFixed(1)}%)
                </Typography>
              </Box>
            </Box>
          )}
          {!statsLoading && !selectedStats && (
            <Alert severity="info">Статистика недоступна</Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatsDialog({ open: false, marketerId: null })}>
            Закрыть
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminPromoCodes;

