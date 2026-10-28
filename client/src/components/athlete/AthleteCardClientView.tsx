import React from 'react';
import {
  Avatar,
  Box,
  Button,
  ButtonBase,
  IconButton,
  Typography,
} from '@mui/material';
import {
  CalendarMonthOutlined,
  CameraAlt,
  ChevronLeft,
  ChevronRight,
  DescriptionOutlined,
  EditOutlined,
  EmailOutlined,
  EmojiEventsOutlined,
  GroupsOutlined,
  LocationOnOutlined,
  MaleOutlined,
  PeopleOutline,
  PersonOutline,
  PhoneOutlined,
  ScaleOutlined,
  StorefrontOutlined,
  CloudUploadOutlined,
  AssignmentOutlined,
} from '@mui/icons-material';
import { colors, radii, typography } from '../../theme/tokens';
import { AthleteCardData, AthleteCalendarEvent, AthleteCompetitionResultRow, GENDER_LABELS } from './athleteCardTypes';
import { calcAge, deriveSecondaryMeta, formatDateRu, fullName } from './athleteCardUtils';
import { Parent } from '../../types';

const cardSx = {
  bgcolor: colors.card,
  borderRadius: `${radii.panel}px`,
  boxShadow: '0 4px 18px rgba(32, 34, 36, 0.06)',
  border: '1px solid #EEF1F6',
};

const DAY_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

function InfoCell({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25, minWidth: 0 }}>
      <Box
        aria-hidden
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
          '& svg': { fontSize: 18 },
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: typography.hint, color: colors.textHint, mb: 0.15 }}>
          {label}
        </Typography>
        <Typography
          sx={{
            fontSize: typography.label,
            fontWeight: 700,
            color: colors.text,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {value}
        </Typography>
      </Box>
    </Box>
  );
}

function EmptyBlock({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        py: { xs: 3, md: 4 },
        px: 2,
      }}
    >
      <Box
        aria-hidden
        sx={{
          width: 72,
          height: 72,
          borderRadius: '20px',
          bgcolor: '#EAF0FF',
          color: colors.primary,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 1.75,
          '& svg': { fontSize: 36 },
        }}
      >
        {icon}
      </Box>
      <Typography sx={{ fontWeight: 800, fontSize: typography.label, color: colors.text, mb: 0.5 }}>
        {title}
      </Typography>
      <Typography sx={{ fontSize: typography.hint, color: colors.textMuted, maxWidth: 420, mb: action ? 2 : 0 }}>
        {subtitle}
      </Typography>
      {action}
    </Box>
  );
}

type Props = {
  data: AthleteCardData;
  events: AthleteCalendarEvent[];
  results: AthleteCompetitionResultRow[];
  parents: Parent[];
  onEdit: () => void;
  onTrainerClick?: (trainerId: string) => void;
  onAddParent?: () => void;
  onUploadDoc?: () => void;
};

/**
 * Карточка спортсмена ЛК клиента — макет Reference LK clients (без плашки «Активный»).
 */
