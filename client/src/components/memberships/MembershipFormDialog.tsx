import React, { useMemo } from 'react';
import {
  CalendarMonthOutlined,
  Close,
  ConfirmationNumberOutlined,
  InfoOutlined,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  FormControl,
  FormControlLabel,
  IconButton,
  InputAdornment,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Select,
  Switch,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Membership } from '../../types';
import { colors, radii } from '../../theme/tokens';

export type MembershipFormState = {
  name: string;
  description: string;
  price: string;
  category: '' | 'CLIENT' | 'GROUP' | 'PERSONAL';
  type: 'visits' | 'monthly';
  visits: string;
  validityDays: string;
  periodMonths: string;
  paymentWindowStartDay: string;
  paymentWindowEndDay: string;
  recalcMode: 'PAY_ATTENDED' | 'MISS_THRESHOLD';
  missThresholdPercent: string;
  groupIds: string[];
  isActive: boolean;
};

const DESC_MAX = 500;

const PAYMENT_WINDOWS = [
  { start: '1', end: '6', label: '1–6 число текущего месяца' },
  { start: '1', end: '10', label: '1–10 число текущего месяца' },
  { start: '10', end: '12', label: '10–12 число текущего месяца' },
  { start: '10', end: '15', label: '10–15 число текущего месяца' },
  { start: '15', end: '20', label: '15–20 число текущего месяца' },
  { start: '20', end: '25', label: '20–25 число текущего месяца' },
  { start: '25', end: '28', label: '25–28 число текущего месяца' },
];

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '12px',
    bgcolor: '#fff',
    fontSize: 14,
    '& fieldset': { borderColor: '#E3E6EE' },
    '&:hover fieldset': { borderColor: '#C8CEDA' },
    '&.Mui-focused fieldset': { borderColor: colors.primary, borderWidth: 1.5 },
  },
  '& .MuiInputLabel-root': { display: 'none' },
};

const labelSx = {
  fontSize: 13,
  fontWeight: 700,
  color: '#1B2438',
  mb: 0.75,
  display: 'block',
};

type Props = {
  open: boolean;
  editing: Membership | null;
  form: MembershipFormState;
  setForm: React.Dispatch<React.SetStateAction<MembershipFormState>>;
  groups: Array<{ id: string; name: string }>;
  error: string;
  onClearError: () => void;
  saving: boolean;
  deleting: boolean;
  onClose: () => void;
  onSave: () => void;
  onDelete: () => void;
};

