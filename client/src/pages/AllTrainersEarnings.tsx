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
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ru } from 'date-fns/locale';
import { apiService } from '../services/api';

const AllTrainersEarnings: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [earnings, setEarnings] = useState<any>(null);
  const [startDate, setStartDate] = useState<Date | null>(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [endDate, setEndDate] = useState<Date | null>(new Date());

  useEffect(() => {
    fetchEarnings();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchEarnings is stable, startDate/endDate trigger refetch
  }, [startDate, endDate]);

  const fetchEarnings = async () => {
    try {
      setLoading(true);
      setError(null);

      const params: any = {};
      if (startDate) {
        params.startDate = startDate.toISOString();
      }
      if (endDate) {
        params.endDate = endDate.toISOString();
      }

      const earningsRes = await apiService.getAllTrainersEarnings(params);
      setEarnings(earningsRes);
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

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ru}>
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
            Заработок тренеров
          </Typography>
        </Box>

        {/* Фильтры по дате */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={4}>
                <DatePicker
                  label="Дата начала"
                  value={startDate}
                  onChange={(newValue) => setStartDate(newValue)}
                  slotProps={{
                    textField: {
                      fullWidth: true
                    }
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
                      fullWidth: true
                    }
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
                >
                  Текущий месяц
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {earnings && (
          <>
            {/* Общая статистика */}
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
                      Общий заработок: {earnings.totalEarnings?.toLocaleString('ru-RU', {
                        style: 'currency',
                        currency: 'RUB',
                      }) || '0 ₽'}
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* Таблица заработка тренеров */}
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
                        <TableCell>Тренировок</TableCell>
                        <TableCell>Заработок</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {earnings.trainers && earnings.trainers.length > 0 ? (
                        earnings.trainers.map((trainer: any, index: number) => (
                          <TableRow key={index}>
                            <TableCell sx={{ fontWeight: 'medium' }}>
                              {trainer.trainerName}
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={trainer.salaryType === 'percentage' ? 'Процентная' : 'Фиксированная'}
                                color={trainer.salaryType === 'percentage' ? 'secondary' : 'primary'}
                                size="small"
                              />
                            </TableCell>
                            <TableCell>
                              {trainer.salaryAmount 
                                ? (trainer.salaryType === 'percentage' 
                                    ? `${trainer.salaryAmount}%`
                                    : `${trainer.salaryAmount} ₽`)
                                : '-'}
                            </TableCell>
                            <TableCell align="center">{trainer.trainingCount || 0}</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>
                              {trainer.totalEarnings?.toLocaleString('ru-RU', {
                                style: 'currency',
                                currency: 'RUB',
                              }) || '0 ₽'}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} align="center">
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

