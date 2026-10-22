import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  FormControl,
  IconButton,
  InputAdornment,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  BarChartOutlined,
  CalendarMonthOutlined,
  Close,
  EmailOutlined,
  EmojiEventsOutlined,
  GavelOutlined,
  MilitaryTechOutlined,
  PersonAddAlt1,
  PhoneOutlined,
  PhotoCameraOutlined,
  PlaceOutlined,
  SchoolOutlined,
  SportsScoreOutlined,
  PaymentsOutlined,
  WcOutlined,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ru } from 'date-fns/locale';
import { format } from 'date-fns';
import { apiService } from '../../services/api';
import { colors, radii } from '../../theme/tokens';
import { SALARY_SCHEME_OPTIONS, salaryRateFieldLabel, salarySchemeHint } from '../../utils/salarySchemes';

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

export type SelfTrainerFormValue = {
  firstName: string;
  lastName: string;
  middleName: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  email: string;
  photoPreview: string;
  qualification: string;
  experience: string;
  specialization: string;
  coachCategory: string;
  judgeCategory: string;
  salaryScheme: string;
  salaryRate: string;
  achievements: string;
  individualTrainingPrice: string;
  branchId: string;
  canViewAllGroups: boolean;
};

const emptyForm = (user?: {
  firstName?: string;
  lastName?: string;
  middleName?: string | null;
  phone?: string | null;
  email?: string;
}): SelfTrainerFormValue => ({
  firstName: user?.firstName || '',
  lastName: user?.lastName || '',
  middleName: user?.middleName || '',
  dateOfBirth: '',
  gender: 'male',
  phone: user?.phone || '',
  email: user?.email || '',
  photoPreview: '',
  qualification: '',
  experience: '',
  specialization: '',
  coachCategory: '',
  judgeCategory: '',
  salaryScheme: '',
  salaryRate: '',
  achievements: '',
  individualTrainingPrice: '',
  branchId: '',
  canViewAllGroups: true,
});

type BranchLite = { id: string; name: string };

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
  user?: {
    firstName?: string;
    lastName?: string;
    middleName?: string | null;
    phone?: string | null;
    email?: string;
  } | null;
  branches: BranchLite[];
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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Typography sx={{ fontWeight: 800, fontSize: 15, color: '#1B2438', mb: 1.25, mt: 0.5 }}>
      {children}
    </Typography>
  );
}

