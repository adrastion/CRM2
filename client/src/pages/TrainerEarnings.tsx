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
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const TrainerEarnings: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [earnings, setEarnings] = useState<any>(null);
  const [startDate, setStartDate] = useState<Date | null>(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [endDate, setEndDate] = useState<Date | null>(new Date());

  useEffect(() => {
    fetchEarnings();
  }, [startDate, endDate]);

  const fetchEarnings = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Получаем ID тренера из текущего пользователя
      const trainersRes = await apiService.getTrainers();
      const currentTrainer = trainersRes.data.find((t: any) => t.userId === user?.id);
      
      if (!currentTrainer) {
        setError('Тренер не найден');
        setLoading(false);
        return;
      }

      const params: any = {};
      if (startDate) {
        params.startDate = startDate.toISOString();
      }
      if (endDate) {
        params.endDate = endDate.toISOString();
      }

      const earningsRes = await apiService.getTrainerEarnings(currentTrainer.id, params);
      setEarnings(earningsRes.data);
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
            Мой заработок
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
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={4}>
                <Card>
                  <CardContent>
                    <Typography color="text.secondary" gutterBottom>
                      Всего тренировок
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                      {earnings.trainingCount || 0}
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
                      label={earnings.trainer?.salaryType === 'percentage' ? 'Процентная' : 'Фиксированная'}
                      color={earnings.trainer?.salaryType === 'percentage' ? 'secondary' : 'primary'}
                      sx={{ mt: 1 }}
                    />
                    {earnings.trainer?.salaryAmount && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        {earnings.trainer.salaryType === 'percentage' 
                          ? `${earnings.trainer.salaryAmount}%`
                          : `${earnings.trainer.salaryAmount} ₽ за посещение`}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Детализация по тренировкам */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
                  Детализация по тренировкам
                </Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Дата</TableCell>
                        <TableCell>Тренировка</TableCell>
                        <TableCell>Группа</TableCell>
                        <TableCell>Филиал</TableCell>
                        <TableCell>Присутствовало</TableCell>
                        <TableCell>Стоимость тренировки</TableCell>
                        <TableCell>Выручка</TableCell>
                        <TableCell>Заработок</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {earnings.trainingEarnings && earnings.trainingEarnings.length > 0 ? (
                        earnings.trainingEarnings.map((training: any, index: number) => (
                          <TableRow key={index}>
                            <TableCell>
                              {format(new Date(training.trainingDate), 'dd.MM.yyyy HH:mm', { locale: ru })}
                            </TableCell>
                            <TableCell>{training.trainingTitle}</TableCell>
                            <TableCell>{training.groupName}</TableCell>
                            <TableCell>{training.branchName}</TableCell>
                            <TableCell align="center">{training.presentCount}</TableCell>
                            <TableCell>
                              {training.trainingPrice?.toLocaleString('ru-RU', {
                                style: 'currency',
                                currency: 'RUB',
                              }) || '-'}
                            </TableCell>
                            <TableCell>
                              {training.totalRevenue?.toLocaleString('ru-RU', {
                                style: 'currency',
                                currency: 'RUB',
                              }) || '-'}
                            </TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>
                              {training.earnings?.toLocaleString('ru-RU', {
                                style: 'currency',
                                currency: 'RUB',
                              }) || '-'}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={8} align="center">
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

export default TrainerEarnings;

