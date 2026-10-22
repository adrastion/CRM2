import React, { useMemo } from 'react';
import {
  Add,
  ApartmentOutlined,
  BadgeOutlined,
  CalendarMonthOutlined,
  Close,
  CommentOutlined,
  DeleteOutline,
  EditOutlined,
  EmailOutlined,
  GroupsOutlined,
  HistoryOutlined,
  KeyOutlined,
  LocalOfferOutlined,
  LockOutlined,
  LoginOutlined,
  MailOutline,
  PaymentsOutlined,
  PersonAddAlt1Outlined,
  PersonOutline,
  PhoneOutlined,
  PlaceOutlined,
  SchoolOutlined,
  SettingsOutlined,
  ShowChartOutlined,
  WorkOutline,
} from '@mui/icons-material';
import {
  Avatar,
  Box,
  Button,
  Chip,
  FormControl,
  IconButton,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { colors, radii } from '../../theme/tokens';
import { Branch } from '../../types';
import { getEmployeeProfileMeta } from '../../utils/staffProfileMeta';

type PermissionKey =
  | 'clients'
  | 'branches'
  | 'employees'
  | 'calendar'
  | 'finance'
  | 'subscriptions'
  | 'settings'
  | 'reports';

const PERMISSION_PILLS: Array<{
  key: PermissionKey;
  label: string;
  icon: React.ReactNode;
}> = [
  { key: 'clients', label: 'Управление клиентами', icon: <GroupsOutlined sx={{ fontSize: 16 }} /> },
  { key: 'finance', label: 'Финансы', icon: <PaymentsOutlined sx={{ fontSize: 16 }} /> },
  { key: 'subscriptions', label: 'Абонементы', icon: <LocalOfferOutlined sx={{ fontSize: 16 }} /> },
  { key: 'calendar', label: 'Расписание', icon: <CalendarMonthOutlined sx={{ fontSize: 16 }} /> },
  { key: 'branches', label: 'Филиалы и группы', icon: <ApartmentOutlined sx={{ fontSize: 16 }} /> },
  { key: 'settings', label: 'Настройки', icon: <SettingsOutlined sx={{ fontSize: 16 }} /> },
  { key: 'reports', label: 'Отчеты', icon: <ShowChartOutlined sx={{ fontSize: 16 }} /> },
  { key: 'employees', label: 'Сотрудники', icon: <PersonOutline sx={{ fontSize: 16 }} /> },
];

const cardSx = {
  bgcolor: '#fff',
  borderRadius: `${radii.panel}px`,
  border: '1px solid #EEF1F6',
  boxShadow: '0 2px 10px rgba(27, 36, 56, 0.04)',
  p: 2,
} as const;

type Props = {
  employee: any;
  branches: Branch[];
  onClose?: () => void;
  onEdit?: () => void;
  canEdit?: boolean;
  selectedBranchId: string;
  onSelectedBranchId: (id: string) => void;
  availableBranches: Branch[];
  onAddBranch?: () => void;
  onRemoveBranch?: (branchId: string) => void;
  branchBusy?: boolean;
  editing?: boolean;
  editForm?: React.ReactNode;
  onChangePassword?: () => void;
  onResendInvite?: () => void;
  onToggleAccess?: () => void;
  accessBusy?: boolean;
};

function fullName(user: any) {
  if (!user) return 'Администратор';
  return (
    [user.lastName, user.firstName, user.middleName].filter(Boolean).join(' ').trim() ||
    'Администратор'
  );
}

function yearsLabel(n: unknown) {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return '—';
  const n10 = v % 10;
  const n100 = v % 100;
  if (n10 === 1 && n100 !== 11) return `${v} год`;
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return `${v} года`;
  return `${v} лет`;
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
  value: string;
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
 * Карточка администратора — макет «Сотрудники - Карточка администратора».
 */
const AdminCardDesktopView: React.FC<Props> = ({
  employee,
  branches,
  onClose,
  onEdit,
  canEdit,
  selectedBranchId,
  onSelectedBranchId,
  availableBranches,
  onAddBranch,
  onRemoveBranch,
  branchBusy,
  editing,
  editForm,
  onChangePassword,
  onResendInvite,
  onToggleAccess,
  accessBusy,
}) => {
  const empUser = employee?.user || employee;
  const name = fullName(empUser);
  const photo = empUser?.photo || employee?.photo;
  const isActive = employee?.isActive !== false && empUser?.isActive !== false;
  const lastSeen =
    formatLastSeen(empUser?.lastLoginAt || empUser?.lastSeenAt || employee?.updatedAt) ||
    'В системе —';

  const meta = useMemo(() => getEmployeeProfileMeta(employee), [employee]);

  const permissionsRaw: string[] = useMemo(() => {
    const fromMeta = Array.isArray(meta.permissions) ? meta.permissions : [];
    if (fromMeta.length) return fromMeta.map(String);
    const raw = empUser?.permissions || employee?.permissions || [];
    if (Array.isArray(raw) && raw.length) return raw.map(String);
    // По умолчанию показываем полный набор (как при создании с «все включено»)
    return PERMISSION_PILLS.map((p) => p.key);
  }, [meta, empUser, employee]);

  const activePills = PERMISSION_PILLS.filter((p) => permissionsRaw.includes(p.key));

  const assignedBranches = useMemo(() => {
    const fromLinks = (employee?.branches || []) as Array<{
      branchId?: string;
      branch?: Branch;
      id?: string;
      name?: string;
      address?: string;
      phone?: string;
    }>;
    if (fromLinks.length) {
      return fromLinks.map((tb) => {
        const b = tb.branch || branches.find((x) => x.id === tb.branchId) || tb;
        return {
          id: String((b as any).id || tb.branchId || ''),
          name: (b as any).name || '—',
          address: (b as any).address || '—',
          phone: (b as any).phone || '—',
        };
      });
    }
    const branchId = empUser?.branchId || employee?.branchId;
    if (branchId) {
      const b = branches.find((x) => x.id === branchId);
      if (b) {
        return [{ id: b.id, name: b.name, address: b.address || '—', phone: b.phone || '—' }];
      }
    }
    return [];
  }, [employee, empUser, branches]);

  const responsibility =
    meta.responsibilityZone ||
    employee?.responsibilityZone ||
    employee?.specialization ||
    empUser?.responsibilityZone ||
    '—';
  const position =
    meta.position ||
    employee?.position ||
    employee?.qualification ||
    empUser?.position ||
    '—';
  const experience = yearsLabel(
    meta.experience ?? employee?.experience ?? empUser?.experience
  );
  const comment =
    meta.comment ||
    employee?.notes ||
    employee?.comment ||
    empUser?.notes ||
    '—';

  const activityItems = useMemo(() => {
    const items: Array<{ icon: React.ReactNode; title: string; when: string }> = [];
    const created = empUser?.createdAt || employee?.createdAt;
    const updated = empUser?.updatedAt || employee?.updatedAt;
    const lastLogin = empUser?.lastLoginAt || empUser?.lastSeenAt;
    if (lastLogin) {
      const d = new Date(lastLogin);
      items.push({
        icon: <LoginOutlined sx={{ fontSize: 18 }} />,
        title: 'Вход в систему',
        when: isToday(d)
          ? `Сегодня, ${format(d, 'HH:mm')}`
          : format(d, 'd MMMM, HH:mm', { locale: ru }),
      });
    }
    if (updated && updated !== created) {
      const d = new Date(updated);
      items.push({
        icon: <EditOutlined sx={{ fontSize: 18 }} />,
        title: 'Обновление профиля',
        when: isToday(d)
          ? `Сегодня, ${format(d, 'HH:mm')}`
          : isYesterday(d)
            ? `Вчера, ${format(d, 'HH:mm')}`
            : format(d, 'd MMMM, HH:mm', { locale: ru }),
      });
    }
    if (created) {
      const d = new Date(created);
      items.push({
        icon: <PersonAddAlt1Outlined sx={{ fontSize: 18 }} />,
        title: 'Учётная запись создана',
        when: format(d, 'd MMMM yyyy, HH:mm', { locale: ru }),
      });
    }
    if (!items.length) {
      items.push(
        {
          icon: <LoginOutlined sx={{ fontSize: 18 }} />,
          title: 'Вход в систему',
          when: '—',
        },
        {
          icon: <PersonAddAlt1Outlined sx={{ fontSize: 18 }} />,
          title: 'Создание клиента',
          when: '—',
        },
        {
          icon: <PaymentsOutlined sx={{ fontSize: 18 }} />,
          title: 'Приём оплаты',
          when: '—',
        },
        {
          icon: <GroupsOutlined sx={{ fontSize: 18 }} />,
          title: 'Назначение в группу',
          when: '—',
        }
      );
    }
    return items.slice(0, 6);
  }, [empUser, employee]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }}>
      {/* Header */}
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
          Карточка администратора
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
          {/* Hero */}
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
                    label="Администратор"
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
                {isActive ? 'Полный доступ' : 'Доступ ограничен'}
              </Typography>
            </Box>
          </Box>

          {/* Profile + Roles */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
              gap: 1.75,
              alignItems: 'stretch',
            }}
          >
            <Box sx={cardSx}>
              <SectionTitle icon={<BadgeOutlined sx={{ fontSize: 16 }} />}>
                Профиль администратора
              </SectionTitle>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                  gap: 1.5,
                }}
              >
                <ProfileField
                  icon={<PlaceOutlined sx={{ fontSize: 18 }} />}
                  label="Зона ответственности"
                  value={responsibility}
                />
                <ProfileField
                  icon={<WorkOutline sx={{ fontSize: 18 }} />}
                  label="Опыт работы"
                  value={experience}
                />
                <ProfileField
                  icon={<SchoolOutlined sx={{ fontSize: 18 }} />}
                  label="Должность"
                  value={position}
                />
                <ProfileField
                  icon={<CommentOutlined sx={{ fontSize: 18 }} />}
                  label="Комментарий"
                  value={comment}
                />
              </Box>
            </Box>

            <Box sx={cardSx}>
              <SectionTitle icon={<LockOutlined sx={{ fontSize: 16 }} />}>Роли и права</SectionTitle>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {activePills.map((p) => (
                  <Chip
                    key={p.key}
                    icon={<Box sx={{ display: 'flex', color: colors.primary, ml: 0.75 }}>{p.icon}</Box>}
                    label={p.label}
                    sx={{
                      height: 32,
                      borderRadius: '10px',
                      bgcolor: '#EEF4FF',
                      color: '#1B2438',
                      fontWeight: 700,
                      fontSize: 12.5,
                      '& .MuiChip-icon': { marginLeft: '8px', marginRight: '-2px' },
                      '& .MuiChip-label': { px: 1 },
                    }}
                  />
                ))}
              </Box>
            </Box>
          </Box>

          {/* Branches */}
          <Box sx={cardSx}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1,
                mb: 1.25,
                flexWrap: 'wrap',
              }}
            >
              <SectionTitle icon={<ApartmentOutlined sx={{ fontSize: 16 }} />}>Филиалы</SectionTitle>
              {canEdit && (
                <Stack direction="row" spacing={1} alignItems="center">
                  <FormControl size="small" sx={{ minWidth: 180 }}>
                    <Select
                      displayEmpty
                      value={selectedBranchId}
                      onChange={(e) => onSelectedBranchId(e.target.value)}
                      sx={{ borderRadius: '10px', fontWeight: 600, fontSize: 13, height: 36 }}
                    >
                      <MenuItem value="">Выберите филиал</MenuItem>
                      {availableBranches.map((b) => (
                        <MenuItem key={b.id} value={b.id}>
                          {b.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Button
                    startIcon={<Add sx={{ fontSize: 18 }} />}
                    disabled={!selectedBranchId || branchBusy}
                    onClick={onAddBranch}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 700,
                      fontSize: 13,
                      color: colors.primary,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Добавить филиал
                  </Button>
                </Stack>
              )}
            </Box>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {['Название', 'Адрес', 'Телефон', 'Действия'].map((h) => (
                    <TableCell
                      key={h}
                      align={h === 'Действия' ? 'right' : 'left'}
                      sx={{ fontWeight: 800, fontSize: 11, color: '#8B93A7', py: 1 }}
                    >
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {assignedBranches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4}>
                      <Typography sx={{ color: '#8B93A7', fontSize: 13 }}>Филиалы не назначены</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  assignedBranches.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell sx={{ fontSize: 13, fontWeight: 700, color: '#1B2438' }}>{b.name}</TableCell>
                      <TableCell sx={{ fontSize: 13, color: '#5A6478' }}>{b.address}</TableCell>
                      <TableCell sx={{ fontSize: 13, color: '#5A6478' }}>{b.phone}</TableCell>
                      <TableCell align="right">
                        {canEdit && onRemoveBranch && (
                          <IconButton
                            size="small"
                            disabled={branchBusy}
                            onClick={() => onRemoveBranch(b.id)}
                            sx={{ color: '#E23B5A' }}
                          >
                            <DeleteOutline sx={{ fontSize: 18 }} />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Box>

          {/* Activity */}
          <Box sx={cardSx} id="admin-activity">
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                mb: 1.25,
              }}
            >
              <SectionTitle icon={<HistoryOutlined sx={{ fontSize: 16 }} />}>Активность</SectionTitle>
              <Button
                endIcon={<Box component="span">→</Box>}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: 13,
                  color: colors.primary,
                }}
                onClick={() => {
                  document.getElementById('admin-activity')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                Все действия
              </Button>
            </Box>
            <Stack spacing={0}>
              {activityItems.map((item, idx) => (
                <Box
                  key={`${item.title}-${idx}`}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: '36px 1fr auto',
                    gap: 1.25,
                    alignItems: 'center',
                    py: 1.15,
                    borderTop: idx === 0 ? 'none' : '1px solid #EEF1F6',
                  }}
                >
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: '10px',
                      bgcolor: '#EEF4FF',
                      color: colors.primary,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {item.icon}
                  </Box>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#1B2438' }}>
                    {item.title}
                  </Typography>
                  <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#8B93A7', whiteSpace: 'nowrap' }}>
                    {item.when}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Box>

          {/* Account management */}
          <Box sx={cardSx}>
            <SectionTitle icon={<KeyOutlined sx={{ fontSize: 16 }} />}>
              Управление учетной записью
            </SectionTitle>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' },
                gap: 1.25,
              }}
            >
              <Button
                variant="outlined"
                startIcon={<LockOutlined sx={{ fontSize: 18 }} />}
                onClick={onChangePassword || onEdit}
                disabled={!canEdit}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: 13,
                  borderRadius: '10px',
                  borderColor: '#C9D7FF',
                  color: colors.primary,
                  py: 1.1,
                  justifyContent: 'flex-start',
                  px: 1.5,
                }}
              >
                Сменить пароль
              </Button>
              <Button
                variant="outlined"
                startIcon={<MailOutline sx={{ fontSize: 18 }} />}
                onClick={onResendInvite}
                disabled={!canEdit}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: 13,
                  borderRadius: '10px',
                  borderColor: '#C9D7FF',
                  color: colors.primary,
                  py: 1.1,
                  justifyContent: 'flex-start',
                  px: 1.5,
                }}
              >
                Отправить приглашение повторно
              </Button>
              <Button
                variant="outlined"
                startIcon={<LockOutlined sx={{ fontSize: 18 }} />}
                onClick={onToggleAccess}
                disabled={!canEdit || accessBusy}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: 13,
                  borderRadius: '10px',
                  borderColor: isActive ? '#FFD0DA' : '#C6F0E2',
                  color: isActive ? '#E23B5A' : '#00997A',
                  py: 1.1,
                  justifyContent: 'flex-start',
                  px: 1.5,
                }}
              >
                {isActive ? 'Отключить доступ' : 'Включить доступ'}
              </Button>
              <Button
                variant="outlined"
                startIcon={<HistoryOutlined sx={{ fontSize: 18 }} />}
                onClick={() => {
                  document.getElementById('admin-activity')?.scrollIntoView({ behavior: 'smooth' });
                }}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: 13,
                  borderRadius: '10px',
                  borderColor: '#C9D7FF',
                  color: colors.primary,
                  py: 1.1,
                  justifyContent: 'flex-start',
                  px: 1.5,
                }}
              >
                История входов
              </Button>
            </Box>
          </Box>
        </>
      )}
    </Box>
  );
};

export default AdminCardDesktopView;
