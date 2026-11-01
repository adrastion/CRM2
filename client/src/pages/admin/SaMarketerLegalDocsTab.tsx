import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { EditOutlined, OpenInNew, UploadFile } from '@mui/icons-material';
import { apiService } from '../../services/api';

type LegalDocRow = {
  key: string;
  title: string;
  fileName: string;
  onboarding: boolean;
  url: string;
  size: number | null;
  version: string | null;
  updatedAt: string | null;
  hasFile: boolean;
  hasBody?: boolean;
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

/**
 * Редактирование текстов шаблонов договоров маркетолога + опциональная замена PDF.
 * Сохранение текста пересобирает PDF на сервере и (для онбординга) повышает версию комплекта.
 */
const SaMarketerLegalDocsTab: React.FC = () => {
  const [docs, setDocs] = useState<LegalDocRow[]>([]);
  const [packVersion, setPackVersion] = useState('');
  const [packUpdatedAt, setPackUpdatedAt] = useState<string | null>(null);
  const [placeholders, setPlaceholders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const [editKey, setEditKey] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiService.adminListMarketerLegalDocs();
      setDocs(data.documents || []);
      setPackVersion(data.packVersion || '');
      setPackUpdatedAt(data.packUpdatedAt || null);
      setPlaceholders(data.placeholders || []);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось загрузить договоры');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openEditor = async (key: string) => {
    setEditKey(key);
    setEditLoading(true);
    setError(null);
    try {
      const data = await apiService.adminGetMarketerLegalDocBody(key);
      setEditTitle(data.title);
      setEditBody(data.bodyText || '');
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось открыть текст');
      setEditKey(null);
    } finally {
      setEditLoading(false);
    }
  };

  const saveEditor = async () => {
    if (!editKey) return;
    setEditSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const data = await apiService.adminUpdateMarketerLegalDocBody(editKey, editBody);
      setSuccess(
        data.document?.onboarding
          ? `«${editTitle}» сохранён. Версия комплекта: ${data.packVersion} — маркетологи принимают документы заново.`
          : `«${editTitle}» сохранён, PDF пересобран.`
      );
      setEditKey(null);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось сохранить');
    } finally {
      setEditSaving(false);
    }
  };

  const onPick = (key: string) => {
    fileRefs.current[key]?.click();
  };

  const onFile = async (key: string, file: File | undefined) => {
    if (!file) return;
    setUploadingKey(key);
    setError(null);
    setSuccess(null);
    try {
      const data = await apiService.adminUploadMarketerLegalDoc(key, file);
      setSuccess(
        data.document?.onboarding
          ? `«${data.document.title}» PDF заменён. Версия комплекта: ${data.packVersion}.`
          : `«${data.document?.title || key}» PDF заменён.`
      );
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось загрузить PDF');
    } finally {
      setUploadingKey(null);
      const input = fileRefs.current[key];
      if (input) input.value = '';
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
        Договоры маркетологов
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 780 }}>
        Тексты шаблонов редактируются на сайте. При сохранении сервер подставляет реквизиты оператора и
        собирает PDF. Для онбординг-документов повышается версия комплекта. Можно также заменить готовый
        PDF вручную.
      </Typography>

      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
        <Chip label={`Версия комплекта: ${packVersion || '—'}`} color="primary" variant="outlined" />
        {packUpdatedAt && (
          <Typography variant="body2" color="text.secondary">
            Обновлён: {formatDate(packUpdatedAt)}
          </Typography>
        )}
      </Stack>

      {placeholders.length > 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Плейсхолдеры:{' '}
          {placeholders.map((p) => (
            <Chip key={p} size="small" label={p} sx={{ mr: 0.5, mb: 0.5 }} />
          ))}
        </Alert>
      )}

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

      <Table size="small" sx={{ bgcolor: 'background.paper', borderRadius: 1 }}>
        <TableHead>
          <TableRow>
            <TableCell>Документ</TableCell>
            <TableCell>Онбординг</TableCell>
            <TableCell>Версия</TableCell>
            <TableCell>Размер PDF</TableCell>
            <TableCell>Обновлён</TableCell>
            <TableCell align="right">Действия</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {docs.map((d) => (
            <TableRow key={d.key}>
              <TableCell>
                <Typography fontWeight={700}>{d.title}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {d.key}
                  {d.hasBody ? ' · текст' : ''}
                  {d.hasFile ? ' · PDF' : ''}
                </Typography>
              </TableCell>
              <TableCell>
                {d.onboarding ? (
                  <Chip size="small" color="primary" label="Да" />
                ) : (
                  <Chip size="small" label="Нет" variant="outlined" />
                )}
              </TableCell>
              <TableCell>{d.version || '—'}</TableCell>
              <TableCell>{formatBytes(d.size)}</TableCell>
              <TableCell>{formatDate(d.updatedAt)}</TableCell>
              <TableCell align="right">
                <Button
                  size="small"
                  startIcon={<EditOutlined />}
                  onClick={() => void openEditor(d.key)}
                  sx={{ textTransform: 'none', mr: 0.5 }}
                >
                  Текст
                </Button>
                <Button
                  size="small"
                  href={d.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  startIcon={<OpenInNew />}
                  sx={{ textTransform: 'none', mr: 0.5 }}
                >
                  PDF
                </Button>
                <input
                  ref={(el) => {
                    fileRefs.current[d.key] = el;
                  }}
                  type="file"
                  accept="application/pdf,.pdf"
                  hidden
                  onChange={(e) => void onFile(d.key, e.target.files?.[0])}
                />
                <Button
                  size="small"
                  startIcon={<UploadFile />}
                  disabled={uploadingKey === d.key}
                  onClick={() => onPick(d.key)}
                  sx={{ textTransform: 'none' }}
                >
                  {uploadingKey === d.key ? '…' : 'PDF'}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={Boolean(editKey)} onClose={() => !editSaving && setEditKey(null)} fullWidth maxWidth="md">
        <DialogTitle>Редактирование: {editTitle || editKey}</DialogTitle>
        <DialogContent dividers>
          {editLoading ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress />
            </Box>
          ) : (
            <TextField
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              fullWidth
              multiline
              minRows={18}
              InputProps={{ sx: { fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 13 } }}
              helperText="Обычный текст с переносами. Плейсхолдеры вида {{operator.inn}} подставятся при сборке PDF."
            />
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setEditKey(null)} disabled={editSaving} sx={{ textTransform: 'none' }}>
            Отмена
          </Button>
          <Button
            variant="contained"
            onClick={() => void saveEditor()}
            disabled={editSaving || editLoading || !editBody.trim()}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            {editSaving ? 'Сохранение…' : 'Сохранить и собрать PDF'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SaMarketerLegalDocsTab;