const MembershipFormDialog: React.FC<Props> = ({
  open,
  editing,
  form,
  setForm,
  groups,
  error,
  onClearError,
  saving,
  deleting,
  onClose,
  onSave,
  onDelete,
}) => {
  const theme = useTheme();
  const isNarrow = useMediaQuery(theme.breakpoints.down('sm'));
  const locked = !form.category;

  const paymentKey = `${form.paymentWindowStartDay}-${form.paymentWindowEndDay}`;
  const paymentLabel = useMemo(() => {
    const found = PAYMENT_WINDOWS.find(
      (w) => w.start === form.paymentWindowStartDay && w.end === form.paymentWindowEndDay
    );
    if (found) return found.label;
    return `${form.paymentWindowStartDay}–${form.paymentWindowEndDay} число текущего месяца`;
  }, [form.paymentWindowStartDay, form.paymentWindowEndDay]);

  const showClientFields = form.category === 'CLIENT' || form.category === 'PERSONAL';
  const showGroupFields = form.category === 'GROUP';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      fullScreen={isNarrow}
      scroll="body"
      BackdropProps={{
        sx: {
          bgcolor: 'rgba(27, 36, 56, 0.48)',
          backdropFilter: 'blur(3px)',
        },
      }}
      PaperProps={{
        sx: {
          borderRadius: { xs: 0, sm: '20px' },
          overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(27, 36, 56, 0.24)',
          maxWidth: 640,
          m: { xs: 0, sm: 2 },
          maxHeight: { xs: '100%', sm: '92vh' },
        },
      }}
    >
      <Box sx={{ position: 'relative', px: { xs: 2.25, sm: 3 }, pt: { xs: 2.25, sm: 2.75 }, pb: 1 }}>
        <IconButton
          aria-label="Закрыть"
          onClick={onClose}
          sx={{
            position: 'absolute',
            top: 14,
            right: 14,
            width: 36,
            height: 36,
            bgcolor: '#F1F3F7',
            color: colors.textMuted,
            '&:hover': { bgcolor: '#E6E8EF' },
          }}
        >
          <Close sx={{ fontSize: 18 }} />
        </IconButton>

        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, pr: 5 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: '14px',
              bgcolor: '#EAF0FF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <ConfirmationNumberOutlined sx={{ color: colors.primary, fontSize: 26 }} />
          </Box>
          <Box>
            <Typography
              sx={{
                fontSize: { xs: 20, sm: 22 },
                fontWeight: 800,
                color: '#1B2438',
                letterSpacing: '-0.02em',
                lineHeight: 1.2,
              }}
            >
              {editing ? 'Редактировать абонемент' : 'Новый абонемент'}
            </Typography>
            <Typography sx={{ mt: 0.5, fontSize: 13, color: colors.textMuted, lineHeight: 1.4 }}>
              {editing
                ? 'Редактирование параметров тарифа для клиентов.'
                : 'Задайте параметры тарифа для назначения клиентам.'}
            </Typography>
          </Box>
        </Box>
      </Box>

      <Box
        sx={{
          px: { xs: 2.25, sm: 3 },
          pb: 2.5,
          overflowY: 'auto',
          maxHeight: { xs: 'calc(100vh - 140px)', sm: 'calc(92vh - 120px)' },
        }}
      >
        {error && (
          <Alert severity="error" sx={{ mb: 1.5, borderRadius: '12px' }} onClose={onClearError}>
            {error}
          </Alert>
        )}
        {editing?.archivedAt && (
          <Alert severity="warning" sx={{ mb: 1.5, borderRadius: '12px' }}>
            Абонемент в архиве. Восстановите его в таблице, чтобы снова назначать клиентам.
          </Alert>
        )}

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            gap: 1.5,
            mb: 1.5,
          }}
        >
          <Box>
            <Typography component="label" sx={labelSx}>
              Категория <Box component="span" sx={{ color: colors.danger }}>*</Box>
            </Typography>
            <FormControl fullWidth size="small">
              <Select
                value={form.category}
                displayEmpty
                onChange={(e) =>
                  setForm({
                    ...form,
                    category: e.target.value as MembershipFormState['category'],
                  })
                }
                sx={{
                  borderRadius: '12px',
                  fontSize: 14,
                  fontWeight: 600,
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#E3E6EE' },
                }}
                renderValue={(selected) => {
                  if (!selected) return <em style={{ opacity: 0.55, fontWeight: 500 }}>Выберите категорию</em>;
                  if (selected === 'CLIENT') return 'Клиентский (на человека)';
                  if (selected === 'PERSONAL') return 'Персональный';
                  return 'Групповой (ежемесячная оплата группы)';
                }}
              >
                <MenuItem value="CLIENT">Клиентский (на человека)</MenuItem>
                <MenuItem value="PERSONAL">Персональный</MenuItem>
                <MenuItem value="GROUP">Групповой (ежемесячная оплата группы)</MenuItem>
              </Select>
            </FormControl>
          </Box>

          <Box>
            <Typography component="label" sx={labelSx}>
              Название <Box component="span" sx={{ color: colors.danger }}>*</Box>
            </Typography>
            <TextField
              fullWidth
              size="small"
              placeholder="Например: Абонемент на 10 занятий"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              disabled={locked}
              sx={fieldSx}
            />
          </Box>
        </Box>

        <Box sx={{ mb: 1.5, maxWidth: { sm: '50%' } }}>
          <Typography component="label" sx={labelSx}>
            Цена <Box component="span" sx={{ color: colors.danger }}>*</Box>
          </Typography>
          <TextField
            fullWidth
            size="small"
            type="number"
            placeholder="0"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            disabled={locked}
            InputProps={{
              endAdornment: <InputAdornment position="end">₽</InputAdornment>,
            }}
            sx={fieldSx}
          />
        </Box>

        <Box sx={{ mb: 1.5 }}>
          <Typography component="label" sx={labelSx}>
            Описание
          </Typography>
          <Box sx={{ position: 'relative' }}>
            <TextField
              fullWidth
              multiline
              minRows={3}
              maxRows={6}
              placeholder="Добавьте описание абонемента, условия, ограничения... Например: доступ к групповым тренировкам, заморозка, перенос занятий и т.д."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value.slice(0, DESC_MAX) })}
              disabled={locked}
              sx={{
                ...fieldSx,
                '& .MuiOutlinedInput-root': {
                  ...fieldSx['& .MuiOutlinedInput-root'],
                  pb: 3,
                },
              }}
            />
            <Typography
              sx={{
                position: 'absolute',
                right: 12,
                bottom: 8,
                fontSize: 11,
                color: colors.textHint,
                pointerEvents: 'none',
              }}
            >
              {form.description.length}/{DESC_MAX}
            </Typography>
          </Box>
        </Box>

        {showClientFields && (
          <>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 1.5,
                mb: 1.5,
              }}
            >
              <Box>
                <Typography component="label" sx={labelSx}>
                  Кол-во занятий
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  value={form.visits}
                  onChange={(e) => setForm({ ...form, visits: e.target.value })}
                  sx={fieldSx}
                />
                <Typography sx={{ mt: 0.6, fontSize: 12, color: colors.textHint }}>
                  Можно оставить пустым для безлимитного тарифа.
                </Typography>
              </Box>
              <Box>
                <Typography component="label" sx={labelSx}>
                  Срок действия, дней
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  value={form.validityDays}
                  onChange={(e) => setForm({ ...form, validityDays: e.target.value })}
                  sx={fieldSx}
                />
                <Typography sx={{ mt: 0.6, fontSize: 12, color: colors.textHint }}>
                  Например: 12 занятий или 45 дней.
                </Typography>
              </Box>
            </Box>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 1.5,
                mb: 1.5,
              }}
            >
              <Box>
                <Typography component="label" sx={labelSx}>
                  Календарных месяцев
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  value={form.periodMonths}
                  onChange={(e) => setForm({ ...form, periodMonths: e.target.value })}
                  sx={fieldSx}
                />
                <Typography sx={{ mt: 0.6, fontSize: 12, color: colors.textHint }}>
                  Используется для длительных абонементов.
                </Typography>
              </Box>
              <Box>
                <Typography component="label" sx={labelSx}>
                  Окно оплаты
                </Typography>
                <FormControl fullWidth size="small">
                  <Select
                    value={paymentKey}
                    onChange={(e) => {
                      const [start, end] = String(e.target.value).split('-');
                      setForm({
                        ...form,
                        paymentWindowStartDay: start,
                        paymentWindowEndDay: end,
                      });
                    }}
                    displayEmpty
                    startAdornment={
                      <InputAdornment position="start">
                        <CalendarMonthOutlined sx={{ fontSize: 18, color: colors.textHint, ml: 0.5 }} />
                      </InputAdornment>
                    }
                    renderValue={() => paymentLabel}
                    sx={{
                      borderRadius: '12px',
                      fontSize: 14,
                      fontWeight: 600,
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: '#E3E6EE' },
                    }}
                  >
                    {PAYMENT_WINDOWS.map((w) => (
                      <MenuItem key={`${w.start}-${w.end}`} value={`${w.start}-${w.end}`}>
                        {w.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            </Box>
          </>
        )}

        {showGroupFields && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 1.5 }}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 1.5,
              }}
            >
              <Box>
                <Typography component="label" sx={labelSx}>
                  Окно оплаты
                </Typography>
                <FormControl fullWidth size="small">
                  <Select
                    value={paymentKey}
                    onChange={(e) => {
                      const [start, end] = String(e.target.value).split('-');
                      setForm({
                        ...form,
                        paymentWindowStartDay: start,
                        paymentWindowEndDay: end,
                      });
                    }}
                    displayEmpty
                    startAdornment={
                      <InputAdornment position="start">
                        <CalendarMonthOutlined sx={{ fontSize: 18, color: colors.textHint, ml: 0.5 }} />
                      </InputAdornment>
                    }
                    renderValue={() => paymentLabel}
                    sx={{
                      borderRadius: '12px',
                      fontSize: 14,
                      fontWeight: 600,
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: '#E3E6EE' },
                    }}
                  >
                    {PAYMENT_WINDOWS.map((w) => (
                      <MenuItem key={`${w.start}-${w.end}`} value={`${w.start}-${w.end}`}>
                        {w.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Typography sx={{ mt: 0.6, fontSize: 12, color: colors.textHint }}>
                  После окна ученикам уходит уведомление о неоплате.
                </Typography>
              </Box>
              <Box>
                <Typography component="label" sx={labelSx}>
                  Перерасчёт пропусков
                </Typography>
                <FormControl fullWidth size="small">
                  <Select
                    value={form.recalcMode}
                    onChange={(e) =>
                      setForm({ ...form, recalcMode: e.target.value as MembershipFormState['recalcMode'] })
                    }
                    sx={{
                      borderRadius: '12px',
                      fontSize: 14,
                      fontWeight: 600,
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: '#E3E6EE' },
                    }}
                  >
                    <MenuItem value="PAY_ATTENDED">Платят только за посещённые</MenuItem>
                    <MenuItem value="MISS_THRESHOLD">Перерасчёт при пропуске N% занятий</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            </Box>

            {form.recalcMode === 'MISS_THRESHOLD' && (
              <Box sx={{ maxWidth: { sm: '50%' } }}>
                <Typography component="label" sx={labelSx}>
                  Порог пропуска %
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  value={form.missThresholdPercent}
                  onChange={(e) => setForm({ ...form, missThresholdPercent: e.target.value })}
                  sx={fieldSx}
                />
              </Box>
            )}

            <Box>
              <Typography component="label" sx={labelSx}>
                Группы
              </Typography>
              <FormControl fullWidth size="small">
                <Select
                  multiple
                  value={form.groupIds}
                  onChange={(e) => setForm({ ...form, groupIds: e.target.value as string[] })}
                  input={<OutlinedInput />}
                  renderValue={(selected) =>
                    groups
                      .filter((g) => selected.includes(g.id))
                      .map((g) => g.name)
                      .join(', ') || 'Выберите группы'
                  }
                  sx={{
                    borderRadius: '12px',
                    fontSize: 14,
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#E3E6EE' },
                  }}
                >
                  {groups.map((g) => (
                    <MenuItem key={g.id} value={g.id}>
                      <Checkbox checked={form.groupIds.includes(g.id)} />
                      <ListItemText primary={g.name} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </Box>
        )}

        <FormControlLabel
          sx={{
            mx: 0,
            mb: 1.75,
            alignItems: 'center',
            gap: 1,
            opacity: locked ? 0.5 : 1,
          }}
          control={
            <Switch
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              disabled={locked}
              sx={{
                '& .MuiSwitch-switchBase.Mui-checked': { color: colors.primary },
                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: colors.primary },
              }}
            />
          }
          label={
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
              <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#1B2438' }}>Активен</Typography>
              <Typography sx={{ fontSize: 12, color: colors.textHint }}>
                Активные абонементы доступны для назначения клиентам.
              </Typography>
            </Box>
          }
        />

        {editing && (
          <Box
            sx={{
              position: 'relative',
              overflow: 'hidden',
              borderRadius: '14px',
              bgcolor: '#EAF0FF',
              px: 2,
              py: 1.5,
              mb: 2,
              display: 'flex',
              gap: 1.25,
              alignItems: 'flex-start',
            }}
          >
            <InfoOutlined sx={{ color: colors.primary, fontSize: 20, mt: 0.15, flexShrink: 0 }} />
            <Typography sx={{ fontSize: 13, color: '#1B2438', lineHeight: 1.45, pr: 4 }}>
              <Box component="span" sx={{ fontWeight: 800 }}>
                Изменения будут применены ко всем новым назначениям абонемента.
              </Box>{' '}
              Текущие активные абонементы у клиентов сохранят свои условия и не будут изменены.
            </Typography>
            <ConfirmationNumberOutlined
              sx={{
                position: 'absolute',
                right: -8,
                bottom: -10,
                fontSize: 72,
                color: colors.primary,
                opacity: 0.12,
                transform: 'rotate(-18deg)',
                pointerEvents: 'none',
              }}
            />
          </Box>
        )}

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: editing ? 'space-between' : 'flex-end',
            gap: 1,
            flexWrap: 'wrap',
            pt: 0.5,
          }}
        >
          {editing ? (
            <Button
              onClick={onDelete}
              disabled={saving || deleting}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                color: colors.danger,
                px: 0.5,
                '&:hover': { bgcolor: 'rgba(249,60,101,0.06)' },
              }}
            >
              Удалить
            </Button>
          ) : (
            <Box />
          )}
          <Box sx={{ display: 'flex', gap: 1, ml: 'auto' }}>
            <Button
              onClick={onClose}
              disabled={saving || deleting}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                color: colors.primary,
                px: 1.5,
              }}
            >
              Отмена
            </Button>
            <Button
              variant="contained"
              onClick={onSave}
              disabled={saving || deleting || locked}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                borderRadius: `${radii.button}px`,
                bgcolor: colors.primary,
                boxShadow: 'none',
                px: 2.25,
                '&:hover': { bgcolor: colors.primaryDark, boxShadow: 'none' },
              }}
            >
              {editing ? 'Сохранить изменения' : 'Создать абонемент'}
            </Button>
          </Box>
        </Box>
      </Box>
    </Dialog>
  );
};

export default MembershipFormDialog;
