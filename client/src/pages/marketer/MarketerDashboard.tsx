import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Link,
  Typography,
} from '@mui/material';
import {
  AccessTimeOutlined,
  AccountBalanceWalletOutlined,
  Add,
  BusinessOutlined,
  ContentCopy,
  GroupOutlined,
  WarningAmberOutlined,
} from '@mui/icons-material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { apiService } from '../../services/api';
import { colors } from '../../theme/tokens';
import { marketerCardSx, marketerRadii } from './marketerUi';
import MarketerSchoolRefLink from './MarketerSchoolRefLink';

const money = (n: number) =>
  new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(n || 0);

const cardSx = marketerCardSx;

const STATUS_TAG: Record<string, { bg: string; color: string }> = {
  paid: { bg: '#e6f9f0', color: '#0c956a' },
  test: { bg: '#fff5de', color: '#b07a19' },
  work: { bg: '#eaf2ff', color: '#3167ce' },
};

const formatPeriod = (startsAt?: string, endsAt?: string) => {
  if (!startsAt || !endsAt) return '—';
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' };
  const a = new Date(startsAt).toLocaleDateString('ru-RU', opts);
  const b = new Date(endsAt).toLocaleDateString('ru-RU', { ...opts, year: 'numeric' });
  return `${a} — ${b}`;
};

const daysWord = (n: number) => {
  const abs = Math.abs(n) % 100;
  const d = abs % 10;
  if (abs > 10 && abs < 20) return 'дней';
  if (d === 1) return 'день';
  if (d >= 2 && d <= 4) return 'дня';
  return 'дней';
};

const MarketerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const dash = await apiService.getMarketerDashboard();
        if (!cancelled) setData(dash);
      } catch (e: any) {
        if (!cancelled) setError(e?.response?.data?.error || 'Не удалось загрузить панель');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const home = data?.home || {};
  const activity = data?.activity;
  const progressPct = useMemo(() => {
    if (!activity?.target) return 0;
    return Math.min(100, Math.round((Number(activity.qualified || 0) / Number(activity.target)) * 100));
  }, [activity]);

  const inviteUrl = useMemo(() => {
    const path = home.invite?.path;
    if (!path) return '';
    if (/^https?:\/\//i.test(path)) return path;
    return `${window.location.origin}${path}`;
  }, [home.invite?.path]);

  const inviteDisplay = useMemo(() => {
    if (!inviteUrl) return '—';
    try {
      const u = new URL(inviteUrl);
      return `${u.host}${u.pathname}`;
    } catch {
      return inviteUrl.replace(/^https?:\/\//, '');
    }
  }, [inviteUrl]);

  const copyInvite = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={6}>
        <CircularProgress />
      </Box>
    );
  }
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!data) return null;

  const left = Math.max(0, Number(activity?.target || 3) - Number(activity?.qualified || 0));

  return (
    <Box sx={{ width: '100%', minWidth: 0, pb: 2, maxWidth: 1580 }}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'stretch', sm: 'center' },
          justifyContent: 'space-between',
          gap: 2,
          mb: 2.75,
        }}
      >
        <Box>
          <Typography sx={{ fontSize: 12, color: '#7c8aa2', fontWeight: 500, mb: 0.75 }}>
            Личный кабинет / Маркетолог
          </Typography>
          <Typography
            sx={{
              fontWeight: 800,
              fontSize: { xs: 24, md: 27 },
              color: '#13213a',
              letterSpacing: '-0.03em',
              lineHeight: 1.25,
            }}
          >
            Главная
          </Typography>
          <Typography sx={{ mt: 0.75, color: '#7a889e', fontSize: 12, maxWidth: 480 }}>
            Все ваши организации, доходы и результаты — в одном месте.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => navigate('/marketer/clients')}
          sx={{
            textTransform: 'none',
            fontWeight: 750,
            borderRadius: marketerRadii.control,
            px: 2.25,
            py: 1.4,
            bgcolor: '#2463ed',
            boxShadow: '0 4px 10px rgba(36,99,237,.16)',
            alignSelf: { xs: 'stretch', sm: 'center' },
            '&:hover': { bgcolor: '#124fcf' },
          }}
        >
          Добавить организацию
        </Button>
      </Box>

      {activity && (
        <Box
          component={RouterLink}
          to="/marketer/activity"
          sx={{
            ...cardSx,
            textDecoration: 'none',
            color: 'inherit',
            p: { xs: 2, md: '23px 27px' },
            mb: 2.5,
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              md: 'minmax(220px,1.05fr) minmax(280px,1.55fr) minmax(240px,.95fr)',
            },
            gap: { xs: 2, md: 3 },
            alignItems: 'center',
            background: 'linear-gradient(115deg,#fff 20%,#f7faff 100%)',
            borderColor: '#dce7f9',
            '&:hover': { borderColor: colors.primary },
          }}
        >
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1.25 }}>
              <Box
                sx={{
                  width: 38,
                  height: 38,
                  borderRadius: '8px',
                  bgcolor: '#eaf2ff',
                  color: '#2566e9',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <AccessTimeOutlined sx={{ fontSize: 19 }} />
              </Box>
              <Typography sx={{ fontWeight: 800, fontSize: 15, color: '#13213a' }}>Моя активность</Typography>
            </Box>
            <Typography sx={{ fontSize: 11.5, color: '#71819b' }}>
              Период:{' '}
              <Box component="b" sx={{ color: '#465a76', fontWeight: 700 }}>
                {formatPeriod(activity.startsAt, activity.endsAt)}
              </Box>
            </Typography>
          </Box>

          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 1, mb: 1 }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 750, color: '#536887', fontSize: 11, mb: 0.75 }}>
                  Новые оплатившие организации
                </Typography>
                <Typography sx={{ fontSize: 31, fontWeight: 800, letterSpacing: '-1.2px', lineHeight: 1, color: '#13213a' }}>
                  {activity.qualified}{' '}
                  <Box component="span" sx={{ fontWeight: 600, fontSize: 17, color: '#91a1b8' }}>
                    / {activity.target}
                  </Box>
                </Typography>
              </Box>
              <Box
                sx={{
                  borderRadius: '6px',
                  px: 1.1,
                  py: 0.65,
                  fontSize: 10,
                  fontWeight: 750,
                  bgcolor: '#eaf2ff',
                  color: '#3167ce',
                  flexShrink: 0,
                }}
              >
                {progressPct}% выполнено
              </Box>
            </Box>
            <Box sx={{ height: 9, bgcolor: '#e0eafa', borderRadius: '4px', overflow: 'hidden' }}>
              <Box
                sx={{
                  height: '100%',
                  width: `${progressPct}%`,
                  background: 'linear-gradient(90deg,#1d69f1,#57a2f5)',
                  borderRadius: '4px',
                }}
              />
            </Box>
            <Typography sx={{ fontSize: 11, color: '#7989a0', mt: 1.25 }}>
              Осталось привлечь{' '}
              <Box component="b" sx={{ fontWeight: 700, color: '#465a76' }}>
                {left} {left === 1 ? 'организацию' : 'организации'}
              </Box>
              , чтобы сохранить комиссии
            </Typography>
          </Box>

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.75,
              borderLeft: { md: '1px solid #e4ebf6' },
              borderTop: { xs: '1px solid #e4ebf6', md: 'none' },
              pl: { md: 3 },
              pt: { xs: 2, md: 0 },
            }}
          >
            <Box
              sx={{
                width: 80,
                height: 80,
                flexShrink: 0,
                bgcolor: '#edf4ff',
                border: '1px solid #dce9ff',
                borderRadius: '10px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#1654d7',
              }}
            >
              <Typography sx={{ fontSize: 29, fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.03em' }}>
                {activity.daysLeft}
              </Typography>
              <Typography sx={{ fontSize: 11, color: '#5276b0' }}>{daysWord(activity.daysLeft)}</Typography>
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: 14, lineHeight: 1.45, color: '#13213a' }}>
                До конца периода
              </Typography>
              <Typography sx={{ fontSize: 11.5, color: '#8190a7', mt: 0.5, lineHeight: 1.55 }}>
                Следующая проверка —{' '}
                {activity.endsAt
                  ? new Date(activity.endsAt).toLocaleDateString('ru-RU', {
                      day: 'numeric',
                      month: 'long',
                    })
                  : '—'}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mt: 1, color: '#99611b' }}>
                <WarningAmberOutlined sx={{ fontSize: 15, mt: '1px', flexShrink: 0 }} />
                <Typography sx={{ fontSize: 11, lineHeight: 1.55 }}>
                  Если условие не выполнено, прекратятся комиссии по 3 самым ранним закреплённым клиентам.
                </Typography>
              </Box>
            </Box>
          </Box>
        </Box>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, minmax(0, 1fr))' },
          gap: 1.75,
          mb: 2.75,
        }}
      >
        {[
          {
            label: 'Организаций в базе',
            value: String(home.orgsInBase ?? 0),
            sub: (
              <>
                <Box component="span" sx={{ color: '#0b9e75', fontWeight: 750 }}>
                  {home.orgsEarning ?? 0} приносят комиссии
                </Box>{' '}
                · {home.orgsInProgress ?? 0} в работе
              </>
            ),
            icon: <BusinessOutlined sx={{ fontSize: 19 }} />,
            iconBg: '#eef5ff',
            iconColor: '#2567e7',
          },
          {
            label: 'Доступно к выводу',
            value: money(home.balance ?? data.balance ?? 0),
            sub: 'Вывод в любое время',
            icon: <AccountBalanceWalletOutlined sx={{ fontSize: 19 }} />,
            iconBg: '#e7f8f2',
            iconColor: '#0d9c76',
          },
          {
            label: 'Начислено за месяц',
            value: money(home.accruedThisMonth ?? 0),
            sub: (
              <>
                <Box component="span" sx={{ color: '#0b9e75', fontWeight: 750 }}>
                  {home.momDeltaPct >= 0 ? '+' : ''}
                  {home.momDeltaPct ?? 0}%
                </Box>{' '}
                к прошлому месяцу
              </>
            ),
            icon: <AccessTimeOutlined sx={{ fontSize: 19 }} />,
            iconBg: '#f2eeff',
            iconColor: '#8465d6',
          },
          {
            label: 'Маркетологов в команде',
            value: String(home.teamCount ?? 0),
            sub: '5% разово с их новых продаж',
            icon: <GroupOutlined sx={{ fontSize: 19 }} />,
            iconBg: '#fff5e5',
            iconColor: '#d7962c',
          },
        ].map((s) => (
          <Box key={s.label} sx={{ ...cardSx, p: '19px 19px 17px', minHeight: 128, minWidth: 0, overflow: 'hidden' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: 11, color: '#7e8ba1', minWidth: 0, pr: 0.5, lineHeight: 1.35 }}>{s.label}</Typography>
              <Box
                sx={{
                  width: 35,
                  height: 35,
                  borderRadius: '8px',
                  bgcolor: s.iconBg,
                  color: s.iconColor,
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                {s.icon}
              </Box>
            </Box>
            <Typography
              sx={{
                fontSize: { xs: 18, md: 22 },
                fontWeight: 800,
                letterSpacing: '-0.5px',
                lineHeight: 1.2,
                color: '#13213a',
                wordBreak: 'break-word',
              }}
            >
              {s.value}
            </Typography>
            <Typography sx={{ fontSize: 11, color: '#8392a8', mt: 0.85 }}>{s.sub}</Typography>
          </Box>
        ))}
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0,1.65fr) minmax(290px,.87fr)' },
          gap: 2.25,
          alignItems: 'start',
        }}
      >
        <Box sx={{ ...cardSx, p: { xs: '17px 14px', md: '22px 22px 15px' }, minWidth: 0 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1.5, mb: 2 }}>
            <Box>
              <Typography sx={{ fontWeight: 800, fontSize: 16, letterSpacing: '-0.02em', color: '#13213a' }}>
                Последние организации
              </Typography>
              <Typography sx={{ fontSize: 11, color: '#8390a4', mt: 0.75 }}>
                Удобный контроль ваших клиентов и заявок
              </Typography>
            </Box>
            <Button
              component={RouterLink}
              to="/marketer/clients"
              sx={{ textTransform: 'none', fontWeight: 750, fontSize: 11.5, color: '#2364de', minWidth: 0 }}
            >
              Вся база →
            </Button>
          </Box>

          {(home.recentOrgs || []).length === 0 ? (
            <Typography sx={{ color: '#8c9bb0', fontSize: 12, py: 3, textAlign: 'center' }}>
              Пока нет организаций — добавьте первую заявку
            </Typography>
          ) : (
            <Box sx={{ overflowX: 'auto' }}>
              <Box
                component="table"
                sx={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  whiteSpace: 'nowrap',
                  '& th': {
                    fontSize: 10,
                    letterSpacing: '0.3px',
                    color: '#94a1b3',
                    textAlign: 'left',
                    fontWeight: 700,
                    p: '12px',
                    bgcolor: '#f7f9fd',
                  },
                  '& th:first-of-type': { borderRadius: '6px 0 0 6px' },
                  '& th:last-of-type': { borderRadius: '0 6px 6px 0' },
                  '& td': {
                    fontSize: 11,
                    p: '16px 12px',
                    borderBottom: '1px solid #eef2f7',
                    color: '#52647d',
                  },
                  '& tr:last-of-type td': { borderBottom: 0 },
                  '& td:first-of-type': { color: '#23344f', fontWeight: 750 },
                }}
              >
                <thead>
                  <tr>
                    <th>Организация</th>
                    <th>Статус</th>
                    <Box component="th" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                      Тариф
                    </Box>
                    <Box component="th" sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                      Последнее действие
                    </Box>
                  </tr>
                </thead>
                <tbody>
                  {(home.recentOrgs || []).map((org: any) => {
                    const tag = STATUS_TAG[org.status] || STATUS_TAG.work;
                    const href =
                      org.kind === 'lead' ? `/marketer/clients/${org.id}` : `/marketer/clients/${org.id}`;
                    return (
                      <tr key={`${org.kind}-${org.id}`}>
                        <td>
                          <Box
                            component={RouterLink}
                            to={href}
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1.25,
                              textDecoration: 'none',
                              color: 'inherit',
                            }}
                          >
                            <Box
                              sx={{
                                width: 33,
                                height: 33,
                                flexShrink: 0,
                                bgcolor: '#eef3ff',
                                borderRadius: '6px',
                                display: 'grid',
                                placeItems: 'center',
                                color: '#315ecb',
                                fontSize: 11,
                                fontWeight: 800,
                              }}
                            >
                              {org.initials}
                            </Box>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography sx={{ fontWeight: 750, fontSize: 11, color: '#23344f', whiteSpace: 'normal' }}>
                                {org.name}
                              </Typography>
                              <Typography component="small" sx={{ display: 'block', color: '#8a98ae', fontSize: 10, fontWeight: 500, mt: 0.35 }}>
                                {org.subtitle}
                              </Typography>
                            </Box>
                          </Box>
                        </td>
                        <td>
                          <Box
                            component="span"
                            sx={{
                              borderRadius: '6px',
                              px: 1.1,
                              py: 0.65,
                              fontSize: 10,
                              fontWeight: 750,
                              display: 'inline-flex',
                              bgcolor: tag.bg,
                              color: tag.color,
                            }}
                          >
                            ● {org.statusLabel}
                          </Box>
                        </td>
                        <Box component="td" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                          {org.plan}
                        </Box>
                        <Box component="td" sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                          {org.lastAction}
                        </Box>
                      </tr>
                    );
                  })}
                </tbody>
              </Box>
            </Box>
          )}

          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              pt: 1.75,
              color: '#8c9bb0',
              fontSize: 10.5,
            }}
          >
            <span>Показаны последние {(home.recentOrgs || []).length || 0} организации</span>
            <Button
              component={RouterLink}
              to="/marketer/clients"
              sx={{ textTransform: 'none', fontWeight: 750, fontSize: 11.5, color: '#2364de' }}
            >
              + Новая организация
            </Button>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.25 }}>
          <MarketerSchoolRefLink adLink={home.adLink} variant="card" />

          <Box sx={{ ...cardSx, p: { xs: 2, md: '21px 21px 19px' } }}>
            <Typography sx={{ fontWeight: 800, fontSize: 16, color: '#13213a' }}>Моя команда</Typography>
            <Typography sx={{ fontSize: 11, color: '#8390a4', mt: 0.75, mb: 1.5 }}>
              Приглашайте маркетологов и зарабатывайте
            </Typography>
            <Typography sx={{ fontSize: 11, color: '#91a0b4' }}>Ссылка для маркетологов</Typography>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                border: '1px dashed #d2e1f8',
                borderRadius: '8px',
                bgcolor: '#f8fbff',
                p: 1.25,
                mt: 1.5,
                minWidth: 0,
              }}
            >
              <Typography
                component="code"
                sx={{
                  fontFamily: 'inherit',
                  fontSize: 11,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1,
                  minWidth: 0,
                  color: '#3466af',
                }}
              >
                {inviteDisplay}
              </Typography>
              <Button
                size="small"
                startIcon={<ContentCopy sx={{ fontSize: 14 }} />}
                onClick={() => void copyInvite()}
                sx={{
                  textTransform: 'none',
                  fontWeight: 800,
                  fontSize: 10,
                  bgcolor: '#e8f1ff',
                  color: '#2563d6',
                  borderRadius: '6px',
                  px: 1.25,
                  flexShrink: 0,
                  '&:hover': { bgcolor: '#dce9ff' },
                }}
              >
                {copied ? 'Скопировано' : 'Копировать'}
              </Button>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1.25, mt: 2 }}>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontSize: 11, color: '#91a0b4' }}>В команде</Typography>
                <Typography sx={{ fontSize: 20, fontWeight: 800, mt: 0.5, letterSpacing: '-0.02em' }}>
                  {home.teamCount ?? 0}
                </Typography>
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontSize: 11, color: '#91a0b4' }}>Разовый доход</Typography>
                <Typography sx={{ fontSize: 20, fontWeight: 800, mt: 0.5, letterSpacing: '-0.02em' }}>
                  {money(home.referralEarned ?? 0)}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ height: 1, bgcolor: '#edf1f7', my: 2 }} />
            <Typography sx={{ fontSize: 11, color: '#71819a', lineHeight: 1.5 }}>
              Вы получаете{' '}
              <Box component="b" sx={{ color: '#2c5fd4', fontWeight: 700 }}>
                5% однократно
              </Box>{' '}
              с первой покупки каждой организации, привлечённой вашим маркетологом.
            </Typography>
          </Box>

          <Box
            sx={{
              ...cardSx,
              p: { xs: 2, md: '19px 21px' },
              bgcolor: '#eff5ff',
              borderColor: '#dfebff',
              boxShadow: 'none',
            }}
          >
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
              <AccountBalanceWalletOutlined sx={{ fontSize: 18, color: '#1e4283' }} />
              <Typography sx={{ fontWeight: 800, fontSize: 12, color: '#1e4283' }}>
                Выплаты без ожидания даты
              </Typography>
            </Box>
            <Typography sx={{ fontSize: 11, color: '#57749a', lineHeight: 1.65, m: 0 }}>
              Выводите заработанное в любое время. Перевод — до{' '}
              <Box component="b" sx={{ fontWeight: 700 }}>
                7 рабочих дней
              </Box>{' '}
              после подписания закрывающих документов по СМС.
            </Typography>
            <Link
              component={RouterLink}
              to="/marketer/finance"
              underline="none"
              sx={{ display: 'inline-block', mt: 1.25, fontWeight: 750, fontSize: 11, color: '#1b58d6' }}
            >
              Перейти к выводу средств →
            </Link>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default MarketerDashboard;
