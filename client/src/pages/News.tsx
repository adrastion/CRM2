import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import {
  Search as SearchIcon,
  ArrowForward,
  MoreHoriz,
  CampaignOutlined,
  StarOutline,
  NotificationsNoneOutlined,
  ChevronRight,
  ArticleOutlined,
  SystemUpdateAltOutlined,
  MenuBookOutlined,
  AutoAwesomeOutlined,
  EventOutlined,
  PaymentsOutlined,
  CategoryOutlined,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import {
  AuthNewsImage,
  formatNewsDateTime,
  PlatformNewsEntry,
} from '../components/PlatformNewsFeed';
import { apiService } from '../services/api';
import { colors, radii, typography } from '../theme/tokens';
import { FAQ_CONTENT } from '../content/faqContent';

type NewsCategory =
  | 'all'
  | 'updates'
  | 'guides'
  | 'features'
  | 'events'
  | 'tariffs'
  | 'other';

const CATEGORY_PILLS: Array<{ key: NewsCategory; label: string }> = [
  { key: 'all', label: 'Все новости' },
  { key: 'updates', label: 'Обновления системы' },
  { key: 'guides', label: 'Инструкции' },
  { key: 'features', label: 'Возможности' },
  { key: 'events', label: 'Мероприятия' },
  { key: 'tariffs', label: 'Тарифы' },
  { key: 'other', label: 'Другое' },
];

const CATEGORY_META: Record<
  Exclude<NewsCategory, 'all'>,
  { label: string; bg: string; color: string; Icon: React.ElementType }
> = {
  updates: {
    label: 'Обновления системы',
    bg: '#EAF0FF',
    color: '#2F6BFF',
    Icon: SystemUpdateAltOutlined,
  },
  guides: { label: 'Инструкции', bg: '#E8F8F2', color: '#00B69B', Icon: MenuBookOutlined },
  features: { label: 'Возможности', bg: '#F3EEFF', color: '#7C5CFC', Icon: AutoAwesomeOutlined },
  events: { label: 'Мероприятия', bg: '#FFE8F1', color: '#E85D8E', Icon: EventOutlined },
  tariffs: { label: 'Тарифы', bg: '#FFF1E8', color: '#F08A4B', Icon: PaymentsOutlined },
  other: { label: 'Другое', bg: '#F5F6FA', color: '#5D6B86', Icon: CategoryOutlined },
};

const cardSx = {
  bgcolor: '#fff',
  borderRadius: `${radii.panel}px`,
  border: '1px solid #EEF1F6',
  boxShadow: '0 8px 24px rgba(27, 36, 56, 0.05)',
} as const;

const filterPillSx = (active: boolean) => ({
  height: 34,
  borderRadius: '999px',
  fontWeight: active ? 700 : 500,
  fontSize: typography.label,
  bgcolor: active ? colors.primary : '#fff',
  color: active ? '#fff' : '#1B2438',
  border: active ? '1px solid transparent' : '1px solid #E6EAF2',
  '&:hover': {
    bgcolor: active ? colors.primaryDark : '#F7F8FB',
  },
});

const BODY_PREVIEW = 160;

const inferCategory = (entry: PlatformNewsEntry): Exclude<NewsCategory, 'all'> => {
  const t = `${entry.title || ''} ${entry.body || ''}`.toLowerCase();
  if (/тариф|подписк|промокод|оплат.*план|free|starter|business|enterprise/.test(t)) {
    return 'tariffs';
  }
  if (/инструк|гайд|обучен|как |с чего начать|пошаг|faq|база знан/.test(t)) return 'guides';
  if (/мероприят|соревнован|турнир|вебинар|день открыт|конферен/.test(t)) return 'events';
  if (
    /возможност|функци|чат|календар|отч[её]т|аналитик|абонемент|трениров|групп|клиент|зарплат/.test(
      t
    )
  ) {
    return 'features';
  }
  if (/обновл|релиз|верси|2fa|двухфактор|вход|защит|техническ|работ|исправлен|баг/.test(t)) {
    return 'updates';
  }
  return 'other';
};

const isRecent = (createdAt: string) => {
  const ageMs = Date.now() - new Date(createdAt).getTime();
  return ageMs >= 0 && ageMs < 7 * 24 * 60 * 60 * 1000;
};

const isImportantLooking = (entry: PlatformNewsEntry) => {
  const t = `${entry.title || ''} ${entry.body || ''}`.toLowerCase();
  return /техническ|работ|обслуживан|недоступ|перерыв|миграц|важно|срочн/.test(t);
};

const POPULAR_TOPICS = FAQ_CONTENT.slice(0, 5).map((f) => f.question);

/**
 * Лента новостей школы — макет 1:1.
 * Создание новостей только у супер-админа (кабинет SA) — кнопки «Создать» здесь нет.
 */
const News: React.FC = () => {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<PlatformNewsEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState<NewsCategory>('all');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [menuEntryId, setMenuEntryId] = useState<string | null>(null);
  const [subscribed, setSubscribed] = useState(true);
  const [subSaving, setSubSaving] = useState(false);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiService.listPlatformNews();
      setEntries(data || []);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось загрузить новости');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const prefs = await apiService.getSchoolNotificationPrefs();
        if (!cancelled) setSubscribed(Boolean(prefs.changelogEnabled));
      } catch {
        /* подписка опциональна — оставляем ON по умолчанию в UI */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return entries.filter((e) => {
      const cat = inferCategory(e);
      if (category !== 'all' && cat !== category) return false;
      if (!q) return true;
      return (
        (e.title || '').toLowerCase().includes(q) || (e.body || '').toLowerCase().includes(q)
      );
    });
  }, [entries, searchQuery, category]);

  const important = useMemo(() => {
    const hit = entries.find(isImportantLooking);
    return hit || entries[0] || null;
  }, [entries]);

  const handleSubscribe = async (next: boolean) => {
    setSubscribed(next);
    setSubSaving(true);
    try {
      await apiService.updateSchoolNotificationPrefs({ changelogEnabled: next });
    } catch {
      setSubscribed(!next);
    } finally {
      setSubSaving(false);
    }
  };

  const openMenu = (e: React.MouseEvent<HTMLElement>, id: string) => {
    e.stopPropagation();
    setMenuAnchor(e.currentTarget);
    setMenuEntryId(id);
  };

  const closeMenu = () => {
    setMenuAnchor(null);
    setMenuEntryId(null);
  };

  const copyLink = async () => {
    if (!menuEntryId) return;
    const url = `${window.location.origin}/news#${menuEntryId}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* ignore */
    }
    closeMenu();
  };

  return (
    <Box data-onboarding="news-page">
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 300px' },
          gap: { xs: 2, lg: 2.25 },
          alignItems: 'start',
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              alignItems: { xs: 'stretch', sm: 'flex-start' },
              justifyContent: 'space-between',
              gap: 1.5,
              mb: 2,
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography
                component="h1"
                sx={{
                  fontWeight: 800,
                  fontSize: { xs: typography.pageTitle.xs, md: typography.pageTitle.md },
                  color: '#1B2438',
                  letterSpacing: '-0.02em',
                  lineHeight: 1.2,
                }}
              >
                Новости
              </Typography>
              <Typography sx={{ mt: 0.75, fontSize: typography.label, color: '#8B93A7', maxWidth: 540, lineHeight: 1.45 }}>
                Все важные обновления системы, полезные материалы и объявления для вашей команды.
              </Typography>
            </Box>
            <TextField
              size="small"
              placeholder="Поиск по новостям..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: '#8B93A7', fontSize: 18 }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                width: { xs: '100%', sm: 240 },
                flexShrink: 0,
                '& .MuiOutlinedInput-root': {
                  borderRadius: '12px',
                  bgcolor: '#F7F8FB',
                  '& fieldset': { borderColor: '#E6EAF2' },
                },
              }}
            />
          </Box>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
            {CATEGORY_PILLS.map((p) => (
              <Chip
                key={p.key}
                label={p.label}
                clickable
                onClick={() => setCategory(p.key)}
                sx={filterPillSx(category === p.key)}
              />
            ))}
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: `${radii.panel}px` }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress sx={{ color: colors.primary }} />
            </Box>
          ) : filtered.length === 0 ? (
            <Box sx={{ ...cardSx, py: 6, textAlign: 'center' }}>
              <Typography sx={{ color: '#8B93A7', fontSize: 14 }}>Пока нет новостей</Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {filtered.map((entry) => {
                const cat = inferCategory(entry);
                const meta = CATEGORY_META[cat];
                const CatIcon = meta.Icon;
                const expanded = Boolean(expandedIds[entry.id]);
                const needsTruncate = (entry.body || '').length > BODY_PREVIEW;
                const bodyText =
                  expanded || !needsTruncate
                    ? entry.body
                    : `${(entry.body || '').slice(0, BODY_PREVIEW).trim()}…`;
                const recent = isRecent(entry.createdAt);

                return (
                  <Box
                    key={entry.id}
                    id={entry.id}
                    sx={{
                      ...cardSx,
                      p: 1.75,
                      display: 'flex',
                      flexDirection: { xs: 'column', sm: 'row' },
                      gap: 1.75,
                      position: 'relative',
                    }}
                  >
                    <Box
                      sx={{
                        position: 'relative',
                        width: { xs: '100%', sm: 148 },
                        height: { xs: 140, sm: 112 },
                        flexShrink: 0,
                        borderRadius: '12px',
                        overflow: 'hidden',
                        bgcolor: meta.bg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {entry.imageUrl ? (
                        <AuthNewsImage
                          id={entry.id}
                          hasImage
                          source="school"
                          silentFail
                          imgSx={{
                            mt: 0,
                            width: '100%',
                            height: '100%',
                            maxHeight: 'none',
                            objectFit: 'cover',
                            borderRadius: 0,
                          }}
                        />
                      ) : (
                        <CatIcon sx={{ fontSize: 36, color: meta.color, opacity: 0.85 }} />
                      )}
                      {recent && (
                        <Box
                          sx={{
                            position: 'absolute',
                            top: 8,
                            left: 8,
                            px: 0.85,
                            py: 0.25,
                            borderRadius: '999px',
                            bgcolor: '#EF4444',
                            color: '#fff',
                            fontSize: typography.hint,
                            fontWeight: 800,
                            letterSpacing: '0.04em',
                            lineHeight: 1.4,
                          }}
                        >
                          NEW
                        </Box>
                      )}
                    </Box>

                    <Box sx={{ flex: 1, minWidth: 0, pr: { sm: 3.5 } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.75 }}>
                        <Chip
                          size="small"
                          label={meta.label}
                          sx={{
                            height: 24,
                            fontWeight: 700,
                            fontSize: typography.label,
                            bgcolor: meta.bg,
                            color: meta.color,
                            borderRadius: '999px',
                          }}
                        />
                        <Typography sx={{ fontSize: typography.label, color: '#8B93A7' }}>
                          {formatNewsDateTime(entry.createdAt)}
                        </Typography>
                      </Box>
                      <Typography
                        sx={{
                          fontWeight: 800,
                          fontSize: { xs: 15, sm: 16 },
                          color: '#1B2438',
                          lineHeight: 1.3,
                          mb: 0.75,
                        }}
                      >
                        {entry.title}
                      </Typography>
                      <Typography
                        sx={{
                          fontSize: typography.label,
                          color: '#5D6B86',
                          lineHeight: 1.55,
                          whiteSpace: 'pre-wrap',
                          mb: 1,
                        }}
                      >
                        {bodyText}
                      </Typography>
                      {expanded && entry.imageUrl && (
                        <AuthNewsImage id={entry.id} hasImage source="school" />
                      )}
                      <Button
                        size="small"
                        endIcon={<ArrowForward sx={{ fontSize: 14 }} />}
                        onClick={() =>
                          setExpandedIds((prev) => ({ ...prev, [entry.id]: !prev[entry.id] }))
                        }
                        sx={{
                          textTransform: 'none',
                          fontWeight: 700,
                          fontSize: typography.label,
                          color: colors.primary,
                          px: 0,
                          minWidth: 0,
                          '&:hover': { bgcolor: 'transparent', color: colors.primaryDark },
                        }}
                      >
                        {expanded ? 'Свернуть' : 'Читать далее'}
                      </Button>
                    </Box>

                    <IconButton
                      size="small"
                      onClick={(e) => openMenu(e, entry.id)}
                      sx={{
                        position: 'absolute',
                        top: 10,
                        right: 10,
                        color: '#8B93A7',
                      }}
                      aria-label="Действия"
                    >
                      <MoreHoriz fontSize="small" />
                    </IconButton>
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>

        {/* Right column */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1.75,
            position: { lg: 'sticky' },
            top: { lg: 12 },
          }}
        >
          {important && (
            <Box
              sx={{
                ...cardSx,
                p: 2,
                bgcolor: '#FFF5F7',
                borderColor: '#F9C5D1',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.25 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.85 }}>
                  <CampaignOutlined sx={{ fontSize: 20, color: '#E11D48' }} />
                  <Typography sx={{ fontWeight: 800, fontSize: typography.label, color: '#9F1239' }}>Важное</Typography>
                </Box>
                {isRecent(important.createdAt) && (
                  <Chip
                    size="small"
                    label="Новое"
                    sx={{
                      height: 22,
                      fontSize: typography.label,
                      fontWeight: 700,
                      bgcolor: '#FEE2E2',
                      color: '#E11D48',
                    }}
                  />
                )}
              </Box>
              <Typography sx={{ fontWeight: 800, fontSize: 14, color: '#1B2438', mb: 0.5 }}>
                {important.title}
              </Typography>
              <Typography sx={{ fontSize: typography.label, color: '#8B93A7', mb: 1 }}>
                {formatNewsDateTime(important.createdAt)}
              </Typography>
              <Typography
                sx={{
                  fontSize: typography.label,
                  color: '#5D6B86',
                  lineHeight: 1.45,
                  mb: 1.5,
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {important.body}
              </Typography>
              <Button
                fullWidth
                variant="outlined"
                onClick={() => {
                  setExpandedIds((prev) => ({ ...prev, [important.id]: true }));
                  document.getElementById(important.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: typography.label,
                  borderRadius: `${radii.button}px`,
                  borderColor: '#F9C5D1',
                  color: '#9F1239',
                  bgcolor: '#fff',
                  '&:hover': { borderColor: '#E11D48', bgcolor: '#FFF1F2' },
                }}
              >
                Подробнее
              </Button>
            </Box>
          )}

          <Box sx={{ ...cardSx, p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: '10px',
                  bgcolor: '#EAF0FF',
                  color: colors.primary,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <StarOutline sx={{ fontSize: 18 }} />
              </Box>
              <Typography sx={{ fontWeight: 800, fontSize: 14, color: '#1B2438' }}>
                Популярные темы
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {POPULAR_TOPICS.map((topic, i) => (
                <Box
                  key={topic}
                  component="button"
                  type="button"
                  onClick={() => navigate('/faq')}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    width: '100%',
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    p: 0.85,
                    borderRadius: '10px',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                    '&:hover': { bgcolor: '#F7F8FB' },
                  }}
                >
                  <Box
                    sx={{
                      width: 22,
                      height: 22,
                      borderRadius: '999px',
                      bgcolor: '#EAF0FF',
                      color: colors.primary,
                      fontSize: typography.label,
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {i + 1}
                  </Box>
                  <Typography
                    sx={{
                      flex: 1,
                      fontSize: typography.label,
                      color: '#1B2438',
                      fontWeight: 500,
                      lineHeight: 1.35,
                      minWidth: 0,
                    }}
                  >
                    {topic}
                  </Typography>
                  <ChevronRight sx={{ fontSize: 18, color: '#8B93A7', flexShrink: 0 }} />
                </Box>
              ))}
            </Box>
          </Box>

          <Box sx={{ ...cardSx, p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25 }}>
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: '10px',
                  bgcolor: '#EAF0FF',
                  color: colors.primary,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <NotificationsNoneOutlined sx={{ fontSize: 20 }} />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                  <Typography sx={{ fontWeight: 800, fontSize: 14, color: '#1B2438' }}>
                    Подписка на новости
                  </Typography>
                  <Switch
                    checked={subscribed}
                    disabled={subSaving}
                    onChange={(_, v) => void handleSubscribe(v)}
                    size="small"
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': { color: colors.primary },
                      '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                        bgcolor: colors.primary,
                      },
                    }}
                  />
                </Box>
                <Typography sx={{ mt: 0.5, fontSize: typography.label, color: '#8B93A7', lineHeight: 1.4 }}>
                  Получайте важные обновления на email и в уведомлениях системы
                </Typography>
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu}>
        <MenuItem
          onClick={() => {
            if (menuEntryId) {
              setExpandedIds((prev) => ({ ...prev, [menuEntryId]: true }));
              document.getElementById(menuEntryId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            closeMenu();
          }}
        >
          <ArticleOutlined sx={{ fontSize: 18, mr: 1, color: '#8B93A7' }} />
          Читать полностью
        </MenuItem>
        <MenuItem onClick={() => void copyLink()}>Копировать ссылку</MenuItem>
      </Menu>
    </Box>
  );
};

export default News;
