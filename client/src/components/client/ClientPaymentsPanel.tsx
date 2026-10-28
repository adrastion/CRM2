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
  FormControl,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import {
  ArrowForward,
  CalendarMonthOutlined,
  CreditCard,
  PaymentsOutlined,
  ReceiptLongOutlined,
} from '@mui/icons-material';
import { apiService } from '../../services/api';
import { colors, radii, typography } from '../../theme/tokens';

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

const cardSx = {
  bgcolor: colors.card,
  borderRadius: `${radii.panel}px`,
  boxShadow: '0 4px 18px rgba(32, 34, 36, 0.06)',
  border: '1px solid #EEF1F6',
} as const;

const filterSelectSx = {
  minWidth: { xs: '100%', sm: 148 },
  bgcolor: colors.surface,
  borderRadius: `${radii.button}px`,
  fontSize: typography.label,
  fontWeight: 600,
  color: colors.textMuted,
  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#E6EAF2' },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: colors.primarySoft },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: colors.primary },
  '& .MuiSelect-select': { py: 1.1, px: 1.5 },
} as const;

const PayNowButton: React.FC<{ onClick: () => void; fullWidth?: boolean }> = ({
  onClick,
  fullWidth,
}) => (
  <Button
    variant="contained"
    endIcon={<ArrowForward sx={{ fontSize: 18 }} />}
    onClick={onClick}
    fullWidth={fullWidth}
    sx={{
      textTransform: 'none',
      fontWeight: 700,
      fontSize: typography.button,
      borderRadius: `${radii.button}px`,
      bgcolor: colors.primary,
      boxShadow: '0 6px 16px rgba(47, 107, 255, 0.28)',
      px: 2.5,
      py: 1.15,
      '&:hover': { bgcolor: colors.primaryDark },
    }}
  >
    Оплатить сейчас
  </Button>
);

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
  singlePaymentAmount?: number;
};

type TypeFilter = 'all' | string;
type StatusFilter = 'all' | string;
type PeriodFilter = 'all' | '30d' | '90d' | 'year';

function paymentTypeKey(p: any): string {
  if (String(p.notes || '').includes('Списание при выдаче')) return 'membership_writeoff';
  return p.type || 'other';
}

function inPeriod(iso: string | Date | null | undefined, period: PeriodFilter): boolean {
  if (period === 'all' || !iso) return true;
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return true;
  const now = Date.now();
  const ms =
    period === '30d' ? 30 * 86400000 : period === '90d' ? 90 * 86400000 : 365 * 86400000;
  return now - d.getTime() <= ms;
}

