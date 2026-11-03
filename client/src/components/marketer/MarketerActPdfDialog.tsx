import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import { Download, OpenInNew } from '@mui/icons-material';

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** Подпись статуса: черновик / подписан */
  statusLabel?: string;
  loadBlob: () => Promise<Blob>;
};

/**
 * Встроенный просмотр PDF акта (blob URL + iframe).
 */
const MarketerActPdfDialog: React.FC<Props> = ({
  open,
  onClose,
  title,
  statusLabel,
  loadBlob,
}) => {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError('');
        setUrl(null);
        const blob = await loadBlob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      } catch (e: any) {
        if (!cancelled) setError(e?.response?.data?.error || e?.message || 'Не удалось открыть документ');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, loadBlob]);

  const download = () => {
    if (!url) return;
    void (async () => {
      try {
        const res = await fetch(url);
        const blob = await res.blob();
        const { downloadBlob } = await import('../../capacitor/nativeDownload');
        await downloadBlob(blob, `${title || 'act'}.pdf`);
      } catch {
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title || 'act'}.pdf`;
        a.click();
      }
    })();
  };

  const openTab = () => {
    if (!url) return;
    void download();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" scroll="paper">
      <DialogTitle sx={{ pb: 1 }}>
        <Typography component="span" sx={{ fontWeight: 800, fontSize: 18, display: 'block' }}>
          {title || 'Акт на вывод'}
        </Typography>
        {statusLabel && (
          <Typography component="span" sx={{ fontSize: 13, color: 'text.secondary' }}>
            {statusLabel}
          </Typography>
        )}
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0, bgcolor: '#f4f6fa', minHeight: 420 }}>
        {loading && (
          <Box display="flex" justifyContent="center" alignItems="center" py={10}>
            <CircularProgress />
          </Box>
        )}
        {error && (
          <Box p={2}>
            <Alert severity="error">{error}</Alert>
          </Box>
        )}
        {!loading && !error && url && (
          <Box
            component="iframe"
            title={title || 'Акт'}
            src={url}
            sx={{
              display: 'block',
              width: '100%',
              height: { xs: '60vh', md: '70vh' },
              border: 0,
              bgcolor: '#fff',
            }}
          />
        )}
      </DialogContent>
      <DialogActions sx={{ px: 2, py: 1.5, gap: 1, flexWrap: 'wrap' }}>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>
          Закрыть
        </Button>
        <Button
          startIcon={<OpenInNew />}
          onClick={openTab}
          disabled={!url}
          sx={{ textTransform: 'none' }}
        >
          В новой вкладке
        </Button>
        <Button
          variant="contained"
          startIcon={<Download />}
          onClick={download}
          disabled={!url}
          sx={{ textTransform: 'none', fontWeight: 700 }}
        >
          Скачать
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MarketerActPdfDialog;