const CreateSelfTrainerDialog: React.FC<Props> = ({
  open,
  onClose,
  onSuccess,
  user,
  branches,
  onError,
}) => {
  const [form, setForm] = useState<SelfTrainerFormValue>(() => emptyForm(user || undefined));
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setForm(emptyForm(user || undefined));
    setLocalError(null);
    setSaving(false);
  }, [open, user?.email, user?.firstName, user?.lastName, user?.middleName, user?.phone]);

  const set = <K extends keyof SelfTrainerFormValue>(key: K, value: SelfTrainerFormValue[K]) => {
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
    form.qualification.trim() &&
    form.experience.trim() &&
    form.specialization.trim() &&
    !saving;

  const handleSubmit = async () => {
    if (!canSubmit) {
      setLocalError('Заполните обязательные поля');
      return;
    }
    setSaving(true);
    setLocalError(null);
    try {
      const scheme = form.salaryScheme || 'per_training_person';
      await apiService.createSelfAsTrainer({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        middleName: form.middleName.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || undefined,
        qualification: form.qualification.trim(),
        experience: form.experience.trim(),
        specialization: form.specialization.trim(),
        coachCategory: form.coachCategory || null,
        judgeCategory: form.judgeCategory || null,
        achievements: form.achievements.trim() || null,
        salaryScheme: scheme,
        salaryType: scheme,
        salaryRate: form.salaryRate ? parseFloat(form.salaryRate) : 0,
        salaryAmount: form.salaryRate ? parseFloat(form.salaryRate) : 0,
        individualTrainingPrice: form.individualTrainingPrice
          ? parseFloat(form.individualTrainingPrice)
          : null,
        branchId: form.branchId || undefined,
        canViewAllGroups: true,
      });
      await onSuccess();
      onClose();
    } catch (e: any) {
      const msg = e?.response?.data?.error || 'Ошибка создания профиля тренера';
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
          maxWidth: 760,
        },
      }}
    >
      <Box sx={{ px: 2.75, pt: 2.25, pb: 1.5, position: 'relative' }}>
        <IconButton
          onClick={() => !saving && onClose()}
          sx={{ position: 'absolute', top: 14, right: 14, color: '#8B93A7' }}
        >
          <Close />
        </IconButton>
        <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ pr: 4 }}>
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
            <PersonAddAlt1 />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: 20, color: '#1B2438', letterSpacing: '-0.02em' }}>
              Создать себя как тренера
            </Typography>
            <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: '#8B93A7', mt: 0.4, lineHeight: 1.45 }}>
              Email и пароль не нужны — профиль тренера привяжется к вашему текущему аккаунту владельца.
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

        <SectionTitle>Основная информация</SectionTitle>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '140px 1fr' },
            gap: 1.5,
            mb: 2,
          }}
        >
          <Box
            onClick={() => fileRef.current?.click()}
            sx={{
              borderRadius: '14px',
              border: '1.5px dashed #C9D7FF',
              bgcolor: '#F5F8FF',
              minHeight: 140,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0.75,
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
                sx={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: '10px' }}
              />
            ) : (
              <>
                <PhotoCameraOutlined sx={{ color: colors.primary, fontSize: 28 }} />
                <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: colors.primary, textAlign: 'center', px: 1 }}>
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

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              gap: 1.25,
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
            <Box sx={{ gridColumn: { sm: '1 / -1' } }}>
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
            <Box>
              <FieldLabel>Дата рождения</FieldLabel>
              <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ru}>
                <DatePicker
                  value={form.dateOfBirth ? new Date(form.dateOfBirth) : null}
                  onChange={(d) => set('dateOfBirth', d && !Number.isNaN(d.getTime()) ? format(d, 'yyyy-MM-dd') : '')}
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
            <Box>
              <FieldLabel>Пол</FieldLabel>
              <FormControl fullWidth size="small">
                <Select
                  value={form.gender}
                  onChange={(e) => set('gender', e.target.value)}
                  sx={{ borderRadius: '10px', fontWeight: 650 }}
                  startAdornment={
                    <InputAdornment position="start">
                      <WcOutlined sx={{ fontSize: 18, color: colors.primary }} />
                    </InputAdornment>
                  }
                >
                  <MenuItem value="male">Мужской</MenuItem>
                  <MenuItem value="female">Женский</MenuItem>
                </Select>
              </FormControl>
            </Box>
            <Box>
              <FieldLabel>Телефон</FieldLabel>
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
              <FieldLabel>Email (необязательно)</FieldLabel>
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
          </Box>
        </Box>

        <SectionTitle>Профессиональная информация</SectionTitle>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            gap: 1.25,
            mb: 2,
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
            <FieldLabel required>Опыт (лет)</FieldLabel>
            <TextField
              size="small"
              fullWidth
              placeholder="Например: 5"
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
            icon={<SportsScoreOutlined sx={{ fontSize: 18, color: colors.primary }} />}
            value={form.specialization}
            onChange={(v) => set('specialization', v)}
            placeholder="Выберите специализацию"
            options={SPECIALIZATIONS.map((q) => ({ value: q, label: q }))}
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
            label="Судейская категория"
            icon={<GavelOutlined sx={{ fontSize: 18, color: colors.primary }} />}
            value={form.judgeCategory}
            onChange={(v) => set('judgeCategory', v)}
            placeholder="Выберите категорию"
            options={JUDGE_CATEGORIES.map((q) => ({ value: q, label: q }))}
          />
          <IconSelect
            label="Зарплата"
            icon={<PaymentsOutlined sx={{ fontSize: 18, color: colors.primary }} />}
            value={form.salaryScheme}
            onChange={(v) => set('salaryScheme', v)}
            placeholder="Выберите тип оплаты"
            options={[
              { value: '', label: 'На группах' },
              ...SALARY_SCHEME_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
            ]}
          />
          {form.salaryScheme === 'fixed_monthly' && (
            <Box>
              <FieldLabel>Ставка (₽ / мес)</FieldLabel>
              <TextField
                size="small"
                fullWidth
                type="number"
                value={form.salaryRate}
                onChange={(e) => set('salaryRate', e.target.value)}
                helperText={salarySchemeHint('fixed_monthly')}
                sx={fieldSx}
              />
            </Box>
          )}
          {form.salaryScheme && form.salaryScheme !== 'fixed_monthly' && form.salaryScheme !== '' && (
            <Box>
              <FieldLabel>{salaryRateFieldLabel(form.salaryScheme as any)}</FieldLabel>
              <TextField
                size="small"
                fullWidth
                type="number"
                value={form.salaryRate}
                onChange={(e) => set('salaryRate', e.target.value)}
                helperText={salarySchemeHint(form.salaryScheme as any)}
                sx={fieldSx}
              />
            </Box>
          )}
        </Box>

        <SectionTitle>Дополнительная информация</SectionTitle>
        <Box sx={{ mb: 1.5 }}>
          <FieldLabel>Достижения, спортивные звания, краткая биография</FieldLabel>
          <TextField
            fullWidth
            multiline
            minRows={3}
            placeholder="Опишите ваши достижения, спортивные звания, опыт работы..."
            value={form.achievements}
            onChange={(e) => set('achievements', e.target.value)}
            sx={fieldSx}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start" sx={{ alignSelf: 'flex-start', mt: 1.25 }}>
                  <EmojiEventsOutlined sx={{ fontSize: 18, color: colors.primary }} />
                </InputAdornment>
              ),
            }}
          />
        </Box>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            gap: 1.25,
            mb: 1,
          }}
        >
          <Box>
            <FieldLabel>Цена индивидуальной тренировки</FieldLabel>
            <TextField
              size="small"
              fullWidth
              placeholder="Например: 1500"
              value={form.individualTrainingPrice}
              onChange={(e) => set('individualTrainingPrice', e.target.value.replace(/[^\d.]/g, ''))}
              sx={fieldSx}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PaymentsOutlined sx={{ fontSize: 18, color: colors.primary }} />
                  </InputAdornment>
                ),
                endAdornment: <InputAdornment position="end">₽</InputAdornment>,
              }}
            />
          </Box>
          <IconSelect
            label="Филиал (основной)"
            icon={<PlaceOutlined sx={{ fontSize: 18, color: colors.primary }} />}
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
            border: `1px solid ${colors.primary}`,
            color: colors.primary,
            bgcolor: '#fff',
            '&:hover': { bgcolor: '#EEF4FF' },
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
          Создать профиль
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

export default CreateSelfTrainerDialog;
