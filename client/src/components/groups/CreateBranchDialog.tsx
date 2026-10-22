import React, { useRef } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  AccessTime,
  Add,
  Apartment,
  Check,
  Close,
  EmailOutlined,
  EmojiEventsOutlined,
  FlagOutlined,
  HomeOutlined,
  MapOutlined,
  PersonOutline,
  PlaceOutlined,
  StorefrontOutlined,
} from '@mui/icons-material';
import { colors, radii } from '../../theme/tokens';

export const BRANCH_COLOR_SWATCHES = [
  '#2F6BFF',
  '#12B981',
  '#F97316',
  '#EAB308',
  '#8B5CF6',
  '#EC4899',
  '#14B8A6',
  '#64748B',
  '#94A3B8',
] as const;

export const BRANCH_ICON_OPTIONS = [
  { id: 'building', Icon: Apartment },
  { id: 'home', Icon: HomeOutlined },
  { id: 'store', Icon: StorefrontOutlined },
  { id: 'flag', Icon: FlagOutlined },
  { id: 'trophy', Icon: EmojiEventsOutlined },
] as const;

export const WORKING_HOURS_PRESETS = [
  'Пн – Вс 08:00 – 22:00',
  'Пн – Пт 09:00 – 21:00',
  'Пн – Сб 08:00 – 20:00',
  'Сб – Вс 10:00 – 18:00',
] as const;

export const BRANCH_SPECIALIZATIONS = [
  'Каратэ',
  'Дзюдо',
  'Бокс',
  'Кикбоксинг',
  'Самбо',
  'Тхэквондо',
  'Смешанные единоборства',
  'Другое',
] as const;

export const TRAINING_TYPE_OPTIONS = [
  'Групповые',
  'Индивидуальные',
  'Спарринги',
  'ОФП',
  'Соревновательная подготовка',
  'Детские',
  'Взрослые',
] as const;

export type BranchFormValue = {
  name: string;
  shortName: string;
  address: string;
  phone: string;
  email: string;
  description: string;
  seniorTrainerId: string;
  isActive: boolean;
  workingHours: string;
  specialization: string;
  trainingTypes: string[];
  color: string;
  icon: string;
  mapLat: string;
  mapLng: string;
  photoBase64: string;
};

export const emptyBranchFormValue = (): BranchFormValue => ({
  name: '',
  shortName: '',
  address: '',
  phone: '',
  email: '',
  description: '',
  seniorTrainerId: '',
  isActive: true,
  workingHours: WORKING_HOURS_PRESETS[0],
  specialization: '',
  trainingTypes: [],
  color: BRANCH_COLOR_SWATCHES[0],
  icon: 'building',
  mapLat: '',
  mapLng: '',
  photoBase64: '',
});

type TrainerOpt = {
  id: string;
  user?: { firstName?: string; lastName?: string; middleName?: string; email?: string } | null;
};

type Props = {
  open: boolean;
  value: BranchFormValue;
  onChange: (next: BranchFormValue | ((prev: BranchFormValue) => BranchFormValue)) => void;
  errors: Record<string, string>;
  trainers: TrainerOpt[];
  canAssignSenior?: boolean;
  seniorSlot?: React.ReactNode;
  saving?: boolean;
  onClose: () => void;
  onSubmit: () => void;
};

const fieldSx = {
  '& .MuiOutlinedInput-root': { borderRadius: '10px', bgcolor: '#fff', fontWeight: 600 },
  '& .MuiInputLabel-root': { fontWeight: 700 },
};

const sectionTitle = (label: string) => (
  <Typography
    sx={{
      fontWeight: 800,
      fontSize: 14,
      color: '#1B2438',
      mb: 1.25,
      mt: 0.5,
      letterSpacing: '-0.01em',
    }}
  >
    {label}
  </Typography>
);

