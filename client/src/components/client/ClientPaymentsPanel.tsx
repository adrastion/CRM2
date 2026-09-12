import React from 'react';
import {
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
import { apiService } from '../../services/api';
import Panel from '../dashboard/Panel';
import { colors, typography } from '../../theme/tokens';

interface Props {
  clientId?: string;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Ожидается',
  paid: 'Оплачено',
  cancelled: 'Отменено',
  overdue: 'Просрочено',
  awaiting_confirmation: 'На проверке',
};

const TYPE_LABELS: Record<string, string> = {
  membership: 'Абонемент',
  monthly: 'Ежемесячный',
  monthly_payment: 'Ежемесячный',
  single: 'Разовое',
  fine: 'Штраф',
  other: 'Другое',
};

function formatDate(iso?: string | Date | null): string {
  if (!iso) return '—';
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('ru-RU');
}

const RUB = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
});

const QrImg: React.FC<{ methodId: string }> = ({ methodId }) => {
  const [url, setUrl] = React.useState<string | null>(null);
  React.useEffect(() => {
    let revoked: string | null = null;
    let cancelled = false;
    (async () => {
      try {
        const blob = await apiService.getPortalPaymentMethodQrBlob(methodId);
        if (cancelled) return;
        const u = URL.createObjectURL(blob);
        revoked = u;
        setUrl(u);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [methodId]);
  if (!url) {
    return (
      <Box sx={{ width: 220, height: 220, bgcolor: 'action.hover', borderRadius: 1, mx: 'auto' }} />
    );
  }
  return (
    <Box
      component="img"
      src={url}
      alt="QR для оплаты"
      sx={{ width: 220, height: 220, objectFit: 'contain', display: 'block', mx: 'auto', bgcolor: '#fff' }}
    />
  );
};

type PayTarget = {
  method: any | null;
  total: number;
  paymentIds: string[];
  /** single payment expected amount for receipt default (first id) */
  singlePaymentAmount?: number;
};

const ClientPaymentsPanel: React.FC<Props> = ({ clientId }) => {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [payments, setPayments] = React.useState<any[]>([]);
  const [payGroups, setPayGroups] = React.useState<any[]>([]);
  const [pickOpen, setPickOpen] = React.useState(false);
  const [payOpen, setPayOpen] = React.useState(false);
  const [payTarget, setPayTarget] = React.useState<PayTarget | null>(null);
  const [step, setStep] = React.useState<'qr' | 'receipt'>('qr');
  const [claimedAmount, setClaimedAmount] = React.useState('');
  const [receiptFile, setReceiptFile] = React.useState<File | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const amountRef = React.useRef<HTMLInputElement>(null);

  const reload = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [list, methodsData] = await Promise.all([
        apiService.getClientPayments(clientId),
        apiService.getPortalPaymentMethods(clientId),
      ]);
      setPayments(list || []);
      setPayGroups(methodsData?.groups || []);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось загрузить платежи');
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  React.useEffect(() => {
    reload();
  }, [reload]);

  const unpaid = payments.filter((p) => p.status === 'pending' || p.status === 'overdue');

  const openPayDialog = (target: PayTarget) => {
    setPayTarget(target);
    setStep('qr');
    setClaimedAmount(String(target.singlePaymentAmount ?? target.total));
    setReceiptFile(null);
    setPayOpen(true);
  };

  const handleTopPay = () => {
    const withMethod = payGroups.filter((g) => g.method && g.paymentIds?.length);
    if (withMethod.length === 0) {
      setError('Школа ещё не добавила QR или ссылку для оплаты');
      return;
    }
    if (withMethod.length === 1) {
      openPayDialog({
        method: withMethod[0].method,
        total: withMethod[0].total,
        paymentIds: withMethod[0].paymentIds,
      });
      return;
    }
    setPickOpen(true);
  };

  const handleRowPay = (payment: any) => {
    const group = payGroups.find((g) => (g.paymentIds || []).includes(payment.id));
    openPayDialog({
      method: group?.method || null,
      total: Number(payment.amount) || 0,
      paymentIds: [payment.id],
      singlePaymentAmount: Number(payment.amount) || 0,
    });
  };

  const submitReceipt = async () => {
    if (!payTarget?.paymentIds?.length) return;
    const amount = Number(claimedAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Укажите сумму');
      return;
    }
    if (!receiptFile) {
      setError('Приложите чек об оплате');
      return;
    }

    const expected =
      payTarget.singlePaymentAmount != null
        ? payTarget.singlePaymentAmount
        : payTarget.paymentIds.length === 1
          ? payTarget.total
          : null;

    // For multi-payment top pay we submit one receipt per payment, proportional not supported —
    // require paying one payment at a time for receipt, OR submit same claimed for each when single pick.
    // Plan: after pay, attach receipt for specific payment. For top aggregate with multiple IDs,
    // open receipt step asks amount once and we attach to each unpaid id with that amount only if one id;
    // if multiple ids in target, ask to pay per row OR submit receipt against each with split.
    // Simplest UX matching plan: receipt is per payment. For multi total QR view, after "Я оплатил"
    // if multiple paymentIds, submit receipt for each with claimedAmount = that payment's amount
    // unless user entered different total — then warn and apply claimedAmount only when 1 payment.

    const ids = payTarget.paymentIds;
    if (ids.length === 1) {
      const payment = payments.find((p) => p.id === ids[0]);
      const expectedAmt = Number(payment?.amount ?? expected ?? payTarget.total);
      if (amount !== expectedAmt) {
        const ok = window.confirm('Вы уверены, что сумма другая?');
        if (!ok) {
          amountRef.current?.focus();
          return;
        }
      }
      setSubmitting(true);
      try {
        await apiService.submitPortalPaymentReceipt(ids[0], receiptFile, amount, clientId);
        setPayOpen(false);
        await reload();
      } catch (e: any) {
        setError(e?.response?.data?.error || 'Не удалось отправить чек');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Multiple debts, one QR: attach receipt to each unpaid payment with its own amount
    if (amount !== payTarget.total) {
      const ok = window.confirm('Вы уверены, что сумма другая?');
      if (!ok) {
        amountRef.current?.focus();
        return;
      }
    }
    setSubmitting(true);
    try {
      for (const id of ids) {
        const p = payments.find((x) => x.id === id);
        const per = Number(p?.amount) || 0;
        // If user claimed different total, put full claimed on first and skip others with zero — better:
        // use per-payment amount always for multi; claimed total is informational when equals sum.
        await apiService.submitPortalPaymentReceipt(
          id,
          receiptFile,
          amount === payTarget.total ? per : amount,
          clientId
        );
        // Only attach once if amount differs — attach to first payment only
        if (amount !== payTarget.total) break;
      }
      setPayOpen(false);
      await reload();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось отправить чек');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Panel title="Мои платежи">
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={32} />
        </Box>
      ) : error ? (
        <Typography sx={{ color: colors.danger, fontSize: typography.label, mb: 1 }}>{error}</Typography>
      ) : null}

      {!loading && unpaid.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Button variant="contained" onClick={handleTopPay}>
            Оплатить
          </Button>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            К оплате: {RUB.format(unpaid.reduce((s, p) => s + (Number(p.amount) || 0), 0))}
          </Typography>
        </Box>
      )}

      {!loading && !error && payments.length === 0 ? (
        <Typography sx={{ fontSize: typography.label, color: colors.textEmpty, py: 2 }}>
          Вам пока не выставлено ни одного платежа
        </Typography>
      ) : !loading && payments.length > 0 ? (
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Дата</TableCell>
                <TableCell>Тип</TableCell>
                <TableCell>Сумма</TableCell>
                <TableCell>Статус</TableCell>
                <TableCell>Группа / тариф</TableCell>
                <TableCell>Срок оплаты</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {payments.map((p) => {
                const canPay = p.status === 'pending' || p.status === 'overdue';
                return (
                  <TableRow key={p.id} hover>
                    <TableCell>{formatDate(p.paidAt || p.createdAt)}</TableCell>
                    <TableCell>
                      {String(p.notes || '').includes('Списание при выдаче')
                        ? 'Списание абонемента'
                        : `${TYPE_LABELS[p.type] || p.type}${p.isMonthlyPayment ? ' · ежемес.' : ''}`}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{RUB.format(Number(p.amount) || 0)}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={
                          String(p.notes || '').includes('Списание при выдаче')
                            ? 'Списание'
                            : STATUS_LABELS[p.status] || p.status
                        }
                        color={
                          String(p.notes || '').includes('Списание при выдаче')
                            ? 'default'
                            : p.status === 'paid'
                              ? 'success'
                              : p.status === 'cancelled'
                                ? 'default'
                                : p.status === 'awaiting_confirmation'
                                  ? 'info'
                                  : 'warning'
                        }
                      />
                    </TableCell>
                    <TableCell>
                      {[p.groupName, p.membershipName, p.branchName].filter(Boolean).join(' · ') || '—'}
                    </TableCell>
                    <TableCell>{formatDate(p.dueDate)}</TableCell>
                    <TableCell align="right">
                      {canPay && (
                        <Button size="small" variant="outlined" onClick={() => handleRowPay(p)}>
                          Оплатить
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>
      ) : null}

      {/* Pick method when several QR groups */}
      <Dialog open={pickOpen} onClose={() => setPickOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Выберите способ оплаты</DialogTitle>
        <DialogContent>
          <Stack spacing={1} sx={{ mt: 1 }}>
            {payGroups
              .filter((g) => g.method && g.paymentIds?.length)
              .map((g) => (
                <Button
                  key={g.method.id}
                  variant="outlined"
                  sx={{ justifyContent: 'space-between', textTransform: 'none' }}
                  onClick={() => {
                    setPickOpen(false);
                    openPayDialog({
                      method: g.method,
                      total: g.total,
                      paymentIds: g.paymentIds,
                    });
                  }}
                >
                  <span>{g.method.title}</span>
                  <strong>{RUB.format(g.total)}</strong>
                </Button>
              ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPickOpen(false)}>Отмена</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={payOpen} onClose={() => setPayOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{step === 'qr' ? 'Оплата' : 'Чек об оплате'}</DialogTitle>
        <DialogContent>
          {step === 'qr' && payTarget && (
            <Stack spacing={2} alignItems="center" sx={{ py: 1 }}>
              <Typography variant="h6">{RUB.format(payTarget.total)}</Typography>
              {payTarget.method?.hasQr && <QrImg methodId={payTarget.method.id} />}
              {!payTarget.method && (
                <Typography color="text.secondary">
                  Реквизиты для этого платежа не настроены. Обратитесь в школу.
                </Typography>
              )}
              {payTarget.method?.paymentUrl && (
                <Button
                  href={payTarget.method.paymentUrl}
                  target="_blank"
                  rel="noreferrer"
                  variant="outlined"
                >
                  Открыть ссылку на оплату
                </Button>
              )}
              {payTarget.method?.paymentUrl && (
                <Button
                  size="small"
                  onClick={() => navigator.clipboard?.writeText(payTarget.method.paymentUrl)}
                >
                  Копировать ссылку
                </Button>
              )}
            </Stack>
          )}
          {step === 'receipt' && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Приложите чек и укажите сумму, которую перевели.
              </Typography>
              <TextField
                label="Сумма"
                type="number"
                fullWidth
                inputRef={amountRef}
                value={claimedAmount}
                onChange={(e) => setClaimedAmount(e.target.value)}
              />
              <Button component="label" variant="outlined">
                {receiptFile ? receiptFile.name : 'Приложить чек'}
                <input
                  hidden
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                  onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                />
              </Button>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPayOpen(false)}>Закрыть</Button>
          {step === 'qr' && payTarget?.method && (
            <Button variant="contained" onClick={() => setStep('receipt')}>
              Я оплатил
            </Button>
          )}
          {step === 'receipt' && (
            <Button variant="contained" onClick={submitReceipt} disabled={submitting}>
              {submitting ? 'Отправка…' : 'Отправить чек'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Panel>
  );
};

export default ClientPaymentsPanel;
