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
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { salarySchemeLabel } from '../utils/salarySchemes';

const TrainerEarnings: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [earnings, setEarnings] = useState<any>(null);
  const [showReport, setShowReport] = useState(false);
  const [startDate, setStartDate] = useState<Date | null>(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [endDate, setEndDate] = useState<Date | null>(new Date());

  useEffect(() => {
    fetchEarnings();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchEarnings refetch on date change
  }, [startDate, endDate]);

  const fetchEarnings = async () => {
    try {
      setLoading(true);
      setError(null);

      const trainersRes = await apiService.getTrainers();
      const currentTrainer = trainersRes.data.find((t: any) => t.userId === user?.id);

      if (!currentTrainer) {
        setError('Тренер не найден');
        setLoading(false);
        return;
      }

      const params: any = {};
      if (startDate) params.startDate = startDate.toISOString();
      if (endDate) params.endDate = endDate.toISOString();

      const earningsRes = await apiService.getTrainerEarnings(currentTrainer.id, params);
      setEarnings(earningsRes.data ?? earningsRes);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка загрузки данных о заработке');
      console.error('Error fetching earnings:', err);
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

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  const reportRows = (earnings?.ledger || earnings?.trainingEarnings || []).filter(
    (r: any) => r.kind !== 'payout'
  );

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ru}>
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 'bold' }}>
            Мой заработок
          </Typography>
          <Button variant="contained" onClick={() => setShowReport((v) => !v)}>
            {showReport ? 'Скрыть отчёт' : 'Отчёт'}
          </Button>
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
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={4}>
                <Card>
                  <CardContent>
                    <Typography color="text.secondary" gutterBottom>
                      Записей начислений
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                      {earnings.entryCount ?? reportRows.length}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Card>
                  <CardContent>
                    <Typography color="text.secondary" gutterBottom>
                      Общий заработок
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                      {earnings.totalEarnings?.toLocaleString('ru-RU', {
                        style: 'currency',
                        currency: 'RUB',
                      }) || '0 ₽'}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Card>
                  <CardContent>
                    <Typography color="text.secondary" gutterBottom>
                      Тип зарплаты
                    </Typography>
                    <Chip
                      label={salarySchemeLabel(earnings.trainer?.salaryScheme || earnings.trainer?.salaryType)}
                      color="primary"
                      sx={{ mt: 1 }}
                    />
                    {earnings.trainer?.salaryRate != null && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        {earnings.trainer.salaryScheme === 'percent_month' ||
                        earnings.trainer.salaryType === 'percent_month'
                          ? `${earnings.trainer.salaryRate}%`
                          : `${earnings.trainer.salaryRate} ₽`}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            <Collapse in={showReport}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
                    Отчёт по начислениям
                  </Typography>
                  <TableContainer component={Paper} variant="outlined">
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Название</TableCell>
                          <TableCell align="right">Сумма</TableCell>
                          <TableCell>Дата</TableCell>
                          <TableCell>Комментарий</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {reportRows.length > 0 ? (
                          reportRows.map((row: any, index: number) => (
                            <TableRow key={row.id || index}>
                              <TableCell>{row.title || row.trainingTitle || row.personName}</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                                {Number(row.amount ?? row.earnings).toLocaleString('ru-RU', {
                                  style: 'currency',
                                  currency: 'RUB',
                                })}
                              </TableCell>
                              <TableCell>
                                {format(new Date(row.occurredAt || row.trainingDate), 'dd.MM.yyyy', {
                                  locale: ru,
                                })}
                              </TableCell>
                              <TableCell>{row.comment || '-'}</TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={4} align="center">
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
            </Collapse>
          </>
        )}
      </Box>
    </LocalizationProvider>
  );
};

export default TrainerEarnings;
