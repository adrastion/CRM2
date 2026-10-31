import React, { useCallback, useEffect, useState } from 'react';
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

type Row = {
  id: string;
  amount: number;
  status: string;
  bankName?: string;
  bankAccountMasked?: string;
  bankRecipient?: string;
  signedAt?: string | null;
  dueAt?: string | null;
  createdAt: string;
  document?: { id: string; title?: string } | null;
  npdReceipt?: { id: string; uploadedAt: string; originalName?: string | null } | null;
  marketer?: { id: string; name: string; email: string };
};

const money = (n: number) =>
  new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 2,
  }).format(n || 0);

const formatDue = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

async function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

const MarketerPayoutQueue: React.FC = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [paidRows, setPaidRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState<Row | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [processing, paid] = await Promise.all([
        apiService.adminListMarketerPayouts('PROCESSING'),
        apiService.adminListMarketerPayouts('PAID'),
      ]);
      setRows(processing || []);
      setPaidRows((paid || []).slice(0, 50));
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось загрузить очередь выплат');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const markPaid = async (id: string) => {
    try {
      setBusyId(id);
      await apiService.adminMarkMarketerPayoutPaid(id);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось отметить выплату');
    } finally {
      setBusyId(null);
    }
  };

  const reject = async () => {
    if (!rejectOpen) return;
    try {
      setBusyId(rejectOpen.id);
      await apiService.adminRejectMarketerPayout(rejectOpen.id, rejectReason || undefined);
      setRejectOpen(null);
      setRejectReason('');
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось отклонить заявку');
    } finally {
      setBusyId(null);
    }
  };

  const downloadAct = async (row: Row) => {
    try {
      setBusyId(row.id);
      const blob = await apiService.adminDownloadMarketerPayoutDocumentBlob(row.id);
      await downloadBlob(blob, `${row.document?.title || 'act'}.pdf`);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось скачать акт');
    } finally {
      setBusyId(null);
    }
  };

  const downloadReceipt = async (row: Row) => {
    try {
      setBusyId(row.id);
      const blob = await apiService.adminDownloadMarketerNpdReceiptBlob(row.id);
      await downloadBlob(blob, row.npdReceipt?.originalName || 'npd-receipt.pdf');
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось скачать чек НПД');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Paper sx={{ p: 2, mb: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box>
          <Typography variant="h6" fontWeight="bold">
            Очередь выплат
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Подписанные заявки маркетологов (статус «В обработке»)
          </Typography>
        </Box>
        <Button size="small" onClick={() => void load()} disabled={loading}>
          Обновить
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" py={3}>
          <CircularProgress size={28} />
        </Box>
      ) : rows.length === 0 ? (
        <Typography color="text.secondary" py={2}>
          Нет заявок в обработке
        </Typography>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Маркетолог</TableCell>
                <TableCell>Сумма</TableCell>
                <TableCell>Реквизиты</TableCell>
                <TableCell>Подписано</TableCell>
                <TableCell>Срок до</TableCell>
                <TableCell align="right">Действия</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Typography fontWeight={600}>{row.marketer?.name || '—'}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {row.marketer?.email}
                    </Typography>
                  </TableCell>
                  <TableCell>{money(row.amount)}</TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {row.bankName} · {row.bankAccountMasked}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {row.bankRecipient}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {row.signedAt ? new Date(row.signedAt).toLocaleString('ru-RU') : '—'}
                  </TableCell>
                  <TableCell>{formatDue(row.dueAt)}</TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      disabled={busyId === row.id || !row.document}
                      onClick={() => void downloadAct(row)}
                      sx={{ mr: 1, textTransform: 'none' }}
                    >
                      Акт
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      disabled={busyId === row.id}
                      onClick={() => void markPaid(row.id)}
                      sx={{ mr: 1, textTransform: 'none' }}
                    >
                      Выплачено
                    </Button>
                    <Button
                      size="small"
                      color="inherit"
                      disabled={busyId === row.id}
                      onClick={() => {
                        setRejectReason('');
                        setRejectOpen(row);
                      }}
                      sx={{ textTransform: 'none' }}
                    >
                      Отклонить
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {!loading && paidRows.length > 0 && (
        <Box mt={4}>
          <Typography variant="subtitle1" fontWeight={700} mb={1}>
            Недавние выплаты
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Чек НПД и акт по выплаченным заявкам
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Маркетолог</TableCell>
                  <TableCell>Сумма</TableCell>
                  <TableCell>Срок до</TableCell>
                  <TableCell>Чек НПД</TableCell>
                  <TableCell align="right">Файлы</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paidRows.map((row) => (
                  <TableRow key={`paid-${row.id}`}>
                    <TableCell>
                      <Typography fontWeight={600}>{row.marketer?.name || '—'}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {row.marketer?.email}
                      </Typography>
                    </TableCell>
                    <TableCell>{money(row.amount)}</TableCell>
                    <TableCell>{formatDue(row.dueAt)}</TableCell>
                    <TableCell>
                      {row.npdReceipt ? (
                        <Chip size="small" color="success" label="Загружен" sx={{ fontWeight: 700 }} />
                      ) : (
                        <Chip size="small" label="Нет чека" sx={{ fontWeight: 700 }} />
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        disabled={busyId === row.id || !row.document}
                        onClick={() => void downloadAct(row)}
                        sx={{ mr: 1, textTransform: 'none' }}
                      >
                        Акт
                      </Button>
                      <Button
                        size="small"
                        disabled={busyId === row.id || !row.npdReceipt}
                        onClick={() => void downloadReceipt(row)}
                        sx={{ textTransform: 'none' }}
                      >
                        Чек
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      <Dialog open={!!rejectOpen} onClose={() => setRejectOpen(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Отклонить заявку</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Сумма вернётся на баланс маркетолога.
          </Typography>
          <TextField
            label="Причина"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            fullWidth
            multiline
            minRows={2}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectOpen(null)}>Отмена</Button>
          <Button color="warning" variant="contained" onClick={() => void reject()} disabled={!!busyId}>
            Отклонить
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default MarketerPayoutQueue;
