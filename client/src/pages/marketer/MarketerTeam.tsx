import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import {
  ContentCopy,
  GroupOutlined,
  InfoOutlined,
  LinkOutlined,
  PeopleOutline,
  TrendingUpOutlined,
} from '@mui/icons-material';
import { apiService } from '../../services/api';
import { colors, typography } from '../../theme/tokens';

const money = (n: number) =>
  new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(n || 0);

const cardSx = {
  bgcolor: colors.card,
  borderRadius: '12px',
  border: '1px solid #EEF1F6',
  boxShadow: '0 4px 18px rgba(32, 34, 36, 0.06)',
} as const;

type Member = {
  id: string;
  name: string;
  joinedAt: string;
  status: string;
  clubsTotal: number;
  clubsPaid: number;
  earnedReferral: number;
  clubs: Array<{ id: string; label: string; paid: boolean }>;
};

const MarketerTeam: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'new'>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Member | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const team = await apiService.getMarketerTeam();
        if (!cancelled) setData(team);
      } catch (e: any) {
        if (!cancelled) setError(e?.response?.data?.error || 'Не удалось загрузить команду');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const inviteUrl = useMemo(() => {
    if (!data?.invite?.path) return '';
    return `${window.location.origin}${data.invite.path}`;
  }, [data]);

  const members: Member[] = useMemo(() => {
    const list: Member[] = data?.members || [];
    return list.filter((m) => {
      if (filter !== 'all' && m.status !== filter) return false;
      if (search.trim() && !m.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
      return true;
    });
  }, [data, filter, search]);

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

  if (error && !data) return <Alert severity="error">{error}</Alert>;
  if (!data) return null;

  const stats = data.stats || {};

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
          justifyContent: 'space-between',
          gap: 2,
          mb: 2.5,
        }}
      >
        <Box>
          <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', color: colors.primary, mb: 0.75 }}>
            ПАРТНЁРСКАЯ ПРОГРАММА / КОМАНДА
          </Typography>
          <Typography sx={{ fontWeight: 800, fontSize: { xs: 24, md: 28 }, color: colors.text }}>
            Моя команда
          </Typography>
          <Typography sx={{ fontSize: typography.label, color: colors.textMuted, mt: 0.75, maxWidth: 560 }}>
            Приглашайте маркетологов и получайте разовые 5% с первой оплаты каждой их школы.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<LinkOutlined />}
          onClick={() => void copyLink()}
          sx={{
            textTransform: 'none',
            fontWeight: 800,
            borderRadius: '8px',
            bgcolor: '#2463ed',
            alignSelf: { xs: 'stretch', sm: 'center' },
            '&:hover': { bgcolor: '#124fcf' },
          }}
        >
          {copied ? 'Ссылка скопирована' : 'Пригласить маркетолога'}
        </Button>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1.2fr 1fr' },
          gap: 2,
          mb: 2.5,
        }}
      >
        <Box sx={{ ...cardSx, p: { xs: 2, md: 2.5 } }}>
          <Typography sx={{ fontWeight: 800, mb: 1 }}>Ваша ссылка-приглашение</Typography>
          <Typography sx={{ fontSize: typography.hint, color: colors.textMuted, mb: 1.5 }}>
            Один уровень. Уникальный токен закрепляет пригласившего при регистрации.
          </Typography>
          <TextField
            fullWidth
            value={inviteUrl}
            InputProps={{
              readOnly: true,
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => void copyLink()} edge="end" aria-label="copy">
                    <ContentCopy fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ),
            }}
            sx={{ mb: 1.5 }}
          />
          {copied && (
            <Typography sx={{ fontSize: typography.hint, color: colors.success }}>Скопировано</Typography>
          )}
        </Box>

        <Box sx={{ ...cardSx, p: { xs: 2, md: 2.5 }, bgcolor: '#EEF4FF', borderColor: colors.primarySoft }}>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mb: 1 }}>
            <InfoOutlined sx={{ color: colors.primary, mt: 0.25 }} />
            <Typography sx={{ fontWeight: 800 }}>Как начисляются 5%</Typography>
          </Box>
          <Typography sx={{ fontSize: typography.hint, color: colors.textMuted, lineHeight: 1.55 }}>
            1) Приглашённый регистрируется по вашей ссылке → 2) приводит школу → 3) школа оплачивает тариф первый
            раз → вам разовые <b>5%</b> от этой оплаты. Продления и второй уровень не учитываются. Контакты клиентов
            команды недоступны.
          </Typography>
        </Box>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
          gap: 1.5,
          mb: 2.5,
        }}
      >
        {[
          { label: 'В команде', value: String(stats.marketersInTeam || 0), icon: <PeopleOutline /> },
          { label: 'Клубов всего', value: String(stats.clubsTotal || 0), icon: <GroupOutlined /> },
          { label: 'С первой оплатой', value: String(stats.clubsPaid || 0), icon: <TrendingUpOutlined /> },
          {
            label: 'Начислено 5%',
            value: money(stats.referralEarnedLifetime || 0),
            icon: <TrendingUpOutlined />,
          },
        ].map((m) => (
          <Box key={m.label} sx={{ ...cardSx, p: 2 }}>
            <Box sx={{ color: colors.primary, mb: 1 }}>{m.icon}</Box>
            <Typography sx={{ fontSize: typography.hint, color: colors.textMuted, fontWeight: 600 }}>
              {m.label}
            </Typography>
            <Typography sx={{ fontWeight: 800, fontSize: { xs: 20, md: 24 }, mt: 0.5 }}>{m.value}</Typography>
          </Box>
        ))}
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '1.5fr 1fr' },
          gap: 2,
          alignItems: 'start',
        }}
      >
        <Box sx={{ ...cardSx, p: { xs: 2, md: 2.5 }, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 18, mb: 1.5 }}>Участники</Typography>
          <Tabs
            value={filter}
            onChange={(_, v) => setFilter(v)}
            sx={{
              mb: 1.5,
              minHeight: 36,
              '& .MuiTab-root': { textTransform: 'none', fontWeight: 700, minHeight: 36 },
            }}
          >
            <Tab value="all" label="Все" />
            <Tab value="active" label="Активные" />
            <Tab value="new" label="Новые" />
          </Tabs>
          <TextField
            size="small"
            placeholder="Поиск по имени"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            fullWidth
            sx={{ mb: 2 }}
          />
          {members.length === 0 ? (
            <Typography sx={{ color: colors.textMuted, py: 3, textAlign: 'center' }}>
              Пока никого нет — отправьте ссылку-приглашение
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              {members.map((m) => (
                <Box
                  key={m.id}
                  onClick={() => setSelected(m)}
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 1.5,
                    p: 1.5,
                    borderRadius: '8px',
                    bgcolor: colors.surface,
                    border: '1px solid #EEF1F6',
                    cursor: 'pointer',
                    '&:hover': { borderColor: colors.primarySoft },
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 700 }}>{m.name}</Typography>
                    <Typography sx={{ fontSize: typography.hint, color: colors.textMuted }}>
                      с {new Date(m.joinedAt).toLocaleDateString('ru-RU')} · клубов {m.clubsTotal} · оплат{' '}
                      {m.clubsPaid}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                    <Typography sx={{ fontWeight: 800, color: colors.success }}>{money(m.earnedReferral)}</Typography>
                    <Chip
                      size="small"
                      label={m.status === 'new' ? 'Новый' : 'Активный'}
                      sx={{ mt: 0.5, height: 22, fontWeight: 700, fontSize: 11 }}
                    />
                  </Box>
                </Box>
              ))}
            </Box>
          )}
        </Box>

        <Box sx={{ ...cardSx, p: { xs: 2, md: 2.5 } }}>
          <Typography sx={{ fontWeight: 800, fontSize: 18, mb: 1.5 }}>Недавние начисления 5%</Typography>
          {(data.recentAccruals || []).length === 0 ? (
            <Typography sx={{ color: colors.textMuted, fontSize: typography.label }}>
              Появятся после первой оплаты школ вашей команды
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              {(data.recentAccruals || []).map((a: any) => (
                <Box
                  key={a.id}
                  sx={{
                    p: 1.5,
                    borderRadius: '8px',
                    bgcolor: colors.surface,
                    border: '1px solid #EEF1F6',
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: typography.label }}>
                      {a.schoolLabel || 'Школа'}
                    </Typography>
                    <Typography sx={{ fontWeight: 800, color: colors.success }}>+{money(a.amount)}</Typography>
                  </Box>
                  <Typography sx={{ fontSize: typography.hint, color: colors.textMuted }}>
                    {new Date(a.occurredAt).toLocaleString('ru-RU')}
                    {a.notes ? ` · ${a.notes}` : ''}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      </Box>

      <Dialog open={!!selected} onClose={() => setSelected(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>{selected?.name}</DialogTitle>
        <DialogContent>
          {selected && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pb: 1 }}>
              <Typography color="text.secondary">
                В команде с {new Date(selected.joinedAt).toLocaleDateString('ru-RU')}
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1 }}>
                <Box sx={{ p: 1.5, bgcolor: colors.surface, borderRadius: '8px' }}>
                  <Typography variant="caption" color="text.secondary">
                    Клубов
                  </Typography>
                  <Typography fontWeight={800}>{selected.clubsTotal}</Typography>
                </Box>
                <Box sx={{ p: 1.5, bgcolor: colors.surface, borderRadius: '8px' }}>
                  <Typography variant="caption" color="text.secondary">
                    С оплатой
                  </Typography>
                  <Typography fontWeight={800}>{selected.clubsPaid}</Typography>
                </Box>
                <Box sx={{ p: 1.5, bgcolor: colors.surface, borderRadius: '8px' }}>
                  <Typography variant="caption" color="text.secondary">
                    Ваши 5%
                  </Typography>
                  <Typography fontWeight={800}>{money(selected.earnedReferral)}</Typography>
                </Box>
              </Box>
              <Typography fontWeight={700} mt={1}>
                Организации (без контактов клиентов)
              </Typography>
              {selected.clubs.length === 0 ? (
                <Typography color="text.secondary">Пока нет привязанных школ</Typography>
              ) : (
                selected.clubs.map((c) => (
                  <Box
                    key={c.id}
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      p: 1.25,
                      bgcolor: colors.surface,
                      borderRadius: '8px',
                    }}
                  >
                    <Typography>{c.label}</Typography>
                    <Chip size="small" label={c.paid ? 'Первая оплата' : 'Без оплаты'} />
                  </Box>
                ))
              )}
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default MarketerTeam;
