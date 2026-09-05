import React from 'react';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Add, DeleteOutline } from '@mui/icons-material';
import { Parent } from '../../types';
import { colors, radii, typography } from '../../theme/tokens';
import { AthleteCardMode, RELATION_LABELS } from './athleteCardTypes';

interface Props {
  parents: Parent[];
  mode: AthleteCardMode;
  editing: boolean;
  onChange: (parents: Parent[]) => void;
  onRemoveConfirm?: (index: number) => void;
}

const emptyParent = (): Parent =>
  ({
    id: `new-${Date.now()}`,
    fullName: '',
    phone: '',
    email: '',
    workplace: '',
    workplaceContact: '',
    relationType: 'other',
    isPrimaryContact: false,
    clientId: '',
    createdAt: '',
    updatedAt: '',
  }) as Parent;

const AthleteParents: React.FC<Props> = ({ parents, mode, editing, onChange, onRemoveConfirm }) => {
  const canEdit = mode === 'staff' && editing;

  return (
    <Box
      sx={{
        p: 2,
        bgcolor: colors.surface,
        borderRadius: radii.card,
        border: `1px solid ${colors.borderDisabled}`,
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
        <Typography sx={{ fontWeight: 700, fontSize: typography.panelTitle }}>
          Родители / законные представители
        </Typography>
        {canEdit && (
          <Button
            size="small"
            startIcon={<Add />}
            onClick={() => onChange([...parents, emptyParent()])}
            sx={{ textTransform: 'none' }}
          >
            Добавить
          </Button>
        )}
      </Box>

      {parents.length === 0 ? (
        <Typography sx={{ fontSize: typography.label, color: colors.textEmpty }}>
          Представители не указаны
        </Typography>
      ) : (
        <Stack spacing={1.5}>
          {parents.map((p, index) => (
            <Box
              key={p.id || index}
              sx={{
                p: 1.5,
                borderRadius: 1,
                border: `1px solid ${colors.divider}`,
                bgcolor: colors.card,
              }}
            >
              {canEdit ? (
                <Stack spacing={1}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography sx={{ fontSize: typography.label, fontWeight: 600 }}>
                      Представитель {index + 1}
                    </Typography>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => {
                        if (onRemoveConfirm) onRemoveConfirm(index);
                        else onChange(parents.filter((_, i) => i !== index));
                      }}
                    >
                      <DeleteOutline fontSize="small" />
                    </IconButton>
                  </Stack>
                  <TextField
                    size="small"
                    label="ФИО"
                    value={p.fullName || ''}
                    onChange={(e) => {
                      const next = [...parents];
                      next[index] = { ...p, fullName: e.target.value };
                      onChange(next);
                    }}
                    fullWidth
                  />
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                    <TextField
                      size="small"
                      label="Телефон"
                      value={p.phone || ''}
                      onChange={(e) => {
                        const next = [...parents];
                        next[index] = { ...p, phone: e.target.value };
                        onChange(next);
                      }}
                      fullWidth
                    />
                    <TextField
                      size="small"
                      select
                      label="Тип связи"
                      value={p.relationType || 'other'}
                      onChange={(e) => {
                        const next = [...parents];
                        next[index] = { ...p, relationType: e.target.value };
                        onChange(next);
                      }}
                      fullWidth
                    >
                      {Object.entries(RELATION_LABELS).map(([k, v]) => (
                        <MenuItem key={k} value={k}>
                          {v}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Stack>
                  <TextField
                    size="small"
                    label="Место работы"
                    value={p.workplace || ''}
                    onChange={(e) => {
                      const next = [...parents];
                      next[index] = { ...p, workplace: e.target.value };
                      onChange(next);
                    }}
                    fullWidth
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        size="small"
                        checked={Boolean(p.isPrimaryContact)}
                        onChange={(e) => {
                          const next = parents.map((item, i) => ({
                            ...item,
                            isPrimaryContact: i === index ? e.target.checked : false,
                          }));
                          onChange(next);
                        }}
                      />
                    }
                    label="Основной контакт"
                  />
                </Stack>
              ) : (
                <>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 0.5, flexWrap: 'wrap' }}>
                    <Typography sx={{ fontWeight: 700, fontSize: typography.label }}>
                      {p.fullName || '—'}
                    </Typography>
                    {p.relationType && (
                      <Chip size="small" label={RELATION_LABELS[p.relationType] || p.relationType} />
                    )}
                    {p.isPrimaryContact && (
                      <Chip size="small" color="primary" label="Основной контакт" />
                    )}
                  </Box>
                  <Typography sx={{ fontSize: typography.label, color: colors.textMuted }}>
                    Телефон: {p.phone || '—'}
                  </Typography>
                  <Typography sx={{ fontSize: typography.label, color: colors.textMuted }}>
                    Место работы: {p.workplace || '—'}
                  </Typography>
                </>
              )}
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
};

export default AthleteParents;
