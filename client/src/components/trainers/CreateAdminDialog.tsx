import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  FormControl,
  IconButton,
  InputAdornment,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  AdminPanelSettingsOutlined,
  ApartmentOutlined,
  CalendarMonthOutlined,
  Close,
  EmailOutlined,
  GroupsOutlined,
  InfoOutlined,
  LockOutlined,
  LocalOfferOutlined,
  PaymentsOutlined,
  PersonAddAlt1,
  PersonOutline,
  PhoneOutlined,
  PhotoCameraOutlined,
  PlaceOutlined,
  SettingsOutlined,
  ShowChartOutlined,
  VpnKeyOutlined,
} from '@mui/icons-material';
import { apiService } from '../../services/api';
import { colors, radii } from '../../theme/tokens';
import PasswordField from '../common/PasswordField';
import { buildAdminProfileMeta } from '../../utils/staffProfileMeta';

type BranchLite = { id: string; name: string };

type PermissionKey =
  | 'clients'
  | 'employees'
  | 'finance'
  | 'settings'
  | 'branches'
  | 'calendar'
  | 'subscriptions'
  | 'reports';

type FormState = {
  firstName: string;
  lastName: string;
  middleName: string;
  email: string;
  password: string;
  phone: string;
  photoPreview: string;
  isActive: boolean;
  branchId: string;
  permissions: Record<PermissionKey, boolean>;
};

const PERMISSIONS: Array<{
  key: PermissionKey;
  title: string;
  description: string;
  hint: string;
  icon: React.ReactNode;
}> = [
  {
    key: 'clients',
    title: 'Клиенты',
    description: 'Просмотр и редактирование клиентов',
    hint: 'Список клиентов, карточки, статусы и контакты',
    icon: <GroupsOutlined sx={{ fontSize: 20 }} />,
  },
  {
    key: 'branches',
    title: 'Филиалы и группы',
    description: 'Управление филиалами и группами',
    hint: 'Создание и редактирование филиалов, залов и групп',
    icon: <ApartmentOutlined sx={{ fontSize: 20 }} />,
  },
  {
    key: 'employees',
    title: 'Сотрудники',
    description: 'Управление сотрудниками',
    hint: 'Тренеры, администраторы и промоутеры',
    icon: <PersonOutline sx={{ fontSize: 20 }} />,
  },
  {
    key: 'calendar',
    title: 'Календарный план',
    description: 'Просмотр и редактирование расписания',
    hint: 'Тренировки, события и замены в календаре',
    icon: <CalendarMonthOutlined sx={{ fontSize: 20 }} />,
  },
  {
    key: 'finance',
    title: 'Финансы',
    description: 'Просмотр финансовой информации',
    hint: 'Операции, зарплаты и отчёты по деньгам',
    icon: <PaymentsOutlined sx={{ fontSize: 20 }} />,
  },
  {
    key: 'subscriptions',
    title: 'Абонементы',
    description: 'Управление абонементами и платежами',
    hint: 'Тарифы, выдачи и оплаты абонементов',
    icon: <LocalOfferOutlined sx={{ fontSize: 20 }} />,
  },
  {
    key: 'settings',
    title: 'Настройки',
    description: 'Доступ к настройкам системы',
    hint: 'Параметры школы и общие настройки CRM',
    icon: <SettingsOutlined sx={{ fontSize: 20 }} />,
  },
  {
    key: 'reports',
    title: 'Отчеты и аналитика',
    description: 'Просмотр отчетов',
    hint: 'Сводки, аналитика и выгрузки',
    icon: <ShowChartOutlined sx={{ fontSize: 20 }} />,
  },
];

const allPermissionsOn = (): Record<PermissionKey, boolean> =>
  PERMISSIONS.reduce(
    (acc, p) => {
      acc[p.key] = true;
      return acc;
    },
    {} as Record<PermissionKey, boolean>
  );

