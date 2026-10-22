import React from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import {
  CalendarMonthOutlined,
  CalendarToday,
  Close,
  GroupsOutlined,
  PersonAddAlt1,
} from '@mui/icons-material';
import { colors, radii } from '../../theme/tokens';
import { GROUP_SALARY_SCHEME_OPTIONS, salaryRateFieldLabel, salarySchemeHint } from '../../utils/salarySchemes';
import { Branch, Client, Trainer } from '../../types';
import PlanLimitAlert from '../common/PlanLimitAlert';

export const AGE_CATEGORY_PRESETS = [
  { label: '4–6 лет (Подготовительная)', ageMin: 4, ageMax: 6, skill: 'Подготовительная' },
  { label: '6–8 лет (Начальная подготовка)', ageMin: 6, ageMax: 8, skill: 'Начальная подготовка' },
  { label: '9–11 лет (Учебно-тренировочная)', ageMin: 9, ageMax: 11, skill: 'Учебно-тренировочная' },
  { label: '12–14 лет (Спортивное совершенствование)', ageMin: 12, ageMax: 14, skill: 'Спортивное совершенствование' },
  { label: '15+ лет (Взрослые)', ageMin: 15, ageMax: 99, skill: 'Взрослые' },
] as const;

export const SKILL_LEVELS = [
  'Начальная подготовка',
  'Подготовительная',
  'Учебно-тренировочная',
  'Спортивное совершенствование',
  'Высшее спортивное мастерство',
] as const;

export const GROUP_TYPES = [
  { value: 'permanent', label: 'Постоянная' },
  { value: 'temporary', label: 'Временная' },
  { value: 'trial', label: 'Пробная' },
] as const;

export const STREAM_OPTIONS = [
  { value: 'morning', label: 'Утренний' },
  { value: 'day', label: 'Дневной' },
  { value: 'evening', label: 'Вечерний' },
] as const;

export type GroupFormValue = {
  name: string;
  description: string;
  maxMembers: string;
  ageMin: string;
  ageMax: string;
  color: string;
  branchId: string;
  trainerId: string;
  schedule: unknown[];
  isMonthlyPayment: boolean;
  monthlyPaymentAmount: string;
  paymentDueDay: string;
  createPaymentsImmediately: boolean;
  salaryScheme: string;
  salaryRate: string;
  ageCategory: string;
  skillLevel: string;
  groupType: string;
  stream: string;
  isActive: boolean;
  onlineBooking: boolean;
};

type Props = {
  open: boolean;
  value: GroupFormValue;
  onChange: (key: string, val: unknown) => void;
  errors: Record<string, string>;
  error?: string | null;
  onClearError?: () => void;
  branches: Branch[];
  trainers: Trainer[];
  clients: Client[];
  selectedClientIds: string[];
  onSelectedClientIds: (ids: string[]) => void;
  canManageBranches?: boolean;
  onCreateBranch?: () => void;
  onCreateTrainer?: () => void;
  onClose: () => void;
  onCreate: () => void;
  onCreateAndTraining: () => void;
  isNarrow?: boolean;
};

const fieldSx = {
  '& .MuiOutlinedInput-root': { borderRadius: '10px', bgcolor: '#fff', fontWeight: 600 },
  '& .MuiInputLabel-root': { fontWeight: 700 },
};

const sectionTitle = (label: string) => (
  <Typography sx={{ fontWeight: 800, fontSize: 14, color: '#1B2438', mb: 1.25, mt: 1 }}>
    {label}
  </Typography>
);

