import React from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
} from '@mui/material';
import {
  CalendarMonthOutlined,
  ChevronRight,
  Close,
  EmojiEvents,
  GroupsOutlined,
  MoreVert,
  PlaceOutlined,
  PublicOutlined,
  SecurityOutlined,
} from '@mui/icons-material';
import { colors, radii, typography } from '../../theme/tokens';

export type PortalCompetitionStatus = 'participation' | 'applied' | 'planned' | 'calendar';

export type PortalCompetition = {
  id: string;
  name: string;
  location?: string | null;
  startDate: string | Date;
  endDate?: string | Date | null;
  status?: PortalCompetitionStatus;
  categories?: string[];
  organizer?: string | null;
  participants?: Array<{
    id: string;
    firstName: string;
    lastName: string;
    isMe?: boolean;
  }>;
  participantCount?: number;
  results?: any[];
};

const STATUS_META: Record<
  PortalCompetitionStatus,
  { label: string; bg: string; color: string }
> = {
  participation: { label: 'Участие', bg: '#E6F8F3', color: '#00B69B' },
  applied: { label: 'Заявка подана', bg: '#FFF4E5', color: '#F08A4B' },
  planned: { label: 'Планируется', bg: '#EAF0FF', color: '#2F6BFF' },
  calendar: { label: 'В календаре', bg: '#F0F2F5', color: '#5D6B86' },
};

const cardSx = {
  bgcolor: colors.card,
  borderRadius: `${radii.panel}px`,
  boxShadow: '0 4px 18px rgba(32, 34, 36, 0.06)',
  border: '1px solid #EEF1F6',
} as const;

function formatRange(start?: string | Date | null, end?: string | Date | null): string {
  if (!start) return '—';
  const s = start instanceof Date ? start : new Date(start);
  const e = end ? (end instanceof Date ? end : new Date(end)) : null;
  if (Number.isNaN(s.getTime())) return '—';
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
  if (!e || Number.isNaN(e.getTime()) || s.toDateString() === e.toDateString()) {
    return s.toLocaleDateString('ru-RU', opts);
  }
  const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  if (sameMonth) {
    return `${s.getDate()}–${e.getDate()} ${s.toLocaleDateString('ru-RU', {
      month: 'long',
      year: 'numeric',
    })}`;
  }
  return `${s.toLocaleDateString('ru-RU', opts)} — ${e.toLocaleDateString('ru-RU', opts)}`;
}

function athleteLabel(p: { firstName: string; lastName: string }): string {
  return [p.firstName, p.lastName].filter(Boolean).join(' ').trim() || 'Спортсмен';
}

function AvatarStack({
  people,
  max = 5,
  size = 28,
}: {
  people: Array<{ id: string; firstName: string; lastName: string }>;
  max?: number;
  size?: number;
}) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center' }}>
      {shown.map((p, i) => {
        const name = athleteLabel(p);
        return (
          <Box
            key={p.id}
            title={name}
            sx={{
              width: size,
              height: size,
              borderRadius: '50%',
              bgcolor: colors.primary,
              color: '#fff',
              fontSize: size * 0.38,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: `2px solid ${colors.card}`,
              ml: i === 0 ? 0 : `-${size * 0.28}px`,
              zIndex: shown.length - i,
            }}
          >
            {name.slice(0, 1).toUpperCase()}
          </Box>
        );
      })}
      {extra > 0 && (
        <Box
          sx={{
            width: size,
            height: size,
            borderRadius: '50%',
            bgcolor: '#EEF1F6',
            color: colors.textMuted,
            fontSize: size * 0.32,
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: `2px solid ${colors.card}`,
            ml: `-${size * 0.28}px`,
          }}
        >
          +{extra}
        </Box>
      )}
    </Box>
  );
}

