import React from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Menu,
  MenuItem,
  Snackbar,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import {
  Add,
  CalendarMonthOutlined,
  CheckCircleOutline,
  ChevronLeft,
  ChevronRight,
  DirectionsRun,
  EmojiEvents,
  EmojiEventsOutlined,
  EventOutlined,
  MoreVert,
  PeopleAltOutlined,
  PeopleOutline,
  ViewAgendaOutlined,
  ViewWeekOutlined,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { apiService } from '../../services/api';
import { colors, radii, typography } from '../../theme/tokens';
import { toIso } from '../dashboard/MonthCalendar';
import ClientCompetitionsBoard from './ClientCompetitionsBoard';

interface Props {
  clientId?: string;
}

type PlanView = 'month' | 'week' | 'list';
type EventKind = 'training' | 'competition' | 'event' | 'other';

const KIND_META: Record<
  EventKind,
  { label: string; color: string; soft: string }
> = {
  training: { label: 'Тренировки', color: '#2F6BFF', soft: '#E8F0FF' },
  competition: { label: 'Соревнования', color: '#F06292', soft: '#FDE8EF' },
  event: { label: 'Мероприятия', color: '#00B69B', soft: '#E6F8F3' },
  other: { label: 'Другое', color: '#7E57C2', soft: '#F0E9FF' },
};

const MONTHS = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

type PlanEvent = {
  id: string;
  kind: EventKind;
  title: string;
  start: Date;
  end: Date;
  location?: string | null;
};

function timeLabel(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatDate(iso?: string | Date | null): string {
  if (!iso) return '—';
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('ru-RU');
}

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const offset = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - offset);
  return x;
}

function buildMonthGrid(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - offset);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function eventIcon(kind: EventKind) {
  if (kind === 'training') return <DirectionsRun sx={{ fontSize: 20 }} />;
  if (kind === 'competition') return <EmojiEvents sx={{ fontSize: 20 }} />;
  if (kind === 'event') return <EventOutlined sx={{ fontSize: 20 }} />;
  return <PeopleOutline sx={{ fontSize: 20 }} />;
}

