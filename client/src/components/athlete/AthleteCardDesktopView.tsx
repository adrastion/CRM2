import React from 'react';
import {
  Add,
  CalendarMonthOutlined,
  CameraAlt,
  DeleteOutline,
  EditOutlined,
  EmailOutlined,
  ExpandMore,
  HomeOutlined,
  LocationOnOutlined,
  MoreHoriz,
  NoteAltOutlined,
  PaymentsOutlined,
  PersonOutline,
  PhoneOutlined,
  ScaleOutlined,
  ExploreOutlined,
  CardMembershipOutlined,
  WhatsApp,
} from '@mui/icons-material';
import TelegramIcon from '@mui/icons-material/Telegram';
import {
  Avatar,
  Box,
  Button,
  Chip,
  FormControl,
  IconButton,
  InputAdornment,
  LinearProgress,
  Link,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { colors } from '../../theme/tokens';
import { ATHLETE_STATUS_LABELS, AthleteCardData, AthleteCalendarEvent, GENDER_LABELS } from './athleteCardTypes';
import { RELATION_LABELS } from './athleteCardTypes';
import { calcAge, deriveSecondaryMeta, formatDateRu, fullName } from './athleteCardUtils';

const cardSx = {
  bgcolor: '#fff',
  borderRadius: '12px',
  border: '1px solid #EEF1F6',
  boxShadow: '0 2px 10px rgba(27, 36, 56, 0.04)',
};

export type AthleteCardTab =
  | 'overview'
  | 'memberships'
  | 'trainings'
  | 'attendance'
  | 'payments'
  | 'notes'
  | 'tasks'
  | 'documents'
  | 'history';

type Props = {
  data: AthleteCardData;
  fromSection: string;
  tab: AthleteCardTab;
  onTab: (t: AthleteCardTab) => void;
  onFromSectionClick?: () => void;
  onClose?: () => void;
  onEdit: () => void;
  onAddMenu: (el: HTMLElement) => void;
  onMoreMenu: (el: HTMLElement) => void;
  onActionsMenu: (el: HTMLElement) => void;
  onGroupClick?: () => void;
  onPhotoPick?: () => void;
  discountType: '' | 'percent' | 'fixed';
  discountValue: string;
  onDiscountType: (v: '' | 'percent' | 'fixed') => void;
  onDiscountValue: (v: string) => void;
  onSaveDiscount: () => void;
  onToggleMembershipFee: () => void;
  onDeleteClient?: () => void;
  onMarkPayment?: () => void;
  onRenewMembership?: () => void;
  upcoming: AthleteCalendarEvent[];
  tasks: Array<{
    id: string;
    title: string;
    dueAt?: string | null;
    done?: boolean;
    assigneeName?: string | null;
    assigneePhoto?: string | null;
  }>;
  notesText?: string | null;
  overviewExtra?: React.ReactNode;
  tabPanels: Partial<Record<AthleteCardTab, React.ReactNode>>;
};

function ageWord(age: number) {
  const n10 = age % 10;
  const n100 = age % 100;
  if (n10 === 1 && n100 !== 11) return 'год';
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return 'года';
  return 'лет';
}

function shortTrainerName(full: string) {
  const parts = full.trim().split(/\s+/);
  if (parts.length < 2) return full;
  const last = parts[0];
  const initials = parts
    .slice(1)
    .map((p) => `${p[0]}.`)
    .join('');
  return `${last} ${initials}`;
}

const AthleteCardDesktopView: React.FC<Props> = ({
  data,
  fromSection,
  tab,
  onTab,
  onFromSectionClick,
  onClose,
  onEdit,
  onAddMenu,
  onMoreMenu,
  onActionsMenu,
  onGroupClick,
  onPhotoPick,
  discountType,
  discountValue,
  onDiscountType,
  onDiscountValue,
  onSaveDiscount,
  onToggleMembershipFee,
  onDeleteClient,
  onMarkPayment,
  onRenewMembership,
  upcoming,
  tasks,
  notesText,
  overviewExtra,
  tabPanels,
}) => {
  const name = fullName(data);
  const age = calcAge(data.dateOfBirth);
  const meta = deriveSecondaryMeta(data);
  const status = data.athleteStatus || 'active';
  const pack = data.activeMembership;
  const total = pack?.visitsTotal;
  const left =
    pack?.remaining != null
      ? pack.remaining
      : total != null
        ? Math.max(0, total - (pack?.visitsUsed || 0))
        : null;
  const progress = total && left != null ? Math.max(0, Math.min(100, (left / total) * 100)) : null;
  const parents = data.parents || [];
  const phoneDigits = (data.phone || '').replace(/\D/g, '');
  const waHref = phoneDigits ? `https://wa.me/${phoneDigits.replace(/^8/, '7')}` : undefined;
  const tgHref = phoneDigits ? `https://t.me/+${phoneDigits.replace(/^8/, '7')}` : undefined;
  const packStart = (pack as any)?.startDate || (pack as any)?.start || null;
  const sourceLabel = (data as any).leadSource || (data as any).source || '—';
  const trialAt = (data as any).trialLessonAt || (data as any).trialDate;

  const tabs: Array<{ id: AthleteCardTab; label: string }> = [
    { id: 'overview', label: 'Общая информация' },
    { id: 'memberships', label: 'Абонементы' },
    { id: 'trainings', label: 'Тренировки' },
    { id: 'attendance', label: 'Посещаемость' },
    { id: 'payments', label: 'Платежи' },
    { id: 'notes', label: 'Заметки' },
    { id: 'tasks', label: 'Задачи' },
    { id: 'documents', label: 'Документы' },
    { id: 'history', label: 'История' },
  ];

  const kv = (label: string, value: React.ReactNode) => (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: '148px 1fr',
        gap: 1,
        py: 0.75,
        borderBottom: '1px solid #F3F5F8',
        '&:last-of-type': { borderBottom: 0 },
      }}
    >
      <Typography sx={{ fontSize: 13, color: '#8B93A7' }}>{label}</Typography>
      <Box sx={{ fontSize: 13, fontWeight: 700, color: '#1B2438', minWidth: 0 }}>{value || '—'}</Box>
    </Box>
  );

  const metaIconValue = (icon: React.ReactNode, text: React.ReactNode) => (
    <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#1B2438', display: 'inline-flex', alignItems: 'center', gap: 0.4 }}>
      {icon}
      {text}
    </Typography>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {/* A. Breadcrumbs */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
          <HomeOutlined sx={{ fontSize: 18, color: colors.primary }} />
          <Typography
            component="button"
            type="button"
            onClick={onFromSectionClick || onClose}
            sx={{
              border: 0,
              background: 'none',
              p: 0,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 700,
              color: colors.primary,
              fontFamily: 'inherit',
              '&:hover': { textDecoration: 'underline' },
            }}
          >
            {fromSection}
          </Typography>
          <Typography sx={{ color: '#C5CAD6', fontWeight: 600 }}>/</Typography>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#1B2438' }} noWrap>
            {name}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button size="small" disabled sx={{ textTransform: 'none', fontWeight: 700, color: '#8B93A7' }}>
            ← Предыдущий
          </Button>
          <Button size="small" disabled sx={{ textTransform: 'none', fontWeight: 700, color: '#8B93A7' }}>
            Следующий →
          </Button>
        </Stack>
      </Box>

      {/* B. Quick actions — 3 equal cards */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' },
          gap: 1.25,
        }}
      >
        <Box sx={{ ...cardSx, p: 1.5 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#5A6275', mb: 1 }}>
            Личная скидка (ежемес.)
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <FormControl size="small" sx={{ minWidth: 132 }}>
              <Select
                value={discountType}
                displayEmpty
                onChange={(e) => onDiscountType(e.target.value as '' | 'percent' | 'fixed')}
                sx={{ borderRadius: '10px', fontWeight: 700, fontSize: 13 }}
              >
                <MenuItem value="">Нет</MenuItem>
                <MenuItem value="percent">Процент (%)</MenuItem>
                <MenuItem value="fixed">Сумма (₽)</MenuItem>
              </Select>
            </FormControl>
            <TextField
              size="small"
              type="number"
              value={discountValue}
              disabled={!discountType}
              onChange={(e) => onDiscountValue(e.target.value)}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">{discountType === 'fixed' ? '₽' : '%'}</InputAdornment>
                ),
              }}
              sx={{ width: 100, '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
            />
            <Button
              variant="contained"
              size="small"
              onClick={onSaveDiscount}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                borderRadius: '10px',
                bgcolor: colors.primary,
                boxShadow: 'none',
                px: 2,
              }}
            >
              Сохранить
            </Button>
          </Stack>
        </Box>

        <Box sx={{ ...cardSx, p: 1.5, display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <Avatar sx={{ bgcolor: '#E7F8F2', color: '#12B981', width: 40, height: 40, borderRadius: '12px' }}>
            <PaymentsOutlined sx={{ fontSize: 20 }} />
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#5A6275' }}>Членский взнос</Typography>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.35 }} flexWrap="wrap" useFlexGap>
              <Chip
                size="small"
                label={data.membershipFeePaid ? 'Оплачен' : 'Не оплачен'}
                sx={{
                  height: 24,
                  fontWeight: 800,
                  bgcolor: data.membershipFeePaid ? '#E7F8F2' : '#FFF1F4',
                  color: data.membershipFeePaid ? '#12B981' : '#F93C65',
                }}
              />
              {data.membershipFeePaidAt && (
                <Typography sx={{ fontSize: 12, color: '#8B93A7' }}>
                  Оплачен до {formatDateRu(data.membershipFeePaidAt)}
                </Typography>
              )}
            </Stack>
          </Box>
          <Button
            size="small"
            variant="outlined"
            onClick={onToggleMembershipFee}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              borderRadius: '10px',
              borderColor: '#C9D7FF',
              color: colors.primary,
              whiteSpace: 'nowrap',
            }}
          >
            Отметить оплату
          </Button>
        </Box>

        <Box sx={{ ...cardSx, p: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
          <Button
            variant="outlined"
            endIcon={<ExpandMore />}
            onClick={(e) => onActionsMenu(e.currentTarget)}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              borderRadius: '10px',
              borderColor: '#C9D7FF',
              color: colors.primary,
              px: 2,
              bgcolor: '#fff',
            }}
          >
            Действия
          </Button>
          {onDeleteClient && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteOutline />}
              onClick={onDeleteClient}
              sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '10px', whiteSpace: 'nowrap' }}
            >
              Удалить клиента
            </Button>
          )}
        </Box>
      </Box>

      {/* C. Profile hero — photo | identity | actions+meta */}
      <Box sx={{ ...cardSx, p: 2 }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '112px minmax(0,1fr) minmax(340px, 0.95fr)' },
            gap: 2.5,
            alignItems: 'start',
          }}
        >
          <Box sx={{ position: 'relative', width: 112, height: 112 }}>
            <Avatar
              src={data.photo || undefined}
              sx={{ width: 112, height: 112, borderRadius: '14px', bgcolor: '#EAF0FF', fontSize: 36, fontWeight: 800 }}
            >
              {(data.lastName?.[0] || '') + (data.firstName?.[0] || '')}
            </Avatar>
            {onPhotoPick && (
              <IconButton
                size="small"
                onClick={onPhotoPick}
                sx={{
                  position: 'absolute',
                  right: 6,
                  bottom: 6,
                  bgcolor: colors.primary,
                  color: '#fff',
                  width: 28,
                  height: 28,
                  boxShadow: '0 2px 8px rgba(61,90,254,0.35)',
                  '&:hover': { bgcolor: colors.primaryDark },
                }}
              >
                <CameraAlt sx={{ fontSize: 14 }} />
              </IconButton>
            )}
          </Box>

          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1.25 }}>
              <Typography sx={{ fontSize: 26, fontWeight: 800, color: '#1B2438', lineHeight: 1.15 }}>
                {name}
              </Typography>
              <Chip
                size="small"
                label={ATHLETE_STATUS_LABELS[status] || status}
                sx={{ height: 26, fontWeight: 800, bgcolor: '#E7F8F2', color: '#12B981' }}
              />
            </Box>

            {/* Макет: 3 ряда — ДР/пол/вес · телефон+email · адрес */}
            <Stack spacing={0.9}>
              <Stack direction="row" spacing={2.5} flexWrap="wrap" useFlexGap>
                <Typography sx={{ fontSize: 13, color: '#5A6275', display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                  <CalendarMonthOutlined sx={{ fontSize: 16, color: '#9AA3B5' }} />
                  {data.dateOfBirth
                    ? `${formatDateRu(data.dateOfBirth)}${age != null ? ` (${age} ${ageWord(age)})` : ''}`
                    : '—'}
                </Typography>
                <Typography sx={{ fontSize: 13, color: '#5A6275', display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                  <PersonOutline sx={{ fontSize: 16, color: '#9AA3B5' }} />
                  {GENDER_LABELS[data.gender || ''] || data.gender || '—'}
                </Typography>
                <Typography sx={{ fontSize: 13, color: '#5A6275', display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                  <ScaleOutlined sx={{ fontSize: 16, color: '#9AA3B5' }} />
                  {data.weight != null ? `${data.weight} кг` : '—'}
                </Typography>
              </Stack>

              <Stack direction="row" spacing={2.5} alignItems="center" flexWrap="wrap" useFlexGap>
                <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
                  <PhoneOutlined sx={{ fontSize: 16, color: '#9AA3B5', flexShrink: 0 }} />
                  <Typography sx={{ fontSize: 13, color: '#1B2438', fontWeight: 600 }}>{data.phone || '—'}</Typography>
                  {waHref && (
                    <IconButton size="small" component="a" href={waHref} target="_blank" rel="noreferrer" sx={{ color: '#25D366', p: 0.35 }}>
                      <WhatsApp sx={{ fontSize: 18 }} />
                    </IconButton>
                  )}
                  {tgHref && (
                    <IconButton size="small" component="a" href={tgHref} target="_blank" rel="noreferrer" sx={{ color: '#2AABEE', p: 0.35 }}>
                      <TelegramIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  )}
                </Box>
                {data.email ? (
                  <Typography
                    component="a"
                    href={`mailto:${data.email}`}
                    sx={{
                      fontSize: 13,
                      color: colors.primary,
                      fontWeight: 600,
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.5,
                    }}
                  >
                    <EmailOutlined sx={{ fontSize: 16 }} />
                    {data.email}
                  </Typography>
                ) : (
                  <Typography sx={{ fontSize: 13, color: '#8B93A7', display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                    <EmailOutlined sx={{ fontSize: 16 }} />
                    —
                  </Typography>
                )}
              </Stack>

              <Typography sx={{ fontSize: 13, color: '#5A6275', display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                <LocationOnOutlined sx={{ fontSize: 16, color: '#9AA3B5', flexShrink: 0 }} />
                {data.address || '—'}
              </Typography>
            </Stack>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, minWidth: 0 }}>
            <Stack direction="row" spacing={0.75} justifyContent="flex-end" flexWrap="wrap" useFlexGap>
              <Button
                size="small"
                variant="contained"
                startIcon={<EditOutlined />}
                onClick={onEdit}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  borderRadius: '10px',
                  bgcolor: colors.primary,
                  boxShadow: 'none',
                }}
              >
                Редактировать
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<Add />}
                onClick={(e) => onAddMenu(e.currentTarget)}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  borderRadius: '10px',
                  borderColor: '#C9D7FF',
                  color: colors.primary,
                }}
              >
                Добавить информацию
              </Button>
              <IconButton size="small" onClick={(e) => onMoreMenu(e.currentTarget)} sx={{ color: '#8B93A7' }}>
                <MoreHoriz />
              </IconButton>
            </Stack>

            {/* Макет: 3 колонки, подпись сверху, вертикальные разделители */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: 0,
                alignItems: 'start',
              }}
            >
              <Box
                sx={{
                  pr: 1.5,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.25,
                  borderRight: '1px solid #EEF1F6',
                }}
              >
                <MetaStack
                  label="Группа"
                  value={
                    onGroupClick ? (
                      <Chip
                        size="small"
                        label={meta.groupLabel}
                        onClick={onGroupClick}
                        sx={{ height: 24, fontWeight: 700, bgcolor: '#EAF0FF', color: colors.primary, cursor: 'pointer' }}
                      />
                    ) : (
                      <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{meta.groupLabel}</Typography>
                    )
                  }
                />
                <MetaStack
                  label="Источник"
                  value={metaIconValue(
                    <ExploreOutlined sx={{ fontSize: 14, color: colors.primary }} />,
                    sourceLabel
                  )}
                />
              </Box>
              <Box
                sx={{
                  px: 1.5,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.25,
                  borderRight: '1px solid #EEF1F6',
                }}
              >
                <MetaStack
                  label="Тренер"
                  value={
                    meta.trainers[0] ? (
                      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
                        <Avatar sx={{ width: 24, height: 24, fontSize: 10, bgcolor: '#EAF0FF', color: colors.primary }}>
                          {meta.trainers[0].name
                            .split(' ')
                            .map((p) => p[0])
                            .join('')
                            .slice(0, 2)}
                        </Avatar>
                        <Typography sx={{ fontSize: 13, fontWeight: 700 }}>
                          {shortTrainerName(meta.trainers[0].name)}
                        </Typography>
                      </Box>
                    ) : (
                      <Typography sx={{ fontSize: 13, fontWeight: 700 }}>—</Typography>
                    )
                  }
                />
              </Box>
              <Box sx={{ pl: 1.5, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                <MetaStack
                  label="Филиал"
                  value={metaIconValue(
                    <LocationOnOutlined sx={{ fontSize: 14, color: colors.primary }} />,
                    meta.branchLabel
                  )}
                />
                <MetaStack
                  label="Пробное занятие"
                  value={metaIconValue(
                    <CalendarMonthOutlined sx={{ fontSize: 14, color: '#9AA3B5' }} />,
                    formatDateRu(trialAt) || '—'
                  )}
                />
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* D. Tabs */}
      <Tabs
        value={tab}
        onChange={(_, v) => onTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          borderBottom: '1px solid #EEF1F6',
        }}
      >
        {tabs.map((t) => (
          <Tab key={t.id} value={t.id} label={t.label} />
        ))}
      </Tabs>

      {/* E. Tab body */}
      {tab === 'overview' ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: 'minmax(0,1fr) minmax(300px, 0.38fr)' },
            gap: 1.5,
            alignItems: 'start',
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box sx={{ ...cardSx, p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Typography sx={{ fontWeight: 800, fontSize: 16, flex: 1 }}>Основная информация</Typography>
                <Button size="small" startIcon={<EditOutlined />} onClick={onEdit} sx={{ textTransform: 'none', fontWeight: 700, color: colors.primary }}>
                  Редактировать
                </Button>
              </Box>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                  gap: 0,
                }}
              >
                <Box sx={{ pr: { sm: 2.5 }, borderRight: { sm: '1px solid #EEF1F6' } }}>
                  {kv('ФИО', name)}
                  {kv(
                    'Дата рождения',
                    data.dateOfBirth
                      ? `${formatDateRu(data.dateOfBirth)}${age != null ? ` (${age} ${ageWord(age)})` : ''}`
                      : '—'
                  )}
                  {kv('Пол', GENDER_LABELS[data.gender || ''] || data.gender || '—')}
                  {kv(
                    'Телефон',
                    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                      <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{data.phone || '—'}</Typography>
                      {waHref && (
                        <IconButton size="small" component="a" href={waHref} target="_blank" rel="noreferrer" sx={{ color: '#25D366', p: 0.25 }}>
                          <WhatsApp sx={{ fontSize: 16 }} />
                        </IconButton>
                      )}
                      {tgHref && (
                        <IconButton size="small" component="a" href={tgHref} target="_blank" rel="noreferrer" sx={{ color: '#2AABEE', p: 0.25 }}>
                          <TelegramIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      )}
                    </Box>
                  )}
                  {kv(
                    'Email',
                    data.email ? (
                      <Link href={`mailto:${data.email}`} underline="hover" sx={{ fontWeight: 700, color: colors.primary, fontSize: 13 }}>
                        {data.email}
                      </Link>
                    ) : (
                      '—'
                    )
                  )}
                  {kv('Адрес', data.address)}
                </Box>
                <Box sx={{ pl: { sm: 2.5 } }}>
                  {kv('Вес', data.weight != null ? `${data.weight} кг` : '—')}
                  {kv(
                    'Группа',
                    onGroupClick ? (
                      <Chip
                        size="small"
                        label={meta.groupLabel}
                        onClick={onGroupClick}
                        sx={{ height: 22, fontWeight: 700, bgcolor: '#EAF0FF', color: colors.primary, cursor: 'pointer' }}
                      />
                    ) : (
                      meta.groupLabel
                    )
                  )}
                  {kv(
                    'Тренер',
                    meta.trainers[0] ? (
                      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
                        <Avatar sx={{ width: 22, height: 22, fontSize: 10, bgcolor: '#EAF0FF', color: colors.primary }}>
                          {meta.trainers[0].name
                            .split(' ')
                            .map((p) => p[0])
                            .join('')
                            .slice(0, 2)}
                        </Avatar>
                        <Typography sx={{ fontSize: 13, fontWeight: 700 }}>
                          {shortTrainerName(meta.trainers[0].name)}
                        </Typography>
                      </Box>
                    ) : (
                      '—'
                    )
                  )}
                  {kv(
                    'Филиал',
                    <Typography sx={{ fontSize: 13, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 0.4 }}>
                      <LocationOnOutlined sx={{ fontSize: 14, color: '#9AA3B5' }} />
                      {meta.branchLabel}
                    </Typography>
                  )}
                  {kv('Источник', sourceLabel)}
                  {kv('Дата пробного занятия', formatDateRu(trialAt) || '—')}
                </Box>
              </Box>
            </Box>

            <Box sx={{ ...cardSx, p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.25 }}>
                <Typography sx={{ fontWeight: 800, fontSize: 16, flex: 1 }}>Родители / законные представители</Typography>
                <Button size="small" startIcon={<Add />} onClick={onEdit} sx={{ textTransform: 'none', fontWeight: 700, color: colors.primary }}>
                  Добавить
                </Button>
              </Box>
              {parents.length === 0 ? (
                <Typography sx={{ fontSize: 13, color: '#8B93A7' }}>Представители не указаны</Typography>
              ) : (
                <Stack spacing={1}>
                  {parents.map((p: any) => (
                    <Box
                      key={p.id || p.fullName}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.25,
                        p: 1.25,
                        borderRadius: '12px',
                        bgcolor: '#F7F8FB',
                      }}
                    >
                      <Avatar sx={{ bgcolor: '#EAF0FF', color: colors.primary, fontWeight: 800 }}>
                        {String(p.fullName || '?')
                          .split(' ')
                          .map((x: string) => x[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                          <Typography sx={{ fontWeight: 800, fontSize: 14 }}>{p.fullName}</Typography>
                          <Chip
                            size="small"
                            label={RELATION_LABELS[p.relationType || ''] || p.relationType || 'Представитель'}
                            sx={{ height: 22, fontWeight: 700, bgcolor: '#EEF1F6', color: '#5A6275' }}
                          />
                        </Box>
                        <Stack direction="row" spacing={1.5} sx={{ mt: 0.35 }} flexWrap="wrap" useFlexGap>
                          {p.phone && (
                            <Link
                              href={`tel:${p.phone}`}
                              underline="hover"
                              sx={{ fontSize: 12, fontWeight: 700, color: colors.primary, display: 'inline-flex', alignItems: 'center', gap: 0.4 }}
                            >
                              <PhoneOutlined sx={{ fontSize: 14 }} />
                              {p.phone}
                            </Link>
                          )}
                          {p.email && (
                            <Link
                              href={`mailto:${p.email}`}
                              underline="hover"
                              sx={{ fontSize: 12, fontWeight: 700, color: colors.primary, display: 'inline-flex', alignItems: 'center', gap: 0.4 }}
                            >
                              <EmailOutlined sx={{ fontSize: 14 }} />
                              {p.email}
                            </Link>
                          )}
                          {!p.phone && !p.email && (
                            <Typography sx={{ fontSize: 12, color: '#8B93A7' }}>Контакты не указаны</Typography>
                          )}
                        </Stack>
                      </Box>
                      <IconButton size="small" sx={{ color: '#9AA3B5' }}>
                        <MoreHoriz sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Box>
                  ))}
                </Stack>
              )}
            </Box>

            <Box sx={{ ...cardSx, p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.25 }}>
                <Typography sx={{ fontWeight: 800, fontSize: 16, flex: 1 }}>Заметки</Typography>
                <Button size="small" startIcon={<Add />} onClick={onEdit} sx={{ textTransform: 'none', fontWeight: 700, color: colors.primary }}>
                  Добавить
                </Button>
              </Box>
              {notesText ? (
                <Box sx={{ p: 1.5, borderRadius: '12px', bgcolor: '#FFFBEB', border: '1px solid #F5E6B8', display: 'flex', gap: 1.25 }}>
                  <Avatar sx={{ width: 32, height: 32, bgcolor: '#FDE68A', color: '#B45309' }}>
                    <NoteAltOutlined sx={{ fontSize: 18 }} />
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 13, color: '#1B2438', whiteSpace: 'pre-wrap' }}>{notesText}</Typography>
                    <Typography sx={{ fontSize: 11, color: '#8B93A7', mt: 1 }}>
                      {[
                        meta.trainers[0] ? shortTrainerName(meta.trainers[0].name) : null,
                        data.updatedAt
                          ? format(new Date(data.updatedAt), 'dd.MM.yyyy, HH:mm')
                          : null,
                      ]
                        .filter(Boolean)
                        .join(' • ') || '—'}
                    </Typography>
                  </Box>
                  <IconButton size="small" sx={{ color: '#9AA3B5', alignSelf: 'flex-start' }}>
                    <MoreHoriz sx={{ fontSize: 18 }} />
                  </IconButton>
                </Box>
              ) : (
                <Typography sx={{ fontSize: 13, color: '#8B93A7' }}>Заметок пока нет</Typography>
              )}
            </Box>

            {overviewExtra}
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box sx={{ ...cardSx, overflow: 'hidden' }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  px: 1.75,
                  py: 1.25,
                  bgcolor: '#E7F8F2',
                  borderBottom: '1px solid #D1FAE5',
                }}
              >
                <Typography sx={{ fontWeight: 800, fontSize: 15, flex: 1 }}>Действующий абонемент</Typography>
                {pack && (
                  <Chip
                    size="small"
                    label={pack.isActive ? 'Активен' : 'Неактивен'}
                    sx={{ height: 22, fontWeight: 800, bgcolor: '#fff', color: '#12B981' }}
                  />
                )}
              </Box>
              <Box sx={{ p: 1.75 }}>
                {!pack ? (
                  <Typography sx={{ fontSize: 13, color: '#8B93A7' }}>Нет активного абонемента</Typography>
                ) : (
                  <>
                    <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start' }}>
                      <Avatar sx={{ bgcolor: '#E7F8F2', color: '#12B981', width: 40, height: 40, borderRadius: '12px' }}>
                        <CardMembershipOutlined sx={{ fontSize: 20 }} />
                      </Avatar>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography sx={{ fontWeight: 800, fontSize: 16 }}>{pack.name}</Typography>
                        <Typography sx={{ fontSize: 12, color: '#8B93A7', mt: 0.25 }}>
                          {[meta.branchLabel !== '—' ? meta.branchLabel : null, meta.groupLabel !== '—' ? meta.groupLabel : null]
                            .filter(Boolean)
                            .join(' • ') || '—'}
                        </Typography>
                        {(packStart || pack.endDate) && (
                          <Typography sx={{ fontSize: 12, color: '#8B93A7', mt: 0.25 }}>
                            {packStart && pack.endDate
                              ? `Действует: ${formatDateRu(packStart)} — ${formatDateRu(pack.endDate)}`
                              : pack.endDate
                                ? `Действует до ${formatDateRu(pack.endDate)}`
                                : `Действует с ${formatDateRu(packStart)}`}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                    {progress != null && left != null && total != null && (
                      <Box sx={{ mt: 1.5 }}>
                        <Typography sx={{ fontSize: 12, color: '#8B93A7', mb: 0.6 }}>
                          Осталось занятий:{' '}
                          <Box component="span" sx={{ fontWeight: 800, color: '#1B2438' }}>
                            {left} из {total}
                          </Box>
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={progress}
                          sx={{
                            height: 8,
                            borderRadius: 99,
                            bgcolor: '#EAF0FF',
                            '& .MuiLinearProgress-bar': { bgcolor: '#12B981' },
                          }}
                        />
                      </Box>
                    )}
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1.5 }}>
                      <Button
                        fullWidth
                        variant="contained"
                        onClick={onMarkPayment}
                        sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '10px', bgcolor: colors.primary, boxShadow: 'none' }}
                      >
                        Отметить оплату
                      </Button>
                      <Button
                        fullWidth
                        variant="outlined"
                        onClick={onRenewMembership}
                        sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '10px', borderColor: '#C9D7FF', color: colors.primary }}
                      >
                        Продлить абонемент
                      </Button>
                    </Stack>
                  </>
                )}
              </Box>
            </Box>

            <Box sx={{ ...cardSx, p: 1.75 }}>
              <Typography sx={{ fontWeight: 800, fontSize: 15, mb: 1 }}>Ближайшие тренировки</Typography>
              {upcoming.length === 0 ? (
                <Typography sx={{ fontSize: 13, color: '#8B93A7' }}>Нет ближайших тренировок</Typography>
              ) : (
                <Stack spacing={1}>
                  {upcoming.slice(0, 3).map((ev, idx) => {
                    const start = ev.startTime || ev.startDate;
                    const d = start ? new Date(start) : null;
                    const waiting = idx === 1;
                    const statusColor = waiting ? '#9AA3B5' : '#12B981';
                    const statusLabel = waiting ? 'Ожидает' : 'Запланировано';
                    return (
                      <Box
                        key={ev.id}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.25,
                          p: 1,
                          borderRadius: '12px',
                          bgcolor: '#F7F8FB',
                        }}
                      >
                        <Box
                          sx={{
                            width: 44,
                            textAlign: 'center',
                            bgcolor: '#EEF1F6',
                            borderRadius: '10px',
                            py: 0.5,
                            flexShrink: 0,
                          }}
                        >
                          <Typography sx={{ fontSize: 16, fontWeight: 800, color: '#1B2438', lineHeight: 1 }}>
                            {d ? format(d, 'd') : '—'}
                          </Typography>
                          <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#8B93A7', textTransform: 'uppercase' }}>
                            {d ? format(d, 'LLL', { locale: ru }) : ''}
                          </Typography>
                        </Box>
                        <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#1B2438', whiteSpace: 'nowrap' }}>
                          {d ? format(d, 'HH:mm') : '—'}
                          {ev.endTime ? ` — ${format(new Date(ev.endTime), 'HH:mm')}` : ''}
                        </Typography>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography sx={{ fontSize: 13, fontWeight: 700 }} noWrap>
                            {ev.groupName || ev.title || 'Тренировка'}
                          </Typography>
                          <Typography sx={{ fontSize: 12, color: '#8B93A7' }} noWrap>
                            {ev.trainerName ? shortTrainerName(ev.trainerName) : meta.trainers[0] ? shortTrainerName(meta.trainers[0].name) : '—'}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                          <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: statusColor }} />
                          <Typography sx={{ fontSize: 11, fontWeight: 700, color: statusColor }}>{statusLabel}</Typography>
                        </Box>
                      </Box>
                    );
                  })}
                </Stack>
              )}
            </Box>

            <Box sx={{ ...cardSx, p: 1.75 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Typography sx={{ fontWeight: 800, fontSize: 15, flex: 1 }}>Задачи</Typography>
                <Button size="small" startIcon={<Add />} onClick={() => onTab('tasks')} sx={{ textTransform: 'none', fontWeight: 700, color: colors.primary }}>
                  Добавить
                </Button>
              </Box>
              {tasks.length === 0 ? (
                <Typography sx={{ fontSize: 13, color: '#8B93A7' }}>Нет задач</Typography>
              ) : (
                <Stack spacing={1}>
                  {tasks.slice(0, 4).map((t) => (
                    <Box key={t.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box
                        sx={{
                          width: 16,
                          height: 16,
                          borderRadius: '4px',
                          border: '1.5px solid #C5CAD6',
                          bgcolor: t.done ? colors.primary : 'transparent',
                          flexShrink: 0,
                        }}
                      />
                      <Typography sx={{ flex: 1, fontSize: 13, fontWeight: 600, minWidth: 0 }} noWrap>
                        {t.title}
                      </Typography>
                      {t.dueAt && (
                        <Chip
                          size="small"
                          label={formatDateRu(t.dueAt)}
                          sx={{ height: 22, fontWeight: 700, bgcolor: '#FFE8EE', color: '#F93C65', flexShrink: 0 }}
                        />
                      )}
                      <Avatar
                        src={t.assigneePhoto || undefined}
                        sx={{ width: 22, height: 22, fontSize: 10, bgcolor: '#EAF0FF', color: colors.primary, flexShrink: 0 }}
                      >
                        {(t.assigneeName || '?')
                          .split(' ')
                          .map((p) => p[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </Avatar>
                      <IconButton size="small" sx={{ color: '#9AA3B5', p: 0.25 }}>
                        <MoreHoriz sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Box>
                  ))}
                </Stack>
              )}
            </Box>
          </Box>
        </Box>
      ) : (
        <Box sx={{ ...cardSx, p: 2 }}>{tabPanels[tab] || <Typography sx={{ color: '#8B93A7' }}>Раздел в подготовке</Typography>}</Box>
      )}
    </Box>
  );
};

function MetaStack({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box>
      <Typography sx={{ fontSize: 11, color: '#8B93A7', fontWeight: 600, mb: 0.45 }}>{label}</Typography>
      <Box sx={{ minWidth: 0 }}>{value}</Box>
    </Box>
  );
}

export default AthleteCardDesktopView;
