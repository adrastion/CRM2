import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  LinearProgress,
  Typography,
} from '@mui/material';
import { InfoOutlined, ScheduleOutlined, WarningAmberOutlined } from '@mui/icons-material';
import { apiService } from '../../services/api';
import { colors, typography } from '../../theme/tokens';

const cardSx = {
  bgcolor: colors.card,
  borderRadius: '12px',
  border: '1px solid #EEF1F6',
  boxShadow: '0 4px 18px rgba(32, 34, 36, 0.06)',
} as const;

const STATUS_LABEL: Record<string, string> = {
  OPEN: 'Текущий',
  PASSED: 'Выполнен',
  FAILED: 'Не выполнен',
};

const STATE_CHIP: Record<string, { label: string; color: string; bg: string }> = {
  at_risk: { label: 'Под риском', color: '#B45309', bg: '#FEF3C7' },
  counts: { label: 'Учитывается', color: colors.success, bg: 'rgba(0,182,155,0.12)' },
  lost: { label: 'Право утрачено', color: colors.danger, bg: 'rgba(249,60,101,0.1)' },
  linked: { label: 'Закреплён', color: colors.textMuted, bg: colors.surface },
};

const MarketerActivity: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await apiService.getMarketerActivity();
        if (!cancelled) setData(res);
      } catch (e: any) {
        if (!cancelled) setError(e?.response?.data?.error || 'Не удалось загрузить активность');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={6}>
        <CircularProgress />
      </Box>
    );
  }
  if (error && !data) return <Alert severity="error">{error}</Alert>;
  if (!data) return null;

  const cur = data.current || {};
  const metrics = data.metrics || {};
  const progress = Math.min(100, ((cur.qualifiedCount || 0) / Math.max(1, cur.targetCount || 3)) * 100);
  const periodLabel = `${new Date(cur.startsAt).toLocaleDateString('ru-RU')} — ${new Date(
    cur.endsAt
  ).toLocaleDateString('ru-RU')}`;

  return (
    <Box sx={{ width: '100%', minWidth: 0, pb: 4 }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Box mb={2.5}>
        <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', color: colors.primary, mb: 0.75 }}>
          ПАРТНЁРСКАЯ ПРОГРАММА / АКТИВНОСТЬ
        </Typography>
        <Typography sx={{ fontWeight: 800, fontSize: { xs: 24, md: 28 }, color: colors.text }}>
          Моя активность
        </Typography>
        <Typography sx={{ fontSize: typography.label, color: colors.textMuted, mt: 0.75, maxWidth: 560 }}>
          Нужно привести 3 новые школы с первой оплатой за 90 дней, чтобы сохранить комиссии по ранним клиентам.
        </Typography>
      </Box>

      <Box
        sx={{
          ...cardSx,
          p: { xs: 2, md: 2.75 },
          mb: 2.5,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1.2fr 1fr 0.9fr' },
          gap: 2.5,
          bgcolor: 'linear-gradient(115deg,#fff 20%,#f7faff 100%)',
          background: 'linear-gradient(115deg,#fff 20%,#f7faff 100%)',
          borderColor: colors.primarySoft,
        }}
      >
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: '10px',
                bgcolor: '#EAF2FF',
                color: colors.primary,
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <ScheduleOutlined fontSize="small" />
            </Box>
            <Typography fontWeight={800}>Текущий период</Typography>
          </Box>
          <Typography sx={{ fontSize: typography.hint, color: colors.textMuted, mb: 1.5 }}>
            Период: <b style={{ color: colors.text }}>{periodLabel}</b>
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', mb: 1 }}>
            <Typography sx={{ fontWeight: 800, fontSize: 31, letterSpacing: '-0.04em', lineHeight: 1 }}>
              {cur.qualifiedCount || 0}
              <Typography component="span" sx={{ fontWeight: 600, fontSize: 17, color: colors.textHint, ml: 0.5 }}>
                из {cur.targetCount || 3}
              </Typography>
            </Typography>
            <Typography sx={{ fontSize: typography.hint, fontWeight: 700, color: colors.textMuted }}>
              Первые оплаты
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
              height: 8,
              borderRadius: '4px',
              bgcolor: '#E8EEF8',
              '& .MuiLinearProgress-bar': { bgcolor: colors.primary, borderRadius: '4px' },
            }}
          />
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 1.25,
          }}
        >
          {[
            { label: 'Оплатили в периоде', value: `${metrics.paidThisPeriod || 0}/${metrics.target || 3}` },
            { label: 'Сохраняют начисления', value: String(metrics.keepingRights || 0) },
            { label: 'Первые под риском', value: String(metrics.atRisk || 0) },
            { label: 'Дней до конца', value: String(cur.daysLeft ?? '—') },
          ].map((m) => (
            <Box key={m.label} sx={{ p: 1.5, bgcolor: colors.card, borderRadius: '8px', border: '1px solid #EEF1F6' }}>
              <Typography sx={{ fontSize: 11, color: colors.textMuted, fontWeight: 600 }}>{m.label}</Typography>
              <Typography sx={{ fontWeight: 800, fontSize: 20, mt: 0.5 }}>{m.value}</Typography>
            </Box>
          ))}
        </Box>

        <Box
          sx={{
            borderLeft: { md: '1px solid #E4EBF6' },
            pl: { md: 2.5 },
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 1,
          }}
        >
          <Typography sx={{ fontWeight: 800, fontSize: 28, letterSpacing: '-0.03em' }}>
            {cur.daysLeft ?? 0}
            <Typography component="span" sx={{ fontSize: 14, color: colors.textMuted, ml: 0.75 }}>
              дн.
            </Typography>
          </Typography>
          <Typography fontWeight={700}>До конца периода</Typography>
          <Typography sx={{ fontSize: typography.hint, color: colors.textMuted }}>
            Проверка — {new Date(cur.endsAt).toLocaleDateString('ru-RU')}
          </Typography>
          {(cur.qualifiedCount || 0) < (cur.targetCount || 3) && (
            <Alert severity="warning" icon={<WarningAmberOutlined fontSize="inherit" />} sx={{ mt: 1, py: 0 }}>
              Если условие не выполнено, прекратятся комиссии по 3 самым ранним закреплённым клиентам.
            </Alert>
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
        <Box sx={{ ...cardSx, p: { xs: 2, md: 2.5 } }}>
          <Typography sx={{ fontWeight: 800, fontSize: 18, mb: 0.5 }}>База контроля</Typography>
          <Typography sx={{ fontSize: typography.hint, color: colors.textMuted, mb: 2 }}>
            Организации с первой оплатой. Ранние — под риском, пока период не выполнен.
          </Typography>
          {(data.schools || []).length === 0 ? (
            <Typography color="text.secondary" py={2}>
              Пока нет закреплённых школ
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              {(data.schools || []).map((s: any) => {
                const chip = STATE_CHIP[s.state] || STATE_CHIP.linked;
                return (
                  <Box
                    key={s.tenantId}
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
                    <Box sx={{ minWidth: 0 }}>
                      <Typography fontWeight={700}>{s.label}</Typography>
                      <Typography sx={{ fontSize: typography.hint, color: colors.textMuted }}>
                        {s.firstPaidAt
                          ? `Первая оплата ${new Date(s.firstPaidAt).toLocaleDateString('ru-RU')}`
                          : `Закреплён ${new Date(s.linkedAt).toLocaleDateString('ru-RU')}`}
                        {s.riskRank ? ` · ранг риска ${s.riskRank}` : ''}
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      label={chip.label}
                      sx={{ fontWeight: 700, bgcolor: chip.bg, color: chip.color, height: 24 }}
                    />
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ ...cardSx, p: 2.5, bgcolor: '#EEF4FF', borderColor: colors.primarySoft }}>
            <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
              <InfoOutlined sx={{ color: colors.primary }} />
              <Typography fontWeight={800}>Как считается активность?</Typography>
            </Box>
            <Typography sx={{ fontSize: typography.hint, color: colors.textMuted, lineHeight: 1.55, mb: 1.5 }}>
              В счётчик попадают только <b>новые организации, впервые оплатившие тариф</b> в текущем периоде.
              Неоплаченные лиды, 0₽-промо и повторные платежи не учитываются.
            </Typography>
            <Typography sx={{ fontSize: typography.hint, color: colors.textMuted, lineHeight: 1.55 }}>
              Если за период меньше трёх новых оплат, вы сохраняете уже заработанное, но теряете будущие комиссии по
              трём самым ранним закреплённым клубам. Следующий период стартует автоматически.
            </Typography>
          </Box>

          <Box sx={{ ...cardSx, p: 2.5 }}>
            <Typography fontWeight={800} mb={1.5}>
              Предыдущие периоды
            </Typography>
            {(data.history || []).filter((h: any) => h.id !== cur.id).length === 0 ? (
              <Typography color="text.secondary" fontSize={14}>
                История появится после закрытия первого периода
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {(data.history || [])
                  .filter((h: any) => h.id !== cur.id)
                  .map((h: any) => (
                    <Box
                      key={h.id}
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        p: 1.25,
                        bgcolor: colors.surface,
                        borderRadius: '8px',
                      }}
                    >
                      <Box>
                        <Typography fontWeight={700} fontSize={14}>
                          {new Date(h.startsAt).toLocaleDateString('ru-RU')} —{' '}
                          {new Date(h.endsAt).toLocaleDateString('ru-RU')}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {h.qualifiedCount}/{h.targetCount}
                          {h.excludedCount ? ` · исключено ${h.excludedCount}` : ''}
                        </Typography>
                      </Box>
                      <Chip size="small" label={STATUS_LABEL[h.status] || h.status} sx={{ fontWeight: 700 }} />
                    </Box>
                  ))}
              </Box>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default MarketerActivity;
