import React, { useMemo } from 'react';
import {
  CalendarMonthOutlined,
  Close,
  DirectionsCarOutlined,
  EditOutlined,
  EmailOutlined,
  GpsFixedOutlined,
  LinkOutlined,
  NotesOutlined,
  PaymentsOutlined,
  PersonOutline,
  PhoneOutlined,
  PlaceOutlined,
} from '@mui/icons-material';
import {
  Avatar,
  Box,
  Button,
  Chip,
  Link,
  Stack,
  Typography,
} from '@mui/material';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { colors, radii } from '../../theme/tokens';
import { getEmployeeProfileMeta } from '../../utils/staffProfileMeta';

const cardSx = {
  bgcolor: '#fff',
  borderRadius: `${radii.panel}px`,
  border: '1px solid #EEF1F6',
  boxShadow: '0 2px 10px rgba(27, 36, 56, 0.04)',
  p: 2,
} as const;

type Props = {
  employee: any;
  onClose?: () => void;
  onEdit?: () => void;
  canEdit?: boolean;
  editing?: boolean;
  editForm?: React.ReactNode;
};

function fullName(user: any) {
  if (!user) return 'Промоутер';
  return (
    [user.lastName, user.firstName, user.middleName].filter(Boolean).join(' ').trim() ||
    'Промоутер'
  );
}

function formatMoney(v: unknown) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return `${n.toLocaleString('ru-RU')} ₽`;
}

function formatLastSeen(raw?: string | null) {
  if (!raw) return null;
  try {
    const d = typeof raw === 'string' ? parseISO(raw) : new Date(raw);
    if (Number.isNaN(d.getTime())) return null;
    const time = format(d, 'HH:mm');
    if (isToday(d)) return `В системе сегодня, ${time}`;
    if (isYesterday(d)) return `В системе вчера, ${time}`;
    return `В системе ${format(d, 'd MMMM yyyy, HH:mm', { locale: ru })}`;
  } catch {
    return null;
  }
}

function formatDob(raw?: string | null) {
  if (!raw) return '—';
  try {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return String(raw);
    return format(d, 'dd.MM.yyyy');
  } catch {
    return String(raw);
  }
}

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
      <Box
        sx={{
          width: 28,
          height: 28,
          borderRadius: '8px',
          bgcolor: '#EEF4FF',
          color: colors.primary,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      <Typography sx={{ fontWeight: 800, fontSize: 15, color: '#1B2438' }}>{children}</Typography>
    </Stack>
  );
}

function ProfileField({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', minWidth: 0 }}>
      <Box sx={{ color: colors.primary, mt: 0.15, display: 'flex' }}>{icon}</Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 11, color: '#8B93A7', fontWeight: 600 }}>{label}</Typography>
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#1B2438', mt: 0.15 }}>
          {value || '—'}
        </Typography>
      </Box>
    </Box>
  );
}

/**
 * Карточка промоутера — поля как в CreatePromoterDialog.
 */
