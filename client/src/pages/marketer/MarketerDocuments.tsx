import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Link,
  Typography,
} from '@mui/material';
import { Download, DescriptionOutlined, VisibilityOutlined } from '@mui/icons-material';
import { apiService } from '../../services/api';
import MarketerActPdfDialog from '../../components/marketer/MarketerActPdfDialog';
import { colors, typography } from '../../theme/tokens';

const cardSx = {
  bgcolor: colors.card,
  borderRadius: '12px',
  border: '1px solid #e6edf5',
  boxShadow: '0 5px 20px rgba(29,59,105,.025)',
} as const;

const money = (n: number) =>
  new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(n || 0);

const STATUS_LABEL: Record<string, string> = {
  AWAITING_SIGNATURE: 'Ожидает подписи',
  PROCESSING: 'В обработке',
  PAID: 'Выплачено',
  REJECTED: 'Отклонено',
  CANCELLED: 'Отменено',
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
  signedAt?: string | null;
  document?: {
    title?: string;
    signedAt?: string | null;
    hasSignedCopy?: boolean;
  } | null;
  npdReceipt?: { originalName?: string | null; uploadedAt?: string } | null;
};

type LegalPackDoc = { key: string; title: string; url: string; onboarding: boolean };

const MarketerDocuments: React.FC = () => {
  const [closingDocs, setClosingDocs] = useState<ClosingDoc[]>([]);
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [legalPack, setLegalPack] = useState<LegalPackDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actViewer, setActViewer] = useState<{
    payoutId: string;
    title?: string;
    signed?: boolean;
  } | null>(null);

  const loadActBlob = useCallback(async () => {
    if (!actViewer) throw new Error('Нет документа');
    return apiService.downloadMarketerPayoutDocumentBlob(actViewer.payoutId, 'auto');
  }, [actViewer]);

  const reload = useCallback(async () => {
    const [finance, docs, legal] = await Promise.all([
      apiService.getMarketerFinance(),
      apiService.getMarketerClosingDocs().catch(() => []),
      apiService.getPublicMarketerLegalDocs().catch(() => ({ documents: [] as LegalPackDoc[] })),
    ]);
    setPayouts(finance?.payouts || []);
    setClosingDocs(docs || []);
    setLegalPack(legal?.documents || []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError('');
        await reload();
      } catch (e: any) {
        if (!cancelled) setError(e?.response?.data?.error || 'Не удалось загрузить документы');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const downloadAct = async (id: string, title?: string) => {
    try {
      const blob = await apiService.downloadMarketerPayoutDocumentBlob(id);
      const { downloadBlob } = await import('../../capacitor/nativeDownload');
      await downloadBlob(blob, `${title || 'act'}.pdf`);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось скачать акт');
    }
  };

  const downloadNpd = async (id: string, name?: string | null) => {
    try {
      const blob = await apiService.downloadMarketerNpdReceiptBlob(id);
      const { downloadBlob } = await import('../../capacitor/nativeDownload');
      await downloadBlob(blob, name || 'npd-receipt.pdf');
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось скачать чек НПД');
    }
  };

  const downloadClosing = async (id: string, title: string) => {
    try {
      const blob = await apiService.downloadMarketerClosingDocBlob(id);
      const { downloadBlob } = await import('../../capacitor/nativeDownload');
      await downloadBlob(blob, `${title || 'document'}.pdf`);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось скачать документ');
    }
  };

  const openPersonalLegal = async (key: string, title: string) => {
    try {
      const blob = await apiService.downloadMarketerLegalDocPersonalBlob(key);
      const { downloadBlob } = await import('../../capacitor/nativeDownload');
      await downloadBlob(blob, `${title || key}.pdf`);
    } catch (e: any) {
      setError(e?.response?.data?.error || `Не удалось открыть «${title}»`);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={6}>
        <CircularProgress />
      </Box>
    );
  }

  const acts = payouts.filter((p) => p.document);
  const receipts = payouts.filter((p) => p.npdReceipt);
  const empty =
    acts.length === 0 &&
    receipts.length === 0 &&
    closingDocs.length === 0 &&
    legalPack.length === 0;

  return (
    <Box sx={{ width: '100%', minWidth: 0, pb: 4 }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Box sx={{ mb: 2.5 }}>
        <Typography
          sx={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', color: colors.primary, mb: 0.75 }}
        >
          ПАРТНЁРСКАЯ ПРОГРАММА / ДОКУМЕНТЫ
        </Typography>
        <Typography sx={{ fontWeight: 800, fontSize: { xs: 24, md: 28 }, color: colors.text }}>
          Документы
        </Typography>
        <Typography sx={{ fontSize: typography.label, color: colors.textMuted, mt: 0.75, maxWidth: 560 }}>
          Юридический пакет, акты выплат, чеки НПД и закрывающие документы.
        </Typography>
      </Box>

      <Box sx={{ ...cardSx, p: { xs: 2, md: 2.5 }, mb: 2 }}>
        <Typography sx={{ fontWeight: 800, mb: 1 }}>Юридический пакет</Typography>
        <Typography sx={{ fontSize: typography.hint, color: colors.textMuted, mb: 1.25 }}>
          Актуальные шаблоны с реквизитами платформы. Персональная копия доступна по кнопке «Моя
          версия».
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {legalPack.map((item) => (
            <Box
              key={item.key}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1,
                flexWrap: 'wrap',
              }}
            >
              <Typography sx={{ fontSize: typography.label, fontWeight: 700 }}>{item.title}</Typography>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Link
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  fontWeight={700}
                  sx={{ fontSize: typography.hint }}
                >
                  PDF →
                </Link>
                <Button
                  size="small"
                  onClick={() => void openPersonalLegal(item.key, item.title)}
                  sx={{ textTransform: 'none', fontWeight: 700, fontSize: typography.hint, minWidth: 0 }}
                >
                  Моя версия
                </Button>
              </Box>
            </Box>
          ))}
          {legalPack.length === 0 && (
            <Typography sx={{ fontSize: typography.hint, color: colors.textMuted }}>
              Пакет пока не загружен
            </Typography>
          )}
        </Box>
      </Box>

      {empty ? (
        <Box sx={{ ...cardSx, p: 4, textAlign: 'center' }}>
          <DescriptionOutlined sx={{ color: colors.textHint, fontSize: 40, mb: 1 }} />
          <Typography sx={{ fontWeight: 700, color: colors.text, mb: 0.5 }}>Документов пока нет</Typography>
          <Typography sx={{ fontSize: typography.hint, color: colors.textMuted }}>
            Акты появятся после создания заявки на вывод.
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          {acts.map((p) => (
            <Box
              key={`act-${p.id}`}
              sx={{
                ...cardSx,
                p: 1.75,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1.5,
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700, fontSize: typography.label }}>
                  {p.document?.title || 'Акт на вывод'}
                </Typography>
                <Typography sx={{ fontSize: typography.hint, color: colors.textMuted }}>
                  {p.document?.hasSignedCopy || p.document?.signedAt || p.signedAt
                    ? 'Подписан'
                    : STATUS_LABEL[p.status] || p.status}{' '}
                  · {money(p.amount)}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 0.75, flexShrink: 0 }}>
                <Button
                  size="small"
                  startIcon={<VisibilityOutlined />}
                  onClick={() =>
                    setActViewer({
                      payoutId: p.id,
                      title: p.document?.title,
                      signed: Boolean(p.document?.hasSignedCopy || p.document?.signedAt || p.signedAt),
                    })
                  }
                  sx={{ textTransform: 'none', fontWeight: 700 }}
                >
                  Смотреть
                </Button>
                <Button
                  size="small"
                  startIcon={<Download />}
                  onClick={() => void downloadAct(p.id, p.document?.title)}
                  sx={{ textTransform: 'none', fontWeight: 700 }}
                >
                  Скачать
                </Button>
              </Box>
            </Box>
          ))}

          {receipts.map((p) => (
            <Box
              key={`npd-${p.id}`}
              sx={{
                ...cardSx,
                p: 1.75,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1.5,
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700, fontSize: typography.label }}>
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
                onClick={() => void downloadNpd(p.id, p.npdReceipt?.originalName)}
                sx={{ textTransform: 'none', fontWeight: 700, flexShrink: 0 }}
              >
                Скачать
              </Button>
            </Box>
          ))}

          {closingDocs.map((d) => (
            <Box
              key={d.id}
              sx={{
                ...cardSx,
                p: 1.75,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1.5,
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700, fontSize: typography.label }}>{d.title}</Typography>
                <Typography sx={{ fontSize: typography.hint, color: colors.textMuted }}>
                  {d.periodLabel ? `${d.periodLabel} · ` : ''}
                  {new Date(d.createdAt).toLocaleDateString('ru-RU')}
                </Typography>
              </Box>
              <Button
                size="small"
                startIcon={<Download />}
                onClick={() => void downloadClosing(d.id, d.title)}
                sx={{ textTransform: 'none', fontWeight: 700, flexShrink: 0 }}
              >
                Скачать
              </Button>
            </Box>
          ))}
        </Box>
      )}

      <MarketerActPdfDialog
        open={Boolean(actViewer)}
        onClose={() => setActViewer(null)}
        title={actViewer?.title || 'Акт на вывод'}
        statusLabel={actViewer?.signed ? 'Подписанная копия' : 'Черновик акта'}
        loadBlob={loadActBlob}
      />
    </Box>
  );
};

export default MarketerDocuments;
