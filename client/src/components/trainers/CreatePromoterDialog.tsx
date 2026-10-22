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
  CalendarMonthOutlined,
  CampaignOutlined,
  Close,
  DirectionsCarOutlined,
  EmailOutlined,
  GpsFixedOutlined,
  LinkOutlined,
  LockOutlined,
  NotesOutlined,
  PersonAddAlt1,
  PersonOutline,
  PhoneOutlined,
  PhotoCameraOutlined,
  PlaceOutlined,
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
import { buildPromoterProfileMeta } from '../../utils/staffProfileMeta';

const NOTES_MAX = 500;

const TRANSPORT_OPTIONS = [
  'Пешком',
  'Общественный транспорт',
  'Личный автомобиль',
  'Велосипед / самокат',
  'Такси / каршеринг',
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
  workArea: string;
  workRadiusKm: string;
  photoPreview: string;
  pricePerShift: string;
  pricePerClient: string;
  transport: string;
  socialLink: string;
  notes: string;
};

const emptyForm = (): FormState => ({
  firstName: '',
  lastName: '',
  middleName: '',
  email: '',
  password: '',
  phone: '',
  dateOfBirth: '',
  workArea: '',
  workRadiusKm: '',
  photoPreview: '',
  pricePerShift: '0',
  pricePerClient: '0',
  transport: '',
  socialLink: '',
  notes: '',
});

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
  branches?: BranchLite[];
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

