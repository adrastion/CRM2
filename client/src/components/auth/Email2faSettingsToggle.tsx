import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  CircularProgress,
  FormControlLabel,
  Paper,
  Switch,
  Typography,
} from '@mui/material';
import { apiService } from '../../services/api';

type Props = {
  /** Обернуть в Paper (для страниц настроек) */
  paper?: boolean;
};

/**
 * Тоггл «2FA по email» — работает для любой роли единого входа.
 */
const Email2faSettingsToggle: React.FC<Props> = ({ paper = true }) => {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await apiService.getLoginSecurity();
        if (!cancelled) setEnabled(Boolean(data.email2faEnabled));
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.response?.data?.error || 'Не удалось загрузить настройки входа');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onToggle = async (_: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
    setSaving(true);
    setError('');
    const prev = enabled;
    setEnabled(checked);
    try {
      const data = await apiService.updateLoginSecurity({ email2faEnabled: checked });
      setEnabled(Boolean(data.email2faEnabled));
    } catch (e: any) {
      setEnabled(prev);
      setError(e?.response?.data?.error || 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  const body = (
    <Box>
      <Typography variant="subtitle1" fontWeight="medium" sx={{ mb: 0.5 }}>
        Двухфакторная аутентификация
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        После ввода пароля потребуется код из письма на вашу почту.
      </Typography>
      {error ? (
        <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError('')}>
          {error}
        </Alert>
      ) : null}
      {loading ? (
        <CircularProgress size={24} />
      ) : (
        <FormControlLabel
          control={
            <Switch
              checked={enabled}
              onChange={onToggle}
              disabled={saving}
              color="primary"
            />
          }
          label={enabled ? 'Включена (пароль + код с почты)' : 'Выключена'}
        />
      )}
    </Box>
  );

  if (!paper) return body;
  return <Paper sx={{ p: { xs: 2, sm: 3 } }}>{body}</Paper>;
};

export default Email2faSettingsToggle;