const AthleteCardClientView: React.FC<Props> = ({
  data,
  events,
  results,
  parents,
  onEdit,
  onTrainerClick,
  onAddParent,
  onUploadDoc,
}) => {
  const name = fullName(data);
  const age = calcAge(data.dateOfBirth);
  const meta = deriveSecondaryMeta(data);
  const [weekStart, setWeekStart] = React.useState(() => startOfWeek(new Date()));
  const [selectedDayIso, setSelectedDayIso] = React.useState(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t.toISOString();
  });

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const eventsForDay = (day: Date) =>
    events.filter((e) => {
      const raw = e.startTime || e.startDate;
      if (!raw) return false;
      const ed = new Date(raw);
      return (
        ed.getFullYear() === day.getFullYear() &&
        ed.getMonth() === day.getMonth() &&
        ed.getDate() === day.getDate()
      );
    });

  const weekHasEvents = days.some((d) => eventsForDay(d).length > 0);
  const dobLabel = data.dateOfBirth
    ? `${formatDateRu(data.dateOfBirth)}${age != null ? ` (${age} лет)` : ''}`
    : '—';
  const genderLabel = GENDER_LABELS[data.gender || ''] || data.gender || '—';
  const weightLabel = data.weight != null ? `${data.weight} кг` : '— кг';
  const phoneLabel = data.phone || '—';
  const emailLabel = data.email || 'Email не указан';

  const hasBirth =
    Boolean(data.hasBirthCertificate) || Boolean(data.birthCertificateNumber);
  const hasMedical =
    Boolean(data.hasMedicalCertificate) || Boolean(data.medicalCertificateNumber);
  const hasPassport = Boolean(data.passportSeries || data.passportNumber);

  const docCards = [
    {
      title: 'Свидетельство о рождении',
      present: hasBirth,
      meta: data.birthCertificateNumber ? `№ ${data.birthCertificateNumber}` : undefined,
    },
    {
      title: 'Справка',
      present: hasMedical,
      meta: data.medicalCertificateNumber ? `№ ${data.medicalCertificateNumber}` : undefined,
    },
    {
      title: 'Паспорт',
      present: hasPassport,
      meta: hasPassport
        ? `${data.passportSeries || ''} ${data.passportNumber || ''}`.trim()
        : undefined,
    },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 2, md: 2.5 } }}>
      {/* Профиль */}
      <Box sx={{ ...cardSx, p: { xs: 2, md: 2.5 } }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: { xs: 2, md: 2.5 },
            alignItems: { xs: 'center', sm: 'flex-start' },
          }}
        >
          <Box sx={{ textAlign: 'center', flexShrink: 0 }}>
            <Avatar
              src={data.photo || undefined}
              sx={{
                width: { xs: 104, md: 120 },
                height: { xs: 104, md: 120 },
                bgcolor: '#EAF0FF',
                mx: 'auto',
              }}
            >
              {!data.photo && <CameraAlt sx={{ fontSize: 36, color: colors.primary }} />}
            </Avatar>
            {!data.photo && (
              <Typography sx={{ mt: 0.75, fontSize: typography.hint, color: colors.textEmpty }}>
                Нет фотографии
              </Typography>
            )}
          </Box>

          <Box sx={{ flex: 1, minWidth: 0, width: '100%' }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 1.5,
                mb: 2,
                flexWrap: 'wrap',
              }}
            >
              <Typography
                sx={{
                  fontSize: { xs: 22, md: 28 },
                  fontWeight: 800,
                  color: colors.text,
                  lineHeight: 1.15,
                  letterSpacing: '-0.02em',
                }}
              >
                {name || 'Без имени'}
              </Typography>
              <Button
                variant="outlined"
                size="small"
                startIcon={<EditOutlined />}
                onClick={onEdit}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  borderRadius: `${radii.button}px`,
                  borderColor: colors.primary,
                  color: colors.primary,
                  px: 1.5,
                }}
              >
                Редактировать
              </Button>
            </Box>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: { xs: 1.5, md: 2 },
                mb: 2,
              }}
            >
              <InfoCell icon={<CalendarMonthOutlined />} label="Дата рождения" value={dobLabel} />
              <InfoCell icon={<PhoneOutlined />} label="Телефон" value={phoneLabel} />
              <InfoCell icon={<MaleOutlined />} label="Пол" value={genderLabel} />
              <InfoCell icon={<EmailOutlined />} label="Email" value={emailLabel} />
              <InfoCell icon={<ScaleOutlined />} label="Вес" value={weightLabel} />
            </Box>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' },
                gap: 1,
                p: 1.25,
                borderRadius: `${radii.cell}px`,
                bgcolor: '#EAF0FF',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                <PersonOutline sx={{ color: colors.primary, fontSize: 20, flexShrink: 0 }} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: 11, color: colors.textHint, fontWeight: 600 }}>
                    Тренер
                  </Typography>
                  {onTrainerClick && meta.trainers.length > 0 ? (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {meta.trainers.map((t) => (
                        <ButtonBase
                          key={t.id}
                          onClick={() => onTrainerClick(t.id)}
                          sx={{
                            fontSize: typography.label,
                            fontWeight: 700,
                            color: colors.primary,
                            textAlign: 'left',
                          }}
                        >
                          {t.name}
                        </ButtonBase>
                      ))}
                    </Box>
                  ) : (
                    <Typography sx={{ fontSize: typography.label, fontWeight: 700, color: colors.text }}>
                      {meta.trainerLabel}
                    </Typography>
                  )}
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                <GroupsOutlined sx={{ color: colors.primary, fontSize: 20, flexShrink: 0 }} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: 11, color: colors.textHint, fontWeight: 600 }}>
                    Группа
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: typography.label,
                      fontWeight: 700,
                      color: colors.text,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {meta.groupLabel}
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                <StorefrontOutlined sx={{ color: colors.primary, fontSize: 20, flexShrink: 0 }} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: 11, color: colors.textHint, fontWeight: 600 }}>
                    Филиал
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: typography.label,
                      fontWeight: 700,
                      color: colors.text,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {meta.branchLabel}
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Календарный план */}
      <Box sx={{ ...cardSx, p: { xs: 2, md: 2.5 } }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            mb: 1.75,
            flexWrap: 'wrap',
          }}
        >
          <Typography sx={{ fontWeight: 800, fontSize: typography.panelTitle, color: colors.text }}>
            Календарный план
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
            <IconButton
              size="small"
              aria-label="Предыдущая неделя"
              onClick={() =>
                setWeekStart((w) => {
                  const n = new Date(w);
                  n.setDate(n.getDate() - 7);
                  return n;
                })
              }
            >
              <ChevronLeft />
            </IconButton>
            <Typography sx={{ fontSize: typography.hint, fontWeight: 600, color: colors.textMuted, minWidth: 148, textAlign: 'center' }}>
              {formatDateRu(days[0])} — {formatDateRu(days[6])}
            </Typography>
            <IconButton
              size="small"
              aria-label="Следующая неделя"
              onClick={() =>
                setWeekStart((w) => {
                  const n = new Date(w);
                  n.setDate(n.getDate() + 7);
                  return n;
                })
              }
            >
              <ChevronRight />
            </IconButton>
          </Box>
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
            gap: { xs: 0.5, md: 0.75 },
          }}
        >
          {days.map((day, i) => {
            const list = eventsForDay(day);
            const iso = new Date(day);
            iso.setHours(0, 0, 0, 0);
            const dayIso = iso.toISOString();
            const selected = selectedDayIso === dayIso;
            return (
              <Box
                key={dayIso}
                component="button"
                type="button"
                onClick={() => setSelectedDayIso(dayIso)}
                sx={{
                  border: selected ? `2px solid ${colors.primary}` : '1px solid #EEF1F6',
                  bgcolor: selected ? '#F3F7FF' : colors.surface,
                  borderRadius: `${radii.cell}px`,
                  minHeight: { xs: 72, md: 88 },
                  p: 0.75,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  textAlign: 'left',
                  position: 'relative',
                }}
              >
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: colors.text, mb: 0.5 }}>
                  {DAY_NAMES[i]} {day.getDate()}
                </Typography>
                {list.length === 0 ? (
                  <Typography sx={{ fontSize: 12, color: colors.textEmpty }}>—</Typography>
                ) : (
                  list.slice(0, 2).map((ev) => (
                    <Typography
                      key={ev.id}
                      sx={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: colors.primary,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {ev.title || ev.name}
                    </Typography>
                  ))
                )}
                {selected && (
                  <Box
                    aria-hidden
                    sx={{
                      position: 'absolute',
                      left: '50%',
                      bottom: 6,
                      transform: 'translateX(-50%)',
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      bgcolor: colors.primary,
                    }}
                  />
                )}
              </Box>
            );
          })}
        </Box>

        {!weekHasEvents && (
          <Typography sx={{ mt: 1.5, fontSize: typography.hint, color: colors.textMuted }}>
            Ближайших событий нет
          </Typography>
        )}
      </Box>

      {/* Результаты соревнований */}
      <Box sx={{ ...cardSx, p: { xs: 2, md: 2.5 } }}>
        <Typography sx={{ fontWeight: 800, fontSize: typography.panelTitle, color: colors.text, mb: 1 }}>
          Результаты соревнований
        </Typography>
        {results.length === 0 ? (
          <EmptyBlock
            icon={<EmojiEventsOutlined />}
            title="Результатов соревнований пока нет"
            subtitle="Здесь будут отображаться достигнутые результаты, участие в турнирах и соревнованиях"
          />
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {results.map((r) => (
              <Box
                key={r.id}
                sx={{
                  p: 1.5,
                  borderRadius: `${radii.cell}px`,
                  bgcolor: colors.surface,
                  border: '1px solid #EEF1F6',
                }}
              >
                <Typography sx={{ fontWeight: 700, fontSize: typography.label }}>
                  {r.competition?.name || 'Соревнование'}
                </Typography>
                <Typography sx={{ fontSize: typography.hint, color: colors.textMuted }}>
                  {formatDateRu(r.competition?.startDate || r.competition?.date)} ·{' '}
                  {r.result || (r.resultValue != null ? String(r.resultValue) : '—')}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </Box>

      {/* Личные данные и документы */}
      <Box sx={{ ...cardSx, p: { xs: 2, md: 2.5 } }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            mb: 2,
            flexWrap: 'wrap',
          }}
        >
          <Typography sx={{ fontWeight: 800, fontSize: typography.panelTitle, color: colors.text }}>
            Личные данные и документы
          </Typography>
          <Button
            variant="outlined"
            size="small"
            startIcon={<EditOutlined />}
            onClick={onEdit}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              borderRadius: `${radii.button}px`,
              borderColor: colors.primary,
              color: colors.primary,
            }}
          >
            Редактировать
          </Button>
        </Box>

        <Typography sx={{ fontWeight: 700, fontSize: typography.label, mb: 1.25, color: colors.text }}>
          Основная информация
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
            gap: 1.5,
            mb: 2.5,
          }}
        >
          <InfoCell icon={<LocationOnOutlined />} label="Адрес" value={data.address || '—'} />
          <InfoCell icon={<CalendarMonthOutlined />} label="Дата рождения" value={formatDateRu(data.dateOfBirth)} />
          <InfoCell icon={<PhoneOutlined />} label="Телефон" value={data.phone || '—'} />
          <InfoCell icon={<EmailOutlined />} label="Email" value={data.email || '—'} />
        </Box>

        <Typography sx={{ fontWeight: 700, fontSize: typography.label, mb: 1.25, color: colors.text }}>
          Документы спортсмена
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' },
            gap: 1.25,
            mb: 2,
          }}
        >
          {docCards.map((doc) => (
            <Box
              key={doc.title}
              sx={{
                p: 1.5,
                borderRadius: `${radii.cell}px`,
                border: '1px solid #EEF1F6',
                bgcolor: colors.surface,
                minHeight: 88,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                <DescriptionOutlined sx={{ color: colors.primary, fontSize: 20 }} />
                <Typography sx={{ fontSize: typography.label, fontWeight: 700 }}>{doc.title}</Typography>
              </Box>
              <Typography sx={{ fontSize: typography.hint, color: doc.present ? colors.textMuted : colors.textEmpty }}>
                {doc.present ? doc.meta || 'Файл загружен' : 'Документ не загружен'}
              </Typography>
            </Box>
          ))}
        </Box>

        <Box
          component="button"
          type="button"
          onClick={onUploadDoc || onEdit}
          sx={{
            width: '100%',
            border: `1.5px dashed ${colors.primary}`,
            borderRadius: `${radii.panel}px`,
            bgcolor: '#F5F8FF',
            py: 2.5,
            px: 2,
            cursor: 'pointer',
            fontFamily: 'inherit',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 0.75,
            color: colors.primary,
          }}
        >
          <CloudUploadOutlined sx={{ fontSize: 28 }} />
          <Typography sx={{ fontWeight: 800, fontSize: typography.label, color: colors.primary }}>
            Загрузить документ
          </Typography>
          <Typography sx={{ fontSize: typography.hint, color: colors.textMuted }}>
            PDF, JPG или PNG до 10 МБ
          </Typography>
        </Box>
      </Box>

      {/* Родители */}
      <Box sx={{ ...cardSx, p: { xs: 2, md: 2.5 } }}>
        <Typography sx={{ fontWeight: 800, fontSize: typography.panelTitle, color: colors.text, mb: 1 }}>
          Родители / законные представители
        </Typography>
        {parents.length === 0 ? (
          <EmptyBlock
            icon={<PeopleOutline />}
            title="Представители не указаны"
            subtitle="Добавьте родителя или законного представителя, чтобы школа могла связаться при необходимости"
            action={
              <Button
                variant="contained"
                onClick={onAddParent || onEdit}
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
                + Добавить представителя
              </Button>
            }
          />
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            {parents.map((p) => (
              <Box
                key={p.id}
                sx={{
                  p: 1.5,
                  borderRadius: `${radii.cell}px`,
                  bgcolor: '#EAF0FF',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.25,
                }}
              >
                <AssignmentOutlined sx={{ color: colors.primary }} />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: typography.label }}>
                    {p.fullName || '—'}
                  </Typography>
                  <Typography sx={{ fontSize: typography.hint, color: colors.textMuted }}>
                    {[p.phone, p.email].filter(Boolean).join(' · ') || 'Контакты не указаны'}
                  </Typography>
                </Box>
              </Box>
            ))}
            <Button
              variant="outlined"
              onClick={onAddParent || onEdit}
              sx={{
                alignSelf: 'flex-start',
                textTransform: 'none',
                fontWeight: 700,
                borderRadius: `${radii.button}px`,
              }}
            >
              + Добавить представителя
            </Button>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default AthleteCardClientView;
