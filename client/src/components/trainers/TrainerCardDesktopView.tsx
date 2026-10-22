import React from 'react';
import {
  Add,
  ArrowBack,
  Close,
  DeleteOutline,
  DownloadOutlined,
  EditOutlined,
  EmailOutlined,
  EmojiEventsOutlined,
  MoreHoriz,
  PhoneOutlined,
  StarOutline,
  WorkspacePremiumOutlined,
} from '@mui/icons-material';
import {
  Avatar,
  Box,
  Button,
  Chip,
  FormControl,
  IconButton,
  Link,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { format } from 'date-fns';
import { colors } from '../../theme/tokens';
import { Branch } from '../../types';
import { salarySchemeLabel } from '../../utils/salarySchemes';

function isEmployeeAdmin(employee: any): boolean {
  return (
    employee?.employeeType === 'admin' ||
    employee?.user?.role === 'ADMIN' ||
    employee?.role === 'ADMIN'
  );
}

function employeeRoleLabel(employee: any): string {
  if (isEmployeeAdmin(employee)) return 'Администратор';
  if (
    employee?.employeeType === 'promoter' ||
    employee?.user?.role === 'PROMOTER' ||
    employee?.role === 'PROMOTER'
  ) {
    return 'Промоутер';
  }
  return 'Тренер';
}

const cardSx = {
  bgcolor: '#fff',
  borderRadius: '12px',
  border: '1px solid #EEF1F6',
  boxShadow: '0 2px 10px rgba(27, 36, 56, 0.04)',
  p: 2,
};

export type TrainerCardTab =
  | 'overview'
  | 'branches'
  | 'groups'
  | 'schedule'
  | 'finance'
  | 'achievements'
  | 'documents'
  | 'notes';

export type TrainerGroupRow = {
  id: string;
  name: string;
  ageRange?: string | null;
  days?: string | null;
  studentsCount?: number | null;
  isActive?: boolean;
};

type Props = {
  employee: any;
  branches: Branch[];
  tab: TrainerCardTab;
  onTab: (t: TrainerCardTab) => void;
  fromSection?: string;
  onBack?: () => void;
  onClose?: () => void;
  onEdit?: () => void;
  onMore?: (el: HTMLElement) => void;
  canEdit?: boolean;
  selectedBranchId: string;
  onSelectedBranchId: (id: string) => void;
  availableBranches: Branch[];
  onAddBranch?: () => void;
  onRemoveBranch?: (branchId: string) => void;
  branchBusy?: boolean;
  groups: TrainerGroupRow[];
  onOpenEarnings?: () => void;
  stats?: {
    groupsCount: number;
    studentsCount: number;
    lessonsCount: number;
    payout: number;
  };
  documentsPanel?: React.ReactNode;
  editForm?: React.ReactNode;
  editing?: boolean;
};

function fullName(user: any) {
  if (!user) return 'Сотрудник';
  return [user.lastName, user.firstName, user.middleName].filter(Boolean).join(' ').trim() || 'Сотрудник';
}

function parseAchievements(raw?: string | null): string[] {
  if (!raw || !String(raw).trim()) return [];
  return String(raw)
    .split(/\n|;|•/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const TrainerCardDesktopView: React.FC<Props> = ({
  employee,
  tab,
  onTab,
  fromSection = 'Сотрудники',
  onBack,
  onClose,
  onEdit,
  onMore,
  canEdit,
  selectedBranchId,
  onSelectedBranchId,
  availableBranches,
  onAddBranch,
  onRemoveBranch,
  branchBusy,
  groups,
  onOpenEarnings,
  stats,
  documentsPanel,
  editForm,
  editing,
}) => {
  const empUser = employee?.user || employee;
  const name = fullName(empUser);
  const isAdmin = isEmployeeAdmin(employee);
  const roleLabel = employeeRoleLabel(employee);
  const scheme = employee?.salaryScheme || employee?.salaryType;
  const balance = Number(employee?.balance ?? 0);
  const achievements = parseAchievements(employee?.achievements);
  const trainerBranches = (employee?.branches || []) as Array<{
    branchId: string;
    branch?: Branch;
  }>;
  const photo = empUser?.photo || employee?.photo;
  const docs = (employee?.documents || []) as Array<{
    id: string;
    title: string;
    kind?: string;
    createdAt?: string;
  }>;

  const tabs: Array<{ id: TrainerCardTab; label: string; count?: number }> = [
    { id: 'overview', label: 'Общая информация' },
    { id: 'branches', label: 'Филиалы', count: trainerBranches.length || undefined },
    { id: 'groups', label: 'Группы', count: groups.length || undefined },
    { id: 'schedule', label: 'Расписание' },
    { id: 'finance', label: 'Финансы' },
    { id: 'achievements', label: 'Достижения' },
    { id: 'documents', label: 'Документы' },
    { id: 'notes', label: 'Заметки' },
  ];

  const profileRows = [
    { label: 'Квалификация', value: employee?.qualification || '—' },
    { label: 'Специализация', value: employee?.specialization || '—' },
    { label: 'Судейская категория', value: employee?.judgeCategory || '—' },
    {
      label: 'Опыт работы',
      value:
        employee?.experience != null && employee.experience !== ''
          ? `${employee.experience} ${Number(employee.experience) === 1 ? 'год' : 'лет'}`
          : '—',
    },
    { label: 'Тренерская категория', value: employee?.coachCategory || '—' },
    {
      label: 'Дата начала работы',
      value: employee?.hireDate || employee?.workStartDate || employee?.createdAt
        ? format(new Date(employee.hireDate || employee.workStartDate || employee.createdAt), 'dd.MM.yyyy')
        : '—',
    },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }}>
      {/* Top bar */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={onBack || onClose}
          sx={{ textTransform: 'none', fontWeight: 700, color: colors.primary, px: 0 }}
        >
          {fromSection === 'Сотрудники'
            ? 'Назад к списку сотрудников'
            : `Назад: ${fromSection}`}
        </Button>
        <Stack direction="row" spacing={1}>
          {canEdit && !editing && (
            <Button
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
          )}
          <IconButton size="small" onClick={(e) => onMore?.(e.currentTarget)} sx={{ border: '1px solid #C9D7FF', borderRadius: '10px' }}>
            <MoreHoriz />
          </IconButton>
          {onClose && (
            <Button
              variant="outlined"
              startIcon={<Close />}
              onClick={onClose}
              sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '10px', borderColor: '#C9D7FF', color: colors.primary }}
            >
              Закрыть
            </Button>
          )}
        </Stack>
      </Box>

      {/* Hero */}
      <Box sx={{ ...cardSx, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr auto' }, gap: 2, alignItems: 'center' }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', minWidth: 0 }}>
          <Avatar
            src={photo || undefined}
            sx={{ width: 88, height: 88, bgcolor: '#EAF0FF', color: colors.primary, fontWeight: 800, fontSize: 28 }}
          >
            {(empUser?.lastName?.[0] || '') + (empUser?.firstName?.[0] || '')}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: 24, fontWeight: 800, color: '#1B2438', lineHeight: 1.2 }}>
              {name}
            </Typography>
            <Stack direction="row" spacing={0.75} sx={{ mt: 0.75 }} flexWrap="wrap" useFlexGap>
              <Chip
                size="small"
                label={roleLabel}
                sx={{ height: 24, fontWeight: 800, bgcolor: '#FCE7F3', color: '#DB2777' }}
              />
              {employee?.isActive !== false && (
                <Chip
                  size="small"
                  label="Активен"
                  sx={{ height: 24, fontWeight: 800, bgcolor: '#E7F8F2', color: '#12B981' }}
                />
              )}
            </Stack>
            <Stack direction="row" spacing={2} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
              {empUser?.phone && (
                <Typography sx={{ fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                  <PhoneOutlined sx={{ fontSize: 16, color: '#9AA3B5' }} />
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

        {!isAdmin && (
          <Box
            sx={{
              minWidth: 200,
              p: 1.5,
              borderRadius: '12px',
              bgcolor: '#F7F8FB',
              border: '1px solid #EEF1F6',
            }}
          >
            <Typography sx={{ fontSize: 12, color: '#8B93A7', fontWeight: 700, mb: 0.5 }}>
              Схема зарплаты
            </Typography>
            <Chip
              size="small"
              label={salarySchemeLabel(scheme) || '—'}
              sx={{ height: 24, fontWeight: 800, bgcolor: '#EAF0FF', color: colors.primary, mb: 1 }}
            />
            <Typography sx={{ fontSize: 12, color: '#8B93A7' }}>К выплате</Typography>
            <Typography
              onClick={onOpenEarnings}
              sx={{
                fontSize: 20,
                fontWeight: 800,
                color: '#12B981',
                cursor: onOpenEarnings ? 'pointer' : 'default',
                '&:hover': onOpenEarnings ? { textDecoration: 'underline' } : undefined,
              }}
            >
              {balance.toFixed(2)} ₽
            </Typography>
          </Box>
        )}
      </Box>

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
          <Tab
            key={t.id}
            value={t.id}
            label={t.count != null ? `${t.label} (${t.count})` : t.label}
          />
        ))}
      </Tabs>

      {editing && editForm ? (
        <Box sx={cardSx}>{editForm}</Box>
      ) : tab === 'overview' ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: 'minmax(0,1fr) minmax(300px,0.42fr)' },
            gap: 1.75,
            alignItems: 'start',
          }}
        >
          <Stack spacing={1.75}>
            <Box sx={cardSx}>
              <Typography sx={{ fontWeight: 800, fontSize: 16, mb: 1.5 }}>Профиль тренера</Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                  gap: 1.25,
                }}
              >
                {profileRows.map((row) => (
                  <Box key={row.label} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                    <WorkspacePremiumOutlined sx={{ fontSize: 18, color: colors.primary, mt: 0.15 }} />
                    <Box>
                      <Typography sx={{ fontSize: 11, color: '#8B93A7', fontWeight: 600 }}>
                        {row.label}
                      </Typography>
                      <Typography sx={{ fontSize: 13.5, fontWeight: 700 }}>{row.value}</Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>

            <Box sx={cardSx}>
              <Typography sx={{ fontWeight: 800, fontSize: 16, mb: 1.25 }}>Филиалы</Typography>
              {!isAdmin && (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 1.5 }}>
                  <FormControl size="small" sx={{ flex: 1, minWidth: 180 }}>
                    <Select
                      displayEmpty
                      value={selectedBranchId}
                      onChange={(e) => onSelectedBranchId(e.target.value)}
                      sx={{ borderRadius: '10px', fontWeight: 600 }}
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
                    variant="contained"
                    disabled={!selectedBranchId || branchBusy}
                    onClick={onAddBranch}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 700,
                      borderRadius: '10px',
                      bgcolor: colors.primary,
                      boxShadow: 'none',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Добавить
                  </Button>
                </Stack>
              )}
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, color: '#8B93A7' }}>Название</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#8B93A7' }}>Адрес</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#8B93A7' }}>Телефон</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: '#8B93A7' }}>
                      Действия
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {trainerBranches.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4}>
                        <Typography sx={{ color: '#8B93A7', fontSize: 13 }}>Филиалы не назначены</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    trainerBranches.map((tb) => (
                      <TableRow key={tb.branchId}>
                        <TableCell sx={{ fontWeight: 700 }}>{tb.branch?.name || '—'}</TableCell>
                        <TableCell>{tb.branch?.address || '—'}</TableCell>
                        <TableCell>{(tb.branch as any)?.phone || '—'}</TableCell>
                        <TableCell align="right">
                          {!isAdmin && (
                            <IconButton
                              size="small"
                              color="error"
                              disabled={branchBusy}
                              onClick={() => onRemoveBranch?.(tb.branchId)}
                            >
                              <DeleteOutline fontSize="small" />
                            </IconButton>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Box>

            <Box sx={cardSx}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.25 }}>
                <Typography sx={{ fontWeight: 800, fontSize: 16, flex: 1 }}>
                  Достижения и дополнительная информация
                </Typography>
                {canEdit && (
                  <Button size="small" onClick={onEdit} sx={{ textTransform: 'none', fontWeight: 700, color: colors.primary }}>
                    Редактировать
                  </Button>
                )}
              </Box>
              {achievements.length === 0 ? (
                <Typography sx={{ color: '#8B93A7', fontSize: 13 }}>Достижения не указаны</Typography>
              ) : (
                <Stack spacing={1}>
                  {achievements.map((a, i) => (
                    <Box key={`${a}-${i}`} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                      {i % 2 === 0 ? (
                        <EmojiEventsOutlined sx={{ fontSize: 18, color: '#F59E0B', mt: 0.15 }} />
                      ) : (
                        <StarOutline sx={{ fontSize: 18, color: colors.primary, mt: 0.15 }} />
                      )}
                      <Typography sx={{ fontSize: 13.5, fontWeight: 600 }}>{a}</Typography>
                    </Box>
                  ))}
                </Stack>
              )}
            </Box>
          </Stack>

          <Stack spacing={1.75}>
            <Box sx={cardSx}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.25 }}>
                <Typography sx={{ fontWeight: 800, fontSize: 16, flex: 1 }}>Статистика</Typography>
                <Chip size="small" label="Текущий месяц" sx={{ height: 24, fontWeight: 700, bgcolor: '#F3F5F8' }} />
              </Box>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 1,
                }}
              >
                <StatCell label="Группы" value={String(stats?.groupsCount ?? groups.length)} />
                <StatCell label="Учеников" value={String(stats?.studentsCount ?? '—')} />
                <StatCell label="Проведено занятий" value={String(stats?.lessonsCount ?? '—')} />
                <StatCell
                  label="К выплате"
                  value={`${(stats?.payout ?? balance).toLocaleString('ru-RU')} ₽`}
                  accent
                />
              </Box>
            </Box>

            <Box sx={cardSx}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Typography sx={{ fontWeight: 800, fontSize: 16, flex: 1 }}>Группы</Typography>
                <Link
                  component="button"
                  type="button"
                  onClick={() => onTab('groups')}
                  sx={{ fontSize: 13, fontWeight: 700, color: colors.primary, textDecoration: 'none' }}
                >
                  + Добавить группу
                </Link>
              </Box>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, color: '#8B93A7', fontSize: 12 }}>Название</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#8B93A7', fontSize: 12 }}>Возраст</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#8B93A7', fontSize: 12 }}>Дни</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#8B93A7', fontSize: 12 }}>Ученики</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#8B93A7', fontSize: 12 }}>Статус</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {groups.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <Typography sx={{ color: '#8B93A7', fontSize: 13 }}>Нет групп</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    groups.slice(0, 5).map((g) => (
                      <TableRow key={g.id}>
                        <TableCell sx={{ fontWeight: 700, fontSize: 13 }}>{g.name}</TableCell>
                        <TableCell sx={{ fontSize: 12 }}>{g.ageRange || '—'}</TableCell>
                        <TableCell sx={{ fontSize: 12 }}>{g.days || '—'}</TableCell>
                        <TableCell sx={{ fontSize: 12 }}>{g.studentsCount ?? '—'}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={g.isActive === false ? 'Неактивна' : 'Активна'}
                            sx={{
                              height: 22,
                              fontWeight: 800,
                              bgcolor: g.isActive === false ? '#FFF1F4' : '#E7F8F2',
                              color: g.isActive === false ? '#F93C65' : '#12B981',
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Box>

            <Box sx={cardSx}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Typography sx={{ fontWeight: 800, fontSize: 16, flex: 1 }}>Документы</Typography>
                <Link
                  component="button"
                  type="button"
                  onClick={() => onTab('documents')}
                  sx={{ fontSize: 13, fontWeight: 700, color: colors.primary, textDecoration: 'none' }}
                >
                  + Добавить документ
                </Link>
              </Box>
              {docs.length === 0 ? (
                <Typography sx={{ color: '#8B93A7', fontSize: 13 }}>Документов пока нет</Typography>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, color: '#8B93A7', fontSize: 12 }}>Название</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: '#8B93A7', fontSize: 12 }}>Тип</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: '#8B93A7', fontSize: 12 }}>Дата</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: '#8B93A7', fontSize: 12 }}>
                        Действия
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {docs.slice(0, 5).map((d) => (
                      <TableRow key={d.id}>
                        <TableCell sx={{ fontWeight: 700, fontSize: 13 }}>{d.title}</TableCell>
                        <TableCell sx={{ fontSize: 12 }}>{d.kind || '—'}</TableCell>
                        <TableCell sx={{ fontSize: 12 }}>
                          {d.createdAt ? format(new Date(d.createdAt), 'dd.MM.yyyy') : '—'}
                        </TableCell>
                        <TableCell align="right">
                          <IconButton size="small" sx={{ color: colors.primary }}>
                            <DownloadOutlined fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Box>
          </Stack>
        </Box>
      ) : tab === 'documents' ? (
        <Box sx={cardSx}>{documentsPanel || <Typography sx={{ color: '#8B93A7' }}>Нет документов</Typography>}</Box>
      ) : tab === 'branches' ? (
        <Box sx={cardSx}>
          <Typography sx={{ fontWeight: 800, mb: 1 }}>Филиалы</Typography>
          <Typography sx={{ color: '#8B93A7', fontSize: 13 }}>
            Управление филиалами доступно во вкладке «Общая информация».
          </Typography>
        </Box>
      ) : tab === 'groups' ? (
        <Box sx={cardSx}>
          <Typography sx={{ fontWeight: 800, mb: 1 }}>Группы</Typography>
          {groups.length === 0 ? (
            <Typography sx={{ color: '#8B93A7', fontSize: 13 }}>Нет групп</Typography>
          ) : (
            groups.map((g) => (
              <Typography key={g.id} sx={{ py: 0.75, borderBottom: '1px solid #EEF1F6', fontWeight: 600 }}>
                {g.name}
              </Typography>
            ))
          )}
        </Box>
      ) : tab === 'finance' ? (
        <Box sx={cardSx}>
          <Typography sx={{ fontWeight: 800, mb: 1 }}>Финансы</Typography>
          <Button variant="contained" onClick={onOpenEarnings} sx={{ textTransform: 'none', fontWeight: 700 }}>
            Открыть зарплату
          </Button>
        </Box>
      ) : tab === 'achievements' ? (
        <Box sx={cardSx}>
          <Typography sx={{ fontWeight: 800, mb: 1 }}>Достижения</Typography>
          {achievements.length === 0 ? (
            <Typography sx={{ color: '#8B93A7' }}>Достижения не указаны</Typography>
          ) : (
            achievements.map((a, i) => (
              <Typography key={i} sx={{ py: 0.5 }}>
                • {a}
              </Typography>
            ))
          )}
        </Box>
      ) : (
        <Box sx={cardSx}>
          <Typography sx={{ color: '#8B93A7' }}>Раздел в подготовке</Typography>
        </Box>
      )}
    </Box>
  );
};

function StatCell({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Box sx={{ p: 1.25, borderRadius: '10px', bgcolor: '#F7F8FB' }}>
      <Typography sx={{ fontSize: 11, color: '#8B93A7', fontWeight: 700 }}>{label}</Typography>
      <Typography sx={{ fontSize: 16, fontWeight: 800, color: accent ? '#12B981' : '#1B2438', mt: 0.25 }}>
        {value}
      </Typography>
    </Box>
  );
}

export default TrainerCardDesktopView;
