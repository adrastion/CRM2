import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  CircularProgress,
  FormControlLabel,
  Paper,
  Switch,
  Typography,
} from '@mui/material';
import { apiService } from '../services/api';

/**
 * Секция SA: включение режима технических работ.
 */
const SuperAdminMaintenanceTab: React.FC = () => {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiService.getAdminMaintenance();
      setEnabled(Boolean(data?.enabled));
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось загрузить статус');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onToggle = async (_: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const data = await apiService.updateAdminMaintenance(checked);
      setEnabled(Boolean(data.enabled));
      if (checked) {
        sessionStorage.setItem('maintenanceMode', '1');
        setSuccess('Режим технических работ включён. Сайт недоступен всем, кроме супер-админа.');
      } else {
        sessionStorage.removeItem('maintenanceMode');
        setSuccess('Режим технических работ выключен. Сайт снова доступен.');
      }
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 640 }}>
      <Typography variant="h5" gutterBottom>
        Техобслуживание
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        В этом режиме сайт и API недоступны всем пользователям, кроме супер-админа. Используйте при
        выкладке обновлений.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Paper sx={{ p: 3 }}>
        <FormControlLabel
          control={
            <Switch
              checked={enabled}
              onChange={onToggle}
              disabled={saving}
              color="warning"
            />
          }
          label="Режим технических работ"
        />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {enabled
            ? 'Сейчас сайт закрыт для школ, клиентов и остальных ролей. Вы остаётесь в панели.'
            : 'Сайт работает в обычном режиме.'}
        </Typography>
      </Paper>
    </Box>
  );
};

export default SuperAdminMaintenanceTab;
