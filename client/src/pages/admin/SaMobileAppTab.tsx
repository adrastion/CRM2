import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { DeleteOutline, Download, UploadFile } from '@mui/icons-material';
import { apiService } from '../../services/api';

type ApkMeta = {
  hasFile: boolean;
  originalName: string | null;
  size: number | null;
  label: string | null;
  uploadedAt: string | null;
};

const formatBytes = (n: number | null) => {
  if (n == null) return '—';
  if (n < 1024) return `${n} Б`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} КБ`;
  return `${(n / (1024 * 1024)).toFixed(1)} МБ`;
};

const formatDate = (iso: string | null) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('ru-RU');
  } catch {
    return iso;
  }
};

/** Хранение APK для будущей раздачи. Сейчас доступно только SA. */
const SaMobileAppTab: React.FC = () => {
  const [meta, setMeta] = useState<ApkMeta | null>(null);
  const [label, setLabel] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiService.adminGetMobileApk();
      setMeta(data);
      setLabel(data.label || '');
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось загрузить сведения об APK');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onUpload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const data = await apiService.adminUploadMobileApk(file, label.trim() || undefined);
      setMeta(data);
      setLabel(data.label || '');
      setSuccess('APK загружен. Пользователям файл пока не выдаётся.');
    } catch (e: any) {
      const status = e?.response?.status;
      const timedOut =
        e?.code === 'ECONNABORTED' ||
        String(e?.message || '').toLowerCase().includes('timeout');
      setError(
        e?.response?.data?.error ||
          (status === 413
            ? 'Сервер отклонил файл (413). Убедитесь, что backend на :3001 запущен, затем hard-refresh страницы (Ctrl+F5).'
            : timedOut
              ? 'Превышено время ожидания загрузки. Попробуйте ещё раз или проверьте размер APK.'
              : e?.message || 'Не удалось загрузить APK')
      );
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const onSaveLabel = async () => {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const data = await apiService.adminUpdateMobileApkLabel(label.trim() || null);
      setMeta(data);
      setSuccess('Подпись обновлена');
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось сохранить подпись');
    } finally {
      setBusy(false);
    }
  };

  const onDownload = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiService.adminDownloadMobileApk();
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Не удалось скачать APK');
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    if (!window.confirm('Удалить загруженный APK с сервера?')) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const data = await apiService.adminDeleteMobileApk();
      setMeta(data);
      setLabel('');
      setSuccess('APK удалён');
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось удалить APK');
    } finally {
      setBusy(false);
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
    <Box>
      <Typography variant="h5" gutterBottom>
        Мобильное приложение
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 720 }}>
        Загрузите APK программы для хранения на сервере. Сейчас файл доступен только в кабинете
        супер-админа — пользователям и школам он нигде не показывается и не скачивается.
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

      <Box
        sx={{
          p: 2.5,
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          maxWidth: 640,
        }}
      >
        <Typography variant="subtitle1" fontWeight={700} gutterBottom>
          Текущий файл
        </Typography>
        {meta?.hasFile ? (
          <Stack spacing={0.75} sx={{ mb: 2 }}>
            <Typography variant="body2">
              Имя: <strong>{meta.originalName || '—'}</strong>
            </Typography>
            <Typography variant="body2">Размер: {formatBytes(meta.size)}</Typography>
            <Typography variant="body2">Загружен: {formatDate(meta.uploadedAt)}</Typography>
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            APK ещё не загружен.
          </Typography>
        )}

        <TextField
          label="Подпись / версия (необязательно)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          fullWidth
          size="small"
          placeholder="например 1.0.3"
          sx={{ mb: 2 }}
          disabled={busy}
        />

        <input
          ref={fileRef}
          type="file"
          accept=".apk,application/vnd.android.package-archive"
          hidden
          onChange={(e) => void onUpload(e.target.files?.[0])}
        />

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} flexWrap="wrap">
          <Button
            variant="contained"
            startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <UploadFile />}
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            {meta?.hasFile ? 'Заменить APK' : 'Загрузить APK'}
          </Button>
          {meta?.hasFile && (
            <>
              <Button variant="outlined" disabled={busy} onClick={() => void onSaveLabel()}>
                Сохранить подпись
              </Button>
              <Button
                variant="outlined"
                startIcon={<Download />}
                disabled={busy}
                onClick={() => void onDownload()}
              >
                Скачать
              </Button>
              <Button
                color="error"
                variant="outlined"
                startIcon={<DeleteOutline />}
                disabled={busy}
                onClick={() => void onDelete()}
              >
                Удалить
              </Button>
            </>
          )}
        </Stack>
      </Box>
    </Box>
  );
};

export default SaMobileAppTab;