const CreateGroupDialog: React.FC<Props> = ({
  open,
  value,
  onChange,
  errors,
  error,
  onClearError,
  branches,
  trainers,
  clients,
  selectedClientIds,
  onSelectedClientIds,
  canManageBranches,
  onCreateBranch,
  onCreateTrainer,
  onClose,
  onCreate,
  onCreateAndTraining,
  isNarrow,
}) => {
  const applyAgeCategory = (label: string) => {
    onChange('ageCategory', label);
    const preset = AGE_CATEGORY_PRESETS.find((p) => p.label === label);
    if (preset) {
      onChange('ageMin', String(preset.ageMin));
      onChange('ageMax', String(preset.ageMax === 99 ? 18 : preset.ageMax));
      onChange('skillLevel', preset.skill);
    }
  };

  const trainerLabel = (t: Trainer) =>
    t.user
      ? `${t.user.lastName} ${t.user.firstName} ${t.user.middleName || ''}`.trim()
      : `Тренер #${t.id}`;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      fullScreen={isNarrow}
      data-onboarding="group-form-dialog"
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
          <GroupsOutlined />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 18, color: '#1B2438' }}>
            Добавить новую группу
          </Typography>
          <Typography sx={{ fontSize: 13, color: '#8B93A7', fontWeight: 600, mt: 0.25 }}>
            Создайте группу, привяжите филиал и тренера, задайте параметры.
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ color: '#8B93A7' }}>
          <Close fontSize="small" />
        </IconButton>
      </Box>

      <DialogContent sx={{ px: 3, pt: 1 }}>
        {error && (
          <PlanLimitAlert sx={{ mb: 2 }} onClose={onClearError}>
            {error}
          </PlanLimitAlert>
        )}
        {Object.keys(errors).length > 0 && (
          <Alert severity="warning" sx={{ mb: 2, borderRadius: '10px' }}>
            Исправьте {Object.keys(errors).length}{' '}
            {Object.keys(errors).length === 1 ? 'ошибку' : 'ошибок'} в форме
          </Alert>
        )}

        {sectionTitle('Основная информация')}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 1.5 }}>
          <TextField
            required
            fullWidth
            label="Название группы"
            value={value.name}
            onChange={(e) => onChange('name', e.target.value)}
            error={!!errors.name}
            helperText={errors.name}
            sx={fieldSx}
          />
          <FormControl fullWidth required error={!!errors.ageCategory}>
            <InputLabel>Возрастная категория</InputLabel>
            <Select
              label="Возрастная категория"
              value={value.ageCategory}
              onChange={(e) => applyAgeCategory(e.target.value)}
              sx={{ borderRadius: '10px', fontWeight: 600 }}
            >
              {AGE_CATEGORY_PRESETS.map((p) => (
                <MenuItem key={p.label} value={p.label}>
                  {p.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
        <Box sx={{ mb: 1 }}>
          <TextField
            fullWidth
            multiline
            minRows={2}
            label="Описание"
            value={value.description}
            onChange={(e) => onChange('description', e.target.value.slice(0, 500))}
            error={!!errors.description}
            helperText={errors.description}
            sx={fieldSx}
          />
          <Typography sx={{ mt: 0.5, textAlign: 'right', fontSize: 12, fontWeight: 600, color: '#8B93A7' }}>
            {value.description.length} / 500
          </Typography>
        </Box>

        {sectionTitle('Привязка к филиалу и тренеру')}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <Box sx={{ flex: 1 }}>
            <FormControl fullWidth required error={!!errors.branchId}>
              <InputLabel>Филиал</InputLabel>
              <Select
                label="Филиал"
                value={value.branchId}
                onChange={(e) => onChange('branchId', e.target.value)}
                sx={{ borderRadius: '10px', fontWeight: 600 }}
              >
                {branches.map((b) => (
                  <MenuItem key={b.id} value={b.id}>
                    {b.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {canManageBranches && onCreateBranch && (
              <Button
                size="small"
                onClick={onCreateBranch}
                sx={{ mt: 0.75, textTransform: 'none', fontWeight: 700, color: colors.primary, px: 0 }}
              >
                + Создать филиал
              </Button>
            )}
          </Box>
          <Box sx={{ flex: 1 }}>
            <FormControl fullWidth required error={!!errors.trainerId}>
              <InputLabel>Тренер</InputLabel>
              <Select
                label="Тренер"
                value={value.trainerId}
                onChange={(e) => onChange('trainerId', e.target.value)}
                sx={{ borderRadius: '10px', fontWeight: 600 }}
              >
                {trainers.map((t) => (
                  <MenuItem key={t.id} value={t.id}>
                    {trainerLabel(t)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {onCreateTrainer && (
              <Button
                size="small"
                onClick={onCreateTrainer}
                sx={{ mt: 0.75, textTransform: 'none', fontWeight: 700, color: colors.primary, px: 0 }}
              >
                + Создать тренера
              </Button>
            )}
          </Box>
        </Stack>

        {sectionTitle('Параметры группы')}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 1.5 }}>
          <TextField
            required
            fullWidth
            label="Макс. участников"
            type="number"
            value={value.maxMembers}
            onChange={(e) => onChange('maxMembers', e.target.value)}
            error={!!errors.maxMembers}
            helperText={errors.maxMembers}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <GroupsOutlined sx={{ fontSize: 18, color: '#8B93A7' }} />
                </InputAdornment>
              ),
            }}
            sx={fieldSx}
          />
          <TextField
            required
            fullWidth
            label="Мин. возраст"
            type="number"
            value={value.ageMin}
            onChange={(e) => onChange('ageMin', e.target.value)}
            error={!!errors.ageMin}
            helperText={errors.ageMin}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <CalendarMonthOutlined sx={{ fontSize: 18, color: '#8B93A7' }} />
                </InputAdornment>
              ),
            }}
            sx={fieldSx}
          />
          <TextField
            required
            fullWidth
            label="Макс. возраст"
            type="number"
            value={value.ageMax}
            onChange={(e) => onChange('ageMax', e.target.value)}
            error={!!errors.ageMax}
            helperText={errors.ageMax}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <CalendarMonthOutlined sx={{ fontSize: 18, color: '#8B93A7' }} />
                </InputAdornment>
              ),
            }}
            sx={fieldSx}
          />
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 1.5 }}>
          <FormControl fullWidth>
            <InputLabel>Уровень подготовки</InputLabel>
            <Select
              label="Уровень подготовки"
              value={value.skillLevel}
              onChange={(e) => onChange('skillLevel', e.target.value)}
              sx={{ borderRadius: '10px', fontWeight: 600 }}
            >
              {SKILL_LEVELS.map((s) => (
                <MenuItem key={s} value={s}>
                  {s}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth>
            <InputLabel>Тип группы</InputLabel>
            <Select
              label="Тип группы"
              value={value.groupType}
              onChange={(e) => onChange('groupType', e.target.value)}
              sx={{ borderRadius: '10px', fontWeight: 600 }}
            >
              {GROUP_TYPES.map((t) => (
                <MenuItem key={t.value} value={t.value}>
                  {t.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth>
            <InputLabel>Поток</InputLabel>
            <Select
              label="Поток"
              value={value.stream}
              onChange={(e) => onChange('stream', e.target.value)}
              sx={{ borderRadius: '10px', fontWeight: 600 }}
            >
              {STREAM_OPTIONS.map((s) => (
                <MenuItem key={s.value} value={s.value}>
                  {s.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>

        {sectionTitle('Цвет группы')}
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 0.5 }}>
          <Box
            sx={{
              flex: 1,
              height: 36,
              borderRadius: '10px',
              bgcolor: value.color || colors.primary,
              border: '1px solid #EEF1F6',
            }}
          />
          <TextField
            type="color"
            value={value.color || colors.primary}
            onChange={(e) => onChange('color', e.target.value)}
            sx={{
              width: 56,
              ...fieldSx,
              '& input': { p: 0.5, height: 36, cursor: 'pointer' },
            }}
          />
        </Stack>
        <Typography sx={{ fontSize: 12, color: '#8B93A7', fontWeight: 600, mb: 1.5 }}>
          Цвет используется в календаре и расписании
        </Typography>

        {sectionTitle('Дополнительно')}
        <Stack spacing={0.5} sx={{ mb: 2 }}>
          <FormControlLabel
            control={
              <Switch
                checked={value.isActive !== false}
                onChange={(e) => onChange('isActive', e.target.checked)}
                color="primary"
              />
            }
            label={
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: 14 }}>Активна</Typography>
                <Typography sx={{ fontSize: 12, color: '#8B93A7', fontWeight: 600 }}>
                  Группа отображается в системе и расписании
                </Typography>
              </Box>
            }
            sx={{ alignItems: 'flex-start', ml: 0, gap: 1 }}
          />
          <FormControlLabel
            control={
              <Switch
                checked={Boolean(value.onlineBooking)}
                onChange={(e) => onChange('onlineBooking', e.target.checked)}
                color="primary"
              />
            }
            label={
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: 14 }}>Онлайн-запись</Typography>
                <Typography sx={{ fontSize: 12, color: '#8B93A7', fontWeight: 600 }}>
                  Разрешить запись клиентов через сайт / приложение
                </Typography>
              </Box>
            }
            sx={{ alignItems: 'flex-start', ml: 0, gap: 1 }}
          />
        </Stack>

        <Divider sx={{ my: 1.5 }} />
        <Typography sx={{ fontWeight: 800, fontSize: 13, color: '#8B93A7', mb: 1.25 }}>
          Зарплата тренера и участники
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 1.5 }}>
          <FormControl fullWidth>
            <InputLabel>Тип зарплаты</InputLabel>
            <Select
              label="Тип зарплаты"
              value={value.salaryScheme}
              onChange={(e) => onChange('salaryScheme', e.target.value)}
              sx={{ borderRadius: '10px', fontWeight: 600 }}
            >
              {GROUP_SALARY_SCHEME_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            fullWidth
            type="number"
            label={salaryRateFieldLabel(value.salaryScheme)}
            value={value.salaryRate}
            onChange={(e) => onChange('salaryRate', e.target.value)}
            helperText={salarySchemeHint(value.salaryScheme)}
            sx={fieldSx}
          />
        </Stack>
        <Autocomplete
          multiple
          options={clients}
          getOptionLabel={(option) =>
            [option.lastName, option.firstName, option.middleName].filter(Boolean).join(' ') ||
            `${option.firstName} ${option.lastName}`
          }
          value={clients.filter((c) => selectedClientIds.includes(c.id))}
          onChange={(_, newValue) => onSelectedClientIds(newValue.map((c) => c.id))}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Участники группы"
              placeholder="Начните вводить имя"
              sx={fieldSx}
            />
          )}
          renderTags={(tagValue, getTagProps) =>
            tagValue.map((option, index) => (
              <Chip
                {...getTagProps({ index })}
                key={option.id}
                size="small"
                label={[option.lastName, option.firstName].filter(Boolean).join(' ')}
                sx={{ fontWeight: 700 }}
              />
            ))
          }
        />
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, pt: 1, gap: 1, flexWrap: 'wrap' }}>
        <Button
          onClick={onClose}
          sx={{ textTransform: 'none', fontWeight: 700, color: '#8B93A7' }}
        >
          Отмена
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button
          onClick={onCreate}
          variant="outlined"
          startIcon={<PersonAddAlt1 />}
          sx={{
            textTransform: 'none',
            fontWeight: 700,
            borderRadius: '10px',
            borderColor: '#C9D7FF',
            color: colors.primary,
          }}
        >
          Создать группу
        </Button>
        <Button
          onClick={onCreateAndTraining}
          variant="contained"
          startIcon={<CalendarToday />}
          sx={{
            textTransform: 'none',
            fontWeight: 700,
            borderRadius: '10px',
            bgcolor: colors.primary,
            boxShadow: 'none',
            '&:hover': { bgcolor: colors.primaryDark, boxShadow: 'none' },
          }}
        >
          Создать группу и тренировку
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreateGroupDialog;