const PromoterCardDesktopView: React.FC<Props> = ({
  employee,
  onClose,
  onEdit,
  canEdit,
  editing,
  editForm,
}) => {
  const empUser = employee?.user || employee;
  const name = fullName(empUser);
  const photo = empUser?.photo || employee?.photo;
  const isActive = employee?.isActive !== false && empUser?.isActive !== false;
  const lastSeen =
    formatLastSeen(empUser?.lastLoginAt || empUser?.lastSeenAt || employee?.updatedAt) ||
    'В системе —';

  const meta = useMemo(() => getEmployeeProfileMeta(employee), [employee]);

  const workArea = meta.workArea || '—';
  const workRadius =
    meta.workRadiusKm != null && String(meta.workRadiusKm).trim() !== ''
      ? `${meta.workRadiusKm} км`
      : '—';
  const pricePerShift = formatMoney(meta.pricePerShift);
  const pricePerClient = formatMoney(meta.pricePerClient);
  const transport = meta.transport || '—';
  const socialLink = meta.socialLink || '';
  const notes = meta.notes || '—';
  const dateOfBirth = formatDob(meta.dateOfBirth || null);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 1.5,
          flexWrap: 'wrap',
        }}
      >
        <Typography
          component="h1"
          sx={{
            fontSize: { xs: 22, md: 26 },
            fontWeight: 800,
            color: '#1B2438',
            letterSpacing: '-0.02em',
            lineHeight: 1.2,
          }}
        >
          Карточка промоутера
        </Typography>
        <Stack direction="row" spacing={1}>
          {canEdit && !editing && (
            <Button
              variant="contained"
              startIcon={<EditOutlined sx={{ fontSize: 18 }} />}
              onClick={onEdit}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                fontSize: 13,
                borderRadius: '10px',
                bgcolor: colors.primary,
                boxShadow: 'none',
                '&:hover': { bgcolor: colors.primaryDark, boxShadow: 'none' },
              }}
            >
              Редактировать
            </Button>
          )}
          {onClose && (
            <Button
              variant="outlined"
              startIcon={<Close sx={{ fontSize: 18 }} />}
              onClick={onClose}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                fontSize: 13,
                borderRadius: '10px',
                borderColor: '#C9D7FF',
                color: colors.primary,
                bgcolor: '#fff',
              }}
            >
              Закрыть
            </Button>
          )}
        </Stack>
      </Box>

      {editing && editForm ? (
        <Box sx={cardSx}>{editForm}</Box>
      ) : (
        <>
          <Box
            sx={{
              ...cardSx,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1fr auto' },
              gap: 2,
              alignItems: 'center',
            }}
          >
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', minWidth: 0 }}>
              <Avatar
                src={photo || undefined}
                sx={{
                  width: 88,
                  height: 88,
                  bgcolor: '#EAF0FF',
                  color: colors.primary,
                  fontWeight: 800,
                  fontSize: 28,
                }}
              >
                {(empUser?.lastName?.[0] || '') + (empUser?.firstName?.[0] || '')}
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: 22, fontWeight: 800, color: '#1B2438', lineHeight: 1.2 }}>
                  {name}
                </Typography>
                <Stack direction="row" spacing={0.75} sx={{ mt: 0.75 }} flexWrap="wrap" useFlexGap>
                  <Chip
                    size="small"
                    label="Промоутер"
                    sx={{
                      height: 24,
                      fontWeight: 700,
                      fontSize: 11,
                      bgcolor: '#EAF0FF',
                      color: colors.primary,
                      borderRadius: '8px',
                    }}
                  />
                  <Chip
                    size="small"
                    label={isActive ? 'Активен' : 'Отключён'}
                    sx={{
                      height: 24,
                      fontWeight: 700,
                      fontSize: 11,
                      bgcolor: isActive ? '#E7F8F2' : '#FFE8EE',
                      color: isActive ? '#12B981' : '#E23B5A',
                      borderRadius: '8px',
                    }}
                  />
                </Stack>
                <Typography sx={{ mt: 0.85, fontSize: 12.5, fontWeight: 600, color: '#8B93A7' }}>
                  {lastSeen}
                </Typography>
                <Stack direction="row" spacing={2} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
                  {empUser?.phone && (
                    <Typography
                      sx={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: '#1B2438',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.5,
                      }}
                    >
                      <PhoneOutlined sx={{ fontSize: 16, color: colors.primary }} />
                      {empUser.phone}
                    </Typography>
                  )}
                  {empUser?.email && (
                    <Typography
                      component="a"
                      href={`mailto:${empUser.email}`}
                      sx={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: colors.primary,
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.5,
                      }}
                    >
                      <EmailOutlined sx={{ fontSize: 16 }} />
                      {empUser.email}
                    </Typography>
                  )}
                </Stack>
              </Box>
            </Box>

            <Box
              sx={{
                minWidth: 180,
                p: 1.5,
                borderRadius: '12px',
                bgcolor: isActive ? '#E7F8F2' : '#FFF1F4',
                border: `1px solid ${isActive ? '#C6F0E2' : '#FFD0DA'}`,
              }}
            >
              <Typography sx={{ fontSize: 12, color: '#8B93A7', fontWeight: 700, mb: 0.35 }}>
                Статус аккаунта
              </Typography>
              <Typography
                sx={{
                  fontSize: 15,
                  fontWeight: 800,
                  color: isActive ? '#00997A' : '#E23B5A',
                  lineHeight: 1.2,
                }}
              >
                {isActive ? 'Активен' : 'Отключён'}
              </Typography>
              <Typography sx={{ mt: 0.35, fontSize: 12, fontWeight: 600, color: '#5A6478' }}>
                {workArea !== '—' ? workArea : 'Район не указан'}
              </Typography>
            </Box>
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
              gap: 1.75,
              alignItems: 'stretch',
            }}
          >
            <Box sx={cardSx}>
              <SectionTitle icon={<PersonOutline sx={{ fontSize: 16 }} />}>
                Профиль промоутера
              </SectionTitle>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                  gap: 1.5,
                }}
              >
                <ProfileField
                  icon={<CalendarMonthOutlined sx={{ fontSize: 18 }} />}
                  label="Дата рождения"
                  value={dateOfBirth}
                />
                <ProfileField
                  icon={<PlaceOutlined sx={{ fontSize: 18 }} />}
                  label="Город / район работы"
                  value={workArea}
                />
                <ProfileField
                  icon={<GpsFixedOutlined sx={{ fontSize: 18 }} />}
                  label="Радиус работы"
                  value={workRadius}
                />
                <ProfileField
                  icon={<DirectionsCarOutlined sx={{ fontSize: 18 }} />}
                  label="Способ передвижения"
                  value={transport}
                />
              </Box>
            </Box>

            <Box sx={cardSx}>
              <SectionTitle icon={<PaymentsOutlined sx={{ fontSize: 16 }} />}>
                Условия работы и тарифы
              </SectionTitle>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                  gap: 1.5,
                }}
              >
                <ProfileField
                  icon={<PaymentsOutlined sx={{ fontSize: 18 }} />}
                  label="Цена за выход"
                  value={pricePerShift}
                />
                <ProfileField
                  icon={<PaymentsOutlined sx={{ fontSize: 18 }} />}
                  label="Цена за клиента"
                  value={pricePerClient}
                />
                <ProfileField
                  icon={<LinkOutlined sx={{ fontSize: 18 }} />}
                  label="Соцсети"
                  value={
                    socialLink ? (
                      <Link
                        href={socialLink.startsWith('http') ? socialLink : `https://${socialLink}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{ fontWeight: 700, fontSize: 13, color: colors.primary }}
                      >
                        {socialLink}
                      </Link>
                    ) : (
                      '—'
                    )
                  }
                />
              </Box>
            </Box>
          </Box>

          <Box sx={cardSx}>
            <SectionTitle icon={<NotesOutlined sx={{ fontSize: 16 }} />}>
              Дополнительная информация
            </SectionTitle>
            <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: '#1B2438', whiteSpace: 'pre-wrap' }}>
              {notes}
            </Typography>
          </Box>
        </>
      )}
    </Box>
  );
};

export default PromoterCardDesktopView;
