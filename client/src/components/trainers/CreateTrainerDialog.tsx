import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  FormControl,
  FormControlLabel,
  IconButton,
  InputAdornment,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import {
  ApartmentOutlined,
  BarChartOutlined,
  CalendarMonthOutlined,
  Close,
  DescriptionOutlined,
  EmailOutlined,
  GavelOutlined,
  LockOutlined,
  MilitaryTechOutlined,
  PersonAddAlt1,
  PersonOutline,
  PhoneOutlined,
  PhotoCameraOutlined,
  SchoolOutlined,
  SettingsOutlined,
  WorkOutline,
  PaymentsOutlined,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ru } from 'date-fns/locale';
import { format } from 'date-fns';
import { apiService } from '../../services/api';
import { colors, radii } from '../../theme/tokens';
import PasswordField from '../common/PasswordField';
import { salarySchemeHint } from '../../utils/salarySchemes';

const ACHIEVEMENTS_MAX = 1000;
const TRAINER_FIXED_MONTHLY = 'fixed_monthly';

const QUALIFICATIONS = [
  'МСМК',
  'МС',
  'КМС',
  '1 разряд',
  '2 разряд',
  '3 разряд',
  '1-й дан',
  '2-й дан',
  '3-й дан',
  '4-й дан',
  '5-й дан и выше',
  'Другое',
] as const;

const SPECIALIZATIONS = [
  'Каратэ',
  'Дзюдо',
  'Бокс',
  'Кикбоксинг',
  'Самбо',
  'Тхэквондо',
  'Вольная борьба',
  'Греко-римская борьба',
  'Смешанные единоборства',
  'ОФП',
  'Плавание',
  'Другое',
] as const;

const COACH_CATEGORIES = ['Высшая', 'Первая', 'Вторая', 'Третья', 'Без категории'] as const;
const JUDGE_CATEGORIES = [
  'Всероссийская',
  'Первая',
  'Вторая',
  'Третья',
  'Юный судья',
  'Нет',
] as const;

type BranchLite = { id: string; name: string };

type FormState = {
  firstName: string;
  lastName: string;
  middleName: string;
  email: string;
  password: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  branchId: string;
  photoPreview: string;
  qualification: string;
  experience: string;
  specialization: string;
  coachCategory: string;
  judgeCategory: string;
  salaryScheme: string;
  salaryRate: string;
  achievements: string;
  grantAccess: boolean;
  isActive: boolean;
};

const emptyForm = (defaultBranchId = ''): FormState => ({
  firstName: '',
  lastName: '',
  middleName: '',
  email: '',
  password: '',
  phone: '',
  dateOfBirth: '',
  gender: 'male',
  branchId: defaultBranchId,
  photoPreview: '',
  qualification: '',
  experience: '',
  specialization: '',
  coachCategory: '',
  judgeCategory: '',
  salaryScheme: '',
  salaryRate: '',
  achievements: '',
  grantAccess: true,
  isActive: true,
});

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
  branches: BranchLite[];
  requireBranch?: boolean;
  defaultBranchId?: string;
  canViewAllGroups?: boolean;
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
}: {
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5, mt: 0.5 }}>
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
        }}
      >
        {icon}
      </Box>
      <Typography sx={{ fontWeight: 800, fontSize: 15, color: '#1B2438' }}>{title}</Typography>
    </Stack>
  );
}

