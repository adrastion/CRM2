import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { apiService } from '../services/api';

/**
 * Редактирование политики конфиденциальности из панели SA.
 */
const SuperAdminPrivacyTab: React.FC = () => {
  const [content, setContent] = useState('');
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [isDefault, setIsDefault] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiService.getAdminPrivacy();
      setContent(data.content || '');
      setUpdatedAt(data.updatedAt);
      setIsDefault(Boolean(data.isDefault));
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось загрузить политику');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const data = await apiService.updateAdminPrivacy(content);
      setContent(data.content);
      setUpdatedAt(data.updatedAt);
      setIsDefault(false);
      setSuccess('Политика сохранена и доступна на странице /privacy');
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
    <Box sx={{ maxWidth: 900 }}>
      <Typography variant="h5" gutterBottom>
        Политика конфиденциальности
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Текст отображается на публичной странице /privacy. Шаблон нужно заменить юридически
        проверенным текстом.
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
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          {isDefault
            ? 'Сейчас показывается текст по умолчанию (ещё не сохраняли в панели).'
            : updatedAt
              ? `Последнее обновление: ${new Date(updatedAt).toLocaleString('ru-RU')}`
              : 'Сохранено в базе'}
        </Typography>
        <TextField
          value={content}
          onChange={(e) => setContent(e.target.value)}
          fullWidth
          multiline
          minRows={18}
          disabled={saving}
        />
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Button onClick={() => void load()} disabled={saving} sx={{ textTransform: 'none' }}>
            Отменить
          </Button>
          <Button
            variant="contained"
            onClick={() => void onSave()}
            disabled={saving || !content.trim()}
            sx={{ textTransform: 'none' }}
          >
            {saving ? 'Сохранение…' : 'Сохранить'}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default SuperAdminPrivacyTab;
