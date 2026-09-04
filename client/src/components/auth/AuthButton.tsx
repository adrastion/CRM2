import React from 'react';
import { Box, CircularProgress } from '@mui/material';
import { colors, radii, sizes, typography } from '../../theme/tokens';

interface AuthButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  /** primary — синяя, dark — тёмная (#404040) для «Стать партнером». */
  variant?: 'primary' | 'dark';
  loading?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit';
  fullWidth?: boolean;
}

/** Кнопка входа/регистрации: компактная высота из sizes. */
const AuthButton: React.FC<AuthButtonProps> = ({
  children,
  onClick,
  variant = 'primary',
  loading,
  disabled,
  type = 'button',
  fullWidth,
}) => {
  const bg = variant === 'primary' ? colors.primary : colors.textMuted;
  const isDisabled = Boolean(disabled || loading);

  return (
    <Box
      component="button"
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      sx={{
        border: 'none',
        cursor: isDisabled ? 'default' : 'pointer',
        fontFamily: 'inherit',
        fontWeight: 600,
        fontSize: typography.button,
        color: colors.white,
        bgcolor: bg,
        opacity: isDisabled ? 0.6 : 1,
        borderRadius: `${radii.button}px`,
        minWidth: fullWidth ? '100%' : { xs: 120, md: sizes.buttonMinWidth },
        width: fullWidth ? '100%' : 'auto',
        height: { xs: sizes.buttonHeightSm, md: sizes.buttonHeight },
        px: { xs: 2.5, md: 3 },
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        transition: 'transform 140ms ease, filter 140ms ease',
        '&:hover': isDisabled ? undefined : { filter: 'brightness(1.06)' },
        '&:active': isDisabled ? undefined : { transform: 'translateY(1px)' },
        '&:focus-visible': {
          outline: `3px solid ${colors.primarySoft}`,
          outlineOffset: 2,
        },
      }}
    >
      {loading ? <CircularProgress size={20} sx={{ color: colors.white }} /> : children}
    </Box>
  );
};

export default AuthButton;