/**
 * Вкладка «Платежи» ЛК ученика — макет Reference LK clients/Платежи.png
 */
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
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>('all');
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
  const [periodFilter, setPeriodFilter] = React.useState<PeriodFilter>('all');
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

  const totalAmount = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const lastPayment = React.useMemo(() => {
    if (!payments.length) return null;
    return [...payments].sort((a, b) => {
      const ta = new Date(a.paidAt || a.createdAt || 0).getTime();
      const tb = new Date(b.paidAt || b.createdAt || 0).getTime();
      return tb - ta;
    })[0];
  }, [payments]);

  const filtered = payments.filter((p) => {
    if (typeFilter !== 'all' && paymentTypeKey(p) !== typeFilter) return false;
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (!inPeriod(p.paidAt || p.createdAt, periodFilter)) return false;
    return true;
  });

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
        await apiService.submitPortalPaymentReceipt(
          id,
          receiptFile,
          amount === payTarget.total ? per : amount,
          clientId
        );
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

  const typeLabel = (p: any) =>
    String(p.notes || '').includes('Списание при выдаче')
      ? 'Списание абонемента'
      : `${TYPE_LABELS[p.type] || p.type}${p.isMonthlyPayment ? ' · ежемес.' : ''}`;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography sx={{ fontSize: typography.label, color: colors.textMuted, maxWidth: 720, mt: -0.5 }}>
        Здесь вы можете оплачивать занятия, абонементы и другие услуги, а также просматривать историю
        платежей.
      </Typography>

      {error && (
        <Typography sx={{ color: colors.danger, fontSize: typography.label }}>{error}</Typography>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress size={32} />
        </Box>
      ) : (
        <>
          <Box
            sx={{
              ...cardSx,
              p: { xs: 2.5, md: 3 },
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 3,
              flexWrap: 'wrap',
              background: 'linear-gradient(105deg, #EEF4FF 0%, #F7FAFF 45%, #FFFFFF 100%)',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <Box sx={{ minWidth: 0, flex: '1 1 280px', maxWidth: 520 }}>
              <Typography
                sx={{
                  fontWeight: 800,
                  fontSize: { xs: 18, md: 22 },
                  color: colors.text,
                  mb: 0.75,
                  letterSpacing: '-0.02em',
                }}
              >
                Удобная оплата в пару кликов
              </Typography>
              <Typography sx={{ fontSize: typography.label, color: colors.textMuted, mb: 2, maxWidth: 420 }}>
                Оплачивайте занятия, абонементы и другие услуги быстро и безопасно.
              </Typography>
              <PayNowButton onClick={handleTopPay} />
              {unpaid.length > 0 && (
                <Typography sx={{ mt: 1, fontSize: typography.hint, color: colors.textHint }}>
                  К оплате: {RUB.format(unpaid.reduce((s, p) => s + (Number(p.amount) || 0), 0))}
                </Typography>
              )}
            </Box>

            <Box
              aria-hidden
              sx={{
                position: 'relative',
                width: { xs: 120, md: 148 },
                height: { xs: 96, md: 112 },
                flexShrink: 0,
                mr: { md: 1 },
              }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '18px',
                  background: 'linear-gradient(145deg, #5B8CFF 0%, #2F6BFF 55%, #1E4FD6 100%)',
                  boxShadow: '0 14px 28px rgba(47, 107, 255, 0.28)',
                  transform: 'rotate(-8deg)',
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'flex-start',
                  p: 1.5,
                  color: 'rgba(255,255,255,0.9)',
                }}
              >
                <CreditCard sx={{ fontSize: 36 }} />
              </Box>
              <Box
                sx={{
                  position: 'absolute',
                  right: -6,
                  bottom: -4,
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  bgcolor: colors.success,
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: 18,
                  boxShadow: '0 6px 14px rgba(0, 182, 155, 0.35)',
                }}
              >
                ✓
              </Box>
            </Box>
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
              gap: 2,
            }}
          >
            <Box sx={{ ...cardSx, p: { xs: 2, md: 2.5 } }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: typography.label, color: colors.textMuted, fontWeight: 600, mb: 1 }}>
                    Всего платежей
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: typography.metric,
                      fontWeight: 800,
                      color: colors.text,
                      lineHeight: 1.05,
                      letterSpacing: '-0.02em',
                      mb: 0.75,
                    }}
                  >
                    {payments.length}
                  </Typography>
                  <Typography sx={{ fontSize: typography.hint, color: colors.textHint }}>
                    {payments.length === 0
                      ? 'Общая сумма платежей'
                      : `Общая сумма: ${RUB.format(totalAmount)}`}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: '12px',
                    bgcolor: '#E8F0FF',
                    color: colors.primary,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <PaymentsOutlined sx={{ fontSize: 24 }} />
                </Box>
              </Box>
            </Box>

            <Box sx={{ ...cardSx, p: { xs: 2, md: 2.5 } }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: typography.label, color: colors.textMuted, fontWeight: 600, mb: 1 }}>
                    Последний платеж
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: typography.metric,
                      fontWeight: 800,
                      color: colors.text,
                      lineHeight: 1.05,
                      letterSpacing: '-0.02em',
                      mb: 0.75,
                    }}
                  >
                    {lastPayment ? RUB.format(Number(lastPayment.amount) || 0) : '—'}
                  </Typography>
                  <Typography sx={{ fontSize: typography.hint, color: colors.textHint }}>
                    {lastPayment
                      ? `${typeLabel(lastPayment)} · ${formatDate(lastPayment.paidAt || lastPayment.createdAt)}`
                      : 'Здесь появится информация о вашем последнем платеже'}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: '12px',
                    bgcolor: '#F0E8FF',
                    color: '#8A48D7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <CalendarMonthOutlined sx={{ fontSize: 24 }} />
                </Box>
              </Box>
            </Box>
          </Box>

          <Box sx={{ ...cardSx, p: { xs: 2, md: 2.5 } }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: { xs: 'stretch', md: 'center' },
                justifyContent: 'space-between',
                gap: 1.5,
                flexDirection: { xs: 'column', md: 'row' },
                mb: 2,
              }}
            >
              <Typography sx={{ fontWeight: 800, fontSize: typography.panelTitle, color: colors.text }}>
                Мои платежи
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 1,
                  width: { xs: '100%', md: 'auto' },
                }}
              >
                <FormControl size="small">
                  <Select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    sx={filterSelectSx}
                  >
                    <MenuItem value="all">Все типы</MenuItem>
                    <MenuItem value="membership">Абонемент</MenuItem>
                    <MenuItem value="monthly">Ежемесячный</MenuItem>
                    <MenuItem value="monthly_payment">Ежемесячный платёж</MenuItem>
                    <MenuItem value="single">Разовое</MenuItem>
                    <MenuItem value="fine">Штраф</MenuItem>
                    <MenuItem value="other">Другое</MenuItem>
                    <MenuItem value="membership_writeoff">Списание абонемента</MenuItem>
                  </Select>
                </FormControl>
                <FormControl size="small">
                  <Select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    sx={filterSelectSx}
                  >
                    <MenuItem value="all">Все статусы</MenuItem>
                    {Object.entries(STATUS_LABELS).map(([k, v]) => (
                      <MenuItem key={k} value={k}>
                        {v}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl size="small">
                  <Select
                    value={periodFilter}
                    onChange={(e) => setPeriodFilter(e.target.value as PeriodFilter)}
                    sx={filterSelectSx}
                    startAdornment={
                      <CalendarMonthOutlined sx={{ fontSize: 18, color: colors.textHint, ml: 1, mr: 0.5 }} />
                    }
                  >
                    <MenuItem value="all">За все время</MenuItem>
                    <MenuItem value="30d">За 30 дней</MenuItem>
                    <MenuItem value="90d">За 90 дней</MenuItem>
                    <MenuItem value="year">За год</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            </Box>

            {filtered.length === 0 ? (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  py: { xs: 4, md: 5 },
                  px: 2,
                }}
              >
                <Box
                  aria-hidden
                  sx={{
                    position: 'relative',
                    width: 88,
                    height: 88,
                    mb: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Box
                    sx={{
                      width: 72,
                      height: 72,
                      borderRadius: '18px',
                      bgcolor: '#E8F0FF',
                      color: colors.primary,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <ReceiptLongOutlined sx={{ fontSize: 36 }} />
                  </Box>
                  <Box
                    sx={{
                      position: 'absolute',
                      right: 0,
                      bottom: 4,
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      bgcolor: colors.danger,
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: 14,
                      boxShadow: '0 4px 10px rgba(249, 60, 101, 0.35)',
                    }}
                  >
                    ✕
                  </Box>
                </Box>
                <Typography sx={{ fontWeight: 800, fontSize: typography.label, color: colors.text, mb: 0.5 }}>
                  У вас пока нет платежей
                </Typography>
                <Typography
                  sx={{ fontSize: typography.hint, color: colors.textMuted, mb: 2.5, maxWidth: 420 }}
                >
                  Когда вы оплатите занятия, абонементы или другие услуги, они появятся здесь.
                </Typography>
                <PayNowButton onClick={handleTopPay} />
              </Box>
            ) : (
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
                    {filtered.map((p) => {
                      const canPay = p.status === 'pending' || p.status === 'overdue';
                      return (
                        <TableRow key={p.id} hover>
                          <TableCell>{formatDate(p.paidAt || p.createdAt)}</TableCell>
                          <TableCell>{typeLabel(p)}</TableCell>
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
                            {[p.groupName, p.membershipName, p.branchName].filter(Boolean).join(' · ') ||
                              '—'}
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
            )}
          </Box>
        </>
      )}

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
    </Box>
  );
};

export default ClientPaymentsPanel;