const emptyForm = (defaultBranchId = ''): FormState => ({
  firstName: '',
  lastName: '',
  middleName: '',
  email: '',
  password: '',
  phone: '',
  photoPreview: '',
  isActive: true,
  branchId: defaultBranchId,
  permissions: allPermissionsOn(),
});

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
  branches: BranchLite[];
  defaultBranchId?: string;
  onError?: (msg: string) => void;
};

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '10px',
    bgcolor: '#fff',
    '& fieldset': { borderColor: '#E5E9F2' },
    '&:hover fieldset': { borderColor: '#C9D7FF' },
    '&.Mui-focused fieldset': { borderColor: colors.primary },
  },
};

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <Typography sx={{ fontSize: 13, fontWeight: 750, color: '#1B2438', mb: 0.65 }}>
      {children}
      {required && (
        <Box component="span" sx={{ color: '#EF4444', ml: 0.35 }}>
          *
        </Box>
      )}
    </Typography>
  );
}

function SectionHead({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mb: 1.5, mt: 0.5 }}>
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
          mt: 0.15,
        }}
      >
        {icon}
      </Box>
      <Box>
        <Typography sx={{ fontWeight: 800, fontSize: 15, color: '#1B2438' }}>{title}</Typography>
        {subtitle && (
          <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: '#8B93A7', mt: 0.2 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
    </Stack>
  );
}

