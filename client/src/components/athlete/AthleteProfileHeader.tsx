import React from 'react';
import {
  Avatar,
  Box,
  Button,
  Chip,
  IconButton,
  Link,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  CameraAlt,
  EmailOutlined,
  PersonOutline,
  PhoneOutlined,
} from '@mui/icons-material';
import { colors, radii, typography } from '../../theme/tokens';
import {
  ATHLETE_STATUS_LABELS,
  AthleteCardData,
  AthleteCardMode,
  GENDER_LABELS,
} from './athleteCardTypes';
import { calcAge, deriveSecondaryMeta, formatDateRu, fullName } from './athleteCardUtils';

interface Props {
  data: AthleteCardData;
  mode: AthleteCardMode;
  editing: boolean;
  draft: Partial<AthleteCardData>;
  onDraftChange: (patch: Partial<AthleteCardData>) => void;
  onPhotoChange?: (base64: string) => void;
}

const AthleteProfileHeader: React.FC<Props> = ({
  data,
  mode,
  editing,
  draft,
  onDraftChange,
  onPhotoChange,
}) => {
  const meta = deriveSecondaryMeta(data);
  const name = fullName(editing ? { ...data, ...draft } : data);
  const dob = editing ? draft.dateOfBirth ?? data.dateOfBirth : data.dateOfBirth;
  const age = calcAge(dob);
  const phone = editing ? draft.phone ?? data.phone : data.phone;
  const email = editing ? draft.email ?? data.email : data.email;
  const gender = editing ? draft.gender ?? data.gender : data.gender;
  const weight = editing ? draft.weight ?? data.weight : data.weight;
  const status = (editing ? draft.athleteStatus ?? data.athleteStatus : data.athleteStatus) || 'active';
  const photo = editing ? draft.photo ?? data.photo : data.photo;
  const fileRef = React.useRef<HTMLInputElement>(null);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onPhotoChange) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') onPhotoChange(reader.result);
    };
    reader.readAsDataURL(file);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        gap: 2.5,
        alignItems: { xs: 'center', sm: 'flex-start' },
        p: 2,
        bgcolor: colors.card,
        borderRadius: radii.card,
        border: `1px solid ${colors.divider}`,
      }}
    >
      <Box sx={{ position: 'relative' }}>
        <Avatar
          src={photo || undefined}
          sx={{
            width: { xs: 112, md: 140 },
            height: { xs: 112, md: 140 },
            bgcolor: colors.primarySoft,
            fontSize: 40,
          }}
        >
          {!photo && <PersonOutline sx={{ fontSize: 56, color: colors.primary }} />}
        </Avatar>
        {mode === 'staff' && editing && (
          <>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
            <IconButton
              size="small"
              onClick={() => fileRef.current?.click()}
              sx={{
                position: 'absolute',
                right: -4,
                bottom: -4,
                bgcolor: colors.primary,
                color: '#fff',
                '&:hover': { bgcolor: colors.primaryDark },
              }}
            >
              <CameraAlt fontSize="small" />
            </IconButton>
          </>
        )}
        {!photo && (
          <Typography sx={{ mt: 0.75, fontSize: typography.hint, color: colors.textEmpty, textAlign: 'center' }}>
            Нет фотографии
          </Typography>
        )}
      </Box>

      <Box sx={{ flex: 1, width: '100%', minWidth: 0 }}>
        {editing && mode === 'staff' ? (
          <Stack spacing={1.5}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField
                size="small"
                label="Фамилия"
                value={draft.lastName ?? data.lastName ?? ''}
                onChange={(e) => onDraftChange({ lastName: e.target.value })}
                fullWidth
              />
              <TextField
                size="small"
                label="Имя"
                value={draft.firstName ?? data.firstName ?? ''}
                onChange={(e) => onDraftChange({ firstName: e.target.value })}
                fullWidth
              />
              <TextField
                size="small"
                label="Отчество"
                value={draft.middleName ?? data.middleName ?? ''}
                onChange={(e) => onDraftChange({ middleName: e.target.value })}
                fullWidth
              />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField
                size="small"
                label="Дата рождения"
                type="date"
                InputLabelProps={{ shrink: true }}
                value={(draft.dateOfBirth ?? data.dateOfBirth ?? '').toString().slice(0, 10)}
                onChange={(e) => onDraftChange({ dateOfBirth: e.target.value })}
                fullWidth
              />
              <TextField
                size="small"
                select
                label="Пол"
                value={draft.gender ?? data.gender ?? ''}
                onChange={(e) => onDraftChange({ gender: e.target.value })}
                fullWidth
              >
                <MenuItem value="male">Мужской</MenuItem>
                <MenuItem value="female">Женский</MenuItem>
                <MenuItem value="other">Другой</MenuItem>
              </TextField>
              <TextField
                size="small"
                label="Вес (кг)"
                type="number"
                value={draft.weight ?? data.weight ?? ''}
                onChange={(e) =>
                  onDraftChange({ weight: e.target.value === '' ? undefined : Number(e.target.value) })
                }
                fullWidth
              />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField
                size="small"
                label="Телефон"
                value={draft.phone ?? data.phone ?? ''}
                onChange={(e) => onDraftChange({ phone: e.target.value })}
                fullWidth
              />
              <TextField
                size="small"
                label="Email"
                value={draft.email ?? data.email ?? ''}
                onChange={(e) => onDraftChange({ email: e.target.value })}
                fullWidth
              />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField
                size="small"
                label="Дисциплина"
                value={draft.discipline ?? data.discipline ?? ''}
                onChange={(e) => onDraftChange({ discipline: e.target.value })}
                fullWidth
              />
              <TextField
                size="small"
                label="Весовая категория"
                value={draft.weightCategory ?? data.weightCategory ?? ''}
                onChange={(e) => onDraftChange({ weightCategory: e.target.value })}
                fullWidth
              />
              <TextField
                size="small"
                select
                label="Статус"
                value={draft.athleteStatus ?? data.athleteStatus ?? 'active'}
                onChange={(e) => onDraftChange({ athleteStatus: e.target.value })}
                fullWidth
              >
                {Object.entries(ATHLETE_STATUS_LABELS).map(([k, v]) => (
                  <MenuItem key={k} value={k}>
                    {v}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
          </Stack>
        ) : (
          <>
            <Typography
              sx={{
                fontSize: { xs: 22, md: 28 },
                fontWeight: 800,
                color: colors.text,
                lineHeight: 1.15,
                mb: 1,
              }}
            >
              {name || 'Без имени'}
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 1.5 }}>
              <Chip
                size="small"
                label={ATHLETE_STATUS_LABELS[status] || status}
                sx={{ bgcolor: colors.primarySoft, fontWeight: 600 }}
              />
              {data.discipline && <Chip size="small" variant="outlined" label={data.discipline} />}
              {data.weightCategory && (
                <Chip size="small" variant="outlined" label={`Категория: ${data.weightCategory}`} />
              )}
            </Stack>
            <Stack spacing={0.75}>
              <Typography sx={{ fontSize: typography.label, color: colors.textMuted }}>
                Дата рождения: {formatDateRu(dob)}
                {age != null ? ` (${age} лет)` : ''}
              </Typography>
              <Typography sx={{ fontSize: typography.label, color: colors.textMuted }}>
                Пол: {GENDER_LABELS[gender || ''] || gender || '—'} · Вес:{' '}
                {weight != null ? `${weight} кг` : '—'}
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={2}>
                {phone ? (
                  <Link
                    href={`tel:${phone}`}
                    underline="hover"
                    sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: typography.label }}
                  >
                    <PhoneOutlined sx={{ fontSize: 16 }} /> {phone}
                  </Link>
                ) : (
                  <Typography sx={{ fontSize: typography.hint, color: colors.textHint }}>Телефон не указан</Typography>
                )}
                {email ? (
                  <Link
                    href={`mailto:${email}`}
                    underline="hover"
                    sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: typography.label }}
                  >
                    <EmailOutlined sx={{ fontSize: 16 }} /> {email}
                  </Link>
                ) : (
                  <Typography sx={{ fontSize: typography.hint, color: colors.textHint }}>Email не указан</Typography>
                )}
              </Stack>
            </Stack>
          </>
        )}

        <Box
          sx={{
            mt: 2,
            pt: 1.5,
            borderTop: `1px solid ${colors.divider}`,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' },
            gap: 1,
          }}
        >
          <MetaItem label="Тренер" value={meta.trainerLabel} />
          <MetaItem label="Группа" value={meta.groupLabel} />
          <MetaItem label="Филиал" value={meta.branchLabel} />
        </Box>
      </Box>
    </Box>
  );
};

const MetaItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <Box>
    <Typography sx={{ fontSize: typography.hint, color: colors.textHint }}>{label}</Typography>
    <Typography sx={{ fontSize: typography.label, color: colors.textMuted, fontWeight: 600 }}>{value}</Typography>
  </Box>
);

export default AthleteProfileHeader;