function SectionHead({ icon, title }: { icon: React.ReactNode; title: string }) {
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

const CreatePromoterDialog: React.FC<Props> = ({
  open,
  onClose,
  onSuccess,
  branches = [],
  onError,
}) => {
  const [form, setForm] = useState<FormState>(() => emptyForm());
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setForm(emptyForm());
    setLocalError(null);
    setSaving(false);
  }, [open]);

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

  const workAreaOptions =
    branches.length > 0
      ? branches.map((b) => b.name)
      : ['Центр', 'Север', 'Юг', 'Восток', 'Запад'];

  const canSubmit =
    form.lastName.trim() &&
    form.firstName.trim() &&
    form.email.trim() &&
    form.password.length >= 6 &&
    form.phone.trim() &&
    form.pricePerShift.trim() !== '' &&
    form.pricePerClient.trim() !== '' &&
    !saving;

  const handleSubmit = async () => {
    if (!canSubmit) {
      setLocalError('Заполните обязательные поля (пароль от 6 символов)');
      return;
    }
    setSaving(true);
    setLocalError(null);
    try {
      const profileMeta = buildPromoterProfileMeta({
        dateOfBirth: form.dateOfBirth || undefined,
        workArea: form.workArea || undefined,
        workRadiusKm: form.workRadiusKm || undefined,
        pricePerShift: form.pricePerShift,
        pricePerClient: form.pricePerClient,
        transport: form.transport || undefined,
        socialLink: form.socialLink.trim() || undefined,
        notes: form.notes.trim() || undefined,
      });
      await apiService.createUser({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        middleName: form.middleName.trim() || undefined,
        email: form.email.trim(),
        password: form.password,
        phone: form.phone.trim(),
        role: 'PROMOTER',
        isActive: true,
        profileMeta,
        dateOfBirth: form.dateOfBirth || undefined,
        workArea: form.workArea || undefined,
        workRadiusKm: form.workRadiusKm ? Number(form.workRadiusKm) : undefined,
        pricePerShift: Number(form.pricePerShift) || 0,
        pricePerClient: Number(form.pricePerClient) || 0,
        transport: form.transport || undefined,
        socialLink: form.socialLink.trim() || undefined,
        notes: form.notes.trim() || undefined,
      });
      await onSuccess();
      onClose();
    } catch (e: any) {
      const msg = e?.response?.data?.error || 'Ошибка создания промоутера';
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
            <CampaignOutlined />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: 20, color: '#1B2438', letterSpacing: '-0.02em' }}>
              Добавить нового промоутера
            </Typography>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#8B93A7', mt: 0.35, maxWidth: 560 }}>
              Создайте учетную запись промоутера. Он сможет работать с лидами, выполнять задания и
              получать вознаграждение.
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
              <Box>
                <FieldLabel>Город / район работы</FieldLabel>
                <FormControl fullWidth size="small">
                  <Select
                    value={form.workArea}
                    displayEmpty
                    onChange={(e) => set('workArea', e.target.value)}
                    sx={{ borderRadius: '10px', fontWeight: 650 }}
                    startAdornment={
                      <InputAdornment position="start">
                        <PlaceOutlined sx={{ fontSize: 18, color: colors.primary }} />
                      </InputAdornment>
                    }
                    renderValue={(v) => {
                      if (!v) return <span style={{ color: '#8B93A7' }}>Выберите район</span>;
                      return v;
                    }}
                  >
                    {workAreaOptions.map((name) => (
                      <MenuItem key={name} value={name}>
                        {name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
              <Box>
                <FieldLabel>Радиус работы (км)</FieldLabel>
                <TextField
                  size="small"
                  fullWidth
                  type="number"
                  placeholder="Например: 10"
                  value={form.workRadiusKm}
                  onChange={(e) => set('workRadiusKm', e.target.value)}
                  sx={fieldSx}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <GpsFixedOutlined sx={{ fontSize: 18, color: colors.primary }} />
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>
            </Box>
          </Box>
        </Box>

        <SectionHead icon={<PaymentsOutlined sx={{ fontSize: 18 }} />} title="Условия работы и тарифы" />
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            gap: 1.5,
            mb: 2.5,
          }}
        >
          <Box>
            <FieldLabel required>Цена за выход (₽)</FieldLabel>
            <TextField
              size="small"
              fullWidth
              type="number"
              value={form.pricePerShift}
              onChange={(e) => set('pricePerShift', e.target.value)}
              helperText="Вознаграждение за один выезд / отработанный день"
              FormHelperTextProps={{ sx: { mx: 0, fontWeight: 600, color: '#8B93A7' } }}
              sx={fieldSx}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Typography sx={{ fontWeight: 800, color: colors.primary }}>₽</Typography>
                  </InputAdornment>
                ),
              }}
            />
          </Box>
          <Box>
            <FieldLabel required>Цена за привлечённого клиента (₽)</FieldLabel>
            <TextField
              size="small"
              fullWidth
              type="number"
              value={form.pricePerClient}
              onChange={(e) => set('pricePerClient', e.target.value)}
              helperText="Вознаграждение за клиента, который пришёл и оплатил абонемент"
              FormHelperTextProps={{ sx: { mx: 0, fontWeight: 600, color: '#8B93A7' } }}
              sx={fieldSx}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Typography sx={{ fontWeight: 800, color: colors.primary }}>₽</Typography>
                  </InputAdornment>
                ),
              }}
            />
          </Box>
        </Box>

        <SectionHead icon={<NotesOutlined sx={{ fontSize: 18 }} />} title="Дополнительная информация" />
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            gap: 1.25,
            mb: 1.25,
          }}
        >
          <Box>
            <FieldLabel>Способ передвижения</FieldLabel>
            <FormControl fullWidth size="small">
              <Select
                value={form.transport}
                displayEmpty
                onChange={(e) => set('transport', e.target.value)}
                sx={{ borderRadius: '10px', fontWeight: 650 }}
                startAdornment={
                  <InputAdornment position="start">
                    <DirectionsCarOutlined sx={{ fontSize: 18, color: colors.primary }} />
                  </InputAdornment>
                }
                renderValue={(v) => {
                  if (!v) return <span style={{ color: '#8B93A7' }}>Выберите вариант</span>;
                  return v;
                }}
              >
                {TRANSPORT_OPTIONS.map((t) => (
                  <MenuItem key={t} value={t}>
                    {t}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
          <Box>
            <FieldLabel>Ссылка на соцсети (при наличии)</FieldLabel>
            <TextField
              size="small"
              fullWidth
              placeholder="https://"
              value={form.socialLink}
              onChange={(e) => set('socialLink', e.target.value)}
              sx={fieldSx}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LinkOutlined sx={{ fontSize: 18, color: colors.primary }} />
                  </InputAdornment>
                ),
              }}
            />
          </Box>
        </Box>

        <Box sx={{ mb: 1.5 }}>
          <FieldLabel>Дополнительная информация</FieldLabel>
          <TextField
            fullWidth
            multiline
            minRows={3}
            placeholder="Кратко о себе, опыт работы, районы, в которых работаете и т.д."
            value={form.notes}
            onChange={(e) => set('notes', e.target.value.slice(0, NOTES_MAX))}
            sx={fieldSx}
          />
          <Typography sx={{ textAlign: 'right', fontSize: 11.5, fontWeight: 650, color: '#8B93A7', mt: 0.5 }}>
            {form.notes.length} / {NOTES_MAX}
          </Typography>
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
          Создать промоутера
        </Button>
      </Box>
    </Dialog>
  );
};

export default CreatePromoterDialog;
