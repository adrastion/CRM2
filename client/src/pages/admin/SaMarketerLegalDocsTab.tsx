import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { UploadFile, OpenInNew } from '@mui/icons-material';
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
 * Замена PDF-договоров маркетолога (не визуальный редактор PDF).
 * Замена онбординг-документа повышает версию комплекта — маркетологи принимают заново.
 */
const SaMarketerLegalDocsTab: React.FC = () => {
  const [docs, setDocs] = useState<LegalDocRow[]>([]);
  const [packVersion, setPackVersion] = useState('');
  const [packUpdatedAt, setPackUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiService.adminListMarketerLegalDocs();
      setDocs(data.documents || []);
      setPackVersion(data.packVersion || '');
      setPackUpdatedAt(data.packUpdatedAt || null);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось загрузить договоры');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
          ? `«${data.document.title}» заменён. Версия комплекта: ${data.packVersion} — маркетологи должны принять документы заново.`
          : `«${data.document?.title || key}» заменён.`
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
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 720 }}>
        Загрузите готовый PDF, чтобы заменить файл в кабинете маркетолога. Редактирование текста
        внутри PDF здесь не выполняется — подготовьте документ во внешнем редакторе и загрузите
        новую версию. При замене договора из онбординга повышается версия комплекта, и маркетологи
        принимают согласия заново.
      </Typography>

      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
        <Chip label={`Версия комплекта: ${packVersion || '—'}`} color="primary" variant="outlined" />
        {packUpdatedAt && (
          <Typography variant="body2" color="text.secondary">
            Обновлён: {formatDate(packUpdatedAt)}
          </Typography>
        )}
      </Stack>

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
            <TableCell>Версия файла</TableCell>
            <TableCell>Размер</TableCell>
            <TableCell>Обновлён</TableCell>
            <TableCell align="right">Действия</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {docs.map((d) => (
            <TableRow key={d.key} hover>
              <TableCell>
                <Typography fontWeight={600}>{d.title}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {d.fileName} · {d.key}
                </Typography>
              </TableCell>
              <TableCell>
                {d.onboarding ? (
                  <Chip size="small" label="Да" color="warning" variant="outlined" />
                ) : (
                  <Chip size="small" label="Справочный" variant="outlined" />
                )}
              </TableCell>
              <TableCell>{d.version || '—'}</TableCell>
              <TableCell>{formatBytes(d.size)}</TableCell>
              <TableCell>{formatDate(d.updatedAt)}</TableCell>
              <TableCell align="right">
                <Stack direction="row" spacing={1} justifyContent="flex-end">
                  <Button
                    size="small"
                    href={d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    startIcon={<OpenInNew fontSize="small" />}
                    disabled={!d.hasFile}
                  >
                    Открыть
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
                    variant="contained"
                    startIcon={
                      uploadingKey === d.key ? (
                        <CircularProgress size={14} color="inherit" />
                      ) : (
                        <UploadFile fontSize="small" />
                      )
                    }
                    disabled={uploadingKey !== null}
                    onClick={() => onPick(d.key)}
                  >
                    Заменить PDF
                  </Button>
                </Stack>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
};

export default SaMarketerLegalDocsTab;