const CreateAdminDialog: React.FC<Props> = ({
  open,
  onClose,
  onSuccess,
  branches,
  defaultBranchId = '',
  onError,
}) => {
  const [form, setForm] = useState<FormState>(() => emptyForm(defaultBranchId));
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setForm(emptyForm(defaultBranchId));
    setLocalError(null);
    setSaving(false);
  }, [open, defaultBranchId]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const togglePermission = (key: PermissionKey) => {
    setForm((prev) => ({
      ...prev,
      permissions: { ...prev.permissions, [key]: !prev.permissions[key] },
    }));
  };

  const onPhoto = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setLocalError('Загрузите JPG или PNG');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setLocalError('Размер фото не более 5 МБ');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => set('photoPreview', String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  const canSubmit =
    form.lastName.trim() &&
    form.firstName.trim() &&
    form.email.trim() &&
    form.password.length >= 6 &&
    form.phone.trim() &&
    !saving;

  const handleSubmit = async () => {
    if (!canSubmit) {
      setLocalError('Заполните обязательные поля (пароль от 6 символов)');
      return;
    }
    setSaving(true);
    setLocalError(null);
    try {
      const permissions = Object.entries(form.permissions)
        .filter(([, on]) => on)
        .map(([key]) => key);
      await apiService.createUser({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        middleName: form.middleName.trim() || undefined,
        email: form.email.trim(),
        password: form.password,
        phone: form.phone.trim(),
        role: 'ADMIN',
        isActive: form.isActive,
        branchId: form.branchId || undefined,
        permissions,
        profileMeta: buildAdminProfileMeta({
          permissions,
          branchId: form.branchId || undefined,
        }),
      });
      await onSuccess();
      onClose();
    } catch (e: any) {
      const msg = e?.response?.data?.error || 'Ошибка создания администратора';
      setLocalError(msg);
      onError?.(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!saving) onClose();
      }}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '16px',
          boxShadow: '0 24px 64px rgba(27, 36, 56, 0.2)',
          overflow: 'hidden',
          maxWidth: 820,
        },
      }}
    >
      <Box sx={{ px: 2.75, pt: 2.25, pb: 1.25, position: 'relative' }}>
        <IconButton
          onClick={() => !saving && onClose()}
          sx={{ position: 'absolute', top: 14, right: 14, color: '#8B93A7' }}
        >
          <Close />
        </IconButton>
        <Stack direction="row" spacing={1.25} alignItems="flex-start" sx={{ pr: 4 }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              bgcolor: '#EEF4FF',
              color: colors.primary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <AdminPanelSettingsOutlined />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: 20, color: '#1B2438', letterSpacing: '-0.02em' }}>
              Добавить нового администратора
            </Typography>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#8B93A7', mt: 0.35 }}>
              Создайте учетную запись администратора с расширенными правами доступа
            </Typography>
          </Box>
        </Stack>
      </Box>

      <Box sx={{ px: 2.75, pb: 1, maxHeight: '70vh', overflow: 'auto' }}>
        {localError && (
          <Typography sx={{ color: '#DC2626', fontWeight: 650, fontSize: 13, mb: 1.5 }}>
            {localError}
          </Typography>
        )}

        <SectionHead icon={<PersonOutline sx={{ fontSize: 18 }} />} title="Основная информация" />
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '130px 1fr' },
            gap: 1.5,
            mb: 2.5,
          }}
        >
          <Box
            onClick={() => fileRef.current?.click()}
            sx={{
              borderRadius: '14px',
              border: '1.5px dashed #C9D7FF',
              bgcolor: '#F5F8FF',
              minHeight: 130,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0.6,
              cursor: 'pointer',
              overflow: 'hidden',
              p: 1,
              '&:hover': { bgcolor: '#EEF4FF' },
            }}
          >
            {form.photoPreview ? (
              <Box
                component="img"
                src={form.photoPreview}
                alt=""
                sx={{ width: '100%', height: 130, objectFit: 'cover', borderRadius: '10px' }}
              />
            ) : (
              <>
                <PhotoCameraOutlined sx={{ color: colors.primary, fontSize: 26 }} />
                <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: colors.primary, textAlign: 'center' }}>
                  Загрузить фото
                </Typography>
                <Typography sx={{ fontSize: 10.5, fontWeight: 600, color: '#8B93A7', textAlign: 'center' }}>
                  JPG, PNG до 5 МБ
                </Typography>
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png"
              hidden
              onChange={(e) => onPhoto(e.target.files?.[0] || null)}
            />
          </Box>

          <Box>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' },
                gap: 1.25,
                mb: 1.25,
              }}
            >
              <Box>
                <FieldLabel required>Фамилия</FieldLabel>
                <TextField
                  size="small"
                  fullWidth
                  placeholder="Иванов"
                  value={form.lastName}
                  onChange={(e) => set('lastName', e.target.value)}
                  sx={fieldSx}
                />
              </Box>
              <Box>
                <FieldLabel required>Имя</FieldLabel>
                <TextField
                  size="small"
                  fullWidth
                  placeholder="Иван"
                  value={form.firstName}
                  onChange={(e) => set('firstName', e.target.value)}
                  sx={fieldSx}
                />
              </Box>
              <Box>
                <FieldLabel>Отчество</FieldLabel>
                <TextField
                  size="small"
                  fullWidth
                  placeholder="Иванович"
                  value={form.middleName}
                  onChange={(e) => set('middleName', e.target.value)}
                  sx={fieldSx}
                />
              </Box>
            </Box>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 1.25,
                mb: 1.25,
              }}
            >
              <Box>
                <FieldLabel required>Email</FieldLabel>
                <TextField
                  size="small"
                  fullWidth
                  type="email"
                  placeholder="example@mail.ru"
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                  sx={fieldSx}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <EmailOutlined sx={{ fontSize: 18, color: colors.primary }} />
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>
              <Box>
                <FieldLabel required>Пароль</FieldLabel>
                <PasswordField
                  size="small"
                  fullWidth
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => set('password', e.target.value)}
                  sx={fieldSx}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockOutlined sx={{ fontSize: 18, color: colors.primary }} />
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>
            </Box>

            <Box>
              <FieldLabel required>Телефон</FieldLabel>
              <TextField
                size="small"
                fullWidth
                placeholder="+7 (___) ___-__-__"
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
                sx={fieldSx}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PhoneOutlined sx={{ fontSize: 18, color: colors.primary }} />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
          </Box>
        </Box>

        <SectionHead
          icon={<VpnKeyOutlined sx={{ fontSize: 18 }} />}
          title="Права доступа"
          subtitle="Выберите разделы, к которым будет иметь доступ администратор"
        />
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            gap: 1.1,
            mb: 2.5,
          }}
        >
          {PERMISSIONS.map((p) => {
            const checked = form.permissions[p.key];
            return (
              <Box
                key={p.key}
                onClick={() => togglePermission(p.key)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 1.25,
                  py: 1.1,
                  borderRadius: '12px',
                  border: '1px solid',
                  borderColor: checked ? '#C9D7FF' : '#EEF1F6',
                  bgcolor: checked ? '#F5F8FF' : '#fff',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s, background-color 0.15s',
                  '&:hover': { borderColor: '#C9D7FF', bgcolor: '#F8FAFF' },
                }}
              >
                <Checkbox
                  checked={checked}
                  tabIndex={-1}
                  disableRipple
                  size="small"
                  sx={{
                    p: 0.5,
                    pointerEvents: 'none',
                    color: '#C5CAD6',
                    '&.Mui-checked': { color: colors.primary },
                  }}
                />
                <Box sx={{ color: colors.primary, display: 'flex', flexShrink: 0 }}>{p.icon}</Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: 13.5, fontWeight: 750, color: '#1B2438', lineHeight: 1.25 }}>
                    {p.title}
                  </Typography>
                  <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: '#8B93A7', lineHeight: 1.3 }}>
                    {p.description}
                  </Typography>
                </Box>
                <Tooltip title={p.hint} arrow>
                  <InfoOutlined
                    sx={{ fontSize: 16, color: '#B0B7C8', flexShrink: 0 }}
                    onClick={(e) => e.stopPropagation()}
                  />
                </Tooltip>
              </Box>
            );
          })}
        </Box>

        <SectionHead icon={<SettingsOutlined sx={{ fontSize: 18 }} />} title="Дополнительные настройки" />
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            gap: 1.5,
            mb: 1.5,
          }}
        >
          <Box>
            <FieldLabel>Статус аккаунта</FieldLabel>
            <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mt: 0.5 }}>
              <Switch
                checked={form.isActive}
                onChange={(e) => set('isActive', e.target.checked)}
                sx={{
                  '& .MuiSwitch-switchBase.Mui-checked': { color: colors.primary },
                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                    bgcolor: colors.primary,
                  },
                }}
              />
              <Box>
                <Typography sx={{ fontSize: 13.5, fontWeight: 750, color: '#1B2438' }}>Активен</Typography>
                <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#8B93A7' }}>
                  Сотрудник сможет входить в систему
                </Typography>
              </Box>
            </Stack>
          </Box>

          <Box>
            <FieldLabel>Филиал (основной)</FieldLabel>
            <FormControl fullWidth size="small">
              <Select
                value={form.branchId}
                displayEmpty
                onChange={(e) => set('branchId', e.target.value)}
                sx={{ borderRadius: '10px', fontWeight: 650 }}
                startAdornment={
                  <InputAdornment position="start">
                    <PlaceOutlined sx={{ fontSize: 18, color: colors.primary }} />
                  </InputAdornment>
                }
                renderValue={(v) => {
                  if (!v) return <span style={{ color: '#8B93A7' }}>Выберите филиал</span>;
                  return branches.find((b) => b.id === v)?.name || v;
                }}
              >
                <MenuItem value="">
                  <em>Не выбран</em>
                </MenuItem>
                {branches.map((b) => (
                  <MenuItem key={b.id} value={b.id}>
                    {b.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </Box>
      </Box>

      <Box
        sx={{
          px: 2.75,
          py: 1.75,
          borderTop: '1px solid #EEF1F6',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 1,
        }}
      >
        <Button
          onClick={() => !saving && onClose()}
          disabled={saving}
          sx={{
            textTransform: 'none',
            fontWeight: 750,
            borderRadius: `${radii.button}px`,
            px: 2.25,
            bgcolor: '#EEF4FF',
            color: colors.primary,
            '&:hover': { bgcolor: '#E0EAFF' },
          }}
        >
          Отмена
        </Button>
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <PersonAddAlt1 />}
          disabled={!canSubmit}
          onClick={() => void handleSubmit()}
          sx={{
            textTransform: 'none',
            fontWeight: 750,
            borderRadius: `${radii.button}px`,
            px: 2.5,
            bgcolor: colors.primary,
            boxShadow: 'none',
            '&:hover': { bgcolor: colors.primaryDark, boxShadow: 'none' },
          }}
        >
          Создать администратора
        </Button>
      </Box>
    </Dialog>
  );
};

export default CreateAdminDialog;
