import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Menu,
  MenuItem,
  Popover,
  Typography,
} from '@mui/material';
import {
  AttachMoney,
  CalendarMonth,
  ChatBubbleOutline,
  MoreHoriz,
  NotificationsNone,
  Notifications as NotificationsIcon,
  Person,
  SettingsOutlined,
  ArrowForward,
  EmojiEventsOutlined,
  CampaignOutlined,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../../services/api';
import { colors, radii } from '../../theme/tokens';

export type InboxPayload = {
  items: Array<{
    id: string;
    category: string;
    type: string;
    title: string;
    body: string | null;
    data: Record<string, unknown> | null;
    readAt: string | null;
    createdAt: string;
  }>;
  aggregates: Array<{
    category: string;
    title: string;
    count: number;
    latestAt: string | null;
    url?: string;
  }>;
  unreadTotal: number;
};

type Props = {
  channel: 'school' | 'portal';
};

type FilterKey = 'all' | 'clients' | 'payments' | 'trainings' | 'chats' | 'system' | 'other';

const PRIMARY_FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'Все' },
  { key: 'clients', label: 'Клиенты' },
  { key: 'payments', label: 'Оплаты' },
  { key: 'trainings', label: 'Тренировки' },
];

const MORE_FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: 'chats', label: 'Чаты' },
  { key: 'system', label: 'Система' },
  { key: 'other', label: 'Другое' },
];

type VisualKind = 'clients' | 'payments' | 'trainings' | 'chats' | 'system' | 'events' | 'other';

function visualKind(category: string, type?: string): VisualKind {
  const c = `${category || ''} ${type || ''}`.toLowerCase();
  if (/chat|mention|сообщ/.test(c)) return 'chats';
  if (/finance|payment|salary|pay|оплат|финанс|зарплат|abon|абонемент/.test(c)) return 'payments';
  if (/train|schedule|attend|тренир|расписан|посещаем/.test(c)) return 'trainings';
  if (/compet|event|соревн|турнир|мероприят/.test(c)) return 'events';
  if (/client|athlete|member|спорт|клиент|заявк|trial|пробн/.test(c)) return 'clients';
  if (/changelog|news|system|platform|обновл/.test(c)) return 'system';
  return 'other';
}

function matchesFilter(category: string, type: string | undefined, filter: FilterKey): boolean {
  if (filter === 'all') return true;
  const kind = visualKind(category, type);
  if (filter === 'clients') return kind === 'clients';
  if (filter === 'payments') return kind === 'payments';
  if (filter === 'trainings') return kind === 'trainings' || kind === 'events';
  if (filter === 'chats') return kind === 'chats';
  if (filter === 'system') return kind === 'system';
  if (filter === 'other') return kind === 'other';
  return true;
}

const VISUAL: Record<
  VisualKind,
  { bg: string; color: string; Icon: React.ElementType }
> = {
  clients: { bg: '#EAF0FF', color: '#2F6BFF', Icon: Person },
  payments: { bg: '#E8F8F2', color: '#00B69B', Icon: AttachMoney },
  trainings: { bg: '#FFE8F1', color: '#E85D8E', Icon: CalendarMonth },
  chats: { bg: '#F3EEFF', color: '#7C5CFC', Icon: ChatBubbleOutline },
  system: { bg: '#EAF0FF', color: '#2F6BFF', Icon: NotificationsIcon },
  events: { bg: '#FFF1E8', color: '#F08A4B', Icon: EmojiEventsOutlined },
  other: { bg: '#EEF2FF', color: '#3B4C7A', Icon: CampaignOutlined },
};

function formatRelativeRu(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diffSec = Math.round((Date.now() - d.getTime()) / 1000);
  if (diffSec < 45) return 'только что';
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) {
    const n = diffMin;
    const mod10 = n % 10;
    const mod100 = n % 100;
    let unit = 'минут';
    if (mod10 === 1 && mod100 !== 11) unit = 'минуту';
    else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) unit = 'минуты';
    return `${n} ${unit} назад`;
  }
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) {
    const n = diffH;
    const mod10 = n % 10;
    const mod100 = n % 100;
    let unit = 'часов';
    if (mod10 === 1 && mod100 !== 11) unit = 'час';
    else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) unit = 'часа';
    return `${n} ${unit} назад`;
  }
  const diffD = Math.round(diffH / 24);
  if (diffD === 1) return 'вчера';
  if (diffD < 7) return `${diffD} дн. назад`;
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

