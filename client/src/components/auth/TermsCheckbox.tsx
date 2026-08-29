import React from 'react';
import { Box, Typography } from '@mui/material';
import { Check } from '@mui/icons-material';
import { colors, typography } from '../../theme/tokens';

interface TermsCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: boolean;
  label?: React.ReactNode;
}

/** Квадратный чекбокс из макета (25x25 / 16x16) с подписью справа. */
const TermsCheckbox: React.FC<TermsCheckboxProps> = ({ checked, onChange, error, label }) => (
  <Box
    component="button"
    type="button"
    role="checkbox"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 1.5,
      background: 'none',
      border: 'none',
      p: 0,
      cursor: 'pointer',
      textAlign: 'left',
      fontFamily: 'inherit',
      '&:focus-visible': { outline: `3px solid ${colors.primarySoft}`, outlineOffset: 3 },
    }}
  >
    <Box
      aria-hidden
      sx={{
        width: 24,
        height: 24,
        flexShrink: 0,
        borderRadius: '4px',
        border: `2px solid ${error ? colors.danger : checked ? colors.primary : colors.textMuted}`,
        bgcolor: checked ? colors.primary : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background-color 140ms ease, border-color 140ms ease',
      }}
    >
      {checked && <Check sx={{ fontSize: 18, color: colors.white }} />}
    </Box>
    <Typography
      component="span"
      sx={{
        fontSize: typography.hint,
        color: error ? colors.danger : colors.textMuted,
        lineHeight: 1.4,
      }}
    >
      {label || 'Принимаю условия клиентского соглашения и политики конфиденциальности'}
    </Typography>
  </Box>
);

export default TermsCheckbox;
