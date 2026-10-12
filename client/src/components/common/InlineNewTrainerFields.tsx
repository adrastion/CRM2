import React from 'react';
import { Grid, TextField, Typography } from '@mui/material';
import PasswordField from './PasswordField';

export type InlineTrainerForm = {
  lastName: string;
  firstName: string;
  middleName: string;
  email: string;
  password: string;
  phone: string;
  qualification: string;
  experience: string;
  specialization: string;
};

export const EMPTY_INLINE_TRAINER: InlineTrainerForm = {
  lastName: '',
  firstName: '',
  middleName: '',
  email: '',
  password: '',
  phone: '',
  qualification: '',
  experience: '',
  specialization: '',
};

type Props = {
  value: InlineTrainerForm;
  onChange: (next: InlineTrainerForm) => void;
  errors?: Record<string, string>;
};

/** Поля инлайн-создания тренера (как в форме группы). ЗП по умолчанию — per_training_person на сабмите. */
export default function InlineNewTrainerFields({ value, onChange, errors = {} }: Props) {
  const set = (field: keyof InlineTrainerForm, v: string) => {
    onChange({ ...value, [field]: v });
  };

  return (
    <Grid container spacing={2} sx={{ mt: 0.5 }}>
      <Grid item xs={12}>
        <Typography variant="subtitle2">Новый старший тренер</Typography>
        <Typography variant="caption" color="text.secondary">
          Зарплата по умолчанию: за человека на тренировке (настраивается в карточке сотрудника)
        </Typography>
      </Grid>
      <Grid item xs={12} sm={4}>
        <TextField
          fullWidth
          label="Фамилия"
          value={value.lastName}
          onChange={(e) => set('lastName', e.target.value)}
          required
          error={!!errors.lastName}
          helperText={errors.lastName}
        />
      </Grid>
      <Grid item xs={12} sm={4}>
        <TextField
          fullWidth
          label="Имя"
          value={value.firstName}
          onChange={(e) => set('firstName', e.target.value)}
          required
          error={!!errors.firstName}
          helperText={errors.firstName}
        />
      </Grid>
      <Grid item xs={12} sm={4}>
        <TextField
          fullWidth
          label="Отчество"
          value={value.middleName}
          onChange={(e) => set('middleName', e.target.value)}
        />
      </Grid>
      <Grid item xs={12} sm={6}>
        <TextField
          fullWidth
          label="Email"
          type="email"
          value={value.email}
          onChange={(e) => set('email', e.target.value.toLowerCase())}
          required
          error={!!errors.email}
          helperText={errors.email}
        />
      </Grid>
      <Grid item xs={12} sm={6}>
        <PasswordField
          fullWidth
          label="Пароль"
          value={value.password}
          onChange={(e) => set('password', e.target.value)}
          required
          error={!!errors.password}
          helperText={errors.password}
        />
      </Grid>
      <Grid item xs={12} sm={6}>
        <TextField
          fullWidth
          label="Телефон"
          value={value.phone}
          onChange={(e) => set('phone', e.target.value)}
          error={!!errors.phone}
          helperText={errors.phone}
        />
      </Grid>
      <Grid item xs={12} sm={6}>
        <TextField
          fullWidth
          label="Квалификация"
          value={value.qualification}
          onChange={(e) => set('qualification', e.target.value)}
        />
      </Grid>
      <Grid item xs={12} sm={6}>
        <TextField
          fullWidth
          label="Опыт (лет)"
          type="number"
          value={value.experience}
          onChange={(e) => set('experience', e.target.value)}
        />
      </Grid>
      <Grid item xs={12} sm={6}>
        <TextField
          fullWidth
          label="Специализация"
          value={value.specialization}
          onChange={(e) => set('specialization', e.target.value)}
        />
      </Grid>
    </Grid>
  );
}
