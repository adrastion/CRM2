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
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 'bold' }}>
            Заработок тренеров
          </Typography>
        </Box>

        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={4}>
                <DatePicker
                  label="Дата начала"
                  value={startDate}
                  onChange={(newValue) => setStartDate(newValue)}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <DatePicker
                  label="Дата окончания"
                  value={endDate}
                  onChange={(newValue) => setEndDate(newValue)}
                  slotProps={{ textField: { fullWidth: true } }}
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
                >
                  Текущий месяц
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {earnings && (
          <>
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Общая статистика
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Typography color="text.secondary">
                      Всего тренеров: {earnings.trainers?.length || 0}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                      Общий заработок:{' '}
                      {earnings.totalEarnings?.toLocaleString('ru-RU', {
                        style: 'currency',
                        currency: 'RUB',
                      }) || '0 ₽'}
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
                  Заработок по тренерам
                </Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table>
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
                              <TableCell sx={{ fontWeight: 'medium' }}>{trainer.trainerName}</TableCell>
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
                              <TableCell>
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
                              <TableCell sx={{ fontWeight: 'bold' }}>
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
                                  <Box sx={{ py: 2 }}>
                                    {ledgerLoading && !ledgerByTrainer[trainer.trainerId] ? (
                                      <CircularProgress size={24} />
                                    ) : (
                                      <Table size="small">
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
                                                <TableCell>{row.title}</TableCell>
                                                <TableCell align="right">
                                                  {Number(row.amount).toLocaleString('ru-RU', {
                                                    style: 'currency',
                                                    currency: 'RUB',
                                                  })}
                                                </TableCell>
                                                <TableCell>
                                                  {format(new Date(row.occurredAt), 'dd.MM.yyyy', {
                                                    locale: ru,
                                                  })}
                                                </TableCell>
                                                <TableCell>{row.comment || '-'}</TableCell>
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
