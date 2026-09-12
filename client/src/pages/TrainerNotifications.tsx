import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Switch,
  FormControlLabel,
  TextField,
  Button,
  CircularProgress,
  Alert,
} from '@mui/material';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { setHours, setMinutes } from 'date-fns';

const TrainerNotifications: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [trainerId, setTrainerId] = useState<string | null>(null);
  const [settings, setSettings] = useState({
    allTrainingsEnabled: false,
    allTrainingsTime: null as Date | null,
    reminderEnabled: false,
    reminderBeforeMinutes: 60,
  });

  useEffect(() => {
    fetchTrainerAndSettings();
  }, []);

  const fetchTrainerAndSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Получаем ID тренера из текущего пользователя
      const trainersRes = await apiService.getTrainers();
      const currentTrainer = trainersRes.data.find((t: any) => 
        t.userId === user?.id || (t.user && t.user.id === user?.id)
      );
      
      if (!currentTrainer) {
        setError('Тренер не найден');
        setLoading(false);
        return;
      }

      const trainerIdValue = currentTrainer.id || currentTrainer.userId;
      setTrainerId(trainerIdValue);

      // Получаем настройки уведомлений
      const notificationSettings = await apiService.getTrainerNotificationSettings(trainerIdValue);
      
      // Преобразуем время из минут в Date объект
      let allTrainingsTime: Date | null = null;
      if (notificationSettings.allTrainingsTime !== null && notificationSettings.allTrainingsTime !== undefined) {
        const minutes = notificationSettings.allTrainingsTime;
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        allTrainingsTime = setHours(setMinutes(new Date(), mins), hours);
      }

      setSettings({
        allTrainingsEnabled: notificationSettings.allTrainingsEnabled || false,
        allTrainingsTime,
        reminderEnabled: notificationSettings.reminderEnabled || false,
        reminderBeforeMinutes: notificationSettings.reminderBeforeMinutes || 60,
      });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка загрузки настроек уведомлений');
      console.error('Error fetching notification settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!trainerId) {
      setError('ID тренера не найден');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      // Преобразуем время в минуты от начала дня
      let allTrainingsTimeMinutes: number | null = null;
      if (settings.allTrainingsTime) {
        const hours = settings.allTrainingsTime.getHours();
        const minutes = settings.allTrainingsTime.getMinutes();
        allTrainingsTimeMinutes = hours * 60 + minutes;
      }

      await apiService.updateTrainerNotificationSettings(trainerId, {
        allTrainingsEnabled: settings.allTrainingsEnabled,
        allTrainingsTime: allTrainingsTimeMinutes,
        reminderEnabled: settings.reminderEnabled,
        reminderBeforeMinutes: settings.reminderBeforeMinutes,
      });

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка сохранения настроек');
      console.error('Error saving notification settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleTimeChange = (newTime: Date | null) => {
    setSettings(prev => ({ ...prev, allTrainingsTime: newTime }));
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box>
        <Typography variant="h5" gutterBottom>
          Настройки уведомлений
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Настройте уведомления о тренировках
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(false)}>
            Настройки успешно сохранены
          </Alert>
        )}

        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Уведомления о всех тренировках
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Получайте ежедневное уведомление о всех тренировках на выбранное время
                </Typography>
                
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.allTrainingsEnabled}
                      onChange={(e) => setSettings(prev => ({ ...prev, allTrainingsEnabled: e.target.checked }))}
                    />
                  }
                  label="Включить ежедневные уведомления"
                />

                {settings.allTrainingsEnabled && (
                  <Box sx={{ mt: 2 }}>
                    <TimePicker
                      label="Время уведомления"
                      value={settings.allTrainingsTime}
                      onChange={handleTimeChange}
                      slotProps={{
                        textField: {
                          fullWidth: true,
                        },
                      }}
                    />
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Напоминания перед тренировкой
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Получайте напоминание о предстоящей тренировке за указанное время до начала
                </Typography>
                
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.reminderEnabled}
                      onChange={(e) => setSettings(prev => ({ ...prev, reminderEnabled: e.target.checked }))}
                    />
                  }
                  label="Включить напоминания"
                />

                {settings.reminderEnabled && (
                  <Box sx={{ mt: 2 }}>
                    <TextField
                      fullWidth
                      label="За сколько минут напоминать"
                      type="number"
                      value={settings.reminderBeforeMinutes}
                      onChange={(e) => {
                        const value = parseInt(e.target.value);
                        if (!isNaN(value) && value >= 0) {
                          setSettings(prev => ({ ...prev, reminderBeforeMinutes: value }));
                        }
                      }}
                      inputProps={{ min: 0 }}
                      helperText="Например: 30 (за 30 минут до начала тренировки)"
                    />
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Box display="flex" justifyContent="flex-end" gap={2}>
              <Button
                variant="contained"
                onClick={handleSave}
                disabled={saving}
                size="large"
              >
                {saving ? <CircularProgress size={24} /> : 'Сохранить'}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Box>
    </LocalizationProvider>
  );
};

export default TrainerNotifications;

