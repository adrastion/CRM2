import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Grid,
  Alert,
  CircularProgress,
  Paper,
  Divider,
} from '@mui/material';
import { Save } from '@mui/icons-material';
import { apiService } from '../services/api';

const Settings: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [defaultTrainingDuration, setDefaultTrainingDuration] = useState<number>(60);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);
        const response = await apiService.getSettings();
        if (response.data) {
          setDefaultTrainingDuration(response.data.defaultTrainingDuration || 60);
        }
      } catch (err: any) {
        console.error('Error loading settings:', err);
        // Если настроек нет, используем значения по умолчанию
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      await apiService.updateSettings({
        defaultTrainingDuration
      });

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Не удалось сохранить настройки');
      console.error('Error saving settings:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
          Настройки
        </Typography>
      </Box>

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

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
            Настройки расписания
          </Typography>

          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="subtitle1" gutterBottom fontWeight="medium">
                  Длительность тренировки по умолчанию
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  При создании тренировки время окончания будет автоматически устанавливаться на указанное количество минут после времени начала.
                </Typography>
                <TextField
                  fullWidth
                  type="number"
                  label="Длительность (минуты)"
                  value={defaultTrainingDuration}
                  onChange={(e) => {
                    const value = parseInt(e.target.value);
                    if (value >= 15 && value <= 480) {
                      setDefaultTrainingDuration(value);
                    }
                  }}
                  inputProps={{ min: 15, max: 480, step: 15 }}
                  helperText="Минимум: 15 минут, максимум: 480 минут (8 часов)"
                  sx={{ mb: 2 }}
                />
                <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
                  <Button
                    variant="contained"
                    startIcon={<Save />}
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? 'Сохранение...' : 'Сохранить настройки'}
                  </Button>
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
};

export default Settings;

