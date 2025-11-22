import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Tabs,
  Tab,
  Button,
} from '@mui/material';
import { TrendingUp, LocalOffer, Link as LinkIcon, People, Logout } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import { useMarketerAuth } from '../contexts/MarketerAuthContext';

const MarketerPanel: React.FC = () => {
  const { marketer, logout } = useMarketerAuth();
  const navigate = useNavigate();
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [stats, setStats] = useState<any>(null);
  const [promoCodes, setPromoCodes] = useState<any[]>([]);
  const [referralLinks, setReferralLinks] = useState<any[]>([]);
  
  const marketerId = marketer?.id || null;

  useEffect(() => {
    if (marketerId) {
      fetchMarketerData();
    } else {
      setError('Маркетолог не найден. Обратитесь к администратору.');
      setLoading(false);
    }
  }, [marketerId]);

  const fetchMarketerData = async () => {
    if (!marketerId) return;
    await loadMarketerStats(marketerId);
  };

  const loadMarketerStats = async (id: string) => {
    try {
      setLoading(true);
      const [statsData, promoCodesData, referralLinksData] = await Promise.all([
        apiService.getMarketerStats('me'), // Use 'me' to get authenticated marketer's stats
        apiService.getPromoCodes({ marketerId: id }),
        apiService.getReferralLinks({ marketerId: id }),
      ]);

      setStats(statsData);
      setPromoCodes(promoCodesData.data);
      setReferralLinks(referralLinksData.data);
    } catch (err: any) {
      setError('Не удалось загрузить статистику');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error && !stats) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  if (!stats) {
    return (
      <Alert severity="info">
        Данные не найдены
      </Alert>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
          Панель маркетолога
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {marketer && (
            <Typography variant="body2" color="textSecondary">
              {marketer.name} ({marketer.type === 'MARKETER' ? 'Маркетолог' : 'Медиа-партнер'})
            </Typography>
          )}
          <Button
            variant="outlined"
            startIcon={<Logout />}
            onClick={() => {
              logout();
              // Use setTimeout to ensure state is updated before navigation
              setTimeout(() => {
                navigate('/marketer/login', { replace: true });
              }, 0);
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

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Промокодов
                  </Typography>
                  <Typography variant="h4">
                    {stats.promoCodes?.total || 0}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Активных: {stats.promoCodes?.active || 0}
                  </Typography>
                </Box>
                <LocalOffer sx={{ fontSize: 40, color: 'primary.main' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Использований промокодов
                  </Typography>
                  <Typography variant="h4">
                    {stats.promoCodes?.totalUsages || 0}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Скидка: {stats.promoCodes?.totalDiscountGiven?.toFixed(2) || 0} руб.
                  </Typography>
                </Box>
                <TrendingUp sx={{ fontSize: 40, color: 'success.main' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Реферальных ссылок
                  </Typography>
                  <Typography variant="h4">
                    {stats.referralLinks?.total || 0}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Активных: {stats.referralLinks?.active || 0}
                  </Typography>
                </Box>
                <LinkIcon sx={{ fontSize: 40, color: 'secondary.main' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Конверсия
                  </Typography>
                  <Typography variant="h4">
                    {stats.referralLinks?.conversionRate?.toFixed(1) || 0}%
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    {stats.referralLinks?.totalConversions || 0} из {stats.referralLinks?.totalClicks || 0}
                  </Typography>
                </Box>
                <People sx={{ fontSize: 40, color: 'info.main' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Details Tabs */}
      <Card>
        <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
          <Tab label="Промокоды" />
          <Tab label="Реферальные ссылки" />
        </Tabs>

        <CardContent>
          {/* Promo Codes Tab */}
          {tabValue === 0 && (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Код</TableCell>
                    <TableCell>Описание</TableCell>
                    <TableCell>Скидка</TableCell>
                    <TableCell>Использований</TableCell>
                    <TableCell>Статус</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {promoCodes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center">
                        <Typography color="textSecondary">Нет промокодов</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    promoCodes.map((promo) => (
                      <TableRow key={promo.id}>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                            {promo.code}
                          </Typography>
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
                        <TableCell>
                          <Chip
                            label={promo.isActive ? 'Активен' : 'Неактивен'}
                            color={promo.isActive ? 'success' : 'default'}
                            size="small"
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* Referral Links Tab */}
          {tabValue === 1 && (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Название</TableCell>
                    <TableCell>Ссылка</TableCell>
                    <TableCell>Клики</TableCell>
                    <TableCell>Конверсии</TableCell>
                    <TableCell>Статус</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {referralLinks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center">
                        <Typography color="textSecondary">Нет реферальных ссылок</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    referralLinks.map((link) => (
                      <TableRow key={link.id}>
                        <TableCell>{link.name}</TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                            {`${window.location.origin}/ref/${link.code}`}
                          </Typography>
                        </TableCell>
                        <TableCell>{link.stats?.totalClicks || 0}</TableCell>
                        <TableCell>
                          {link.stats?.conversions || 0} (
                          {link.stats?.conversionRate ? `${link.stats.conversionRate.toFixed(1)}%` : '0%'})
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={link.isActive ? 'Активна' : 'Неактивна'}
                            color={link.isActive ? 'success' : 'default'}
                            size="small"
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default MarketerPanel;