const CreateBranchDialog: React.FC<Props> = ({
  open,
  value,
  onChange,
  errors,
  trainers,
  canAssignSenior,
  seniorSlot,
  saving,
  onClose,
  onSubmit,
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof BranchFormValue>(key: K, v: BranchFormValue[K]) =>
    onChange((prev) => ({ ...prev, [key]: v }));

  const onPickPhoto = (file: File | null) => {
    if (!file) return;
    if (!/^image\/(jpeg|jpg|png|webp)$/i.test(file.type)) {
      return;
    }
    if (file.size > 5 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') set('photoBase64', reader.result);
    };
    reader.readAsDataURL(file);
  };

  const trainerLabel = (t: TrainerOpt) =>
    [t.user?.lastName, t.user?.firstName, t.user?.middleName].filter(Boolean).join(' ') ||
    t.user?.email ||
    t.id;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      data-onboarding="branch-form-dialog"
      PaperProps={{
        sx: {
          borderRadius: { xs: 0, sm: `${radii.panel}px` },
          bgcolor: '#fff',
          boxShadow: '0 16px 48px rgba(27, 36, 56, 0.18)',
        },
      }}
    >
      <Box sx={{ px: 3, pt: 2.5, pb: 1, display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: '12px',
            bgcolor: '#EEF4FF',
            color: colors.primary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Apartment />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 18, color: '#1B2438' }}>
            Создать новый филиал
          </Typography>
          <Typography sx={{ fontSize: 13, color: '#8B93A7', fontWeight: 600, mt: 0.25 }}>
            Укажите данные локации: контакты, расписание и оформление.
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ color: '#8B93A7' }}>
          <Close fontSize="small" />
        </IconButton>
      </Box>

      <DialogContent sx={{ px: 3, pt: 1.5 }}>
        {Object.keys(errors).length > 0 && (
          <Alert severity="warning" sx={{ mb: 2, borderRadius: '10px' }}>
            Исправьте {Object.keys(errors).length}{' '}
            {Object.keys(errors).length === 1 ? 'ошибку' : 'ошибок'} в форме
          </Alert>
        )}

        {sectionTitle('Основная информация')}

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
          <Box
            onClick={() => fileRef.current?.click()}
            sx={{
              width: { xs: '100%', sm: 140 },
              height: 120,
              borderRadius: '12px',
              border: '1px dashed #C9D7FF',
              bgcolor: '#F7F8FB',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
              overflow: 'hidden',
              '&:hover': { borderColor: colors.primary, bgcolor: '#EEF4FF' },
            }}
          >
            {value.photoBase64 ? (
              <Box
                component="img"
                src={value.photoBase64}
                alt=""
                sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <>
                <Add sx={{ color: colors.primary, mb: 0.5 }} />
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: colors.primary, textAlign: 'center', px: 1 }}>
                  Загрузить фото
                </Typography>
                <Typography sx={{ fontSize: 10, color: '#8B93A7', mt: 0.25 }}>JPG, PNG до 5 МБ</Typography>
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={(e) => onPickPhoto(e.target.files?.[0] || null)}
            />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack spacing={1.5}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <TextField
                  required
                  fullWidth
                  label="Название филиала"
                  value={value.name}
                  onChange={(e) => set('name', e.target.value)}
                  error={!!errors.name}
                  helperText={errors.name}
                  sx={fieldSx}
                />
                <TextField
                  fullWidth
                  label="Короткое название"
                  value={value.shortName}
                  onChange={(e) => set('shortName', e.target.value)}
                  sx={fieldSx}
                />
                <FormControl fullWidth required sx={{ minWidth: 140, maxWidth: { sm: 180 } }}>
                  <InputLabel>Статус</InputLabel>
                  <Select
                    label="Статус"
                    value={value.isActive ? 'active' : 'inactive'}
                    onChange={(e) => set('isActive', e.target.value === 'active')}
                    sx={{ borderRadius: '10px', fontWeight: 600 }}
                  >
                    <MenuItem value="active">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#12B981' }} />
                        Активен
                      </Box>
                    </MenuItem>
                    <MenuItem value="inactive">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#94A3B8' }} />
                        Неактивен
                      </Box>
                    </MenuItem>
                  </Select>
                </FormControl>
              </Stack>
            </Stack>
          </Box>
        </Stack>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 1.5 }}>
          <TextField
            required
            fullWidth
            label="Адрес"
            value={value.address}
            onChange={(e) => set('address', e.target.value)}
            error={!!errors.address}
            helperText={errors.address}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <PlaceOutlined sx={{ fontSize: 18, color: '#8B93A7' }} />
                </InputAdornment>
              ),
            }}
            sx={fieldSx}
          />
          <Box
            sx={{
              width: { xs: '100%', sm: 160 },
              height: 56,
              borderRadius: '10px',
              border: '1px solid #EEF1F6',
              bgcolor: '#E8F0E9',
              backgroundImage:
                'linear-gradient(135deg, rgba(47,107,255,0.08) 25%, transparent 25%), linear-gradient(225deg, rgba(47,107,255,0.08) 25%, transparent 25%)',
              backgroundSize: '16px 16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <MapOutlined sx={{ fontSize: 18, color: colors.primary }} />
            <Button
              size="small"
              onClick={() => {
                if (!value.mapLat) set('mapLat', '55.75');
                if (!value.mapLng) set('mapLng', '37.62');
              }}
              sx={{ textTransform: 'none', fontWeight: 700, fontSize: 11, color: colors.primary, mt: 0.25 }}
            >
              Указать на карте
            </Button>
          </Box>
        </Stack>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 1.5 }}>
          <TextField
            required
            fullWidth
            label="Телефон"
            placeholder="+7 (921) 123-45-67"
            value={value.phone}
            onChange={(e) => set('phone', e.target.value)}
            error={!!errors.phone}
            helperText={errors.phone}
            sx={fieldSx}
          />
          <TextField
            fullWidth
            label="Email"
            type="email"
            value={value.email}
            onChange={(e) => set('email', e.target.value.toLowerCase())}
            error={!!errors.email}
            helperText={errors.email}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <EmailOutlined sx={{ fontSize: 18, color: '#8B93A7' }} />
                </InputAdornment>
              ),
            }}
            sx={fieldSx}
          />
        </Stack>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
          <FormControl fullWidth>
            <InputLabel>Часы работы</InputLabel>
            <Select
              label="Часы работы"
              value={value.workingHours || WORKING_HOURS_PRESETS[0]}
              onChange={(e) => set('workingHours', e.target.value)}
              startAdornment={
                <InputAdornment position="start">
                  <AccessTime sx={{ fontSize: 18, color: '#8B93A7', ml: 1 }} />
                </InputAdornment>
              }
              sx={{ borderRadius: '10px', fontWeight: 600 }}
            >
              {WORKING_HOURS_PRESETS.map((h) => (
                <MenuItem key={h} value={h}>
                  {h}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {canAssignSenior &&
            (seniorSlot || (
              <FormControl fullWidth>
                <InputLabel>Ответственный администратор</InputLabel>
                <Select
                  label="Ответственный администратор"
                  value={value.seniorTrainerId}
                  onChange={(e) => set('seniorTrainerId', String(e.target.value))}
                  startAdornment={
                    <InputAdornment position="start">
                      <PersonOutline sx={{ fontSize: 18, color: '#8B93A7', ml: 1 }} />
                    </InputAdornment>
                  }
                  sx={{ borderRadius: '10px', fontWeight: 600 }}
                >
                  <MenuItem value="">
                    <em>Выберите сотрудника</em>
                  </MenuItem>
                  {trainers.map((t) => (
                    <MenuItem key={t.id} value={t.id}>
                      {trainerLabel(t)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ))}
        </Stack>

        {sectionTitle('Дополнительная информация')}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 1.5 }}>
          <FormControl fullWidth>
            <InputLabel>Специализация</InputLabel>
            <Select
              label="Специализация"
              value={value.specialization}
              onChange={(e) => set('specialization', e.target.value)}
              sx={{ borderRadius: '10px', fontWeight: 600 }}
            >
              <MenuItem value="">
                <em>Не указана</em>
              </MenuItem>
              {BRANCH_SPECIALIZATIONS.map((s) => (
                <MenuItem key={s} value={s}>
                  {s}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth>
            <InputLabel>Виды тренировок</InputLabel>
            <Select
              multiple
              label="Виды тренировок"
              value={value.trainingTypes}
              onChange={(e) =>
                set(
                  'trainingTypes',
                  typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value
                )
              }
              renderValue={(selected) =>
                selected.length ? selected.join(', ') : 'Выберите виды тренировок'
              }
              displayEmpty
              sx={{ borderRadius: '10px', fontWeight: 600 }}
            >
              {TRAINING_TYPE_OPTIONS.map((t) => (
                <MenuItem key={t} value={t}>
                  {t}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
        <Box sx={{ mb: 2 }}>
          <TextField
            fullWidth
            multiline
            minRows={3}
            label="Описание"
            placeholder="Инфраструктура, преимущества, особенности филиала..."
            value={value.description}
            onChange={(e) => set('description', e.target.value.slice(0, 500))}
            sx={fieldSx}
          />
          <Typography sx={{ mt: 0.5, textAlign: 'right', fontSize: 12, fontWeight: 600, color: '#8B93A7' }}>
            {value.description.length} / 500
          </Typography>
        </Box>

        {sectionTitle('Цвет и отображение')}
        <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#8B93A7', mb: 1 }}>Цвет филиала</Typography>
        <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
          {BRANCH_COLOR_SWATCHES.map((c) => {
            const selected = value.color === c;
            return (
              <Box
                key={c}
                onClick={() => set('color', c)}
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  bgcolor: c,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  outline: selected ? `2px solid ${c}` : 'none',
                  outlineOffset: 2,
                  boxShadow: selected ? '0 0 0 2px #fff' : 'none',
                }}
              >
                {selected && <Check sx={{ fontSize: 16, color: '#fff' }} />}
              </Box>
            );
          })}
        </Stack>
        <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#8B93A7', mb: 1 }}>Иконка</Typography>
        <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
          {BRANCH_ICON_OPTIONS.map(({ id, Icon }) => {
            const selected = value.icon === id;
            return (
              <IconButton
                key={id}
                onClick={() => set('icon', id)}
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: '10px',
                  border: selected ? `2px solid ${colors.primary}` : '1px solid #EEF1F6',
                  bgcolor: selected ? '#EEF4FF' : '#fff',
                  color: selected ? colors.primary : '#8B93A7',
                }}
              >
                <Icon fontSize="small" />
              </IconButton>
            );
          })}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, pt: 1, gap: 1 }}>
        <Button
          onClick={onClose}
          variant="outlined"
          sx={{
            textTransform: 'none',
            fontWeight: 700,
            borderRadius: '10px',
            borderColor: '#C9D7FF',
            color: colors.primary,
          }}
        >
          Отмена
        </Button>
        <Button
          onClick={onSubmit}
          variant="contained"
          disabled={saving || !value.name || !value.address}
          startIcon={<Add />}
          sx={{
            textTransform: 'none',
            fontWeight: 700,
            borderRadius: '10px',
            bgcolor: colors.primary,
            boxShadow: 'none',
            '&:hover': { bgcolor: colors.primaryDark, boxShadow: 'none' },
          }}
        >
          Создать филиал
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreateBranchDialog;
