import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Link,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import {
  AccountBalanceOutlined,
  ArrowForward,
  CheckCircleOutline,
  Download,
  EditOutlined,
  InfoOutlined,
  PaymentsOutlined,
  ScheduleOutlined,
  TrendingUpOutlined,
  UploadFileOutlined,
  WalletOutlined,
} from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { apiService } from '../../services/api';
import { colors, typography } from '../../theme/tokens';
import { marketerCardSx, marketerFieldSx, marketerRadii } from './marketerUi';

const money = (n: number, fractionDigits = 0) =>
  new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  }).format(n || 0);

const cardSx = {
  ...marketerCardSx,
  border: '1px solid #EEF1F6',
} as const;

type TabKey = 'accruals' | 'payouts' | 'documents';
type WithdrawStep = 'amount' | 'document' | 'sms' | 'done';

type LedgerItem = {
  id: string;
  kind: string;
  amount: number;
  occurredAt: string;
  schoolLabel?: string | null;
  notes?: string | null;
};

type ClosingDoc = {
  id: string;
  title: string;
  periodLabel?: string | null;
  createdAt: string;
};

type PayoutRequest = {
  id: string;
  amount: number;
  status: string;
  bankAccountMasked?: string;
  bankName?: string;
  signedAt?: string | null;
  paidAt?: string | null;
  dueAt?: string | null;
  dueBusinessDays?: number;
  rejectReason?: string | null;
  createdAt: string;
  document?: { id: string; title: string; signedAt?: string | null } | null;
  npdReceipt?: { id: string; uploadedAt: string; originalName?: string | null } | null;
};

const formatDueDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : null;

const STATUS_LABEL: Record<string, string> = {
  AWAITING_SIGNATURE: 'Ожидает подписи',
  PROCESSING: 'В обработке',
  PAID: 'Выплачено',
  REJECTED: 'Отклонено',
  CANCELLED: 'Отменено',
};

const MetricCard: React.FC<{
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  accent?: string;
}> = ({ label, value, hint, icon, accent = colors.primary }) => (
  <Box sx={{ ...cardSx, p: { xs: 1.5, md: 2.25 }, position: 'relative', overflow: 'hidden', minWidth: 0 }}>
    <Box
      sx={{
        position: 'absolute',
        top: { xs: 10, md: 14 },
        right: { xs: 10, md: 14 },
        width: { xs: 28, md: 40 },
        height: { xs: 28, md: 40 },
        borderRadius: marketerRadii.control,
        bgcolor: `${accent}14`,
        color: accent,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        '& .MuiSvgIcon-root': { fontSize: { xs: 16, md: 20 } },
      }}
    >
      {icon}
    </Box>
    <Typography
      sx={{
        fontSize: { xs: 10, md: typography.hint },
        color: colors.textMuted,
        fontWeight: 600,
        mb: { xs: 1, md: 1.5 },
        pr: { xs: 4, md: 5 },
        lineHeight: 1.35,
      }}
    >
      {label}
    </Typography>
    <Typography
      sx={{
        fontWeight: 800,
        fontSize: { xs: 18, md: 26 },
        color: colors.text,
        letterSpacing: '-0.02em',
        wordBreak: 'break-word',
      }}
    >
      {value}
    </Typography>
    <Typography sx={{ fontSize: { xs: 10, md: typography.hint }, color: colors.textHint, mt: 0.75, lineHeight: 1.35 }}>
      {hint}
    </Typography>
  </Box>
);

