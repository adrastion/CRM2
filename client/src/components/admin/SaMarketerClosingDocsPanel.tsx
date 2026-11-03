import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { apiService } from '../../services/api';

/** Загрузка закрывающих документов — они показываются маркетологу в «Документы». */
const SaMarketerClosingDocsPanel: React.FC = () => {
  const [closingDocs, setClosingDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [docForm, setDocForm] = useState({
    title: '',
    periodLabel: '',
    file: null as File | null,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const docs = await apiService.adminListMarketerClosingDocs();
      setClosingDocs(docs || []);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Не удалось загрузить документы');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={3}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h6" fontWeight={700} gutterBottom>
        Закрывающие документы
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Файлы появляются у маркетолога во вкладке «Документы».
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={4}>
          <TextField
            fullWidth
            size="small"
            label="Название"
            value={docForm.title}
            onChange={(e) => setDocForm({ ...docForm, title: e.target.value })}
          />
        </Grid>
        <Grid item xs={12} sm={3}>
          <TextField
            fullWidth
            size="small"
            label="Период"
            value={docForm.periodLabel}
            onChange={(e) => setDocForm({ ...docForm, periodLabel: e.target.value })}
          />
        </Grid>
        <Grid item xs={12} sm={3}>
          <Button variant="outlined" component="label" fullWidth sx={{ textTransform: 'none' }}>
            {docForm.file ? docForm.file.name : 'Выбрать файл'}
            <input
              type="file"
              hidden
              onChange={(e) => setDocForm({ ...docForm, file: e.target.files?.[0] || null })}
            />
          </Button>
        </Grid>
        <Grid item xs={12} sm={2}>
          <Button
            fullWidth
            variant="contained"
            disabled={!docForm.file || !docForm.title.trim()}
            sx={{ textTransform: 'none' }}
            onClick={async () => {
              try {
                if (!docForm.file) return;
                await apiService.adminCreateMarketerClosingDoc({
                  title: docForm.title,
                  periodLabel: docForm.periodLabel || undefined,
                  marketerId: null,
                  file: docForm.file,
                });
                setDocForm({ title: '', periodLabel: '', file: null });
                await load();
              } catch (e: any) {
                setError(e?.response?.data?.error || e?.message || 'Ошибка документа');
              }
            }}
          >
            Добавить
          </Button>
        </Grid>
      </Grid>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Название</TableCell>
              <TableCell>Период</TableCell>
              <TableCell>Файл</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {closingDocs.map((d) => (
              <TableRow key={d.id}>
                <TableCell>{d.title}</TableCell>
                <TableCell>{d.periodLabel || '—'}</TableCell>
                <TableCell>
                  <Button
                    size="small"
                    sx={{ textTransform: 'none' }}
                    onClick={async () => {
                      const blob = await apiService.adminDownloadMarketerClosingDocBlob(d.id);
                      const { downloadBlob } = await import('../../capacitor/nativeDownload');
                      await downloadBlob(blob, `${d.title || 'document'}.pdf`);
                    }}
                  >
                    Открыть
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {closingDocs.length === 0 && (
              <TableRow>
                <TableCell colSpan={3}>
                  <Typography color="text.secondary" sx={{ py: 1.5 }}>
                    Документов пока нет
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default SaMarketerClosingDocsPanel;