const ClientCalendarPlan: React.FC<Props> = ({ clientId }) => {
  const [section, setSection] = React.useState<'schedule' | 'competitions'>('schedule');
  const [month, setMonth] = React.useState(() => new Date());
  const [selectedDay, setSelectedDay] = React.useState<string>(() => toIso(new Date()));
  const [view, setView] = React.useState<PlanView>('month');
  const [layers, setLayers] = React.useState<Record<EventKind, boolean>>({
    training: true,
    competition: true,
    event: true,
    other: true,
  });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [trainings, setTrainings] = React.useState<any[]>([]);
  const [competitions, setCompetitions] = React.useState<any[]>([]);
  const [snack, setSnack] = React.useState('');
  const [menuAnchor, setMenuAnchor] = React.useState<null | HTMLElement>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    const from =
      section === 'competitions'
        ? new Date(month.getFullYear() - 1, 0, 1)
        : view === 'week'
          ? startOfWeek(month)
        : new Date(month.getFullYear(), month.getMonth(), 1);
    const to =
      section === 'competitions'
        ? new Date(month.getFullYear() + 2, 0, 1)
        : view === 'week'
          ? (() => {
              const s = startOfWeek(month);
              const e = new Date(s);
              e.setDate(s.getDate() + 7);
              return e;
            })()
        : new Date(month.getFullYear(), month.getMonth() + 1, 1);
    (async () => {
      try {
        const data = await apiService.getClientCalendarPlan({
          clientId,
          from: from.toISOString(),
          to: to.toISOString(),
        });
        if (cancelled) return;
        setTrainings(data.trainings || []);
        setCompetitions(data.competitions || []);
      } catch (e: any) {
        if (!cancelled) setError(e?.response?.data?.error || 'Не удалось загрузить календарь');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId, month, section, view]);

  const events: PlanEvent[] = React.useMemo(() => {
    const list: PlanEvent[] = [
      ...trainings.map((t) => ({
        id: `t-${t.id}`,
        kind: 'training' as const,
        title: t.groupName || t.title || 'Тренировка',
        start: new Date(t.startTime),
        end: new Date(t.endTime || t.startTime),
        location: [t.branchName, t.hallName].filter(Boolean).join(' · ') || null,
      })),
      ...competitions.map((c) => {
        const start = new Date(c.startDate);
        start.setHours(10, 0, 0, 0);
        const end = new Date(c.endDate || c.startDate);
        end.setHours(18, 0, 0, 0);
        return {
          id: `c-${c.id}`,
          kind: 'competition' as const,
          title: c.name || 'Соревнование',
          start,
          end,
          location: c.location || null,
        };
      }),
    ];
    return list
      .filter((e) => layers[e.kind])
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [trainings, competitions, layers]);

  const eventsByDay = React.useMemo(() => {
    const map = new Map<string, PlanEvent[]>();
    events.forEach((e) => {
      const key = toIso(e.start);
      const arr = map.get(key) || [];
      arr.push(e);
      map.set(key, arr);
    });
    return map;
  }, [events]);

  const dayEvents = eventsByDay.get(selectedDay) || [];
  const selectedDate = new Date(selectedDay + 'T12:00:00');
  const todayIso = toIso(new Date());
  const grid = React.useMemo(() => buildMonthGrid(month), [month]);
  const weekDays = React.useMemo(() => {
    const start = startOfWeek(month);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [month]);

  const goToday = () => {
        const now = new Date();
    setMonth(now);
    setSelectedDay(toIso(now));
  };

  const shift = (delta: number) => {
    if (view === 'week') {
      setMonth((m) => {
        const n = new Date(m);
        n.setDate(n.getDate() + delta * 7);
        return n;
      });
    } else {
      setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
    }
  };

  const onAdd = () => {
    setSnack('Добавление личных событий скоро будет доступно. Пока события формирует школа.');
    setMenuAnchor(null);
  };

  const cardSx = {
    bgcolor: colors.card,
    borderRadius: `${radii.panel}px`,
    boxShadow: '0 4px 18px rgba(32, 34, 36, 0.06)',
    border: '1px solid #EEF1F6',
  };

  const renderDayPanel = () => (
    <Box
      sx={{
        ...cardSx,
        p: { xs: 2, md: 2.25 },
        minHeight: { lg: 520 },
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Typography
        sx={{
          fontWeight: 800,
          fontSize: { xs: 15, md: 16 },
          color: colors.text,
          mb: 2,
          textTransform: 'capitalize',
        }}
      >
        {format(selectedDate, 'EEEE, d MMMM yyyy', { locale: ru })}
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, flex: 1 }}>
        {dayEvents.map((ev) => {
          const meta = KIND_META[ev.kind];
          return (
            <Box
              key={ev.id}
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1.25,
                p: 1.5,
                borderRadius: `${radii.cell}px`,
                bgcolor: colors.surface,
                border: '1px solid #EEF1F6',
              }}
            >
              <Box
                aria-hidden
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  bgcolor: meta.soft,
                  color: meta.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {eventIcon(ev.kind)}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: typography.hint, color: colors.textMuted, fontWeight: 600 }}>
                  {timeLabel(ev.start)} – {timeLabel(ev.end)}
                </Typography>
                <Typography sx={{ fontWeight: 800, fontSize: typography.label, color: colors.text }}>
                  {ev.title}
                </Typography>
                {ev.location && (
                  <Typography sx={{ fontSize: typography.hint, color: colors.textMuted, mt: 0.25 }}>
                    {ev.location}
                  </Typography>
                )}
              </Box>
              <IconButton
                size="small"
                aria-label="Действия"
                onClick={(e) => setMenuAnchor(e.currentTarget)}
                sx={{ color: colors.textHint }}
              >
                <MoreVert fontSize="small" />
              </IconButton>
            </Box>
          );
        })}

        <Box
          sx={{
            mt: 'auto',
            pt: 2,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          <Box
            aria-hidden
            sx={{
              position: 'relative',
              width: 64,
              height: 64,
              mb: 1.25,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Box
              sx={{
                width: 52,
                height: 52,
                borderRadius: 2.5,
                bgcolor: '#EAF0FF',
                color: colors.primary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CalendarMonthOutlined sx={{ fontSize: 28 }} />
            </Box>
            <Box
              sx={{
                position: 'absolute',
                right: 0,
                bottom: 2,
                width: 22,
                height: 22,
                borderRadius: '50%',
                bgcolor: colors.card,
                boxShadow: '0 2px 8px rgba(32,34,36,0.12)',
                color: colors.success,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CheckCircleOutline sx={{ fontSize: 16 }} />
            </Box>
          </Box>
          <Typography sx={{ fontWeight: 800, fontSize: typography.label, color: colors.text, mb: 0.35 }}>
            {dayEvents.length === 0 ? 'На этот день событий нет' : 'Больше событий нет'}
          </Typography>
          <Typography sx={{ fontSize: typography.hint, color: colors.textMuted, mb: 1.5, maxWidth: 260 }}>
            {dayEvents.length === 0
              ? 'Вы можете добавить новое событие в календарь'
              : `На этот день запланировано ${dayEvents.length} ${
                  dayEvents.length === 1 ? 'событие' : dayEvents.length < 5 ? 'события' : 'событий'
                }. Можно добавить ещё.`}
          </Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={onAdd}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              borderRadius: `${radii.button}px`,
              bgcolor: '#E8F0FF',
              color: colors.primary,
              boxShadow: 'none',
              px: 2,
              '&:hover': { bgcolor: '#D6E4FF' },
            }}
          >
            Добавить событие
          </Button>
        </Box>
      </Box>
    </Box>
  );

  const renderMonthGrid = () => (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
        gap: 0.75,
      }}
    >
      {WEEKDAYS.map((w) => (
        <Typography
          key={w}
          sx={{
            textAlign: 'center',
            fontSize: typography.hint,
            color: colors.textMuted,
            fontWeight: 700,
            pb: 0.5,
          }}
        >
          {w}
        </Typography>
      ))}
      {grid.map((day) => {
        const iso = toIso(day);
        const inMonth = day.getMonth() === month.getMonth();
        const list = eventsByDay.get(iso) || [];
        const selected = selectedDay === iso;
        const isToday = iso === todayIso;
        return (
          <Box
            key={iso}
            component="button"
            type="button"
            onClick={() => setSelectedDay(iso)}
            sx={{
              border: selected ? `2px solid ${colors.primary}` : '1px solid #EEF1F6',
              borderRadius: `${radii.cell}px`,
              minHeight: { xs: 72, md: 96 },
              p: 0.75,
              bgcolor: selected ? '#F3F7FF' : inMonth ? colors.card : '#FAFBFD',
              cursor: 'pointer',
              fontFamily: 'inherit',
              textAlign: 'left',
              opacity: inMonth ? 1 : 0.55,
              display: 'flex',
              flexDirection: 'column',
              gap: 0.35,
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13,
                fontWeight: 800,
                color: selected || isToday ? colors.white : colors.text,
                bgcolor: selected ? colors.primary : isToday ? colors.primarySoft : 'transparent',
              }}
            >
              {day.getDate()}
            </Box>
            {list.slice(0, 2).map((ev) => (
              <Box
                key={ev.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.4,
                  minWidth: 0,
                }}
              >
                <Box
                  sx={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    bgcolor: KIND_META[ev.kind].color,
                    flexShrink: 0,
                  }}
                />
                <Typography
                  sx={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: colors.text,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {ev.title} {timeLabel(ev.start)}
                </Typography>
              </Box>
            ))}
            {list.length > 2 && (
              <Typography sx={{ fontSize: 10, color: colors.textHint, fontWeight: 600 }}>
                +{list.length - 2}
              </Typography>
            )}
          </Box>
        );
      })}
    </Box>
  );

  const renderWeekGrid = () => (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
        gap: 0.75,
      }}
    >
      {weekDays.map((day, i) => {
        const iso = toIso(day);
        const list = eventsByDay.get(iso) || [];
        const selected = selectedDay === iso;
        return (
          <Box
            key={iso}
            component="button"
            type="button"
            onClick={() => setSelectedDay(iso)}
            sx={{
              border: selected ? `2px solid ${colors.primary}` : '1px solid #EEF1F6',
              borderRadius: `${radii.cell}px`,
              minHeight: 160,
              p: 1,
              bgcolor: selected ? '#F3F7FF' : colors.card,
              cursor: 'pointer',
              fontFamily: 'inherit',
              textAlign: 'left',
            }}
          >
            <Typography sx={{ fontWeight: 800, fontSize: 13, mb: 1, color: colors.text }}>
              {WEEKDAYS[i]} {day.getDate()}
            </Typography>
            {list.length === 0 ? (
              <Typography sx={{ fontSize: 12, color: colors.textEmpty }}>—</Typography>
            ) : (
              list.map((ev) => (
                <Box key={ev.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                  <Box
                    sx={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      bgcolor: KIND_META[ev.kind].color,
                    }}
                  />
                  <Typography sx={{ fontSize: 11, fontWeight: 600, color: colors.text }}>
                    {timeLabel(ev.start)} {ev.title}
                  </Typography>
                </Box>
              ))
            )}
          </Box>
        );
      })}
    </Box>
  );

  const renderList = () => {
    const monthEvents = events.filter(
      (e) => e.start.getMonth() === month.getMonth() && e.start.getFullYear() === month.getFullYear()
    );
    if (monthEvents.length === 0) {
      return (
        <Typography sx={{ color: colors.textEmpty, fontSize: typography.label, py: 4, textAlign: 'center' }}>
          В этом месяце событий нет
        </Typography>
      );
    }
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {monthEvents.map((ev) => (
          <Box
            key={ev.id}
            component="button"
            type="button"
            onClick={() => setSelectedDay(toIso(ev.start))}
            sx={{
              border: '1px solid #EEF1F6',
              borderRadius: `${radii.cell}px`,
              bgcolor: colors.surface,
              p: 1.5,
              display: 'flex',
              alignItems: 'center',
              gap: 1.25,
              cursor: 'pointer',
              fontFamily: 'inherit',
              textAlign: 'left',
            }}
          >
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                bgcolor: KIND_META[ev.kind].color,
                flexShrink: 0,
              }}
            />
            <Typography sx={{ fontWeight: 700, fontSize: typography.label, minWidth: 72 }}>
              {formatDate(ev.start)}
            </Typography>
            <Typography sx={{ fontSize: typography.hint, color: colors.textMuted, minWidth: 90 }}>
              {timeLabel(ev.start)} – {timeLabel(ev.end)}
            </Typography>
            <Typography sx={{ fontWeight: 700, fontSize: typography.label, flex: 1 }}>
              {ev.title}
            </Typography>
          </Box>
        ))}
      </Box>
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Tabs
        value={section}
        onChange={(_, v) => setSection(v)}
        sx={{
          minHeight: 40,
          borderBottom: `1px solid ${colors.divider}`,
          '& .MuiTab-root': {
            textTransform: 'none',
            fontWeight: 700,
            fontSize: typography.label,
            minHeight: 40,
            color: colors.textMuted,
          },
          '& .Mui-selected': { color: `${colors.primary} !important` },
          '& .MuiTabs-indicator': { bgcolor: colors.primary, height: 3, borderRadius: 2 },
        }}
      >
        <Tab
          value="schedule"
          icon={<CalendarMonthOutlined sx={{ fontSize: 18 }} />}
          iconPosition="start"
          label="Расписание"
        />
        <Tab
          value="competitions"
          icon={<EmojiEventsOutlined sx={{ fontSize: 18 }} />}
          iconPosition="start"
          label="Соревнования"
        />
      </Tabs>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={32} />
        </Box>
      ) : error ? (
        <Typography sx={{ color: colors.danger, fontSize: typography.label }}>{error}</Typography>
      ) : section === 'schedule' ? (
        <>
          <Box
            sx={{
              ...cardSx,
              px: { xs: 1.5, md: 2 },
              py: 1.25,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1.5,
              flexWrap: 'wrap',
            }}
          >
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {(Object.keys(KIND_META) as EventKind[]).map((kind) => {
                const meta = KIND_META[kind];
                const active = layers[kind];
                return (
                  <Chip
                    key={kind}
                    clickable
                    onClick={() => setLayers((prev) => ({ ...prev, [kind]: !prev[kind] }))}
                    label={
                      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            bgcolor: meta.color,
                          }}
                        />
                        {meta.label}
                      </Box>
                    }
                    sx={{
                      fontWeight: 700,
                      bgcolor: active ? meta.soft : colors.surface,
                      color: active ? colors.text : colors.textHint,
                      opacity: active ? 1 : 0.7,
                      border: `1px solid ${active ? meta.soft : colors.divider}`,
                    }}
                  />
                );
              })}
            </Box>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={onAdd}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                borderRadius: `${radii.button}px`,
                bgcolor: colors.primary,
                boxShadow: '0 6px 16px rgba(47, 107, 255, 0.28)',
                px: 2,
                '&:hover': { bgcolor: colors.primaryDark },
              }}
            >
              Добавить в календарь
            </Button>
          </Box>

        <Box
          sx={{
            display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: '1.55fr 1fr' },
              gap: { xs: 2, md: 2.5 },
              alignItems: 'stretch',
            }}
          >
            <Box sx={{ ...cardSx, p: { xs: 1.5, md: 2 } }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 1,
                  flexWrap: 'wrap',
                  mb: 2,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                  <IconButton size="small" onClick={() => shift(-1)} aria-label="Назад">
                    <ChevronLeft />
                  </IconButton>
                  <IconButton size="small" onClick={() => shift(1)} aria-label="Вперёд">
                    <ChevronRight />
                  </IconButton>
                  <Button
                    size="small"
                    onClick={goToday}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 700,
                      borderRadius: `${radii.button}px`,
                      bgcolor: colors.surface,
                      color: colors.text,
                      px: 1.5,
                    }}
                  >
                    Сегодня
                  </Button>
                  <Typography sx={{ fontWeight: 800, fontSize: typography.panelTitle, ml: 0.5 }}>
                    {MONTHS[month.getMonth()]} {month.getFullYear()}
                  </Typography>
                </Box>

                <Box
                  sx={{
                    display: 'inline-flex',
                    bgcolor: colors.surface,
                    borderRadius: `${radii.button}px`,
                    p: 0.35,
                    gap: 0.25,
                  }}
                >
                  {(
                    [
                      { id: 'month' as const, label: 'Месяц', icon: <CalendarMonthOutlined sx={{ fontSize: 16 }} /> },
                      { id: 'week' as const, label: 'Неделя', icon: <ViewWeekOutlined sx={{ fontSize: 16 }} /> },
                      { id: 'list' as const, label: 'Список', icon: <ViewAgendaOutlined sx={{ fontSize: 16 }} /> },
                    ] as const
                  ).map((v) => (
                    <Button
                      key={v.id}
                      size="small"
                      startIcon={v.icon}
                      onClick={() => setView(v.id)}
                      sx={{
                        textTransform: 'none',
                        fontWeight: 700,
                        borderRadius: `${radii.button - 2}px`,
                        px: 1.25,
                        minWidth: 0,
                        bgcolor: view === v.id ? colors.card : 'transparent',
                        color: view === v.id ? colors.primary : colors.textMuted,
                        boxShadow: view === v.id ? '0 1px 4px rgba(32,34,36,0.08)' : 'none',
                      }}
                    >
                      {v.label}
                    </Button>
                  ))}
                </Box>
              </Box>

              {view === 'month' && renderMonthGrid()}
              {view === 'week' && renderWeekGrid()}
              {view === 'list' && renderList()}
            </Box>

            {renderDayPanel()}
          </Box>
        </>
      ) : competitions.length === 0 ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box
            sx={{
              ...cardSx,
              p: { xs: 3, md: 4.5 },
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              minHeight: 280,
            }}
          >
            <Box
              aria-hidden
              sx={{
                position: 'relative',
                width: 120,
                height: 120,
                mb: 2.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Box
                sx={{
                  width: 96,
                  height: 96,
                  borderRadius: '28px',
                  background: 'linear-gradient(160deg, #5B8CFF 0%, #2F6BFF 55%, #1E4FD6 100%)',
                  boxShadow: '0 14px 28px rgba(47, 107, 255, 0.28)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                }}
              >
                <EmojiEvents sx={{ fontSize: 52 }} />
              </Box>
              <Box
                sx={{
                  position: 'absolute',
                  top: 10,
                  left: 6,
                  width: 10,
                  height: 10,
                  borderRadius: '3px',
                  bgcolor: '#FF8A3D',
                  transform: 'rotate(18deg)',
                }}
              />
              <Box
                sx={{
                  position: 'absolute',
                  top: 18,
                  right: 8,
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: '#2F6BFF',
                }}
              />
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 16,
                  left: 14,
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  bgcolor: '#00B69B',
                }}
              />
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 22,
                  right: 4,
                  width: 12,
                  height: 3,
                  borderRadius: 2,
                  bgcolor: '#FFB84D',
                  transform: 'rotate(-20deg)',
                }}
              />
        </Box>
            <Typography sx={{ fontWeight: 800, fontSize: { xs: 18, md: 20 }, color: colors.text, mb: 0.75 }}>
              Мои соревнования
            </Typography>
            <Typography sx={{ fontSize: typography.label, color: colors.textMuted, maxWidth: 420 }}>
              Вы пока не зарегистрированы ни на одно соревнование
            </Typography>
          </Box>

          <Box
            sx={{
              ...cardSx,
              bgcolor: '#EEF4FF',
              border: '1px solid #D9E6FF',
              boxShadow: 'none',
              p: { xs: 2, md: 2.25 },
              display: 'flex',
              alignItems: 'flex-start',
              gap: 1.75,
            }}
          >
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                bgcolor: colors.primary,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 6px 14px rgba(47, 107, 255, 0.28)',
              }}
            >
              <PeopleAltOutlined sx={{ fontSize: 22 }} />
                          </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 800, fontSize: typography.label, color: colors.text, mb: 0.5 }}>
                Как попасть на соревнование?
              </Typography>
              <Typography sx={{ fontSize: typography.hint, color: colors.textMuted, lineHeight: 1.55 }}>
                Регистрация на соревнования осуществляется вашим тренером. Он формирует заявку и добавляет вас
                в список участников.
              </Typography>
            </Box>
          </Box>
        </Box>
      ) : (
        <ClientCompetitionsBoard competitions={competitions} />
      )}

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
        <MenuItem onClick={onAdd}>Добавить напоминание</MenuItem>
      </Menu>
      <Snackbar open={Boolean(snack)} autoHideDuration={3500} onClose={() => setSnack('')} message={snack} />
    </Box>
  );
};

export default ClientCalendarPlan;