const filterPillSx = (active: boolean) => ({
  height: 30,
  borderRadius: '999px',
  fontWeight: active ? 700 : 600,
  fontSize: 12,
  bgcolor: active ? colors.primary : '#F3F5F9',
  color: active ? '#fff' : '#1B2438',
  border: 'none',
  '&:hover': {
    bgcolor: active ? colors.primaryDark : '#E8ECF3',
  },
  '& .MuiChip-label': { px: 1.1 },
});

/**
 * Колокольчик уведомлений — попап по макету «Уведомления - 2».
 */
const NotificationsBell: React.FC<Props> = ({ channel }) => {
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<InboxPayload | null>(null);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [moreAnchor, setMoreAnchor] = useState<HTMLElement | null>(null);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      try {
        const res =
          channel === 'school'
            ? await apiService.getSchoolNotifications()
            : await apiService.getPortalNotifications();
        setData(res);
      } catch {
        /* ignore */
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [channel]
  );

  useEffect(() => {
    const pull = (silent = true) => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      void load({ silent });
    };
    pull(false);
    const t = window.setInterval(() => pull(true), 30000);
    const onVis = () => {
      if (document.visibilityState === 'visible') pull(true);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [load]);

  const unread = data?.unreadTotal || 0;

  const unreadByFilter = useMemo(() => {
    const counts: Record<FilterKey, number> = {
      all: unread,
      clients: 0,
      payments: 0,
      trainings: 0,
      chats: 0,
      system: 0,
      other: 0,
    };
    for (const a of data?.aggregates || []) {
      const kind = visualKind(a.category);
      if (kind === 'chats') counts.chats += a.count;
      else if (kind === 'payments') counts.payments += a.count;
      else if (kind === 'trainings' || kind === 'events') counts.trainings += a.count;
      else if (kind === 'clients') counts.clients += a.count;
      else if (kind === 'system') counts.system += a.count;
      else counts.other += a.count;
    }
    for (const i of data?.items || []) {
      if (i.readAt) continue;
      const kind = visualKind(i.category, i.type);
      if (kind === 'chats') counts.chats += 1;
      else if (kind === 'payments') counts.payments += 1;
      else if (kind === 'trainings' || kind === 'events') counts.trainings += 1;
      else if (kind === 'clients') counts.clients += 1;
      else if (kind === 'system') counts.system += 1;
      else counts.other += 1;
    }
    return counts;
  }, [data, unread]);

  type Row =
    | { kind: 'aggregate'; key: string; category: string; title: string; body?: string; at: string | null; url?: string; unread: boolean; count: number }
    | { kind: 'item'; key: string; category: string; type: string; title: string; body?: string | null; at: string; url?: string; unread: boolean; id: string };

  const rows: Row[] = useMemo(() => {
    const list: Row[] = [];
    for (const a of data?.aggregates || []) {
      if (!matchesFilter(a.category, undefined, filter)) continue;
      list.push({
        kind: 'aggregate',
        key: `agg-${a.category}`,
        category: a.category,
        title: a.title,
        at: a.latestAt,
        url: a.url,
        unread: a.count > 0,
        count: a.count,
      });
    }
    for (const item of data?.items || []) {
      if (!matchesFilter(item.category, item.type, filter)) continue;
      list.push({
        kind: 'item',
        key: item.id,
        id: item.id,
        category: item.category,
        type: item.type,
        title: item.title,
        body: item.body,
        at: item.createdAt,
        url: typeof item.data?.url === 'string' ? item.data.url : undefined,
        unread: !item.readAt,
      });
    }
    list.sort((a, b) => {
      if (a.unread !== b.unread) return a.unread ? -1 : 1;
      const ta = a.at ? new Date(a.at).getTime() : 0;
      const tb = b.at ? new Date(b.at).getTime() : 0;
      return tb - ta;
    });
    return list.slice(0, 30);
  }, [data, filter]);

  const open = Boolean(anchor);
  const moreSelected = MORE_FILTERS.some((f) => f.key === filter);

  const handleOpen = (e: React.MouseEvent<HTMLElement>) => {
    setAnchor(e.currentTarget);
    void load();
  };

  const markRead = async (payload: { category?: string; ids?: string[]; all?: boolean }) => {
    try {
      if (channel === 'school') {
        await apiService.markSchoolNotificationsRead(payload);
      } else {
        await apiService.markPortalNotificationsRead(payload);
      }
    } catch {
      /* ignore */
    }
    void load({ silent: true });
  };

  const go = async (url: string | undefined, opts?: { category?: string; ids?: string[]; all?: boolean }) => {
    if (opts) await markRead(opts);
    else if (url) {
      /* just navigate */
    }
    setAnchor(null);
    if (url) {
      if (channel === 'portal' && url === '/client/dashboard') {
        navigate('/client/dashboard');
        return;
      }
      navigate(url);
    }
  };

  const openSettings = () => {
    setAnchor(null);
    if (channel === 'portal') {
      navigate('/client/dashboard');
      return;
    }
    navigate('/settings?tab=notifications');
  };

  const openAll = () => {
    setAnchor(null);
    if (channel === 'portal') {
      navigate('/client/dashboard');
      return;
    }
    navigate('/settings?tab=notifications');
  };

  const markAllRead = () => void markRead({ all: true });

  const renderBadge = (count: number, active: boolean) => {
    if (count <= 0) return undefined;
    return (
      <Box
        component="span"
        sx={{
          ml: 0.6,
          minWidth: 18,
          height: 18,
          px: 0.45,
          borderRadius: 999,
          bgcolor: active ? 'rgba(255,255,255,0.95)' : '#fff',
          color: active ? colors.primary : '#5D6B86',
          fontSize: 10,
          fontWeight: 800,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          lineHeight: 1,
          border: active ? 'none' : '1px solid #E6EAF2',
        }}
      >
        {count > 99 ? '99+' : count}
      </Box>
    );
  };

  return (
    <Box sx={{ position: 'relative' }}>
      <IconButton
        aria-label="Уведомления"
        size="small"
        sx={{
          color: '#1B2438',
          bgcolor: 'transparent',
          borderRadius: `${radii.cell}px`,
          '&:hover': { bgcolor: 'rgba(27, 36, 56, 0.06)' },
        }}
        onClick={handleOpen}
      >
        <NotificationsNone sx={{ fontSize: 22 }} />
      </IconButton>
      {unread > 0 && (
        <Box
          aria-label={`Непрочитанных уведомлений: ${unread}`}
          sx={{
            position: 'absolute',
            top: 2,
            right: 2,
            minWidth: 18,
            height: 18,
            px: 0.4,
            borderRadius: '999px',
            bgcolor: colors.danger,
            color: colors.white,
            fontSize: 11,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          {unread > 9 ? '9+' : unread}
        </Box>
      )}

      <Popover
        open={open}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{
          sx: {
            width: { xs: 'min(100vw - 24px, 400px)', sm: 400 },
            maxHeight: 560,
            borderRadius: '16px',
            bgcolor: '#fff',
            boxShadow: '0 12px 40px rgba(27, 36, 56, 0.16)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            border: '1px solid #EEF1F6',
          },
        }}
      >
        <Box sx={{ px: 2, pt: 1.75, pb: 1.25 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
            <Typography sx={{ fontWeight: 800, color: '#1B2438', fontSize: 16 }}>
              Уведомления
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {unread > 0 && (
                <Typography
                  component="button"
                  type="button"
                  onClick={markAllRead}
                  sx={{
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    color: colors.primary,
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: 'inherit',
                    whiteSpace: 'nowrap',
                    px: 0.5,
                    '&:hover': { textDecoration: 'underline' },
                  }}
                >
                  Отметить все прочитанными
                </Typography>
              )}
              <IconButton
                size="small"
                aria-label="Настройки уведомлений"
                onClick={openSettings}
                sx={{ color: '#8B93A7' }}
              >
                <SettingsOutlined sx={{ fontSize: 18 }} />
              </IconButton>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1.5 }}>
            {PRIMARY_FILTERS.map((f) => {
              const selected = filter === f.key;
              const count = unreadByFilter[f.key];
              return (
                <Chip
                  key={f.key}
                  clickable
                  onClick={() => setFilter(f.key)}
                  label={
                    <Box sx={{ display: 'inline-flex', alignItems: 'center' }}>
                      {f.label}
                      {renderBadge(count, selected)}
                    </Box>
                  }
                  size="small"
                  sx={filterPillSx(selected)}
                />
              );
            })}
            <Chip
              clickable
              onClick={(e) => setMoreAnchor(e.currentTarget)}
              icon={<MoreHoriz sx={{ fontSize: '16px !important' }} />}
              label={moreSelected ? MORE_FILTERS.find((f) => f.key === filter)?.label : ''}
              size="small"
              sx={{
                ...filterPillSx(moreSelected),
                '& .MuiChip-icon': { ml: moreSelected ? 0.5 : 0.75, mr: moreSelected ? -0.25 : 0.75 },
                minWidth: 36,
              }}
            />
            <Menu
              anchorEl={moreAnchor}
              open={Boolean(moreAnchor)}
              onClose={() => setMoreAnchor(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            >
              {MORE_FILTERS.map((f) => (
                <MenuItem
                  key={f.key}
                  selected={filter === f.key}
                  onClick={() => {
                    setFilter(f.key);
                    setMoreAnchor(null);
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 140 }}>
                    <span>{f.label}</span>
                    {unreadByFilter[f.key] > 0 && (
                      <Typography sx={{ ml: 'auto', fontSize: 12, color: colors.primary, fontWeight: 700 }}>
                        {unreadByFilter[f.key]}
                      </Typography>
                    )}
                  </Box>
                </MenuItem>
              ))}
            </Menu>
          </Box>
        </Box>

        <Box sx={{ flex: 1, overflow: 'auto', px: 1.5, pb: 1 }}>
          {loading && !data ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={24} sx={{ color: colors.primary }} />
            </Box>
          ) : rows.length === 0 ? (
            <Box sx={{ px: 1, py: 4 }}>
              <Typography sx={{ color: '#8B93A7', fontSize: 14, textAlign: 'center' }}>
                {unread ? 'Нет уведомлений в этой категории' : 'Нет уведомлений'}
              </Typography>
            </Box>
          ) : (
            rows.map((row) => {
              const kind = visualKind(row.category, row.kind === 'item' ? row.type : undefined);
              const visual = VISUAL[kind];
              const Icon = visual.Icon;
              return (
                <Box
                  key={row.key}
                  component="button"
                  type="button"
                  onClick={() => {
                    if (row.kind === 'aggregate') {
                      void go(row.url, { category: row.category });
                    } else {
                      void go(row.url, { ids: [row.id] });
                    }
                  }}
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 1.25,
                    width: '100%',
                    textAlign: 'left',
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    p: 1.15,
                    mb: 0.5,
                    borderRadius: '12px',
                    position: 'relative',
                    '&:hover': { bgcolor: '#F7F8FB' },
                  }}
                >
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: '12px',
                      bgcolor: visual.bg,
                      color: visual.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Icon sx={{ fontSize: 20 }} />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0, pr: row.unread ? 1.5 : 0 }}>
                    <Typography
                      sx={{
                        fontWeight: 700,
                        fontSize: 13.5,
                        color: '#1B2438',
                        lineHeight: 1.3,
                      }}
                    >
                      {row.title}
                    </Typography>
                    {row.body && (
                      <Typography
                        sx={{
                          mt: 0.35,
                          fontSize: 12.5,
                          color: '#5D6B86',
                          lineHeight: 1.4,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {row.body}
                      </Typography>
                    )}
                    {row.at && (
                      <Typography sx={{ mt: 0.55, fontSize: 11.5, color: '#8B93A7' }}>
                        {formatRelativeRu(row.at)}
                      </Typography>
                    )}
                  </Box>
                  {row.unread && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 14,
                        right: 12,
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        bgcolor: colors.primary,
                        flexShrink: 0,
                      }}
                    />
                  )}
                  {row.kind === 'aggregate' && row.count > 1 && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 12,
                        right: row.unread ? 24 : 12,
                        minWidth: 18,
                        height: 18,
                        px: 0.5,
                        borderRadius: 999,
                        bgcolor: colors.primarySoft,
                        color: colors.primary,
                        fontSize: 10,
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {row.count > 99 ? '99+' : row.count}
                    </Box>
                  )}
                </Box>
              );
            })
          )}
        </Box>

        <Box sx={{ px: 1.75, py: 1.35, borderTop: '1px solid #EEF1F6' }}>
          <Button
            fullWidth
            variant="outlined"
            endIcon={<ArrowForward sx={{ fontSize: 16 }} />}
            onClick={openAll}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              fontSize: 13,
              borderRadius: `${radii.button}px`,
              borderColor: colors.primary,
              color: colors.primary,
              py: 1,
              bgcolor: '#fff',
              '&:hover': {
                borderColor: colors.primaryDark,
                bgcolor: 'rgba(47, 107, 255, 0.04)',
              },
            }}
          >
            Все уведомления
          </Button>
        </Box>
      </Popover>
    </Box>
  );
};

export default NotificationsBell;
