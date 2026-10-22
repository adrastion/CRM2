import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  Chip,
  Button,
  Collapse,
  IconButton,
} from '@mui/material';
import { ExpandMore, ExpandLess } from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { apiService } from '../services/api';
import { salarySchemeLabel } from '../utils/salarySchemes';
import { colors, radii } from '../theme/tokens';

const AllTrainersEarnings: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [earnings, setEarnings] = useState<any>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [ledgerByTrainer, setLedgerByTrainer] = useState<Record<string, any[]>>({});
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [startDate, setStartDate] = useState<Date | null>(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [endDate, setEndDate] = useState<Date | null>(new Date());

  useEffect(() => {
    fetchEarnings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  const fetchEarnings = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = {};
      if (startDate) params.startDate = startDate.toISOString();
      if (endDate) params.endDate = endDate.toISOString();
      const earningsRes = await apiService.getAllTrainersEarnings(params);
      setEarnings(earningsRes);
      setExpandedId(null);
      setLedgerByTrainer({});
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка загрузки данных о заработке');
      console.error('Error fetching earnings:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleReport = async (trainerId: string) => {
    if (expandedId === trainerId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(trainerId);
    if (ledgerByTrainer[trainerId]) return;
    try {
      setLedgerLoading(true);
      const params: any = {};
      if (startDate) params.startDate = startDate.toISOString();
      if (endDate) params.endDate = endDate.toISOString();
      const ledger = await apiService.getTrainerSalaryLedger(trainerId, params);
      setLedgerByTrainer((prev) => ({
        ...prev,
        [trainerId]: (ledger.items || []).filter((i: any) => i.kind !== 'payout'),
      }));
    } catch (err) {
      console.error(err);
    } finally {
      setLedgerLoading(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ru}>
      <Box>
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between',
            alignItems: { xs: 'stretch', sm: 'center' },
            gap: 1.5,
            mb: 3,
          }}
        >
          <Box>
            <Typography
              variant="h5"
              component="h1"
              sx={{ fontWeight: 700, fontSize: { xs: 20, md: 22 }, color: colors.text, letterSpacing: '-0.02em' }}
            >
              Заработок тренеров
            </Typography>
            <Typography sx={{ fontSize: 13, color: colors.textHint, mt: 0.25 }}>
              Выплаты и начисления за период
            </Typography>
          </Box>
        </Box>

        <Card
          elevation={0}
          sx={{
            mb: 3,
            borderRadius: `${radii.panel}px`,
            border: `1px solid ${colors.divider}`,
            boxShadow: '0 2px 10px rgba(32, 34, 36, 0.05)',
          }}
        >
          <CardContent sx={{ px: { xs: 1.5, sm: 2 }, py: { xs: 1.5, sm: 2 } }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={4}>
                <DatePicker
                  label="Дата начала"
                  value={startDate}
                  onChange={(newValue) => setStartDate(newValue)}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      sx: { '& .MuiOutlinedInput-root': { borderRadius: `${radii.button}px` } },
                    },
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <DatePicker
                  label="Дата окончания"
                  value={endDate}
                  onChange={(newValue) => setEndDate(newValue)}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      sx: { '& .MuiOutlinedInput-root': { borderRadius: `${radii.button}px` } },
                    },
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={() => {
                    const now = new Date();
                    setStartDate(new Date(now.getFullYear(), now.getMonth(), 1));
                    setEndDate(now);
                  }}
                  sx={{
                    textTransform: 'none',
                    borderRadius: `${radii.button}px`,
                    borderColor: colors.primarySoft,
                    color: colors.primary,
                    fontWeight: 600,
                  }}
                >
                  Текущий месяц
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {earnings && (
          <>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 1.5,
                mb: 3,
              }}
            >
              <Box
                sx={{
                  bgcolor: colors.card,
                  borderRadius: `${radii.panel}px`,
                  p: 2,
                  boxShadow: '0 2px 10px rgba(32, 34, 36, 0.05)',
                  border: `1px solid ${colors.divider}`,
                }}
              >
                <Typography sx={{ fontSize: 12, color: colors.textHint, fontWeight: 500 }}>
                  Всего тренеров
                </Typography>
                <Typography sx={{ fontSize: 28, fontWeight: 800, color: colors.text }}>
                  {earnings.trainers?.length || 0}
                </Typography>
              </Box>
              <Box
                sx={{
                  bgcolor: colors.card,
                  borderRadius: `${radii.panel}px`,
                  p: 2,
                  boxShadow: '0 2px 10px rgba(32, 34, 36, 0.05)',
                  border: `1px solid ${colors.divider}`,
                }}
              >
                <Typography sx={{ fontSize: 12, color: colors.textHint, fontWeight: 500 }}>
                  Общий заработок
                </Typography>
                <Typography sx={{ fontSize: 22, fontWeight: 800, color: colors.success }}>
                  {earnings.totalEarnings?.toLocaleString('ru-RU', {
                    style: 'currency',
                    currency: 'RUB',
                  }) || '0 ₽'}
                </Typography>
              </Box>
            </Box>

            <Card
              elevation={0}
              sx={{
                borderRadius: `${radii.panel}px`,
                border: `1px solid ${colors.divider}`,
                boxShadow: '0 2px 10px rgba(32, 34, 36, 0.05)',
              }}
            >
              <CardContent sx={{ px: { xs: 1.5, sm: 2 } }}>
                <Typography sx={{ mb: 2, fontSize: { xs: 16, md: 18 }, fontWeight: 700, color: colors.text }}>
                  Заработок по тренерам
                </Typography>
                <TableContainer
                  component={Paper}
                  variant="outlined"
                  sx={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}
                >
                  <Table sx={{ minWidth: 720 }}>
                    <TableHead>
                      <TableRow>
                        <TableCell>Тренер</TableCell>
                        <TableCell>Тип зарплаты</TableCell>
                        <TableCell>Размер</TableCell>
                        <TableCell>Начислений</TableCell>
                        <TableCell>Заработок</TableCell>
                        <TableCell align="right">Отчёт</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {earnings.trainers && earnings.trainers.length > 0 ? (
                        earnings.trainers.map((trainer: any) => (
                          <React.Fragment key={trainer.trainerId}>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 'medium', maxWidth: 160, overflowWrap: 'anywhere' }}>
                                {trainer.trainerName}
                              </TableCell>
                              <TableCell>
                                <Chip
                                  label={
                                    trainer.salarySchemeLabel ||
                                    salarySchemeLabel(trainer.salaryScheme || trainer.salaryType)
                                  }
                                  color="primary"
                                  size="small"
                                />
                              </TableCell>
                              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                {trainer.salaryRate != null || trainer.salaryAmount != null
                                  ? trainer.salaryScheme === 'percent_month' ||
                                    trainer.salaryType === 'percent_month'
                                    ? `${trainer.salaryRate ?? trainer.salaryAmount}%`
                                    : `${trainer.salaryRate ?? trainer.salaryAmount} ₽`
                                  : '-'}
                              </TableCell>
                              <TableCell align="center">
                                {trainer.entryCount ?? trainer.trainingCount ?? 0}
                              </TableCell>
                              <TableCell sx={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                                {trainer.totalEarnings?.toLocaleString('ru-RU', {
                                  style: 'currency',
                                  currency: 'RUB',
                                }) || '0 ₽'}
                              </TableCell>
                              <TableCell align="right">
                                <IconButton size="small" onClick={() => toggleReport(trainer.trainerId)}>
                                  {expandedId === trainer.trainerId ? <ExpandLess /> : <ExpandMore />}
                                </IconButton>
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell colSpan={6} sx={{ py: 0, border: 0 }}>
                                <Collapse in={expandedId === trainer.trainerId} unmountOnExit>
                                  <Box sx={{ py: 2, overflowX: 'auto' }}>
                                    {ledgerLoading && !ledgerByTrainer[trainer.trainerId] ? (
                                      <CircularProgress size={24} />
                                    ) : (
                                      <Table size="small" sx={{ minWidth: 480 }}>
                                        <TableHead>
                                          <TableRow>
                                            <TableCell>Название</TableCell>
                                            <TableCell align="right">Сумма</TableCell>
                                            <TableCell>Дата</TableCell>
                                            <TableCell>Комментарий</TableCell>
                                          </TableRow>
                                        </TableHead>
                                        <TableBody>
                                          {(ledgerByTrainer[trainer.trainerId] || []).length > 0 ? (
                                            ledgerByTrainer[trainer.trainerId].map((row: any) => (
                                              <TableRow key={row.id}>
                                                <TableCell sx={{ maxWidth: 160, overflowWrap: 'anywhere' }}>
                                                  {row.title}
                                                </TableCell>
                                                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                                  {Number(row.amount).toLocaleString('ru-RU', {
                                                    style: 'currency',
                                                    currency: 'RUB',
                                                  })}
                                                </TableCell>
                                                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                                  {format(new Date(row.occurredAt), 'dd.MM.yyyy', {
                                                    locale: ru,
                                                  })}
                                                </TableCell>
                                                <TableCell sx={{ maxWidth: 160, overflowWrap: 'anywhere' }}>
                                                  {row.comment || '-'}
                                                </TableCell>
                                              </TableRow>
                                            ))
                                          ) : (
                                            <TableRow>
                                              <TableCell colSpan={4} align="center">
                                                Нет начислений за период
                                              </TableCell>
                                            </TableRow>
                                          )}
                                        </TableBody>
                                      </Table>
                                    )}
                                  </Box>
                                </Collapse>
                              </TableCell>
                            </TableRow>
                          </React.Fragment>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} align="center">
                            <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                              Нет данных за выбранный период
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </>
        )}
      </Box>
    </LocalizationProvider>
  );
};

export default AllTrainersEarnings;