const MarketerFinance: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [docs, setDocs] = useState<ClosingDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<TabKey>('accruals');
  const [onboardingComplete, setOnboardingComplete] = useState(true);

  const [bankOpen, setBankOpen] = useState(false);
  const [bankForm, setBankForm] = useState({
    bankName: '',
    bankBik: '',
    bankAccount: '',
    bankRecipient: '',
  });
  const [bankBusy, setBankBusy] = useState(false);

  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawStep, setWithdrawStep] = useState<WithdrawStep>('amount');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawAgree, setWithdrawAgree] = useState(false);
  const [activePayout, setActivePayout] = useState<PayoutRequest | null>(null);
  const [smsCode, setSmsCode] = useState('');
  const [smsHint, setSmsHint] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const npdInputRef = React.useRef<HTMLInputElement | null>(null);
  const [npdUploadPayoutId, setNpdUploadPayoutId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [finance, closingDocs, profile] = await Promise.all([
      apiService.getMarketerFinance(),
      apiService.getMarketerClosingDocs().catch(() => []),
      apiService.getMarketerProfile().catch(() => null),
    ]);
    setData(finance);
    setDocs(closingDocs || []);
    setOnboardingComplete(profile?.onboarding?.complete !== false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError('');
        await reload();
      } catch (e: any) {
        if (!cancelled) setError(e?.response?.data?.error || 'Ошибка загрузки финансов');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const items: LedgerItem[] = data?.items || [];
  const payouts: PayoutRequest[] = data?.payouts || [];
  const accrued = Number(data?.accrued || 0);
  const balance = Number(data?.balance || 0);
  const paidOut = Number(data?.paidOut || 0);
  const inProcess = Number(data?.inProcess || 0);
  const bank = data?.bank;

  const accruals = useMemo(() => items.filter((i) => i.kind === 'ACCRUAL'), [items]);
  const ledgerPayouts = useMemo(() => items.filter((i) => i.kind === 'PAYOUT'), [items]);

  const nearestDueAt = useMemo(() => {
    const dates = payouts
      .filter((p) => p.status === 'PROCESSING' && p.dueAt)
      .map((p) => new Date(p.dueAt!).getTime())
      .filter((t) => Number.isFinite(t));
    if (!dates.length) return null;
    return new Date(Math.min(...dates)).toISOString();
  }, [payouts]);

  const nearestDueLabel = formatDueDate(nearestDueAt) || 'До 7 рабочих дней';

  const docsTabCount =
    docs.length +
    payouts.filter((p) => p.document).length +
    payouts.filter((p) => p.npdReceipt).length;

  const downloadClosingDoc = async (id: string, title: string) => {
    try {
      const blob = await apiService.downloadMarketerClosingDocBlob(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title || 'document'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось скачать документ');
    }
  };

  const downloadPayoutDoc = async (payoutId: string, title?: string) => {
    try {
      const blob = await apiService.downloadMarketerPayoutDocumentBlob(payoutId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title || 'act'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось скачать акт');
    }
  };

  const downloadNpdReceipt = async (payoutId: string, name?: string | null) => {
    try {
      const blob = await apiService.downloadMarketerNpdReceiptBlob(payoutId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name || 'npd-receipt.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось скачать чек НПД');
    }
  };

  const triggerNpdUpload = (payoutId: string) => {
    setNpdUploadPayoutId(payoutId);
    npdInputRef.current?.click();
  };

  const onNpdFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const payoutId = npdUploadPayoutId;
    e.target.value = '';
    setNpdUploadPayoutId(null);
    if (!file || !payoutId) return;
    try {
      setActionBusy(true);
      await apiService.uploadMarketerNpdReceipt(payoutId, file);
      await reload();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Не удалось загрузить чек НПД');
    } finally {
      setActionBusy(false);
    }
  };

  const openWithdraw = (existing?: PayoutRequest) => {
    if (!onboardingComplete && !(existing && existing.status === 'AWAITING_SIGNATURE')) {
      setError('Завершите профиль и онбординг, чтобы вывести средства');
      return;
    }
    setActionError('');
    setSmsCode('');
    setSmsHint('');
    if (existing && existing.status === 'AWAITING_SIGNATURE') {
      setActivePayout(existing);
      setWithdrawAmount(String(existing.amount));
      setWithdrawAgree(false);
      setWithdrawStep('document');
    } else {
      setActivePayout(null);
      setWithdrawAmount(balance > 0 ? String(balance) : '');
      setWithdrawAgree(false);
      setWithdrawStep('amount');
    }
    setWithdrawOpen(true);
  };

  const closeWithdraw = () => {
    setWithdrawOpen(false);
    setActionBusy(false);
    setActionError('');
  };

  const submitAmount = async () => {
    setActionError('');
    const amount = Number(String(withdrawAmount).replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0) {
      setActionError('Укажите сумму');
      return;
    }
    if (amount > balance) {
      setActionError('Сумма превышает доступный баланс');
      return;
    }
    if (!bank?.hasDetails) {
      setActionError('Сначала заполните банковские реквизиты');
      return;
    }
    try {
      setActionBusy(true);
      const payout = await apiService.createMarketerPayout(amount);
      setActivePayout(payout);
      setWithdrawAgree(false);
      setWithdrawStep('document');
      await reload();
    } catch (e: any) {
      setActionError(e?.response?.data?.error || 'Не удалось создать заявку');
    } finally {
      setActionBusy(false);
    }
  };

  const sendCode = async () => {
    if (!activePayout) return;
    if (!withdrawAgree) {
      setActionError('Подтвердите согласие с актом и условиями ПЭП');
      return;
    }
    setActionError('');
    try {
      setActionBusy(true);
      const res = await apiService.sendMarketerPayoutSignCode(activePayout.id);
      setSmsHint(res?.emailMasked ? `Код отправлен (как СМС-подпись) на ${res.emailMasked}` : 'Код отправлен');
      setWithdrawStep('sms');
    } catch (e: any) {
      setActionError(e?.response?.data?.error || 'Не удалось отправить код');
    } finally {
      setActionBusy(false);
    }
  };

  const confirmCode = async () => {
    if (!activePayout) return;
    setActionError('');
    try {
      setActionBusy(true);
      const signed = await apiService.confirmMarketerPayoutSign(activePayout.id, smsCode.trim());
      setActivePayout(signed);
      setWithdrawStep('done');
      await reload();
    } catch (e: any) {
      setActionError(e?.response?.data?.error || 'Неверный код');
    } finally {
      setActionBusy(false);
    }
  };

  const cancelActive = async () => {
    if (!activePayout) return;
    setActionError('');
    try {
      setActionBusy(true);
      await apiService.cancelMarketerPayout(activePayout.id);
      closeWithdraw();
      await reload();
    } catch (e: any) {
      setActionError(e?.response?.data?.error || 'Не удалось отменить');
    } finally {
      setActionBusy(false);
    }
  };

  const saveBank = async () => {
    setActionError('');
    try {
      setBankBusy(true);
      await apiService.updateMarketerBankDetails(bankForm);
      setBankOpen(false);
      await reload();
    } catch (e: any) {
      setActionError(e?.response?.data?.error || 'Не удалось сохранить реквизиты');
    } finally {
      setBankBusy(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={6}>
        <CircularProgress />
      </Box>
    );
  }

  if (error && !data) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (!data) return null;

  return (
    <Box sx={{ width: '100%', minWidth: 0, pb: 4 }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'stretch', sm: 'flex-start' },
          justifyContent: 'space-between',
          gap: 2,
          mb: 2,
        }}
      >
        <Box>
          <Typography
            sx={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.08em',
              color: colors.primary,
              mb: 0.75,
            }}
          >
            ПАРТНЁРСКАЯ ПРОГРАММА / ФИНАНСЫ
          </Typography>
          <Typography sx={{ fontWeight: 800, fontSize: { xs: 24, md: 28 }, color: colors.text, letterSpacing: '-0.02em' }}>
            Финансы и выплаты
          </Typography>
          <Typography sx={{ fontSize: typography.label, color: colors.textMuted, mt: 0.75, maxWidth: 520 }}>
            Следите за начислениями, документами и выводом заработанных средств.
          </Typography>
        </Box>
        <Button
          variant="contained"
          endIcon={<ArrowForward />}
          onClick={() => openWithdraw()}
          disabled={!onboardingComplete}
          sx={{
            textTransform: 'none',
            fontWeight: 800,
            borderRadius: '8px',
            px: 2.5,
            py: 1.25,
            bgcolor: '#2463ed',
            alignSelf: { xs: 'stretch', sm: 'center' },
            '&:hover': { bgcolor: '#124fcf' },
          }}
        >
          Вывести средства
        </Button>
      </Box>

      {!onboardingComplete && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Вывод средств доступен после заполнения профиля и принятия документов.{' '}
          <Link component={RouterLink} to="/marketer/onboarding" fontWeight={700}>
            Перейти к подключению
          </Link>
        </Alert>
      )}

      <Box
        sx={{
          ...cardSx,
          p: { xs: 2, md: 2.25 },
          mb: 2.5,
          display: 'flex',
          gap: 1.5,
          alignItems: 'flex-start',
          bgcolor: '#EEF4FF',
          borderColor: colors.primarySoft,
        }}
      >
        <InfoOutlined sx={{ color: colors.primary, mt: 0.25, flexShrink: 0 }} />
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: typography.label, color: colors.text, mb: 0.5 }}>
            Вы можете запросить вывод заработанных средств в любое время. Выплата производится в течение 7 рабочих дней
            после подписания закрывающих документов.
          </Typography>
          <Typography sx={{ fontSize: typography.hint, color: colors.textMuted, lineHeight: 1.55 }}>
            Закрывающие документы подписываются дистанционно с помощью одноразового СМС-кода в соответствии с условиями
            договора-оферты и соглашения об электронной подписи.
          </Typography>
        </Box>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, 1fr)' },
          gap: { xs: 1.25, md: 2 },
          mb: 2.5,
        }}
      >
        <MetricCard
          label="Заработано за всё время"
          value={money(accrued)}
          hint="Личные + реферальные начисления"
          icon={<TrendingUpOutlined fontSize="small" />}
          accent={colors.primary}
        />
        <MetricCard
          label="Доступно к выводу"
          value={money(balance)}
          hint="Можно запросить сейчас"
          icon={<WalletOutlined fontSize="small" />}
          accent={colors.success}
        />
        <MetricCard
          label="В обработке"
          value={money(inProcess)}
          hint={inProcess > 0 ? 'Подписанные и ожидающие заявки' : 'Нет активных заявок'}
          icon={<ScheduleOutlined fontSize="small" />}
          accent={colors.primaryDark}
        />
        <MetricCard
          label="Уже выплачено"
          value={money(paidOut)}
          hint="Переведено на счёт"
          icon={<CheckCircleOutline fontSize="small" />}
          accent="#E67E22"
        />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1.2fr 1fr' },
          gap: 2,
          mb: 2.5,
        }}
      >
        <Box sx={{ ...cardSx, p: { xs: 2.25, md: 2.75 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
            <Box
              sx={{
                width: 42,
                height: 42,
                borderRadius: '12px',
                bgcolor: '#E8F0FF',
                color: colors.primary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <WalletOutlined />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 800, color: colors.text }}>Мой баланс</Typography>
              <Typography sx={{ fontSize: typography.hint, color: colors.textMuted }}>
                Свободные для вывода начисления
              </Typography>
            </Box>
          </Box>
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              gap: 2,
              mb: 2.5,
            }}
          >
            <Box>
              <Typography sx={{ fontSize: typography.hint, color: colors.textMuted, mb: 0.5 }}>
                Доступная сумма
              </Typography>
              <Typography sx={{ fontWeight: 800, fontSize: { xs: 28, md: 34 }, color: colors.text }}>
                {money(balance, 2)}
              </Typography>
            </Box>
            <Box sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
              <Typography sx={{ fontSize: typography.hint, color: colors.textMuted }}>Ближайший срок выплаты</Typography>
              <Typography sx={{ fontWeight: 700, color: colors.text }}>{nearestDueLabel}</Typography>
            </Box>
          </Box>
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              flexWrap: 'wrap',
              gap: 1.25,
              mb: 2,
            }}
          >
            <Button
              variant="contained"
              endIcon={<ArrowForward />}
              onClick={() => openWithdraw()}
              disabled={!onboardingComplete}
              sx={{
                textTransform: 'none',
                fontWeight: 800,
                borderRadius: '8px',
                bgcolor: colors.primary,
                width: { xs: '100%', sm: 'auto' },
                '&:hover': { bgcolor: colors.primaryDark },
              }}
            >
              Вывести средства
            </Button>
            <Button
              variant="outlined"
              onClick={() => setTab('payouts')}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                borderRadius: '8px',
                width: { xs: '100%', sm: 'auto' },
              }}
            >
              История выплат
            </Button>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', color: colors.textMuted }}>
            <InfoOutlined sx={{ fontSize: 18, mt: 0.15, flexShrink: 0 }} />
            <Typography sx={{ fontSize: typography.hint, lineHeight: 1.5 }}>
              Для перечисления необходимо подписать закрывающие документы по СМС.
            </Typography>
          </Box>
        </Box>

        <Box sx={{ ...cardSx, p: { xs: 2.25, md: 2.75 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
            <Box
              sx={{
                width: 42,
                height: 42,
                borderRadius: '12px',
                bgcolor: '#E8F0FF',
                color: colors.primary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AccountBalanceOutlined />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 800, color: colors.text }}>Куда поступают выплаты</Typography>
              <Typography sx={{ fontSize: typography.hint, color: colors.textMuted }}>
                Банковские реквизиты получателя
              </Typography>
            </Box>
            <Button
              size="small"
              startIcon={<EditOutlined />}
              onClick={() => {
                setActionError('');
                setBankForm({
                  bankName: bank?.bankName || '',
                  bankBik: bank?.bankBik || '',
                  bankAccount: '',
                  bankRecipient: bank?.bankRecipient || '',
                });
                setBankOpen(true);
              }}
              sx={{ textTransform: 'none', fontWeight: 700, flexShrink: 0 }}
            >
              {bank?.hasDetails ? 'Изменить' : 'Добавить'}
            </Button>
          </Box>
          {bank?.hasDetails ? (
            <Box
              sx={{
                bgcolor: colors.surface,
                borderRadius: '8px',
                border: '1px solid #EEF1F6',
                p: 2,
              }}
            >
              <Typography sx={{ fontWeight: 700, fontSize: typography.label, color: colors.text }}>
                {bank.bankName} · {bank.bankAccountMasked}
              </Typography>
              <Typography sx={{ fontSize: typography.hint, color: colors.textMuted, mt: 0.5 }}>
                БИК {bank.bankBik} · {bank.bankRecipient}
              </Typography>
            </Box>
          ) : (
            <Box
              sx={{
                bgcolor: colors.surface,
                borderRadius: '8px',
                border: '1px dashed #D5DCE8',
                p: 2.5,
                textAlign: 'center',
              }}
            >
              <PaymentsOutlined sx={{ color: colors.textHint, mb: 1 }} />
              <Typography sx={{ fontWeight: 700, fontSize: typography.label, color: colors.text, mb: 0.75 }}>
                Реквизиты не указаны
              </Typography>
              <Typography sx={{ fontSize: typography.hint, color: colors.textMuted, lineHeight: 1.5 }}>
                Добавьте банковские реквизиты перед запросом вывода.
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '1.55fr 1fr' },
          gap: 2,
          alignItems: 'start',
        }}
      >
        <Box sx={{ ...cardSx, p: { xs: 2, md: 2.5 }, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 18, color: colors.text, mb: 0.5 }}>
            История операций
          </Typography>
          <Typography sx={{ fontSize: typography.hint, color: colors.textMuted, mb: 2 }}>
            Начисления, выплаты и закрывающие документы
            {data.commissionPercentage != null ? ` · комиссия ${data.commissionPercentage}%` : ''}
          </Typography>
          <Tabs
            value={tab}
            onChange={(_, v: TabKey) => setTab(v)}
            variant="scrollable"
            allowScrollButtonsMobile
            sx={{
              mb: 2,
              minHeight: 40,
              '& .MuiTab-root': {
                textTransform: 'none',
                fontWeight: 700,
                minHeight: 40,
                fontSize: typography.label,
              },
            }}
          >
            <Tab value="accruals" label={`Начисления (${accruals.length})`} />
            <Tab value="payouts" label={`Выплаты (${payouts.length || ledgerPayouts.length})`} />
            <Tab value="documents" label={`Документы (${docsTabCount})`} />
          </Tabs>

          <input
            ref={npdInputRef}
            type="file"
            accept=".pdf,image/*,.jpg,.jpeg,.png,.webp"
            hidden
            onChange={(e) => void onNpdFileSelected(e)}
          />

          {tab === 'accruals' && (
            <LedgerList
              empty="Пока нет начислений"
              rows={accruals.map((i) => ({
                id: i.id,
                title: i.schoolLabel || 'Начисление',
                subtitle: i.notes || 'Комиссия',
                date: i.occurredAt,
                amount: i.amount,
                positive: true,
              }))}
            />
          )}
          {tab === 'payouts' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              {payouts.length === 0 && ledgerPayouts.length === 0 ? (
                <Typography sx={{ color: colors.textMuted, fontSize: typography.label, py: 3, textAlign: 'center' }}>
                  Пока нет выплат
                </Typography>
              ) : (
                <>
                  {payouts.map((p) => (
                    <Box
                      key={p.id}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 1.5,
                        p: 1.5,
                        borderRadius: '8px',
                        bgcolor: colors.surface,
                        border: '1px solid #EEF1F6',
                      }}
                    >
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography sx={{ fontWeight: 700, fontSize: typography.label, color: colors.text }}>
                          Заявка на вывод
                        </Typography>
                        <Typography sx={{ fontSize: typography.hint, color: colors.textMuted }}>
                          {new Date(p.createdAt).toLocaleString('ru-RU')}
                          {p.bankAccountMasked ? ` · ${p.bankAccountMasked}` : ''}
                          {p.status === 'PROCESSING' && p.dueAt
                            ? ` · срок до ${formatDueDate(p.dueAt)}`
                            : ''}
                        </Typography>
                        {p.status === 'PAID' && (
                          <Box sx={{ mt: 0.75 }}>
                            {p.npdReceipt ? (
                              <Button
                                size="small"
                                startIcon={<Download />}
                                onClick={() => void downloadNpdReceipt(p.id, p.npdReceipt?.originalName)}
                                sx={{ textTransform: 'none', fontWeight: 700, px: 0 }}
                              >
                                Скачать чек НПД
                              </Button>
                            ) : (
                              <Button
                                size="small"
                                startIcon={<UploadFileOutlined />}
                                disabled={actionBusy}
                                onClick={() => triggerNpdUpload(p.id)}
                                sx={{ textTransform: 'none', fontWeight: 700, px: 0 }}
                              >
                                Загрузить чек НПД
                              </Button>
                            )}
                          </Box>
                        )}
                      </Box>
                      <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                        <Typography sx={{ fontWeight: 800, fontSize: typography.label }}>{money(p.amount)}</Typography>
                        <Chip
                          size="small"
                          label={STATUS_LABEL[p.status] || p.status}
                          onClick={
                            p.status === 'AWAITING_SIGNATURE' ? () => openWithdraw(p) : undefined
                          }
                          sx={{
                            mt: 0.5,
                            height: 22,
                            fontWeight: 700,
                            fontSize: 11,
                            cursor: p.status === 'AWAITING_SIGNATURE' ? 'pointer' : 'default',
                          }}
                        />
                      </Box>
                    </Box>
                  ))}
                  {ledgerPayouts.map((i) => (
                    <Box
                      key={i.id}
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 1.5,
                        p: 1.5,
                        borderRadius: '8px',
                        bgcolor: colors.surface,
                        border: '1px solid #EEF1F6',
                      }}
                    >
                      <Box>
                        <Typography sx={{ fontWeight: 700, fontSize: typography.label }}>Выплата</Typography>
                        <Typography sx={{ fontSize: typography.hint, color: colors.textMuted }}>
                          {new Date(i.occurredAt).toLocaleString('ru-RU')}
                          {i.notes ? ` · ${i.notes}` : ''}
                        </Typography>
                      </Box>
                      <Typography sx={{ fontWeight: 800 }}>−{money(Math.abs(i.amount))}</Typography>
                    </Box>
                  ))}
                </>
              )}
            </Box>
          )}
          {tab === 'documents' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: '8px',
                  bgcolor: '#EEF4FF',
                  border: `1px solid ${colors.primarySoft}`,
                  mb: 0.5,
                }}
              >
                <Typography sx={{ fontSize: typography.hint, color: colors.textMuted, lineHeight: 1.5 }}>
                  Порядок выплат и чеков НПД —{' '}
                  <Link href="/api/legal/marketer/npdPayouts" target="_blank" rel="noopener noreferrer" fontWeight={700}>
                    открыть PDF
                  </Link>
                </Typography>
              </Box>
              {docsTabCount === 0 ? (
                <Typography sx={{ color: colors.textMuted, fontSize: typography.label, py: 3, textAlign: 'center' }}>
                  Документов пока нет
                </Typography>
              ) : (
                <>
                  {payouts
                    .filter((p) => p.document)
                    .map((p) => (
                      <Box
                        key={`pdoc-${p.id}`}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 1.5,
                          p: 1.5,
                          borderRadius: '8px',
                          bgcolor: colors.surface,
                          border: '1px solid #EEF1F6',
                        }}
                      >
                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{ fontWeight: 700, fontSize: typography.label, color: colors.text }}>
                            {p.document?.title || 'Акт на вывод'}
                          </Typography>
                          <Typography sx={{ fontSize: typography.hint, color: colors.textMuted }}>
                            {STATUS_LABEL[p.status] || p.status} · {money(p.amount)}
                          </Typography>
                        </Box>
                        <Button
                          size="small"
                          startIcon={<Download />}
                          onClick={() => void downloadPayoutDoc(p.id, p.document?.title)}
                          sx={{ textTransform: 'none', fontWeight: 700, flexShrink: 0 }}
                        >
                          Скачать
                        </Button>
                      </Box>
                    ))}
                  {payouts
                    .filter((p) => p.npdReceipt)
                    .map((p) => (
                      <Box
                        key={`npd-${p.id}`}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 1.5,
                          p: 1.5,
                          borderRadius: '8px',
                          bgcolor: colors.surface,
                          border: '1px solid #EEF1F6',
                        }}
                      >
                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{ fontWeight: 700, fontSize: typography.label, color: colors.text }}>
                            Чек НПД · {money(p.amount)}
                          </Typography>
                          <Typography sx={{ fontSize: typography.hint, color: colors.textMuted }}>
                            {p.npdReceipt?.originalName || 'Чек'}
                            {p.npdReceipt?.uploadedAt
                              ? ` · ${new Date(p.npdReceipt.uploadedAt).toLocaleDateString('ru-RU')}`
                              : ''}
                          </Typography>
                        </Box>
                        <Button
                          size="small"
                          startIcon={<Download />}
                          onClick={() => void downloadNpdReceipt(p.id, p.npdReceipt?.originalName)}
                          sx={{ textTransform: 'none', fontWeight: 700, flexShrink: 0 }}
                        >
                          Скачать
                        </Button>
                      </Box>
                    ))}
                  {docs.map((d) => (
                    <Box
                      key={d.id}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 1.5,
                        p: 1.5,
                        borderRadius: '8px',
                        bgcolor: colors.surface,
                        border: '1px solid #EEF1F6',
                      }}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 700, fontSize: typography.label, color: colors.text }}>
                          {d.title}
                        </Typography>
                        <Typography sx={{ fontSize: typography.hint, color: colors.textMuted }}>
                          {d.periodLabel ? `${d.periodLabel} · ` : ''}
                          {new Date(d.createdAt).toLocaleDateString('ru-RU')}
                        </Typography>
                      </Box>
                      <Button
                        size="small"
                        startIcon={<Download />}
                        onClick={() => void downloadClosingDoc(d.id, d.title)}
                        sx={{ textTransform: 'none', fontWeight: 700, flexShrink: 0 }}
                      >
                        Скачать
                      </Button>
                    </Box>
                  ))}
                </>
              )}
            </Box>
          )}
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ ...cardSx, p: { xs: 2.25, md: 2.5 } }}>
            <Typography sx={{ fontWeight: 800, fontSize: 18, color: colors.text, mb: 0.5 }}>
              Как получить выплату
            </Typography>
            <Typography sx={{ fontSize: typography.hint, color: colors.textMuted, mb: 2.5 }}>
              Всё прозрачно — три простых шага
            </Typography>
            {[
              {
                n: '1',
                title: 'Укажите сумму и счёт',
                text: 'Выберите любую сумму в пределах доступного баланса. Реквизиты можно изменить перед выводом.',
              },
              {
                n: '2',
                title: 'Подпишите закрывающие документы',
                text: 'Ознакомьтесь с документом и подтвердите подписание одноразовым СМС-кодом.',
              },
              {
                n: '3',
                title: 'Получите деньги на свой счёт',
                text: 'После успешного подписания заявка переходит в обработку. Срок выплаты — до 7 рабочих дней.',
              },
            ].map((step) => (
              <Box key={step.n} sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
                <Box
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    bgcolor: colors.primary,
                    color: colors.white,
                    fontWeight: 800,
                    fontSize: 13,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {step.n}
                </Box>
                <Box>
                  <Typography sx={{ fontWeight: 800, fontSize: typography.label, color: colors.text, mb: 0.35 }}>
                    {step.title}
                  </Typography>
                  <Typography sx={{ fontSize: typography.hint, color: colors.textMuted, lineHeight: 1.5 }}>
                    {step.text}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>

          <Box
            sx={{
              ...cardSx,
              p: { xs: 2.25, md: 2.5 },
              bgcolor: '#EEF4FF',
              borderColor: colors.primarySoft,
            }}
          >
            <Typography sx={{ fontWeight: 800, fontSize: typography.label, color: colors.text, mb: 1 }}>
              Документы и статус самозанятого
            </Typography>
            <Typography sx={{ fontSize: typography.hint, color: colors.textMuted, lineHeight: 1.55, mb: 1 }}>
              После получения оплаты самозанятый обязан сформировать чек в приложении «Мой налог». Подписанный акт не
              заменяет чек НПД. Закрывающие документы подписываются одноразовым СМС-кодом по условиям оферты и соглашения
              о простой электронной подписи.
            </Typography>
            <Link href="/api/legal/marketer/npdPayouts" target="_blank" rel="noopener noreferrer" fontWeight={700} sx={{ fontSize: typography.hint }}>
              Порядок выплат и чеков НПД (PDF)
            </Link>
          </Box>
        </Box>
      </Box>

      {/* Bank details */}
      <Dialog
        open={bankOpen}
        onClose={() => !bankBusy && setBankOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: marketerRadii.dialog } }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Банковские реквизиты</DialogTitle>
        <DialogContent
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            pt: '12px !important',
          }}
        >
          {actionError && <Alert severity="error" sx={{ borderRadius: marketerRadii.control }}>{actionError}</Alert>}
          <TextField
            label="Банк"
            value={bankForm.bankName}
            onChange={(e) => setBankForm((s) => ({ ...s, bankName: e.target.value }))}
            fullWidth
            InputLabelProps={{ shrink: true }}
            sx={marketerFieldSx}
          />
          <TextField
            label="БИК"
            value={bankForm.bankBik}
            onChange={(e) => setBankForm((s) => ({ ...s, bankBik: e.target.value.replace(/\D/g, '').slice(0, 9) }))}
            fullWidth
            inputProps={{ inputMode: 'numeric' }}
            InputLabelProps={{ shrink: true }}
            sx={marketerFieldSx}
          />
          <TextField
            label="Расчётный счёт"
            value={bankForm.bankAccount}
            onChange={(e) =>
              setBankForm((s) => ({ ...s, bankAccount: e.target.value.replace(/\D/g, '').slice(0, 20) }))
            }
            fullWidth
            helperText={bank?.bankAccountMasked ? `Сейчас: ${bank.bankAccountMasked}` : undefined}
            inputProps={{ inputMode: 'numeric' }}
            InputLabelProps={{ shrink: true }}
            sx={marketerFieldSx}
          />
          <TextField
            label="Получатель"
            value={bankForm.bankRecipient}
            onChange={(e) => setBankForm((s) => ({ ...s, bankRecipient: e.target.value }))}
            fullWidth
            InputLabelProps={{ shrink: true }}
            sx={marketerFieldSx}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBankOpen(false)} disabled={bankBusy} sx={{ textTransform: 'none' }}>
            Отмена
          </Button>
          <Button
            variant="contained"
            onClick={() => void saveBank()}
            disabled={bankBusy}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            {bankBusy ? 'Сохранение…' : 'Сохранить'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Withdraw flow */}
      <Dialog
        open={withdrawOpen}
        onClose={() => !actionBusy && closeWithdraw()}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: marketerRadii.dialog } }}
      >
        <DialogTitle sx={{ fontWeight: 800, pb: 1 }}>
          {withdrawStep === 'amount' && 'Шаг 1 из 3 · Сводка'}
          {withdrawStep === 'document' && 'Шаг 2 из 3 · Подписание акта'}
          {withdrawStep === 'sms' && 'Шаг 3 из 3 · Код подтверждения'}
          {withdrawStep === 'done' && 'Заявка принята'}
        </DialogTitle>
        <DialogContent>
          {actionError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {actionError}
            </Alert>
          )}

          {withdrawStep === 'amount' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              <Box
                sx={{
                  bgcolor: colors.surface,
                  border: '1px solid #EEF1F6',
                  borderRadius: '8px',
                  p: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1,
                }}
              >
                <Typography sx={{ fontSize: typography.hint, color: colors.textMuted }}>Доступно к выводу</Typography>
                <Typography sx={{ fontWeight: 800, fontSize: 22 }}>{money(balance, 2)}</Typography>
                <Typography sx={{ fontSize: typography.hint, color: colors.textMuted }}>
                  Счёт: {bank?.bankAccountMasked || 'не указан'}
                  {bank?.bankName ? ` · ${bank.bankName}` : ''}
                </Typography>
                <Typography sx={{ fontSize: typography.hint, color: colors.textMuted }}>
                  Срок выплаты: до 7 рабочих дней после подписи акта
                </Typography>
              </Box>
              {!bank?.hasDetails && (
                <Alert severity="warning">
                  Сначала укажите банковские реквизиты.{' '}
                  <Button size="small" onClick={() => { closeWithdraw(); setBankOpen(true); }}>
                    Добавить
                  </Button>
                </Alert>
              )}
              <TextField
                label="Сумма вывода"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                fullWidth
                inputProps={{ inputMode: 'decimal' }}
                InputLabelProps={{ shrink: true }}
                sx={marketerFieldSx}
              />
            </Box>
          )}

          {withdrawStep === 'document' && activePayout && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              <Typography sx={{ fontSize: typography.label, color: colors.textMuted }}>
                Ознакомьтесь с актом на сумму <b>{money(activePayout.amount, 2)}</b> и подтвердите согласие перед
                запросом кода.
              </Typography>
              <Button
                variant="outlined"
                startIcon={<Download />}
                onClick={() => void downloadPayoutDoc(activePayout.id, activePayout.document?.title)}
                sx={{ textTransform: 'none', fontWeight: 700, alignSelf: 'flex-start' }}
              >
                Скачать акт
              </Button>
              <FormControlLabel
                sx={{
                  alignItems: 'flex-start',
                  m: 0,
                  gap: 1,
                  width: '100%',
                  '& .MuiFormControlLabel-label': {
                    fontSize: 13,
                    lineHeight: 1.45,
                    whiteSpace: 'normal',
                  },
                }}
                control={
                  <Checkbox
                    checked={withdrawAgree}
                    onChange={(e) => setWithdrawAgree(e.target.checked)}
                    sx={{ pt: 0.25 }}
                  />
                }
                label="Согласен с текстом акта и подписываю его одноразовым СМС-кодом по условиям оферты и ПЭП"
              />
              <Alert severity="info">
                Код придёт на email профиля; в интерфейсе подпись оформляется как подтверждение по СМС (ПЭП).
              </Alert>
            </Box>
          )}

          {withdrawStep === 'sms' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              {smsHint && <Alert severity="success">{smsHint}</Alert>}
              <TextField
                label="Код из СМС"
                value={smsCode}
                onChange={(e) => setSmsCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                fullWidth
                inputProps={{ inputMode: 'numeric', maxLength: 6 }}
                helperText="6 цифр. Код действует 10 минут."
                InputLabelProps={{ shrink: true }}
                sx={marketerFieldSx}
              />
              <Button
                size="small"
                onClick={() => void sendCode()}
                disabled={actionBusy}
                sx={{ textTransform: 'none', alignSelf: 'flex-start' }}
              >
                Отправить код ещё раз
              </Button>
            </Box>
          )}

          {withdrawStep === 'done' && (
            <Alert severity="success" sx={{ mt: 1 }}>
              Документ подписан. Срок выплаты отсчитывается с момента подписи
              {activePayout?.dueAt
                ? ` — до ${formatDueDate(activePayout.dueAt)}`
                : ' (до 7 рабочих дней)'}.
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, flexWrap: 'wrap', gap: 1 }}>
          {withdrawStep === 'amount' && (
            <>
              <Button onClick={closeWithdraw} disabled={actionBusy} sx={{ textTransform: 'none' }}>
                Отмена
              </Button>
              <Button
                variant="contained"
                onClick={() => void submitAmount()}
                disabled={actionBusy || !bank?.hasDetails}
                sx={{ textTransform: 'none', fontWeight: 700 }}
              >
                {actionBusy ? 'Создание…' : 'Продолжить'}
              </Button>
            </>
          )}
          {withdrawStep === 'document' && (
            <>
              <Button color="inherit" onClick={() => void cancelActive()} disabled={actionBusy} sx={{ textTransform: 'none' }}>
                Отменить заявку
              </Button>
              <Button
                variant="contained"
                onClick={() => void sendCode()}
                disabled={actionBusy || !withdrawAgree}
                sx={{ textTransform: 'none', fontWeight: 700 }}
              >
                {actionBusy ? 'Отправка…' : 'Получить СМС-код'}
              </Button>
            </>
          )}
          {withdrawStep === 'sms' && (
            <>
              <Button onClick={() => setWithdrawStep('document')} disabled={actionBusy} sx={{ textTransform: 'none' }}>
                Назад
              </Button>
              <Button
                variant="contained"
                onClick={() => void confirmCode()}
                disabled={actionBusy || smsCode.length !== 6}
                sx={{ textTransform: 'none', fontWeight: 700 }}
              >
                {actionBusy ? 'Проверка…' : 'Подписать'}
              </Button>
            </>
          )}
          {withdrawStep === 'done' && (
            <Button variant="contained" onClick={closeWithdraw} sx={{ textTransform: 'none', fontWeight: 700 }}>
              Готово
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

const LedgerList: React.FC<{
  empty: string;
  rows: Array<{
    id: string;
    title: string;
    subtitle: string;
    date: string;
    amount: number;
    positive: boolean;
    status?: string;
  }>;
}> = ({ empty, rows }) => {
  if (!rows.length) {
    return (
      <Typography sx={{ color: colors.textMuted, fontSize: typography.label, py: 3, textAlign: 'center' }}>
        {empty}
      </Typography>
    );
  }
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      {rows.map((row) => (
        <Box
          key={row.id}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1.5,
            p: 1.5,
            borderRadius: '8px',
            bgcolor: colors.surface,
            border: '1px solid #EEF1F6',
            minWidth: 0,
          }}
        >
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              sx={{
                fontWeight: 700,
                fontSize: typography.label,
                color: colors.text,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {row.title}
            </Typography>
            <Typography sx={{ fontSize: typography.hint, color: colors.textMuted }}>
              {new Date(row.date).toLocaleString('ru-RU')}
              {row.subtitle ? ` · ${row.subtitle}` : ''}
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
            <Typography
              sx={{
                fontWeight: 800,
                fontSize: typography.label,
                color: row.positive ? colors.success : colors.text,
              }}
            >
              {row.positive ? '+' : '−'}
              {money(Math.abs(row.amount))}
            </Typography>
            {row.status && (
              <Chip
                size="small"
                label={row.status}
                sx={{
                  mt: 0.5,
                  height: 22,
                  fontWeight: 700,
                  fontSize: 11,
                  bgcolor: 'rgba(0, 182, 155, 0.12)',
                  color: colors.success,
                }}
              />
            )}
          </Box>
        </Box>
      ))}
    </Box>
  );
};

export default MarketerFinance;