const CreateTrainerDialog: React.FC<Props> = ({
  open,
  onClose,
  onSuccess,
  branches,
  requireBranch,
  defaultBranchId = '',
  canViewAllGroups = true,
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
    form.qualification.trim() &&
    form.specialization.trim() &&
    (!requireBranch || Boolean(form.branchId)) &&
    !saving;

  const handleSubmit = async () => {
    if (!canSubmit) {
      setLocalError(
        requireBranch && !form.branchId
          ? 'Укажите филиал для нового тренера'
          : 'Заполните обязательные поля (пароль от 6 символов)'
      );
      return;
    }
    setSaving(true);
    setLocalError(null);
    try {
      const scheme =
        form.salaryScheme === TRAINER_FIXED_MONTHLY ? TRAINER_FIXED_MONTHLY : 'per_training_person';
      await apiService.createTrainer({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        middleName: form.middleName.trim() || undefined,
        email: form.email.trim(),
        password: form.password,
        phone: form.phone.trim(),
        qualification: form.qualification.trim(),
        experience: form.experience.trim() || undefined,
        specialization: form.specialization.trim(),
        coachCategory: form.coachCategory || null,
        judgeCategory: form.judgeCategory || null,
        achievements: form.achievements.trim() || null,
        branchId: form.branchId || undefined,
        canViewAllGroups: requireBranch ? false : canViewAllGroups,
        salaryScheme: scheme,
        salaryType: scheme,
        salaryRate: scheme === TRAINER_FIXED_MONTHLY && form.salaryRate ? parseFloat(form.salaryRate) : 0,
        salaryAmount:
          scheme === TRAINER_FIXED_MONTHLY && form.salaryRate ? parseFloat(form.salaryRate) : 0,
        grantAccess: form.grantAccess,
        isActive: form.isActive,
      });
      await onSuccess();
      onClose();
    } catch (e: any) {
      const msg = e?.response?.data?.error || 'Ошибка создания тренера';
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
          maxWidth: 780,
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
        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ pr: 4 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              bgcolor: '#EEF4FF',
              color: colors.primary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <PersonAddAlt1 />
          </Box>
          <Typography sx={{ fontWeight: 800, fontSize: 20, color: '#1B2438', letterSpacing: '-0.02em' }}>
            Добавить нового тренера
          </Typography>
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
            mb: 2.25,
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
              onChange={(e) => {
                onPhoto(e.target.files?.[0] || null);
                e.target.value = '';
              }}
            />
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.15 }}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' },
                gap: 1.15,
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
                gap: 1.15,
              }}
            >
              <Box>
                <FieldLabel required>Email</FieldLabel>
                <TextField
                  size="small"
                  fullWidth
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
              <Box>
                <FieldLabel>Дата рождения</FieldLabel>
                <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ru}>
                  <DatePicker
                    value={form.dateOfBirth ? new Date(form.dateOfBirth) : null}
                    onChange={(d) =>
                      set(
                        'dateOfBirth',
                        d && !Number.isNaN(d.getTime()) ? format(d, 'yyyy-MM-dd') : ''
                      )
                    }
                    format="dd.MM.yyyy"
                    slotProps={{
                      textField: {
                        size: 'small',
                        fullWidth: true,
                        placeholder: 'ДД.ММ.ГГГГ',
                        sx: fieldSx,
                        InputProps: {
                          startAdornment: (
                            <InputAdornment position="start">
                              <CalendarMonthOutlined sx={{ fontSize: 18, color: colors.primary }} />
                            </InputAdornment>
                          ),
                        },
                      },
                    }}
                  />
                </LocalizationProvider>
              </Box>
            </Box>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 1.15,
                alignItems: 'end',
              }}
            >
              <Box>
                <FieldLabel>Пол</FieldLabel>
                <RadioGroup
                  row
                  value={form.gender}
                  onChange={(e) => set('gender', e.target.value)}
                  sx={{ mt: 0.25 }}
                >
                  <FormControlLabel
                    value="male"
                    control={<Radio size="small" sx={{ color: colors.primary, '&.Mui-checked': { color: colors.primary } }} />}
                    label={<Typography sx={{ fontSize: 13.5, fontWeight: 650 }}>Мужской</Typography>}
                  />
                  <FormControlLabel
                    value="female"
                    control={<Radio size="small" sx={{ color: colors.primary, '&.Mui-checked': { color: colors.primary } }} />}
                    label={<Typography sx={{ fontSize: 13.5, fontWeight: 650 }}>Женский</Typography>}
                  />
                </RadioGroup>
              </Box>
              <IconSelect
                label="Филиал"
                required={requireBranch}
                icon={<ApartmentOutlined sx={{ fontSize: 18, color: colors.primary }} />}
                value={form.branchId}
                onChange={(v) => set('branchId', v)}
                placeholder="Выберите филиал"
                options={[
                  { value: '', label: 'Не выбран' },
                  ...branches.map((b) => ({ value: b.id, label: b.name })),
                ]}
              />
            </Box>
          </Box>
        </Box>

        <SectionHead icon={<WorkOutline sx={{ fontSize: 18 }} />} title="Профессиональная информация" />
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            gap: 1.25,
            mb: 2.25,
          }}
        >
          <IconSelect
            label="Квалификация"
            required
            icon={<SchoolOutlined sx={{ fontSize: 18, color: colors.primary }} />}
            value={form.qualification}
            onChange={(v) => set('qualification', v)}
            placeholder="Выберите квалификацию"
            options={QUALIFICATIONS.map((q) => ({ value: q, label: q }))}
          />
          <Box>
            <FieldLabel>Опыт работы (лет)</FieldLabel>
            <TextField
              size="small"
              fullWidth
              placeholder="Например: 3"
              value={form.experience}
              onChange={(e) => set('experience', e.target.value.replace(/[^\d]/g, ''))}
              sx={fieldSx}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <BarChartOutlined sx={{ fontSize: 18, color: colors.primary }} />
                  </InputAdornment>
                ),
              }}
            />
          </Box>
          <IconSelect
            label="Специализация"
            required
            icon={<SettingsOutlined sx={{ fontSize: 18, color: colors.primary }} />}
            value={form.specialization}
            onChange={(v) => set('specialization', v)}
            placeholder="Выберите специализацию"
            options={SPECIALIZATIONS.map((q) => ({ value: q, label: q }))}
          />
          <IconSelect
            label="Судейская категория"
            icon={<GavelOutlined sx={{ fontSize: 18, color: colors.primary }} />}
            value={form.judgeCategory}
            onChange={(v) => set('judgeCategory', v)}
            placeholder="Выберите категорию"
            options={JUDGE_CATEGORIES.map((q) => ({ value: q, label: q }))}
          />
          <IconSelect
            label="Тренерская категория"
            icon={<MilitaryTechOutlined sx={{ fontSize: 18, color: colors.primary }} />}
            value={form.coachCategory}
            onChange={(v) => set('coachCategory', v)}
            placeholder="Выберите категорию"
            options={COACH_CATEGORIES.map((q) => ({ value: q, label: q }))}
          />
          <IconSelect
            label="Зарплата сотрудника"
            icon={<PaymentsOutlined sx={{ fontSize: 18, color: colors.primary }} />}
            value={form.salaryScheme}
            onChange={(v) => set('salaryScheme', v)}
            placeholder="Фикс в месяц / на группах"
            options={[
              { value: 'per_training_person', label: 'На группах' },
              { value: TRAINER_FIXED_MONTHLY, label: 'Фикс плата в месяц' },
            ]}
          />
          {form.salaryScheme === TRAINER_FIXED_MONTHLY && (
            <Box>
              <FieldLabel>Сумма в месяц</FieldLabel>
              <TextField
                size="small"
                fullWidth
                type="number"
                placeholder="Например: 50000"
                value={form.salaryRate}
                onChange={(e) => set('salaryRate', e.target.value)}
                helperText={salarySchemeHint(TRAINER_FIXED_MONTHLY)}
                sx={fieldSx}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Typography sx={{ fontWeight: 800, color: colors.primary }}>₽</Typography>
                    </InputAdornment>
                  ),
                  endAdornment: <InputAdornment position="end">₽</InputAdornment>,
                }}
              />
            </Box>
          )}
        </Box>

        <SectionHead
          icon={<DescriptionOutlined sx={{ fontSize: 18 }} />}
          title="Дополнительная информация"
        />
        <Box sx={{ mb: 2 }}>
          <TextField
            fullWidth
            multiline
            minRows={3}
            placeholder="Достижения, спортивные звания, краткая биография, дополнительные сведения..."
            value={form.achievements}
            onChange={(e) => set('achievements', e.target.value.slice(0, ACHIEVEMENTS_MAX))}
            sx={fieldSx}
          />
          <Typography sx={{ textAlign: 'right', fontSize: 11.5, fontWeight: 650, color: '#8B93A7', mt: 0.5 }}>
            {form.achievements.length} / {ACHIEVEMENTS_MAX}
          </Typography>
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            gap: 1.5,
            mb: 1,
            p: 1.5,
            borderRadius: '12px',
            bgcolor: '#F7F8FB',
            border: '1px solid #EEF1F6',
          }}
        >
          <Box>
            <Typography sx={{ fontSize: 13, fontWeight: 750, color: '#1B2438', mb: 0.5 }}>
              Доступ к системе
            </Typography>
            <FormControlLabel
              control={
                <Checkbox
                  checked={form.grantAccess}
                  onChange={(e) => set('grantAccess', e.target.checked)}
                  sx={{ color: colors.primary, '&.Mui-checked': { color: colors.primary } }}
                />
              }
              label={
                <Typography sx={{ fontSize: 13.5, fontWeight: 650 }}>
                  Предоставить доступ в систему
                </Typography>
              }
            />
          </Box>
          <Box>
            <Typography sx={{ fontSize: 13, fontWeight: 750, color: '#1B2438', mb: 0.5 }}>
              Статус
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Switch
                checked={form.isActive}
                onChange={(e) => set('isActive', e.target.checked)}
                sx={{
                  '& .MuiSwitch-switchBase.Mui-checked': { color: colors.primary },
                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: colors.primary },
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
          Создать тренера
        </Button>
      </Box>
    </Dialog>
  );
};

function IconSelect({
  label,
  required,
  icon,
  value,
  onChange,
  placeholder,
  options,
}: {
  label: string;
  required?: boolean;
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <Box>
      <FieldLabel required={required}>{label}</FieldLabel>
      <FormControl fullWidth size="small">
        <Select
          value={value}
          displayEmpty
          onChange={(e) => onChange(e.target.value)}
          sx={{ borderRadius: '10px', fontWeight: 650 }}
          startAdornment={<InputAdornment position="start">{icon}</InputAdornment>}
          renderValue={(v) => {
            if (!v) return <span style={{ color: '#8B93A7' }}>{placeholder}</span>;
            return options.find((o) => o.value === v)?.label || v;
          }}
        >
          {options.map((o) => (
            <MenuItem key={o.value || 'empty'} value={o.value}>
              {o.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
}

export default CreateTrainerDialog;