function CoverThumb({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  const h = size === 'lg' ? 160 : 72;
  const w = size === 'lg' ? '100%' : 88;
  return (
    <Box
      aria-hidden
      sx={{
        width: w,
        height: h,
        minWidth: size === 'sm' ? 88 : undefined,
        borderRadius: size === 'lg' ? `${radii.panel}px ${radii.panel}px 0 0` : '12px',
        background: 'linear-gradient(145deg, #5B8CFF 0%, #2F6BFF 50%, #1E4FD6 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'rgba(255,255,255,0.95)',
        flexShrink: 0,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <EmojiEvents sx={{ fontSize: size === 'lg' ? 56 : 32, opacity: 0.92 }} />
    </Box>
  );
}

function StatusChip({ status }: { status: PortalCompetitionStatus }) {
  const meta = STATUS_META[status];
  return (
    <Chip
      size="small"
      label={meta.label}
      sx={{
        height: 26,
        fontWeight: 700,
        fontSize: 12,
        bgcolor: meta.bg,
        color: meta.color,
        borderRadius: `${radii.pill}px`,
      }}
    />
  );
}

type Props = {
  competitions: PortalCompetition[];
};

/**
 * Список + деталь соревнований ЛК ученика (референс «Как должны отображаться соревнования»).
 */
const ClientCompetitionsBoard: React.FC<Props> = ({ competitions }) => {
  const [selectedId, setSelectedId] = React.useState<string | null>(competitions[0]?.id || null);
  const [participantsOpen, setParticipantsOpen] = React.useState(false);

  React.useEffect(() => {
    if (!competitions.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !competitions.some((c) => c.id === selectedId)) {
      setSelectedId(competitions[0].id);
    }
  }, [competitions, selectedId]);

  const selected = competitions.find((c) => c.id === selectedId) || null;
  const people = selected?.participants || [];

  if (!competitions.length) return null;

  return (
    <>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.45fr) minmax(280px, 0.9fr)' },
          gap: 2,
          alignItems: 'start',
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          {competitions.map((c) => {
            const active = c.id === selectedId;
            const status = c.status || 'calendar';
            const count = c.participantCount ?? c.participants?.length ?? 0;
            const cats = (c.categories || []).filter(Boolean);
            return (
              <Box
                key={c.id}
                component="button"
                type="button"
                onClick={() => setSelectedId(c.id)}
                sx={{
                  ...cardSx,
                  p: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  width: '100%',
                  border: active ? `1.5px solid ${colors.primary}` : '1px solid #EEF1F6',
                  boxShadow: active
                    ? '0 6px 18px rgba(47, 107, 255, 0.12)'
                    : cardSx.boxShadow,
                  '&:hover': { borderColor: active ? colors.primary : colors.primarySoft },
                }}
              >
                <CoverThumb />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    sx={{
                      fontWeight: 800,
                      fontSize: { xs: 14, md: 15 },
                      color: colors.text,
                      mb: 0.35,
                      lineHeight: 1.25,
                    }}
                  >
                    {c.name}
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25, mb: 0.35 }}>
                    {c.location ? (
                      <Typography
                        sx={{
                          fontSize: typography.hint,
                          color: colors.textMuted,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 0.4,
                        }}
                      >
                        <PublicOutlined sx={{ fontSize: 14 }} />
                        {c.location}
                      </Typography>
                    ) : null}
                    <Typography
                      sx={{
                        fontSize: typography.hint,
                        color: colors.textMuted,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.4,
                      }}
                    >
                      <CalendarMonthOutlined sx={{ fontSize: 14 }} />
                      {formatRange(c.startDate, c.endDate)}
                    </Typography>
                  </Box>
                  {cats.length > 0 && (
                    <Typography sx={{ fontSize: typography.hint, color: colors.textHint }}>
                      Возрастные категории: {cats.join(', ')}
                    </Typography>
                  )}
                </Box>

                <Box
                  sx={{
                    display: { xs: 'none', sm: 'flex' },
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    gap: 0.75,
                    flexShrink: 0,
                    minWidth: 120,
                  }}
                >
                  <StatusChip status={status} />
                  <Typography sx={{ fontSize: typography.hint, color: colors.textMuted, fontWeight: 600 }}>
                    {count}{' '}
                    {count === 1 ? 'спортсмен' : count >= 2 && count <= 4 ? 'спортсмена' : 'спортсменов'}
                  </Typography>
                  <AvatarStack people={c.participants || []} max={4} size={26} />
                </Box>

                <ChevronRight sx={{ color: colors.textHint, flexShrink: 0, display: { xs: 'none', md: 'block' } }} />
              </Box>
            );
          })}
        </Box>

        {selected && (
          <Box
            sx={{
              ...cardSx,
              overflow: 'hidden',
              position: { lg: 'sticky' },
              top: { lg: 12 },
            }}
          >
            <Box sx={{ position: 'relative' }}>
              <CoverThumb size="lg" />
              <Box sx={{ position: 'absolute', top: 12, right: 12 }}>
                <StatusChip status={selected.status || 'calendar'} />
              </Box>
            </Box>

            <Box sx={{ p: { xs: 2, md: 2.25 } }}>
              <Typography
                sx={{
                  fontWeight: 800,
                  fontSize: { xs: 18, md: 20 },
                  color: colors.text,
                  mb: 1.5,
                  letterSpacing: '-0.02em',
                }}
              >
                {selected.name}
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
                <Typography
                  sx={{
                    fontSize: typography.label,
                    color: colors.textMuted,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                  }}
                >
                  <CalendarMonthOutlined sx={{ fontSize: 18, color: colors.primary }} />
                  {formatRange(selected.startDate, selected.endDate)}
                </Typography>
                {selected.location ? (
                  <Typography
                    sx={{
                      fontSize: typography.label,
                      color: colors.textMuted,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                    }}
                  >
                    <PlaceOutlined sx={{ fontSize: 18, color: colors.primary }} />
                    {selected.location}
                  </Typography>
                ) : null}
                {selected.organizer ? (
                  <Typography
                    sx={{
                      fontSize: typography.label,
                      color: colors.textMuted,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                    }}
                  >
                    <SecurityOutlined sx={{ fontSize: 18, color: colors.primary }} />
                    Организатор: {selected.organizer}
                  </Typography>
                ) : null}
                {(selected.categories || []).length > 0 ? (
                  <Typography
                    sx={{
                      fontSize: typography.label,
                      color: colors.textMuted,
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 1,
                    }}
                  >
                    <GroupsOutlined sx={{ fontSize: 18, color: colors.primary, mt: 0.15 }} />
                    Возрастные категории {(selected.categories || []).join(', ')}
                  </Typography>
                ) : null}
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography
                  sx={{
                    fontWeight: 800,
                    fontSize: typography.label,
                    color: colors.text,
                    mb: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.75,
                  }}
                >
                  <EmojiEvents sx={{ fontSize: 16, color: '#F08A4B' }} />
                  Наши спортсмены ({people.length})
                </Typography>
                <AvatarStack people={people} max={8} size={36} />
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Button
                  fullWidth
                  variant="contained"
                  onClick={() => setParticipantsOpen(true)}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 700,
                    borderRadius: `${radii.button}px`,
                    bgcolor: colors.primary,
                    boxShadow: '0 6px 16px rgba(47, 107, 255, 0.28)',
                    py: 1.15,
                    '&:hover': { bgcolor: colors.primaryDark },
                  }}
                >
                  Посмотреть участников
                </Button>
                <IconButton
                  aria-label="Ещё"
                  sx={{
                    border: `1px solid ${colors.divider}`,
                    borderRadius: `${radii.button}px`,
                    color: colors.textMuted,
                  }}
                >
                  <MoreVert />
                </IconButton>
              </Box>
            </Box>
          </Box>
        )}
      </Box>

      <Dialog open={participantsOpen} onClose={() => setParticipantsOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1 }}>
          <Typography sx={{ fontWeight: 800, fontSize: typography.panelTitle }}>
            Участники{selected ? ` · ${selected.name}` : ''}
          </Typography>
          <IconButton aria-label="Закрыть" onClick={() => setParticipantsOpen(false)}>
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {people.map((p) => (
              <Box
                key={p.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.25,
                  py: 0.75,
                }}
              >
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    bgcolor: colors.primary,
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: 14,
                  }}
                >
                  {athleteLabel(p).slice(0, 1).toUpperCase()}
                </Box>
                <Typography sx={{ fontWeight: 700, fontSize: typography.label, color: colors.text }}>
                  {athleteLabel(p)}
                  {p.isMe ? ' (вы)' : ''}
                </Typography>
              </Box>
            ))}
            {people.length === 0 && (
              <Typography sx={{ color: colors.textMuted, fontSize: typography.label }}>
                Список участников пуст
              </Typography>
            )}
          </Box>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ClientCompetitionsBoard;
