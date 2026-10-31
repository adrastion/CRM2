import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  TextField,
  Typography,
} from '@mui/material';
import { ContentCopy, GroupOutlined, LinkOutlined, TrendingUpOutlined } from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { apiService } from '../../services/api';
import { colors, typography } from '../../theme/tokens';
import { marketerCardSx, marketerFieldSx, marketerRadii } from './marketerUi';

const cardSx = {
  ...marketerCardSx,
  border: '1px solid #EEF1F6',
} as const;

const money = (n: number) =>
  new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(n || 0);

const MarketerInvite: React.FC = () => {
  const [team, setTeam] = useState<any>(null);
  const [invite, setInvite] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const [teamData, inviteData] = await Promise.all([
          apiService.getMarketerTeam().catch(() => null),
          apiService.getMarketerInvite().catch(() => null),
        ]);
        if (!cancelled) {
          setTeam(teamData);
          setInvite(inviteData);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.response?.data?.error || 'Не удалось загрузить приглашение');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const inviteUrl = useMemo(() => {
    const path = invite?.path || team?.invite?.path;
    if (!path) return '';
    if (/^https?:\/\//i.test(path)) return path;
    return `${window.location.origin}${path}`;
  }, [invite, team]);

  const copyLink = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Не удалось скопировать ссылку');
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={6}>
        <CircularProgress />
      </Box>
    );
  }

  const stats = team?.stats || {};

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
          ПАРТНЁРСКАЯ ПРОГРАММА / ПРИГЛАШЕНИЕ
        </Typography>
        <Typography sx={{ fontWeight: 800, fontSize: { xs: 24, md: 28 }, color: colors.text }}>
          Пригласить маркетолога
        </Typography>
        <Typography sx={{ fontSize: typography.label, color: colors.textMuted, mt: 0.75, maxWidth: 620 }}>
          Приглашайте независимых партнёров и получайте разовые 5% с первой оплаты каждой их организации.
        </Typography>
      </Box>

      <Box
        sx={{
          ...cardSx,
          p: { xs: 2, md: 2.5 },
          mb: 2,
          bgcolor: '#EEF4FF',
          borderColor: colors.primarySoft,
        }}
      >
        <Typography sx={{ fontWeight: 800, color: colors.text, mb: 0.75 }}>
          Развивайте команду и зарабатывайте с первых продаж
        </Typography>
        <Typography sx={{ fontSize: typography.hint, color: colors.textMuted, lineHeight: 1.55 }}>
          Вознаграждение начисляется один раз — с первого оплаченного тарифа каждой школы, которую привёл
          приглашённый маркетолог. Продления не учитываются. Один уровень реферальной связи.
        </Typography>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
          gap: 1.5,
          mb: 2.5,
        }}
      >
        {[
          {
            label: 'В команде',
            value: String(stats.marketersInTeam ?? team?.members?.length ?? 0),
            hint: 'Приглашённых маркетологов',
            icon: <GroupOutlined fontSize="small" />,
          },
          {
            label: 'Первые оплаты командой',
            value: String(stats.clubsPaid ?? 0),
            hint: 'Организации с первой оплатой',
            icon: <TrendingUpOutlined fontSize="small" />,
          },
          {
            label: 'Начислено за приглашения',
            value: money(Number(stats.referralEarnedLifetime || 0)),
            hint: 'Разовая реферальная комиссия',
            icon: <LinkOutlined fontSize="small" />,
          },
        ].map((m) => (
          <Box key={m.label} sx={{ ...cardSx, p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography sx={{ fontSize: typography.hint, color: colors.textMuted, fontWeight: 600 }}>
                {m.label}
              </Typography>
              <Box sx={{ color: colors.primary }}>{m.icon}</Box>
            </Box>
            <Typography sx={{ fontWeight: 800, fontSize: 22, color: colors.text }}>{m.value}</Typography>
            <Typography sx={{ fontSize: typography.hint, color: colors.textHint, mt: 0.5 }}>{m.hint}</Typography>
          </Box>
        ))}
      </Box>

      <Box sx={{ ...cardSx, p: { xs: 2, md: 2.5 }, mb: 2 }}>
        <Typography sx={{ fontWeight: 800, mb: 0.5 }}>Ваша реферальная ссылка</Typography>
        <Typography sx={{ fontSize: typography.hint, color: colors.textMuted, mb: 1.5 }}>
          Отправьте ссылку будущему партнёру — связь с вашей командой сохранится после регистрации.
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.25, minWidth: 0 }}>
          <TextField
            fullWidth
            size="small"
            value={inviteUrl}
            InputProps={{ readOnly: true }}
            sx={{ ...marketerFieldSx, minWidth: 0, '& .MuiOutlinedInput-input': { overflow: 'hidden', textOverflow: 'ellipsis' } }}
          />
          <Button
            variant="contained"
            startIcon={<ContentCopy />}
            onClick={() => void copyLink()}
            disabled={!inviteUrl}
            sx={{
              textTransform: 'none',
              fontWeight: 800,
              borderRadius: marketerRadii.control,
              bgcolor: colors.primary,
              whiteSpace: 'nowrap',
              flexShrink: 0,
              '&:hover': { bgcolor: colors.primaryDark },
            }}
          >
            {copied ? 'Скопировано' : 'Копировать'}
          </Button>
        </Box>
      </Box>

      <Button
        component={RouterLink}
        to="/marketer/team"
        sx={{ textTransform: 'none', fontWeight: 700 }}
      >
        Перейти к команде →
      </Button>
    </Box>
  );
};

export default MarketerInvite;
